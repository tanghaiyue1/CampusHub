<!-- @file frontend/src/views/EvaluationsView.vue — 我收到的评价列表 -->

<template>
  <div class="page-container">
    <header class="page-header">
      <div>
        <h1>收到的评价</h1>
        <p class="page-subtitle">来自互助伙伴的反馈</p>
      </div>
    </header>

    <div v-if="hidden" class="card card-padded empty-state">
      <p>该用户已隐藏评价记录</p>
    </div>

    <div v-else-if="list.length" class="card-list">
      <article v-for="ev in list" :key="ev.id" class="card card-padded eval-card">
        <div class="eval-header">
          <span class="stars">{{ '★'.repeat(ev.rating) }}{{ '☆'.repeat(5 - ev.rating) }}</span>
          <span class="badge badge-muted">{{ ev.is_anonymous ? '匿名' : ev.evaluator?.nickname }}</span>
        </div>
        <p v-if="ev.comment" class="eval-comment">{{ ev.comment }}</p>
        <p v-else class="form-hint">无文字评价</p>
        <time class="eval-time">{{ formatDate(ev.created_at) }}</time>
      </article>
    </div>

    <div v-else class="card card-padded empty-state">
      <div class="empty-state-icon">⭐</div>
      <p>暂无评价</p>
    </div>

    <router-link :to="backLink" class="back-link">← 返回</router-link>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import client from '../api/client'
import { useAuthStore } from '../stores/auth'

const route = useRoute()
const auth = useAuthStore()
const list = ref([])
const hidden = ref(false)
const error = ref('')

const backLink = computed(() => {
  const uid = route.params.userId
  if (auth.user?.id && Number(uid) === Number(auth.user.id)) return '/profile'
  return `/users/${uid}`
})

function formatDate(t) {
  return t ? new Date(t).toLocaleString('zh-CN') : ''
}

onMounted(async () => {
  try {
    const res = await client.get(`/api/evaluations/user/${route.params.userId}`)
    if (res.data.hidden) {
      hidden.value = true
      return
    }
    list.value = res.data.list || []
  } catch (e) {
    error.value = e.message
  }
})
</script>

<style scoped>
.eval-card {
  position: relative;
}
.eval-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}
.stars {
  color: var(--ch-accent);
  font-size: 1.1rem;
  letter-spacing: 2px;
}
.eval-comment {
  line-height: 1.6;
  margin: 0.5rem 0;
}
.eval-time {
  font-size: 0.8rem;
  color: var(--ch-text-muted);
}
</style>
