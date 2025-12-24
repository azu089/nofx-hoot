#!/bin/bash

# Users 模块接口测试脚本

API_URL="http://localhost:4001/api"

echo "====== Users 模块接口测试 ======"
echo ""

# 1. 注册一个测试用户
echo "1. 注册测试用户..."
TEST_EMAIL="test-user-$(date +%s)@example.com"
TEST_PASSWORD="password123"

REGISTER_RESPONSE=$(curl -s -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "'"$TEST_EMAIL"'",
    "password": "'"$TEST_PASSWORD"'"
  }')
echo "注册响应: $REGISTER_RESPONSE"
echo ""

# 2. 登录获取 token
echo "2. 登录获取 Token..."
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "'"$TEST_EMAIL"'",
    "password": "'"$TEST_PASSWORD"'"
  }')
echo "登录响应: $LOGIN_RESPONSE"
echo ""

# 提取 access_token
ACCESS_TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)

if [ -z "$ACCESS_TOKEN" ]; then
  echo "❌ 登录失败或未能获取 token"
  exit 1
fi

echo "✅ 获取到 Token: ${ACCESS_TOKEN:0:20}..."
echo ""

# 3. 获取用户详细信息
echo "3. 获取用户详细信息 (GET /users/profile)..."
PROFILE_RESPONSE=$(curl -s -X GET "$API_URL/users/profile" \
  -H "Authorization: Bearer $ACCESS_TOKEN")
echo "响应: $PROFILE_RESPONSE"
echo ""

# 检查是否包含敏感字段（应该不包含）
if echo "$PROFILE_RESPONSE" | grep -q "password_hash"; then
  echo "❌ 错误：响应中包含 password_hash"
else
  echo "✅ 脱敏正确：不包含 password_hash"
fi

if echo "$PROFILE_RESPONSE" | grep -q "two_factor_secret"; then
  echo "❌ 错误：响应中包含 two_factor_secret"
else
  echo "✅ 脱敏正确：不包含 two_factor_secret"
fi
echo ""

# 4. 更新用户信息
echo "4. 更新用户密码 (PATCH /users/profile)..."
UPDATE_RESPONSE=$(curl -s -X PATCH "$API_URL/users/profile" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "password": "newpassword456"
  }')
echo "响应: $UPDATE_RESPONSE"
echo ""

# 5. 启用 2FA
echo "5. 启用 2FA (POST /users/2fa/enable)..."
ENABLE_2FA_RESPONSE=$(curl -s -X POST "$API_URL/users/2fa/enable" \
  -H "Authorization: Bearer $ACCESS_TOKEN")
echo "响应: $ENABLE_2FA_RESPONSE"
echo ""

# 检查是否已启用
if echo "$ENABLE_2FA_RESPONSE" | grep -q '"two_factor_enabled":true'; then
  echo "✅ 2FA 已成功启用"
else
  echo "❌ 2FA 启用失败"
fi
echo ""

# 6. 重复启用 2FA（应该失败）
echo "6. 重复启用 2FA（预期失败）..."
REPEAT_ENABLE_RESPONSE=$(curl -s -X POST "$API_URL/users/2fa/enable" \
  -H "Authorization: Bearer $ACCESS_TOKEN")
echo "响应: $REPEAT_ENABLE_RESPONSE"

if echo "$REPEAT_ENABLE_RESPONSE" | grep -q "2FA 已启用"; then
  echo "✅ 正确阻止重复启用"
else
  echo "❌ 应该返回 2FA 已启用错误"
fi
echo ""

# 7. 禁用 2FA
echo "7. 禁用 2FA (POST /users/2fa/disable)..."
DISABLE_2FA_RESPONSE=$(curl -s -X POST "$API_URL/users/2fa/disable" \
  -H "Authorization: Bearer $ACCESS_TOKEN")
echo "响应: $DISABLE_2FA_RESPONSE"
echo ""

# 检查是否已禁用
if echo "$DISABLE_2FA_RESPONSE" | grep -q '"two_factor_enabled":false'; then
  echo "✅ 2FA 已成功禁用"
else
  echo "❌ 2FA 禁用失败"
fi
echo ""

# 8. 测试未认证访问（应该失败）
echo "8. 测试未认证访问 (预期失败)..."
UNAUTH_RESPONSE=$(curl -s -X GET "$API_URL/users/profile")
echo "响应: $UNAUTH_RESPONSE"

if echo "$UNAUTH_RESPONSE" | grep -q "缺少认证 Token\|认证失败"; then
  echo "✅ 正确阻止未认证访问"
else
  echo "❌ 应该返回认证失败错误"
fi
echo ""

echo "====== 测试完成 ======"
