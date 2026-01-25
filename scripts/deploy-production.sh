#!/bin/bash
# ====================================
# QuantFi 生产环境一键部署脚本
# ====================================
# 服务器: 165.245.176.139
# 域名: tizo.cc
# 使用方法: 在服务器上运行此脚本

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=====================================${NC}"
echo -e "${GREEN}   QuantFi 生产环境部署脚本${NC}"
echo -e "${GREEN}=====================================${NC}"
echo ""

# ------------------------------------
# 第一步：系统更新和基础软件安装
# ------------------------------------
echo -e "${YELLOW}[1/8] 更新系统并安装基础软件...${NC}"

sudo apt update && sudo apt upgrade -y
sudo apt install -y curl wget git build-essential

# ------------------------------------
# 第二步：安装 Docker
# ------------------------------------
echo -e "${YELLOW}[2/8] 安装 Docker...${NC}"

if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com | sh
    sudo usermod -aG docker $USER
    echo -e "${GREEN}Docker 安装完成${NC}"
else
    echo -e "${GREEN}Docker 已安装${NC}"
fi

# 安装 Docker Compose 插件
sudo apt install -y docker-compose-plugin

# ------------------------------------
# 第三步：安装 Node.js 20.x
# ------------------------------------
echo -e "${YELLOW}[3/8] 安装 Node.js 20.x...${NC}"

if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
    echo -e "${GREEN}Node.js 安装完成${NC}"
else
    echo -e "${GREEN}Node.js 已安装: $(node -v)${NC}"
fi

# 安装 pnpm
if ! command -v pnpm &> /dev/null; then
    npm install -g pnpm
    echo -e "${GREEN}pnpm 安装完成${NC}"
else
    echo -e "${GREEN}pnpm 已安装${NC}"
fi

# 安装 PM2
if ! command -v pm2 &> /dev/null; then
    npm install -g pm2
    echo -e "${GREEN}PM2 安装完成${NC}"
else
    echo -e "${GREEN}PM2 已安装${NC}"
fi

# ------------------------------------
# 第四步：安装 Nginx
# ------------------------------------
echo -e "${YELLOW}[4/8] 安装 Nginx...${NC}"

sudo apt install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx

# ------------------------------------
# 第五步：安装 Certbot（SSL）
# ------------------------------------
echo -e "${YELLOW}[5/8] 安装 Certbot...${NC}"

sudo apt install -y certbot python3-certbot-nginx

# ------------------------------------
# 第六步：创建项目目录并设置权限
# ------------------------------------
echo -e "${YELLOW}[6/8] 创建项目目录...${NC}"

sudo mkdir -p /opt/quantfi
sudo chown -R $USER:$USER /opt/quantfi

# ------------------------------------
# 第七步：创建 PostgreSQL 和 Redis 配置
# ------------------------------------
echo -e "${YELLOW}[7/8] 创建 Docker Compose 配置...${NC}"

cat > /opt/quantfi/docker-compose.yml << 'EOF'
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    container_name: quantfi-postgres
    restart: always
    environment:
      POSTGRES_USER: quantfi
      POSTGRES_PASSWORD: Qf2026!Tizo#Secure
      POSTGRES_DB: quantfi
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "127.0.0.1:5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U quantfi"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: quantfi-redis
    restart: always
    command: redis-server --requirepass Qf2026!Tizo#Secure
    volumes:
      - redis_data:/data
    ports:
      - "127.0.0.1:6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "Qf2026!Tizo#Secure", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
  redis_data:
EOF

# ------------------------------------
# 第八步：创建 Nginx 配置
# ------------------------------------
echo -e "${YELLOW}[8/8] 创建 Nginx 配置...${NC}"

sudo tee /etc/nginx/sites-available/tizo.cc > /dev/null << 'EOF'
# 前端 - tizo.cc
server {
    listen 80;
    server_name tizo.cc www.tizo.cc;

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

    client_max_body_size 10M;

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
        proxy_read_timeout 86400;
    }
}
EOF

# 启用配置
sudo ln -sf /etc/nginx/sites-available/tizo.cc /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

echo ""
echo -e "${GREEN}=====================================${NC}"
echo -e "${GREEN}   基础环境安装完成！${NC}"
echo -e "${GREEN}=====================================${NC}"
echo ""
echo -e "下一步操作："
echo -e "1. 配置 DNS 解析（在 Spaceship）"
echo -e "2. 上传代码到 /opt/quantfi"
echo -e "3. 运行 ./scripts/start-services.sh 启动服务"
echo ""
echo -e "${YELLOW}统一密码: Qf2026!Tizo#Secure${NC}"
echo -e "（数据库和 Redis 都使用此密码）"
echo ""
