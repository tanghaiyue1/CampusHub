/**
 * @file backend/app.js
 * @description Express 应用入口：中间件、API 路由挂载、数据库初始化
 */

const express = require("express");
const cors = require("cors");
const config = require("./src/config");
const { initStore, getStore, getStoreType } = require("./src/db");
const { errorHandler, notFoundHandler } = require("./src/middleware/errorHandler");

const authRoutes = require("./src/routes/auth");
const userRoutes = require("./src/routes/users");
const requirementRoutes = require("./src/routes/requirements");
const orderRoutes = require("./src/routes/orders");
const paymentRoutes = require("./src/routes/payments");
const evaluationRoutes = require("./src/routes/evaluations");
const messageRoutes = require("./src/routes/messages");
const aiRoutes = require("./src/routes/ai");

const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.get("/api/hello", (req, res) => {
  res.json({ message: "Hello from CampusHub AI backend!" });
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    db: getStoreType(),
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/requirements", requirementRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/evaluations", evaluationRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/ai", aiRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

async function seedIfEmpty() {
  const store = getStore();
  const existing = await store.findUserByStudentId("2021001001");
  if (!existing) {
    await store.seedDemoUsers();
    console.log("[CampusHub] 已初始化演示账号 2021001001 / demo123456");
  }
}

async function bootstrap() {
  await initStore();
  await seedIfEmpty();
  app.listen(config.port, () => {
    console.log(
      `✅ 后端服务已启动：http://localhost:${config.port} （数据库: ${getStoreType()}）`
    );
  });
}

if (require.main === module) {
  bootstrap().catch((err) => {
    console.error("启动失败:", err);
    process.exit(1);
  });
}

module.exports = app;
