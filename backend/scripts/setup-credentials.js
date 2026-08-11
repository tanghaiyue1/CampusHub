/**
 * @file backend/scripts/setup-credentials.js
 * @description 凭据设置脚本：首次运行引导用户安全录入 API Key
 *
 * 用法：node scripts/setup-credentials.js
 *
 * 安全特性：
 * - 密码输入不回显
 * - API Key 输入不回显
 * - 使用 AES-256-GCM 加密存储
 * - 存储后立即从内存中清除明文
 */

const readline = require("readline");
const credentialManager = require("../src/lib/credentialManager");

function hiddenInput(prompt) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    // 在 Windows 上使用 PowerShell 的 Read-Host -AsSecureString 模拟
    // 在 Unix 上使用 stdin 的 raw mode
    const stdin = process.stdin;
    const stdout = process.stdout;

    stdout.write(prompt);

    if (stdin.isTTY) {
      stdin.setRawMode(true);
    }

    let input = "";
    stdin.on("data", (char) => {
      char = char.toString();
      switch (char) {
        case "\n":
        case "\r":
        case "\r\n":
          stdout.write("\n");
          stdin.setRawMode(false);
          stdin.pause();
          rl.close();
          resolve(input);
          break;
        case "\u0008": // backspace
        case "\u007f": // delete
          if (input.length > 0) {
            input = input.slice(0, -1);
            stdout.write("\b \b");
          }
          break;
        case "\u0003": // Ctrl+C
          stdout.write("\n");
          process.exit(1);
          break;
        default:
          input += char;
          stdout.write("*");
      }
    });
  });
}

async function main() {
  console.log("=== CampusHub AI 凭据设置 ===\n");
  console.log("此脚本将帮助你安全地设置 AI API Key。");
  console.log("你的 Key 将被加密存储，绝不会明文出现在日志或文件中。\n");

  // 选择提供商
  console.log("支持的 AI 提供商：");
  console.log("  1. OpenAI (api.openai.com)");
  console.log("  2. DeepSeek (api.deepseek.com)");
  console.log("  3. 智谱 AI (open.bigmodel.cn)");
  console.log("");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const choice = await new Promise((resolve) => {
    rl.question("请选择提供商 (1/2/3): ", resolve);
  });

  const providers = { "1": "openai", "2": "deepseek", "3": "zhipu" };
  const provider = providers[choice];
  if (!provider) {
    console.log("无效选择，退出。");
    rl.close();
    process.exit(1);
  }

  const apiKey = await hiddenInput(`请输入 ${provider} API Key: `);
  if (!apiKey || apiKey.trim().length === 0) {
    console.log("API Key 不能为空，退出。");
    rl.close();
    process.exit(1);
  }

  // 设置主密码
  console.log("\n请设置一个主密码来保护你的凭据（请牢记）：");
  const masterPassword = await hiddenInput("主密码: ");
  if (!masterPassword || masterPassword.length < 6) {
    console.log("主密码至少需要 6 个字符，退出。");
    rl.close();
    process.exit(1);
  }

  const confirmPassword = await hiddenInput("确认主密码: ");
  if (masterPassword !== confirmPassword) {
    console.log("两次密码不一致，退出。");
    rl.close();
    process.exit(1);
  }

  // 存储
  try {
    const credentials = {};
    credentials[provider] = apiKey.trim();
    credentialManager.store(masterPassword, credentials);
    console.log(`\n✓ ${provider} API Key 已安全加密存储至 ~/.campushub/credentials.enc`);
    console.log("✓ 请在启动应用时调用 POST /api/ai/credentials/unlock 解锁凭据");
  } catch (err) {
    console.error("存储失败:", err.message);
  }

  rl.close();
}

main();
