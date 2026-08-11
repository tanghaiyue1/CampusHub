/**
 * @file frontend/src/utils/labels.js
 * @description 中文标签：分类、订单状态、报酬类型
 */

export const CATEGORY_LABELS = {
  express: '快递代取',
  tutoring: '学习辅导',
  secondhand: '二手交易',
  team: '组队活动',
  lost_found: '失物招领',
  errand: '跑腿代办',
  borrow: '物品借用',
  consulting: '咨询答疑',
}

export const ORDER_STATUS_LABELS = {
  pending_confirm: '待确认',
  accepted: '已确认',
  in_progress: '履约中',
  ready_for_acceptance: '待验收',
  completed: '已完成',
  cancelled: '已取消',
  rejected: '已拒绝',
}

export const REQUIREMENT_STATUS_LABELS = {
  pending: '招募中',
  accepted: '已确认接单',
  in_progress: '履约中',
  completed: '已完成',
  cancelled: '已撤销',
}

export const ESCROW_STATUS_LABELS = {
  none: '无需托管',
  escrowed: '已托管',
  released: '已结算',
  refunded: '已退款',
}

export const PAYMENT_STATUS_LABELS = {
  unpaid: '未支付',
  escrow: '托管中',
  released: '已结算',
  refunded: '已退款',
}

export const REWARD_LABELS = {
  cash: '现金',
  points: '积分',
  free: '无偿',
}

export function formatReward(item) {
  if (item.reward_type === 'free') return '无偿互助'
  const type = REWARD_LABELS[item.reward_type] || item.reward_type
  return item.reward_amount ? `${type} ¥${item.reward_amount}` : type
}

export function paymentLabel(status) {
  return PAYMENT_STATUS_LABELS[status] || status
}

export function requirementStatusLabel(status) {
  return REQUIREMENT_STATUS_LABELS[status] || status
}

export function escrowLabel(status) {
  return ESCROW_STATUS_LABELS[status] || status
}
