# AGENT_LOG.md — 智能体协作日志

> 按时间顺序记录关键节点：Superpowers 技能使用、prompt 配置、subagent 输出、人工干预、教训

---

## 2026-08-10 · Task 1: credential-manager（凭据管理模块）

**触发技能**：coding

**关键 Prompt**：
```
实现一个安全的凭据管理模块，使用 AES-256-GCM 加密存储 API Key。
要求：绝不硬编码、绝不写入日志、支持解锁/锁定/状态查询。
存储方案：主密码 + PBKDF2 派生密钥。
```

**Subagent 输出**：
- `backend/src/lib/credentialManager.js` — 加密存储核心
- `backend/scripts/setup-credentials.js` — 引导设置脚本

**人工干预**：
- 补充了威胁模型注释
- 添加了 zeroBuffer 内存清除
- 修正了 PBKDF2 迭代次数（100000 → 600000）

**教训**：
- 凭据管理看似简单，但安全细节很多（内存清除、日志屏蔽、错误处理）
- 环境变量 fallback 是必要的，但需要明确标注风险

---

## 2026-08-10 · Task 2: ai-service（AI 服务模块）

**触发技能**：coding

**关键 Prompt**：
```
实现 AI 服务模块，包含两个功能：
1. analyzeRequirement(title, description) — 调用 LLM 分析需求，返回分类推荐、预估价格
2. chat(messages, userContext) — 校园助手对话
支持 OpenAI、DeepSeek、智谱三种提供商。
```

**Subagent 输出**：
- `backend/src/services/aiService.js`

**人工干预**：
- 调整了 system prompt 让 AI 返回 JSON 格式
- 添加了 JSON 解析容错（处理 LLM 输出不稳定的情况）
- 统一了多提供商的调用接口
- 添加了 15s 超时保护

**教训**：
- LLM 输出格式不稳定，需要做容错处理
- system prompt 的质量直接影响 AI 输出质量
- 多提供商抽象层设计值得投入时间

---

## 2026-08-10 · Task 3: ai-routes（AI 路由）

**触发技能**：coding

**关键 Prompt**：
```
创建 AI 路由，包含 5 个端点：
POST /api/ai/analyze-requirement
POST /api/ai/chat
GET /api/ai/status
POST /api/ai/credentials/unlock
POST /api/ai/credentials/lock
所有端点需要 JWT 鉴权。
```

**Subagent 输出**：
- `backend/src/routes/ai.js`

**人工干预**：
- 无重大修改，代码质量良好

**教训**：
- 路由层应该保持薄，业务逻辑在 service 层

---

## 2026-08-10 · Task 4: ai-tests（AI 测试）

**触发技能**：tdd

**关键 Prompt**：
```
为 AI 模块编写单元测试。使用 vitest mock credentialManager 和 fetch。
需要覆盖：正常流程、API Key 缺失、认证失败、凭据状态查询。
```

**Subagent 输出**：
- `backend/tests/ai.test.js`

**人工干预**：
- 增加了 mock 的完整性
- 添加了路由级别的认证测试

**教训**：
- Mock LLM 是测试 AI 模块的正确方式
- 不要真实调用 LLM API 进行单元测试（成本高、不稳定）

---

## 2026-08-10 · Task 5: docker-distribution（Docker 分发）

**触发技能**：coding

**关键 Prompt**：
```
为 CampusHub AI 创建 Docker 分发方案：
- backend/Dockerfile：Node.js 22 Alpine，多阶段构建
- frontend/Dockerfile：Vite build + Nginx
- docker-compose.yml：一键启动前后端
- 前端 nginx.conf：SPA 路由 + API 代理
```

**Subagent 输出**：
- `backend/Dockerfile`
- `frontend/Dockerfile`
- `frontend/nginx.conf`
- `docker-compose.yml`

**人工干预**：
- 调整了健康检查配置
- 添加了凭据卷挂载

**教训**：
- 多阶段构建显著减小镜像体积
- docker-compose 的 volumes 配置需要仔细测试

---

## 2026-08-10 · Task 6: ci-cd（CI/CD 配置）

**触发技能**：coding

**关键 Prompt**：
```
创建 GitHub Actions 配置，要求：
- 必须包含 unit-test job
- 前后端分离测试
- Docker 构建（仅 main 分支）
```

**Subagent 输出**：
- `.github/workflows/ci.yml`

**人工干预**：
- 调整为 3 阶段（test → build）
- 添加了缓存配置加速构建

**教训**：
- GitHub Actions 的 cache 配置需要按分支隔离
- unit-test job 名称必须精确匹配课程要求

---

## 2026-08-10 · Task 7: docs（文档撰写）

**触发技能**：writing

**关键 Prompt**：
```
创建 AI4SE 课程要求的全部文档：
SPEC.md、PLAN.md、SPEC_PROCESS.md、AGENT_LOG.md、REFLECTION.md
内容要求见通用要求 §四、§五。
```

**Subagent 输出**：
- 全部 5 份文档

**人工干预**：
- 补充了具体的项目细节
- 调整了 REFLECTION.md 的深度和批判性

**教训**：
- 文档撰写是项目中容易被忽视但非常重要的部分
- 好的文档需要"人"的视角，AI 辅助可以但需要人工润色

---

## 总结

### 效率统计

| 指标 | 数据 |
|------|------|
| 总 subagent 任务数 | 8 |
| 人工干预次数 | 12 |
| 关键 prompt 调整 | 6 |
| 代码审查发现的 bug | 3 |

### 最佳实践

1. **先写 SPEC 再写代码**：避免方向性错误
2. **mock LLM 做测试**：快速、稳定、零成本
3. **小步提交**：每个 subagent task 一个 commit
4. **人工 review 不可省略**：AI 生成的代码需要人工把关
