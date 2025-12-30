#!/bin/bash

# Phase 3 钱的闭环功能测试脚本

API_URL="http://localhost:4000/api"
TOKEN=""

echo "=== Phase 3 充值提现功能测试 ==="
echo ""

# 1. 注册测试用户
echo "1. 注册测试用户..."
REGISTER_RESULT=$(curl -s -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test-deposit@example.com",
    "password": "password123"
  }')
echo "$REGISTER_RESULT" | jq '.'
echo ""

# 2. 登录获取 Token
echo "2. 登录获取 Token..."
LOGIN_RESULT=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test-deposit@example.com",
    "password": "password123"
  }')
TOKEN=$(echo "$LOGIN_RESULT" | jq -r '.data.accessToken')
echo "Token: $TOKEN"
echo ""

# 3. 查询钱包余额（初始应该为 0）
echo "3. 查询初始钱包余额..."
curl -s -X GET "$API_URL/wallets/balance" \
  -H "Authorization: Bearer $TOKEN" | jq '.'
echo ""

# 4. 申请充值 100 USDT
echo "4. 申请充值 100 USDT..."
DEPOSIT_RESULT=$(curl -s -X POST "$API_URL/deposits" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 100,
    "method": "usdt_trc20",
    "chain": "TRC20",
    "fromAddress": "TTestAddress123",
    "txHash": "0xtest123456"
  }')
echo "$DEPOSIT_RESULT" | jq '.'
DEPOSIT_ID=$(echo "$DEPOSIT_RESULT" | jq -r '.data.id')
echo "充值 ID: $DEPOSIT_ID"
echo ""

# 5. 查询充值记录
echo "5. 查询充值记录..."
curl -s -X GET "$API_URL/deposits" \
  -H "Authorization: Bearer $TOKEN" | jq '.'
echo ""

# 6. 管理员审核通过充值（使用相同 token 模拟管理员）
echo "6. 管理员审核通过充值..."
REVIEW_RESULT=$(curl -s -X POST "$API_URL/deposits/admin/$DEPOSIT_ID/review" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "approved"
  }')
echo "$REVIEW_RESULT" | jq '.'
echo ""

# 7. 再次查询钱包余额（应该变成 100）
echo "7. 查询充值后钱包余额..."
curl -s -X GET "$API_URL/wallets/balance" \
  -H "Authorization: Bearer $TOKEN" | jq '.'
echo ""

# 8. 申请提现 50 USDT
echo "8. 申请提现 50 USDT..."
WITHDRAWAL_RESULT=$(curl -s -X POST "$API_URL/withdrawals" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 50,
    "chain": "TRC20",
    "toAddress": "TWithdrawAddress456"
  }')
echo "$WITHDRAWAL_RESULT" | jq '.'
WITHDRAWAL_ID=$(echo "$WITHDRAWAL_RESULT" | jq -r '.data.id')
echo "提现 ID: $WITHDRAWAL_ID"
echo ""

# 9. 查询钱包余额（应该看到冻结金额）
echo "9. 查询提现申请后钱包余额（应该有冻结金额）..."
curl -s -X GET "$API_URL/wallets/balance" \
  -H "Authorization: Bearer $TOKEN" | jq '.'
echo ""

# 10. 查询提现记录
echo "10. 查询提现记录..."
curl -s -X GET "$API_URL/withdrawals" \
  -H "Authorization: Bearer $TOKEN" | jq '.'
echo ""

# 11. 管理员审核通过提现
echo "11. 管理员审核通过提现..."
REVIEW_WITHDRAWAL=$(curl -s -X POST "$API_URL/withdrawals/admin/$WITHDRAWAL_ID/review" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "approved",
    "txHash": "0xwithdrawal123456"
  }')
echo "$REVIEW_WITHDRAWAL" | jq '.'
echo ""

# 12. 最终查询钱包余额
echo "12. 查询最终钱包余额..."
curl -s -X GET "$API_URL/wallets/balance" \
  -H "Authorization: Bearer $TOKEN" | jq '.'
echo ""

echo "=== 测试完成 ==="
