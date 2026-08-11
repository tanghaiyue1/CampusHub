/**
 * @file backend/src/routes/payments.js
 * @description 支付路由：查询订单托管/结算状态（模拟）
 */

const express = require('express');
const { asyncHandler } = require('../middleware/asyncHandler');
const { authRequired } = require('../middleware/auth');
const { success } = require('../lib/response');
const paymentService = require('../services/paymentService');

const router = express.Router();

router.use(authRequired);

router.get(
  '/orders/:orderId',
  asyncHandler(async (req, res) => {
    const data = await paymentService.getPaymentStatus(req.params.orderId, req.user);
    return success(res, data);
  }),
);

module.exports = router;
