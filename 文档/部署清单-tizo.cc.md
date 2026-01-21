# QuantFi 生产部署清单 - tizo.cc

> 创建时间: 2026-01-21
> 目标域名: tizo.cc

---

## 一、域名规划

| 用途 | 域名 | 说明 |
|------|------|------|
| 前端 Web | `tizo.cc` | Next.js 前端应用 |
| 后端 API | `api.tizo.cc` | NestJS 后端服务 |
| Telegram Mini App | `tizo.cc/tg/*` | 同一前端，路由区分 |

---

## 二、AI 已完成的配置

### ✅ 后端配置文件
- 文件: `apps/api/.env.production`
- 内容: 完整的生产环境配置模板

### ✅ 前端配置文件
- 文件: `apps/web/.env.production`
- 内容:
  ```
  NEXT_PUBLIC_API_URL=https://api.tizo.cc/api
  NEXT_PUBLIC_WS_URL=wss://api.tizo.cc
  NEXT_PUBLIC_SITE_URL=https://tizo.cc
  ```

### ✅ 代码修复
- billing/stats API 接口已添加
- JWT_SECRET 已生成强随机密钥
- CORS 配置已更新为 tizo.cc 域名

---

## 三、你需要准备的清单

### 1. 服务器准备

#### 推荐配置
| 项目 | 最低配置 | 推荐配置 |
|------|---------|---------|
| CPU | 2 核 | 4 核 |
| 内存 | 4 GB | 8 GB |
| 存储 | 50 GB SSD | 100 GB SSD |
| 系统 | Ubuntu 22.04 | Ubuntu 22.04 |
| 位置 | 新加坡 | 新加坡（靠近用户） |

#### 需要安装的软件
```bash
# 1. 更新系统
sudo apt update && sudo apt upgrade -y

# 2. 安装 Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# 3. 安装 Docker Compose
sudo apt install docker-compose-plugin -y

# 4. 安装 Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 5. 安装 pnpm
npm install -g pnpm

# 6. 安装 Nginx（反向代理）
sudo apt install nginx -y

# 7. 安装 Certbot（SSL 证书）
sudo apt install certbot python3-certbot-nginx -y
```

---

### 2. DNS 配置

在你的域名管理后台（Cloudflare/阿里云/等）添加以下记录：

| 类型 | 名称 | 值 | TTL |
|------|------|-----|-----|
| A | @ | `服务器IP` | 自动 |
| A | api | `服务器IP` | 自动 |
| A | www | `服务器IP` | 自动 |

如果使用 Cloudflare，建议开启代理（橙色云朵）以获得 CDN 加速和 DDoS 防护。

---

### 3. SSL 证书

#### 方式一：Certbot 自动获取（推荐）
```bash
# 获取证书
sudo certbot --nginx -d tizo.cc -d www.tizo.cc -d api.tizo.cc

# 自动续期测试
sudo certbot renew --dry-run
```

#### 方式二：Cloudflare SSL（如果使用 CF 代理）
- 在 Cloudflare 后台开启 "Full (strict)" SSL 模式
- 下载 Origin Certificate 到服务器

---

### 4. 密钥和 Token 准备

你需要准备以下密钥，填入 `apps/api/.env.production`：

| 配置项 | 说明 | 如何获取 |
|--------|------|---------|
| `DATABASE_URL` | 数据库连接 | 修改密码部分 |
| `REDIS_PASSWORD` | Redis 密码 | 设置强密码 |
| `ENCRYPTION_KEY` | API Key 加密密钥 | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `DO_API_TOKEN` | DigitalOcean Token | DigitalOcean 控制台 → API → Generate New Token |
| `OPENAI_API_KEY` | OpenAI API Key | https://platform.openai.com/api-keys |
| `TELEGRAM_BOT_TOKEN` | Telegram Bot Token | @BotFather 创建机器人后获取 |
| `RESEND_API_KEY` | 邮件服务 API Key | https://resend.com/api-keys |

---

### 5. 数据库和 Redis 密码

生成强密码：
```bash
# 数据库密码
openssl rand -base64 32

# Redis 密码
openssl rand -base64 24

# Encryption Key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

### 6. Telegram Bot 配置

1. 在 Telegram 找到 @BotFather
2. 发送 `/newbot` 创建机器人（如已有则跳过）
3. 发送 `/setmenubutton` 设置 Mini App 按钮
4. 发送 `/setwebhook` 设置 Webhook（可选）

Mini App URL 设置为：`https://tizo.cc/tg`

---

### 7. Resend 邮件域名验证

1. 登录 https://resend.com
2. 进入 Domains 页面
3. 添加 `tizo.cc` 域名
4. 按提示添加 DNS 记录（MX, TXT）
5. 等待验证通过

