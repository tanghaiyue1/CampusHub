/**
 * @file backend/tests/unit/creditService.test.js
 * @description 信用分服务单元测试：等级、评分换算、上下限
 */

process.env.NODE_ENV = 'test';
process.env.USE_MEMORY_DB = '1';

const { resetStore, getStore } = require('../../src/db');
const creditService = require('../../src/services/creditService');

beforeEach(async () => {
  await resetStore();
});

describe('creditService 纯函数', () => {
  it('getLevel 按分数区间返回等级', () => {
    expect(creditService.getLevel(0)).toBe('差');
    expect(creditService.getLevel(59)).toBe('差');
    expect(creditService.getLevel(60)).toBe('一般');
    expect(creditService.getLevel(79)).toBe('一般');
    expect(creditService.getLevel(80)).toBe('良好');
    expect(creditService.getLevel(99)).toBe('良好');
    expect(creditService.getLevel(100)).toBe('优秀');
    expect(creditService.getLevel(119)).toBe('优秀');
    expect(creditService.getLevel(120)).toBe('卓越');
    expect(creditService.getLevel(150)).toBe('卓越');
  });

  it('pointsForRating 仅 4/5 星加分', () => {
    expect(creditService.pointsForRating(5)).toBe(3);
    expect(creditService.pointsForRating(4)).toBe(1);
    expect(creditService.pointsForRating(3)).toBe(0);
    expect(creditService.pointsForRating(1)).toBe(0);
  });
});

describe('creditService 分数变动', () => {
  async function createUser(score = 100) {
    const store = getStore();
    const user = await store.createUser({
      student_id: `2021999${Math.floor(Math.random() * 9000 + 1000)}`,
      password_hash: 'hash',
    });
    if (score !== 100) {
      await store.updateUser(user.id, { credit_score: score });
    }
    return store.findUserById(user.id);
  }

  it('applyChange 在用户不存在时返回 null', async () => {
    const result = await creditService.applyChange(99999, 5, '测试', 'order', 1);
    expect(result).toBeNull();
  });

  it('applyChange 不超过 MAX_SCORE', async () => {
    const user = await createUser(148);
    const result = await creditService.applyChange(user.id, 5, '加分', 'order', 1);
    expect(result.credit_score).toBe(creditService.MAX_SCORE);
    expect(result.level).toBe('卓越');
  });

  it('applyChange 不低于 MIN_SCORE', async () => {
    const user = await createUser(3);
    const result = await creditService.applyChange(user.id, -10, '扣分', 'order', 1);
    expect(result.credit_score).toBe(creditService.MIN_SCORE);
  });

  it('onOrderCompleted 双方各加 2 分', async () => {
    const pub = await createUser(100);
    const acc = await createUser(100);
    await creditService.onOrderCompleted(1, pub.id, acc.id);
    const store = getStore();
    expect((await store.findUserById(pub.id)).credit_score).toBe(102);
    expect((await store.findUserById(acc.id)).credit_score).toBe(102);
  });

  it('onRatingReceived 5 星加 3 分', async () => {
    const user = await createUser(100);
    await creditService.onRatingReceived(user.id, 5, 10);
    expect((await getStore().findUserById(user.id)).credit_score).toBe(103);
  });

  it('onRatingReceived 低分不加分', async () => {
    const user = await createUser(100);
    await creditService.onRatingReceived(user.id, 2, 10);
    expect((await getStore().findUserById(user.id)).credit_score).toBe(100);
  });

  it('onOrderCancelledByUser 扣 5 分', async () => {
    const user = await createUser(100);
    await creditService.onOrderCancelledByUser(user.id, 5);
    expect((await getStore().findUserById(user.id)).credit_score).toBe(95);
  });

  it('onAppealApproved 评价者扣 5 分', async () => {
    const user = await createUser(100);
    await creditService.onAppealApproved(user.id, 8);
    expect((await getStore().findUserById(user.id)).credit_score).toBe(95);
  });

  it('getHistory 支持分页参数', async () => {
    const user = await createUser(100);
    await creditService.applyChange(user.id, 1, '测试', 'order', 1);
    const history = await creditService.getHistory(user.id, { page: 1, limit: 10 });
    expect(history.items.length).toBeGreaterThan(0);
    expect(history.page).toBe(1);
  });
});
