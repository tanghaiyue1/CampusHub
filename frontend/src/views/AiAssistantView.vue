<!--
  @file frontend/src/views/AiAssistantView.vue
  @description 校园 AI 助手页面
-->
<template>
  <div class="ai-assistant-page">
    <div class="page-header">
      <h1>🤖 校园 AI 助手</h1>
      <p>我是小C，你的校园互助智能助手。有什么可以帮你的？</p>
    </div>

    <div class="content-grid">
      <div class="chat-section">
        <h2>💬 对话</h2>
        <AiChat />
      </div>

      <div class="info-section">
        <div class="credential-status">
          <h2>🔑 凭据状态</h2>
          <div v-if="statusLoading">加载中...</div>
          <div v-else-if="aiStatus" class="status-list">
            <div
              v-for="(info, provider) in aiStatus.providers"
              :key="provider"
              class="status-item"
            >
              <span :class="['dot', info.configured ? 'green' : 'red']"></span>
              <span class="provider-name">{{ provider }}</span>
              <span class="source">{{ info.source === "encrypted" ? "加密存储" : info.source === "env" ? "环境变量" : "未配置" }}</span>
            </div>
            <div class="status-item">
              <span :class="['dot', aiStatus.unlocked ? 'green' : 'yellow']"></span>
              <span>凭据状态</span>
              <span>{{ aiStatus.unlocked ? "已解锁" : "已锁定" }}</span>
            </div>
          </div>
          <div v-else class="status-error">无法获取凭据状态</div>

          <div class="credential-actions">
            <button @click="showUnlock = !showUnlock" class="btn-secondary">
              {{ showUnlock ? "取消" : "解锁凭据" }}
            </button>
            <button @click="handleLock" class="btn-secondary">锁定凭据</button>
          </div>

          <div v-if="showUnlock" class="unlock-form">
            <input
              v-model="masterPassword"
              type="password"
              placeholder="输入主密码"
              class="form-input"
            />
            <button @click="handleUnlock" class="btn-primary">解锁</button>
          </div>
        </div>

        <div class="tips-section">
          <h2>💡 使用提示</h2>
          <ul>
            <li>发布需求时可以使用 AI 分析功能，获取智能推荐</li>
            <li>AI 助手可以帮你搜索合适的需求</li>
            <li>API Key 需要先解锁凭据才能使用</li>
            <li>首次使用请运行 <code>node scripts/setup-credentials.js</code></li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import AiChat from "../components/AiChat.vue";
import { getAiStatus, unlockCredentials, lockCredentials } from "../api/ai";

const aiStatus = ref(null);
const statusLoading = ref(false);
const showUnlock = ref(false);
const masterPassword = ref("");

async function fetchStatus() {
  statusLoading.value = true;
  try {
    const res = await getAiStatus();
    aiStatus.value = res.data;
  } catch {
    aiStatus.value = null;
  } finally {
    statusLoading.value = false;
  }
}

async function handleUnlock() {
  try {
    await unlockCredentials(masterPassword.value);
    masterPassword.value = "";
    showUnlock.value = false;
    await fetchStatus();
  } catch (err) {
    alert("解锁失败: " + err.message);
  }
}

async function handleLock() {
  try {
    await lockCredentials();
    await fetchStatus();
  } catch (err) {
    alert("锁定失败: " + err.message);
  }
}

onMounted(fetchStatus);
</script>

<style scoped>
.ai-assistant-page {
  max-width: 1000px;
  margin: 0 auto;
  padding: 24px;
}

.page-header {
  margin-bottom: 24px;
}

.page-header h1 {
  font-size: 24px;
  margin-bottom: 8px;
  color: var(--ch-text);
}

.page-header p {
  color: var(--ch-text-secondary);
}

.content-grid {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 24px;
}

.chat-section h2,
.info-section h2 {
  font-size: 16px;
  margin-bottom: 12px;
  color: var(--ch-text);
}

.info-section {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.credential-status {
  background: var(--ch-surface);
  border: 1px solid var(--ch-border);
  border-radius: var(--ch-radius);
  padding: 16px;
  box-shadow: var(--ch-shadow-sm);
}

.status-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.dot.green {
  background: var(--ch-success);
}

.dot.red {
  background: var(--ch-danger);
}

.dot.yellow {
  background: var(--ch-accent);
}

.provider-name {
  font-weight: 600;
  min-width: 60px;
}

.source {
  color: var(--ch-text-secondary);
  margin-left: auto;
}

.credential-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.unlock-form {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.form-input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid var(--ch-border);
  border-radius: var(--ch-radius-sm);
  font-size: 13px;
  transition: border-color 0.2s ease;
}

.form-input:focus {
  outline: none;
  border-color: var(--ch-primary);
}

.btn-primary {
  padding: 8px 16px;
  background: var(--ch-primary);
  color: #fff;
  border: none;
  border-radius: var(--ch-radius-sm);
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  transition: background 0.2s ease;
}

.btn-primary:hover {
  background: var(--ch-primary-hover);
}

.btn-secondary {
  padding: 8px 16px;
  background: var(--ch-surface);
  border: 1px solid var(--ch-border);
  border-radius: var(--ch-radius-sm);
  cursor: pointer;
  font-size: 13px;
  color: var(--ch-text-secondary);
  transition: background 0.2s ease, border-color 0.2s ease;
}

.btn-secondary:hover {
  background: var(--ch-bg);
  border-color: var(--ch-border-strong);
}

.tips-section {
  background: var(--ch-surface);
  border: 1px solid var(--ch-border);
  border-radius: var(--ch-radius);
  padding: 16px;
  box-shadow: var(--ch-shadow-sm);
}

.tips-section ul {
  padding-left: 18px;
  font-size: 13px;
  color: var(--ch-text-secondary);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.tips-section code {
  background: var(--ch-bg);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 12px;
  color: var(--ch-primary-hover);
}

@media (max-width: 768px) {
  .content-grid {
    grid-template-columns: 1fr;
  }
}
</style>
