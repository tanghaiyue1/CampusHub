/**
 * @file backend/tests/app.test.js
 * @description 应用冒烟测试（健康检查等）
 */

process.env.NODE_ENV = 'test';
process.env.USE_MEMORY_DB = '1';

const request = require('supertest');
const { resetStore } = require('../src/db');

let app;

beforeEach(async () => {
  await resetStore();
  vi.resetModules();
  app = require('../app');
});

describe('GET /api/hello', () => {
  it('should return a welcome message', async () => {
    const res = await request(app).get('/api/hello');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message');
    expect(res.body.message).toBe('Hello from CampusHub backend!');
  });
});

describe('404 handling', () => {
  it('should return 404 for unknown routes', async () => {
    const res = await request(app).get('/api/nonexistent');
    expect(res.status).toBe(404);
    expect(res.body.code).toBe(4004);
  });
});