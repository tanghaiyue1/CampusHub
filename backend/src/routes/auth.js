/**
 * @file backend/src/routes/auth.js
 * @description 认证路由：注册、登录、锁定、找回密码
 */

const express = require('express');
const { asyncHandler } = require('../middleware/asyncHandler');
const { success } = require('../lib/response');
const authService = require('../services/authService');

const router = express.Router();

router.post(
  '/register',
  asyncHandler(async (req, res) => {
    const data = await authService.register(req.body);
    return success(res, data, '注册成功');
  }),
);

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const data = await authService.login(req.body);
    return success(res, data);
  }),
);

router.post(
  '/reset-password',
  asyncHandler(async (req, res) => {
    const data = await authService.resetPassword(req.body);
    return success(res, data);
  }),
);

module.exports = router;
