/**
 * @file backend/tests/p1.test.js
 * @description P1 功能集成测试：评价、信用、消息
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

async function setupCompletedOrder(client) {
  const pub = '2021100001';
  const acc = '2021100002';
  for (const sid of [pub, acc]) {
    await client.post('/api/auth/register').send({ student_id: sid, password: 'password1' });
    const store = getStore();
    const u = await store.findUserByStudentId(sid);
    await store.updateUser(u.id, { is_verified: true, verification_status: 'approved' });
  }
  const pubLogin = await client.post('/api/auth/login').send({
    login_type: 'password',
    identifier: pub,
    credential: 'password1',
  });
  const accLogin = await client.post('/api/auth/login').send({
    login_type: 'password',
    identifier: acc,
    credential: 'password1',
  });
  const pubToken = pubLogin.body.data.token;
  const accToken = accLogin.body.data.token;

  const req = await client
    .post('/api/requirements')
    .set('Authorization', `Bearer ${pubToken}`)
    .send({
      title: 'P1测试需求',
      category: 'express',
      reward_type: 'free',
      is_anonymous: false,
      deadline: '2026-12-31T23:59:59.000Z',
    });
  const reqId = req.body.data.requirement_id;
  const apply = await client
    .post('/api/orders')
    .set('Authorization', `Bearer ${accToken}`)
    .send({ requirement_id: reqId });
  const orderId = apply.body.data.order_id;
  await client.post(`/api/orders/${orderId}/confirm`).set('Authorization', `Bearer ${pubToken}`);
  await client
    .post(`/api/orders/${orderId}/start`)
    .set('Authorization', `Bearer ${accToken}`);
  await client
    .post(`/api/orders/${orderId}/ready`)
    .set('Authorization', `Bearer ${accToken}`);
  await client
    .post(`/api/orders/${orderId}/complete`)
    .set('Authorization', `Bearer ${pubToken}`);

  return { pubToken, accToken, orderId, pub, acc };
}

describe('P1 评价与信用', () => {
  it('双方互评后信用分变化', async () => {
    const client = request(app);
    const { pubToken, accToken, orderId } = await setupCompletedOrder(client);

    const store = getStore();
    const order = await store.findOrderById(orderId);
    const pubBefore = (await store.findUserById(order.publisher_id)).credit_score;

    await client
      .post('/api/evaluations')
      .set('Authorization', `Bearer ${pubToken}`)
      .send({ order_id: orderId, rating: 5, comment: '很好', is_anonymous: false });

    await client
      .post('/api/evaluations')
      .set('Authorization', `Bearer ${accToken}`)
      .send({ order_id: orderId, rating: 4, comment: '不错', is_anonymous: true });

    const pubAfter = (await store.findUserById(order.publisher_id)).credit_score;
    expect(pubAfter).toBeGreaterThan(pubBefore);

    const orderDetail = await client
      .get(`/api/orders/${orderId}`)
      .set('Authorization', `Bearer ${pubToken}`);
    expect(orderDetail.body.data.evaluation.all_evaluations.length).toBe(2);
    expect(orderDetail.body.data.evaluation.peer_evaluation.rating).toBe(4);

    const history = await client
      .get(`/api/users/${order.publisher_id}/credit/history`)
      .set('Authorization', `Bearer ${pubToken}`);
    expect(history.body.data.items.length).toBeGreaterThan(0);
  });

  it('评价申诉', async () => {
    const client = request(app);
    const { pubToken, accToken, orderId } = await setupCompletedOrder(client);

    await client
      .post('/api/evaluations')
      .set('Authorization', `Bearer ${accToken}`)
      .send({ order_id: orderId, rating: 1, comment: '差评', is_anonymous: false });

    const list = await client
      .get(`/api/evaluations/order/${orderId}`)
      .set('Authorization', `Bearer ${pubToken}`);
    const evId = list.body.data.list[0].id;

    const appeal = await client
      .post(`/api/evaluations/${evId}/appeal`)
      .set('Authorization', `Bearer ${pubToken}`)
      .send({ reason: '恶意差评' });
    expect(appeal.body.data.appeal_status).toBe('pending');
  });
});

describe('P1 消息通知', () => {
  it('接单与完成会生成系统消息', async () => {
    const client = request(app);
    const { pubToken, accToken } = await setupCompletedOrder(client);

    const unreadPub = await client
      .get('/api/messages/unread/count')
      .set('Authorization', `Bearer ${pubToken}`);
    expect(unreadPub.body.data.unread_count).toBeGreaterThan(0);

    const msgs = await client
      .get('/api/messages')
      .set('Authorization', `Bearer ${accToken}`);
    expect(msgs.body.data.list.length).toBeGreaterThan(0);

    const firstId = msgs.body.data.list[0].id;
    await client.put(`/api/messages/${firstId}/read`).set('Authorization', `Bearer ${accToken}`);
  });
});
