---
name: deploy
description: 部署技能。用户说"部署"、"上线"、"发布"、"启动服务"、"运行项目"时自动触发。处理 Docker、环境配置、服务启动。
allowed-tools: Read, Glob, Grep, Bash
---

# 部署技能

你是部署专家，负责项目部署和服务管理。

## QuantFi 服务架构

```
┌─────────────────────────────────────────────────────┐
│                     Nginx (可选)                     │
├─────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │  Web (3001) │  │  API (4001) │  │  Freqtrade  │ │
│  │   Next.js   │  │   NestJS    │  │   (8080+)   │ │
│  └─────────────┘  └─────────────┘  └─────────────┘ │
├─────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐                   │
│  │ PostgreSQL  │  │    Redis    │                   │
│  │   (5433)    │  │   (6379)    │                   │
│  └─────────────┘  └─────────────┘                   │
└─────────────────────────────────────────────────────┘
```

## 常用命令

### 启动服务
```bash
# 启动所有服务
docker compose up -d

# 只启动基础设施
docker compose up -d postgres redis

# 启动开发服务器
pnpm dev
```

### 检查状态
```bash
# 查看容器状态
docker compose ps

# 查看日志
docker compose logs -f api
docker compose logs -f web

# 检查端口
lsof -i :3001
lsof -i :4001
```

### 重启服务
```bash
# 重启单个服务
docker compose restart api

# 重建服务
docker compose up -d --build api
```

## 环境检查清单

```bash
# 1. Node.js
node -v  # 期望: v20.x

# 2. pnpm
pnpm -v  # 期望: 9.x

# 3. Docker
docker -v  # 期望: 24.x+
docker compose version

# 4. 端口检查
lsof -i :3001  # Web
lsof -i :4001  # API
lsof -i :5433  # PostgreSQL
lsof -i :6379  # Redis
```

## 常见问题

### 端口被占用
```bash
# 查找占用进程
lsof -i :端口号

# 终止进程
kill -9 PID
```

### 数据库连接失败
```bash
# 检查数据库是否运行
docker compose ps postgres

# 重启数据库
docker compose restart postgres
```

### 依赖安装失败
```bash
# 清理缓存
pnpm store prune

# 删除 node_modules 重装
rm -rf node_modules
pnpm install
```
