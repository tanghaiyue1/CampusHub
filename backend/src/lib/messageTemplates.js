/**
 * @file backend/src/lib/messageTemplates.js
 * @description 系统消息通知文案模板
 */

const TEMPLATES = {
  order_applied: (title, acceptorNickname) =>
    `【接单申请】${acceptorNickname} 申请承接您的需求「${title}」`,
  order_confirmed: (title) => `【接单成功】您的需求「${title}」已被发布者确认`,
  order_rejected: (title) => `【申请未通过】您对「${title}」的接单申请未被采纳`,
  order_in_progress: (orderNo) => `【开始履约】接单者已开始履约，订单 ${orderNo}`,
  order_ready: (title) => `【待验收】接单者已完成「${title}」，请确认验收`,
  order_completed: (orderNo) =>
    `【订单完成】订单 ${orderNo} 已完成，请在 24 小时内完成互评`,
  order_cancelled: (orderNo) => `【订单取消】订单 ${orderNo} 已取消`,
  evaluation_received: (rating) => `【收到评价】您收到 ${rating} 星评价，点击查看详情`,
  evaluation_appeal_pending: () => `【评价申诉】您的评价申诉已提交，等待处理`,
  evaluation_appeal_resolved: (approved) =>
    approved ? `【申诉通过】评价申诉已通过` : `【申诉驳回】评价申诉未通过`,
};

function render(key, ...args) {
  const fn = TEMPLATES[key];
  if (!fn) return `【系统通知】${key}`;
  return fn(...args);
}

module.exports = { render, TEMPLATES };
