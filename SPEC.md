# SPEC.md — CampusHub AI 项目规约

> **项目名称**：CampusHub AI — 智能校园互助服务平台
> **项目类型**：B · 非 harness 应用类项目
> **技术栈**：Node.js 22 + Express 5 + Vue 3 + MySQL 8.0 + LLM API
> **创建日期**：2026-08-10

---

## 1. 项目概述

### 1.1 一句话描述

CampusHub AI 是一个面向高校学生的智能校园互助服务平台，用户可以在平台上发布需求（快递代取、学习辅导、二手交易等），其他用户接单完成任务，并通过 AI 助手获得智能化的需求分析和平台引导。

### 1.2 为什么有人会用

- **发布需求的学生**：不再需要在微信群刷屏找人帮忙，AI 自动分析需求并推荐合适的分类和定价，提升需求被接单的效率
- **接单的学生**：可以通过分类筛选和 AI 推荐快速找到适合自己的任务，赚取信用积分
- **校园场景的真实痛点**：快递代取、失物招领、跑腿代办等是高校刚需，现有解决方案（微信群、QQ群）信息杂乱、效率低下

### 1.3 核心功能模块

| 模块 | 职责 |
|------|------|
| 用户认证 | 注册、登录、JWT 鉴权、学分系统 |
| 需求发布 | 发布/编辑/取消需求，AI 智能分析推荐  |
| 订单管理 | 接单、状态流转、验收 |
| 支付系统 | 信用积分支付 |
| 评价系统 | 双向评价、信用计算 |
| 消息系统 | 站内消息通知|
| **AI 需求分析** | **LLM 自动分析需求描述，推荐分类/定价/标签** |
| **校园 AI 助手** | **对话式 AI 助手，帮助用户了解平台、搜索需求** |
| 凭据管理 | AI API Key 安全存储（AES-256-GCM 加密）|

---

## 2. 技术选型

### 2.1 选型理由

| 层级 | 技术 | 选型理由 |
|------|------|----------|
| 后端 | Node.js 22 + Express 5 | 原 CampusHub 项目技术栈，熟悉；Express 5 原生支持 async/await |
| 前端 | Vue 3 + Vite + Pinia | 响应式 UI 框架，适合中小型 SPA；Vite 构建速度快 |
| 数据库 | MySQL 8.0 + 内存存储 | 生产用 MySQL，开发/测试用内存存储减少环境依赖 |
| AI | OpenAI GPT-4.1-mini / DeepSeek / 智谱 GLM-4 | 支持多提供商切换，gpt-4.1-mini 性价比高 |
| 测试 | Vitest + Supertest | 与 Vite 生态一致，运行速度快 |
| 分发 | Docker + Docker Compose | 一键构建、一键运行，环境一致性 |
| CI/CD | GitHub Actions | GitHub 平台要求 |

### 2.2 语言选型：JavaScript (Node.js)

选择 JavaScript 而非 TypeScript/Go/Rust 的理由：
- 原项目 CampusHub 已用 JS 实现，复用成本低
- Express 5 生态成熟，中间件丰富
- 本次 AI4SE 项目的核心挑战在于 AI 集成和工程化，而非语言特性

---

## 3. 安全设计

### 3.1 凭据威胁模型

| 威胁 | 对策 |
|------|------|
| API Key 硬编码泄漏到 Git | `.gitignore` 排除凭据文件，`.env.example` 仅含模板 |
| 攻击者获得文件系统访问 | AES-256-GCM 加密存储，主密码 + PBKDF2 派生密钥 |
| 攻击者读取进程内存 | 使用后立即 zeroBuffer 清除；Node.js 限制下尽力而为 |
| 攻击者读取日志 | 明文绝不输出到日志，仅记录 token 用量 |
| `.env` 明文风险 | 仅作 fallback 引导，启动时警告用户 |
| 中间人攻击 | HTTPS 传输（生产环境强制） |

### 3.2 凭据存储方案

