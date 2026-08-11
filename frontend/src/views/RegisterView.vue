<!-- @file frontend/src/views/RegisterView.vue — 注册页 -->

<template>
  <div class="auth-layout">
    <div class="auth-panel">
      <div class="auth-brand">
        <h1>加入 CampusHub</h1>
        <p>注册后即可发布需求或接单互助</p>
      </div>

      <div class="card card-padded">
        <form @submit.prevent="onSubmit">
          <div class="form-group">
            <label>学号</label>
            <input v-model="student_id" class="input" required placeholder="你的学号" />
          </div>
          <div class="form-group">
            <label>邮箱（可选）</label>
            <input v-model="email" class="input" type="email" placeholder="campus@edu.cn" />
          </div>
          <div class="form-group">
            <label>手机号（可选）</label>
            <input v-model="phone" class="input" placeholder="11 位手机号" />
          </div>
          <div class="form-group">
            <label>密码（至少 6 位）</label>
            <input v-model="password" class="input" type="password" required minlength="6" />
          </div>
          <div v-if="error" class="alert alert-error">{{ error }}</div>
          <button type="submit" class="btn btn-primary btn-block" :disabled="loading">
            {{ loading ? '注册中…' : '注册' }}
          </button>
        </form>

        <p class="link-row">
          已有账号？
          <router-link to="/login">去登录</router-link>
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const auth = useAuthStore()
const student_id = ref('')
const email = ref('')
const phone = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')

async function onSubmit() {
  loading.value = true
  error.value = ''
  try {
    await auth.register({
      student_id: student_id.value,
      email: email.value || undefined,
      phone: phone.value || undefined,
      password: password.value,
      register_type: email.value ? 'email' : 'student_id',
    })
    router.push('/verification')
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
</script>
