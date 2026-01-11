#!/bin/bash

# 测试 AI 持仓解读接口

echo "=== AI 持仓解读接口测试 ==="
echo ""

# 1. 测试盈利持仓解读
echo "1. 测试盈利持仓 (BTC/USDT +50 USDT)"
echo "----------------------------------------"
curl -X POST http://localhost:4001/api/ai/interpret-trade \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer mock-token" \
  -d '{
    "pair": "BTC/USDT",
    "side": "buy",
    "amount": "0.0015",
    "price": "65000.00",
    "pnl": "50.00",
    "executed_at": "2026-01-10T10:00:00Z"
  }' 2>/dev/null | python3 -m json.tool

echo ""
echo ""

# 2. 测试亏损持仓解读
echo "2. 测试亏损持仓 (ETH/USDT -15 USDT)"
echo "----------------------------------------"
curl -X POST http://localhost:4001/api/ai/interpret-trade \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer mock-token" \
  -d '{
    "pair": "ETH/USDT",
    "side": "buy",
    "amount": "0.5",
    "price": "3500.00",
    "pnl": "-15.00",
    "executed_at": "2026-01-09T15:30:00Z"
  }' 2>/dev/null | python3 -m json.tool

echo ""
echo "=== 测试完成 ==="
