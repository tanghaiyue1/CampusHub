<!-- @file frontend/src/views/LoginView.vue — 登录页 -->

<template>
  <div class="auth-layout">
    <div class="auth-panel">
      <div class="auth-brand">
        <h1>CampusHub</h1>
        <p>登录你的校园互助账号</p>
      </div>

      <div class="card card-padded">
        <form @submit.prevent="onSubmit">
          <div class="form-group">
            <label>学号 / 邮箱</label>
            <input v-model="identifier" class="input" required placeholder="2021001001" />
          </div>
          <div class="form-group">
            <label>密码</label>
            <input v-model="credential" class="input" type="password" required placeholder="请输入密码" />
          </div>
          <div v-if="error" class="alert alert-error">{{ error }}</div>
          <button type="submit" class="btn btn-primary btn-block" :disabled="loading">
            {{ loading ? '登录中…' : '登录' }}
          </button>
        </form>

        <p class="link-row">
          还没有账号？
          <router-link to="/register">立即注册</router-link>
        </p>
      </div>

      <div class="card card-padded" style="margin-top: 1rem; background: var(--ch-primary-muted)">
        <p class="form-hint" style="margin: 0; color: var(--ch-text-secondary)">
          <strong>演示账号</strong>：2021001001 / demo123456<br />需先启动后端服务
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const identifier = ref('2021001001')
const credential = ref('demo123456')
const loading = ref(false)
const error = ref('')

async function onSubmit() {
  loading.value = true
  error.value = ''
  try {
    await auth.login({
      login_type: 'password',
      identifier: identifier.value,
      credential: credential.value,
    })
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/requirements'
    router.push(redirect)
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
</script>
