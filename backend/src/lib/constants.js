/**
 * @file backend/src/lib/constants.js
 * @description 业务常量：需求分类、订单状态、状态机转换
 */

const REQUIREMENT_CATEGORIES = [
  'express',
  'tutoring',
  'secondhand',
  'team',
  'lost_found',
  'errand',
  'borrow',
  'consulting',
];

const CATEGORY_LABELS = {
  express: '快递代取',
  tutoring: '学习辅导',
  secondhand: '二手交易',
  team: '组队活动',
  lost_found: '失物招领',
  errand: '跑腿代办',
  borrow: '物品借用',
  consulting: '咨询答疑',
};

const ORDER_TRANSITIONS = {
  pending_confirm: ['accepted', 'rejected', 'cancelled'],
  accepted: ['in_progress', 'cancelled'],
  in_progress: ['ready_for_acceptance', 'cancelled'],
  ready_for_acceptance: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
  rejected: [],
};

const ORDER_STATUS_LABELS = {
  pending_confirm: '待确认',
  accepted: '已确认',
  in_progress: '履约中',
  ready_for_acceptance: '待验收',
  completed: '已完成',
  cancelled: '已取消',
  rejected: '已拒绝',
};

const REQUIREMENT_TRANSITIONS = {
  pending: ['accepted', 'cancelled'],
  accepted: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

module.exports = {
  REQUIREMENT_CATEGORIES,
  CATEGORY_LABELS,
  ORDER_TRANSITIONS,
  ORDER_STATUS_LABELS,
  REQUIREMENT_TRANSITIONS,
};
