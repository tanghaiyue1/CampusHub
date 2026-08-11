/**
 * @file backend/src/services/evaluationService.js
 * @description 评价业务：互评、超时默认、申诉
 */

const { AppError } = require('../lib/errors');
const { getStore } = require('../db');
const { toPublicUser } = require('../utils/userPresenter');
const creditService = require('./creditService');
const messageService = require('./messageService');

const EVALUATION_HOURS = 24;

function evaluationDeadline(completedAt) {
  if (!completedAt) return null;
  return new Date(new Date(completedAt).getTime() + EVALUATION_HOURS * 3600 * 1000).toISOString();
}

function isWithinEvaluationWindow(order) {
  if (!order.completed_at) return false;
  return new Date() <= new Date(evaluationDeadline(order.completed_at));
}

async function enrichEvaluation(ev, evaluator, evaluatee) {
  const hide = ev.is_anonymous;
  return {
    id: ev.id,
    order_id: ev.order_id,
    rating: ev.rating,
    comment: ev.comment,
    is_anonymous: ev.is_anonymous,
    appeal_status: ev.appeal_status,
    is_auto_default: Boolean(ev.is_auto_default),
    created_at: ev.created_at,
    evaluator: hide ? toPublicUser(evaluator, { hideIdentity: true }) : toPublicUser(evaluator),
    evaluatee: toPublicUser(evaluatee),
  };
}

async function getOrderEvaluationSummary(order, userId) {
  const store = getStore();
  const uid = Number(userId);
  const evaluations = await store.listEvaluationsByOrder(order.id);
  const otherId =
    uid === Number(order.publisher_id) ? Number(order.acceptor_id) : Number(order.publisher_id);
  const myEv = evaluations.find((e) => Number(e.evaluator_id) === uid);
  const peerEv = evaluations.find((e) => Number(e.evaluator_id) === otherId);
  const deadline = evaluationDeadline(order.completed_at);
  const canEvaluate =
    order.status === 'completed' &&
    isWithinEvaluationWindow(order) &&
    !myEv &&
    (uid === Number(order.publisher_id) || uid === Number(order.acceptor_id));

  const allEvaluations = await Promise.all(
    evaluations.map(async (ev) =>
      enrichEvaluation(
        ev,
        await store.findUserById(ev.evaluator_id),
        await store.findUserById(ev.evaluatee_id),
      ),
    ),
  );

  return {
    can_evaluate: canEvaluate,
    evaluation_deadline: deadline,
    my_evaluation: myEv
      ? await enrichEvaluation(
          myEv,
          await store.findUserById(myEv.evaluator_id),
          await store.findUserById(myEv.evaluatee_id),
        )
      : null,
    peer_evaluation: peerEv
      ? await enrichEvaluation(
          peerEv,
          await store.findUserById(peerEv.evaluator_id),
          await store.findUserById(peerEv.evaluatee_id),
        )
      : null,
    all_evaluations: allEvaluations,
    both_completed: evaluations.length >= 2,
  };
}

async function applyCreditAfterBothRated(orderId) {
  const store = getStore();
  const evaluations = await store.listEvaluationsByOrder(orderId);
  if (evaluations.length < 2) return;

  const order = await store.findOrderById(orderId);
  if (order?.credit_applied) return;

  for (const ev of evaluations) {
    await creditService.onRatingReceived(ev.evaluatee_id, ev.rating, ev.id);
  }
  await store.updateOrder(orderId, { credit_applied: true });
}

async function submitEvaluation(user, body) {
  const { order_id, rating, comment, is_anonymous } = body;
  if (!order_id || rating === undefined) {
    throw new AppError(4000, 'order_id 与 rating 必填');
  }
  if (rating < 1 || rating > 5) {
    throw new AppError(4000, '评分须为 1-5 星');
  }

  const store = getStore();
  const order = await store.findOrderById(order_id);
  if (!order) throw new AppError(4004, '订单不存在');
  if (order.status !== 'completed') {
    throw new AppError(5001, '仅已完成订单可评价');
  }
  if (order.publisher_id !== user.id && order.acceptor_id !== user.id) {
    throw new AppError(4003, '无权评价此订单');
  }
  if (!isWithinEvaluationWindow(order)) {
    throw new AppError(5001, '已超过 24 小时评价时限');
  }

  const existing = await store.findEvaluationByOrderAndEvaluator(order_id, user.id);
  if (existing) {
    throw new AppError(4009, '您已评价过该订单');
  }

  const evaluateeId = user.id === order.publisher_id ? order.acceptor_id : order.publisher_id;

  const ev = await store.createEvaluation({
    order_id,
    evaluator_id: user.id,
    evaluatee_id: evaluateeId,
    rating,
    comment: comment || '',
    is_anonymous: Boolean(is_anonymous),
    is_auto_default: false,
  });

  await messageService.notifyEvaluationReceived(evaluateeId, ev.id);
  await applyCreditAfterBothRated(order_id);

  const evaluator = await store.findUserById(user.id);
  const evaluatee = await store.findUserById(evaluateeId);
  return enrichEvaluation(ev, evaluator, evaluatee);
}

