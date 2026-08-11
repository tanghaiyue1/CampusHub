/**
 * @file backend/src/services/messageService.js
 * @description 消息业务：订单事件触发系统通知
 */

const { AppError } = require('../lib/errors');
const { render } = require('../lib/messageTemplates');
const { getStore } = require('../db');
const { toPublicUser } = require('../utils/userPresenter');

async function sendSystemNotification(receiverId, content, relatedType, relatedId, senderId = null) {
  const store = getStore();
  const systemUserId = senderId || (await getSystemSenderId());
  return store.createMessage({
    sender_id: systemUserId,
    receiver_id: receiverId,
    content,
    message_type: 'system',
    related_type: relatedType,
    related_id: relatedId,
    is_read: false,
  });
}

async function getSystemSenderId() {
  const store = getStore();
  let sys = await store.findUserByStudentId('system');
  if (!sys) {
    const bcrypt = require('bcryptjs');
    sys = await store.createUser({
      student_id: 'system',
      nickname: '系统通知',
      password_hash: await bcrypt.hash('system-internal', 10),
      is_verified: true,
    });
    await store.updateUser(sys.id, {
      verification_status: 'approved',
      is_verified: true,
    });
  }
  return sys.id;
}

async function notifyOrderApplied(order, requirement, acceptor) {
  await sendSystemNotification(
    order.publisher_id,
    render('order_applied', requirement.title, acceptor.nickname),
    'order',
    order.id,
  );
}

async function notifyOrderConfirmed(order, requirement, acceptor) {
  await sendSystemNotification(
    acceptor.id,
    render('order_confirmed', requirement.title),
    'order',
    order.id,
  );
}

async function notifyOrderRejected(order, requirement, acceptor) {
  await sendSystemNotification(
    acceptor.id,
    render('order_rejected', requirement.title),
    'order',
    order.id,
  );
}

async function notifyOrderInProgress(order, userIds) {
  const content = render('order_in_progress', order.order_no);
  for (const uid of userIds) {
    await sendSystemNotification(uid, content, 'order', order.id);
  }
}

async function notifyOrderCompleted(order, userIds) {
  const content = render('order_completed', order.order_no);
  for (const uid of userIds) {
    await sendSystemNotification(uid, content, 'order', order.id);
  }
}

async function notifyOrderCancelled(order, userIds) {
  const content = render('order_cancelled', order.order_no);
  for (const uid of userIds) {
    await sendSystemNotification(uid, content, 'order', order.id);
  }
}

async function notifyOrderReady(order, requirement) {
  await sendSystemNotification(
    order.publisher_id,
    render('order_ready', requirement.title),
    'order',
    order.id,
  );
}

async function notifyEvaluationReceived(evaluateeId, evaluationId) {
  const store = getStore();
  const ev = await store.findEvaluationById(evaluationId);
  if (!ev) return;
  await sendSystemNotification(
    evaluateeId,
    render('evaluation_received', ev.rating),
    'order',
    ev.order_id,
  );
}

async function listMessages(userId, query) {
  const store = getStore();
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(query.limit) || 20));
  const { items, total } = await store.listMessages(userId, {
    page,
    limit,
    is_read: query.is_read === 'true' ? true : query.is_read === 'false' ? false : undefined,
  });
  const list = await Promise.all(
    items.map(async (m) => {
      const sender = await store.findUserById(m.sender_id);
      return {
        id: m.id,
        content: m.content,
        message_type: m.message_type,
        related_type: m.related_type,
        related_id: m.related_id,
        is_read: m.is_read,
        created_at: m.created_at,
        sender: sender?.student_id === 'system' ? { nickname: '系统通知' } : toPublicUser(sender),
      };
    }),
  );
  return { list, total, page, limit };
}

async function markRead(userId, messageId) {
  const store = getStore();
  const msg = await store.findMessageById(messageId);
  if (!msg) throw new AppError(4004, '消息不存在');
  if (msg.receiver_id !== userId) throw new AppError(4003, '无权操作此消息');
  await store.updateMessage(messageId, { is_read: true });
  return { id: messageId, is_read: true };
}

async function markAllRead(userId) {
  const store = getStore();
  const count = await store.markAllMessagesRead(userId);
  return { marked_count: count };
}

async function unreadCount(userId) {
  const store = getStore();
  const count = await store.countUnreadMessages(userId);
  return { unread_count: count };
}

module.exports = {
  sendSystemNotification,
  notifyOrderApplied,
  notifyOrderConfirmed,
  notifyOrderRejected,
  notifyOrderInProgress,
  notifyOrderCompleted,
  notifyOrderCancelled,
  notifyOrderReady,
  notifyEvaluationReceived,
  listMessages,
  markRead,
  markAllRead,
  unreadCount,
};
