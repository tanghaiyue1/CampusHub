/**
 * @file backend/src/services/requirementService.js
 * @description 需求业务：CRUD、筛选、申请列表
 */

const { AppError } = require('../lib/errors');
const { REQUIREMENT_CATEGORIES } = require('../lib/constants');
const config = require('../config');
const { getStore } = require('../db');
const { toPublicUser } = require('../utils/userPresenter');
const { assertVerified } = require('./userService');
const paymentService = require('./paymentService');

async function enrichRequirement(req, publisher) {
  const store = getStore();
  const pub = publisher || (await store.findUserById(req.publisher_id));
  const hidePublisher = req.is_anonymous;
  const pendingCount = (await store.listApplicationsByRequirement(req.id)).length;
  return {
    id: req.id,
    title: req.title,
    description: req.description,
    category: req.category,
    reward_type: req.reward_type,
    reward_amount: req.reward_amount,
    is_anonymous: req.is_anonymous,
    location: req.location,
    image_url: req.image_url,
    status: req.status,
    escrow_status: req.escrow_status || 'none',
    deadline: req.deadline,
    created_at: req.created_at,
    pending_application_count: pendingCount,
    pending_applications: pendingCount,
    publisher: hidePublisher ? toPublicUser(pub, { hideIdentity: true }) : toPublicUser(pub),
  };
}

async function createRequirement(user, body) {
  assertVerified(user);
  if (user.credit_score < config.minCreditToPublish) {
    throw new AppError(40031, '信用分不足，无法发布需求');
  }
  const { title, category, reward_type, reward_amount, is_anonymous, deadline } = body;
  if (!title || !category || !reward_type || deadline === undefined) {
    throw new AppError(4000, '标题、类型、报酬形式、截止时间为必填');
  }
  if (!REQUIREMENT_CATEGORIES.includes(category)) {
    throw new AppError(4000, '无效的需求类型');
  }
  if (reward_type !== 'free' && (reward_amount === undefined || reward_amount <= 0)) {
    throw new AppError(4000, '现金或积分报酬须大于 0');
  }

  const store = getStore();
  const req = await store.createRequirement({
    publisher_id: user.id,
    title,
    description: body.description,
    category,
    reward_type,
    reward_amount: reward_type === 'free' ? null : reward_amount,
    is_anonymous: Boolean(is_anonymous),
    location: body.location,
    image_url: body.image_url,
    deadline,
  });

  await paymentService.escrowOnPublish(req);
  const refreshed = await store.findRequirementById(req.id);
  return { requirement_id: refreshed.id, ...(await enrichRequirement(refreshed)) };
}

async function listRequirements(query) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(query.limit) || 10));
  const store = getStore();
  const { items, total } = await store.listRequirements({
    category: query.category,
    reward_type: query.reward_type,
    status: query.status || 'pending',
    keyword: query.keyword,
    location: query.location,
    sort_by: query.sort_by,
    sort_order: query.sort_order,
    page,
    limit,
  });
  const list = await Promise.all(items.map((r) => enrichRequirement(r)));
  return { list, total, page, limit };
}

async function listMyRequirements(user, query) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(query.limit) || 20));
  const store = getStore();
  const { items, total } = await store.listRequirements({
    publisher_id: user.id,
    status: query.status || undefined,
    page,
    limit,
    sort_by: query.sort_by || 'created_at',
    sort_order: query.sort_order || 'desc',
  });
  const { items: pubOrders } = await store.listOrders({
    user_id: user.id,
    role: 'publisher',
    page: 1,
    limit: 500,
  });
  const pendingByReq = {};
  for (const o of pubOrders) {
    if (o.status === 'pending_confirm') {
      pendingByReq[o.requirement_id] = (pendingByReq[o.requirement_id] || 0) + 1;
    }
  }

  const list = await Promise.all(
    items.map(async (r) => {
      const data = await enrichRequirement(r);
      const pending = pendingByReq[r.id] ?? data.pending_application_count;
      data.pending_applications = pending;
      return data;
    }),
  );
  return { list, total, page, limit };
}

