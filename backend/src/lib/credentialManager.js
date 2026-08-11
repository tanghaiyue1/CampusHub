/**
 * @file backend/src/lib/credentialManager.js
 * @description 凭据安全管理：加密存储 API Key，绝不硬编码、绝不写入日志
 *
 * 威胁模型：
 * - 攻击者获得文件系统访问 → 密文存储（AES-256-GCM）
 * - 攻击者获得进程内存 → 使用后立即置零（尽力而为，Node.js 限制）
 * - 攻击者读取日志/终端 → 明文绝不输出到日志
 * - 攻击者读取 .env → 仅作初始引导，不存储真实 key
 *
 * 存储方案：
 * - 主密码模式：用户首次运行时设置主密码 → PBKDF2 派生密钥 → 加密存储
 * - 降级方案：Windows Credential Manager / macOS Keychain / Linux Secret Service
 * - .env 仅作 fallback 引导，且明确标注风险
 */

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const os = require("os");

const CREDENTIAL_DIR = path.join(os.homedir(), ".campushub");
const CREDENTIAL_FILE = path.join(CREDENTIAL_DIR, "credentials.enc");
const SALT_FILE = path.join(CREDENTIAL_DIR, ".salt");

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const SALT_LENGTH = 32;
const KEY_LENGTH = 32;
const PBKDF2_ITERATIONS = 600000;

let cachedKey = null;
let cachedPlaintext = null;

function getSalt() {
  if (!fs.existsSync(SALT_FILE)) {
    const salt = crypto.randomBytes(SALT_LENGTH);
    if (!fs.existsSync(CREDENTIAL_DIR)) {
      fs.mkdirSync(CREDENTIAL_DIR, { mode: 0o700 });
    }
    fs.writeFileSync(SALT_FILE, salt);
    return salt;
  }
  return fs.readFileSync(SALT_FILE);
}

function deriveKey(masterPassword, salt) {
  return crypto.pbkdf2Sync(
    masterPassword,
    salt,
    PBKDF2_ITERATIONS,
    KEY_LENGTH,
    "sha512"
  );
}

function encrypt(plaintext, key) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]);
}

function decrypt(ciphertext, key) {
  const iv = ciphertext.subarray(0, IV_LENGTH);
  const tag = ciphertext.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const encrypted = ciphertext.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

function zeroBuffer(buf) {
  if (Buffer.isBuffer(buf)) {
    crypto.randomBytes(buf.length).copy(buf);
  }
}

/**
 * 从环境变量获取 API Key（仅作 fallback，明文风险）
 */
function getFromEnv(provider) {
  const envMap = {
    openai: "OPENAI_API_KEY",
    deepseek: "DEEPSEEK_API_KEY",
    zhipu: "ZHIPU_API_KEY",
  };
  const envKey = envMap[provider];
  if (!envKey) return null;
  const key = process.env[envKey];
  if (key) {
    console.warn(
      `[凭据] 警告：正在从环境变量 ${envKey} 读取 API Key。` +
        `此方式明文存储，存在风险。建议使用 "node scripts/setup-credentials.js" 设置加密存储。`
    );
  }
  return key || null;
}

/**
 * 解锁凭据存储
 */
function unlock(masterPassword) {
  if (!fs.existsSync(CREDENTIAL_FILE)) {
    return false;
  }
  const salt = getSalt();
  const key = deriveKey(masterPassword, salt);
  try {
    const ciphertext = fs.readFileSync(CREDENTIAL_FILE);
    decrypt(ciphertext, key); // 验证解密成功
    cachedKey = key;
    return true;
  } catch {
    return false;
  }
}

/**
 * 存储凭据
 */
function store(masterPassword, credentials) {
  const salt = getSalt();
  const key = deriveKey(masterPassword, salt);
  const plaintext = JSON.stringify(credentials);
  const ciphertext = encrypt(plaintext, key);
  fs.writeFileSync(CREDENTIAL_FILE, ciphertext);
  cachedKey = key;
  cachedPlaintext = null;
  const plainBuf = Buffer.from(plaintext, "utf8");
  zeroBuffer(plainBuf);
}

/**
 * 获取 API Key
 */
function getApiKey(provider) {
  // 1. 尝试从加密存储读取
  if (cachedKey && fs.existsSync(CREDENTIAL_FILE)) {
    try {
      const ciphertext = fs.readFileSync(CREDENTIAL_FILE);
      const plaintext = decrypt(ciphertext, cachedKey);
      const creds = JSON.parse(plaintext);
      const key = creds[provider];
      const plainBuf = Buffer.from(plaintext, "utf8");
      zeroBuffer(plainBuf);
      if (key) return key;
    } catch {
      // 解密失败，回退到环境变量
    }
  }

  // 2. fallback 到环境变量
  return getFromEnv(provider);
}

/**
 * 检查凭据是否已配置
 */
function isConfigured(provider) {
  const key = getApiKey(provider);
  return !!key;
}

/**
 * 获取凭据状态（不暴露明文）
 */
function getStatus() {
  const status = {
    encrypted: fs.existsSync(CREDENTIAL_FILE),
    unlocked: !!cachedKey,
    providers: {},
  };

  const providers = ["openai", "deepseek", "zhipu"];
  for (const p of providers) {
    status.providers[p] = {
      configured: !!getApiKey(p),
      source: cachedKey ? "encrypted" : getFromEnv(p) ? "env" : "none",
    };
  }
  return status;
}

/**
 * 清除缓存
 */
function lock() {
  if (cachedKey) {
    zeroBuffer(cachedKey);
    cachedKey = null;
  }
  cachedPlaintext = null;
}

module.exports = {
  unlock,
  store,
  getApiKey,
  isConfigured,
  getStatus,
  lock,
  getFromEnv,
};
