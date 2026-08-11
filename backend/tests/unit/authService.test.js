/**
 * @file backend/tests/unit/authService.test.js
 * @description 认证服务单元测试：注册校验、登录锁定、密码重置
 */

process.env.NODE_ENV = 'test';
process.env.USE_MEMORY_DB = '1';

const bcrypt = require('bcryptjs');
const { resetStore, getStore } = require('../../src/db');
const authService = require('../../src/services/authService');

beforeEach(async () => {
  await resetStore();
});

describe('authService.register', () => {
  it('密码少于 6 位抛出 4000', async () => {
    await expect(authService.register({ student_id: '2021001001', password: '12345' })).rejects.toMatchObject({
      code: 4000,
    });
  });

  it('缺少学号抛出 4000', async () => {
    await expect(authService.register({ password: 'password1' })).rejects.toMatchObject({
      code: 4000,
    });
  });

  it('重复学号抛出 4009', async () => {
    await authService.register({ student_id: '2021001002', password: 'password1' });
    await expect(
      authService.register({ student_id: '2021001002', password: 'password2' }),
    ).rejects.toMatchObject({ code: 4009 });
  });

  it('邮箱注册缺少邮箱抛出 4000', async () => {
    await expect(
      authService.register({
        register_type: 'email',
        student_id: '2021001003',
        password: 'password1',
      }),
    ).rejects.toMatchObject({ code: 4000 });
  });

  it('邮箱注册成功返回 token', async () => {
    const result = await authService.register({
      register_type: 'email',
      student_id: '2021001004',
      email: 'test@campus.edu',
      password: 'password1',
    });
    expect(result.token).toBeTruthy();
    expect(result.user.email).toBeUndefined();
  });

  it('默认昵称取学号后四位', async () => {
    const result = await authService.register({
      student_id: '2021001005',
      password: 'password1',
    });
    expect(result.user.nickname).toBe('用户1005');
  });
});

describe('authService.login', () => {
  it('缺少凭证抛出 4000', async () => {
    await expect(authService.login({ identifier: '2021002001' })).rejects.toMatchObject({
      code: 4000,
    });
  });

  it('用户不存在抛出 4001', async () => {
    await expect(
      authService.login({
        login_type: 'password',
        identifier: '9999999999',
        credential: 'password1',
      }),
    ).rejects.toMatchObject({ code: 4001 });
  });

  it('密码正确返回 token 并清零失败次数', async () => {
    await authService.register({ student_id: '2021002002', password: 'password1' });
    const store = getStore();
    const user = await store.findUserByStudentId('2021002002');
    await store.updateUser(user.id, { failed_login_count: 2 });

    const result = await authService.login({
      login_type: 'password',
      identifier: '2021002002',
      credential: 'password1',
    });
    expect(result.token).toBeTruthy();
    expect(result.need_verification).toBe(true);
    const updated = await store.findUserById(user.id);
    expect(updated.failed_login_count).toBe(0);
  });

  it('账号锁定时拒绝登录', async () => {
    await authService.register({ student_id: '2021002003', password: 'password1' });
    const store = getStore();
    const user = await store.findUserByStudentId('2021002003');
    const future = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    await store.updateUser(user.id, { locked_until: future });

    await expect(
      authService.login({
        login_type: 'password',
        identifier: '2021002003',
        credential: 'password1',
      }),
    ).rejects.toMatchObject({ code: 4003 });
  });

  it('campus_auth 登录方式', async () => {
    await authService.register({ student_id: '2021002004', password: 'password1' });
    const result = await authService.login({
      login_type: 'campus_auth',
      identifier: '2021002004',
      credential: 'campus-pass',
    });
    expect(result.token).toBeTruthy();
  });
});

describe('authService.resetPassword', () => {
  it('参数无效抛出 4000', async () => {
    await expect(authService.resetPassword({ student_id: '2021003001' })).rejects.toMatchObject({
      code: 4000,
    });
  });

  it('用户不存在抛出 4004', async () => {
    await expect(
      authService.resetPassword({ student_id: '9999999999', new_password: 'newpass1' }),
    ).rejects.toMatchObject({ code: 4004 });
  });

  it('重置后可用新密码登录', async () => {
    await authService.register({ student_id: '2021003002', password: 'oldpass1' });
    await authService.resetPassword({ student_id: '2021003002', new_password: 'newpass1' });
    const store = getStore();
    const user = await store.findUserByStudentId('2021003002');
    expect(await bcrypt.compare('newpass1', user.password_hash)).toBe(true);
    expect(user.failed_login_count).toBe(0);
  });
});
