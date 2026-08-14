# CampusHub AI — 智能校园互助服务平台

> AI4SE 期末项目 · B 类 · 非 harness 应用类项目
> 基于 CampusHub 改造，集成 AI 需求分析和校园助手

---

## 项目简介

CampusHub AI 是一个面向高校学生的智能校园互助服务平台。学生可以在平台上发布需求（快递代取、学习辅导、二手交易等），其他用户接单完成任务。平台集成了 AI 功能：

- **AI 需求分析**：发布需求时，AI 自动分析描述，推荐分类、预估价格和标签
- **校园 AI 助手**：对话式助手，帮助用户了解平台、搜索需求和解答问题

## 为什么有人会用

- 不再需要在微信群刷屏找人帮忙，AI 自动分析需求并推荐合适的分类和定价
- 通过分类筛选和 AI 推荐快速找到适合自己的任务
- 覆盖快递代取、失物招领、跑腿代办等高校刚需场景

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | Vue 3 + Vite + Pinia + Vue Router |
| 后端 | Node.js 22 + Express 5 |
| 数据库 | MySQL 8.0 / 内存存储 |
| AI | OpenAI GPT-4.1-mini / DeepSeek / 智谱 GLM-4 |
| 测试 | Vitest + Supertest |
| 分发 | Docker + Docker Compose |
| CI/CD | GitHub Actions |

## 快速启动

### 环境要求

- **Node.js** >= 22
- **Docker** >= 20（如使用容器方式）
- **MySQL** >= 8.0（如不使用内存存储）

### 方式一：Docker Compose（推荐）

```bash
# 克隆项目
git clone <repo-url>
cd CampusHub-AI

# 一键启动
docker-compose up -d

# 访问
# 前端：http://localhost
# 后端：http://localhost:3000
```

### 方式二：本地开发

```bash
# 1. 初始化数据库
mysql -u root -p < backend/db/init.sql

# 2. 配置环境变量
cp backend/.env.example backend/.env
# 编辑 backend/.env，填写数据库连接信息

# 3. 安装依赖
cd backend && npm install
cd ../frontend && npm install

# 4. 启动开发服务器
cd backend && npm run dev    # 端口 3000
cd frontend && npm run dev   # 端口 5173
```

## API Key 安全配置

> ⚠️ API Key 绝不硬编码、绝不提交到 Git

### 方式一：加密存储（推荐）

```bash
cd backend
node scripts/setup-credentials.js
# 按提示选择提供商、输入 API Key、设置主密码
```

启动后通过 API 解锁：
```bash
curl -X POST http://localhost:3000/api/ai/credentials/unlock \
  -H "Authorization: Bearer <your-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{"masterPassword": "your-master-password"}'
```

### 方式二：环境变量（不推荐，明文风险）

```bash
export OPENAI_API_KEY="sk-..."
# 或设置 DEEPSEEK_API_KEY / ZHIPU_API_KEY
```

## 运行测试

```bash
# 后端测试
cd backend && npm test

# 后端测试 + 覆盖率
cd backend && npm run test:coverage

# 前端测试
cd frontend && npm test

# 一键运行全部测试
cd backend && npm test && cd ../frontend && npm test
```

## 项目结构

```
CampusHub-AI/
├── backend/                    # 后端 (Express 5)
│   ├── src/
│   │   ├── routes/             # API 路由（含 ai.js）
│   │   ├── services/           # 业务逻辑（含 aiService.js）
│   │   ├── lib/                # 工具库（含 credentialManager.js）
│   │   ├── middleware/         # 中间件（auth, errorHandler）
│   │   ├── db/                 # 数据库层（MySQL + 内存）
│   │   └── config.js           # 配置
│   ├── scripts/
│   │   └── setup-credentials.js # 凭据设置脚本
│   ├── tests/                  # 测试文件
│   ├── Dockerfile
│   └── package.json
├── frontend/                   # 前端 (Vue 3 + Vite)
│   ├── src/
│   │   ├── components/         # 组件
│   │   ├── views/              # 页面
│   │   ├── router/             # 路由
│   │   ├── stores/             # 状态管理
│   │   └── api/                # API 客户端
│   ├── Dockerfile
│   ├── nginx.conf
│   └── package.json
├── docker-compose.yml
├── .github/workflows/ci.yml    # GitHub Actions CI/CD 配置
├── SPEC.md                     # 项目规约
├── PLAN.md                     # 实施计划
├── SPEC_PROCESS.md             # 规约过程
├── AGENT_LOG.md                # 智能体协作日志
├── REFLECTION.md               # 反思报告
└── README.md                   # 本文件
```

## CI/CD

GitHub Actions 配置（`.github/workflows/ci.yml`）包含以下 job：

| Job | 说明 |
|-----|------|
| `unit-test` | 前后端单元测试（必须） |
| `backend-test` | 后端 lint + test |
| `frontend-test` | 前端 lint + test |
| `docker-build` | 构建 Docker 镜像 |

## 安全边界

- **凭据安全**：API Key 使用 AES-256-GCM 加密存储，绝不硬编码或提交到 Git
- **认证**：JWT 鉴权，7 天过期
- **密码**：bcrypt 哈希存储
- **日志**：不记录任何明文凭据
- **传输**：生产环境强制 HTTPS
- **已知风险**：环境变量 fallback 方式为明文存储；Node.js 进程内存中的凭据无法完全清除

## 功能模块

| 模块 | 职责 | 状态 |
|------|------|------|
| 用户认证 | 注册、登录、JWT 鉴权 | ✅ |
| 需求管理 | 发布/编辑/取消需求，AI 分析 | ✅ + AI |
| 订单管理 | 接单、状态流转、验收 | ✅ |
| 支付系统 | 信用积分支付 | ✅ |
| 评价系统 | 双向评价、信用计算 | ✅ |
| 消息系统 | 站内消息通知 | ✅ |
| AI 需求分析 | LLM 分析需求，推荐分类/定价 | ✅ |
| 校园 AI 助手 | 对话式 AI 助手 | ✅ |
| 凭据管理 | API Key 安全存储 | ✅ |

## 分发

### Docker 容器

```bash
# 构建
docker build -t campushub-ai-backend -f backend/Dockerfile .
docker build -t campushub-ai-frontend -f frontend/Dockerfile .

# 运行
docker run -d -p 3000:3000 --name campushub-backend campushub-ai-backend
docker run -d -p 80:80 --name campushub-frontend campushub-ai-frontend

# 或使用 docker-compose
docker-compose up -d
```

### 已知限制

- 内存数据库模式仅用于开发/测试，生产需配置 MySQL
- Docker 镜像基于 Alpine Linux，x86_64 架构
- 凭据存储在容器内，重启后需重新解锁

## 第三方代码

- Express 5 (MIT)
- Vue 3 (MIT)
- Vite (MIT)
- Vitest (MIT)
- bcryptjs (MIT)
- jsonwebtoken (MIT)
- dotenv (BSD-2-Clause)

## 许可证

本项目仅供 AI4SE 课程学习使用。
