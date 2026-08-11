/**
 * @file backend/vitest.config.js
 * @description Vitest 单元测试配置
 */

const { defineConfig } = require('vitest/config');

module.exports = defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.js'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.js', 'app.js'],
      exclude: [
        'tests/**',
        'node_modules/**',
        'vitest.config.js',
        'eslint.config.js',
        'src/db/mysqlStore.js',
      ],
      thresholds: {
        lines: 60,
        statements: 60,
        functions: 55,
        branches: 45,
      },
    },
  },
});