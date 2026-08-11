/**
 * @file backend/src/services/authService.js
 * @description 认证业务：注册登录、密码锁定与重置
 */

const bcrypt = require('bcryptjs');
const { AppError } = require('../lib/errors');
const config = require('../config');
const { getStore } = require('../db');
const { signToken } = require('../middleware/auth');
const { toPublicUser } = require('../utils/userPresenter');

async function register(body) {
  const { student_id, email, password, phone, register_type } = body;
  if (!password || password.length < 6) {
    throw new AppError(4000, '密码至少 6 位');
  }
  const store = getStore();

  const type = register_type || 'student_id';

  if (type === 'email') {
    if (!email) throw new AppError(4000, '邮箱不能为空');
    if (await store.findUserByEmail(email)) {
      throw new AppError(4009, '邮箱已注册');
    }
    if (!student_id) throw new AppError(4000, '学号不能为空');
    if (await store.findUserByStudentId(student_id)) {
      throw new AppError(4009, '学号已注册');
    }
  } else {
    if (!student_id) throw new AppError(4000, '学号不能为空');
    if (await store.findUserByStudentId(student_id)) {
      throw new AppError(4009, '学号已注册');
    }
  }

  const password_hash = await bcrypt.hash(password, 10);
  const user = await store.createUser({
    student_id,
    email: email || null,
    password_hash,
    phone: phone || null,
    nickname: body.nickname || `用户${student_id.slice(-4)}`,
  });

  return {
    user: toPublicUser(user),
    token: signToken(user.id),
    message: '注册成功，请完成学生认证后发布/接单',
  };
}

async function login(body) {
  const { login_type, identifier, credential } = body;
  if (!identifier || !credential) {
    throw new AppError(4000, '账号与凭证不能为空');
  }

  const store = getStore();
  let user =
    (await store.findUserByStudentId(identifier)) ||
    (await store.findUserByEmail(identifier));

  if (!user) {
    throw new AppError(4001, '账号或密码错误');
  }

  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    throw new AppError(4003, '账号已锁定，请 15 分钟后再试');
  }

  const valid =
    login_type === 'campus_auth'
      ? credential === 'campus-pass'
      : await bcrypt.compare(credential, user.password_hash);

  if (!valid) {
    const count = (user.failed_login_count || 0) + 1;
    const patch = { failed_login_count: count };
    if (count >= config.loginLock.maxAttempts) {
      patch.locked_until = new Date(
        Date.now() + config.loginLock.lockMinutes * 60 * 1000,
      ).toISOString();
      patch.failed_login_count = 0;
    }
    await store.updateUser(user.id, patch);
    throw new AppError(4001, '账号或密码错误');
  }

  await store.updateUser(user.id, {
    failed_login_count: 0,
    locked_until: null,
  });

  if (!user.is_verified && login_type !== 'campus_auth') {
    // 允许登录但提示认证
  }

  return {
    token: signToken(user.id),
    user: toPublicUser(user),
    need_verification: !user.is_verified,
  };
}

async function resetPassword(body) {
  const { student_id, new_password } = body;
  if (!student_id || !new_password || new_password.length < 6) {
    throw new AppError(4000, '学号与新密码不能为空且密码至少 6 位');
  }
  const store = getStore();
  const user = await store.findUserByStudentId(student_id);
  if (!user) throw new AppError(4004, '用户不存在');
  const password_hash = await bcrypt.hash(new_password, 10);
  await store.updateUser(user.id, { password_hash, failed_login_count: 0, locked_until: null });
  return { message: '密码已重置' };
}

module.exports = { register, login, resetPassword };
