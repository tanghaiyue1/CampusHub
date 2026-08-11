/**
 * @file backend/src/db/index.js
 * @description 数据访问层入口：MySQL / 内存库选择与切换
 */

const config = require('../config');
const { getMemoryStore, resetMemorySingleton } = require('./memoryStore');

let store = null;
let storeType = 'memory';

async function initStore() {
  if (store) return store;

  if (!config.useMemoryDb) {
    try {
      const { createMysqlStore } = require('./mysqlStore');
      store = await createMysqlStore();
      storeType = 'mysql';
      console.log('[CampusHub] 已连接 MySQL 数据库');
      return store;
    } catch (err) {
      console.warn('[CampusHub] MySQL 连接失败，回退内存库:', err.message);
      resetMemorySingleton();
    }
  }

  store = getMemoryStore();
  storeType = 'memory';
  return store;
}

function getStore() {
  if (!store) {
    return getMemoryStore();
  }
  return store;
}

function getStoreType() {
  return storeType;
}

async function resetStore() {
  if (store && store.reset) {
    await store.reset();
    return;
  }
  resetMemorySingleton();
  store = null;
  storeType = 'memory';
}

module.exports = { initStore, getStore, getStoreType, resetStore };
