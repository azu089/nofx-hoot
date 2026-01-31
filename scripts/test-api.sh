#!/bin/bash
# HOOT 平台 API 快速测试脚本
# 用法: ./scripts/test-api.sh

set -e

API_BASE="http://localhost:4001/api"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "======================================"
echo "  HOOT 平台 API 快速测试"
echo "======================================"
echo ""

# 测试函数
test_endpoint() {
    local name=$1
    local method=$2
    local endpoint=$3
    local data=$4
    local token=$5

    echo -n "测试 $name ... "

    if [ -n "$token" ]; then
        AUTH_HEADER="-H \"Authorization: Bearer $token\""
    else
        AUTH_HEADER=""
    fi

    if [ "$method" = "GET" ]; then
        if [ -n "$token" ]; then
            response=$(curl -s -w "\n%{http_code}" "$API_BASE$endpoint" -H "Authorization: Bearer $token")
        else
            response=$(curl -s -w "\n%{http_code}" "$API_BASE$endpoint")
        fi
    else
        if [ -n "$token" ]; then
            response=$(curl -s -w "\n%{http_code}" -X $method "$API_BASE$endpoint" \
                -H "Content-Type: application/json" \
                -H "Authorization: Bearer $token" \
                -d "$data")
        else
            response=$(curl -s -w "\n%{http_code}" -X $method "$API_BASE$endpoint" \
                -H "Content-Type: application/json" \
                -d "$data")
        fi
    fi

    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
        echo -e "${GREEN}通过${NC} (HTTP $http_code)"
        return 0
    elif [ "$http_code" -ge 400 ] && [ "$http_code" -lt 500 ]; then
        echo -e "${YELLOW}客户端错误${NC} (HTTP $http_code)"
        echo "  响应: $body"
        return 1
    else
        echo -e "${RED}失败${NC} (HTTP $http_code)"
        echo "  响应: $body"
        return 1
    fi
}

# 1. 健康检查
echo ""
echo ">>> 模块 1: 健康检查"
echo "------------------------"
test_endpoint "健康检查" "GET" "/health" || true
test_endpoint "存活探针" "GET" "/health/liveness" || true
test_endpoint "就绪探针" "GET" "/health/readiness" || true

# 2. 用户认证
echo ""
echo ">>> 模块 2: 用户认证"
echo "------------------------"

# 生成随机邮箱避免重复
RANDOM_EMAIL="test_$(date +%s)@test.com"

# 注册
echo -n "测试 用户注册 ... "
REGISTER_RESPONSE=$(curl -s -X POST "$API_BASE/auth/register" \
    -H "Content-Type: application/json" \
    -d "{
        \"email\": \"$RANDOM_EMAIL\",
        \"password\": \"Test123456\",
        \"nickname\": \"TestUser\"
    }")

if echo "$REGISTER_RESPONSE" | grep -q "\"id\""; then
    echo -e "${GREEN}通过${NC}"
    USER_ID=$(echo "$REGISTER_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
else
    echo -e "${RED}失败${NC}"
    echo "  响应: $REGISTER_RESPONSE"
fi

# 登录
echo -n "测试 用户登录 ... "
LOGIN_RESPONSE=$(curl -s -X POST "$API_BASE/auth/login" \
    -H "Content-Type: application/json" \
    -d "{
        \"email\": \"$RANDOM_EMAIL\",
        \"password\": \"Test123456\"
    }")

if echo "$LOGIN_RESPONSE" | grep -q "access_token"; then
    echo -e "${GREEN}通过${NC}"
    TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)
    echo "  获取到 Token: ${TOKEN:0:30}..."
else
    echo -e "${RED}失败${NC}"
    echo "  响应: $LOGIN_RESPONSE"
    exit 1
fi

# 获取当前用户
test_endpoint "获取当前用户" "GET" "/auth/me" "" "$TOKEN" || true

# 3. 策略
echo ""
echo ">>> 模块 3: 策略市场"
echo "------------------------"
test_endpoint "策略列表" "GET" "/strategies" "" "$TOKEN" || true

# 4. 钱包
echo ""
echo ">>> 模块 4: 钱包"
echo "------------------------"
test_endpoint "钱包余额" "GET" "/wallet/balance" "" "$TOKEN" || true
test_endpoint "交易记录" "GET" "/wallet/transactions" "" "$TOKEN" || true

# 5. 持仓
echo ""
echo ">>> 模块 5: 持仓"
echo "------------------------"
test_endpoint "持仓列表" "GET" "/positions" "" "$TOKEN" || true

# 6. 质押
echo ""
echo ">>> 模块 6: 质押"
echo "------------------------"
test_endpoint "我的质押" "GET" "/staking/my" "" "$TOKEN" || true
test_endpoint "质押统计" "GET" "/staking/my/stats" "" "$TOKEN" || true
test_endpoint "全网统计" "GET" "/staking/global-stats" "" "" || true

# 7. 代理商
echo ""
echo ">>> 模块 7: 代理商"
echo "------------------------"
test_endpoint "邀请码" "GET" "/referral/invite-code" "" "$TOKEN" || true
test_endpoint "邀请统计" "GET" "/referral/stats" "" "$TOKEN" || true

# 8. 通知
echo ""
echo ">>> 模块 8: 通知"
echo "------------------------"
test_endpoint "通知列表" "GET" "/notifications" "" "$TOKEN" || true
test_endpoint "未读计数" "GET" "/notifications/unread-count" "" "$TOKEN" || true

# 9. 信号
echo ""
echo ">>> 模块 9: 信号"
echo "------------------------"
test_endpoint "信号统计" "GET" "/signals/stats" "" "$TOKEN" || true
test_endpoint "执行历史" "GET" "/signals/my/executions" "" "$TOKEN" || true

echo ""
echo "======================================"
echo "  测试完成"
echo "======================================"
echo ""
echo "测试用户: $RANDOM_EMAIL"
echo "Token: ${TOKEN:0:50}..."
echo ""
echo "如需进行更多测试，请使用以下命令导出 Token:"
echo "export TOKEN=\"$TOKEN\""
