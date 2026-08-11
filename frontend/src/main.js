/**
 * @file frontend/src/main.js
 * @description Vue 应用入口：Pinia、Router、挂载根组件
 */

import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import { useAuthStore } from './stores/auth'

const app = createApp(App)

app.use(createPinia())
app.use(router)

window.addEventListener('auth:expired', () => {
  const auth = useAuthStore()
  auth.clearSession()
  const redirect = router.currentRoute.value.fullPath
  if (router.currentRoute.value.name !== 'login') {
    router.push({ name: 'login', query: { redirect } })
  }
})

app.mount('#app')
