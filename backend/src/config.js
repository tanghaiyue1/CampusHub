/**
 * @file backend/src/config.js
 * @description 读取环境变量：端口、JWT、数据库、内存库模式、AI 配置
 */

require("dotenv").config();

module.exports = {
  port: Number(process.env.PORT) || 3000,
  jwtSecret: process.env.JWT_SECRET || "campushub-dev-secret",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  useMemoryDb:
    process.env.USE_MEMORY_DB === "1" ||
    process.env.NODE_ENV === "test" ||
    process.env.USE_MEMORY_DB === "true",
  db: {
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "campushub",
  },
  loginLock: {
    maxAttempts: 3,
    lockMinutes: 15,
  },
  minCreditToPublish: Number(process.env.MIN_CREDIT_PUBLISH) || 60,
  minCreditToAccept: Number(process.env.MIN_CREDIT_ACCEPT) || 60,
  ai: {
    provider: process.env.AI_PROVIDER || "openai",
    model: process.env.AI_MODEL || "gpt-4.1-mini",
    // API Key 不在此处配置，通过 credentialManager 安全存储
    // 环境变量仅作 fallback（明文风险，不推荐）
  },
};
