/**
 * @file backend/src/lib/response.js
 * @description 统一 API 响应格式 { code, message, data }
 */

function success(res, data = null, message = 'success', code = 200) {
  return res.status(200).json({ code, message, data });
}

function fail(res, code, message, httpStatus) {
  const statusMap = {
    4000: 400,
    4001: 401,
    4003: 403,
    40031: 403,
    40032: 403,
    4004: 404,
    4009: 409,
    5000: 500,
    5001: 409,
  };
  const status = httpStatus ?? statusMap[code] ?? 400;
  return res.status(status).json({ code, message, data: null });
}

module.exports = { success, fail };
