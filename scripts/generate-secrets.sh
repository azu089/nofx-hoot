#!/bin/bash
# ==============================================
# HOOT 生产环境密钥生成脚本
# ==============================================
# 使用方法: ./scripts/generate-secrets.sh

echo "=== HOOT 生产环境密钥生成器 ==="
echo ""
echo "请将以下密钥复制到 .env.production 文件中"
echo ""
echo "=================================================="
echo ""

# JWT 密钥
echo "# JWT_SECRET (用于用户认证)"
echo "JWT_SECRET=$(openssl rand -base64 32)"
echo ""

# 加密密钥
echo "# ENCRYPTION_KEY (用于加密 API Key)"
echo "ENCRYPTION_KEY=$(openssl rand -hex 32)"
echo ""

# Webhook 密钥
echo "# WEBHOOK_SECRET (用于验证 Freqtrade 信号)"
echo "WEBHOOK_SECRET=$(openssl rand -hex 32)"
echo ""

# Freqtrade JWT
echo "# FREQTRADE_JWT_SECRET"
echo "FREQTRADE_JWT_SECRET=$(openssl rand -base64 24)"
echo ""

# 数据库密码建议
echo "# 数据库密码建议 (DATABASE_URL 中使用)"
echo "# DB_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=')"
echo ""

# Redis 密码建议
echo "# Redis 密码建议"
echo "# REDIS_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=')"
echo ""

echo "=================================================="
echo ""
echo "⚠️  安全提醒:"
echo "  1. 不要将这些密钥提交到 Git"
echo "  2. 使用密码管理器安全存储"
echo "  3. 定期轮换密钥"
echo ""
