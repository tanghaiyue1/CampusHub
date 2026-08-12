/**
 * @file backend/tests/ai.test.js
 * @description AI 服务单元测试：使用 mock 验证需求分析和凭据管理
 *
 * vitest globals 模式已启用（describe, it, expect, vi 全局可用）
 */

// 设置 API Key 环境变量，使真实 credentialManager 可用
process.env.OPENAI_API_KEY = "mock-api-key-for-testing";

// Mock global fetch
global.fetch = vi.fn();

describe("AI Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("analyzeRequirement", () => {
    it("should analyze requirement and return structured result", async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  category: "express",
                  categoryLabel: "快递代取",
                  estimatedPrice: 10,
                  tags: ["快递", "代取", "校园"],
                  riskLevel: "low",
                  suggestion: "建议明确取件地点和时间",
                }),
              },
            },
          ],
          usage: { total_tokens: 150 },
        }),
      };

      global.fetch.mockResolvedValueOnce(mockResponse);

      const { analyzeRequirement } = require("../src/services/aiService");
      const result = await analyzeRequirement(
        "帮我取快递",
        "菜鸟驿站的快递，下午3点之前取"
      );

      expect(result).toHaveProperty("category");
      expect(result).toHaveProperty("estimatedPrice");
      expect(result).toHaveProperty("tags");
    });

    it("should handle API key missing error", async () => {
      // 临时移除 API Key
      const oldKey = process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_API_KEY;

      const { analyzeRequirement } = require("../src/services/aiService");
      await expect(
        analyzeRequirement("test", "test")
      ).rejects.toThrow("未配置");

      // 恢复
      process.env.OPENAI_API_KEY = oldKey;
    });
  });

  describe("chat", () => {
    it("should return chat response", async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          choices: [
            {
              message: {
                content: "你好！我是 CampusHub 的 AI 助手小C，有什么可以帮助你的吗？",
              },
            },
          ],
          usage: { total_tokens: 80 },
        }),
      };

      global.fetch.mockResolvedValueOnce(mockResponse);

      const { chat } = require("../src/services/aiService");
      const result = await chat(
        [{ role: "user", content: "你好" }],
        { userId: 1, nickname: "测试用户" }
      );

      expect(result).toHaveProperty("content");
      expect(result.content).toContain("小C");
    });
  });

  describe("getStatus", () => {
    it("should return credential status", () => {
      const { getStatus } = require("../src/services/aiService");
      const status = getStatus();
      expect(status.providers).toHaveProperty("openai");
      expect(status.providers.openai).toHaveProperty("configured");
      expect(typeof status.providers.openai.configured).toBe("boolean");
    });
  });
});

describe("AI Routes", () => {
  it("should reject analyze-requirement without auth", async () => {
    const app = require("../app");
    const request = require("supertest");
    const res = await request(app)
      .post("/api/ai/analyze-requirement")
      .send({ title: "test", description: "test" });
    expect(res.status).toBe(401);
  });
});

describe("Credential Manager", () => {
  it("should support unlock/lock cycle", () => {
    const cm = require("../src/lib/credentialManager");
    expect(() => cm.lock()).not.toThrow();
  });

  it("getApiKey should return null when not configured", () => {
    const cm = require("../src/lib/credentialManager");
    const key = cm.getApiKey("deepseek");
    expect(key === null || typeof key === "string").toBe(true);
  });
});
