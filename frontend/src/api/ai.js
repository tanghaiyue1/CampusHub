/**
 * @file frontend/src/api/ai.js
 * @description AI 功能 API 客户端
 */

import client from "./client";

export function analyzeRequirement(title, description) {
  return client.post("/api/ai/analyze-requirement", { title, description });
}

export function aiChat(messages) {
  return client.post("/api/ai/chat", { messages });
}

export function getAiStatus() {
  return client.get("/api/ai/status");
}

export function unlockCredentials(masterPassword) {
  return client.post("/api/ai/credentials/unlock", { masterPassword });
}

export function lockCredentials() {
  return client.post("/api/ai/credentials/lock");
}
