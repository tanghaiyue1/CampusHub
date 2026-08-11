<!-- @file frontend/src/views/RequirementCreateView.vue — 发布新需求表单 -->

<template>
  <div class="page-container">
    <header class="page-header">
      <div>
        <h1>发布需求</h1>
        <p class="page-subtitle">描述你的互助需求，等待同学接单</p>
      </div>
    </header>

    <div class="card card-padded" style="max-width: 560px">
      <form @submit.prevent="onSubmit">
        <div class="form-group">
          <label>标题</label>
          <input v-model="form.title" class="input" required placeholder="简要说明需要什么帮助" />
        </div>
        <div class="form-group">
          <label>类型</label>
          <select v-model="form.category" class="select" required>
            <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.label }}</option>
          </select>
        </div>
        <div class="form-group">
          <label>详细描述</label>
          <textarea v-model="form.description" class="textarea" placeholder="时间、地点、具体要求等" />
        </div>
        <div class="form-group">
          <label>地点</label>
          <input v-model="form.location" class="input" placeholder="如：南园菜鸟驿站" />
        </div>
        <div class="form-row">
          <div class="form-group" style="flex: 1">
            <label>报酬形式</label>
            <select v-model="form.reward_type" class="select">
              <option value="cash">现金</option>
              <option value="points">积分</option>
              <option value="free">无偿</option>
            </select>
          </div>
          <div v-if="form.reward_type !== 'free'" class="form-group" style="flex: 1">
            <label>金额 / 积分</label>
            <input v-model.number="form.reward_amount" class="input" type="number" min="0.01" step="0.01" />
          </div>
        </div>
        <div class="form-group">
          <label>截止时间</label>
          <input v-model="form.deadline" class="input" type="datetime-local" required />
        </div>
        <label class="checkbox-row">
          <input v-model="form.is_anonymous" type="checkbox" />
          匿名发布（列表中隐藏真实身份）
        </label>
        <div class="form-group" style="margin-top: 1rem">
          <label>图片 URL（可选）</label>
          <input v-model="form.image_url" class="input" placeholder="https://..." />
        </div>
        <div v-if="!verified" class="alert alert-error">
          发布需求需先完成
          <router-link to="/verification">学生认证</router-link>
        </div>
        <div v-if="error" class="alert alert-error">{{ error }}</div>
        <div class="btn-group" style="margin-top: 1.25rem">
          <button type="submit" class="btn btn-primary" :disabled="loading || !verified">
            {{ loading ? '发布中…' : '发布需求' }}
          </button>
          <router-link to="/requirements" class="btn btn-secondary">取消</router-link>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import client from '../api/client'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const auth = useAuthStore()
const categories = ref([])
const loading = ref(false)
const error = ref('')
const verified = computed(() => Boolean(auth.user?.is_verified))
const form = ref({
  title: '',
  category: 'express',
  description: '',
  location: '',
  reward_type: 'cash',
  reward_amount: 5,
  is_anonymous: false,
  deadline: '',
  image_url: '',
})

onMounted(async () => {
  await auth.fetchProfile()
  const meta = await client.get('/api/requirements/meta/categories')
  categories.value = meta.data.categories || []
  if (categories.value.length) form.value.category = categories.value[0].id
})

async function onSubmit() {
  loading.value = true
  error.value = ''
  try {
    const deadline = new Date(form.value.deadline).toISOString()
    const res = await client.post('/api/requirements', {
      ...form.value,
      deadline,
      is_anonymous: Boolean(form.value.is_anonymous),
    })
    router.push(`/requirements/${res.data.requirement_id || res.data.id}`)
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.form-row {
  display: flex;
  gap: 1rem;
}
</style>