---

## 四、部署步骤

### 步骤 1：上传代码到服务器

```bash
# 方式一：Git 克隆
git clone your-repo-url /opt/quantfi
cd /opt/quantfi

# 方式二：rsync 上传
rsync -avz --exclude node_modules --exclude .git ./ user@server:/opt/quantfi/
```

### 步骤 2：配置环境变量

```bash
cd /opt/quantfi

# 后端配置
cp apps/api/.env.production apps/api/.env
# 编辑填入真实密钥
nano apps/api/.env

# 前端配置
cp apps/web/.env.production apps/web/.env.local
```

### 步骤 3：启动服务

```bash
# 安装依赖
pnpm install

# 启动数据库和 Redis
docker compose up -d postgres redis

# 等待数据库启动
sleep 10

# 执行数据库迁移
cd apps/api
npx prisma migrate deploy
npx prisma generate
cd ../..

# 构建项目
pnpm build

# 启动后端（使用 PM2）
npm install -g pm2
cd apps/api
pm2 start dist/main.js --name quantfi-api
cd ../..

# 启动前端
cd apps/web
pm2 start npm --name quantfi-web -- start
cd ../..

# 保存 PM2 配置
pm2 save
pm2 startup
```

### 步骤 4：配置 Nginx 反向代理

```bash
sudo nano /etc/nginx/sites-available/tizo.cc
```

写入以下内容：

```nginx
# 前端 - tizo.cc
server {
    listen 80;
    server_name tizo.cc www.tizo.cc;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name tizo.cc www.tizo.cc;

    ssl_certificate /etc/letsencrypt/live/tizo.cc/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/tizo.cc/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

# 后端 API - api.tizo.cc
server {
    listen 80;
    server_name api.tizo.cc;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.tizo.cc;

    ssl_certificate /etc/letsencrypt/live/tizo.cc/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/tizo.cc/privkey.pem;

    # API 请求
    location / {
        proxy_pass http://127.0.0.1:4001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # WebSocket 支持
        proxy_read_timeout 86400;
    }
}
```

启用配置：
```bash
sudo ln -s /etc/nginx/sites-available/tizo.cc /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 步骤 5：验证部署

```bash
# 检查服务状态
pm2 status

# 检查 API 健康
curl https://api.tizo.cc/api/health

# 检查前端
curl -I https://tizo.cc
```

---

## 五、验收清单

部署完成后，逐项检查：

### 基础功能
- [ ] https://tizo.cc 能打开首页
- [ ] https://api.tizo.cc/api/health 返回 `{"status":"ok"}`
- [ ] 注册功能正常（收到验证邮件）
- [ ] 登录功能正常
- [ ] 仪表盘页面正常显示

### 核心业务
- [ ] 可以添加交易所 API Key
- [ ] 可以订阅策略
- [ ] VPS 实例能正常创建（DigitalOcean）
- [ ] 质押功能正常
- [ ] 积分兑换功能正常

### Telegram Mini App
- [ ] Telegram 机器人能启动 Mini App
- [ ] Mini App 页面正常显示
- [ ] Telegram 登录功能正常

### 安全检查
- [ ] HTTPS 证书有效
- [ ] API 限流正常工作
- [ ] 敏感接口需要登录

---

## 六、常见问题

### Q1: 数据库连接失败
```bash
# 检查 PostgreSQL 状态
docker compose ps
docker compose logs postgres

# 检查连接
psql postgresql://quantfi:password@localhost:5432/quantfi
```

### Q2: Redis 连接失败
```bash
# 检查 Redis 状态
docker compose logs redis

# 测试连接
redis-cli -h localhost -p 6379 -a YOUR_PASSWORD ping
```

### Q3: Nginx 502 错误
```bash
# 检查后端是否运行
pm2 status
pm2 logs quantfi-api

# 检查端口
netstat -tlnp | grep 4001
```

### Q4: SSL 证书问题
```bash
# 查看证书状态
sudo certbot certificates

# 手动续期
sudo certbot renew
```

---

## 七、回滚方案

如果部署后出现严重问题：

```bash
# 1. 停止服务
pm2 stop all

# 2. 恢复数据库（如有备份）
pg_restore -d quantfi backup.dump

# 3. 回滚代码
git checkout HEAD~1

# 4. 重新构建启动
pnpm build
pm2 restart all
```

---

## 八、监控建议（后续）

- 使用 PM2 Plus 监控应用
- 配置 Uptime Robot 监控可用性
- 配置日志收集（如 Loki + Grafana）
- 配置数据库自动备份

---

**祝部署顺利！有问题随时问我。**
