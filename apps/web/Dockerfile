# QuantFi Web Dockerfile
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

# 复制 apps/web 包配置
COPY apps/web/package.json ./apps/web/

# 安装依赖
RUN pnpm install --frozen-lockfile --filter @quantfi/web

# ==================== 构建阶段 ====================
FROM base AS builder

WORKDIR /app

# 复制依赖
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules

# 复制源代码
COPY apps/web ./apps/web
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# 设置构建时环境变量
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL:-http://localhost:4001/api}

# 构建
RUN cd apps/web && pnpm build

# ==================== 生产阶段 ====================
FROM node:20-alpine AS runner

WORKDIR /app

# 安全：创建非 root 用户
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# 设置环境变量
ENV NODE_ENV=production
ENV PORT=3002
ENV HOSTNAME="0.0.0.0"

# 复制 Next.js 独立输出
COPY --from=builder /app/apps/web/public ./public

# 设置权限（Next.js 需要写入 .next 缓存）
RUN mkdir .next
RUN chown nextjs:nodejs .next

# 复制构建产物
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./.next/static

# 切换用户
USER nextjs

# 暴露端口
EXPOSE 3002

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3002 || exit 1

# 启动命令
CMD ["node", "server.js"]
