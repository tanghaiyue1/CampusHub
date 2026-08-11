<!-- @file frontend/src/views/OrderDetailView.vue — 订单详情、状态操作、评价与申诉 -->

<template>
  <div class="page-container">
    <div v-if="loading" class="loading-state"><span class="spinner" />加载中…</div>

    <template v-else-if="order">
      <header class="page-header">
        <div>
          <p class="order-no">{{ order.order_no }}</p>
          <h1>{{ order.requirement?.title || '订单详情' }}</h1>
          <div class="detail-badges" style="margin-top: 0.5rem">
            <span class="badge" :class="statusBadgeClass(order.status)">{{ statusLabel(order.status) }}</span>
            <span class="badge badge-muted">支付：{{ paymentLabel(order.payment_status) }}</span>
          </div>
        </div>
      </header>

      <div class="detail-grid">
        <div class="card card-padded">
          <dl class="info-list">
            <div class="info-row">
              <dt>发布者</dt>
              <dd>
                <router-link v-if="order.publisher?.id" :to="`/users/${order.publisher.id}`" class="user-link">
                  {{ order.publisher.nickname }}
                </router-link>
                <span v-else>{{ order.publisher?.nickname }}</span>
              </dd>
            </div>
            <div class="info-row">
              <dt>接单者</dt>
              <dd>
                <router-link v-if="order.acceptor?.id" :to="`/users/${order.acceptor.id}`" class="user-link">
                  {{ order.acceptor.nickname }}
                </router-link>
                <span v-else>{{ order.acceptor?.nickname }}</span>
              </dd>
            </div>
            <div v-if="order.completed_at" class="info-row">
              <dt>完成于</dt>
              <dd>{{ formatDate(order.completed_at) }}</dd>
            </div>
          </dl>

          <h3 class="section-title">状态流转</h3>
          <ul class="timeline">
            <li v-for="log in order.timeline" :key="log.id">
              {{ log.from_label }} → {{ log.to_label }}：{{ log.note }}
            </li>
          </ul>

          <div class="btn-group section">
            <button v-if="order.actions?.can_confirm" type="button" class="btn btn-primary" @click="confirm">
              确认接单
            </button>
            <button v-if="order.actions?.can_reject" type="button" class="btn btn-ghost" @click="reject">
              拒绝申请
            </button>
            <button v-if="order.actions?.can_start" type="button" class="btn btn-primary" @click="start">
              开始履约
            </button>
            <button v-if="order.actions?.can_mark_ready" type="button" class="btn btn-primary" @click="markReady">
              提交验收
            </button>
            <button v-if="order.actions?.can_complete" type="button" class="btn btn-primary" @click="complete">
              确认验收完成
            </button>
            <button v-if="order.actions?.can_cancel" type="button" class="btn btn-danger" @click="cancel">
              取消订单
            </button>
          </div>

          <p v-if="flowHint" class="form-hint section">{{ flowHint }}</p>
        </div>

        <div v-if="order.status === 'completed'" class="card card-padded">
          <h3 class="section-title">订单评价</h3>
          <p v-if="order.evaluation?.evaluation_deadline" class="form-hint">
            评价截止：{{ formatDate(order.evaluation.evaluation_deadline) }}
          </p>

          <div v-if="order.evaluation?.all_evaluations?.length" class="eval-list">
            <article
              v-for="ev in order.evaluation.all_evaluations"
              :key="ev.id"
              class="eval-block"
              :class="{ mine: isMyEvaluation(ev) }"
            >
              <div class="eval-head">
                <span class="eval-role">{{ evalRoleLabel(ev) }}</span>
                <span class="stars">{{ '★'.repeat(ev.rating) }}{{ '☆'.repeat(5 - ev.rating) }}</span>
              </div>
              <p class="eval-meta">
                {{ ev.is_anonymous && !isMyEvaluation(ev) ? '匿名用户' : ev.evaluator?.nickname }}
                <span v-if="ev.is_auto_default" class="badge badge-muted">系统默认</span>
              </p>
              <p class="eval-comment">{{ ev.comment || '无文字评价' }}</p>
              <button
                v-if="canAppeal(ev)"
                type="button"
                class="btn btn-ghost btn-sm"
                @click="appealEval(ev.id)"
              >
                申诉此评价
              </button>
            </article>
          </div>

          <form v-if="order.evaluation?.can_evaluate" class="eval-form" @submit.prevent="submitEval">
            <h4 class="sub-title">发表你的评价</h4>
            <div class="form-group">
              <label>星级 (1-5)</label>
              <div class="star-row">
                <button
                  v-for="n in 5"
                  :key="n"
                  type="button"
                  class="star-btn"
                  :class="{ active: evalForm.rating >= n }"
                  @click="evalForm.rating = n"
                >
                  ★
                </button>
              </div>
            </div>
            <div class="form-group">
              <label>评语</label>
              <textarea v-model="evalForm.comment" class="textarea" rows="3" placeholder="分享你的体验…" />
            </div>
            <label class="checkbox-row">
              <input v-model="evalForm.is_anonymous" type="checkbox" />
              匿名评价
            </label>
            <button type="submit" class="btn btn-primary btn-block" style="margin-top: 1rem">提交评价</button>
          </form>

          <p v-else-if="order.evaluation?.my_evaluation && !order.evaluation?.peer_evaluation" class="form-hint">
            你已评价，等待对方评价
          </p>
          <p v-else-if="!order.evaluation?.can_evaluate && !order.evaluation?.my_evaluation" class="form-hint">
            评价已关闭
          </p>
        </div>
      </div>
    </template>

    <div v-if="error" class="alert alert-error">{{ error }}</div>
    <router-link to="/orders" class="back-link">← 返回订单列表</router-link>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import client from '../api/client'
