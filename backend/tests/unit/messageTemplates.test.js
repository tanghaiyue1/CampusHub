/**
 * @file backend/tests/unit/messageTemplates.test.js
 * @description 消息模板单元测试
 */

const { render, TEMPLATES } = require('../../src/lib/messageTemplates');

describe('messageTemplates', () => {
  it('order_applied 模板包含需求标题与昵称', () => {
    const msg = TEMPLATES.order_applied('代取快递', '张三');
    expect(msg).toContain('代取快递');
    expect(msg).toContain('张三');
  });

  it('evaluation_appeal_resolved 区分通过/驳回', () => {
    expect(render('evaluation_appeal_resolved', true)).toContain('通过');
    expect(render('evaluation_appeal_resolved', false)).toContain('驳回');
  });

  it('未知 key 返回兜底文案', () => {
    expect(render('unknown_event')).toBe('【系统通知】unknown_event');
  });

  it('order_completed 包含订单号', () => {
    expect(render('order_completed', 'ORD-001')).toContain('ORD-001');
  });
});
