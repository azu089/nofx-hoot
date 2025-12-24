#!/bin/bash

# 测试认证接口脚本

API_URL="http://localhost:4001/api"
EMAIL="test@quantfi.com"
PASSWORD="password123"

echo "====================================="
echo "QuantFi 认证接口测试"
echo "====================================="
echo ""

# 1. 测试注册接口
echo "1️⃣  测试用户注册"
echo "请求: POST ${API_URL}/auth/register"
echo "数据: { email: ${EMAIL}, password: ${PASSWORD} }"
echo ""

REGISTER_RESPONSE=$(curl -s -X POST ${API_URL}/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\"}")

echo "响应:"
echo "$REGISTER_RESPONSE" | jq . 2>/dev/null || echo "$REGISTER_RESPONSE"
echo ""
echo "-----------------------------------"
echo ""

# 2. 测试登录接口
echo "2️⃣  测试用户登录"
echo "请求: POST ${API_URL}/auth/login"
echo "数据: { email: ${EMAIL}, password: ${PASSWORD} }"
echo ""

LOGIN_RESPONSE=$(curl -s -X POST ${API_URL}/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\"}")

echo "响应:"
echo "$LOGIN_RESPONSE" | jq . 2>/dev/null || echo "$LOGIN_RESPONSE"
echo ""

# 提取 Token
ACCESS_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.data.accessToken' 2>/dev/null)

if [ "$ACCESS_TOKEN" != "null" ] && [ "$ACCESS_TOKEN" != "" ]; then
  echo "✅ 登录成功! Access Token: ${ACCESS_TOKEN:0:50}..."
else
  echo "❌ 登录失败，未获取到 Token"
fi

echo ""
echo "-----------------------------------"
echo ""

# 3. 测试错误场景：邮箱已存在
echo "3️⃣  测试错误场景：重复注册"
echo "请求: POST ${API_URL}/auth/register"
echo "数据: { email: ${EMAIL}, password: ${PASSWORD} }"
echo ""

DUPLICATE_RESPONSE=$(curl -s -X POST ${API_URL}/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\"}")

echo "响应:"
echo "$DUPLICATE_RESPONSE" | jq . 2>/dev/null || echo "$DUPLICATE_RESPONSE"
echo ""
echo "-----------------------------------"
echo ""

# 4. 测试错误场景：密码错误
echo "4️⃣  测试错误场景：密码错误"
echo "请求: POST ${API_URL}/auth/login"
echo "数据: { email: ${EMAIL}, password: 'wrongpassword' }"
echo ""

WRONG_PASSWORD_RESPONSE=$(curl -s -X POST ${API_URL}/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"wrongpassword\"}")

echo "响应:"
echo "$WRONG_PASSWORD_RESPONSE" | jq . 2>/dev/null || echo "$WRONG_PASSWORD_RESPONSE"
echo ""
echo "-----------------------------------"
echo ""

# 5. 测试错误场景：邮箱格式错误
echo "5️⃣  测试错误场景：邮箱格式错误"
echo "请求: POST ${API_URL}/auth/register"
echo "数据: { email: 'invalid-email', password: ${PASSWORD} }"
echo ""

INVALID_EMAIL_RESPONSE=$(curl -s -X POST ${API_URL}/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"invalid-email\",\"password\":\"${PASSWORD}\"}")

echo "响应:"
echo "$INVALID_EMAIL_RESPONSE" | jq . 2>/dev/null || echo "$INVALID_EMAIL_RESPONSE"
echo ""
echo "====================================="
echo "测试完成!"
echo "====================================="
