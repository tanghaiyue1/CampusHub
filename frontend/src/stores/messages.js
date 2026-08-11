/**
 * @file frontend/src/stores/messages.js
 * @description Pinia：未读消息数
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'
import client from '../api/client'

export const useMessageStore = defineStore('messages', () => {
  const unreadCount = ref(0)

  async function fetchUnread() {
    if (!localStorage.getItem('token')) {
      unreadCount.value = 0
      return 0
    }
    try {
      const res = await client.get('/api/messages/unread/count')
      unreadCount.value = res.data.unread_count || 0
    } catch {
      unreadCount.value = 0
    }
    return unreadCount.value
  }

  return { unreadCount, fetchUnread }
})
