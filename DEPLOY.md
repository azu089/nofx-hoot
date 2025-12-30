# QuantFi 部署文档

> 版本: 1.0.0
> 更新日期: 2025-12-26

---

## 目录

1. [环境要求](#环境要求)
2. [本地开发](#本地开发)
3. [Docker 部署](#docker-部署)
4. [生产环境部署](#生产环境部署)
5. [环境变量](#环境变量)
6. [数据库迁移](#数据库迁移)
7. [监控与日志](#监控与日志)
8. [备份与恢复](#备份与恢复)
9. [故障排查](#故障排查)

---

## 环境要求

### 软件版本

| 组件 | 最低版本 | 推荐版本 |
|------|---------|---------|
| Node.js | 18.0 | 20.x LTS |
| pnpm | 8.0 | 9.x |
| Docker | 24.0 | 最新稳定版 |
| Docker Compose | v2.20 | v2.23+ |
| PostgreSQL | 15.0 | 15.x |
| Redis | 7.0 | 7.x |

### 硬件要求

**开发环境**
- CPU: 2 核心
- 内存: 4GB
- 磁盘: 20GB

**生产环境**
- CPU: 4 核心+
- 内存: 8GB+
- 磁盘: 100GB+ SSD

---

## 本地开发

### 1. 克隆仓库

```bash
git clone <repository-url>
cd 主QuantFi
```

### 2. 安装依赖

```bash
pnpm install
```

### 3. 配置环境变量

```bash
# 复制环境变量模板
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env

# 编辑配置
vim apps/api/.env
```

### 4. 启动基础服务

```bash
# 启动 PostgreSQL 和 Redis
docker compose up -d postgres redis
```

### 5. 数据库迁移

```bash
cd apps/api
pnpm prisma generate
pnpm prisma migrate dev
```

### 6. 启动开发服务器

```bash
# 在项目根目录
pnpm dev
```

### 7. 验证启动

```bash
# 后端健康检查
curl http://localhost:4001/api/health

# 前端页面
open http://localhost:3001
```

---

## Docker 部署

### 1. 构建镜像

```bash
# 构建所有服务
docker compose build

# 或单独构建
docker compose build api
docker compose build web
```

### 2. 启动所有服务

```bash
docker compose up -d
```

### 3. 查看日志

```bash
# 所有服务日志
docker compose logs -f

# 单个服务日志
docker compose logs -f api
```

### 4. 停止服务

```bash
docker compose down
```

---

## 生产环境部署

### 1. 服务器准备

```bash
# 安装 Docker
curl -fsSL https://get.docker.com | sh

# 安装 Docker Compose
sudo apt install docker-compose-plugin

# 创建部署目录
mkdir -p /opt/quantfi
cd /opt/quantfi
```

### 2. 配置生产环境变量

```bash
# 创建生产环境配置
cat > .env.production << 'EOF'
# 应用配置
NODE_ENV=production
PORT=4001

# 数据库（使用强密码）
DATABASE_HOST=postgres
DATABASE_PORT=5432
DATABASE_USER=quantfi
DATABASE_PASSWORD=<生成强密码>
DATABASE_NAME=quantfi

# Redis
REDIS_HOST=redis
REDIS_PORT=6379

# JWT（使用强密钥）
JWT_SECRET=<生成64字符密钥>
JWT_EXPIRES_IN=7d

# DigitalOcean
DO_API_KEY=<你的DO API Key>

# S3 备份
AWS_ACCESS_KEY_ID=<你的Access Key>
AWS_SECRET_ACCESS_KEY=<你的Secret Key>
AWS_S3_BUCKET=quantfi-backups
AWS_S3_REGION=sgp1

# 前端
NEXT_PUBLIC_API_URL=https://api.quantfi.io
EOF
```

### 3. 生成强密钥

```bash
# 生成 JWT Secret
openssl rand -hex 32

# 生成数据库密码
openssl rand -base64 24
```

### 4. 使用生产配置启动

```bash
docker compose -f docker-compose.prod.yml up -d
```

### 5. 配置反向代理 (Nginx)

```nginx
# /etc/nginx/sites-available/quantfi
server {
    listen 80;
    server_name api.quantfi.io;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.quantfi.io;

    ssl_certificate /etc/letsencrypt/live/api.quantfi.io/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.quantfi.io/privkey.pem;

    location / {
        proxy_pass http://localhost:4001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 6. 配置 SSL 证书

```bash
# 使用 Let's Encrypt
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d api.quantfi.io
```

---

## 环境变量

### 后端 (apps/api/.env)

| 变量 | 说明 | 示例 |
|------|------|------|
| `NODE_ENV` | 运行环境 | development / production |
| `PORT` | API 端口 | 4001 |
| `DATABASE_HOST` | 数据库主机 | localhost |
| `DATABASE_PORT` | 数据库端口 | 5433 |
| `DATABASE_USER` | 数据库用户 | quantfi |
| `DATABASE_PASSWORD` | 数据库密码 | quantfi |
| `DATABASE_NAME` | 数据库名 | quantfi |
| `REDIS_HOST` | Redis 主机 | localhost |
| `REDIS_PORT` | Redis 端口 | 6379 |
| `JWT_SECRET` | JWT 密钥 | 64 字符随机字符串 |
| `JWT_EXPIRES_IN` | Token 过期时间 | 7d |
| `DO_API_KEY` | DigitalOcean API Key | dop_v1_xxx |
| `AWS_ACCESS_KEY_ID` | S3 Access Key | - |
| `AWS_SECRET_ACCESS_KEY` | S3 Secret Key | - |
| `AWS_S3_BUCKET` | S3 存储桶 | quantfi-backups |
| `AWS_S3_REGION` | S3 区域 | sgp1 |

### 前端 (apps/web/.env)

| 变量 | 说明 | 示例 |
|------|------|------|
| `NEXT_PUBLIC_API_URL` | 后端 API 地址 | http://localhost:4001 |

---

## 数据库迁移

### 开发环境

```bash
cd apps/api

# 生成 Prisma Client
pnpm prisma generate

# 创建迁移
pnpm prisma migrate dev --name <迁移名称>

# 应用迁移
pnpm prisma migrate deploy
```

### 生产环境

```bash
# 在 Docker 容器中执行
docker compose exec api pnpm prisma migrate deploy
```

### 回滚迁移

```bash
# 回滚到上一个迁移
pnpm prisma migrate reset --skip-seed
```

---

## 监控与日志

### 日志位置

| 服务 | 日志位置 |
|------|---------|
| API | `docker compose logs api` |
| 前端 | `docker compose logs web` |
| PostgreSQL | `docker compose logs postgres` |
| Redis | `docker compose logs redis` |

### 健康检查

```bash
# API 健康检查
curl http://localhost:4001/api/health

# 数据库连接检查
docker compose exec postgres pg_isready

# Redis 连接检查
docker compose exec redis redis-cli ping
```

### 资源监控

```bash
# 查看容器资源使用
docker stats

# 查看磁盘使用
df -h

# 查看内存使用
free -h
```

---

## 备份与恢复

### 数据库备份

```bash
# 手动备份
docker compose exec postgres pg_dump -U quantfi quantfi > backup_$(date +%Y%m%d).sql

# 定时备份（添加到 crontab）
0 3 * * * docker compose exec -T postgres pg_dump -U quantfi quantfi > /opt/backups/quantfi_$(date +\%Y\%m\%d).sql
```

### 数据库恢复

```bash
# 恢复数据库
docker compose exec -T postgres psql -U quantfi quantfi < backup_20251226.sql
```

### S3 备份

VPS 实例数据自动备份到 S3，由 `BackupsService` 处理。

```bash
# 查看备份列表
curl -H "Authorization: Bearer $TOKEN" http://localhost:4001/api/backups

# 手动触发备份
curl -X POST -H "Authorization: Bearer $TOKEN" http://localhost:4001/api/backups
```

---

## 故障排查

### 常见问题

#### 1. 数据库连接失败

```bash
# 检查数据库服务
docker compose ps postgres

# 检查连接
docker compose exec postgres psql -U quantfi -c "SELECT 1"

# 查看日志
docker compose logs postgres
```

#### 2. Redis 连接失败

```bash
# 检查 Redis 服务
docker compose ps redis

# 测试连接
docker compose exec redis redis-cli ping
```

#### 3. API 启动失败

```bash
# 查看日志
docker compose logs api

# 进入容器调试
docker compose exec api sh
```

#### 4. 端口被占用

```bash
# 查看端口占用
lsof -i :4001
lsof -i :3001

# 杀死占用进程
kill -9 <PID>
```

### 重启服务

```bash
# 重启单个服务
docker compose restart api

# 重启所有服务
docker compose restart

# 完全重建
docker compose down && docker compose up -d
```

### 清理资源

```bash
# 清理未使用的镜像
docker image prune

# 清理所有未使用资源
docker system prune -a
```

---

## 版本记录

| 版本 | 日期 | 说明 |
|------|------|------|
| 1.0.0 | 2025-12-26 | 初始版本 |
