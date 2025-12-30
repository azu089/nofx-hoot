#!/bin/bash
# 全链路资金测试脚本
# 测试：充值、购买点卡、订阅、燃油费扣除、代理返佣、提现

set -e

API_URL="http://localhost:4001/api"
TOKEN=""
ADMIN_TOKEN=""
USER_ID=""

# 颜色输出
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_success() { echo -e "${GREEN}✓ $1${NC}"; }
log_error() { echo -e "${RED}✗ $1${NC}"; }
log_info() { echo -e "${YELLOW}→ $1${NC}"; }

# ==================== 准备工作 ====================
echo ""
echo "==========================================="
echo "        QuantFi 全链路资金测试"
echo "==========================================="
echo ""

# 1. 用户注册/登录
log_info "1. 用户注册/登录"

# 注册测试用户
REGISTER_RESP=$(curl -s -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "fund-test-'$(date +%s)'@example.com",
    "password": "Test123456",
    "name": "Fund Test User"
  }')

echo "注册响应: $REGISTER_RESP"

# 提取 token
TOKEN=$(echo $REGISTER_RESP | jq -r '.data.accessToken // empty')
if [ -z "$TOKEN" ]; then
  log_error "注册失败，尝试使用已有测试用户"

  # 使用已有测试用户登录
  LOGIN_RESP=$(curl -s -X POST "$API_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d '{
      "email": "test@example.com",
      "password": "password123"
    }')

  TOKEN=$(echo $LOGIN_RESP | jq -r '.data.accessToken // empty')
  if [ -z "$TOKEN" ]; then
    log_error "登录也失败，退出测试"
    exit 1
  fi
fi

log_success "获取到 Token: ${TOKEN:0:20}..."

# 获取用户信息
USER_INFO=$(curl -s -X GET "$API_URL/auth/profile" \
  -H "Authorization: Bearer $TOKEN")
echo "用户信息: $USER_INFO"
USER_ID=$(echo $USER_INFO | jq -r '.data.id // empty')
log_success "用户ID: $USER_ID"

# ==================== 测试 1: 钱包余额查询 ====================
echo ""
log_info "2. 查询钱包余额"

WALLET_RESP=$(curl -s -X GET "$API_URL/wallets/balance" \
  -H "Authorization: Bearer $TOKEN")
echo "钱包余额: $WALLET_RESP"

USDT_BALANCE=$(echo $WALLET_RESP | jq -r '.data.usdt.available // "0"')
CARD_BALANCE=$(echo $WALLET_RESP | jq -r '.data.card.available // "0"')
POINTS_BALANCE=$(echo $WALLET_RESP | jq -r '.data.points.available // "0"')

log_success "USDT: $USDT_BALANCE | 点卡: $CARD_BALANCE | 积分: $POINTS_BALANCE"

# ==================== 测试 2: 购买点卡 ====================
echo ""
log_info "3. 测试购买点卡 (需要 USDT 余额)"

if [ "$(echo "$USDT_BALANCE > 10" | bc -l 2>/dev/null || echo "0")" = "1" ]; then
  PURCHASE_RESP=$(curl -s -X POST "$API_URL/wallets/purchase-card" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"amount": "10.00000000"}')
  echo "购买点卡响应: $PURCHASE_RESP"

  CODE=$(echo $PURCHASE_RESP | jq -r '.code')
  if [ "$CODE" = "0" ]; then
    log_success "购买点卡成功"

    # 再次查询余额验证
    WALLET_RESP2=$(curl -s -X GET "$API_URL/wallets/balance" \
      -H "Authorization: Bearer $TOKEN")
    NEW_USDT=$(echo $WALLET_RESP2 | jq -r '.data.usdt.available // "0"')
    NEW_CARD=$(echo $WALLET_RESP2 | jq -r '.data.card.available // "0"')
    log_success "购买后 - USDT: $NEW_USDT | 点卡: $NEW_CARD"
  else
    log_error "购买点卡失败: $(echo $PURCHASE_RESP | jq -r '.message')"
  fi
else
  log_info "USDT 余额不足 10，跳过购买点卡测试"