```
主密码 → PBKDF2(600000 迭代) → AES-256-GCM 密钥
                                    ↓
API Key → 加密 → ~/.campushub/credentials.enc
```

- 首次运行：`node scripts/setup-credentials.js` 引导录入
- 运行时：POST `/api/ai/credentials/unlock` 解锁
- 查看状态：GET `/api/ai/status`（不暴露明文）
- 锁定：POST `/api/ai/credentials/lock`

---

## 4. API 设计

### 4.1 AI 相关接口

| 方法 | 路径 | 说明 | 鉴权 |
|------|------|------|------|
| POST | `/api/ai/analyze-requirement` | AI 分析需求 | JWT |
| POST | `/api/ai/chat` | 校园 AI 助手对话 | JWT |
| GET | `/api/ai/status` | 凭据状态 | JWT |
| POST | `/api/ai/credentials/unlock` | 解锁凭据 | JWT |
| POST | `/api/ai/credentials/lock` | 锁定凭据 | JWT |

### 4.2 已有接口（保持不变）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/register` | 注册 |
| POST | `/api/auth/login` | 登录 |
| CRUD | `/api/requirements` | 需求管理 |
| CRUD | `/api/orders` | 订单管理 |
| CRUD | `/api/payments` | 支付管理 |
| CRUD | `/api/evaluations` | 评价管理 |
| CRUD | `/api/messages` | 消息管理 |
| CRUD | `/api/users` | 用户管理 |

---

## 5. 分发方案

### 5.1 Docker 容器分发

```bash
# 构建
docker build -t campushub-ai-backend -f backend/Dockerfile .
docker build -t campushub-ai-frontend -f frontend/Dockerfile .

# 或使用 docker-compose 一键启动
docker-compose up -d

# 访问
# 前端：http://localhost
# 后端：http://localhost:3000
```

### 5.2 Key 安全配置

```bash
# 进入容器
docker exec -it campushub-ai-backend sh

# 运行凭据设置脚本
node scripts/setup-credentials.js

# 或通过 API 设置（启动后）
curl -X POST http://localhost:3000/api/ai/credentials/unlock \
  -H "Authorization: Bearer <jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{"masterPassword": "your-password"}'
```

### 5.3 已知限制

- 内存数据库模式仅用于开发/测试，生产需配置 MySQL
- Docker 镜像基于 Alpine Linux，x86_64 架构
- 凭据存储在容器内，重启后需重新解锁
- Node.js 24 特定语法（如 `require.main === module`）已兼容

---

## 6. 测试策略

- **单元测试**：Vitest 覆盖所有 service 层，AI 模块使用 mock fetch
- **集成测试**：Supertest 测试 API 路由
- **CI 自动化**：GitHub Actions 每次 push 运行 lint + test
- **测试命令**：`cd backend && npm test` / `cd frontend && npm test`

---

## 7. 项目结构

```
CampusHub-AI/
├── backend/
│   ├── src/
│   │   ├── routes/        # API 路由（含 ai.js）
│   │   ├── services/      # 业务逻辑（含 aiService.js）
│   │   ├── lib/           # 工具库（含 credentialManager.js）
│   │   ├── middleware/    # 中间件
│   │   ├── db/            # 数据库层
│   │   └── config.js
│   ├── scripts/
│   │   └── setup-credentials.js  # 凭据设置脚本
│   ├── tests/
│   │   └── ai.test.js     # AI 模块测试
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── views/         # 页面
│   │   ├── components/    # 组件
│   │   └── ...
│   ├── Dockerfile
│   ├── nginx.conf
│   └── package.json
├── docker-compose.yml
├── .github/workflows/ci.yml
├── SPEC.md               # 本文件
├── PLAN.md               # 实施计划
├── SPEC_PROCESS.md       # 规约过程
├── AGENT_LOG.md          # 智能体协作日志
├── REFLECTION.md         # 反思报告
└── README.md
```
