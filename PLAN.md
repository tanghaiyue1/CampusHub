# PLAN.md — CampusHub AI 实施计划

> 使用 Superpowers 方法论：Spec → Plan → Subagent Tasks → Review → Done

---

## 阶段 0：项目初始化（已完成）

- [x] 分析 CampusHub 现有代码库
- [x] 确定 AI 功能方向：需求分析 + 校园助手
- [x] 确定技术选型：OpenAI API + 多提供商支持

## 阶段 1：凭据安全系统（已完成）

- [x] 设计凭据威胁模型
- [x] 实现 AES-256-GCM 加密存储
- [x] 实现 PBKDF2 密钥派生
- [x] 实现凭据设置脚本
- [x] 实现解锁/锁定/状态查询 API
- [x] 编写凭据管理单元测试

## 阶段 2：AI 核心服务（已完成）

- [x] 实现 `aiService.analyzeRequirement()` — 需求分析
- [x] 实现 `aiService.chat()` — 校园助手对话
- [x] 实现多提供商支持（OpenAI / DeepSeek / 智谱）
- [x] 实现请求超时和错误处理
- [x] 编写 AI 服务单元测试（mock LLM）

## 阶段 3：AI 路由集成（已完成）

- [x] 创建 `routes/ai.js`
- [x] 集成到 `app.js`
- [x] 添加 JWT 鉴权保护
- [x] 添加 API 路由测试

## 阶段 4：前端 AI 界面（待完成）

- [ ] 添加 AI 助手聊天组件
- [ ] 在需求发布页面集成 AI 分析按钮
- [ ] 添加凭据管理设置页面
- [ ] 前端测试

## 阶段 5：Docker 分发（已完成）

- [x] 编写 `backend/Dockerfile`
- [x] 编写 `frontend/Dockerfile`
- [x] 编写 `frontend/nginx.conf`
- [x] 编写 `docker-compose.yml`
- [x] 在 README 中写明分发说明

## 阶段 6：CI/CD（已完成）

- [x] 编写 `.gitlab-ci.yml`
- [x] 配置 `unit-test` job（必须）
- [x] 配置 Docker 构建 job
- [x] 配置前端/后端分离测试

## 阶段 7：文档（已完成）

- [x] SPEC.md
- [x] PLAN.md（本文件）
- [x] SPEC_PROCESS.md
- [x] AGENT_LOG.md
- [x] REFLECTION.md
- [x] README.md 更新

## 阶段 8：云部署（待完成）

- [ ] 选择部署平台（Railway / Render）
- [ ] 配置环境变量
- [ ] 部署并验证
- [ ] 记录公网 URL

---

## Subagent 任务拆分

### Task 1: credential-manager（凭据管理模块）
- **技能**：coding
- **范围**：`backend/src/lib/credentialManager.js` + `scripts/setup-credentials.js`
- **完成标准**：加密存储、解锁/锁定、不暴露明文

### Task 2: ai-service（AI 服务模块）
- **技能**：coding
- **范围**：`backend/src/services/aiService.js`
- **完成标准**：需求分析、对话、多提供商、错误处理

### Task 3: ai-routes（AI 路由）
- **技能**：coding
- **范围**：`backend/src/routes/ai.js`
- **完成标准**：5 个 API 端点、JWT 鉴权

### Task 4: ai-tests（AI 测试）
- **技能**：tdd
- **范围**：`backend/tests/ai.test.js`
- **完成标准**：mock LLM、覆盖率 > 80%

### Task 5: docker-distribution（Docker 分发）
- **技能**：coding
- **范围**：Dockerfile × 2 + docker-compose.yml + nginx.conf
- **完成标准**：`docker-compose up` 一键启动

### Task 6: ci-cd（CI/CD 配置）
- **技能**：coding
- **范围**：`.gitlab-ci.yml`
- **完成标准**：unit-test job pass

### Task 7: frontend-ai（前端 AI 界面）
- **技能**：coding + open-design
- **范围**：`frontend/src/components/AiChat.vue` + 相关页面修改
- **完成标准**：AI 助手可对话、需求分析可触发

### Task 8: docs（文档撰写）
- **技能**：writing
- **范围**：SPEC.md / PLAN.md / SPEC_PROCESS.md / AGENT_LOG.md / REFLECTION.md
- **完成标准**：满足课程要求的所有章节
