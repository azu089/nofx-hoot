#!/bin/bash
# ==============================================
# HOOT SSL 证书配置脚本
# 使用 Let's Encrypt 为 hoot.cool 签发证书
# ==============================================
# 前置条件:
#   1. 域名 DNS 已解析到本机 IP
#   2. 80 端口未被占用（或 Nginx 已启动）
#   3. 已安装 certbot
#
# 使用方式:
#   sudo bash scripts/setup-ssl.sh
# ==============================================

set -e

DOMAIN="hoot.cool"
API_DOMAIN="api.hoot.cool"
ADMIN_DOMAIN="admin.hoot.cool"
EMAIL="${ADMIN_EMAIL:-admin@hoot.cool}"
SSL_DIR="$(cd "$(dirname "$0")/.." && pwd)/nginx/ssl"

echo "=== HOOT SSL 证书配置 ==="
echo "域名: ${DOMAIN}, ${API_DOMAIN}, ${ADMIN_DOMAIN}"
echo "邮箱: ${EMAIL}"
echo "证书目录: ${SSL_DIR}"
echo ""

# 检查 certbot
if ! command -v certbot &> /dev/null; then
    echo "正在安装 certbot..."
    if command -v apt-get &> /dev/null; then
        apt-get update && apt-get install -y certbot
    elif command -v yum &> /dev/null; then
        yum install -y certbot
    else
        echo "请手动安装 certbot"
        exit 1
    fi
fi

# 停止可能占用 80 端口的服务
echo "检查 80 端口..."
if lsof -i :80 &> /dev/null; then
    echo "80 端口被占用，尝试临时停止 nginx..."
    docker stop hoot-nginx 2>/dev/null || true
    sleep 2
fi

# 申请证书（standalone 模式）
echo ""
echo "正在申请 SSL 证书..."
certbot certonly \
    --standalone \
    --non-interactive \
    --agree-tos \
    --email "${EMAIL}" \
    -d "${DOMAIN}" \
    -d "${API_DOMAIN}" \
    -d "${ADMIN_DOMAIN}"

# 复制证书到 nginx/ssl 目录
echo ""
echo "复制证书到 ${SSL_DIR}..."
mkdir -p "${SSL_DIR}"

CERT_DIR="/etc/letsencrypt/live/${DOMAIN}"
cp "${CERT_DIR}/fullchain.pem" "${SSL_DIR}/fullchain.pem"
cp "${CERT_DIR}/privkey.pem" "${SSL_DIR}/privkey.pem"

# 设置权限
chmod 644 "${SSL_DIR}/fullchain.pem"
chmod 600 "${SSL_DIR}/privkey.pem"

echo ""
echo "=== SSL 证书配置完成 ==="
echo "证书路径: ${SSL_DIR}/fullchain.pem"
echo "私钥路径: ${SSL_DIR}/privkey.pem"
echo ""
echo "下一步:"
echo "  1. 启动 Nginx: docker compose -f docker-compose.prod.yml --profile with-nginx up -d nginx"
echo "  2. 验证: curl https://${DOMAIN}"
echo ""
echo "自动续期（添加到 crontab）:"
echo "  0 2 * * 1 certbot renew --quiet && cp /etc/letsencrypt/live/${DOMAIN}/*.pem ${SSL_DIR}/ && docker restart hoot-nginx"
