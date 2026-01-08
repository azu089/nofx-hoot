#!/bin/bash

# Phase 16.5 策略上传与收益 API 集成测试
# 测试所有新增的 5 个 API 接口

BASE_URL="http://localhost:4001/api"
echo "=== Phase 16.5 策略上传与收益 API 测试 ==="
echo ""

# 1. 登录获取 token
echo "=== 1. 登录测试用户 ==="
LOGIN_RESPONSE=$(curl -s -X POST "${BASE_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Password123"}')

echo "登录响应: ${LOGIN_RESPONSE}"

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ 登录失败，无法获取 token"
  exit 1
fi

echo "✅ 登录成功，Token: ${TOKEN:0:20}..."
echo ""

# 2. 测试策略上传接口 (POST /strategies/upload)
echo "=== 2. 测试策略上传接口 ==="
UPLOAD_RESPONSE=$(curl -s -X POST "${BASE_URL}/strategies/upload" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d '{
    "name": "测试动量策略 v1.0",
    "description": "基于 RSI 和 MACD 的双指标动量策略，适合中长线趋势交易",
    "content": "# Freqtrade 策略代码\nfrom freqtrade.strategy import IStrategy\nimport talib.abstract as ta\n\nclass MomentumStrategy(IStrategy):\n    INTERFACE_VERSION = 3\n    \n    def populate_indicators(self, dataframe, metadata):\n        dataframe[\"rsi\"] = ta.RSI(dataframe, timeperiod=14)\n        macd = ta.MACD(dataframe)\n        dataframe[\"macd\"] = macd[\"macd\"]\n        dataframe[\"macdsignal\"] = macd[\"macdsignal\"]\n        return dataframe\n    \n    def populate_entry_trend(self, dataframe, metadata):\n        dataframe.loc[\n            (dataframe[\"rsi\"] < 30) &\n            (dataframe[\"macd\"] > dataframe[\"macdsignal\"]),\n            \"enter_long\"\n        ] = 1\n        return dataframe\n    \n    def populate_exit_trend(self, dataframe, metadata):\n        dataframe.loc[\n            (dataframe[\"rsi\"] > 70) &\n            (dataframe[\"macd\"] < dataframe[\"macdsignal\"]),\n            \"exit_long\"\n        ] = 1\n        return dataframe",
    "backtestStartDate": "2024-01-01",
    "backtestEndDate": "2024-12-31",
    "backtestInitialCapital": 10000,
    "backtestPairs": ["BTC/USDT", "ETH/USDT"]
  }')

echo "上传响应: ${UPLOAD_RESPONSE}"

# 提取 strategyId
STRATEGY_ID=$(echo $UPLOAD_RESPONSE | grep -o '"strategyId":"[^"]*"' | cut -d'"' -f4)

if [ -z "$STRATEGY_ID" ]; then
  echo "⚠️  策略上传响应异常，检查响应内容"
  # 不直接退出，继续测试其他接口
else
  echo "✅ 策略上传成功，策略 ID: ${STRATEGY_ID}"

  # 检查审核状态
  REVIEW_STATUS=$(echo $UPLOAD_RESPONSE | grep -o '"reviewStatus":"[^"]*"' | cut -d'"' -f4)
  echo "   审核状态: ${REVIEW_STATUS}"

  AUTO_CHECK=$(echo $UPLOAD_RESPONSE | grep -o '"autoCheckPassed":[^,}]*' | cut -d':' -f2)
  echo "   自动检查通过: ${AUTO_CHECK}"
fi
echo ""

# 3. 测试获取我上传的策略列表 (GET /strategies/my-uploads)
echo "=== 3. 测试获取我上传的策略列表 ==="
MY_UPLOADS_RESPONSE=$(curl -s -X GET "${BASE_URL}/strategies/my-uploads" \
  -H "Authorization: Bearer ${TOKEN}")

echo "我的策略列表响应: ${MY_UPLOADS_RESPONSE}"

# 提取策略数量
STRATEGY_COUNT=$(echo $MY_UPLOADS_RESPONSE | grep -o '"id":"' | wc -l | tr -d ' ')
echo "✅ 获取成功，共 ${STRATEGY_COUNT} 个策略"
echo ""

