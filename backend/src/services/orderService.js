/**
 * @file backend/src/services/orderService.js
 * @description 订单业务：申请、确认、状态流转、取消
 */

const { AppError } = require('../lib/errors');
const { ORDER_TRANSITIONS, ORDER_STATUS_LABELS } = require('../lib/constants');
const config = require('../config');
const { getStore } = require('../db');
const { toPublicUser } = require('../utils/userPresenter');
const { assertVerified } = require('./userService');
const { enrichRequirement } = require('./requirementService');
const paymentService = require('./paymentService');
const messageService = require('./messageService');
const creditService = require('./creditService');
const evaluationService = require('./evaluationService');

const ACTIVE_ORDER_STATUSES = ['accepted', 'in_progress', 'ready_for_acceptance', 'completed'];

function statusLabel(status) {
  return ORDER_STATUS_LABELS[status] || status;
}

async function enrichOrder(order, viewerId = null) {
  const store = getStore();
  const requirement = await store.findRequirementById(order.requirement_id);
  const publisher = await store.findUserById(order.publisher_id);
  const acceptor = await store.findUserById(order.acceptor_id);
  const logs = await store.getOrderLogs(order.id);

  const base = {
    id: order.id,
    order_no: order.order_no,
    requirement_id: order.requirement_id,
    status: order.status,
    payment_status: order.payment_status,
    completed_at: order.completed_at,
    created_at: order.created_at,
    requirement: requirement ? await enrichRequirement(requirement) : null,
    publisher: toPublicUser(publisher),
    acceptor: toPublicUser(acceptor),
    timeline: logs.map((log) => ({
      ...log,
      from_label: log.from_status ? statusLabel(log.from_status) : '—',
      to_label: statusLabel(log.to_status),
    })),
    actions: buildActions(order, viewerId),
  };

  if (viewerId && order.status === 'completed') {
    await evaluationService.applyDefaultEvaluations(order.id);
    base.evaluation = await evaluationService.getOrderEvaluationSummary(
      await store.findOrderById(order.id),
      viewerId,
    );
  }

  return base;
}

function buildActions(order, viewerId) {
  if (!viewerId) return {};
  const uid = Number(viewerId);
  const isPublisher = uid === Number(order.publisher_id);
  const isAcceptor = uid === Number(order.acceptor_id);
  return {
    can_confirm: isPublisher && order.status === 'pending_confirm',
    can_reject: isPublisher && order.status === 'pending_confirm',
    can_start: isAcceptor && order.status === 'accepted',
    can_mark_ready: isAcceptor && order.status === 'in_progress',
    can_complete: isPublisher && order.status === 'ready_for_acceptance',
    can_cancel: isPublisher || isAcceptor
      ? ['accepted', 'in_progress', 'ready_for_acceptance'].includes(order.status)
      : false,
  };
}

async function applyOrder(user, body) {
  assertVerified(user);
  if (user.credit_score < config.minCreditToAccept) {
    throw new AppError(40031, '信用分不足，无法申请接单');
  }

  const { requirement_id } = body;
  if (!requirement_id) throw new AppError(4000, 'requirement_id 必填');

  const store = getStore();
  const requirement = await store.findRequirementById(requirement_id);
  if (!requirement) throw new AppError(4004, '需求不存在');
  if (requirement.status !== 'pending') {
    throw new AppError(5001, '该需求不可接单');
  }
  if (requirement.publisher_id === user.id) {
    throw new AppError(4003, '不能接自己的需求');
  }

  const accepted = await store.findAcceptedOrderByRequirement(requirement_id);
  if (accepted) {
    throw new AppError(4009, '该需求已被他人接单');
  }

  const dup = await store.findApplicationByUserAndRequirement(user.id, requirement_id);
  if (dup) {
    throw new AppError(4009, '您已提交过接单申请');
  }

  const order = await store.createOrder({
    requirement_id,
    publisher_id: requirement.publisher_id,
    acceptor_id: user.id,
  });

  await messageService.notifyOrderApplied(order, requirement, user);

  return {
    order_id: order.id,
    order_no: order.order_no,
    status: order.status,
  };
}

