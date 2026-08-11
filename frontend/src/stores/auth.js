/**
 * @file frontend/src/stores/auth.js
 * @description Pinia：登录态、Token、用户资料
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import client from '../api/client'

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem('token') || '')
  const user = ref(null)

  const isLoggedIn = computed(() => Boolean(token.value))

  function setSession(newToken, newUser) {
    token.value = newToken
    user.value = newUser
    localStorage.setItem('token', newToken)
  }

  function clearSession() {
    token.value = ''
    user.value = null
    localStorage.removeItem('token')
  }

  async function login(payload) {
    const res = await client.post('/api/auth/login', payload)
    setSession(res.data.token, res.data.user)
    return res.data
  }

  async function register(payload) {
    const res = await client.post('/api/auth/register', payload)
    setSession(res.data.token, res.data.user)
    return res.data
  }

  async function fetchProfile() {
    if (!token.value) return null
    const res = await client.get('/api/users/me')
    user.value = res.data
    return res.data
  }

  async function logout() {
    clearSession()
  }

  return {
    token,
    user,
    isLoggedIn,
    login,
    register,
    fetchProfile,
    logout,
    setSession,
    clearSession,
  }
})
