#!/bin/bash

# 测试 Tokens API 接口
# 使用说明：./test-tokens-api.sh

API_BASE="http://localhost:4001/api"

echo "=== QuantFi Tokens API 测试 ==="
echo ""

# 1. 查询代币余额
echo "1. 查询代币余额"
curl -X GET "${API_BASE}/tokens/balance" \
  -H "Content-Type: application/json" \
  | jq '.'
echo ""
echo ""

# 2. 标准模式兑换（20% 立即 + 80% 释放）
echo "2. 标准模式兑换代币（10000 积分 = 10 QFI）"
curl -X POST "${API_BASE}/tokens/exchange" \
  -H "Content-Type: application/json" \
  -d '{
    "points": 10000,
    "mode": "standard"
  }' \
  | jq '.'
echo ""
echo ""

# 3. 查询释放进度
echo "3. 查询释放进度"
curl -X GET "${API_BASE}/tokens/vesting" \
  -H "Content-Type: application/json" \
  | jq '.'
echo ""
echo ""

# 4. 急速模式兑换（50% 立即 + 50% 销毁）
echo "4. 急速模式兑换代币（5000 积分 = 5 QFI）"
curl -X POST "${API_BASE}/tokens/exchange" \
  -H "Content-Type: application/json" \
  -d '{
    "points": 5000,
    "mode": "fast"
  }' \
  | jq '.'
echo ""
echo ""

# 5. 查询兑换订单列表
echo "5. 查询兑换订单列表"
curl -X GET "${API_BASE}/tokens/orders" \
  -H "Content-Type: application/json" \
  | jq '.'
echo ""
echo ""

# 6. 再次查询代币余额
echo "6. 再次查询代币余额（验证兑换成功）"
curl -X GET "${API_BASE}/tokens/balance" \
  -H "Content-Type: application/json" \
  | jq '.'
echo ""

echo "=== 测试完成 ==="
