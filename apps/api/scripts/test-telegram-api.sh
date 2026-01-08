#!/bin/bash

# ===================================================
# QuantFi Telegram API 测试脚本
# ===================================================

API_URL="http://localhost:4001/api"
TOKEN=""

echo "=== QuantFi Telegram API 测试 ==="
echo ""

# 1. 首先获取一个测试 Token（需要先注册/登录）
echo "=== 1. 测试用户登录获取 Token ==="
LOGIN_RESPONSE=$(curl -s -X POST "${API_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}')

echo "登录响应: $LOGIN_RESPONSE"
TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "注意：未能获取 Token，尝试注册新用户..."

  REGISTER_RESPONSE=$(curl -s -X POST "${API_URL}/auth/register" \
    -H "Content-Type: application/json" \
    -d '{"email":"telegramtest@example.com","password":"password123"}')

  echo "注册响应: $REGISTER_RESPONSE"
  TOKEN=$(echo $REGISTER_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)
fi

if [ -z "$TOKEN" ]; then
  echo "错误：无法获取 Token，测试终止"
  echo "请手动设置 TOKEN 环境变量后重试"
  exit 1
fi

echo "获取到 Token: ${TOKEN:0:50}..."
echo ""

# 2. 测试仪表盘 API
echo "=== 2. 测试 Telegram Dashboard API ==="
curl -s -X GET "${API_URL}/telegram/dashboard" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | python3 -m json.tool 2>/dev/null || echo "响应解析失败"
echo ""

# 3. 测试策略列表 API
echo "=== 3. 测试 Telegram Strategies API ==="
curl -s -X GET "${API_URL}/telegram/strategies" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | python3 -m json.tool 2>/dev/null || echo "响应解析失败"
echo ""

# 4. 测试钱包 API
echo "=== 4. 测试 Telegram Wallet API ==="
curl -s -X GET "${API_URL}/telegram/wallet" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | python3 -m json.tool 2>/dev/null || echo "响应解析失败"
echo ""

# 5. 测试签到 API
echo "=== 5. 测试 Telegram Checkin API ==="
curl -s -X POST "${API_URL}/telegram/checkin" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | python3 -m json.tool 2>/dev/null || echo "响应解析失败"
echo ""

# 6. 测试邀请信息 API
echo "=== 6. 测试 Telegram Invite API ==="
curl -s -X GET "${API_URL}/telegram/invite" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | python3 -m json.tool 2>/dev/null || echo "响应解析失败"
echo ""

# 7. 测试我的策略 API
echo "=== 7. 测试 My Strategies API ==="
curl -s -X GET "${API_URL}/telegram/my-strategies" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | python3 -m json.tool 2>/dev/null || echo "响应解析失败"
echo ""

# 8. 测试交易历史 API
echo "=== 8. 测试 Trades API ==="
curl -s -X GET "${API_URL}/telegram/trades?page=1&limit=10" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | python3 -m json.tool 2>/dev/null || echo "响应解析失败"
echo ""

# 9. 测试账单历史 API
echo "=== 9. 测试 Billing API ==="
curl -s -X GET "${API_URL}/telegram/billing?page=1&limit=10" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | python3 -m json.tool 2>/dev/null || echo "响应解析失败"
echo ""

# 10. 测试公告 API
echo "=== 10. 测试 Announcements API ==="
curl -s -X GET "${API_URL}/telegram/announcements" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | python3 -m json.tool 2>/dev/null || echo "响应解析失败"
echo ""

# 11. 测试用户资料 API
echo "=== 11. 测试 Profile API ==="
curl -s -X GET "${API_URL}/telegram/profile" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | python3 -m json.tool 2>/dev/null || echo "响应解析失败"
echo ""

echo "=== 测试完成 ==="
echo ""
echo "提示："
echo "1. 若要测试 Telegram 认证，需要使用真实的 Telegram initData"
echo "2. 策略订阅/取消订阅需要先有公开策略"
echo "3. 启动/停止交易需要先订阅策略"
