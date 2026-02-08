#!/bin/bash
# ==============================================
# HOOT VPS 初始化脚本
# 在全新的 Ubuntu 22.04/24.04 VPS 上运行
# ==============================================
# 使用方式:
#   1. SSH 到 VPS
#   2. git clone 项目代码
#   3. cd HOOT
#   4. sudo bash scripts/init-vps.sh
# ==============================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "============================================"
echo "  HOOT VPS 初始化脚本"
echo "  域名: hoot.cool"
echo "============================================"
echo ""

# Step 1: 系统更新
echo -e "${YELLOW}[1/7] 更新系统...${NC}"
apt-get update && apt-get upgrade -y
echo -e "${GREEN}  系统更新完成${NC}"

# Step 2: 安装 Docker
echo ""
echo -e "${YELLOW}[2/7] 安装 Docker...${NC}"
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
    echo -e "${GREEN}  Docker 安装完成${NC}"
else
    echo -e "${GREEN}  Docker 已安装: $(docker --version)${NC}"
fi

# Step 3: 安装 certbot
echo ""
echo -e "${YELLOW}[3/7] 安装 certbot...${NC}"
if ! command -v certbot &> /dev/null; then
    apt-get install -y certbot
    echo -e "${GREEN}  certbot 安装完成${NC}"
else
    echo -e "${GREEN}  certbot 已安装${NC}"
fi

# Step 4: 配置防火墙
echo ""
echo -e "${YELLOW}[4/7] 配置防火墙 (UFW)...${NC}"
if command -v ufw &> /dev/null; then
    ufw allow 22/tcp    # SSH
    ufw allow 80/tcp    # HTTP（Let's Encrypt + 重定向）
    ufw allow 443/tcp   # HTTPS
    ufw --force enable
    echo -e "${GREEN}  防火墙配置完成（仅开放 22, 80, 443）${NC}"
else
    echo -e "${YELLOW}  UFW 未安装，跳过防火墙配置${NC}"
fi

# Step 5: 创建日志目录
echo ""
echo -e "${YELLOW}[5/7] 创建目录结构...${NC}"
mkdir -p /var/log/hoot
mkdir -p nginx/ssl nginx/certbot
echo -e "${GREEN}  目录创建完成${NC}"

# Step 6: 生成密钥并创建 .env
echo ""
echo -e "${YELLOW}[6/7] 生成安全密钥...${NC}"

if [ ! -f .env ]; then
    DB_PASSWORD=$(openssl rand -hex 16)
    JWT_SECRET=$(openssl rand -hex 32)
    ENCRYPTION_KEY=$(openssl rand -hex 32)
    WEBHOOK_SECRET=$(openssl rand -hex 32)
    REDIS_PASSWORD=$(openssl rand -hex 16)
    FT_API_PASSWORD=$(openssl rand -hex 16)
    FT_JWT_SECRET=$(openssl rand -hex 24)
    FT_JWT_SECRET_OWL=$(openssl rand -hex 24)

    cat > .env << EOF
# HOOT 生产环境变量（自动生成于 $(date))
# ⚠️ 请保存此文件的备份！

# === 数据库 ===
DB_PASSWORD=${DB_PASSWORD}

# === Redis ===
REDIS_PASSWORD=${REDIS_PASSWORD}

# === 安全密钥 ===
JWT_SECRET=${JWT_SECRET}
ENCRYPTION_KEY=${ENCRYPTION_KEY}
WEBHOOK_SECRET=${WEBHOOK_SECRET}

# === Freqtrade ===
FT_API_USERNAME=hoot
FT_API_PASSWORD=${FT_API_PASSWORD}
FT_JWT_SECRET=${FT_JWT_SECRET}
FT_JWT_SECRET_OWL=${FT_JWT_SECRET_OWL}

# === 以下需手动填写 ===

# Telegram Bot（从 @BotFather 获取）
TELEGRAM_BOT_TOKEN=

# 邮件服务（从 resend.com 获取）
RESEND_API_KEY=

# 链上配置（可选，暂不需要）
WITHDRAW_WALLET_PRIVATE_KEY=
DEPOSIT_WALLET_ADDRESS=
EOF

    chmod 600 .env
    echo -e "${GREEN}  .env 文件已生成（密钥已自动生成）${NC}"
    echo ""
    echo -e "${YELLOW}  ⚠️  请手动编辑 .env 填写以下信息:${NC}"
    echo "    - TELEGRAM_BOT_TOKEN"
    echo "    - RESEND_API_KEY（可选）"
else
    echo -e "${GREEN}  .env 文件已存在，跳过${NC}"
fi

# Step 7: DNS 检查
echo ""
echo -e "${YELLOW}[7/7] DNS 检查...${NC}"
SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || echo "无法获取")
echo "  本机 IP: ${SERVER_IP}"
echo ""
echo -e "${YELLOW}  请确认 DNS 已配置:${NC}"
echo "    hoot.cool     → A → ${SERVER_IP}"
echo "    api.hoot.cool  → A → ${SERVER_IP}"
echo ""

# 完成
echo "============================================"
echo -e "${GREEN}  VPS 初始化完成！${NC}"
echo "============================================"
echo ""
echo "下一步操作:"
echo ""
echo "  1. 配置 DNS（如果还没做）:"
echo "     hoot.cool     → A → ${SERVER_IP}"
echo "     api.hoot.cool  → A → ${SERVER_IP}"
echo ""
echo "  2. 编辑 .env 填写 Telegram Token 等（nano .env）"
echo ""
echo "  3. 申请 SSL 证书:"
echo "     sudo bash scripts/setup-ssl.sh"
echo ""
echo "  4. 部署服务:"
echo "     bash scripts/deploy.sh deploy"
echo ""
echo "  5. 启用 Nginx + Freqtrade:"
echo "     docker compose -f docker-compose.prod.yml --profile with-nginx --profile with-freqtrade up -d"
echo ""
echo "  6. 配置自动备份和监控:"
echo "     bash scripts/deploy.sh setup-cron"
echo ""
