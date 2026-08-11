/**
 * @file frontend/src/App.test.js
 * @description App 根组件单元测试
 */

import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import App from './App.vue'

vi.mock('./api/client', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ code: 200, data: { unread_count: 0 } }),
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
  },
}))

const mountOpts = {
  global: {
    stubs: {
      RouterView: true,
      RouterLink: { template: '<a><slot /></a>' },
    },
    plugins: [createPinia()],
  },
}

vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    useRouter: () => ({ push: vi.fn() }),
  }
})

describe('App.vue', () => {
  it('renders the app brand', () => {
    const wrapper = mount(App, mountOpts)
    expect(wrapper.text()).toContain('CampusHub')
  })

  it('shows login when not authenticated', () => {
    const wrapper = mount(App, mountOpts)
    expect(wrapper.text()).toMatch(/登录|注册/)
  })
})
