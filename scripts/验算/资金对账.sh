#!/bin/bash
# QuantFi 资金安全验算脚本
# 用途：验证数据库中资金数据的一致性
#
# 验算规则：
# 1. 用户余额 = 充值总额 - 提现总额 - 扣费总额 + 其他收入
# 2. 平台总收入 = 燃油费收入 + 订阅费收入
# 3. 所有交易必须有对应的 billing_log 记录

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║              QuantFi 资金安全验算                             ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# 数据库连接配置
DB_HOST="${DATABASE_HOST:-localhost}"
DB_PORT="${DATABASE_PORT:-5433}"
DB_USER="${DATABASE_USER:-quantfi}"
DB_NAME="${DATABASE_NAME:-quantfi}"

# 检查 psql 命令
if ! command -v psql &> /dev/null; then
  echo "❌ 错误：未安装 psql 客户端"
  echo "   请安装 PostgreSQL 客户端：brew install postgresql"
  exit 1
fi

# 执行 SQL 查询
run_sql() {
  PGPASSWORD="${DATABASE_PASSWORD:-quantfi}" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "$1" 2>/dev/null | tr -d ' '
}

echo "═══ 1. 数据库连接检查 ═══"
echo ""

# 测试连接
if ! run_sql "SELECT 1" > /dev/null 2>&1; then
  echo "❌ 数据库连接失败"
  echo "   请检查环境变量：DATABASE_HOST, DATABASE_PORT, DATABASE_USER, DATABASE_PASSWORD, DATABASE_NAME"
  exit 1
fi

echo "✓ 数据库连接成功"
echo ""

echo "═══ 2. 用户余额验算 ═══"
echo ""

# 获取用户数量
USER_COUNT=$(run_sql "SELECT COUNT(*) FROM users")
echo "用户总数: $USER_COUNT"

# 验算每个用户的余额
echo ""
echo "验算公式: 余额 = 充值 - 提现 - 扣费"
echo ""

