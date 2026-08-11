<!--
  @file frontend/src/components/AiAnalysisPanel.vue
  @description AI 需求分析面板：发布需求时触发 AI 分析，推荐分类和定价
-->
<template>
  <div class="ai-analysis-panel">
    <button
      @click="analyze"
      :disabled="loading || !title || !description"
      class="analyze-btn"
    >
      <span v-if="loading">🤖 AI 分析中...</span>
      <span v-else>🤖 AI 智能分析</span>
    </button>

    <div v-if="error" class="error-msg">{{ error }}</div>

    <div v-if="result" class="result-card">
      <h4>AI 分析结果</h4>
      <div class="result-grid">
        <div class="result-item">
          <span class="label">推荐分类</span>
          <span class="value">{{ result.categoryLabel || result.category }}</span>
        </div>
        <div class="result-item">
          <span class="label">预估价格</span>
          <span class="value">¥{{ result.estimatedPrice }}</span>
        </div>
        <div class="result-item">
          <span class="label">风险等级</span>
          <span :class="['value', 'risk-' + result.riskLevel]">
            {{ riskLabel(result.riskLevel) }}
          </span>
        </div>
      </div>
      <div v-if="result.tags && result.tags.length > 0" class="result-tags">
        <span class="label">标签</span>
        <span v-for="tag in result.tags" :key="tag" class="tag">{{ tag }}</span>
      </div>
      <div v-if="result.suggestion" class="result-suggestion">
        <span class="label">建议</span>
        <p>{{ result.suggestion }}</p>
      </div>
      <button @click="applyResult" class="apply-btn">应用推荐</button>
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue";
import { analyzeRequirement } from "../api/ai";

const props = defineProps({
  title: { type: String, default: "" },
  description: { type: String, default: "" },
});

const emit = defineEmits(["apply"]);

const loading = ref(false);
const error = ref("");
const result = ref(null);

function riskLabel(level) {
  const map = { low: "低风险", medium: "中风险", high: "高风险" };
  return map[level] || level;
}

async function analyze() {
  if (!props.title || !props.description) return;
  loading.value = true;
  error.value = "";
  result.value = null;
  try {
    const res = await analyzeRequirement(props.title, props.description);
    result.value = res.data;
  } catch (err) {
    error.value = "AI 分析失败: " + (err.message || "请检查 API Key 配置");
  } finally {
    loading.value = false;
  }
}

function applyResult() {
  if (result.value) {
    emit("apply", result.value);
  }
}
</script>

<style scoped>
.ai-analysis-panel {
  margin-top: 16px;
}

.analyze-btn {
  padding: 10px 20px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  transition: opacity 0.2s;
}

.analyze-btn:hover:not(:disabled) {
  opacity: 0.9;
}

.analyze-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.error-msg {
  margin-top: 8px;
  color: #ff5630;
  font-size: 13px;
}

.result-card {
  margin-top: 12px;
  background: #f8f9ff;
  border: 1px solid #d6dbff;
  border-radius: 12px;
  padding: 16px;
}

.result-card h4 {
  font-size: 15px;
  margin-bottom: 12px;
  color: #4c51bf;
}

.result-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-bottom: 12px;
}

.result-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.label {
  font-size: 12px;
  color: #888;
}

.value {
  font-size: 14px;
  font-weight: 600;
}

.risk-low {
  color: #36b37e;
}

.risk-medium {
  color: #ffab00;
}

.risk-high {
  color: #ff5630;
}

.result-tags {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}

.tag {
  background: #e8eaff;
  color: #4c51bf;
  padding: 2px 10px;
  border-radius: 12px;
  font-size: 12px;
}

.result-suggestion {
  margin-bottom: 12px;
}

.result-suggestion p {
  margin-top: 4px;
  font-size: 13px;
  color: #555;
  line-height: 1.5;
}

.apply-btn {
  padding: 8px 16px;
  background: #4c51bf;
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
}

.apply-btn:hover {
  background: #3c40a6;
}
</style>
