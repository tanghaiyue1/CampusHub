<!-- @file frontend/src/views/MessagesView.vue — 消息中心 -->

<template>
  <div class="page-container">
    <header class="page-header">
      <div>
        <h1>消息中心</h1>
        <p class="page-subtitle">
          <span v-if="unread > 0">你有 {{ unread }} 条未读消息</span>
          <span v-else>暂无未读消息</span>
        </p>
      </div>
      <button v-if="unread > 0" type="button" class="btn btn-secondary btn-sm" @click="markAllRead">
        全部标为已读
      </button>
    </header>

    <div v-if="error" class="alert alert-error">{{ error }}</div>

    <div v-if="list.length" class="card message-card">
      <article
        v-for="m in list"
        :key="m.id"
        class="message-item"
        :class="{ unread: !m.is_read }"
      >
        <div class="message-meta">
          <span>{{ m.sender?.nickname || '系统' }}</span>
          <span>{{ formatTime(m.created_at) }}</span>
          <span v-if="!m.is_read" class="badge badge-primary">未读</span>
        </div>
        <p class="message-body">{{ m.content }}</p>
        <div class="btn-group" style="margin-top: 0.5rem">
          <button v-if="!m.is_read" type="button" class="btn btn-primary btn-sm" @click="markRead(m.id)">
            标为已读
          </button>
          <router-link
            v-if="m.related_type === 'order' && m.related_id"
            :to="`/orders/${m.related_id}`"
            class="btn btn-ghost btn-sm"
          >
            查看详情 →
          </router-link>
        </div>
      </article>
    </div>

    <div v-else class="card card-padded empty-state">
      <div class="empty-state-icon">💬</div>
      <p>暂无消息，完成订单后会收到通知</p>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import client from '../api/client'
import { useMessageStore } from '../stores/messages'

const msgStore = useMessageStore()
const list = ref([])
const unread = ref(0)
const error = ref('')

function formatTime(t) {
  if (!t) return ''
  return new Date(t).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

async function load() {
  error.value = ''
  try {
    const res = await client.get('/api/messages', { params: { page: 1, limit: 50 } })
    list.value = res.data.list || []
    const u = await client.get('/api/messages/unread/count')
    unread.value = u.data.unread_count || 0
    msgStore.unreadCount = unread.value
  } catch (e) {
    error.value = e.message
  }
}

async function markRead(id) {
  await client.put(`/api/messages/${id}/read`)
  await load()
}

async function markAllRead() {
  await client.put('/api/messages/read-all')
  await load()
}

onMounted(load)
</script>

<style scoped>
.message-card {
  overflow: hidden;
}
.message-body {
  font-size: 0.95rem;
  line-height: 1.6;
  color: var(--ch-text);
  margin: 0;
}
.message-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}
</style>
