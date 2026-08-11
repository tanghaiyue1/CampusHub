/**
 * @file backend/src/utils/userPresenter.js
 * @description 用户对象脱敏与对外展示字段裁剪
 */

function maskPhone(phone) {
  if (!phone || phone.length < 7) return phone;
  return `${phone.slice(0, 3)}****${phone.slice(-4)}`;
}

function toPublicUser(user, options = {}) {
  if (!user) return null;
  const { hideIdentity = false } = options;
  if (hideIdentity) {
    return {
      id: null,
      nickname: '匿名用户',
      avatar_url: null,
      is_anonymous: true,
    };
  }
  const result = {
    id: user.id,
    student_id: user.hide_orders ? undefined : user.student_id,
    nickname: user.nickname,
    avatar_url: user.avatar_url,
    credit_score: user.credit_score,
    is_verified: user.is_verified,
    verification_status: user.verification_status,
    hide_phone: user.hide_phone,
    hide_wechat: user.hide_wechat,
    hide_orders: user.hide_orders,
    hide_reviews: user.hide_reviews,
    created_at: user.created_at,
  };
  if (!user.hide_phone && user.phone) {
    result.phone = maskPhone(user.phone);
  }
  return result;
}

module.exports = { maskPhone, toPublicUser };
