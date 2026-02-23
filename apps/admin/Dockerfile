# HOOT Admin Dockerfile
# Vite + React SPA，构建后用 serve 托管静态文件

# 阶段1: 依赖安装
FROM node:20-alpine AS deps
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.0.0 --activate

COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile

# 阶段2: 构建
FROM node:20-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.0.0 --activate

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}

RUN pnpm build

# 阶段3: 生产镜像（轻量 serve 托管）
FROM node:20-alpine AS runner
WORKDIR /app

RUN npm install -g serve

# 创建非 root 用户
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 appuser

# 复制构建产物
COPY --from=builder /app/dist ./dist

USER appuser

EXPOSE 3002

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD wget -q --spider http://localhost:3002/ || exit 1

CMD ["serve", "-s", "dist", "-l", "3002"]
