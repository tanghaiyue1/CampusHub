/**
 * @file backend/src/routes/messages.js
 * @description 消息路由：列表、未读数、标记已读
 */

const express = require('express');
const { asyncHandler } = require('../middleware/asyncHandler');
const { authRequired } = require('../middleware/auth');
const { success } = require('../lib/response');
const messageService = require('../services/messageService');

const router = express.Router();

router.use(authRequired);

router.get(
  '/unread/count',
  asyncHandler(async (req, res) => {
    const data = await messageService.unreadCount(req.user.id);
    return success(res, data);
  }),
);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const data = await messageService.listMessages(req.user.id, req.query);
    return success(res, data);
  }),
);

router.put(
  '/read-all',
  asyncHandler(async (req, res) => {
    const data = await messageService.markAllRead(req.user.id);
    return success(res, data, '已全部标为已读');
  }),
);

router.put(
  '/:id/read',
  asyncHandler(async (req, res) => {
    const data = await messageService.markRead(req.user.id, req.params.id);
    return success(res, data);
  }),
);

module.exports = router;
