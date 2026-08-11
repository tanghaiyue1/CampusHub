/**
 * @file backend/src/routes/orders.js
 * @description 订单路由：申请、确认/拒绝、状态、取消、列表
 */

const express = require('express');
const { asyncHandler } = require('../middleware/asyncHandler');
const { authRequired } = require('../middleware/auth');
const { success } = require('../lib/response');
const orderService = require('../services/orderService');

const router = express.Router();

router.use(authRequired);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const data = await orderService.listOrders(req.user, req.query);
    return success(res, data);
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const data = await orderService.getOrder(req.user, req.params.id);
    return success(res, data);
  }),
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = await orderService.applyOrder(req.user, req.body);
    return success(res, data, '接单申请已提交');
  }),
);

router.post(
  '/:id/confirm',
  asyncHandler(async (req, res) => {
    const data = await orderService.confirmOrder(req.user, req.params.id);
    return success(res, data, '已确认接单');
  }),
);

router.post(
  '/:id/reject',
  asyncHandler(async (req, res) => {
    const data = await orderService.rejectOrder(req.user, req.params.id);
    return success(res, data);
  }),
);

router.post(
  '/:id/start',
  asyncHandler(async (req, res) => {
    const data = await orderService.startOrder(req.user, req.params.id);
    return success(res, data, '已开始履约');
  }),
);

router.post(
  '/:id/ready',
  asyncHandler(async (req, res) => {
    const data = await orderService.markReady(req.user, req.params.id);
    return success(res, data, '已提交验收，等待发布者确认');
  }),
);

router.post(
  '/:id/complete',
  asyncHandler(async (req, res) => {
    const data = await orderService.completeOrder(req.user, req.params.id);
    return success(res, data, '订单已完成');
  }),
);

router.post(
  '/:id/cancel',
  asyncHandler(async (req, res) => {
    const data = await orderService.cancelOrder(req.user, req.params.id);
    return success(res, data, '订单已取消');
  }),
);

router.put(
  '/:id/status',
  asyncHandler(async (req, res) => {
    const { status } = req.body;
    if (!status) {
      const { AppError } = require('../lib/errors');
      throw new AppError(4000, 'status 必填');
    }
    if (status === 'in_progress') {
      const data = await orderService.startOrder(req.user, req.params.id);
      return success(res, data, '已开始履约');
    }
    if (status === 'ready_for_acceptance') {
      const data = await orderService.markReady(req.user, req.params.id);
      return success(res, data, '已提交验收');
    }
    if (status === 'completed') {
      const data = await orderService.completeOrder(req.user, req.params.id);
      return success(res, data, '订单已完成');
    }
    const data = await orderService.transitionOrder(req.user, req.params.id, status);
    return success(res, data, '订单状态已更新');
  }),
);

module.exports = router;
