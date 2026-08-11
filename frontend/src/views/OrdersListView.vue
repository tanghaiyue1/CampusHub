<!-- @file frontend/src/views/OrdersListView.vue — 我的订单：发布/接单与待接单需求 -->

<template>
  <div class="page-container">
    <header class="page-header">
      <div>
        <h1>我的订单</h1>
        <p class="page-subtitle">查看发布与接单记录</p>
      </div>
    </header>

    <div class="tabs">
      <button
        type="button"
        class="tab"
        :class="{ active: role === '' }"
        @click="role = ''; load()"
      >
        全部
      </button>
      <button
        type="button"
        class="tab"
        :class="{ active: role === 'publisher' }"
        @click="role = 'publisher'; load()"
      >
        我发布的
      </button>
      <button
        type="button"
        class="tab"
        :class="{ active: role === 'acceptor' }"
        @click="role = 'acceptor'; load()"
      >
        我接的单
      </button>
    </div>

    <div v-if="error" class="alert alert-error">{{ error }}</div>
    <div v-if="loading" class="loading-state"><span class="spinner" />加载中…</div>

    <div v-else-if="displayItems.length" class="card-list">
      <article v-for="item in displayItems" :key="item.key" class="card card-hover">
        <router-link :to="item.to" class="list-item-link">
          <h3 class="list-item-title">{{ item.title }}</h3>
          <div class="list-item-meta">
            <span class="badge" :class="item.badgeClass">{{ item.badgeLabel }}</span>
            <span v-if="item.subLabel" class="badge badge-muted">{{ item.subLabel }}</span>
            <span v-if="item.extra" class="meta-text">{{ item.extra }}</span>
          </div>
        </router-link>
      </article>
    </div>

    <div v-else class="card card-padded empty-state">
      <div class="empty-state-icon">📦</div>
      <p>{{ emptyHint }}</p>
      <router-link to="/requirements" class="btn btn-primary" style="margin-top: 1rem">去需求广场</router-link>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import client from '../api/client'
import { ORDER_STATUS_LABELS, paymentLabel, requirementStatusLabel } from '../utils/labels'

const orders = ref([])
const publishedReqs = ref([])
const role = ref('')
const loading = ref(false)
const error = ref('')

function statusLabel(s) {
  return ORDER_STATUS_LABELS[s] || s
}

function statusBadgeClass(s) {
  if (s === 'completed') return 'badge-success'
  if (s === 'cancelled' || s === 'rejected') return 'badge-danger'
  if (s === 'in_progress' || s === 'ready_for_acceptance') return 'badge-warning'
  return 'badge-primary'
}

function pendingCount(r) {
  return r.pending_applications ?? r.pending_application_count ?? 0
}

const orderReqIds = computed(() => new Set(orders.value.map((o) => o.requirement_id)))

const displayItems = computed(() => {
  const items = []
  const showPublished =
    role.value === '' || role.value === 'publisher'

  if (showPublished) {
    for (const r of publishedReqs.value) {
      if (orderReqIds.value.has(r.id)) continue
      items.push({
        key: `req-${r.id}`,
        to: `/requirements/${r.id}`,
        title: r.title,
        badgeLabel: requirementStatusLabel(r.status),
        badgeClass: r.status === 'pending' ? 'badge-warning' : 'badge-muted',
        subLabel: '我发布的需求',
        extra: pendingCount(r) > 0
          ? `${pendingCount(r)} 人待确认`
          : r.status === 'pending'
            ? '等待接单'
            : '',
        sortAt: r.created_at,
      })
    }
  }

  for (const o of orders.value) {
    items.push({
      key: `order-${o.id}`,
      to: `/orders/${o.id}`,
      title: o.requirement?.title || o.order_no,
      badgeLabel: statusLabel(o.status),
      badgeClass: statusBadgeClass(o.status),
      subLabel: o.order_no,
      extra: paymentLabel(o.payment_status),
      sortAt: o.created_at,
    })
  }

  items.sort((a, b) => new Date(b.sortAt) - new Date(a.sortAt))
  return items
})

const emptyHint = computed(() => {
  if (role.value === 'publisher') return '暂无发布记录，去发布一条需求吧'
  if (role.value === 'acceptor') return '暂无接单记录'
  return '暂无订单'
})

async function load() {
  loading.value = true
  error.value = ''
  try {
    const orderParams = {
      page: 1,
      limit: 50,
      role: role.value || undefined,
    }
    const tasks = [client.get('/api/orders', { params: orderParams })]
    if (role.value === '' || role.value === 'publisher') {
      tasks.push(client.get('/api/requirements/mine', { params: { page: 1, limit: 50 } }))
    }
    const results = await Promise.all(tasks)
    orders.value = results[0].data.list || []
    publishedReqs.value =
      results.length > 1 ? results[1].data.list || [] : []
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.tabs {
  display: flex;
  gap: 0.35rem;
  margin-bottom: 1.25rem;
  padding: 0.25rem;
  background: var(--ch-surface);
  border: 1px solid var(--ch-border);
  border-radius: var(--ch-radius);
  width: fit-content;
}
.tab {
  padding: 0.45rem 1rem;
  font-size: 0.9rem;
  font-weight: 500;
  font-family: inherit;
  color: var(--ch-text-secondary);
  background: transparent;
  border: none;
  border-radius: var(--ch-radius-sm);
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}
.tab:hover {
  color: var(--ch-text);
}
.tab.active {
  color: var(--ch-primary-hover);
  background: var(--ch-primary-soft);
}
.meta-text {
  font-size: 0.85rem;
  color: var(--ch-text-muted);
}
</style>
