/**
 * @file frontend/src/api/client.js
 * @description Axios 客户端：Token 注入、统一响应与错误处理
 */

import axios from 'axios'

const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000',
  timeout: 15000,
})

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

function buildError(body, fallback) {
  const err = new Error(body?.message || fallback)
  err.code = body?.code
  return err
}

client.interceptors.response.use(
  (res) => {
    const body = res.data
    if (body.code !== undefined && body.code !== 200) {
      const err = buildError(body, '请求失败')
      if (err.code === 4001) {
        window.dispatchEvent(new CustomEvent('auth:expired'))
      }
      return Promise.reject(err)
    }
    return body
  },
  (err) => {
    const body = err.response?.data
    const apiErr = buildError(body, err.message || '网络错误，请稍后重试')
    if (apiErr.code === 4001) {
      window.dispatchEvent(new CustomEvent('auth:expired'))
    }
    return Promise.reject(apiErr)
  },
)

export default client
