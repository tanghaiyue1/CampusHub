/**
 * @file backend/tests/unit/userService.test.js
 * @description 用户服务单元测试：认证校验、资料、信用等级
 */

process.env.NODE_ENV = 'test';
process.env.USE_MEMORY_DB = '1';

const { AppError } = require('../../src/lib/errors');
const { resetStore, getStore } = require('../../src/db');
const userService = require('../../src/services/userService');

beforeEach(async () => {
  await resetStore();
});

async function createUser(overrides = {}) {
  const store = getStore();
  const user = await store.createUser({
    student_id: `2021888${Math.floor(Math.random() * 9000 + 1000)}`,
    password_hash: 'hash',
    phone: overrides.phone || null,
  });
  const patch = { ...overrides };
  delete patch.phone;
  if (Object.keys(patch).length > 0) {
    await store.updateUser(user.id, patch);
  }
  return store.findUserById(user.id);
}

describe('userService.assertVerified', () => {
  it('未认证用户抛出 40032', () => {
    expect(() => userService.assertVerified({ is_verified: false })).toThrow(AppError);
    expect(() => userService.assertVerified({ is_verified: false })).toThrow(/认证/);
  });

  it('已认证用户不抛错', () => {
    expect(() => userService.assertVerified({ is_verified: true })).not.toThrow();
  });
});

describe('userService.getProfile', () => {
  it('用户不存在抛出 4004', async () => {
    await expect(userService.getProfile(99999)).rejects.toMatchObject({ code: 4004 });
  });

  it('返回脱敏后的公开用户信息', async () => {
    const user = await createUser({ nickname: '测试用户', phone: '13812345678', hide_phone: false });
    const profile = await userService.getProfile(user.id);
    expect(profile.nickname).toBe('测试用户');
    expect(profile.phone).toBe('138****5678');
  });
});

describe('userService.updateProfile', () => {
  it('仅更新允许的字段', async () => {
    const user = await createUser({ nickname: '旧名' });
    const updated = await userService.updateProfile(user.id, {
      nickname: '新名',
      hide_phone: true,
      student_id: 'hack',
    });
    expect(updated.nickname).toBe('新名');
    expect(updated.hide_phone).toBe(true);
    const raw = await getStore().findUserById(user.id);
    expect(raw.student_id).not.toBe('hack');
  });
});

describe('userService.submitVerification', () => {
  it('缺少学生证图片抛出 4000', async () => {
    const user = await createUser();
    await expect(userService.submitVerification(user.id, {})).rejects.toMatchObject({
      code: 4000,
    });
  });

  it('提交后状态为 pending', async () => {
    const user = await createUser();
    const result = await userService.submitVerification(user.id, {
      student_card_url: 'https://example.com/card.jpg',
    });
    expect(result.verification_status).toBe('pending');
  });
});

describe('userService.approveVerification', () => {
  it('通过后 is_verified 为 true', async () => {
    const user = await createUser();
    const result = await userService.approveVerification(user.id);
    expect(result.verification_status).toBe('approved');
    expect((await getStore().findUserById(user.id)).is_verified).toBe(true);
  });
});

describe('userService.getCredit', () => {
  it('按分数返回信用等级', async () => {
    const cases = [
      { score: 95, level: '优秀' },
      { score: 80, level: '良好' },
      { score: 65, level: '一般' },
      { score: 50, level: '受限' },
    ];
    for (const { score, level } of cases) {
      const user = await createUser({ credit_score: score });
      const credit = await userService.getCredit(user.id);
      expect(credit.credit_score).toBe(score);
      expect(credit.level).toBe(level);
    }
  });
});
