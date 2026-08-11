/**
 * @file backend/src/services/creditService.js
 * @description 信用分业务：加减分规则与变动记录
 */

const { getStore } = require('../db');

const MIN_SCORE = 0;
const MAX_SCORE = 150;
const INITIAL_SCORE = 100;

function getLevel(score) {
  if (score < 60) return '差';
  if (score < 80) return '一般';
  if (score < 100) return '良好';
  if (score < 120) return '优秀';
  return '卓越';
}

function pointsForRating(rating) {
  if (rating === 5) return 3;
  if (rating === 4) return 1;
  return 0;
}

async function applyChange(userId, changeAmount, reason, relatedType, relatedId) {
  const store = getStore();
  const user = await store.findUserById(userId);
  if (!user) return null;

  const next = Math.min(MAX_SCORE, Math.max(MIN_SCORE, user.credit_score + changeAmount));
  await store.updateUser(userId, { credit_score: next });
  await store.createCreditRecord({
    user_id: userId,
    change_amount: changeAmount,
    current_score: next,
    reason,
    related_type: relatedType,
    related_id: relatedId,
  });
  return { credit_score: next, level: getLevel(next) };
}

async function onOrderCompleted(orderId, publisherId, acceptorId) {
  await applyChange(publisherId, 2, '完成订单', 'order', orderId);
  await applyChange(acceptorId, 2, '完成订单', 'order', orderId);
}

async function onRatingReceived(evaluateeId, rating, evaluationId) {
  const pts = pointsForRating(rating);
  if (pts > 0) {
    await applyChange(evaluateeId, pts, `获得${rating}星好评`, 'evaluation', evaluationId);
  }
}

async function onOrderCancelledByUser(userId, orderId) {
  await applyChange(userId, -5, '无故取消已接订单', 'order', orderId);
}

async function onAppealApproved(evaluatorId, evaluationId) {
  await applyChange(evaluatorId, -5, '恶意评价（申诉成立）', 'evaluation', evaluationId);
}

async function getHistory(userId, query = {}) {
  const store = getStore();
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(query.limit) || 20));
  return store.listCreditRecords(userId, { page, limit });
}

module.exports = {
  INITIAL_SCORE,
  MIN_SCORE,
  MAX_SCORE,
  getLevel,
  pointsForRating,
  applyChange,
  onOrderCompleted,
  onRatingReceived,
  onOrderCancelledByUser,
  onAppealApproved,
  getHistory,
};
