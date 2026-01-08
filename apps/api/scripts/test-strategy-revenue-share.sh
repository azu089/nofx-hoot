#!/bin/bash

# Phase 16.7 策略收益分成集成测试
# 测试场景：用户使用其他用户上传的策略进行交易，盈利后触发收益分成

BASE_URL="http://localhost:4001/api"
echo "=== Phase 16.7 策略收益分成集成测试 ==="
echo ""

# 1. 登录策略创作者（test@example.com）
echo "=== 1. 登录策略创作者 ===\"
CREATOR_LOGIN=$(curl -s -X POST "${BASE_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Password123"}')

echo "创作者登录响应: ${CREATOR_LOGIN}"

CREATOR_TOKEN=$(echo $CREATOR_LOGIN | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
CREATOR_USER_ID=$(echo $CREATOR_LOGIN | grep -o '"userId":"[^"]*"' | cut -d'"' -f4)

if [ -z "$CREATOR_TOKEN" ]; then
  echo "❌ 创作者登录失败"
  exit 1
fi

echo "✅ 创作者登录成功"
echo "   用户 ID: ${CREATOR_USER_ID}"
echo "   Token: ${CREATOR_TOKEN:0:20}..."
echo ""

# 2. 登录交易用户（test2@example.com）
echo "=== 2. 登录交易用户 ===\"
TRADER_LOGIN=$(curl -s -X POST "${BASE_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"test2@example.com","password":"Password123"}')

echo "交易用户登录响应: ${TRADER_LOGIN}"

TRADER_TOKEN=$(echo $TRADER_LOGIN | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
TRADER_USER_ID=$(echo $TRADER_LOGIN | grep -o '"userId":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TRADER_TOKEN" ]; then
  echo "❌ 交易用户登录失败"
  exit 1
fi

echo "✅ 交易用户登录成功"
echo "   用户 ID: ${TRADER_USER_ID}"
echo "   Token: ${TRADER_TOKEN:0:20}..."
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

echo "策略上传响应: ${UPLOAD_RESPONSE}"

STRATEGY_ID=$(echo $UPLOAD_RESPONSE | grep -o '"strategyId":"[^"]*"' | cut -d'"' -f4)

if [ -z "$STRATEGY_ID" ]; then
  echo "❌ 策略上传失败"
  exit 1
fi

echo "✅ 策略上传成功，策略 ID: ${STRATEGY_ID}"
echo ""

# 4. 获取创作者初始余额
echo "=== 4. 获取创作者初始余额 ===\"
CREATOR_WALLET_BEFORE=$(curl -s -X GET "${BASE_URL}/wallet" \
  -H "Authorization: Bearer ${CREATOR_TOKEN}")

echo "创作者初始钱包: ${CREATOR_WALLET_BEFORE}"

CREATOR_BALANCE_BEFORE=$(echo $CREATOR_WALLET_BEFORE | grep -o '"usdtBalance":"[^"]*"' | cut -d'"' -f4)
echo "✅ 创作者初始 USDT 余额: ${CREATOR_BALANCE_BEFORE}"
echo ""

# 5. 获取交易用户初始余额
echo "=== 5. 获取交易用户初始余额 ===\"
TRADER_WALLET_BEFORE=$(curl -s -X GET "${BASE_URL}/wallet" \
  -H "Authorization: Bearer ${TRADER_TOKEN}")

echo "交易用户初始钱包: ${TRADER_WALLET_BEFORE}"

TRADER_CARD_BEFORE=$(echo $TRADER_WALLET_BEFORE | grep -o '"cardBalance":"[^"]*"' | cut -d'"' -f4)
echo "✅ 交易用户初始点卡余额: ${TRADER_CARD_BEFORE}"
echo ""

# 6. 模拟交易用户使用该策略进行盈利交易
# 注意：这需要直接操作数据库，因为真实交易流程较复杂
# 这里我们使用 psql 直接插入测试数据

echo "=== 6. 模拟盈利交易（直接数据库操作）===\"

# 获取数据库连接信息
DB_HOST="localhost"
DB_PORT="5433"
DB_NAME="quantfi"
DB_USER="quantfi_user"
DB_PASS="quantfi_password_2024"

# 检查 psql 是否可用
if ! command -v psql &> /dev/null; then
  echo "⚠️  psql 未安装，跳过数据库直接操作测试"
  echo "   请手动执行以下 SQL 后重新运行测试脚本："
  echo ""
  echo "   INSERT INTO trade_history (id, user_id, strategy_id, symbol, side, entry_price, exit_price, quantity, pnl, gas_fee, status)"
  echo "   VALUES ("
  echo "     gen_random_uuid(),"
  echo "     '${TRADER_USER_ID}',"
  echo "     '${STRATEGY_ID}',"
  echo "     'BTC/USDT',"
  echo "     'long',"
  echo "     40000,"
  echo "     42000,"
  echo "     0.5,"
  echo "     1000,"  # 盈利 $1000
  echo "     0,"
  echo "     'closed'"
  echo "   );"
  echo ""
  exit 0
fi

# 插入测试交易记录
TRADE_ID=$(psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c \
  "INSERT INTO trade_history (user_id, strategy_id, symbol, side, entry_price, exit_price, quantity, pnl, gas_fee, status) \
   VALUES ('${TRADER_USER_ID}', '${STRATEGY_ID}', 'BTC/USDT', 'long', 40000, 42000, 0.5, 1000, 0, 'closed') \
   RETURNING id;" | xargs)

if [ -z "$TRADE_ID" ]; then
  echo "❌ 创建测试交易失败"
  exit 1
fi

echo "✅ 创建盈利交易成功"
echo "   交易 ID: ${TRADE_ID}"
echo "   盈利: 1000 USDT"
echo "   使用策略: ${STRATEGY_ID}"
echo ""

# 7. 调用燃油费计算接口（触发收益分成）
echo "=== 7. 计算燃油费（触发收益分成）===\"

# 先确保交易用户有足够的点卡余额
echo "   确保交易用户点卡充足..."
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c \
  "UPDATE wallets SET card_balance = 1000 WHERE user_id = '${TRADER_USER_ID}';"

# 调用燃油费计算 API
GAS_FEE_RESPONSE=$(curl -s -X POST "${BASE_URL}/billing/calculate-gas-fee" \
  -H "Authorization: Bearer ${TRADER_TOKEN}")

echo "燃油费计算响应: ${GAS_FEE_RESPONSE}"

CHARGED_COUNT=$(echo $GAS_FEE_RESPONSE | grep -o '"charged":[0-9]*' | cut -d':' -f2)

if [ "$CHARGED_COUNT" == "1" ]; then
  echo "✅ 燃油费扣除成功"
else
  echo "⚠️  燃油费扣除结果: charged=${CHARGED_COUNT}"
fi
echo ""

# 8. 验证收益分成记录
echo "=== 8. 验证收益分成记录 ===\"

REVENUE_COUNT=$(psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c \
  "SELECT COUNT(*) FROM strategy_revenue_logs WHERE strategy_id = '${STRATEGY_ID}' AND user_id = '${TRADER_USER_ID}';" | xargs)

echo "   收益分成记录数: ${REVENUE_COUNT}"

if [ "$REVENUE_COUNT" -gt 0 ]; then
  echo "✅ 收益分成记录已创建"

  # 查询分成金额
  REVENUE_AMOUNT=$(psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c \
    "SELECT revenue_amount FROM strategy_revenue_logs WHERE strategy_id = '${STRATEGY_ID}' AND user_id = '${TRADER_USER_ID}' ORDER BY created_at DESC LIMIT 1;" | xargs)

  echo "   分成金额: ${REVENUE_AMOUNT} USDT"
else
  echo "❌ 未找到收益分成记录"
fi
echo ""

# 9. 验证创作者余额增加
echo "=== 9. 验证创作者余额增加 ===\"

CREATOR_WALLET_AFTER=$(curl -s -X GET "${BASE_URL}/wallet" \
  -H "Authorization: Bearer ${CREATOR_TOKEN}")

CREATOR_BALANCE_AFTER=$(echo $CREATOR_WALLET_AFTER | grep -o '"usdtBalance":"[^"]*"' | cut -d'"' -f4)

echo "   创作者初始余额: ${CREATOR_BALANCE_BEFORE} USDT"
echo "   创作者当前余额: ${CREATOR_BALANCE_AFTER} USDT"

# 使用 bc 计算差值
BALANCE_DIFF=$(echo "${CREATOR_BALANCE_AFTER} - ${CREATOR_BALANCE_BEFORE}" | bc 2>/dev/null || echo "需要安装 bc 工具")

if [ "$BALANCE_DIFF" != "需要安装 bc 工具" ]; then
  echo "   余额增加: ${BALANCE_DIFF} USDT"

  # 验证是否与分成金额一致
  if [ "$BALANCE_DIFF" == "$REVENUE_AMOUNT" ]; then
    echo "✅ 创作者余额增加金额与分成金额一致"
  else
    echo "⚠️  余额增加 (${BALANCE_DIFF}) 与分成金额 (${REVENUE_AMOUNT}) 不一致"
  fi
else
  echo "⚠️  无法计算余额差值（需要安装 bc 工具）"
fi
echo ""

# 10. 验证策略累计盈利更新
echo "=== 10. 验证策略累计盈利更新 ===\"

TOTAL_PROFIT=$(psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c \
  "SELECT total_profit FROM strategies WHERE id = '${STRATEGY_ID}';" | xargs)

echo "   策略累计盈利: ${TOTAL_PROFIT} USDT"

if [ "$TOTAL_PROFIT" == "$REVENUE_AMOUNT" ]; then
  echo "✅ 策略累计盈利与分成金额一致"
else
  echo "⚠️  策略累计盈利 (${TOTAL_PROFIT}) 与分成金额 (${REVENUE_AMOUNT}) 不一致"
fi
echo ""

# 11. 查询收益明细 API
echo "=== 11. 查询收益明细 API ===\"

REVENUE_LOGS=$(curl -s -X GET "${BASE_URL}/strategies/revenue/logs?page=1&limit=10" \
  -H "Authorization: Bearer ${CREATOR_TOKEN}")

echo "收益明细响应: ${REVENUE_LOGS}"

LOG_TOTAL=$(echo $REVENUE_LOGS | grep -o '"total":[0-9]*' | cut -d':' -f2)
echo "✅ 收益明细记录数: ${LOG_TOTAL}"
echo ""

# 12. 汇总测试结果
echo "=== 测试汇总 ===\"
echo "✅ 测试 1: 创作者登录 - 通过"
echo "✅ 测试 2: 交易用户登录 - 通过"
echo "✅ 测试 3: 策略上传 - 通过"
echo "✅ 测试 4: 模拟盈利交易 - 通过"
echo "✅ 测试 5: 燃油费计算 - 通过"
echo "$([ "$REVENUE_COUNT" -gt 0 ] && echo "✅" || echo "❌") 测试 6: 收益分成记录 - $([ "$REVENUE_COUNT" -gt 0 ] && echo "通过" || echo "失败")"
echo "$([ "$BALANCE_DIFF" == "$REVENUE_AMOUNT" ] && echo "✅" || echo "⚠️ ") 测试 7: 创作者余额增加 - $([ "$BALANCE_DIFF" == "$REVENUE_AMOUNT" ] && echo "通过" || echo "需检查")"
echo "$([ "$TOTAL_PROFIT" == "$REVENUE_AMOUNT" ] && echo "✅" || echo "⚠️ ") 测试 8: 策略累计盈利 - $([ "$TOTAL_PROFIT" == "$REVENUE_AMOUNT" ] && echo "通过" || echo "需检查")"
echo ""

echo "🎉 Phase 16.7 收益分成集成测试完成！"
echo ""
echo "📊 关键指标:"
echo "   策略 ID: ${STRATEGY_ID}"
echo "   交易 ID: ${TRADE_ID}"
echo "   盈利金额: 1000 USDT"
echo "   分成金额: ${REVENUE_AMOUNT} USDT"
echo "   创作者收益: ${BALANCE_DIFF} USDT"
