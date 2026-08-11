<!--
  @file frontend/src/components/AiChat.vue
  @description 校园 AI 助手对话组件
-->
<template>
  <div class="ai-chat">
    <div class="chat-messages" ref="messagesContainer">
      <div v-if="messages.length === 0" class="chat-empty">
        <p>👋 你好！我是 CampusHub 的 AI 助手<strong>小C</strong>。</p>
        <p>我可以帮你：</p>
        <ul>
          <li>了解平台功能和使用方法</li>
          <li>搜索合适的需求</li>
          <li>解答使用问题</li>
        </ul>
        <div class="quick-questions">
          <button
            v-for="q in quickQuestions"
            :key="q"
            @click="sendQuick(q)"
            class="quick-btn"
          >
            {{ q }}
          </button>
        </div>
      </div>
      <div
        v-for="(msg, idx) in messages"
        :key="idx"
        :class="['message', msg.role]"
      >
        <div class="message-avatar">
          {{ msg.role === "user" ? "👤" : "🤖" }}
        </div>
        <div class="message-content">{{ msg.content }}</div>
      </div>
      <div v-if="loading" class="message assistant">
        <div class="message-avatar">🤖</div>
        <div class="message-content typing">
          <span></span><span></span><span></span>
        </div>
      </div>
    </div>
    <div class="chat-input">
      <input
        v-model="input"
        @keyup.enter="send"
        placeholder="输入消息..."
        :disabled="loading"
        type="text"
      />
      <button @click="send" :disabled="loading || !input.trim()">发送</button>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick, onMounted } from "vue";
import { aiChat } from "../api/ai";

const messages = ref([]);
const input = ref("");
const loading = ref(false);
const messagesContainer = ref(null);

const quickQuestions = [
  "怎么发布需求？",
  "如何接单？",
  "什么是信用积分？",
  "有什么快递代取的需求？",
];

function scrollToBottom() {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
    }
  });
}

async function send() {
  const text = input.value.trim();
  if (!text || loading.value) return;

  messages.value.push({ role: "user", content: text });
  input.value = "";
  scrollToBottom();

  loading.value = true;
  try {
    const chatMessages = messages.value.map((m) => ({
      role: m.role,
      content: m.content,
    }));
    const res = await aiChat(chatMessages);
    messages.value.push({ role: "assistant", content: res.data.reply });
  } catch (err) {
    messages.value.push({
      role: "assistant",
      content: "抱歉，AI 服务暂时不可用。请检查 API Key 配置。",
    });
  } finally {
    loading.value = false;
    scrollToBottom();
  }
}

function sendQuick(question) {
  input.value = question;
  send();
}
</script>

<style scoped>
.ai-chat {
  display: flex;
  flex-direction: column;
  height: 100%;
  max-height: 500px;
  border: 1px solid #e0e0e0;
  border-radius: 12px;
  overflow: hidden;
  background: #fff;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.chat-empty {
  text-align: center;
  color: #666;
  padding: 20px;
}

.chat-empty ul {
  text-align: left;
  display: inline-block;
  margin: 8px 0;
}

.quick-questions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
  margin-top: 12px;
}

.quick-btn {
  background: #f0f7ff;
  border: 1px solid #b3d4ff;
  border-radius: 16px;
  padding: 6px 14px;
  font-size: 13px;
  cursor: pointer;
  color: #0052cc;
  transition: all 0.2s;
}

.quick-btn:hover {
  background: #d6ebff;
  border-color: #80b3ff;
}

.message {
  display: flex;
  gap: 8px;
  max-width: 85%;
}

.message.user {
  align-self: flex-end;
  flex-direction: row-reverse;
}

.message.assistant {
  align-self: flex-start;
}

.message-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  flex-shrink: 0;
  background: #f5f5f5;
}

.message-content {
  padding: 10px 14px;
  border-radius: 12px;
  font-size: 14px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}

.message.user .message-content {
  background: #0052cc;
  color: #fff;
  border-bottom-right-radius: 4px;
}

.message.assistant .message-content {
  background: #f5f5f5;
  color: #333;
  border-bottom-left-radius: 4px;
}

.typing {
  display: flex;
  gap: 4px;
  align-items: center;
  padding: 14px 18px;
}

.typing span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #999;
  animation: typing 1.4s infinite;
}

.typing span:nth-child(2) {
  animation-delay: 0.2s;
}

.typing span:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes typing {
  0%,
  60%,
  100% {
    opacity: 0.3;
    transform: scale(0.8);
  }
  30% {
    opacity: 1;
    transform: scale(1);
  }
}

.chat-input {
  display: flex;
  padding: 12px;
  border-top: 1px solid #e0e0e0;
  gap: 8px;
}

.chat-input input {
  flex: 1;
  padding: 10px 14px;
  border: 1px solid #ddd;
  border-radius: 20px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
}

.chat-input input:focus {
  border-color: #0052cc;
}

.chat-input button {
  padding: 10px 20px;
  background: #0052cc;
  color: #fff;
  border: none;
  border-radius: 20px;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s;
}

.chat-input button:hover:not(:disabled) {
  background: #003d99;
}

.chat-input button:disabled {
  background: #ccc;
  cursor: not-allowed;
}
</style>
