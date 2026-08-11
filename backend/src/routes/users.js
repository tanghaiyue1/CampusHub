/**
 * @file backend/src/routes/users.js
 * @description 用户路由：资料、认证、信用分与历史
 */

const express = require('express');
const { asyncHandler } = require('../middleware/asyncHandler');
const { authRequired } = require('../middleware/auth');
const { success } = require('../lib/response');
const userService = require('../services/userService');
const creditService = require('../services/creditService');

const router = express.Router();

router.get(
  '/me',
  authRequired,
  asyncHandler(async (req, res) => {
    const data = await userService.getProfile(req.user.id);
    return success(res, data);
  }),
);

router.put(
  '/me',
  authRequired,
  asyncHandler(async (req, res) => {
    const data = await userService.updateProfile(req.user.id, req.body);
    return success(res, data, '资料已更新');
  }),
);

router.post(
  '/me/verification',
  authRequired,
  asyncHandler(async (req, res) => {
    const data = await userService.submitVerification(req.user.id, req.body);
    return success(res, data);
  }),
);

router.post(
  '/:id/verify',
  authRequired,
  asyncHandler(async (req, res) => {
    const data = await userService.approveVerification(Number(req.params.id));
    return success(res, data);
  }),
);

router.get(
  '/:id/credit',
  authRequired,
  asyncHandler(async (req, res) => {
    const data = await userService.getCredit(Number(req.params.id));
    return success(res, data);
  }),
);

router.get(
  '/:id/credit/history',
  authRequired,
  asyncHandler(async (req, res) => {
    const data = await creditService.getHistory(Number(req.params.id), req.query);
    return success(res, data);
  }),
);

router.get(
  '/:id',
  authRequired,
  asyncHandler(async (req, res) => {
    const data = await userService.getProfile(Number(req.params.id));
    return success(res, data);
  }),
);

module.exports = router;
