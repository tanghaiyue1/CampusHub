/**
 * @file backend/src/services/aiService.js
 * @description AI 服务：需求智能分析 + 校园AI助手对话
 *
 * 功能：
 * 1. analyzeRequirement() - 分析需求描述，推荐分类/预估价格/标签
 * 2. chat() - 校园AI助手对话，帮助用户搜索需求、解答平台问题
 *
 * 安全：
 * - API Key 通过 credentialManager 获取，绝不硬编码
 * - 请求/响应不记录到日志（仅记录 token 用量）
 * - 超时 15s，防止 LLM 挂起
 */

const credentialManager = require("../lib/credentialManager");

const DEFAULT_PROVIDER = process.env.AI_PROVIDER || "openai";
const DEFAULT_MODEL = process.env.AI_MODEL || "gpt-4.1-mini";
const REQUEST_TIMEOUT_MS = 15000;

const CATEGORIES = [
  "express",
  "tutoring",
  "secondhand",
  "team",
  "lost_found",
  "errand",
  "borrow",
  "consulting",
];

const CATEGORY_LABELS = {
  express: "快递代取",
  tutoring: "学习辅导",
  secondhand: "二手交易",
  team: "组队活动",
  lost_found: "失物招领",
  errand: "跑腿代办",
  borrow: "物品借用",
  consulting: "咨询答疑",
};

/**
 * 构建 LLM API 请求
 */
async function callLLM(messages, options = {}) {
  const provider = options.provider || DEFAULT_PROVIDER;
  const model = options.model || DEFAULT_MODEL;
  const apiKey = credentialManager.getApiKey(provider);

  if (!apiKey) {
    throw new Error(
      `未配置 ${provider} API Key。请运行 "node scripts/setup-credentials.js" 设置，或设置环境变量。`
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    let endpoint, headers, body;

    if (provider === "openai") {
      endpoint = "https://api.openai.com/v1/chat/completions";
      headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      };
      body = JSON.stringify({
        model,
        messages,
        temperature: options.temperature || 0.3,
        max_tokens: options.maxTokens || 500,
      });
    } else if (provider === "deepseek") {
      endpoint = "https://api.deepseek.com/v1/chat/completions";
      headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      };
      body = JSON.stringify({
        model: model || "deepseek-chat",
        messages,
        temperature: options.temperature || 0.3,
        max_tokens: options.maxTokens || 500,
      });
    } else if (provider === "zhipu") {
      endpoint = "https://open.bigmodel.cn/api/paas/v4/chat/completions";
      headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      };
      body = JSON.stringify({
        model: model || "glm-4-flash",
        messages,
        temperature: options.temperature || 0.3,
        max_tokens: options.maxTokens || 500,
      });
    } else {
      throw new Error(`不支持的 AI 提供商: ${provider}`);
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body,
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      if (response.status === 401) {
        throw new Error(`API Key 无效，请检查 ${provider} 凭据配置`);
      }
      throw new Error(`AI 服务请求失败 (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    return {
      content: data.choices[0].message.content,
      usage: data.usage,
    };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * 分析需求描述，返回分类推荐、预估价格、标签
 */
async function analyzeRequirement(title, description) {
  const systemPrompt = `你是 CampusHub 校园互助平台的 AI 助手。你的任务是分析用户发布的需求，并给出建议。

你需要以 JSON 格式返回以下字段：
{
  "category": "推荐分类（英文）",
  "categoryLabel": "推荐分类（中文）",
  "estimatedPrice": 预估价格（数字，单位元，范围 5-200），
  "tags": ["标签1", "标签2", "标签3"],
  "riskLevel": "low/medium/high",
  "suggestion": "给发布者的建议（1-2句话）"
}

可选分类：${CATEGORIES.join(", ")}（${Object.values(CATEGORY_LABELS).join("、")}）

规则：
- 配送/取件/代拿 → express
- 辅导/作业/考试/学习 → tutoring
- 二手/出售/转让/求购 → secondhand
- 组队/组队/队友/比赛 → team
- 失物/招领/捡到/丢失 → lost_found
- 跑腿/代办/代买/排队 → errand
- 借/借用/租用 → borrow
- 咨询/答疑/建议/问 → consulting
- 预估价格基于任务复杂度，简单任务 5-20，中等 20-60，复杂 60-200
- 高风险：涉及贵重物品、隐私信息、线下见面等`;

  const userMessage = `请分析以下需求：
标题：${title}
描述：${description}`;

  const result = await callLLM(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    { temperature: 0.2, maxTokens: 300 }
  );

  try {
    // 尝试提取 JSON
    const jsonMatch = result.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return { raw: result.content };
  } catch {
    return { raw: result.content };
  }
}

/**
 * 校园AI助手对话
 */
async function chat(messages, userContext) {
  const systemPrompt = `你是 CampusHub 校园互助平台的 AI 助手"小C"。你帮助用户：
1. 了解平台功能（发布需求、接单、支付、评价等）
2. 搜索合适的需求（根据用户兴趣推荐）
3. 解答平台使用问题
4. 提供校园生活建议

平台功能介绍：
- 用户可以发布需求（快递代取、学习辅导、二手交易、组队活动、失物招领、跑腿代办、物品借用、咨询答疑）
- 其他用户可以接单并完成任务
- 使用信用积分系统（发布需求需 60 积分，接单需 60 积分）
- 任务完成后可以互相评价

当前用户信息：${userContext ? JSON.stringify(userContext) : "未登录用户"}

回复要求：
- 热情友好，使用中文
- 回复简洁，不超过 200 字
- 如果用户想找需求，推荐 1-2 个相关分类
- 如果用户有具体问题，给出准确解答`;

  const result = await callLLM(
    [
      { role: "system", content: systemPrompt },
      ...messages,
    ],
    { temperature: 0.7, maxTokens: 500 }
  );

  return result;
}

/**
 * 获取凭据状态
 */
function getStatus() {
  return credentialManager.getStatus();
}

module.exports = {
  analyzeRequirement,
  chat,
  getStatus,
  callLLM,
};
