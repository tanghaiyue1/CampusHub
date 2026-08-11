<!-- @file frontend/src/views/VerificationView.vue — 学生实名认证提交页 -->

<template>
  <div class="page-container">
    <header class="page-header">
      <div>
        <h1>学生身份认证</h1>
        <p class="page-subtitle">认证通过后方可发布需求、申请接单</p>
      </div>
    </header>

    <div class="card card-padded" style="max-width: 480px">
      <div class="verify-steps">
        <div class="step">
          <span class="step-num">1</span>
          <p>上传学生证照片或填写图片链接</p>
        </div>
        <div class="step">
          <span class="step-num">2</span>
          <p>等待管理员审核（演示环境可由队友调用审核接口）</p>
        </div>
        <div class="step">
          <span class="step-num">3</span>
          <p>审核通过后即可使用完整功能</p>
        </div>
      </div>

      <form @submit.prevent="onSubmit">
        <div class="form-group">
          <label>学生证图片 URL</label>
          <input
            v-model="student_card_url"
            class="input"
            required
            placeholder="https://example.com/student-card.jpg"
          />
          <p class="form-hint">演示阶段可填写任意有效链接</p>
        </div>
        <div v-if="msg" class="alert alert-success">{{ msg }}</div>
        <div v-if="error" class="alert alert-error">{{ error }}</div>
        <button type="submit" class="btn btn-primary btn-block" :disabled="loading">
          {{ loading ? '提交中…' : '提交认证' }}
        </button>
      </form>

      <router-link to="/requirements" class="btn btn-secondary btn-block" style="margin-top: 0.75rem">
        返回需求广场
      </router-link>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import client from '../api/client'

const student_card_url = ref('https://example.com/student-card.jpg')
const loading = ref(false)
const error = ref('')
const msg = ref('')

async function onSubmit() {
  loading.value = true
  error.value = ''
  msg.value = ''
  try {
    const res = await client.post('/api/users/me/verification', {
      student_card_url: student_card_url.value,
    })
    msg.value = res.message || res.data?.message || '已提交，请等待审核'
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.verify-steps {
  margin-bottom: 1.5rem;
}
.step {
  display: flex;
  gap: 1rem;
  align-items: flex-start;
  padding: 0.75rem 0;
  border-bottom: 1px solid var(--ch-border);
  font-size: 0.9rem;
  color: var(--ch-text-secondary);
}
.step:last-child {
  border-bottom: none;
}
.step-num {
  flex-shrink: 0;
  width: 1.75rem;
  height: 1.75rem;
  display: grid;
  place-items: center;
  font-size: 0.85rem;
  font-weight: 700;
  color: #fff;
  background: var(--ch-primary);
  border-radius: 50%;
}
</style>
