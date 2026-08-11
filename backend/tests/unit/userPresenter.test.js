/**
 * @file backend/tests/unit/userPresenter.test.js
 * @description 用户展示层单元测试：脱敏与匿名
 */

const { maskPhone, toPublicUser } = require('../../src/utils/userPresenter');

describe('maskPhone', () => {
  it('正常手机号中间四位脱敏', () => {
    expect(maskPhone('13812345678')).toBe('138****5678');
  });

  it('过短号码原样返回', () => {
    expect(maskPhone('12345')).toBe('12345');
    expect(maskPhone(null)).toBe(null);
  });
});

describe('toPublicUser', () => {
  const baseUser = {
    id: 1,
    student_id: '2021001001',
    nickname: '小明',
    avatar_url: null,
    credit_score: 100,
    is_verified: true,
    verification_status: 'approved',
    hide_phone: false,
    hide_wechat: false,
    hide_orders: false,
    hide_reviews: false,
    phone: '13812345678',
    created_at: '2026-01-01T00:00:00.000Z',
  };

  it('null 用户返回 null', () => {
    expect(toPublicUser(null)).toBeNull();
  });

  it('匿名模式隐藏身份信息', () => {
    const result = toPublicUser(baseUser, { hideIdentity: true });
    expect(result.nickname).toBe('匿名用户');
    expect(result.is_anonymous).toBe(true);
    expect(result.id).toBeNull();
  });

  it('hide_phone 时不输出 phone 字段', () => {
    const result = toPublicUser({ ...baseUser, hide_phone: true });
    expect(result.phone).toBeUndefined();
  });

  it('hide_orders 时不输出 student_id', () => {
    const result = toPublicUser({ ...baseUser, hide_orders: true });
    expect(result.student_id).toBeUndefined();
  });
});
