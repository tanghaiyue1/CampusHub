/**
 * @file backend/tests/integration.test.js
 * @description 跨模块集成测试：订单、支付、评价、消息、数据库状态一致性
 */

const request = require('supertest');

process.env.NODE_ENV = 'test';
process.env.USE_MEMORY_DB = '1';

const { resetStore, getStore } = require('../src/db');

let app;

beforeEach(async () => {
  await resetStore();
  vi.resetModules();
  app = require('../app');
});

async function registerVerified(client, studentId) {
  await client.post('/api/auth/register').send({
    student_id: studentId,
    password: 'password1',
  });
  const store = getStore();
  const user = await store.findUserByStudentId(studentId);
  await store.updateUser(user.id, { is_verified: true, verification_status: 'approved' });
  const login = await client.post('/api/auth/login').send({
    login_type: 'password',
    identifier: studentId,
    credential: 'password1',
  });
  return { token: login.body.data.token, userId: user.id };
}

describe('跨模块集成', () => {
  it('发布→申请→确认→履约→验收→完成→互评，状态与消息一致', async () => {
    const client = request(app);
    const pub = await registerVerified(client, '2021200001');
    const acc = await registerVerified(client, '2021200002');

    const created = await client
      .post('/api/requirements')
      .set('Authorization', `Bearer ${pub.token}`)
      .send({
        title: '集成测试需求',
        category: 'express',
        reward_type: 'cash',
        reward_amount: 10,
        deadline: '2026-12-31T23:59:59.000Z',
      });
    expect(created.body.code).toBe(200);
    expect(created.body.data.escrow_status).toBe('escrowed');
    expect(created.body.data.pending_applications).toBe(0);
    const reqId = created.body.data.requirement_id;

    const apply = await client
      .post('/api/orders')
      .set('Authorization', `Bearer ${acc.token}`)
      .send({ requirement_id: reqId });
    expect(apply.body.data.status).toBe('pending_confirm');
    const orderId = apply.body.data.order_id;

    const pubMsgs1 = await client
      .get('/api/messages')
      .set('Authorization', `Bearer ${pub.token}`);
    expect(pubMsgs1.body.data.list.some((m) => m.related_type === 'order' && m.related_id === orderId)).toBe(
      true,
    );

    await client.post(`/api/orders/${orderId}/confirm`).set('Authorization', `Bearer ${pub.token}`);

    const store = getStore();
    let req = await store.findRequirementById(reqId);
    let order = await store.findOrderById(orderId);
    expect(req.status).toBe('accepted');
    expect(order.status).toBe('accepted');
    expect(order.payment_status).toBe('escrow');

    const detail = await client
      .get(`/api/orders/${orderId}`)
      .set('Authorization', `Bearer ${acc.token}`);
    expect(detail.body.data.actions.can_start).toBe(true);
    expect(detail.body.data.actions.can_complete).toBe(false);

    await client.post(`/api/orders/${orderId}/start`).set('Authorization', `Bearer ${acc.token}`);
    order = await store.findOrderById(orderId);
    req = await store.findRequirementById(reqId);
    expect(order.status).toBe('in_progress');
    expect(req.status).toBe('in_progress');

    await client.post(`/api/orders/${orderId}/ready`).set('Authorization', `Bearer ${acc.token}`);
    order = await store.findOrderById(orderId);
    expect(order.status).toBe('ready_for_acceptance');

    const pubMsgs2 = await client
      .get('/api/messages/unread/count')
      .set('Authorization', `Bearer ${pub.token}`);
    expect(pubMsgs2.body.data.unread_count).toBeGreaterThan(0);

    const pubCannotStart = await client
      .post(`/api/orders/${orderId}/start`)
      .set('Authorization', `Bearer ${pub.token}`);
    expect(pubCannotStart.body.code).toBe(4003);

    await client.post(`/api/orders/${orderId}/complete`).set('Authorization', `Bearer ${pub.token}`);
    order = await store.findOrderById(orderId);
    req = await store.findRequirementById(reqId);
    expect(order.status).toBe('completed');
    expect(req.status).toBe('completed');
    expect(order.payment_status).toBe('released');
    expect(req.escrow_status).toBe('released');

    await client
      .post('/api/evaluations')
      .set('Authorization', `Bearer ${pub.token}`)
      .send({ order_id: orderId, rating: 5, comment: '很好' });
    await client
      .post('/api/evaluations')
      .set('Authorization', `Bearer ${acc.token}`)
      .send({ order_id: orderId, rating: 4, comment: '不错' });

    const orderView = await client
      .get(`/api/orders/${orderId}`)
      .set('Authorization', `Bearer ${pub.token}`);
    expect(orderView.body.data.evaluation.all_evaluations.length).toBe(2);
    expect(orderView.body.data.evaluation.peer_evaluation.rating).toBe(4);
    expect(orderView.body.data.evaluation.peer_evaluation.comment).toBe('不错');

    const accMsgs = await client
      .get('/api/messages')
      .set('Authorization', `Bearer ${acc.token}`);
    const evalMsg = accMsgs.body.data.list.find((m) => m.content.includes('收到评价'));
    expect(evalMsg).toBeTruthy();
    expect(evalMsg.related_type).toBe('order');
    expect(evalMsg.related_id).toBe(orderId);

    await client.put('/api/messages/read-all').set('Authorization', `Bearer ${acc.token}`);
    const unread = await client
      .get('/api/messages/unread/count')
      .set('Authorization', `Bearer ${acc.token}`);
    expect(unread.body.data.unread_count).toBe(0);
  });

  it('未认证用户申请接单返回明确错误', async () => {
    const client = request(app);
    const pub = await registerVerified(client, '2021200010');
    const reg = await client.post('/api/auth/register').send({
      student_id: '2021200011',
      password: 'password1',
    });
    const unverifiedToken = reg.body.data.token;

    const created = await client
      .post('/api/requirements')
      .set('Authorization', `Bearer ${pub.token}`)
      .send({
        title: '测试',
        category: 'express',
        reward_type: 'free',
        deadline: '2026-12-31T23:59:59.000Z',
      });

    const res = await client
      .post('/api/orders')
      .set('Authorization', `Bearer ${unverifiedToken}`)
      .send({ requirement_id: created.body.data.requirement_id });
    expect(res.body.code).toBe(40032);
    expect(res.body.message).toContain('认证');
  });

  it('无效 Token 返回 401 且 message 明确', async () => {
    const client = request(app);
    const res = await client
      .get('/api/orders')
      .set('Authorization', 'Bearer invalid-token');
    expect(res.body.code).toBe(4001);
    expect(res.status).toBe(401);
  });
});