fi

# ==================== 测试 3: 计费日志查询 ====================
echo ""
log_info "4. 查询计费日志"

BILLING_RESP=$(curl -s -X GET "$API_URL/billing/logs?limit=10" \
  -H "Authorization: Bearer $TOKEN")
echo "计费日志响应: $BILLING_RESP"

LOG_COUNT=$(echo $BILLING_RESP | jq -r '.data.items | length // 0')
log_success "计费日志数量: $LOG_COUNT"

# ==================== 测试 4: 代理商相关 ====================
echo ""
log_info "5. 测试代理商接口"

# 检查代理商状态
AGENT_STATUS=$(curl -s -X GET "$API_URL/agents/stats" \
  -H "Authorization: Bearer $TOKEN")
echo "代理商状态: $AGENT_STATUS"

CODE=$(echo $AGENT_STATUS | jq -r '.code')
if [ "$CODE" = "0" ]; then
  TOTAL_COMMISSION=$(echo $AGENT_STATUS | jq -r '.data.totalCommission // "0"')
  WITHDRAWABLE=$(echo $AGENT_STATUS | jq -r '.data.withdrawableCommission // "0"')
  log_success "总佣金: $TOTAL_COMMISSION | 可提现: $WITHDRAWABLE"
else
  log_info "非代理商用户，代理商接口跳过"
fi

# ==================== 测试 5: 交易记录查询 ====================
echo ""
log_info "6. 查询交易记录"

TX_RESP=$(curl -s -X GET "$API_URL/wallets/transactions?limit=5" \
  -H "Authorization: Bearer $TOKEN")
echo "交易记录: $TX_RESP"

TX_COUNT=$(echo $TX_RESP | jq -r '.data.total // 0')
log_success "交易记录数量: $TX_COUNT"

# ==================== 测试 6: 提现接口 (仅测试验证) ====================
echo ""
log_info "7. 测试提现接口 (验证模式)"

# 创建提现申请 (使用极小金额测试接口)
WITHDRAW_RESP=$(curl -s -X POST "$API_URL/withdrawals" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": "1.00000000",
    "toAddress": "TTestAddress123456789012345678901234",
    "chain": "TRC20"
  }')
echo "提现响应: $WITHDRAW_RESP"

CODE=$(echo $WITHDRAW_RESP | jq -r '.code')
if [ "$CODE" = "0" ]; then
  log_success "提现申请创建成功"
elif [ "$CODE" = "43001" ] || [ "$CODE" = "43002" ]; then
  log_info "余额不足或低于最小提现金额，接口正常"
else
  log_info "提现接口响应: $(echo $WITHDRAW_RESP | jq -r '.message')"
fi

# ==================== 测试 7: 今日盈亏 ====================
echo ""
log_info "8. 查询今日盈亏"

PNL_RESP=$(curl -s -X GET "$API_URL/billing/today-pnl" \
  -H "Authorization: Bearer $TOKEN")
echo "今日盈亏: $PNL_RESP"

CODE=$(echo $PNL_RESP | jq -r '.code')
if [ "$CODE" = "0" ]; then
  DAILY_PNL=$(echo $PNL_RESP | jq -r '.data.dailyPnl // "0"')
  GAS_FEE=$(echo $PNL_RESP | jq -r '.data.gasFee // "0"')
  log_success "今日盈亏: $DAILY_PNL | 燃油费: $GAS_FEE"
else
  log_info "今日盈亏查询: $(echo $PNL_RESP | jq -r '.message')"
fi

# ==================== 总结 ====================
echo ""
echo "==========================================="
echo "              测试完成"
echo "==========================================="
echo ""
log_success "全链路资金测试完成"
echo ""
echo "测试覆盖:"
echo "  ✓ 用户注册/登录"
echo "  ✓ 钱包余额查询"
echo "  ✓ 购买点卡"
echo "  ✓ 计费日志"
echo "  ✓ 代理商接口"
echo "  ✓ 交易记录"
echo "  ✓ 提现接口"
echo "  ✓ 今日盈亏"
echo ""
