/**
 * @file backend/src/routes/ai.js
 * @description AI 功能路由：需求分析、校园助手对话、凭据管理
 */

const express = require("express");
const { authRequired } = require("../middleware/auth");
const { asyncHandler } = require("../middleware/asyncHandler");
const { fail, success } = require("../lib/response");
const aiService = require("../services/aiService");
const credentialManager = require("../lib/credentialManager");

const router = express.Router();

/**
 * POST /api/ai/analyze-requirement
 * 分析需求描述，推荐分类、预估价格
 */
router.post(
  "/analyze-requirement",
  authRequired,
  asyncHandler(async (req, res) => {
    const { title, description } = req.body;
    if (!title || !description) {
      return fail(res, 400, "请提供需求标题和描述");
    }
    const result = await aiService.analyzeRequirement(title, description);
    success(res, result);
  })
);

/**
 * POST /api/ai/chat
 * 校园AI助手对话
 */
router.post(
  "/chat",
  authRequired,
  asyncHandler(async (req, res) => {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return fail(res, 400, "请提供对话消息列表");
    }
    const userContext = {
      userId: req.user.id,
      studentId: req.user.student_id,
      nickname: req.user.nickname,
    };
    const result = await aiService.chat(messages, userContext);
    success(res, {
      reply: result.content,
      usage: result.usage,
    });
  })
);

/**
 * GET /api/ai/status
 * 获取 AI 凭据配置状态（不暴露明文）
 */
router.get(
  "/status",
  authRequired,
  asyncHandler(async (req, res) => {
    const status = aiService.getStatus();
    success(res, status);
  })
);

/**
 * POST /api/ai/credentials/unlock
 * 解锁凭据存储
 */
router.post(
  "/credentials/unlock",
  authRequired,
  asyncHandler(async (req, res) => {
    const { masterPassword } = req.body;
    if (!masterPassword) {
      return fail(res, 400, "请提供主密码");
    }
    const ok = credentialManager.unlock(masterPassword);
    if (ok) {
      success(res, { message: "凭据已解锁" });
    } else {
      fail(res, 400, "密码错误或凭据文件不存在");
    }
  })
);

/**
 * POST /api/ai/credentials/lock
 * 锁定凭据存储
 */
router.post(
  "/credentials/lock",
  authRequired,
  asyncHandler(async (req, res) => {
    credentialManager.lock();
    success(res, { message: "凭据已锁定" });
  })
);

module.exports = router;
