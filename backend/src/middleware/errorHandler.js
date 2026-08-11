/**
 * @file backend/src/middleware/errorHandler.js
 * @description 全局 404 与错误处理中间件
 */

const { fail } = require('../lib/response');
const { AppError } = require('../lib/errors');

function errorHandler(err, req, res, _next) {
  if (err instanceof AppError) {
    return fail(res, err.code, err.message);
  }
  console.error(err);
  return fail(res, 5000, '服务器内部错误', 500);
}

function notFoundHandler(req, res) {
  return fail(res, 4004, `路由不存在: ${req.method} ${req.path}`, 404);
}

module.exports = { errorHandler, notFoundHandler };
