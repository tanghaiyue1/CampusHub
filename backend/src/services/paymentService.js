/**
 * @file backend/src/services/paymentService.js
 * @description 支付业务：托管、结算、退款（模拟，无真实支付）
 */

const { AppError } = require('../lib/errors');
const { getStore } = require('../db');

/** 发布需求时预冻结报酬（P1 UC-01） */
async function escrowOnPublish(requirement) {
  if (requirement.reward_type === 'free') {
    return { escrow_status: 'none', message: '无偿需求无需托管' };
  }
  const amount = requirement.reward_amount || 0;
  const store = getStore();
  await store.createPayment({
    requirement_id: requirement.id,
    amount,
    action: 'escrow',
    status: 'success',
  });
  await store.updateRequirement(requirement.id, { escrow_status: 'escrowed' });
  return { escrow_status: 'escrowed', amount, message: '发布时报酬已托管至平台' };
}

/** 确认接单后，订单继承需求托管状态 */
async function linkOrderEscrow(order, requirement) {
  if (requirement.reward_type === 'free') {
    await getStore().updateOrder(order.id, { payment_status: 'released' });
    return { payment_status: 'released' };
  }
  if (requirement.escrow_status !== 'escrowed') {
    throw new AppError(5001, '需求报酬未托管，无法确认接单');
  }
  await getStore().updateOrder(order.id, { payment_status: 'escrow' });
  return { payment_status: 'escrow' };
}

async function release(order, requirement) {
  const store = getStore();
  if (requirement.reward_type === 'free') {
    await store.updateOrder(order.id, { payment_status: 'released' });
    return { payment_status: 'released', message: '无偿需求已完成' };
  }
  if (requirement.escrow_status !== 'escrowed' && order.payment_status !== 'escrow') {
    throw new AppError(5001, '订单未处于托管状态');
  }
  const amount = requirement.reward_amount || 0;
  await store.createPayment({
    order_id: order.id,
    requirement_id: requirement.id,
    amount,
    action: 'release',
    status: 'success',
  });
  await store.updateRequirement(requirement.id, { escrow_status: 'released' });
  await store.updateOrder(order.id, { payment_status: 'released' });
  return { payment_status: 'released', amount, message: '报酬已结算给接单者' };
}

async function refundRequirement(requirement) {
  const store = getStore();
  if (requirement.reward_type === 'free' || requirement.escrow_status !== 'escrowed') {
    return { escrow_status: requirement.escrow_status, message: '无需退款' };
  }
  const amount = requirement.reward_amount || 0;
  await store.createPayment({
    requirement_id: requirement.id,
    amount,
    action: 'refund',
    status: 'success',
  });
  await store.updateRequirement(requirement.id, { escrow_status: 'refunded' });
  return { escrow_status: 'refunded', amount, message: '托管款已退回发布者' };
}

async function refundOrder(order, requirement) {
  const store = getStore();
  if (order.payment_status === 'escrow' && requirement.escrow_status === 'escrowed') {
    return refundRequirement(requirement);
  }
  await store.updateOrder(order.id, { payment_status: 'refunded' });
  return { payment_status: 'refunded', message: '订单已取消' };
}

async function getPaymentStatus(orderId, user) {
  const store = getStore();
  const order = await store.findOrderById(orderId);
  if (!order) throw new AppError(4004, '订单不存在');
  if (order.publisher_id !== user.id && order.acceptor_id !== user.id) {
    throw new AppError(4003, '无权查看');
  }
  const requirement = await store.findRequirementById(order.requirement_id);
  const payments = [
    ...(await store.listPaymentsByOrder(orderId)),
    ...(requirement ? await store.listPaymentsByRequirement(requirement.id) : []),
  ];
  return {
    order_id: order.id,
    payment_status: order.payment_status,
    requirement_escrow_status: requirement?.escrow_status,
    payments,
  };
}

module.exports = {
  escrowOnPublish,
  linkOrderEscrow,
  release,
  refundRequirement,
  refundOrder,
  getPaymentStatus,
};
