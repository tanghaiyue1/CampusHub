<!-- @file frontend/src/App.vue — 根布局：顶栏导航、路由出口、页脚 -->

<template>
  <div class="app-shell">
    <header class="app-header">
      <div class="header-inner">
        <router-link to="/requirements" class="brand">
          <span class="brand-icon">🏫</span>
          <span class="brand-text">
            <strong>CampusHub</strong>
            <small>校园互助</small>
          </span>
        </router-link>

        <nav class="main-nav">
          <router-link to="/requirements" class="nav-link">需求广场</router-link>
          <template v-if="auth.isLoggedIn">
            <router-link to="/orders" class="nav-link">我的订单</router-link>
            <router-link to="/messages" class="nav-link nav-link-badge">
              消息
              <span v-if="msgStore.unreadCount > 0" class="nav-badge">{{ msgStore.unreadCount }}</span>
            </router-link>
            <router-link to="/ai-assistant" class="nav-link nav-link-ai">🤖 AI 助手</router-link>
            <router-link to="/profile" class="nav-link">个人中心</router-link>
          </template>
        </nav>

        <div class="header-actions">
          <template v-if="auth.isLoggedIn">
            <span v-if="auth.user?.nickname" class="user-chip">{{ auth.user.nickname }}</span>
            <router-link to="/verification" class="btn btn-ghost btn-sm">认证</router-link>
            <button type="button" class="btn btn-secondary btn-sm" @click="logout">退出</button>
          </template>
          <template v-else>
            <router-link to="/login" class="btn btn-ghost btn-sm">登录</router-link>
            <router-link to="/register" class="btn btn-primary btn-sm">注册</router-link>
          </template>
        </div>
      </div>
    </header>

    <main class="app-main">
      <RouterView />
    </main>

    <AppFooter />
  </div>
</template>

<script setup>
import { onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from './stores/auth'
import { useMessageStore } from './stores/messages'
import AppFooter from './components/AppFooter.vue'

const auth = useAuthStore()
const msgStore = useMessageStore()
const router = useRouter()

async function refreshUser() {
  if (!auth.isLoggedIn) return
  await auth.fetchProfile()
  await msgStore.fetchUnread()
}

onMounted(refreshUser)
watch(() => auth.isLoggedIn, refreshUser)

async function logout() {
  await auth.logout()
  router.push('/login')
}
</script>

<style scoped>
.app-shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-header {
  position: sticky;
  top: 0;
  z-index: 100;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--ch-border);
  box-shadow: var(--ch-shadow-sm);
}

.header-inner {
  max-width: 1100px;
  margin: 0 auto;
  padding: 0 1.25rem;
  height: var(--ch-header-h);
  display: flex;
  align-items: center;
  gap: 1.5rem;
}

.brand {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  text-decoration: none;
  color: inherit;
  flex-shrink: 0;
}

.brand:hover {
  color: inherit;
}

.brand-icon {
  font-size: 1.75rem;
  line-height: 1;
}

.brand-text {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
}

.brand-text strong {
  font-size: 1.1rem;
  font-weight: 800;
  color: var(--ch-primary);
  letter-spacing: -0.02em;
}

.brand-text small {
  font-size: 0.7rem;
  font-weight: 500;
  color: var(--ch-text-muted);
}

.main-nav {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  flex: 1;
}

.nav-link {
  padding: 0.45rem 0.85rem;
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--ch-text-secondary);
  text-decoration: none;
  border-radius: var(--ch-radius-sm);
  transition: background 0.15s ease, color 0.15s ease;
}

.nav-link:hover {
  color: var(--ch-text);
  background: var(--ch-bg);
}

.nav-link.router-link-active {
  color: var(--ch-primary-hover);
  background: var(--ch-primary-soft);
}

.nav-link-ai {
  color: #667eea !important;
}

.nav-link-ai.router-link-active {
  background: linear-gradient(135deg, #667eea15, #764ba215) !important;
  color: #4c51bf !important;
}

.nav-link-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.nav-badge {
  min-width: 1.25rem;
  height: 1.25rem;
  padding: 0 0.35rem;
  font-size: 0.7rem;
  font-weight: 700;
  line-height: 1.25rem;
  text-align: center;
  color: #fff;
  background: var(--ch-danger);
  border-radius: 999px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
}

.user-chip {
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--ch-text-secondary);
  padding: 0.35rem 0.65rem;
  background: var(--ch-bg);
  border-radius: 999px;
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.app-main {
  flex: 1;
}

@media (max-width: 768px) {
  .header-inner {
    flex-wrap: wrap;
    height: auto;
    padding: 0.75rem 1rem;
    gap: 0.75rem;
  }

  .main-nav {
    order: 3;
    width: 100%;
    overflow-x: auto;
    padding-bottom: 0.25rem;
  }

  .user-chip {
    display: none;
  }
}
</style>
