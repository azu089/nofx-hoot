#!/bin/bash

# QuantFi 回测服务测试脚本

echo "===== 测试回测服务 ====="
echo ""

# 1. 先登录获取 token (使用测试用户)
echo "1. 登录获取 Token..."
LOGIN_RESPONSE=$(curl -s -X POST "http://localhost:4001/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Password123"}')

echo "登录响应: $LOGIN_RESPONSE"

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "错误: 无法获取 Token"
  echo "请确保测试用户 test@example.com / Password123 存在"
  exit 1
fi

echo "Token 获取成功: ${TOKEN:0:20}..."
echo ""

# 2. 执行回测
echo "2. 执行回测 (SOL 动量策略)..."
BACKTEST_RESPONSE=$(curl -s -X POST "http://localhost:4001/api/strategies/backtest" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "strategyId": "44444444-4444-4444-4444-444444444444",
    "startDate": "2024-11-01",
    "endDate": "2024-12-01",
    "initialCapital": 10000,
    "pairs": ["SOL/USDT"],
    "leverage": 1
  }')

echo "$BACKTEST_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$BACKTEST_RESPONSE"
echo ""

# 3. 验证回测数据格式
echo "3. 验证回测响应..."

if echo "$BACKTEST_RESPONSE" | grep -q '"code":0'; then
  echo "✅ 回测成功"

  # 提取关键指标
  TOTAL_RETURN=$(echo "$BACKTEST_RESPONSE" | grep -o '"totalReturn":[^,]*' | cut -d':' -f2)
  WIN_RATE=$(echo "$BACKTEST_RESPONSE" | grep -o '"winRate":[^,]*' | cut -d':' -f2)
  MAX_DRAWDOWN=$(echo "$BACKTEST_RESPONSE" | grep -o '"maxDrawdown":[^,]*' | cut -d':' -f2)
  SHARPE_RATIO=$(echo "$BACKTEST_RESPONSE" | grep -o '"sharpeRatio":[^,]*' | cut -d':' -f2)

  echo ""
  echo "===== 回测指标 ====="
  echo "总收益率: ${TOTAL_RETURN}%"
  echo "胜率: ${WIN_RATE}%"
  echo "最大回撤: ${MAX_DRAWDOWN}%"
  echo "夏普比率: ${SHARPE_RATIO}"
  echo ""

  if [ ! -z "$TOTAL_RETURN" ] && [ ! -z "$WIN_RATE" ]; then
    echo "✅ 回测服务工作正常"
    exit 0
  else
    echo "❌ 回测数据格式异常"
    exit 1
  fi
else
  echo "❌ 回测失败"
  exit 1
fi
