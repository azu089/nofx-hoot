#!/bin/bash
# Quick API test script

API="http://localhost:4001/api"

# Login
echo "=== 登录 ==="
LOGIN=$(curl -s -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "test_main@test.com", "password": "Test123456"}')

TOKEN=$(echo "$LOGIN" | jq -r '.data.accessToken')
echo "Token: ${TOKEN:0:50}..."

if [ "$TOKEN" = "null" ]; then
  echo "登录失败"
  exit 1
fi

# Auth
echo ""
echo "=== 当前用户 ==="
curl -s "$API/auth/me" -H "Authorization: Bearer $TOKEN" | jq .

# Wallet
echo ""
echo "=== 钱包余额 ==="
curl -s "$API/wallet/balance" -H "Authorization: Bearer $TOKEN" | jq .

# Strategies
echo ""
echo "=== 策略列表 ==="
curl -s "$API/strategies" -H "Authorization: Bearer $TOKEN" | jq '.data | length'
echo "个策略"

# Positions
echo ""
echo "=== 持仓列表 ==="
curl -s "$API/positions" -H "Authorization: Bearer $TOKEN" | jq .

# Staking
echo ""
echo "=== 我的质押 ==="
curl -s "$API/staking/my" -H "Authorization: Bearer $TOKEN" | jq .

echo ""
echo "=== 全网质押统计 ==="
curl -s "$API/staking/global-stats" | jq .

# Referral
echo ""
echo "=== 邀请码 ==="
curl -s "$API/referral/invite-code" -H "Authorization: Bearer $TOKEN" | jq .

# Notifications
echo ""
echo "=== 通知列表 ==="
curl -s "$API/notifications" -H "Authorization: Bearer $TOKEN" | jq .

# Signals
echo ""
echo "=== 信号统计 ==="
curl -s "$API/signals/stats" -H "Authorization: Bearer $TOKEN" | jq .

echo ""
echo "=== 测试完成 ==="
