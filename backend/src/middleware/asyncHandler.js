/**
 * @file backend/src/middleware/asyncHandler.js
 * @description 异步路由包装，将 Promise 异常交给错误中间件
 */

function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = { asyncHandler };
