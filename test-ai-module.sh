#!/bin/bash

# 测试 AI 模块

BASE_URL="http://localhost:4001/api"
TOKEN=""

echo "=== QuantFi AI 模块测试 ==="
echo ""

# 1. 登录获取 Token
echo "1. 登录获取 Token..."
LOGIN_RESPONSE=$(curl -s -X POST "${BASE_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }')

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "登录失败，请先注册用户或检查凭证"
  echo "响应: $LOGIN_RESPONSE"
  exit 1
fi

echo "✓ 登录成功"
echo ""

# 2. 查询生成配额
echo "2. 查询 AI 生成配额..."
QUOTA_RESPONSE=$(curl -s -X GET "${BASE_URL}/ai/generation-quota" \
  -H "Authorization: Bearer ${TOKEN}")

echo "响应: $QUOTA_RESPONSE"
echo ""

# 3. 生成交易策略
echo "3. 生成交易策略..."
STRATEGY_RESPONSE=$(curl -s -X POST "${BASE_URL}/ai/generate-strategy" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "基于 RSI 和 MACD 的趋势跟踪策略",
    "riskLevel": "medium",
    "tradingPair": "BTC/USDT"
  }')

echo "响应: $STRATEGY_RESPONSE" | head -30
echo ""

# 4. 分析交易记录（需要有交易数据）
echo "4. 分析交易记录..."
ANALYSIS_RESPONSE=$(curl -s -X POST "${BASE_URL}/ai/analyze-trades" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "timeRange": "7d"
  }')

echo "响应: $ANALYSIS_RESPONSE"
echo ""

# 5. 查询生成历史
echo "5. 查询生成历史..."
HISTORY_RESPONSE=$(curl -s -X GET "${BASE_URL}/ai/generation-history?limit=5" \
  -H "Authorization: Bearer ${TOKEN}")

echo "响应: $HISTORY_RESPONSE"
echo ""

echo "=== 测试完成 ==="
