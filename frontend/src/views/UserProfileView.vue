<!-- @file frontend/src/views/UserProfileView.vue — 查看他人公开主页 -->

<template>
  <div class="page-container">
    <div v-if="loading" class="loading-state"><span class="spinner" />加载中…</div>

    <template v-else-if="user">
      <header class="page-header">
        <div>
          <h1>{{ user.nickname || '用户' }}</h1>
          <p class="page-subtitle">
            <span v-if="user.is_verified" class="badge badge-success">已认证</span>
            <span v-else class="badge badge-muted">未认证</span>
            <span class="badge badge-primary">信用 {{ credit?.credit_score ?? user.credit_score ?? '—' }}</span>
            <span v-if="credit?.level" class="badge badge-muted">{{ credit.level }}</span>
          </p>
        </div>
        <router-link v-if="isSelf" to="/profile" class="btn btn-secondary btn-sm">编辑资料</router-link>
      </header>

      <div class="card card-padded">
        <h3 class="section-title">收到的评价</h3>
        <div v-if="reviewsHidden" class="form-hint">该用户已隐藏评价记录</div>
        <div v-else-if="reviews.length" class="review-list">
          <article v-for="ev in reviews" :key="ev.id" class="review-item">
            <div class="review-head">
              <span class="stars">{{ '★'.repeat(ev.rating) }}{{ '☆'.repeat(5 - ev.rating) }}</span>
              <span class="badge badge-muted">{{ ev.is_anonymous ? '匿名' : ev.evaluator?.nickname }}</span>
            </div>
            <p class="review-comment">{{ ev.comment || '无文字评价' }}</p>
            <time class="review-time">{{ formatDate(ev.created_at) }}</time>
          </article>
        </div>
        <p v-else class="form-hint">暂无评价</p>
      </div>
    </template>

    <div v-if="error" class="alert alert-error">{{ error }}</div>
    <button type="button" class="back-link btn-link" @click="router.back()">← 返回</button>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import client from '../api/client'
import { useAuthStore } from '../stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const user = ref(null)
const credit = ref(null)
const reviews = ref([])
const reviewsHidden = ref(false)
const loading = ref(true)
const error = ref('')

const isSelf = computed(() => auth.user?.id === user.value?.id)

function formatDate(t) {
  return t ? new Date(t).toLocaleString('zh-CN') : ''
}

onMounted(async () => {
  loading.value = true
  error.value = ''
  try {
    await auth.fetchProfile()
    const userId = route.params.id
    const [profileRes, creditRes, evalRes] = await Promise.all([
      client.get(`/api/users/${userId}`),
      client.get(`/api/users/${userId}/credit`),
      client.get(`/api/evaluations/user/${userId}`, { params: { page: 1, limit: 10 } }),
    ])
    user.value = profileRes.data
    credit.value = creditRes.data
    if (evalRes.data.hidden) {
      reviewsHidden.value = true
    } else {
      reviews.value = evalRes.data.list || []
    }
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.page-subtitle {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.5rem;
}
.review-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.review-item {
  padding: 1rem;
  background: var(--ch-bg);
  border-radius: var(--ch-radius-sm);
}
.review-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.35rem;
}
.stars {
  color: var(--ch-accent);
  letter-spacing: 1px;
}
.review-comment {
  margin: 0.35rem 0;
  line-height: 1.6;
}
.review-time {
  font-size: 0.8rem;
  color: var(--ch-text-muted);
}
.btn-link {
  background: none;
  border: none;
  padding: 0;
  font: inherit;
  color: var(--ch-primary);
  cursor: pointer;
  margin-top: 1rem;
}
</style>