import { useAuthStore } from '../stores/auth'
import { useMessageStore } from '../stores/messages'
import { ORDER_STATUS_LABELS, paymentLabel } from '../utils/labels'

const route = useRoute()
const auth = useAuthStore()
const msgStore = useMessageStore()
const order = ref(null)
const loading = ref(true)
const error = ref('')
const evalForm = ref({ rating: 5, comment: '', is_anonymous: false })

const flowHint = computed(() => {
  const s = order.value?.status
  const a = order.value?.actions
  if (s === 'pending_confirm' && a?.can_confirm) return '你是发布者，请确认或拒绝接单申请'
  if (s === 'accepted' && a?.can_start) return '你是接单者，确认无误后点击「开始履约」'
  if (s === 'in_progress' && a?.can_mark_ready) return '你是接单者，完成任务后点击「提交验收」'
  if (s === 'ready_for_acceptance' && a?.can_complete) return '你是发布者，验收通过后点击「确认验收完成」'
  if (s === 'ready_for_acceptance') return '等待发布者验收确认'
  return ''
})

function statusLabel(s) {
  return ORDER_STATUS_LABELS[s] || s
}
function statusBadgeClass(s) {
  if (s === 'completed') return 'badge-success'
  if (s === 'cancelled' || s === 'rejected') return 'badge-danger'
  if (s === 'in_progress' || s === 'ready_for_acceptance') return 'badge-warning'
  return 'badge-primary'
}
function formatDate(t) {
  return t ? new Date(t).toLocaleString('zh-CN') : ''
}
function isMyEvaluation(ev) {
  return Number(ev.evaluator?.id) === Number(auth.user?.id)
}
function evalRoleLabel(ev) {
  return isMyEvaluation(ev) ? '我的评价' : '对方对我的评价'
}
function canAppeal(ev) {
  return (
    Number(ev.evaluatee?.id) === Number(auth.user?.id) &&
    ev.appeal_status === 'none' &&
    !isMyEvaluation(ev)
  )
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    await auth.fetchProfile()
    const res = await client.get(`/api/orders/${route.params.id}`)
    order.value = res.data
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

async function runAction(fn) {
  error.value = ''
  try {
    await fn()
    await msgStore.fetchUnread()
    await load()
  } catch (e) {
    error.value = e.message || '操作失败，请稍后重试'
  }
}

async function submitEval() {
  await runAction(async () => {
    await client.post('/api/evaluations', {
      order_id: Number(route.params.id),
      ...evalForm.value,
    })
  })
}

async function appealEval(evId) {
  const reason = prompt('请输入申诉理由')
  if (!reason) return
  await runAction(async () => {
    await client.post(`/api/evaluations/${evId}/appeal`, { reason })
  })
}

async function confirm() {
  await runAction(() => client.post(`/api/orders/${route.params.id}/confirm`))
}
async function reject() {
  await runAction(() => client.post(`/api/orders/${route.params.id}/reject`))
}
async function start() {
  await runAction(() => client.post(`/api/orders/${route.params.id}/start`))
}
async function markReady() {
  await runAction(() => client.post(`/api/orders/${route.params.id}/ready`))
}
async function complete() {
  await runAction(() => client.post(`/api/orders/${route.params.id}/complete`))
}
async function cancel() {
  if (!confirm('确定要取消此订单吗？')) return
  await runAction(() => client.post(`/api/orders/${route.params.id}/cancel`))
}

onMounted(load)
</script>

<style scoped>
.order-no {
  font-size: 0.85rem;
  color: var(--ch-text-muted);
  font-family: ui-monospace, monospace;
}
.detail-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.detail-grid {
  display: grid;
  gap: 1.25rem;
}
@media (min-width: 768px) {
  .detail-grid {
    grid-template-columns: 1fr 340px;
    align-items: start;
  }
}
.info-list {
  margin: 0 0 1rem;
}
.info-row {
  display: flex;
  gap: 1rem;
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--ch-border);
  font-size: 0.9rem;
}
.info-row dt {
  width: 4.5rem;
  color: var(--ch-text-muted);
}
.user-link {
  color: var(--ch-primary);
  text-decoration: none;
  font-weight: 500;
}
.user-link:hover {
  text-decoration: underline;
}
.star-row {
  display: flex;
  gap: 0.25rem;
}
.star-btn {
  font-size: 1.75rem;
  color: var(--ch-border-strong);
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  line-height: 1;
  transition: color 0.15s ease, transform 0.15s ease;
}
.star-btn.active,
.star-btn:hover {
  color: var(--ch-accent);
  transform: scale(1.1);
}
.eval-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1rem;
}
.eval-block {
  padding: 1rem;
  background: var(--ch-bg);
  border-radius: var(--ch-radius-sm);
  border-left: 3px solid var(--ch-border-strong);
}
.eval-block.mine {
  border-left-color: var(--ch-primary);
}
.eval-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.35rem;
}
.eval-role {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--ch-text-secondary);
}
.stars {
  color: var(--ch-accent);
  letter-spacing: 1px;
}
.eval-meta {
  font-size: 0.85rem;
  color: var(--ch-text-muted);
  margin: 0 0 0.35rem;
}
.eval-comment {
  margin: 0;
  line-height: 1.6;
}
.sub-title {
  font-size: 0.9rem;
  margin-bottom: 0.5rem;
}
.eval-form {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--ch-border);
}
.section {
  margin-top: 1rem;
}
</style>
