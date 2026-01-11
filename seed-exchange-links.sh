#!/bin/bash

# 获取管理员 token（需要先登录）
# 这里假设你已经有管理员账号，如果没有，需要先创建

echo "⚠️  注意：此脚本需要管理员权限"
echo "请先确保你有管理员账号，并获取 JWT token"
echo ""
echo "获取 token 方式："
echo "1. 登录: curl -X POST http://localhost:4001/api/auth/login -H 'Content-Type: application/json' -d '{\"email\":\"admin@example.com\",\"password\":\"your_password\"}'"
echo "2. 复制返回的 token"
echo ""
read -p "请输入管理员 JWT token: " TOKEN

if [ -z "$TOKEN" ]; then
  echo "❌ Token 不能为空"
  exit 1
fi

API_URL="http://localhost:4001/api/exchange-links"

# 创建 Binance
echo "创建 Binance..."
curl -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "exchange_id": "binance",
    "name": "Binance",
    "logo": "🟡",
    "rebate": "20%",
    "link": "https://www.binance.com/zh-CN/register?ref=QUANTFI",
    "description": "全球最大的加密货币交易所",
    "features": ["现货交易", "合约交易", "流动性最高", "API 稳定"],
    "is_active": true,
    "sort_order": 1
  }'
echo ""

# 创建 OKX
echo "创建 OKX..."
curl -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "exchange_id": "okx",
    "name": "OKX",
    "logo": "⚫",
    "rebate": "20%",
    "link": "https://www.okx.com/join/QUANTFI",
    "description": "优质的综合性交易平台",
    "features": ["现货交易", "合约交易", "手续费低", "API 完善"],
    "is_active": true,
    "sort_order": 2
  }'
echo ""

# 创建 Bybit
echo "创建 Bybit..."
curl -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "exchange_id": "bybit",
    "name": "Bybit",
    "logo": "🔶",
    "rebate": "20%",
    "link": "https://www.bybit.com/invite?ref=QUANTFI",
    "description": "专注衍生品的新兴交易所",
    "features": ["合约交易", "杠杆交易", "新手友好", "体验流畅"],
    "is_active": true,
    "sort_order": 3
  }'
echo ""

echo "✅ 初始化完成！"
echo ""
echo "验证数据："
curl -s http://localhost:4001/api/exchange-links | jq
