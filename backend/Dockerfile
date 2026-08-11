# ===== 构建阶段 =====
FROM node:22-alpine AS backend-build
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci --omit=dev

# ===== 后端运行阶段 =====
FROM node:22-alpine AS backend
WORKDIR /app/backend
COPY --from=backend-build /app/backend/node_modules ./node_modules
COPY backend/ .

# 创建凭据目录
RUN mkdir -p /root/.campushub && chmod 700 /root/.campushub

ENV NODE_ENV=production
ENV USE_MEMORY_DB=1
EXPOSE 3000

CMD ["node", "app.js"]
