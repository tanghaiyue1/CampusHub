/**
 * @file backend/tests/unit/paymentService.test.js
 * @description 支付服务单元测试：托管、结算、退款
 */

process.env.NODE_ENV = 'test';
process.env.USE_MEMORY_DB = '1';

const { resetStore, getStore } = require('../../src/db');
const paymentService = require('../../src/services/paymentService');

beforeEach(async () => {
  await resetStore();
});

async function seedRequirement(overrides = {}) {
  const store = getStore();
  const user = await store.createUser({
    student_id: '2021006001',
    password_hash: 'hash',
  });
  return store.createRequirement({
    publisher_id: user.id,
    title: '测试需求',
    category: 'express',
    reward_type: 'cash',
    reward_amount: 10,
    status: 'pending',
    escrow_status: 'none',
    ...overrides,
  });
}

async function seedOrder(requirement, acceptorId) {
  const store = getStore();
  return store.createOrder({
    requirement_id: requirement.id,
    publisher_id: requirement.publisher_id,
    acceptor_id: acceptorId,
    status: 'accepted',
    payment_status: 'pending',
  });
}

describe('paymentService.escrowOnPublish', () => {
  it('无偿需求无需托管', async () => {
    const req = await seedRequirement({ reward_type: 'free' });
    const result = await paymentService.escrowOnPublish(req);
    expect(result.escrow_status).toBe('none');
  });

  it('有偿需求托管成功', async () => {
    const req = await seedRequirement();
    const result = await paymentService.escrowOnPublish(req);
    expect(result.escrow_status).toBe('escrowed');
    expect(result.amount).toBe(10);
    const updated = await getStore().findRequirementById(req.id);
    expect(updated.escrow_status).toBe('escrowed');
  });
});

describe('paymentService.linkOrderEscrow', () => {
  it('无偿订单直接 released', async () => {
    const req = await seedRequirement({ reward_type: 'free' });
    const acc = await getStore().createUser({ student_id: '2021006002', password_hash: 'h' });
    const order = await seedOrder(req, acc.id);
    const result = await paymentService.linkOrderEscrow(order, req);
    expect(result.payment_status).toBe('released');
  });

  it('未托管的有偿需求抛出 5001', async () => {
    const req = await seedRequirement({ escrow_status: 'none' });
    const acc = await getStore().createUser({ student_id: '2021006003', password_hash: 'h' });
    const order = await seedOrder(req, acc.id);
    await expect(paymentService.linkOrderEscrow(order, req)).rejects.toMatchObject({
      code: 5001,
    });
  });
});

describe('paymentService.release', () => {
  it('完成有偿订单后结算', async () => {
    const req = await seedRequirement();
    await paymentService.escrowOnPublish(req);
    const updatedReq = await getStore().findRequirementById(req.id);
    const acc = await getStore().createUser({ student_id: '2021006004', password_hash: 'h' });
    const order = await seedOrder(updatedReq, acc.id);
    await getStore().updateOrder(order.id, { payment_status: 'escrow' });

    const result = await paymentService.release(
      await getStore().findOrderById(order.id),
      updatedReq,
    );
    expect(result.payment_status).toBe('released');
    expect(result.amount).toBe(10);
  });
});

describe('paymentService.refundRequirement', () => {
  it('未托管无需退款', async () => {
    const req = await seedRequirement({ escrow_status: 'none' });
    const result = await paymentService.refundRequirement(req);
    expect(result.message).toContain('无需退款');
  });

  it('已托管需求退款', async () => {
    const req = await seedRequirement();
    await paymentService.escrowOnPublish(req);
    const updated = await getStore().findRequirementById(req.id);
    const result = await paymentService.refundRequirement(updated);
    expect(result.escrow_status).toBe('refunded');
  });
});

describe('paymentService.getPaymentStatus', () => {
  it('非订单参与方无权查看', async () => {
    const req = await seedRequirement();
    const acc = await getStore().createUser({ student_id: '2021006005', password_hash: 'h' });
    const order = await seedOrder(req, acc.id);
    const outsider = { id: 99999 };
    await expect(paymentService.getPaymentStatus(order.id, outsider)).rejects.toMatchObject({
      code: 4003,
    });
  });

  it('发布者可查看支付记录', async () => {
    const req = await seedRequirement();
    await paymentService.escrowOnPublish(await getStore().findRequirementById(req.id));
    const acc = await getStore().createUser({ student_id: '2021006006', password_hash: 'h' });
    const order = await seedOrder(req, acc.id);
    const publisher = { id: req.publisher_id };
    const status = await paymentService.getPaymentStatus(order.id, publisher);
    expect(status.order_id).toBe(order.id);
    expect(status.payments.length).toBeGreaterThan(0);
  });
});
