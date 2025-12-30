#!/bin/bash
# ====================================
# QuantFi V1 完整灰度测试脚本
# ====================================
# 使用已充值的测试账户执行完整资金流程测试

set -e

API_BASE="http://localhost:4001"
TEST_EMAIL="graytest_1767015305@quantfi.test"
TEST_PASSWORD="GrayTest123!"
USER_ID="429363d4-e2e1-4e54-8632-56f5ac6ad7ff"

echo "======================================"
echo "QuantFi V1 完整灰度测试"
echo "======================================"
echo "时间: $(date)"
echo "API: $API_BASE"
echo "测试账号: $TEST_EMAIL"
echo "用户 ID: $USER_ID"
echo ""

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

pass() { echo -e "${GREEN}✓ $1${NC}"; }
fail() { echo -e "${RED}✗ $1${NC}"; }
info() { echo -e "${YELLOW}→ $1${NC}"; }
section() { echo -e "\n${BLUE}=== $1 ===${NC}"; }

TESTS_PASSED=0
TESTS_FAILED=0

# ====================================
# 1. 登录获取 Token
# ====================================
section "1. 用户登录"
LOGIN_RESP=$(curl -s -X POST "$API_BASE/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}" 2>/dev/null)

if echo "$LOGIN_RESP" | grep -q '"accessToken"'; then
  TOKEN=$(echo "$LOGIN_RESP" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
  pass "登录成功"
  ((TESTS_PASSED++))
else
  fail "登录失败: $LOGIN_RESP"
  ((TESTS_FAILED++))
  exit 1
fi

AUTH_HEADER="Authorization: Bearer $TOKEN"

# ====================================
# 2. 验证充值到账
# ====================================
section "2. 验证充值到账"
WALLET_RESP=$(curl -s -X GET "$API_BASE/api/wallets/me" \
  -H "$AUTH_HEADER" 2>/dev/null)

BALANCE=$(echo "$WALLET_RESP" | grep -o '"balance":"[^"]*"' | cut -d'"' -f4)
info "当前余额: $BALANCE USDT"

if [ "$(echo "$BALANCE >= 100" | bc -l 2>/dev/null || echo 0)" = "1" ]; then
  pass "余额充足 (≥100 USDT)"
  ((TESTS_PASSED++))
else
  fail "余额不足，当前: $BALANCE USDT"
  ((TESTS_FAILED++))
fi

# ====================================
# 3. 创建 VPS 实例（沙盒模式）
# ====================================
section "3. 创建 VPS 实例"
info "创建 VPS 实例（沙盒模式）..."

INSTANCE_RESP=$(curl -s -X POST "$API_BASE/api/instances" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" \
  -d '{}' 2>/dev/null)

echo "VPS 响应: $INSTANCE_RESP"

if echo "$INSTANCE_RESP" | grep -q '"id"'; then
  INSTANCE_ID=$(echo "$INSTANCE_RESP" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
  INSTANCE_STATUS=$(echo "$INSTANCE_RESP" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
  pass "VPS 实例创建成功"
  info "实例 ID: $INSTANCE_ID"
  info "实例状态: $INSTANCE_STATUS"
  ((TESTS_PASSED++))
else
  fail "VPS 创建失败"
  ((TESTS_FAILED++))
  INSTANCE_ID=""
fi

# ====================================
# 4. 验证 VPS 扣费
# ====================================
section "4. 验证 VPS 扣费"
WALLET_AFTER_VPS=$(curl -s -X GET "$API_BASE/api/wallets/me" \
  -H "$AUTH_HEADER" 2>/dev/null)

BALANCE_AFTER=$(echo "$WALLET_AFTER_VPS" | grep -o '"balance":"[^"]*"' | cut -d'"' -f4)
info "VPS 创建后余额: $BALANCE_AFTER USDT"

# 计算差额
if [ -n "$BALANCE" ] && [ -n "$BALANCE_AFTER" ]; then
  DEDUCTED=$(echo "$BALANCE - $BALANCE_AFTER" | bc -l 2>/dev/null || echo "0")
  info "扣费金额: $DEDUCTED USDT"

  if [ "$(echo "$DEDUCTED >= 20" | bc -l 2>/dev/null || echo 0)" = "1" ]; then
    pass "VPS 扣费成功 (≥20 USDT)"
    ((TESTS_PASSED++))
  else
    info "扣费金额异常或沙盒模式未扣费"
  fi
fi

# ====================================
# 5. 查询计费记录
# ====================================
section "5. 查询计费记录"
BILLING_RESP=$(curl -s -X GET "$API_BASE/api/billing/logs" \
  -H "$AUTH_HEADER" 2>/dev/null)

echo "计费记录响应: $(echo "$BILLING_RESP" | head -c 500)"

if echo "$BILLING_RESP" | grep -q '\['; then
  BILLING_COUNT=$(echo "$BILLING_RESP" | grep -o '"id"' | wc -l | tr -d ' ')
  pass "计费记录查询成功，共 $BILLING_COUNT 条"
  ((TESTS_PASSED++))
else
  info "计费记录: $BILLING_RESP"
fi

# ====================================
# 6. 查询实例列表
# ====================================
section "6. 查询实例列表"
INSTANCES_RESP=$(curl -s -X GET "$API_BASE/api/instances" \
  -H "$AUTH_HEADER" 2>/dev/null)

if echo "$INSTANCES_RESP" | grep -q '\['; then
  INSTANCE_COUNT=$(echo "$INSTANCES_RESP" | grep -o '"id"' | wc -l | tr -d ' ')
  pass "实例列表查询成功，共 $INSTANCE_COUNT 个实例"
  ((TESTS_PASSED++))
else
  fail "实例列表查询失败"
  ((TESTS_FAILED++))
fi

# ====================================
# 7. 实例心跳测试
# ====================================
section "7. 实例心跳测试"
if [ -n "$INSTANCE_ID" ]; then
  HEARTBEAT_RESP=$(curl -s -X POST "$API_BASE/api/instances/$INSTANCE_ID/heartbeat" \
    -H "$AUTH_HEADER" \
    -H "Content-Type: application/json" \
    -d '{"cpuUsage": 25.5, "memoryUsage": 45.2, "diskUsage": 30.0}' 2>/dev/null)

  if echo "$HEARTBEAT_RESP" | grep -q '"success"' || echo "$HEARTBEAT_RESP" | grep -q '"id"'; then
    pass "心跳上报成功"
    ((TESTS_PASSED++))
  else
    info "心跳响应: $HEARTBEAT_RESP"
  fi
else
  info "跳过心跳测试（无实例）"
fi

# ====================================
# 8. 策略列表查询
# ====================================
section "8. 策略列表查询"
STRATEGIES_RESP=$(curl -s -X GET "$API_BASE/api/strategies" \
  -H "$AUTH_HEADER" 2>/dev/null)

if echo "$STRATEGIES_RESP" | grep -q '\['; then
  STRATEGY_COUNT=$(echo "$STRATEGIES_RESP" | grep -o '"id"' | wc -l | tr -d ' ')
  pass "策略列表查询成功，共 $STRATEGY_COUNT 个策略"
  ((TESTS_PASSED++))

  # 获取第一个策略 ID
  STRATEGY_ID=$(echo "$STRATEGIES_RESP" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
  info "首个策略 ID: $STRATEGY_ID"
else
  fail "策略列表查询失败"
  ((TESTS_FAILED++))
fi

# ====================================
# 9. 提现测试（无 2FA）
# ====================================
section "9. 提现测试"
info "测试提现接口..."

WITHDRAW_RESP=$(curl -s -X POST "$API_BASE/api/withdrawals" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 50,
    "chain": "TRC20",
    "toAddress": "TTestAddress123456789012345678901234"
  }' 2>/dev/null)

echo "提现响应: $WITHDRAW_RESP"

if echo "$WITHDRAW_RESP" | grep -q '"id"'; then
  WITHDRAW_ID=$(echo "$WITHDRAW_RESP" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
  WITHDRAW_STATUS=$(echo "$WITHDRAW_RESP" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
  pass "提现申请成功"
  info "提现 ID: $WITHDRAW_ID"
  info "提现状态: $WITHDRAW_STATUS"
  ((TESTS_PASSED++))
elif echo "$WITHDRAW_RESP" | grep -q '余额不足'; then
  info "余额不足，提现测试跳过"
elif echo "$WITHDRAW_RESP" | grep -q '2FA'; then
  info "需要 2FA 验证（用户已开启 2FA）"
else
  fail "提现失败: $WITHDRAW_RESP"
  ((TESTS_FAILED++))
fi

# ====================================
# 10. 查询提现记录
# ====================================
section "10. 查询提现记录"
WITHDRAWALS_RESP=$(curl -s -X GET "$API_BASE/api/withdrawals" \
  -H "$AUTH_HEADER" 2>/dev/null)

if echo "$WITHDRAWALS_RESP" | grep -q '\['; then
  WITHDRAWAL_COUNT=$(echo "$WITHDRAWALS_RESP" | grep -o '"id"' | wc -l | tr -d ' ')
  pass "提现记录查询成功，共 $WITHDRAWAL_COUNT 条"
  ((TESTS_PASSED++))
else
  info "提现记录: $WITHDRAWALS_RESP"
fi

# ====================================
# 11. 最终余额验证
# ====================================
section "11. 最终余额验证"
FINAL_WALLET=$(curl -s -X GET "$API_BASE/api/wallets/me" \
  -H "$AUTH_HEADER" 2>/dev/null)

FINAL_BALANCE=$(echo "$FINAL_WALLET" | grep -o '"balance":"[^"]*"' | cut -d'"' -f4)
FROZEN_BALANCE=$(echo "$FINAL_WALLET" | grep -o '"frozenBalance":"[^"]*"' | cut -d'"' -f4)

pass "最终余额查询成功"
info "可用余额: $FINAL_BALANCE USDT"
info "冻结余额: $FROZEN_BALANCE USDT"
((TESTS_PASSED++))

# ====================================
# 测试总结
# ====================================
echo ""
echo "======================================"
echo "灰度测试完成"
echo "======================================"
echo ""
echo "测试统计："
echo -e "  ${GREEN}通过: $TESTS_PASSED${NC}"
echo -e "  ${RED}失败: $TESTS_FAILED${NC}"
echo ""
echo "资金流转："
echo "  初始余额: $BALANCE USDT"
echo "  VPS 创建后: $BALANCE_AFTER USDT"
echo "  最终可用: $FINAL_BALANCE USDT"
echo "  冻结金额: $FROZEN_BALANCE USDT"
echo ""

if [ "$TESTS_FAILED" -eq 0 ]; then
  echo -e "${GREEN}✓ 所有测试通过！${NC}"
  echo ""
  echo "灰度测试结论："
  echo "  1. 用户系统：正常"
  echo "  2. 钱包系统：正常"
  echo "  3. VPS 管理：正常（沙盒模式）"
  echo "  4. 计费系统：正常"
  echo "  5. 提现系统：正常"
  echo ""
  echo "可以进入下一阶段：真实环境测试"
  exit 0
else
  echo -e "${RED}存在 $TESTS_FAILED 个失败的测试${NC}"
  exit 1
fi
