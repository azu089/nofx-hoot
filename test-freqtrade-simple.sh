#!/bin/bash

BASE_URL="http://localhost:4001"

# 登录
echo "登录..."
LOGIN=$(curl -s -X POST $BASE_URL/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"freqtrade-test@example.com","password":"Test123456"}')

TOKEN=$(echo $LOGIN | jq -r '.data.accessToken')
echo "Token: ${TOKEN:0:30}..."
echo ""

# 获取实例列表
echo "获取实例列表..."
INSTANCES=$(curl -s -X GET $BASE_URL/api/instances \
  -H "Authorization: Bearer $TOKEN")

INSTANCE_ID=$(echo $INSTANCES | jq -r '.data[0].id // empty')

if [ -z "$INSTANCE_ID" ]; then
  echo "没有实例,跳过测试"
  exit 0
fi

echo "使用实例: $INSTANCE_ID"
echo ""

# 测试 1: Freqtrade 状态
echo "=== 测试 1: Freqtrade 状态 ==="
curl -s -X GET "$BASE_URL/api/instances/$INSTANCE_ID/status" \
  -H "Authorization: Bearer $TOKEN" | jq
echo ""

# 测试 2: Freqtrade 余额
echo "=== 测试 2: Freqtrade 余额 ==="
curl -s -X GET "$BASE_URL/api/instances/$INSTANCE_ID/balance" \
  -H "Authorization: Bearer $TOKEN" | jq
echo ""

# 测试 3: Freqtrade 交易
echo "=== 测试 3: Freqtrade 交易 ==="
curl -s -X GET "$BASE_URL/api/instances/$INSTANCE_ID/trades" \
  -H "Authorization: Bearer $TOKEN" | jq
echo ""

# 测试 4: 交易统计
echo "=== 测试 4: 交易统计 ==="
curl -s -X GET "$BASE_URL/api/trades/stats" \
  -H "Authorization: Bearer $TOKEN" | jq
echo ""

# 测试 5: 交易历史
echo "=== 测试 5: 交易历史 ==="
curl -s -X GET "$BASE_URL/api/trades" \
  -H "Authorization: Bearer $TOKEN" | jq
echo ""

# 测试 6: 强制平仓（单个）
echo "=== 测试 6: 强制平仓（单个） ==="
curl -s -X POST "$BASE_URL/api/instances/$INSTANCE_ID/force-exit" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"trade_id":"1"}' | jq
echo ""

# 测试 7: 强制平仓（全部）
echo "=== 测试 7: 强制平仓（全部） ==="
curl -s -X POST "$BASE_URL/api/instances/$INSTANCE_ID/force-exit" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{}' | jq
echo ""

echo "✅ 所有测试完成！"
