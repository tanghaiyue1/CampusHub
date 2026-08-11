/**
 * @file backend/src/services/userService.js
 * @description 用户业务：资料更新、实名认证
 */

const { AppError } = require('../lib/errors');
const { getStore } = require('../db');
const { toPublicUser } = require('../utils/userPresenter');

async function getProfile(userId) {
  const store = getStore();
  const user = await store.findUserById(userId);
  if (!user) throw new AppError(4004, '用户不存在');
  return toPublicUser(user);
}

async function updateProfile(userId, body) {
  const store = getStore();
  const allowed = [
    'nickname',
    'phone',
    'avatar_url',
    'hide_phone',
    'hide_wechat',
    'hide_orders',
    'hide_reviews',
  ];
  const patch = {};
  for (const key of allowed) {
    if (body[key] !== undefined) patch[key] = body[key];
  }
  const user = await store.updateUser(userId, patch);
  return toPublicUser(user);
}

async function submitVerification(userId, body) {
  const store = getStore();
  const user = await store.findUserById(userId);
  if (!user) throw new AppError(4004, '用户不存在');
  if (!body.student_card_url) {
    throw new AppError(4000, '请上传学生证图片');
  }
  await store.updateUser(userId, {
    verification_status: 'pending',
    student_card_url: body.student_card_url,
  });
  return { verification_status: 'pending', message: '已提交，等待管理员审核' };
}

async function approveVerification(userId) {
  const store = getStore();
  const user = await store.findUserById(userId);
  if (!user) throw new AppError(4004, '用户不存在');
  await store.updateUser(userId, {
    verification_status: 'approved',
    is_verified: true,
  });
  return { verification_status: 'approved', message: '认证已通过' };
}

function assertVerified(user) {
  if (!user.is_verified) {
    throw new AppError(40032, '未完成校园学生身份认证');
  }
}

async function getCredit(userId) {
  const store = getStore();
  const user = await store.findUserById(userId);
  if (!user) throw new AppError(4004, '用户不存在');
  return {
    user_id: user.id,
    credit_score: user.credit_score,
    level: creditLevel(user.credit_score),
  };
}

function creditLevel(score) {
  if (score >= 90) return '优秀';
  if (score >= 75) return '良好';
  if (score >= 60) return '一般';
  return '受限';
}

module.exports = {
  getProfile,
  updateProfile,
  submitVerification,
  approveVerification,
  getCredit,
  assertVerified,
};