async function getRequirement(id, viewer) {
  const store = getStore();
  const req = await store.findRequirementById(id);
  if (!req) throw new AppError(4004, '需求不存在');
  const data = await enrichRequirement(req);
  if (viewer && req.publisher_id === viewer.id) {
    const accepted = await store.findAcceptedOrderByRequirement(id);
    data.can_edit = req.status === 'pending' && !accepted;
    data.can_cancel = ['pending', 'accepted'].includes(req.status);
  }
  return data;
}

async function listApplications(user, requirementId) {
  const store = getStore();
  const req = await store.findRequirementById(requirementId);
  if (!req) throw new AppError(4004, '需求不存在');
  if (req.publisher_id !== user.id) throw new AppError(4003, '仅发布者可查看申请列表');

  const applications = await store.listApplicationsByRequirement(requirementId);
  const list = await Promise.all(
    applications.map(async (o) => {
      const acceptor = await store.findUserById(o.acceptor_id);
      return {
        order_id: o.id,
        order_no: o.order_no,
        status: o.status,
        created_at: o.created_at,
        acceptor: toPublicUser(acceptor),
      };
    }),
  );
  return { list, total: list.length };
}

async function updateRequirement(user, id, body) {
  const store = getStore();
  const req = await store.findRequirementById(id);
  if (!req) throw new AppError(4004, '需求不存在');
  if (req.publisher_id !== user.id) throw new AppError(4003, '无权编辑此需求');
  if (req.status !== 'pending') {
    throw new AppError(5001, '仅待接单状态可编辑');
  }
  const accepted = await store.findAcceptedOrderByRequirement(id);
  if (accepted) {
    throw new AppError(5001, '已有确认接单，不可修改核心信息');
  }
  const pending = await store.listApplicationsByRequirement(id);
  if (pending.length > 0) {
    throw new AppError(5001, '已有接单申请，不可修改核心信息');
  }
  const patch = {};
  ['title', 'description', 'category', 'reward_type', 'reward_amount', 'location', 'image_url', 'deadline', 'is_anonymous'].forEach(
    (k) => {
      if (body[k] !== undefined) patch[k] = body[k];
    },
  );
  const updated = await store.updateRequirement(id, patch);
  return enrichRequirement(updated);
}

async function cancelRequirement(user, id) {
  const store = getStore();
  const req = await store.findRequirementById(id);
  if (!req) throw new AppError(4004, '需求不存在');
  if (req.publisher_id !== user.id) throw new AppError(4003, '无权撤销');
  if (!['pending', 'accepted'].includes(req.status)) {
    throw new AppError(5001, '当前状态不可撤销');
  }

  const applications = await store.listApplicationsByRequirement(id, 'pending_confirm');
  for (const o of applications) {
    await store.updateOrder(o.id, { status: 'cancelled' });
    await store.addOrderLog(o.id, 'pending_confirm', 'cancelled', user.id, '需求撤销');
  }

  const accepted = await store.findAcceptedOrderByRequirement(id);
  if (accepted && !['completed', 'cancelled'].includes(accepted.status)) {
    await store.updateOrder(accepted.id, { status: 'cancelled' });
    await store.addOrderLog(accepted.id, accepted.status, 'cancelled', user.id, '发布者撤销需求');
    await paymentService.refundOrder(accepted, req);
  } else if (req.escrow_status === 'escrowed') {
    await paymentService.refundRequirement(req);
  }

  await store.updateRequirement(id, { status: 'cancelled' });
  return { message: '需求已撤销，托管款已按规则退回' };
}

module.exports = {
  createRequirement,
  listRequirements,
  listMyRequirements,
  getRequirement,
  listApplications,
  updateRequirement,
  cancelRequirement,
  enrichRequirement,
};