/** 超时未评自动 5 星（由查询订单或专用接口触发） */
async function applyDefaultEvaluations(orderId) {
  const store = getStore();
  const order = await store.findOrderById(orderId);
  if (!order || order.status !== 'completed' || !order.completed_at) return [];

  if (isWithinEvaluationWindow(order)) return [];

  const created = [];
  const parties = [
    { evaluator_id: order.publisher_id, evaluatee_id: order.acceptor_id },
    { evaluator_id: order.acceptor_id, evaluatee_id: order.publisher_id },
  ];

  for (const p of parties) {
    const exists = await store.findEvaluationByOrderAndEvaluator(orderId, p.evaluator_id);
    if (exists) continue;
    const ev = await store.createEvaluation({
      order_id: orderId,
      evaluator_id: p.evaluator_id,
      evaluatee_id: p.evaluatee_id,
      rating: 5,
      comment: '系统默认好评（超时未评）',
      is_anonymous: false,
      is_auto_default: true,
    });
    created.push(ev);
    await messageService.notifyEvaluationReceived(p.evaluatee_id, ev.id);
  }

  if (created.length) await applyCreditAfterBothRated(orderId);
  return created;
}

async function listByOrder(user, orderId) {
  const store = getStore();
  const order = await store.findOrderById(orderId);
  if (!order) throw new AppError(4004, '订单不存在');
  if (order.publisher_id !== user.id && order.acceptor_id !== user.id) {
    throw new AppError(4003, '无权查看');
  }
  await applyDefaultEvaluations(orderId);
  const evaluations = await store.listEvaluationsByOrder(orderId);
  const list = await Promise.all(
    evaluations.map(async (ev) =>
      enrichEvaluation(
        ev,
        await store.findUserById(ev.evaluator_id),
        await store.findUserById(ev.evaluatee_id),
      ),
    ),
  );
  return { list, summary: await getOrderEvaluationSummary(order, user.id) };
}

async function listByUser(targetUserId, viewer, query) {
  const store = getStore();
  const target = await store.findUserById(targetUserId);
  if (!target) throw new AppError(4004, '用户不存在');
  if (target.hide_reviews && viewer?.id !== targetUserId) {
    return { list: [], total: 0, hidden: true };
  }

  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(query.limit) || 10));
  const { items, total } = await store.listEvaluationsByEvaluatee(targetUserId, { page, limit });
  const list = await Promise.all(
    items.map(async (ev) =>
      enrichEvaluation(
        ev,
        await store.findUserById(ev.evaluator_id),
        await store.findUserById(ev.evaluatee_id),
      ),
    ),
  );
  return { list, total, page, limit };
}

async function appealEvaluation(user, evaluationId, body) {
  const store = getStore();
  const ev = await store.findEvaluationById(evaluationId);
  if (!ev) throw new AppError(4004, '评价不存在');
  if (ev.evaluatee_id !== user.id) throw new AppError(4003, '仅被评价者可申诉');
  if (ev.appeal_status !== 'none') {
    throw new AppError(5001, '该评价已申诉');
  }
  if (!body.reason) throw new AppError(4000, '申诉理由必填');

  await store.updateEvaluation(evaluationId, {
    appeal_status: 'pending',
    appeal_reason: body.reason,
  });
  await messageService.sendSystemNotification(
    user.id,
    '【评价申诉】您的申诉已提交，管理员将尽快处理',
    'evaluation',
    evaluationId,
  );
  return { appeal_status: 'pending', message: '申诉已提交' };
}

async function resolveAppeal(adminUser, evaluationId, body) {
  const store = getStore();
  const ev = await store.findEvaluationById(evaluationId);
  if (!ev) throw new AppError(4004, '评价不存在');
  if (ev.appeal_status !== 'pending') {
    throw new AppError(5001, '申诉状态不允许处理');
  }

  const approved = Boolean(body.approved);
  await store.updateEvaluation(evaluationId, {
    appeal_status: approved ? 'approved' : 'rejected',
  });

  if (approved) {
    await creditService.onAppealApproved(ev.evaluator_id, evaluationId);
  }

  await messageService.sendSystemNotification(
    ev.evaluatee_id,
    approved ? '【申诉通过】恶意评价申诉已通过，已调整信用分' : '【申诉驳回】评价申诉未通过',
    'evaluation',
    evaluationId,
  );

  return { appeal_status: approved ? 'approved' : 'rejected' };
}

module.exports = {
  submitEvaluation,
  listByOrder,
  listByUser,
  appealEvaluation,
  resolveAppeal,
  getOrderEvaluationSummary,
  applyDefaultEvaluations,
};
