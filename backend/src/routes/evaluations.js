/**
 * @file backend/src/routes/evaluations.js
 * @description 评价路由：提交、查询、申诉与处理
 */

const express = require('express');
const { asyncHandler } = require('../middleware/asyncHandler');
const { authRequired } = require('../middleware/auth');
const { success } = require('../lib/response');
const evaluationService = require('../services/evaluationService');

const router = express.Router();

router.use(authRequired);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = await evaluationService.submitEvaluation(req.user, req.body);
    return success(res, data, '评价成功');
  }),
);

router.get(
  '/order/:orderId',
  asyncHandler(async (req, res) => {
    const data = await evaluationService.listByOrder(req.user, req.params.orderId);
    return success(res, data);
  }),
);

router.get(
  '/user/:userId',
  asyncHandler(async (req, res) => {
    const data = await evaluationService.listByUser(req.params.userId, req.user, req.query);
    return success(res, data);
  }),
);

router.post(
  '/:id/appeal',
  asyncHandler(async (req, res) => {
    const data = await evaluationService.appealEvaluation(req.user, req.params.id, req.body);
    return success(res, data);
  }),
);

router.post(
  '/:id/appeal/resolve',
  asyncHandler(async (req, res) => {
    const data = await evaluationService.resolveAppeal(req.user, req.params.id, req.body);
    return success(res, data, '申诉已处理');
  }),
);

module.exports = router;
