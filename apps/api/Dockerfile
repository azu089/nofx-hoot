# HOOT API Dockerfile
# 多阶段构建优化镜像大小

# 阶段1: 依赖安装
FROM node:20-alpine AS deps
WORKDIR /app

# 安装 pnpm
RUN corepack enable && corepack prepare pnpm@10.0.0 --activate

# 复制依赖文件
COPY package.json pnpm-lock.yaml* ./
COPY prisma ./prisma/

# 安装依赖
RUN pnpm install --frozen-lockfile

# 阶段2: 构建
FROM node:20-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.0.0 --activate

# 复制依赖
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 生成 Prisma Client
RUN npx prisma generate

# 构建应用
RUN pnpm build

# 阶段3: 生产镜像
FROM node:20-alpine AS runner
WORKDIR /app

# 创建非 root 用户
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

# 设置环境变量
ENV NODE_ENV=production
ENV PORT=4001

# 复制构建产物
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nestjs:nodejs /app/package.json ./

# 切换到非 root 用户
USER nestjs

# 暴露端口
EXPOSE 4001

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget -q --spider http://localhost:4001/api/health/liveness || exit 1

# 启动命令
CMD ["node", "dist/main.js"]
