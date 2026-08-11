/**
 * @file backend/tests/unit/constants.test.js
 * @description 业务常量与状态机单元测试
 */

const {
  ORDER_TRANSITIONS,
  REQUIREMENT_TRANSITIONS,
  CATEGORY_LABELS,
  REQUIREMENT_CATEGORIES,
} = require('../../src/lib/constants');

describe('ORDER_TRANSITIONS 状态机', () => {
  it('pending_confirm 可确认、拒绝或取消', () => {
    expect(ORDER_TRANSITIONS.pending_confirm).toEqual(
      expect.arrayContaining(['accepted', 'rejected', 'cancelled']),
    );
  });

  it('completed 为终态不可再转换', () => {
    expect(ORDER_TRANSITIONS.completed).toEqual([]);
  });

  it('accepted 可开始履约或取消', () => {
    expect(ORDER_TRANSITIONS.accepted).toEqual(['in_progress', 'cancelled']);
  });

  it('ready_for_acceptance 可完成或取消', () => {
    expect(ORDER_TRANSITIONS.ready_for_acceptance).toEqual(['completed', 'cancelled']);
  });
});

describe('REQUIREMENT_TRANSITIONS 状态机', () => {
  it('pending 可进入 accepted 或 cancelled', () => {
    expect(REQUIREMENT_TRANSITIONS.pending).toEqual(['accepted', 'cancelled']);
  });

  it('completed 为终态', () => {
    expect(REQUIREMENT_TRANSITIONS.completed).toEqual([]);
  });
});

describe('REQUIREMENT_CATEGORIES', () => {
  it('每个分类都有中文标签', () => {
    for (const cat of REQUIREMENT_CATEGORIES) {
      expect(CATEGORY_LABELS[cat]).toBeTruthy();
    }
  });
});