async function confirmOrder(user, orderId) {
  const store = getStore();
  const order = await store.findOrderById(orderId);
  if (!order) throw new AppError(4004, '订单不存在');
  if (order.publisher_id !== user.id) throw new AppError(4003, '仅发布者可确认接单');
  if (order.status !== 'pending_confirm') {
    throw new AppError(5001, '订单状态不允许确认');
  }

  const accepted = await store.findAcceptedOrderByRequirement(order.requirement_id);
  if (accepted) {
    throw new AppError(4009, '该需求已确认其他接单者');
  }

  const requirement = await store.findRequirementById(order.requirement_id);
  const acceptor = await store.findUserById(order.acceptor_id);
  await store.updateOrder(order.id, { status: 'accepted' });
  await store.updateRequirement(requirement.id, { status: 'accepted' });
  await store.addOrderLog(order.id, 'pending_confirm', 'accepted', user.id, '发布者确认接单');
  await store.rejectOtherApplications(order.requirement_id, order.id);

  const updated = await store.findOrderById(order.id);
  await paymentService.linkOrderEscrow(updated, requirement);
  await messageService.notifyOrderConfirmed(updated, requirement, acceptor);

  return enrichOrder(await store.findOrderById(order.id), user.id);
}

async function rejectOrder(user, orderId) {
  const store = getStore();
  const order = await store.findOrderById(orderId);
  if (!order) throw new AppError(4004, '订单不存在');
  if (order.publisher_id !== user.id) throw new AppError(4003, '仅发布者可拒绝');
  if (order.status !== 'pending_confirm') {
    throw new AppError(5001, '订单状态不允许拒绝');
  }
  const requirement = await store.findRequirementById(order.requirement_id);
  const acceptor = await store.findUserById(order.acceptor_id);
  await store.updateOrder(order.id, { status: 'rejected' });
  await store.addOrderLog(order.id, 'pending_confirm', 'rejected', user.id, '发布者拒绝接单申请');
  await messageService.notifyOrderRejected(order, requirement, acceptor);
  return { message: '已拒绝该接单申请' };
}

async function startOrder(user, orderId) {
  const store = getStore();
  const order = await store.findOrderById(orderId);
  if (!order) throw new AppError(4004, '订单不存在');
  if (order.acceptor_id !== user.id) throw new AppError(4003, '仅接单者可开始履约');
  return transitionOrder(user, orderId, 'in_progress', '接单者开始履约');
}

async function markReady(user, orderId) {
  const store = getStore();
  const order = await store.findOrderById(orderId);
  if (!order) throw new AppError(4004, '订单不存在');
  if (order.acceptor_id !== user.id) throw new AppError(4003, '仅接单者可提交验收');
  const result = await transitionOrder(user, orderId, 'ready_for_acceptance', '接单者提交验收，等待发布者确认');
  const requirement = await store.findRequirementById(order.requirement_id);
  await messageService.notifyOrderReady(await store.findOrderById(orderId), requirement);
  return result;
}

async function completeOrder(user, orderId) {
  const store = getStore();
  const order = await store.findOrderById(orderId);
  if (!order) throw new AppError(4004, '订单不存在');
  if (order.publisher_id !== user.id) throw new AppError(4003, '仅发布者可确认完成');
  return transitionOrder(user, orderId, 'completed', '发布者确认验收完成');
}

async function cancelOrder(user, orderId) {
  return transitionOrder(user, orderId, 'cancelled', '订单已取消');
}

