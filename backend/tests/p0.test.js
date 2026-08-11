/**
 * @file backend/tests/p0.test.js
 * @description P0 功能集成测试：用户、需求、订单、支付状态
 */

const request = require('supertest');
const bcrypt = require('bcryptjs');

process.env.NODE_ENV = 'test';
process.env.USE_MEMORY_DB = '1';

const { resetStore, getStore } = require('../src/db');

let app;

beforeEach(async () => {
  await resetStore();
  vi.resetModules();
  app = require('../app');
});

async function registerAndVerify(client, studentId) {
  await client.post('/api/auth/register').send({
    student_id: studentId,
    password: 'password1',
    register_type: 'student_id',
    phone: '13812345678',
  });
  const store = getStore();
  const user = await store.findUserByStudentId(studentId);
  await store.updateUser(user.id, { is_verified: true, verification_status: 'approved' });
  const login = await client.post('/api/auth/login').send({
    login_type: 'password',
    identifier: studentId,
    credential: 'password1',
  });
  return login.body.data.token;
}

describe('P0 用户管理', () => {
  it('注册、登录、资料更新、信用分查询', async () => {
    const res = await request(app).post('/api/auth/register').send({
      student_id: '2021002001',
      password: 'secret12',
      register_type: 'student_id',
    });
    expect(res.status).toBe(200);
    expect(res.body.data.token).toBeTruthy();

    const store = getStore();
    const user = await store.findUserByStudentId('2021002001');
    expect(await bcrypt.compare('secret12', user.password_hash)).toBe(true);

    await store.updateUser(user.id, { is_verified: true, verification_status: 'approved' });

    const login = await request(app).post('/api/auth/login').send({
      login_type: 'password',
      identifier: '2021002001',
      credential: 'secret12',
    });
    const token = login.body.data.token;

    const credit = await request(app)
      .get(`/api/users/${user.id}/credit`)
      .set('Authorization', `Bearer ${token}`);
    expect(credit.body.data.credit_score).toBe(100);

    const profile = await request(app)
      .put('/api/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ nickname: '测试昵称', hide_phone: true });
    expect(profile.body.data.nickname).toBe('测试昵称');
  });

  it('密码错误 3 次后锁定', async () => {
    await request(app).post('/api/auth/register').send({
      student_id: '2021002002',
      password: 'password1',
    });
    for (let i = 0; i < 3; i++) {
      await request(app).post('/api/auth/login').send({
        login_type: 'password',
        identifier: '2021002002',
        credential: 'wrong',
      });
    }
    const locked = await request(app).post('/api/auth/login').send({
      login_type: 'password',
      identifier: '2021002002',
      credential: 'password1',
    });
    expect(locked.body.code).toBe(4003);
  });
});

describe('P0 需求与订单', () => {
  it('发布时托管、多人申请、发布者确认、完成全流程', async () => {
    const client = request(app);
    const pubToken = await registerAndVerify(client, '2021003001');
    const acc1Token = await registerAndVerify(client, '2021003002');
    const acc2Token = await registerAndVerify(client, '2021003003');

    const created = await client
      .post('/api/requirements')
      .set('Authorization', `Bearer ${pubToken}`)
      .send({
        title: '代取快递',
        category: 'express',
        reward_type: 'cash',
        reward_amount: 5,
        is_anonymous: false,
        deadline: '2026-12-31T23:59:59.000Z',
        description: '南园菜鸟',
      });
    expect(created.body.data.escrow_status).toBe('escrowed');
    const reqId = created.body.data.requirement_id;

    const mine = await client
      .get('/api/requirements/mine')
      .set('Authorization', `Bearer ${pubToken}`);
    expect(mine.body.data.list.some((r) => r.id === reqId)).toBe(true);

    const pubOrders = await client
      .get('/api/orders?role=publisher')
      .set('Authorization', `Bearer ${pubToken}`);
    expect(pubOrders.body.data.list.length).toBe(0);

    await client.post('/api/orders').set('Authorization', `Bearer ${acc1Token}`).send({ requirement_id: reqId });
    await client.post('/api/orders').set('Authorization', `Bearer ${acc2Token}`).send({ requirement_id: reqId });

    const apps = await client
      .get(`/api/requirements/${reqId}/applications`)
      .set('Authorization', `Bearer ${pubToken}`);
    expect(apps.body.data.list.length).toBe(2);

    const orderId = apps.body.data.list[0].order_id;
    const confirm = await client
      .post(`/api/orders/${orderId}/confirm`)
      .set('Authorization', `Bearer ${pubToken}`);
    expect(confirm.body.data.status).toBe('accepted');
    expect(confirm.body.data.payment_status).toBe('escrow');

    const appsAfter = await client
      .get(`/api/requirements/${reqId}/applications`)
      .set('Authorization', `Bearer ${pubToken}`);
    expect(appsAfter.body.data.list.length).toBe(0);

    await client.post(`/api/orders/${orderId}/confirm`).set('Authorization', `Bearer ${pubToken}`);
    await client
      .post(`/api/orders/${orderId}/start`)
      .set('Authorization', `Bearer ${acc1Token}`);
    await client
      .post(`/api/orders/${orderId}/ready`)
      .set('Authorization', `Bearer ${acc1Token}`);
    const done = await client
      .post(`/api/orders/${orderId}/complete`)
      .set('Authorization', `Bearer ${pubToken}`);
    expect(done.body.data.status).toBe('completed');
    expect(done.body.data.payment_status).toBe('released');
  });

  it('未认证用户不能发布需求', async () => {
    const client = request(app);
    const reg = await client.post('/api/auth/register').send({
      student_id: '2021004001',
      password: 'password1',
    });
    const token = reg.body.data.token;
    const res = await client
      .post('/api/requirements')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'test',
        category: 'express',
        reward_type: 'free',
        is_anonymous: false,
        deadline: '2026-12-31T23:59:59.000Z',
      });
    expect(res.body.code).toBe(40032);
  });

  it('POST /api/orders/:id/cancel 可取消订单', async () => {
    const client = request(app);
    const pubToken = await registerAndVerify(client, '2021005001');
    const accToken = await registerAndVerify(client, '2021005002');

    const created = await client
      .post('/api/requirements')
      .set('Authorization', `Bearer ${pubToken}`)
      .send({
        title: '测试取消',
        category: 'errand',
        reward_type: 'free',
        is_anonymous: false,
        deadline: '2026-12-31T23:59:59.000Z',
      });
    const reqId = created.body.data.requirement_id;
    const apply = await client
      .post('/api/orders')
      .set('Authorization', `Bearer ${accToken}`)
      .send({ requirement_id: reqId });
    const orderId = apply.body.data.order_id;

    const confirm = await client
      .post(`/api/orders/${orderId}/confirm`)
      .set('Authorization', `Bearer ${pubToken}`);

    const cancelled = await client
      .post(`/api/orders/${orderId}/cancel`)
      .set('Authorization', `Bearer ${pubToken}`);
    expect(cancelled.body.data.status).toBe('cancelled');
    expect(confirm.status).toBe(200);
  });
});