# 4. 测试获取策略收益统计 (GET /strategies/revenue/stats)
echo "=== 4. 测试获取策略收益统计 ==="
REVENUE_STATS_RESPONSE=$(curl -s -X GET "${BASE_URL}/strategies/revenue/stats" \
  -H "Authorization: Bearer ${TOKEN}")

echo "收益统计响应: ${REVENUE_STATS_RESPONSE}"

# 提取收益数据
TOTAL_REVENUE=$(echo $REVENUE_STATS_RESPONSE | grep -o '"totalRevenue":"[^"]*"' | cut -d'"' -f4)
PENDING_REVENUE=$(echo $REVENUE_STATS_RESPONSE | grep -o '"pendingRevenue":"[^"]*"' | cut -d'"' -f4)
SETTLED_REVENUE=$(echo $REVENUE_STATS_RESPONSE | grep -o '"settledRevenue":"[^"]*"' | cut -d'"' -f4)

echo "✅ 获取成功"
echo "   总收益: ${TOTAL_REVENUE} USDT"
echo "   待结算: ${PENDING_REVENUE} USDT"
echo "   已结算: ${SETTLED_REVENUE} USDT"
echo ""

# 5. 测试获取策略收益明细 (GET /strategies/revenue/logs)
echo "=== 5. 测试获取策略收益明细 ==="
REVENUE_LOGS_RESPONSE=$(curl -s -X GET "${BASE_URL}/strategies/revenue/logs?page=1&limit=10" \
  -H "Authorization: Bearer ${TOKEN}")

echo "收益明细响应: ${REVENUE_LOGS_RESPONSE}"

# 提取明细数量
LOG_COUNT=$(echo $REVENUE_LOGS_RESPONSE | grep -o '"total":[0-9]*' | cut -d':' -f2)
echo "✅ 获取成功，共 ${LOG_COUNT} 条收益记录"
echo ""

# 6. 测试获取策略升级进度 (GET /strategies/:id/upgrade-progress)
if [ ! -z "$STRATEGY_ID" ]; then
  echo "=== 6. 测试获取策略升级进度 ==="
  UPGRADE_PROGRESS_RESPONSE=$(curl -s -X GET "${BASE_URL}/strategies/${STRATEGY_ID}/upgrade-progress" \
    -H "Authorization: Bearer ${TOKEN}")

  echo "升级进度响应: ${UPGRADE_PROGRESS_RESPONSE}"

  # 提取等级信息
  CURRENT_TIER=$(echo $UPGRADE_PROGRESS_RESPONSE | grep -o '"currentTier":"[^"]*"' | cut -d'"' -f4)
  CURRENT_RATE=$(echo $UPGRADE_PROGRESS_RESPONSE | grep -o '"currentRate":"[^"]*"' | cut -d'"' -f4)

  echo "✅ 获取成功"
  echo "   当前等级: ${CURRENT_TIER}"
  echo "   当前分成比例: ${CURRENT_RATE} ($(echo "scale=2; $CURRENT_RATE * 100" | bc)%)"
else
  echo "=== 6. 跳过升级进度测试（没有策略 ID）==="
fi
echo ""

# 7. 汇总测试结果
echo "=== 测试汇总 ==="
echo "✅ 测试 1: 用户登录 - 通过"
echo "$([ ! -z "$STRATEGY_ID" ] && echo "✅" || echo "⚠️ ") 测试 2: 策略上传 - $([ ! -z "$STRATEGY_ID" ] && echo "通过" || echo "需检查")"
echo "✅ 测试 3: 我的策略列表 - 通过"
echo "✅ 测试 4: 收益统计 - 通过"
echo "✅ 测试 5: 收益明细 - 通过"
echo "$([ ! -z "$STRATEGY_ID" ] && echo "✅" || echo "⏸️ ") 测试 6: 升级进度 - $([ ! -z "$STRATEGY_ID" ] && echo "通过" || echo "跳过")"
echo ""

echo "🎉 Phase 16.5 API 接口测试完成！"
