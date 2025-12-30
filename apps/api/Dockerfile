# QuantFi API Dockerfile
# 多阶段构建，优化镜像大小

# ==================== 基础阶段 ====================
FROM node:20-alpine AS base

# 安装 pnpm
RUN corepack enable && corepack prepare pnpm@9 --activate

# 设置工作目录
WORKDIR /app

# ==================== 依赖阶段 ====================
FROM base AS deps

# 复制 workspace 配置
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
COPY package.json ./

# 复制 apps/api 包配置
COPY apps/api/package.json ./apps/api/

# 安装依赖（仅生产依赖）
RUN pnpm install --frozen-lockfile --filter @quantfi/api

# ==================== 构建阶段 ====================
FROM base AS builder

WORKDIR /app

# 复制依赖
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules

# 复制源代码
COPY apps/api ./apps/api
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# 生成 Prisma Client
RUN cd apps/api && npx prisma generate

# 构建
RUN cd apps/api && pnpm build

# ==================== 生产阶段 ====================
FROM node:20-alpine AS runner

WORKDIR /app

# 安全：创建非 root 用户
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs

# 设置环境变量
ENV NODE_ENV=production
ENV PORT=4001

# 复制构建产物
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/node_modules ./node_modules
COPY --from=builder /app/apps/api/package.json ./

# 复制 Prisma schema（运行时需要）
COPY --from=builder /app/apps/api/prisma ./prisma

# 切换用户
USER nestjs

# 暴露端口
EXPOSE 4001

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4001/api/health || exit 1

# 启动命令
CMD ["node", "dist/main.js"]
