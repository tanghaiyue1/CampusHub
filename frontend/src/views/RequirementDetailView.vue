<!-- @file frontend/src/views/RequirementDetailView.vue — 需求详情、申请接单、确认申请 -->

<template>
  <div class="page-container">
    <div v-if="loading" class="loading-state"><span class="spinner" />加载中…</div>

    <template v-else-if="item">
      <header class="page-header">
        <div>
          <div class="detail-badges">
            <span class="badge badge-primary">{{ categoryLabel(item.category) }}</span>
            <span class="badge badge-muted">{{ formatReward(item) }}</span>
            <span class="badge badge-warning">{{ requirementStatusLabel(item.status) }}</span>
          </div>
          <h1 style="margin-top: 0.75rem">{{ item.title }}</h1>
        </div>
      </header>

      <div class="detail-grid">
        <div class="card card-padded detail-main">
          <p v-if="item.description" class="detail-desc">{{ item.description }}</p>
          <p v-else class="detail-desc muted">暂无详细描述</p>

          <dl class="info-list">
            <div v-if="item.location" class="info-row">
              <dt>地点</dt>
              <dd>{{ item.location }}</dd>
            </div>
            <div class="info-row">
              <dt>发布者</dt>
              <dd>
                <router-link
                  v-if="!item.is_anonymous && item.publisher?.id"
                  :to="`/users/${item.publisher.id}`"
                  class="user-link"
                >
                  {{ item.publisher.nickname }}
                </router-link>
                <span v-else>{{ item.is_anonymous ? '匿名用户' : item.publisher?.nickname }}</span>
              </dd>
            </div>
            <div v-if="item.deadline" class="info-row">
              <dt>截止</dt>
              <dd>{{ formatDate(item.deadline) }}</dd>
            </div>
            <div v-if="item.escrow_status && item.escrow_status !== 'none'" class="info-row">
              <dt>托管</dt>
              <dd>{{ escrowLabel(item.escrow_status) }}</dd>
            </div>
          </dl>

          <div class="btn-group" style="margin-top: 1.25rem">
            <p v-if="auth.isLoggedIn && !auth.user?.is_verified" class="alert alert-error" style="width: 100%">
              请先完成
              <router-link to="/verification">学生认证</router-link>
              后再申请接单
            </p>
            <button v-if="canApply" type="button" class="btn btn-primary" @click="applyOrder">
              申请接单
            </button>
            <button v-if="item.can_edit" type="button" class="btn btn-secondary" @click="editMode = !editMode">
              {{ editMode ? '取消编辑' : '编辑' }}
            </button>
            <button v-if="item.can_cancel" type="button" class="btn btn-danger" @click="cancelReq">
              撤销需求
            </button>
          </div>

          <form v-if="editMode" class="section" @submit.prevent="saveEdit">
            <h3 class="section-title">编辑需求</h3>
            <div class="form-group">
              <input v-model="editForm.title" class="input" />
            </div>
            <textarea v-model="editForm.description" class="textarea" />
            <button type="submit" class="btn btn-primary btn-sm">保存</button>
          </form>
        </div>

        <aside v-if="isOwner && applications.length" class="card card-padded">
          <h3 class="section-title">接单申请（{{ applications.length }}）</h3>
          <ul class="apply-list">
            <li v-for="app in applications" :key="app.order_id" class="apply-item">
              <div>
                <router-link v-if="app.acceptor?.id" :to="`/users/${app.acceptor.id}`" class="user-link">
                  <strong>{{ app.acceptor.nickname }}</strong>
                </router-link>
                <strong v-else>{{ app.acceptor?.nickname }}</strong>
                <span class="form-hint">信用 {{ app.acceptor?.credit_score ?? '—' }} · {{ app.order_no }}</span>
              </div>
              <div class="btn-group">
                <button type="button" class="btn btn-primary btn-sm" @click="confirmApp(app.order_id)">
                  确认
                </button>
                <button type="button" class="btn btn-ghost btn-sm" @click="rejectApp(app.order_id)">
                  拒绝
                </button>
              </div>
            </li>
          </ul>
        </aside>
      </div>
    </template>

    <div v-if="error" class="alert alert-error">{{ error }}</div>
    <router-link to="/requirements" class="back-link">← 返回需求广场</router-link>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import client from '../api/client'