async function transitionOrder(user, orderId, newStatus, noteOverride) {
  const store = getStore();
  const order = await store.findOrderById(orderId);
  if (!order) throw new AppError(4004, '订单不存在');

  const isParty = order.publisher_id === user.id || order.acceptor_id === user.id;
  if (!isParty) throw new AppError(4003, '无权操作此订单');

  const allowed = ORDER_TRANSITIONS[order.status] || [];
  if (!allowed.includes(newStatus)) {
    throw new AppError(
      5001,
      `当前状态为「${statusLabel(order.status)}」，无法变更为「${statusLabel(newStatus)}」`,
    );
  }

  if (newStatus === 'in_progress' && order.acceptor_id !== user.id) {
    throw new AppError(4003, '仅接单者可开始履约');
  }
  if (newStatus === 'ready_for_acceptance' && order.acceptor_id !== user.id) {
    throw new AppError(4003, '仅接单者可提交验收');
  }
  if (newStatus === 'completed' && order.publisher_id !== user.id) {
    throw new AppError(4003, '仅发布者可确认完成');
  }

  const requirement = await store.findRequirementById(order.requirement_id);
  const from = order.status;

  const patch = { status: newStatus };
  if (newStatus === 'completed') {
    patch.completed_at = new Date().toISOString();
  }
  await store.updateOrder(order.id, patch);
  await store.addOrderLog(order.id, from, newStatus, user.id, noteOverride || bodyNote(newStatus));

  const partyIds = [order.publisher_id, order.acceptor_id];

  if (newStatus === 'in_progress') {
    await store.updateRequirement(requirement.id, { status: 'in_progress' });
    await messageService.notifyOrderInProgress(await store.findOrderById(order.id), partyIds);
  }
  if (newStatus === 'completed') {
    await store.updateRequirement(requirement.id, { status: 'completed' });
    const updated = await store.findOrderById(order.id);
    await paymentService.release(updated, requirement);
    await creditService.onOrderCompleted(order.id, order.publisher_id, order.acceptor_id);
    await messageService.notifyOrderCompleted(updated, partyIds);
  }
  if (newStatus === 'cancelled') {
    const updated = await store.findOrderById(order.id);
    if (['accepted', 'in_progress', 'ready_for_acceptance'].includes(from)) {
      await store.updateRequirement(requirement.id, { status: 'pending' });
      await paymentService.refundOrder(updated, requirement);
      if (from === 'in_progress' || from === 'ready_for_acceptance') {
        const cancellerIsAcceptor = user.id === order.acceptor_id;
        if (cancellerIsAcceptor) {
          await creditService.onOrderCancelledByUser(order.acceptor_id, order.id);
        }
      }
    }
    await messageService.notifyOrderCancelled(updated, partyIds);
  }

  return enrichOrder(await store.findOrderById(order.id), user.id);
}

function bodyNote(status) {
  const map = {
    in_progress: '接单者开始履约',
    ready_for_acceptance: '接单者提交验收',
    completed: '发布者确认验收完成',
    cancelled: '订单已取消',
  };
  return map[status] || statusLabel(status);
}

async function getOrder(user, orderId) {
  const store = getStore();
  const order = await store.findOrderById(orderId);
  if (!order) throw new AppError(4004, '订单不存在');
  if (order.publisher_id !== user.id && order.acceptor_id !== user.id) {
    throw new AppError(4003, '无权查看此订单');
  }
  return enrichOrder(order, user.id);
}

async function listOrders(user, query) {
  const store = getStore();
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(query.limit) || 10));
  const { items, total } = await store.listOrders({
    user_id: user.id,
    role: query.role,
    status: query.status,
    page,
    limit,
  });
  const list = await Promise.all(items.map((o) => enrichOrder(o, user.id)));
  return { list, total, page, limit };
}

module.exports = {
  applyOrder,
  confirmOrder,
  rejectOrder,
  startOrder,
  markReady,
  completeOrder,
  cancelOrder,
  transitionOrder,
  getOrder,
  listOrders,
  ACTIVE_ORDER_STATUSES,
};