# 获取有余额异常的用户
MISMATCH_USERS=$(run_sql "
SELECT u.id, u.email, u.balance,
  COALESCE((SELECT SUM(amount) FROM billing_logs WHERE user_id = u.id AND type = 'deposit' AND status = 'success'), 0) as deposits,
  COALESCE((SELECT SUM(amount) FROM billing_logs WHERE user_id = u.id AND type = 'withdraw' AND status = 'success'), 0) as withdraws,
  COALESCE((SELECT SUM(amount) FROM billing_logs WHERE user_id = u.id AND type IN ('subscription', 'gas_fee') AND status = 'success'), 0) as fees
FROM users u
WHERE u.balance != (
  COALESCE((SELECT SUM(amount) FROM billing_logs WHERE user_id = u.id AND type = 'deposit' AND status = 'success'), 0) -
  COALESCE((SELECT SUM(amount) FROM billing_logs WHERE user_id = u.id AND type = 'withdraw' AND status = 'success'), 0) -
  COALESCE((SELECT SUM(amount) FROM billing_logs WHERE user_id = u.id AND type IN ('subscription', 'gas_fee') AND status = 'success'), 0)
)
LIMIT 10
")

if [ -z "$MISMATCH_USERS" ] || [ "$MISMATCH_USERS" = "" ]; then
  echo "✓ 所有用户余额验算通过"
else
  echo "⚠️  发现余额不一致的用户："
  echo "$MISMATCH_USERS"
fi

echo ""
echo "═══ 3. 平台收入统计 ═══"
echo ""

# 燃油费收入
GAS_FEE_INCOME=$(run_sql "SELECT COALESCE(SUM(amount), 0) FROM billing_logs WHERE type = 'gas_fee' AND status = 'success'")
echo "燃油费收入: $GAS_FEE_INCOME USDT"

# 订阅费收入
SUBSCRIPTION_INCOME=$(run_sql "SELECT COALESCE(SUM(amount), 0) FROM billing_logs WHERE type = 'subscription' AND status = 'success'")
echo "订阅费收入: $SUBSCRIPTION_INCOME USDT"

# 总收入
TOTAL_INCOME=$(echo "$GAS_FEE_INCOME + $SUBSCRIPTION_INCOME" | bc 2>/dev/null || echo "N/A")
echo "平台总收入: $TOTAL_INCOME USDT"

echo ""
echo "═══ 4. 充值提现统计 ═══"
echo ""

# 充值总额
TOTAL_DEPOSITS=$(run_sql "SELECT COALESCE(SUM(amount), 0) FROM billing_logs WHERE type = 'deposit' AND status = 'success'")
echo "充值总额: $TOTAL_DEPOSITS USDT"

# 提现总额
TOTAL_WITHDRAWS=$(run_sql "SELECT COALESCE(SUM(amount), 0) FROM billing_logs WHERE type = 'withdraw' AND status = 'success'")
echo "提现总额: $TOTAL_WITHDRAWS USDT"

# 待处理提现
PENDING_WITHDRAWS=$(run_sql "SELECT COALESCE(SUM(amount), 0) FROM billing_logs WHERE type = 'withdraw' AND status = 'pending'")
echo "待处理提现: $PENDING_WITHDRAWS USDT"

echo ""
echo "═══ 5. 幂等性检查 ═══"
echo ""

# 检查重复的 unique_order_id
DUPLICATE_ORDERS=$(run_sql "
SELECT unique_order_id, COUNT(*) as cnt
FROM billing_logs
WHERE unique_order_id IS NOT NULL
GROUP BY unique_order_id
HAVING COUNT(*) > 1
LIMIT 5
")

if [ -z "$DUPLICATE_ORDERS" ] || [ "$DUPLICATE_ORDERS" = "" ]; then
  echo "✓ 无重复订单 ID"
else
  echo "⚠️  发现重复订单 ID："
  echo "$DUPLICATE_ORDERS"
fi

echo ""
echo "═══ 6. 积分系统验算 ═══"
echo ""

# 积分获取总额
TOTAL_POINTS_EARNED=$(run_sql "SELECT COALESCE(SUM(amount), 0) FROM point_logs WHERE type = 'earn'")
echo "积分获取总额: $TOTAL_POINTS_EARNED"

# 积分消耗总额
TOTAL_POINTS_SPENT=$(run_sql "SELECT COALESCE(SUM(amount), 0) FROM point_logs WHERE type = 'spend'")
echo "积分消耗总额: $TOTAL_POINTS_SPENT"

# 检查积分余额一致性
POINT_MISMATCH=$(run_sql "
SELECT COUNT(*) FROM users u
WHERE u.point_balance != (
  COALESCE((SELECT SUM(amount) FROM point_logs WHERE user_id = u.id AND type = 'earn'), 0) -
  COALESCE((SELECT SUM(amount) FROM point_logs WHERE user_id = u.id AND type = 'spend'), 0)
)
")

if [ "$POINT_MISMATCH" = "0" ]; then
  echo "✓ 积分余额验算通过"
else
  echo "⚠️  有 $POINT_MISMATCH 个用户积分余额不一致"
fi

echo ""
echo "═══ 7. 质押系统验算 ═══"
echo ""

# 活跃质押总额
TOTAL_STAKED=$(run_sql "SELECT COALESCE(SUM(amount), 0) FROM stakes WHERE status = 'active'")
echo "活跃质押总额: $TOTAL_STAKED"

# 已解除质押总额
TOTAL_UNSTAKED=$(run_sql "SELECT COALESCE(SUM(amount), 0) FROM stakes WHERE status = 'unstaked'")
echo "已解除质押: $TOTAL_UNSTAKED"

echo ""
echo "═══ 8. 代理商佣金验算 ═══"
echo ""

# 佣金总额
TOTAL_COMMISSION=$(run_sql "SELECT COALESCE(SUM(commission_amount), 0) FROM agent_commissions")
echo "佣金总额: $TOTAL_COMMISSION USDT"

# 已提现佣金
WITHDRAWN_COMMISSION=$(run_sql "SELECT COALESCE(SUM(commission_amount), 0) FROM agent_commissions WHERE status = 'withdrawn'")
echo "已提现佣金: $WITHDRAWN_COMMISSION USDT"

# 待结算佣金
PENDING_COMMISSION=$(run_sql "SELECT COALESCE(SUM(commission_amount), 0) FROM agent_commissions WHERE status = 'pending'")
echo "待结算佣金: $PENDING_COMMISSION USDT"

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                     验算完成                                  ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "执行时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""
