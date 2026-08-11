<!-- @file frontend/src/views/ProfileView.vue — 个人中心：资料、信用、评价 -->

<template>
  <div class="page-container">
    <header class="page-header">
      <div>
        <h1>个人中心</h1>
        <p class="page-subtitle">管理资料与查看信用记录</p>
      </div>
    </header>

    <div v-if="credit" class="credit-banner">
      <div>
        <span class="form-hint">信用分</span>
        <strong>{{ credit.credit_score }}</strong>
        <span class="badge badge-primary" style="margin-left: 0.5rem">{{ credit.level }}</span>
      </div>
      <router-link v-if="auth.user?.id" :to="`/evaluations/user/${auth.user.id}`" class="btn btn-secondary btn-sm">
        我的评价
      </router-link>
    </div>

    <div class="profile-grid">
      <div class="card card-padded">
        <h3 class="section-title" style="margin-top: 0; border: none; padding: 0">基本资料</h3>
        <form v-if="form" @submit.prevent="save">
          <div class="form-group">
            <label>昵称</label>
            <input v-model="form.nickname" class="input" />
          </div>
          <div class="form-group">
            <label>手机号</label>
            <input v-model="form.phone" class="input" />
          </div>
          <label class="checkbox-row">
            <input v-model="form.hide_phone" type="checkbox" />
            隐藏手机号
          </label>
          <label class="checkbox-row">
            <input v-model="form.hide_orders" type="checkbox" />
            隐藏接单/发布记录
          </label>
          <label class="checkbox-row">
            <input v-model="form.hide_reviews" type="checkbox" />
            隐藏评价记录
          </label>
          <div v-if="msg" class="alert alert-success">{{ msg }}</div>
          <div v-if="error" class="alert alert-error">{{ error }}</div>
          <button type="submit" class="btn btn-primary" style="margin-top: 1rem">保存修改</button>
        </form>
      </div>

      <div class="card card-padded">
        <h3 class="section-title" style="margin-top: 0; border: none; padding: 0">信用变动</h3>
        <ul v-if="history.length" class="history-list">
          <li v-for="h in history" :key="h.id">
            <span class="history-change" :class="h.change_amount >= 0 ? 'plus' : 'minus'">
              {{ h.change_amount > 0 ? '+' : '' }}{{ h.change_amount }}
            </span>
            <span class="history-reason">{{ h.reason }}</span>
            <span class="history-score">→ {{ h.current_score }}</span>
          </li>
        </ul>
        <p v-else class="form-hint">暂无信用变动记录</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import client from '../api/client'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const form = ref(null)
const credit = ref(null)
const history = ref([])
const msg = ref('')
const error = ref('')

onMounted(async () => {
  try {
    const data = await auth.fetchProfile()
    form.value = {
      nickname: data.nickname,
      phone: data.phone || '',
      hide_phone: data.hide_phone,
      hide_orders: data.hide_orders,
      hide_reviews: data.hide_reviews,
    }
    const c = await client.get(`/api/users/${data.id}/credit`)
    credit.value = c.data
    const h = await client.get(`/api/users/${data.id}/credit/history`)
    history.value = h.data.items || []
  } catch (e) {
    error.value = e.message
  }
})

async function save() {
  try {
    await client.put('/api/users/me', form.value)
    msg.value = '资料已保存'
    await auth.fetchProfile()
    setTimeout(() => { msg.value = '' }, 3000)
  } catch (e) {
    error.value = e.message
  }
}
</script>

<style scoped>
.profile-grid {
  display: grid;
  gap: 1.25rem;
}
@media (min-width: 768px) {
  .profile-grid {
    grid-template-columns: 1fr 1fr;
    align-items: start;
  }
}
.history-list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.history-list li {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.35rem 0.75rem;
  padding: 0.65rem 0;
  border-bottom: 1px solid var(--ch-border);
  font-size: 0.9rem;
}
.history-change {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.history-change.plus {
  color: var(--ch-success);
}
.history-change.minus {
  color: var(--ch-danger);
}
.history-reason {
  flex: 1;
  color: var(--ch-text);
}
.history-score {
  color: var(--ch-text-muted);
  font-size: 0.85rem;
}
</style>
