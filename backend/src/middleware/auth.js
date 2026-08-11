/**
 * @file backend/src/middleware/auth.js
 * @description JWT 鉴权：authRequired / authOptional / signToken
 */

const jwt = require('jsonwebtoken');
const config = require('../config');
const { getStore } = require('../db');
const { fail } = require('../lib/response');

async function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return fail(res, 4001, '未登录或 Token 已失效');
  }
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    const store = getStore();
    const user = await store.findUserById(payload.sub);
    if (!user) {
      return fail(res, 4001, '用户不存在');
    }
    if (user.is_graduated) {
      return fail(res, 4003, '毕业账号已限制功能');
    }
    req.user = user;
    next();
  } catch {
    return fail(res, 4001, '未登录或 Token 已失效');
  }
}

function signToken(userId) {
  return jwt.sign({ sub: userId }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });
}

async function authOptional(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next();
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    const user = await getStore().findUserById(payload.sub);
    if (user) req.user = user;
  } catch {
    /* ignore invalid token */
  }
  next();
}

module.exports = { authRequired, authOptional, signToken };
