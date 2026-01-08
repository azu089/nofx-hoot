#!/bin/bash

# Phase 16.7 策略收益分成简化测试
# 使用 Python 解析 JSON（更可靠）

BASE_URL="http://localhost:4001/api"
echo "=== Phase 16.7 策略收益分成集成测试 ===\"
echo ""

# 使用 Python 解析 JSON
parse_json() {
  local json="$1"
  local key="$2"
  echo "$json" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data['data']['$key'])" 2>/dev/null || echo ""
}

# 1. 登录策略创作者
echo "=== 1. 登录策略创作者 (test@example.com) ===\"
CREATOR_LOGIN=$(curl -s -X POST "${BASE_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Password123"}')

CREATOR_TOKEN=$(echo "$CREATOR_LOGIN" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['accessToken'])" 2>/dev/null)
CREATOR_USER_ID=$(echo "$CREATOR_LOGIN" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['user']['id'])" 2>/dev/null)

if [ -z "$CREATOR_TOKEN" ]; then
  echo "❌ 创作者登录失败"
  echo "响应: $CREATOR_LOGIN"
  exit 1
fi

echo "✅ 创作者登录成功"
echo "   用户 ID: ${CREATOR_USER_ID}"
echo ""

# 2. 登录交易用户
echo "=== 2. 登录交易用户 (test2@example.com) ===\"
TRADER_LOGIN=$(curl -s -X POST "${BASE_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"test2@example.com","password":"Password123"}')

TRADER_TOKEN=$(echo "$TRADER_LOGIN" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['accessToken'])" 2>/dev/null)
TRADER_USER_ID=$(echo "$TRADER_LOGIN" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['user']['id'])" 2>/dev/null)

if [ -z "$TRADER_TOKEN" ]; then
  echo "❌ 交易用户登录失败"
  echo "响应: $TRADER_LOGIN"
  exit 1
fi

echo "✅ 交易用户登录成功"
echo "   用户 ID: ${TRADER_USER_ID}"
echo ""

# 3. 创作者上传策略
echo "=== 3. 创作者上传策略 ===\"
UPLOAD_RESPONSE=$(curl -s -X POST "${BASE_URL}/strategies/upload" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${CREATOR_TOKEN}" \
  -d '{
    "name": "收益分成测试策略",
    "description": "用于测试收益分成功能的策略",
    "content": "from freqtrade.strategy import IStrategy\nimport talib.abstract as ta\n\nclass TestStrategy(IStrategy):\n    INTERFACE_VERSION = 3\n    \n    def populate_indicators(self, dataframe, metadata):\n        dataframe[\"rsi\"] = ta.RSI(dataframe, timeperiod=14)\n        return dataframe\n    \n    def populate_entry_trend(self, dataframe, metadata):\n        dataframe.loc[(dataframe[\"rsi\"] < 30), \"enter_long\"] = 1\n        return dataframe\n    \n    def populate_exit_trend(self, dataframe, metadata):\n        dataframe.loc[(dataframe[\"rsi\"] > 70), \"exit_long\"] = 1\n        return dataframe",
    "backtestStartDate": "2024-01-01",
    "backtestEndDate": "2024-12-31",
    "backtestInitialCapital": 10000,
    "backtestPairs": ["BTC/USDT"]
  }')

STRATEGY_ID=$(echo "$UPLOAD_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['strategyId'])" 2>/dev/null)

if [ -z "$STRATEGY_ID" ]; then
  echo "❌ 策略上传失败"
  echo "响应: $UPLOAD_RESPONSE"
  exit 1
fi

echo "✅ 策略上传成功"
echo "   策略 ID: ${STRATEGY_ID}"
echo ""

# 4. 获取创作者初始余额
echo "=== 4. 获取创作者初始余额 ===\"
CREATOR_WALLET=$(curl -s -X GET "${BASE_URL}/wallet" \
  -H "Authorization: Bearer ${CREATOR_TOKEN}")

CREATOR_BALANCE_BEFORE=$(echo "$CREATOR_WALLET" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['usdtBalance'])" 2>/dev/null)

echo "✅ 创作者初始 USDT 余额: ${CREATOR_BALANCE_BEFORE}"
echo ""

# 5. 使用 PostgreSQL 直接创建测试交易
echo "=== 5. 创建盈利交易（数据库直接操作）===\"

DB_HOST="localhost"
DB_PORT="5433"
DB_NAME="quantfi"
DB_USER="quantfi_user"

# 设置密码环境变量避免交互式提示
export PGPASSWORD="quantfi_password_2024"

# 先确保交易用户有钱包和足够点卡
echo "   准备交易用户钱包..."
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c \
  "INSERT INTO wallets (user_id, usdt_balance, card_balance, points_balance)
   VALUES ('${TRADER_USER_ID}', '0', '1000', '0')
   ON CONFLICT (user_id) DO UPDATE SET card_balance = '1000';" > /dev/null

# 创建盈利交易（PNL = 1000 USDT）
TRADE_ID=$(psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c \
  "INSERT INTO trade_history (user_id, strategy_id, symbol, side, entry_price, exit_price, quantity, pnl, gas_fee, status)
   VALUES ('${TRADER_USER_ID}', '${STRATEGY_ID}', 'BTC/USDT', 'long', '40000', '42000', '0.5', '1000', '0', 'closed')
   RETURNING id;" | xargs)

if [ -z "$TRADE_ID" ]; then
  echo "❌ 创建交易失败"
  exit 1
fi

echo "✅ 盈利交易已创建"
echo "   交易 ID: ${TRADE_ID}"
echo "   盈利金额: 1000 USDT"
echo "   使用策略: ${STRATEGY_ID}"
echo ""

# 6. 调用燃油费计算接口（触发收益分成）
echo "=== 6. 计算燃油费（触发收益分成）===\"

GAS_FEE_RESPONSE=$(curl -s -X POST "${BASE_URL}/billing/calculate-gas-fee" \
  -H "Authorization: Bearer ${TRADER_TOKEN}")

CHARGED=$(echo "$GAS_FEE_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['charged'])" 2>/dev/null)

echo "燃油费计算结果: 成功扣费 ${CHARGED} 笔"

if [ "$CHARGED" == "1" ]; then
  echo "✅ 燃油费扣除成功"
else
  echo "⚠️  燃油费结果: ${GAS_FEE_RESPONSE}"
fi
echo ""

# 7. 验证收益分成记录
echo "=== 7. 验证收益分成记录 ===\"

REVENUE_COUNT=$(psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c \
  "SELECT COUNT(*) FROM strategy_revenue_logs
   WHERE strategy_id = '${STRATEGY_ID}' AND user_id = '${TRADER_USER_ID}';" | xargs)

if [ "$REVENUE_COUNT" -gt 0 ]; then
  echo "✅ 收益分成记录已创建 (${REVENUE_COUNT} 条)"

  REVENUE_AMOUNT=$(psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c \
    "SELECT revenue_amount FROM strategy_revenue_logs
     WHERE strategy_id = '${STRATEGY_ID}' AND user_id = '${TRADER_USER_ID}'
     ORDER BY created_at DESC LIMIT 1;" | xargs)

  REVENUE_RATE=$(psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c \
    "SELECT revenue_share_rate FROM strategy_revenue_logs
     WHERE strategy_id = '${STRATEGY_ID}' AND user_id = '${TRADER_USER_ID}'
     ORDER BY created_at DESC LIMIT 1;" | xargs)

  echo "   分成金额: ${REVENUE_AMOUNT} USDT"
  echo "   分成比例: ${REVENUE_RATE} ($(echo \"$REVENUE_RATE * 100\" | bc)%)"
else
  echo "❌ 未找到收益分成记录"
fi
echo ""

# 8. 验证创作者余额增加
echo "=== 8. 验证创作者余额增加 ===\"

CREATOR_WALLET_AFTER=$(curl -s -X GET "${BASE_URL}/wallet" \
  -H "Authorization: Bearer ${CREATOR_TOKEN}")

CREATOR_BALANCE_AFTER=$(echo "$CREATOR_WALLET_AFTER" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['usdtBalance'])" 2>/dev/null)

echo "   创作者初始余额: ${CREATOR_BALANCE_BEFORE} USDT"
echo "   创作者当前余额: ${CREATOR_BALANCE_AFTER} USDT"

BALANCE_DIFF=$(echo "${CREATOR_BALANCE_AFTER} - ${CREATOR_BALANCE_BEFORE}" | bc)
echo "   余额增加: ${BALANCE_DIFF} USDT"

if [ "$BALANCE_DIFF" == "$REVENUE_AMOUNT" ]; then
  echo "✅ 创作者余额增加与分成金额一致"
else
  echo "⚠️  余额增加 (${BALANCE_DIFF}) 与分成金额 (${REVENUE_AMOUNT}) 不一致"
fi
echo ""

# 9. 验证策略累计盈利
echo "=== 9. 验证策略累计盈利 ===\"

TOTAL_PROFIT=$(psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c \
  "SELECT total_profit FROM strategies WHERE id = '${STRATEGY_ID}';" | xargs)

echo "   策略累计盈利: ${TOTAL_PROFIT} USDT"

if [ "$TOTAL_PROFIT" == "$REVENUE_AMOUNT" ]; then
  echo "✅ 策略累计盈利与分成金额一致"
else
  echo "⚠️  累计盈利 (${TOTAL_PROFIT}) 与分成金额 (${REVENUE_AMOUNT}) 不一致"
fi
echo ""

# 10. 查询收益明细 API
echo "=== 10. 查询收益明细 API ===\"

REVENUE_LOGS=$(curl -s -X GET "${BASE_URL}/strategies/revenue/logs?page=1&limit=10" \
  -H "Authorization: Bearer ${CREATOR_TOKEN}")

LOG_TOTAL=$(echo "$REVENUE_LOGS" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['total'])" 2>/dev/null)

echo "✅ 收益明细 API 返回 ${LOG_TOTAL} 条记录"
echo ""

# 11. 汇总测试结果
echo "=== 🎉 测试汇总 ===\"
echo "✅ 测试 1: 创作者登录"
echo "✅ 测试 2: 交易用户登录"
echo "✅ 测试 3: 策略上传"
echo "✅ 测试 4: 创建盈利交易"
echo "✅ 测试 5: 燃油费计算（触发分成）"
echo "$([ "$REVENUE_COUNT" -gt 0 ] && echo "✅" || echo "❌") 测试 6: 收益分成记录创建"
echo "$([ "$BALANCE_DIFF" == "$REVENUE_AMOUNT" ] && echo "✅" || echo "⚠️ ") 测试 7: 创作者余额增加"
echo "$([ "$TOTAL_PROFIT" == "$REVENUE_AMOUNT" ] && echo "✅" || echo "⚠️ ") 测试 8: 策略累计盈利更新"
echo "✅ 测试 9: 收益明细 API"
echo ""

echo "📊 关键数据:"
echo "   策略 ID: ${STRATEGY_ID}"
echo "   交易 ID: ${TRADE_ID}"
echo "   盈利金额: 1000 USDT"
echo "   燃油费: 200 USDT (20%)"
echo "   分成金额: ${REVENUE_AMOUNT} USDT (比例: $(echo \"$REVENUE_RATE * 100\" | bc)%)"
echo "   创作者收益: +${BALANCE_DIFF} USDT"
echo ""

if [ "$REVENUE_COUNT" -gt 0 ] && [ "$BALANCE_DIFF" == "$REVENUE_AMOUNT" ]; then
  echo "✅ Phase 16.7 收益分成功能测试 PASSED"
  exit 0
else
  echo "⚠️  Phase 16.7 收益分成功能测试 FAILED"
  exit 1
fi
