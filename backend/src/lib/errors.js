/**
 * @file backend/src/lib/errors.js
 * @description 应用错误类 AppError 与 HTTP 状态映射
 */

class AppError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
    this.name = 'AppError';
  }
}

module.exports = { AppError };
