#!/bin/bash

# QuantFi Freqtrade API 测试脚本
# 测试实盘操作模块功能

BASE_URL="http://localhost:4001"
TOKEN=""

echo "========================================"
echo "QuantFi Freqtrade API 测试"
echo "========================================"
echo ""

# 1. 注册测试用户
echo "1. 注册测试用户..."
REGISTER_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "freqtrade-test@example.com",
    "password": "Test123456"
  }')

echo "注册响应: $REGISTER_RESPONSE"
echo ""

# 2. 登录获取 Token
echo "2. 登录获取 Token..."
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "freqtrade-test@example.com",
    "password": "Test123456"
  }')

TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.data.accessToken')

if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
  echo "❌ 登录失败，无法获取 Token"
  exit 1
fi

echo "✅ 登录成功，Token: ${TOKEN:0:20}..."
echo ""

# 3. 创建 VPS 实例（沙盒模式）
echo "3. 创建 VPS 实例（沙盒模式）..."
CREATE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/instances" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "region": "sgp1",
    "size": "s-1vcpu-1gb"
  }')

INSTANCE_ID=$(echo $CREATE_RESPONSE | jq -r '.data.id')

if [ "$INSTANCE_ID" = "null" ] || [ -z "$INSTANCE_ID" ]; then
  echo "❌ 创建实例失败"
  echo "响应: $CREATE_RESPONSE"
  exit 1
fi

echo "✅ 实例创建成功，ID: $INSTANCE_ID"
echo ""

# 4. 获取实例列表
echo "4. 获取实例列表..."
INSTANCES_RESPONSE=$(curl -s -X GET "$BASE_URL/api/instances" \
  -H "Authorization: Bearer $TOKEN")

echo "实例列表: $(echo $INSTANCES_RESPONSE | jq -r '.[] | .id')"
echo ""

# 5. 测试 Freqtrade 状态接口
echo "5. 获取 Freqtrade 状态..."
STATUS_RESPONSE=$(curl -s -X GET "$BASE_URL/api/instances/$INSTANCE_ID/status" \
  -H "Authorization: Bearer $TOKEN")

echo "Freqtrade 状态: $STATUS_RESPONSE" | jq '.'
echo ""

# 6. 测试 Freqtrade 余额接口
echo "6. 获取 Freqtrade 余额..."
BALANCE_RESPONSE=$(curl -s -X GET "$BASE_URL/api/instances/$INSTANCE_ID/balance" \
  -H "Authorization: Bearer $TOKEN")

echo "Freqtrade 余额: $BALANCE_RESPONSE" | jq '.'
echo ""

# 7. 测试 Freqtrade 交易接口
echo "7. 获取 Freqtrade 交易..."
TRADES_RESPONSE=$(curl -s -X GET "$BASE_URL/api/instances/$INSTANCE_ID/trades" \
  -H "Authorization: Bearer $TOKEN")

echo "Freqtrade 交易: $TRADES_RESPONSE" | jq '.'
echo ""

# 8. 测试交易统计接口
echo "8. 获取交易统计..."
STATS_RESPONSE=$(curl -s -X GET "$BASE_URL/api/trades/stats" \
  -H "Authorization: Bearer $TOKEN")

echo "交易统计: $STATS_RESPONSE" | jq '.'
echo ""

# 9. 测试交易历史接口
echo "9. 获取交易历史..."
HISTORY_RESPONSE=$(curl -s -X GET "$BASE_URL/api/trades" \
  -H "Authorization: Bearer $TOKEN")

echo "交易历史: $HISTORY_RESPONSE" | jq '.'
echo ""

# 10. 测试强制平仓（单个）
echo "10. 测试强制平仓（单个交易）..."
FORCE_EXIT_RESPONSE=$(curl -s -X POST "$BASE_URL/api/instances/$INSTANCE_ID/force-exit" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "trade_id": "1"
  }')

echo "强制平仓响应: $FORCE_EXIT_RESPONSE" | jq '.'
echo ""

# 11. 测试强制平仓（全部）
echo "11. 测试强制平仓（全部）..."
FORCE_EXIT_ALL_RESPONSE=$(curl -s -X POST "$BASE_URL/api/instances/$INSTANCE_ID/force-exit" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{}')

echo "全部平仓响应: $FORCE_EXIT_ALL_RESPONSE" | jq '.'
echo ""

echo "========================================"
echo "✅ 所有测试完成！"
echo "========================================"
