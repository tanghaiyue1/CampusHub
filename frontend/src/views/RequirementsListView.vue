<!-- @file frontend/src/views/RequirementsListView.vue — 需求广场列表与筛选 -->

<template>
  <div class="page-container">
    <header class="page-header">
      <div>
        <h1>需求广场</h1>
        <p class="page-subtitle">浏览校园互助需求，找到你擅长的任务</p>
      </div>
      <router-link v-if="auth.isLoggedIn" to="/requirements/new" class="btn btn-primary">
        + 发布需求
      </router-link>
      <router-link v-else to="/login" class="btn btn-primary">登录后发布</router-link>
    </header>

    <div class="filter-bar">
      <input v-model="keyword" class="input" placeholder="搜索标题或描述…" @keyup.enter="load" />
      <select v-model="category" class="select" @change="load">
        <option value="">全部类型</option>
        <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.label }}</option>
      </select>
      <select v-model="reward_type" class="select" @change="load">
        <option value="">全部报酬</option>
        <option value="cash">现金</option>
        <option value="points">积分</option>
        <option value="free">无偿</option>
      </select>
      <select v-model="sort_by" class="select" @change="load">
        <option value="created_at">最新发布</option>
        <option value="deadline">截止时间</option>
      </select>
      <button type="button" class="btn btn-secondary" @click="load">筛选</button>
    </div>

    <div v-if="error" class="alert alert-error">{{ error }}</div>

    <div v-if="loading" class="loading-state">
      <span class="spinner" />加载中…
    </div>

    <div v-else-if="list.length" class="card-list">
      <article v-for="item in list" :key="item.id" class="card card-hover">
        <router-link :to="`/requirements/${item.id}`" class="list-item-link">
          <h3 class="list-item-title">{{ item.title }}</h3>
          <div class="list-item-meta">
            <span class="badge badge-primary">{{ categoryLabel(item.category) }}</span>
            <span class="badge badge-muted">{{ formatReward(item) }}</span>
            <span v-if="item.location" class="meta-loc">📍 {{ item.location }}</span>
            <span class="meta-user">
              {{ item.is_anonymous ? '匿名用户' : item.publisher?.nickname }}
            </span>
          </div>
        </router-link>
      </article>
    </div>

    <div v-else class="card card-padded empty-state">
      <div class="empty-state-icon">📋</div>
      <p>暂无待接单需求</p>
      <router-link v-if="auth.isLoggedIn" to="/requirements/new" class="btn btn-primary" style="margin-top: 1rem">
        发布第一条需求
      </router-link>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import client from '../api/client'
import { useAuthStore } from '../stores/auth'
import { CATEGORY_LABELS, formatReward } from '../utils/labels'

const auth = useAuthStore()
const list = ref([])
const categories = ref([])
const keyword = ref('')
const category = ref('')
const reward_type = ref('')
const sort_by = ref('created_at')
const loading = ref(false)
const error = ref('')

function categoryLabel(id) {
  return CATEGORY_LABELS[id] || id
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await client.get('/api/requirements', {
      params: {
        page: 1,
        limit: 20,
        keyword: keyword.value || undefined,
        category: category.value || undefined,
        reward_type: reward_type.value || undefined,
        sort_by: sort_by.value,
        status: 'pending',
      },
    })
    list.value = res.data.list || []
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  try {
    const meta = await client.get('/api/requirements/meta/categories')
    categories.value = meta.data.categories || []
  } catch {
    /* ignore */
  }
  await load()
})
</script>

<style scoped>
.meta-loc,
.meta-user {
  color: var(--ch-text-muted);
}
.meta-user {
  margin-left: auto;
}
</style>