import { useAuthStore } from '../stores/auth'
import { CATEGORY_LABELS, formatReward, requirementStatusLabel, escrowLabel } from '../utils/labels'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const item = ref(null)
const applications = ref([])
const loading = ref(true)
const error = ref('')
const editMode = ref(false)
const editForm = ref({ title: '', description: '' })

const isOwner = computed(() => auth.user?.id && item.value?.publisher?.id === auth.user.id)
const canApply = computed(() => {
  if (!auth.isLoggedIn || !item.value) return false
  if (!auth.user?.is_verified) return false
  if (item.value.status !== 'pending') return false
  if (isOwner.value) return false
  return true
})

function categoryLabel(id) {
  return CATEGORY_LABELS[id] || id
}
function formatDate(t) {
  return t ? new Date(t).toLocaleString('zh-CN') : ''
}

async function loadApplications() {
  if (!isOwner.value) {
    applications.value = []
    return
  }
  try {
    const res = await client.get(`/api/requirements/${route.params.id}/applications`)
    applications.value = res.data.list || []
  } catch {
    applications.value = []
  }
}

async function load() {
  loading.value = true
  try {
    if (auth.isLoggedIn) await auth.fetchProfile()
    const res = await client.get(`/api/requirements/${route.params.id}`)
    item.value = res.data
    editForm.value = { title: res.data.title, description: res.data.description }
    await loadApplications()
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

async function applyOrder() {
  try {
    const res = await client.post('/api/orders', { requirement_id: Number(route.params.id) })
    router.push(`/orders/${res.data.order_id}`)
  } catch (e) {
    error.value = e.message
  }
}

async function confirmApp(orderId) {
  try {
    await client.post(`/api/orders/${orderId}/confirm`)
    await load()
  } catch (e) {
    error.value = e.message
  }
}

async function rejectApp(orderId) {
  try {
    await client.post(`/api/orders/${orderId}/reject`)
    await loadApplications()
  } catch (e) {
    error.value = e.message
  }
}

async function saveEdit() {
  try {
    await client.put(`/api/requirements/${route.params.id}`, editForm.value)
    editMode.value = false
    await load()
  } catch (e) {
    error.value = e.message
  }
}

async function cancelReq() {
  if (!confirm('确定撤销该需求？')) return
  try {
    await client.delete(`/api/requirements/${route.params.id}`)
    router.push('/requirements')
  } catch (e) {
    error.value = e.message
  }
}

onMounted(load)
</script>

<style scoped>
.detail-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.detail-desc {
  font-size: 1rem;
  line-height: 1.7;
  color: var(--ch-text);
  margin-bottom: 1.25rem;
}
.detail-desc.muted {
  color: var(--ch-text-muted);
}
.detail-grid {
  display: grid;
  gap: 1.25rem;
}
@media (min-width: 768px) {
  .detail-grid {
    grid-template-columns: 1fr 300px;
    align-items: start;
  }
}
.info-list {
  margin: 0;
}
.info-row {
  display: flex;
  gap: 1rem;
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--ch-border);
  font-size: 0.9rem;
}
.info-row:last-child {
  border-bottom: none;
}
.info-row dt {
  width: 4rem;
  color: var(--ch-text-muted);
  font-weight: 500;
}
.apply-list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.apply-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 0;
  border-bottom: 1px solid var(--ch-border);
}
.user-link {
  color: var(--ch-primary);
  text-decoration: none;
}
.user-link:hover {
  text-decoration: underline;
}
.apply-item:last-child {
  border-bottom: none;
}
</style>
