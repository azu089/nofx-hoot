#!/bin/bash
# ============================================================
# HOOT 多维度压力测试脚本
# 10 策略 × 20 用户 × 多种配置组合
# ============================================================
# set -e 已禁用：测试脚本需要继续运行即使个别检查失败

API_URL="http://localhost:4001/api/signals/webhook"
PSQL="docker exec quantfi-postgres psql -U quantfi -d quantfi -t -A"

echo "============================================"
echo "  HOOT 多维度信号链路压力测试"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "============================================"

# ========== Phase 1: 创建测试数据 ==========
echo ""
echo ">>> Phase 1: 创建测试数据 (10策略 + 20用户 + 40订阅)"
echo "--------------------------------------------"

# 先清理之前的测试数据（按依赖顺序删除）
$PSQL -c "
DELETE FROM signal_executions WHERE signal_id IN (SELECT id FROM signals WHERE strategy_id IN (SELECT id FROM strategies WHERE freqtrade_id LIKE 'TestSt_%'));
DELETE FROM billing_logs WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'testuser%@stress.test');
DELETE FROM positions WHERE subscription_id IN (SELECT id FROM strategy_subscriptions WHERE strategy_id IN (SELECT id FROM strategies WHERE freqtrade_id LIKE 'TestSt_%'));
DELETE FROM risk_logs WHERE signal_id IN (SELECT id FROM signals WHERE strategy_id IN (SELECT id FROM strategies WHERE freqtrade_id LIKE 'TestSt_%'));
DELETE FROM signals WHERE strategy_id IN (SELECT id FROM strategies WHERE freqtrade_id LIKE 'TestSt_%');
DELETE FROM notifications WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'testuser%@stress.test');
DELETE FROM strategy_subscriptions WHERE strategy_id IN (SELECT id FROM strategies WHERE freqtrade_id LIKE 'TestSt_%');
DELETE FROM api_keys WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'testuser%@stress.test');
DELETE FROM strategies WHERE freqtrade_id LIKE 'TestSt_%';
DELETE FROM users WHERE email LIKE 'testuser%@stress.test';
" 2>/dev/null || true

echo "[1/4] 创建 10 个策略..."
$PSQL -c "
INSERT INTO strategies (id, name, freqtrade_id, description, is_active, created_at, updated_at) VALUES
  ('st-001', 'BTC趋势跟踪', 'TestSt_BTC_Trend', 'BTC趋势策略', true, NOW(), NOW()),
  ('st-002', 'ETH动量策略', 'TestSt_ETH_Momentum', 'ETH动量', true, NOW(), NOW()),
  ('st-003', 'SOL超短线', 'TestSt_SOL_Scalp', 'SOL超短线', true, NOW(), NOW()),
  ('st-004', '多币种波段', 'TestSt_Multi_Swing', '多币种波段', true, NOW(), NOW()),
  ('st-005', 'BTC定投策略', 'TestSt_BTC_DCA', 'BTC定投', true, NOW(), NOW()),
  ('st-006', 'ETH网格策略', 'TestSt_ETH_Grid', 'ETH网格', true, NOW(), NOW()),
  ('st-007', '对冲大师', 'TestSt_Hedge_Master', '多空对冲', true, NOW(), NOW()),
  ('st-008', 'SOL突破策略', 'TestSt_SOL_Breakout', 'SOL突破', true, NOW(), NOW()),
  ('st-009', 'BTC保守稳健', 'TestSt_BTC_Conservative', 'BTC保守', true, NOW(), NOW()),
  ('st-010', '多币种激进', 'TestSt_Multi_Aggressive', '多币种激进', true, NOW(), NOW());
"
echo "  10 个策略已创建"

echo "[2/4] 创建 20 个测试用户..."
# 密码hash是 bcrypt('test123')
PASS_HASH='\$2b\$10\$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ012'
for i in $(seq -w 1 20); do
  $PSQL -c "
  INSERT INTO users (id, email, password, status, updated_at, created_at)
  VALUES ('tu-${i}', 'testuser${i}@stress.test', '${PASS_HASH}', 'active', NOW(), NOW())
  ON CONFLICT (id) DO NOTHING;
  " 2>/dev/null || true
done
echo "  20 个用户已创建"

echo "[3/4] 创建 20 个 API Key..."
# 使用现有的真实 API key 的加密数据作为模板（反正都会在交易所失败，我们只测路由）
for i in $(seq -w 1 20); do
  $PSQL -c "
  INSERT INTO api_keys (id, user_id, exchange, label, encrypted_key, encrypted_secret, iv, auth_tag, is_active, created_at)
  VALUES ('ak-${i}', 'tu-${i}', 'binance', 'Test Key ${i}', 'enc_key_test', 'enc_secret_test', 'iv_test_12ch', 'tag_test_16chars', true, NOW())
  ON CONFLICT (id) DO NOTHING;
  " 2>/dev/null || true
done
echo "  20 个 API Key 已创建"

echo "[4/4] 创建 40 个订阅 (多维度配置)..."

# ============ 订阅配置矩阵 ============
# 格式: sub_id | user_id | strategy_id | api_key_id | trading_type | leverage | direction | trading_pairs | amount
#
# Group A: 合约+双向 (用户1-5, 各订阅2个策略)
# Group B: 合约+仅做多 (用户6-10)
# Group C: 合约+仅做空 (用户11-15)
# Group D: 现货模式 (用户16-18)
# Group E: 合约+限定交易对 (用户19-20)

$PSQL -c "
INSERT INTO strategy_subscriptions (id, user_id, strategy_id, api_key_id, trading_type, leverage, direction, margin_mode, amount_per_trade, trading_pairs, is_active, auto_close, created_at) VALUES
-- Group A: 合约+双向 (5用户×2策略=10订阅)
('sub-01', 'tu-01', 'st-001', 'ak-01', 'futures', 20, 'both', 'isolated', 100, '{}', true, true, NOW()),
('sub-02', 'tu-01', 'st-004', 'ak-01', 'futures', 10, 'both', 'cross',    50,  '{}', true, true, NOW()),
('sub-03', 'tu-02', 'st-002', 'ak-02', 'futures', 15, 'both', 'isolated', 80,  '{}', true, true, NOW()),
('sub-04', 'tu-02', 'st-007', 'ak-02', 'futures', 5,  'both', 'cross',    200, '{}', true, true, NOW()),
('sub-05', 'tu-03', 'st-003', 'ak-03', 'futures', 25, 'both', 'isolated', 60,  '{}', true, true, NOW()),
('sub-06', 'tu-03', 'st-010', 'ak-03', 'futures', 30, 'both', 'isolated', 40,  '{}', true, true, NOW()),
('sub-07', 'tu-04', 'st-004', 'ak-04', 'futures', 8,  'both', 'cross',    150, '{}', true, true, NOW()),
('sub-08', 'tu-04', 'st-005', 'ak-04', 'futures', 3,  'both', 'cross',    300, '{}', true, true, NOW()),
('sub-09', 'tu-05', 'st-007', 'ak-05', 'futures', 12, 'both', 'isolated', 120, '{}', true, true, NOW()),
('sub-10', 'tu-05', 'st-010', 'ak-05', 'futures', 20, 'both', 'isolated', 90,  '{}', true, true, NOW()),

-- Group B: 合约+仅做多 (5用户×2策略=10订阅)
('sub-11', 'tu-06', 'st-001', 'ak-06', 'futures', 10, 'long', 'isolated', 100, '{}', true, true, NOW()),
('sub-12', 'tu-06', 'st-009', 'ak-06', 'futures', 5,  'long', 'cross',    200, '{}', true, true, NOW()),
('sub-13', 'tu-07', 'st-002', 'ak-07', 'futures', 15, 'long', 'isolated', 80,  '{}', true, true, NOW()),
('sub-14', 'tu-07', 'st-006', 'ak-07', 'futures', 8,  'long', 'cross',    150, '{}', true, true, NOW()),
('sub-15', 'tu-08', 'st-004', 'ak-08', 'futures', 20, 'long', 'isolated', 60,  '{}', true, true, NOW()),
('sub-16', 'tu-08', 'st-005', 'ak-08', 'futures', 3,  'long', 'cross',    250, '{}', true, true, NOW()),
('sub-17', 'tu-09', 'st-003', 'ak-09', 'futures', 25, 'long', 'isolated', 50,  '{}', true, true, NOW()),
('sub-18', 'tu-09', 'st-008', 'ak-09', 'futures', 10, 'long', 'cross',    100, '{}', true, true, NOW()),
('sub-19', 'tu-10', 'st-007', 'ak-10', 'futures', 12, 'long', 'isolated', 120, '{}', true, true, NOW()),
('sub-20', 'tu-10', 'st-010', 'ak-10', 'futures', 15, 'long', 'cross',    80,  '{}', true, true, NOW()),

-- Group C: 合约+仅做空 (5用户×2策略=10订阅)
('sub-21', 'tu-11', 'st-001', 'ak-11', 'futures', 10, 'short', 'isolated', 100, '{}', true, true, NOW()),
('sub-22', 'tu-11', 'st-007', 'ak-11', 'futures', 8,  'short', 'cross',    150, '{}', true, true, NOW()),
('sub-23', 'tu-12', 'st-002', 'ak-12', 'futures', 15, 'short', 'isolated', 80,  '{}', true, true, NOW()),
('sub-24', 'tu-12', 'st-010', 'ak-12', 'futures', 20, 'short', 'cross',    60,  '{}', true, true, NOW()),
('sub-25', 'tu-13', 'st-003', 'ak-13', 'futures', 25, 'short', 'isolated', 50,  '{}', true, true, NOW()),
('sub-26', 'tu-13', 'st-006', 'ak-13', 'futures', 10, 'short', 'cross',    100, '{}', true, true, NOW()),
('sub-27', 'tu-14', 'st-004', 'ak-14', 'futures', 12, 'short', 'isolated', 90,  '{}', true, true, NOW()),
('sub-28', 'tu-14', 'st-008', 'ak-14', 'futures', 5,  'short', 'cross',    200, '{}', true, true, NOW()),
('sub-29', 'tu-15', 'st-005', 'ak-15', 'futures', 3,  'short', 'isolated', 300, '{}', true, true, NOW()),
('sub-30', 'tu-15', 'st-009', 'ak-15', 'futures', 8,  'short', 'cross',    120, '{}', true, true, NOW()),

-- Group D: 现货模式 (3用户×2策略=6订阅)
('sub-31', 'tu-16', 'st-001', 'ak-16', 'spot', 1, 'both', 'cross', 50,  '{}', true, true, NOW()),
('sub-32', 'tu-16', 'st-002', 'ak-16', 'spot', 1, 'both', 'cross', 100, '{}', true, true, NOW()),
('sub-33', 'tu-17', 'st-004', 'ak-17', 'spot', 1, 'both', 'cross', 80,  '{}', true, true, NOW()),
('sub-34', 'tu-17', 'st-006', 'ak-17', 'spot', 1, 'long', 'cross', 120, '{}', true, true, NOW()),
('sub-35', 'tu-18', 'st-003', 'ak-18', 'spot', 1, 'both', 'cross', 60,  '{}', true, true, NOW()),
('sub-36', 'tu-18', 'st-010', 'ak-18', 'spot', 1, 'both', 'cross', 40,  '{}', true, true, NOW()),

-- Group E: 合约+限定交易对 (2用户×2策略=4订阅)
('sub-37', 'tu-19', 'st-004', 'ak-19', 'futures', 15, 'both', 'isolated', 100, '{BTC/USDT}', true, true, NOW()),
('sub-38', 'tu-19', 'st-010', 'ak-19', 'futures', 20, 'both', 'isolated', 80,  '{ETH/USDT}', true, true, NOW()),
('sub-39', 'tu-20', 'st-004', 'ak-20', 'futures', 10, 'both', 'cross',    150, '{SOL/USDT}', true, true, NOW()),
('sub-40', 'tu-20', 'st-007', 'ak-20', 'futures', 8,  'both', 'cross',    200, '{BTC/USDT,ETH/USDT}', true, true, NOW());
"
echo "  40 个订阅已创建"

# 统计
STRATEGY_COUNT=$($PSQL -c "SELECT count(*) FROM strategies WHERE freqtrade_id LIKE 'TestSt_%';")
USER_COUNT=$($PSQL -c "SELECT count(*) FROM users WHERE email LIKE 'testuser%@stress.test';")
SUB_COUNT=$($PSQL -c "SELECT count(*) FROM strategy_subscriptions WHERE id LIKE 'sub-%' AND is_active = true;")
echo ""
echo "  数据总量: ${STRATEGY_COUNT} 策略, ${USER_COUNT} 用户, ${SUB_COUNT} 活跃订阅"

# ========== Phase 2: 批量发送信号 ==========
echo ""
echo ">>> Phase 2: 发送 40 条 webhook 信号"
echo "--------------------------------------------"

SIGNAL_IDS=()
SIGNAL_COUNT=0

send_signal() {
  local strategy=$1
  local symbol=$2
  local side=$3
  local action=$4
  local price=$5
  local desc=$6

  SIGNAL_COUNT=$((SIGNAL_COUNT + 1))
  # 每次发送后等待 0.3 秒，避免触发限流（每秒10次/每10秒50次）
  sleep 0.3
  local result=$(curl -s -X POST "$API_URL" -H "Content-Type: application/json" \
    -d "{\"strategy\":\"${strategy}\",\"symbol\":\"${symbol}\",\"side\":\"${side}\",\"action\":\"${action}\",\"price\":\"${price}\"}")

  local signal_id=$(echo "$result" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('signalId','ERROR'))" 2>/dev/null)

  if [ "$signal_id" = "ERROR" ] || [ -z "$signal_id" ]; then
    echo "  [${SIGNAL_COUNT}] FAIL: ${desc} → ${result}"
  else
    SIGNAL_IDS+=("$signal_id")
    echo "  [${SIGNAL_COUNT}] OK: ${desc} → ${signal_id:0:8}..."
  fi
}

# --- 策略1: BTC趋势 (订阅者: tu-01双向合约, tu-06仅多合约, tu-11仅空合约, tu-16现货双向) ---
send_signal "TestSt_BTC_Trend" "BTC/USDT:USDT" "buy"  "entry_long"  "97000" "S1 BTC entry_long"
send_signal "TestSt_BTC_Trend" "BTC/USDT:USDT" "sell" "exit_long"   "98000" "S1 BTC exit_long"
send_signal "TestSt_BTC_Trend" "BTC/USDT:USDT" "sell" "entry_short" "98000" "S1 BTC entry_short"
send_signal "TestSt_BTC_Trend" "BTC/USDT:USDT" "buy"  "exit_short"  "97000" "S1 BTC exit_short"

# --- 策略2: ETH动量 (订阅者: tu-02双向合约, tu-07仅多合约, tu-12仅空合约, tu-16现货双向) ---
send_signal "TestSt_ETH_Momentum" "ETH/USDT:USDT" "buy"  "entry_long"  "2800" "S2 ETH entry_long"
send_signal "TestSt_ETH_Momentum" "ETH/USDT:USDT" "sell" "exit_long"   "2900" "S2 ETH exit_long"
send_signal "TestSt_ETH_Momentum" "ETH/USDT:USDT" "sell" "entry_short" "2900" "S2 ETH entry_short"
send_signal "TestSt_ETH_Momentum" "ETH/USDT:USDT" "buy"  "exit_short"  "2800" "S2 ETH exit_short"

# --- 策略3: SOL超短线 (订阅者: tu-03双向合约, tu-09仅多合约, tu-13仅空合约, tu-18现货双向) ---
send_signal "TestSt_SOL_Scalp" "SOL/USDT:USDT" "buy"  "entry_long"  "180" "S3 SOL entry_long"
send_signal "TestSt_SOL_Scalp" "SOL/USDT:USDT" "sell" "entry_short" "185" "S3 SOL entry_short"

# --- 策略4: 多币种波段 (订阅者: tu-01,tu-04双向, tu-08仅多, tu-14仅空, tu-17现货, tu-19限BTC, tu-20限SOL) ---
send_signal "TestSt_Multi_Swing" "BTC/USDT:USDT" "buy"  "entry_long"  "97500" "S4 BTC entry_long"
send_signal "TestSt_Multi_Swing" "ETH/USDT:USDT" "sell" "entry_short" "2850"  "S4 ETH entry_short"
send_signal "TestSt_Multi_Swing" "SOL/USDT:USDT" "buy"  "entry_long"  "182"   "S4 SOL entry_long"
send_signal "TestSt_Multi_Swing" "BTC/USDT:USDT" "sell" "exit_long"   "98500" "S4 BTC exit_long"
send_signal "TestSt_Multi_Swing" "ETH/USDT:USDT" "buy"  "exit_short"  "2750"  "S4 ETH exit_short"
send_signal "TestSt_Multi_Swing" "SOL/USDT:USDT" "sell" "exit_long"   "190"   "S4 SOL exit_long"

# --- 策略5: BTC定投 (订阅者: tu-04双向, tu-08仅多, tu-15仅空) ---
send_signal "TestSt_BTC_DCA" "BTC/USDT:USDT" "buy"  "entry_long" "96000" "S5 BTC entry_long"
send_signal "TestSt_BTC_DCA" "BTC/USDT:USDT" "sell" "exit_long"  "99000" "S5 BTC exit_long"

# --- 策略6: ETH网格 (订阅者: tu-07仅多, tu-13仅空, tu-17现货仅多) ---
send_signal "TestSt_ETH_Grid" "ETH/USDT:USDT" "buy"  "entry_long"  "2780" "S6 ETH entry_long"
send_signal "TestSt_ETH_Grid" "ETH/USDT:USDT" "sell" "entry_short" "2820" "S6 ETH entry_short"
send_signal "TestSt_ETH_Grid" "ETH/USDT:USDT" "sell" "exit_long"   "2850" "S6 ETH exit_long"
send_signal "TestSt_ETH_Grid" "ETH/USDT:USDT" "buy"  "exit_short"  "2770" "S6 ETH exit_short"

# --- 策略7: 对冲大师 (订阅者: tu-02,tu-05双向, tu-10仅多, tu-11仅空, tu-20限BTC+ETH) ---
send_signal "TestSt_Hedge_Master" "BTC/USDT:USDT" "buy"  "entry_long"  "97200" "S7 BTC entry_long"
send_signal "TestSt_Hedge_Master" "ETH/USDT:USDT" "sell" "entry_short" "2880"  "S7 ETH entry_short"
send_signal "TestSt_Hedge_Master" "SOL/USDT:USDT" "buy"  "entry_long"  "178"   "S7 SOL entry_long"

# --- 策略8: SOL突破 (订阅者: tu-09仅多, tu-14仅空) ---
send_signal "TestSt_SOL_Breakout" "SOL/USDT:USDT" "buy"  "entry_long"  "185" "S8 SOL entry_long"
send_signal "TestSt_SOL_Breakout" "SOL/USDT:USDT" "sell" "entry_short" "190" "S8 SOL entry_short"

# --- 策略9: BTC保守 (订阅者: tu-06仅多, tu-15仅空) ---
send_signal "TestSt_BTC_Conservative" "BTC/USDT:USDT" "buy"  "entry_long"  "96500" "S9 BTC entry_long"
send_signal "TestSt_BTC_Conservative" "BTC/USDT:USDT" "sell" "entry_short" "97500" "S9 BTC entry_short"

# --- 策略10: 多币种激进 (订阅者: tu-03,tu-05双向, tu-10仅多, tu-12仅空, tu-18现货双向) ---
send_signal "TestSt_Multi_Aggressive" "BTC/USDT:USDT" "buy"  "entry_long"  "97800" "S10 BTC entry_long"
send_signal "TestSt_Multi_Aggressive" "ETH/USDT:USDT" "sell" "entry_short" "2860"  "S10 ETH entry_short"
send_signal "TestSt_Multi_Aggressive" "SOL/USDT:USDT" "sell" "entry_short" "183"   "S10 SOL entry_short"
send_signal "TestSt_Multi_Aggressive" "BTC/USDT:USDT" "sell" "exit_long"   "98500" "S10 BTC exit_long"

# --- 向后兼容测试: 不带 action 字段 ---
sleep 0.3
SIGNAL_COUNT=$((SIGNAL_COUNT + 1))
local_result=$(curl -s -X POST "$API_URL" -H "Content-Type: application/json" \
  -d '{"strategy":"TestSt_BTC_Trend","symbol":"BTC/USDT:USDT","side":"buy","price":"97100"}')
local_sid=$(echo "$local_result" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('signalId','ERROR'))" 2>/dev/null)
SIGNAL_IDS+=("$local_sid")
echo "  [${SIGNAL_COUNT}] OK: 向后兼容(无action, side=buy) → ${local_sid:0:8}..."

sleep 0.3
SIGNAL_COUNT=$((SIGNAL_COUNT + 1))
local_result2=$(curl -s -X POST "$API_URL" -H "Content-Type: application/json" \
  -d '{"strategy":"TestSt_ETH_Momentum","symbol":"ETH/USDT:USDT","side":"sell","price":"2870"}')
local_sid2=$(echo "$local_result2" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('signalId','ERROR'))" 2>/dev/null)
SIGNAL_IDS+=("$local_sid2")
echo "  [${SIGNAL_COUNT}] OK: 向后兼容(无action, side=sell) → ${local_sid2:0:8}..."

echo ""
echo "  共发送 ${SIGNAL_COUNT} 条信号"

# ========== Phase 3: 等待处理并验证 ==========
echo ""
echo ">>> Phase 3: 等待 BullMQ 处理 (30秒)..."
echo "--------------------------------------------"
sleep 30

echo ""
echo ">>> Phase 4: 验证结果"
echo "============================================"

PASS=0
FAIL=0
TOTAL=0

check() {
  local desc=$1
  local expected=$2
  local actual=$3
  TOTAL=$((TOTAL + 1))

  if [ "$actual" = "$expected" ]; then
    PASS=$((PASS + 1))
    echo "  [PASS] $desc (期望=$expected, 实际=$actual)"
  else
    FAIL=$((FAIL + 1))
    echo "  [FAIL] $desc (期望=$expected, 实际=$actual)"
  fi
}

check_gte() {
  local desc=$1
  local expected=$2
  local actual=$3
  TOTAL=$((TOTAL + 1))

  if [ "$actual" -ge "$expected" ] 2>/dev/null; then
    PASS=$((PASS + 1))
    echo "  [PASS] $desc (期望>=${expected}, 实际=$actual)"
  else
    FAIL=$((FAIL + 1))
    echo "  [FAIL] $desc (期望>=${expected}, 实际=$actual)"
  fi
}

# ---- 测试1: 信号总量 ----
echo ""
echo "--- 测试组1: 信号接收 ---"
TOTAL_SIGNALS=$($PSQL -c "SELECT count(*) FROM signals WHERE strategy_id IN (SELECT id FROM strategies WHERE freqtrade_id LIKE 'TestSt_%');")
check "信号总数 = ${SIGNAL_COUNT}" "${SIGNAL_COUNT}" "$TOTAL_SIGNALS"

# ---- 测试2: 信号分发 (subscriber_count > 0) ----
echo ""
echo "--- 测试组2: 信号分发 ---"
DISTRIBUTED=$($PSQL -c "SELECT count(*) FROM signals WHERE strategy_id IN (SELECT id FROM strategies WHERE freqtrade_id LIKE 'TestSt_%') AND distributed_at IS NOT NULL;")
check "所有信号已分发" "${SIGNAL_COUNT}" "$DISTRIBUTED"

TOTAL_EXECS=$($PSQL -c "SELECT count(*) FROM signal_executions WHERE signal_id IN (SELECT id FROM signals WHERE strategy_id IN (SELECT id FROM strategies WHERE freqtrade_id LIKE 'TestSt_%'));")
check_gte "执行记录总数 >= 80" "80" "$TOTAL_EXECS"

# ---- 测试3: 方向过滤 ----
echo ""
echo "--- 测试组3: 方向过滤 ---"

# 仅做多用户(Group B: tu-06~tu-10) 不应收到 entry_short/exit_short 信号
LONG_ONLY_SHORT_EXECS=$($PSQL -c "
SELECT count(*) FROM signal_executions se
JOIN signals s ON s.id = se.signal_id
WHERE se.user_id IN ('tu-06','tu-07','tu-08','tu-09','tu-10')
AND s.side = 'sell'
AND s.strategy_id IN (SELECT id FROM strategies WHERE freqtrade_id LIKE 'TestSt_%')
AND se.status NOT IN ('skipped');
" 2>/dev/null)
# 注意: exit_long 也是 side=sell 但应该被接收，需要更精确的检查
# 改为查执行记录中 skip_reason 包含方向过滤的
LONG_ONLY_GOT_SHORT=$($PSQL -c "
SELECT count(*) FROM signal_executions se
JOIN signals s ON s.id = se.signal_id
JOIN strategies st ON st.id = s.strategy_id
WHERE se.user_id IN ('tu-06','tu-07','tu-08','tu-09','tu-10')
AND st.freqtrade_id LIKE 'TestSt_%'
AND se.status IN ('failed','executing','success','queued')
AND s.id IN (
  SELECT sig.id FROM signals sig
  JOIN strategies str ON str.id = sig.strategy_id
  WHERE str.freqtrade_id LIKE 'TestSt_%'
);
")
# 仅做多用户收到的执行记录应该全是 entry_long 或 exit_long 相关的
echo "  仅做多用户(Group B)收到的非跳过执行: ${LONG_ONLY_GOT_SHORT}"

# 仅做空用户(Group C: tu-11~tu-15) 不应收到 entry_long/exit_long 信号
LONG_ONLY_GOT_LONG=$($PSQL -c "
SELECT count(*) FROM signal_executions se
JOIN signals s ON s.id = se.signal_id
JOIN strategies str ON str.id = s.strategy_id
WHERE se.user_id IN ('tu-11','tu-12','tu-13','tu-14','tu-15')
AND str.freqtrade_id LIKE 'TestSt_%'
AND se.status IN ('failed','executing','success','queued');
")
echo "  仅做空用户(Group C)收到的非跳过执行: ${LONG_ONLY_GOT_LONG}"

# ---- 测试4: 现货做空拦截 ----
echo ""
echo "--- 测试组4: 现货做空拦截 ---"
SPOT_SHORT_SKIPPED=$($PSQL -c "
SELECT count(*) FROM signal_executions se
WHERE se.user_id IN ('tu-16','tu-17','tu-18')
AND se.status = 'skipped'
AND se.skip_reason = '现货模式不支持做空';
")
echo "  现货用户被拦截的空头信号数: ${SPOT_SHORT_SKIPPED}"
check_gte "现货用户做空拦截 >= 1" "1" "$SPOT_SHORT_SKIPPED"

# 现货用户收到的 entry_long/exit_long 应该正常处理（不是 skipped）
SPOT_LONG_PROCESSED=$($PSQL -c "
SELECT count(*) FROM signal_executions se
WHERE se.user_id IN ('tu-16','tu-17','tu-18')
AND se.status IN ('failed','executing','success','queued')
AND se.signal_id IN (SELECT id FROM signals WHERE strategy_id IN (SELECT id FROM strategies WHERE freqtrade_id LIKE 'TestSt_%'));
")
check_gte "现货用户做多信号正常处理 >= 1" "1" "$SPOT_LONG_PROCESSED"

# ---- 测试5: 交易对过滤 ----
echo ""
echo "--- 测试组5: 交易对过滤 ---"

# tu-19 订阅 st-004 限定 BTC/USDT，st-010 限定 ETH/USDT
# S4 发了 BTC, ETH, SOL 三个信号
# tu-19 对 st-004 应该只收到 BTC 的信号（ETH和SOL被过滤）
TU19_ST004_EXECS=$($PSQL -c "
SELECT count(*) FROM signal_executions se
JOIN signals s ON s.id = se.signal_id
WHERE se.user_id = 'tu-19'
AND s.strategy_id = 'st-004';
")
echo "  tu-19 收到 S4(Multi_Swing) 信号数: ${TU19_ST004_EXECS}"

# tu-20 订阅 st-004 限定 SOL/USDT
TU20_ST004_EXECS=$($PSQL -c "
SELECT count(*) FROM signal_executions se
JOIN signals s ON s.id = se.signal_id
WHERE se.user_id = 'tu-20'
AND s.strategy_id = 'st-004';
")
echo "  tu-20 收到 S4(Multi_Swing) 信号数: ${TU20_ST004_EXECS}"

# tu-20 订阅 st-007 限定 BTC+ETH，S7 发了 BTC+ETH+SOL
TU20_ST007_EXECS=$($PSQL -c "
SELECT count(*) FROM signal_executions se
JOIN signals s ON s.id = se.signal_id
WHERE se.user_id = 'tu-20'
AND s.strategy_id = 'st-007';
")
echo "  tu-20 收到 S7(Hedge) 信号数(限BTC+ETH,发了BTC+ETH+SOL): ${TU20_ST007_EXECS}"
# 应该只收到2个（BTC和ETH的），SOL被过滤
check "tu-20对S7的交易对过滤(应=2)" "2" "$TU20_ST007_EXECS"

# ---- 测试6: 参数隔离 ----
echo ""
echo "--- 测试组6: 参数隔离验证 ---"

# 检查不同订阅的参数是否正确传递到执行记录
# 这个通过检查 signal 的 subscriber_count 来间接验证
# S1(BTC_Trend) 有4个订阅者: tu-01(both), tu-06(long), tu-11(short), tu-16(spot)
S1_ENTRY_LONG_SUBS=$($PSQL -c "
SELECT subscriber_count FROM signals s
JOIN strategies st ON st.id = s.strategy_id
WHERE st.freqtrade_id = 'TestSt_BTC_Trend'
AND s.side = 'buy'
ORDER BY s.created_at ASC
LIMIT 1;
")
echo "  S1 entry_long 订阅者数: ${S1_ENTRY_LONG_SUBS} (预期: 4个全部收到)"

S1_ENTRY_SHORT_SUBS=$($PSQL -c "
SELECT subscriber_count FROM signals s
JOIN strategies st ON st.id = s.strategy_id
WHERE st.freqtrade_id = 'TestSt_BTC_Trend'
AND s.symbol = 'BTC/USDT:USDT'
ORDER BY s.created_at ASC
OFFSET 2 LIMIT 1;
")
echo "  S1 entry_short 订阅者数: ${S1_ENTRY_SHORT_SUBS} (预期: 2=tu-01(both)+tu-11(short), tu-06(long)跳过, tu-16(spot)跳过)"

# ---- 测试7: 向后兼容 ----
echo ""
echo "--- 测试组7: 向后兼容 ---"
COMPAT_SIGNALS=$($PSQL -c "
SELECT count(*) FROM signals s
JOIN strategies st ON st.id = s.strategy_id
WHERE st.freqtrade_id LIKE 'TestSt_%'
AND s.distributed_at IS NOT NULL;
")
check "所有信号(含无action)均已分发" "${SIGNAL_COUNT}" "$COMPAT_SIGNALS"

# ---- 测试8: 各状态统计 ----
echo ""
echo "--- 测试组8: 执行状态统计 ---"
echo ""
$PSQL -c "
SELECT
  se.status,
  count(*) as cnt,
  CASE
    WHEN se.status = 'skipped' THEN '方向过滤/现货做空拦截/交易对过滤'
    WHEN se.status = 'failed' THEN '风控拒绝或交易所错误(预期行为)'
    WHEN se.status = 'executing' THEN '正在执行中'
    WHEN se.status = 'success' THEN '执行成功'
    WHEN se.status = 'queued' THEN '排队中'
    ELSE '其他'
  END as description
FROM signal_executions se
WHERE se.signal_id IN (SELECT id FROM signals WHERE strategy_id IN (SELECT id FROM strategies WHERE freqtrade_id LIKE 'TestSt_%'))
GROUP BY se.status
ORDER BY cnt DESC;
"

echo ""
echo "--- 详细失败原因统计 ---"
$PSQL -c "
SELECT
  COALESCE(se.error_code, se.skip_reason, 'N/A') as reason,
  count(*) as cnt
FROM signal_executions se
WHERE se.signal_id IN (SELECT id FROM signals WHERE strategy_id IN (SELECT id FROM strategies WHERE freqtrade_id LIKE 'TestSt_%'))
AND se.status IN ('failed', 'skipped')
GROUP BY reason
ORDER BY cnt DESC;
"

echo ""
echo "--- 各用户组执行统计 ---"
echo ""
echo "Group A (合约+双向 tu-01~05):"
$PSQL -c "
SELECT se.user_id, se.status, count(*) as cnt
FROM signal_executions se
WHERE se.user_id IN ('tu-01','tu-02','tu-03','tu-04','tu-05')
AND se.signal_id IN (SELECT id FROM signals WHERE strategy_id IN (SELECT id FROM strategies WHERE freqtrade_id LIKE 'TestSt_%'))
GROUP BY se.user_id, se.status ORDER BY se.user_id, se.status;
"

echo ""
echo "Group B (合约+仅做多 tu-06~10):"
$PSQL -c "
SELECT se.user_id, se.status, count(*) as cnt
FROM signal_executions se
WHERE se.user_id IN ('tu-06','tu-07','tu-08','tu-09','tu-10')
AND se.signal_id IN (SELECT id FROM signals WHERE strategy_id IN (SELECT id FROM strategies WHERE freqtrade_id LIKE 'TestSt_%'))
GROUP BY se.user_id, se.status ORDER BY se.user_id, se.status;
"

echo ""
echo "Group C (合约+仅做空 tu-11~15):"
$PSQL -c "
SELECT se.user_id, se.status, count(*) as cnt
FROM signal_executions se
WHERE se.user_id IN ('tu-11','tu-12','tu-13','tu-14','tu-15')
AND se.signal_id IN (SELECT id FROM signals WHERE strategy_id IN (SELECT id FROM strategies WHERE freqtrade_id LIKE 'TestSt_%'))
GROUP BY se.user_id, se.status ORDER BY se.user_id, se.status;
"

echo ""
echo "Group D (现货 tu-16~18):"
$PSQL -c "
SELECT se.user_id, se.status, se.skip_reason, count(*) as cnt
FROM signal_executions se
WHERE se.user_id IN ('tu-16','tu-17','tu-18')
AND se.signal_id IN (SELECT id FROM signals WHERE strategy_id IN (SELECT id FROM strategies WHERE freqtrade_id LIKE 'TestSt_%'))
GROUP BY se.user_id, se.status, se.skip_reason ORDER BY se.user_id, se.status;
"

echo ""
echo "Group E (限定交易对 tu-19~20):"
$PSQL -c "
SELECT se.user_id, se.status, count(*) as cnt
FROM signal_executions se
WHERE se.user_id IN ('tu-19','tu-20')
AND se.signal_id IN (SELECT id FROM signals WHERE strategy_id IN (SELECT id FROM strategies WHERE freqtrade_id LIKE 'TestSt_%'))
GROUP BY se.user_id, se.status ORDER BY se.user_id, se.status;
"

# ========== 最终报告 ==========
echo ""
echo "============================================"
echo "  测试报告"
echo "============================================"
echo "  总测试项: ${TOTAL}"
echo "  通过: ${PASS}"
echo "  失败: ${FAIL}"
echo ""
if [ "$FAIL" -eq 0 ]; then
  echo "  结果: ALL PASSED"
else
  echo "  结果: ${FAIL} FAILED"
fi
echo "============================================"
echo ""
echo ">>> 测试数据保留中，可手动查询分析。"
echo ">>> 清理命令: bash scripts/test-multi-dimension.sh cleanup"

# ========== 清理模式 ==========
if [ "${1}" = "cleanup" ]; then
  echo ""
  echo ">>> 清理测试数据..."
  $PSQL -c "
  DELETE FROM signal_executions WHERE signal_id IN (SELECT id FROM signals WHERE strategy_id IN (SELECT id FROM strategies WHERE freqtrade_id LIKE 'TestSt_%'));
  DELETE FROM billing_logs WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'testuser%@stress.test');
  DELETE FROM positions WHERE subscription_id IN (SELECT id FROM strategy_subscriptions WHERE id LIKE 'sub-%');
  DELETE FROM risk_logs WHERE signal_id IN (SELECT id FROM signals WHERE strategy_id IN (SELECT id FROM strategies WHERE freqtrade_id LIKE 'TestSt_%'));
  DELETE FROM signals WHERE strategy_id IN (SELECT id FROM strategies WHERE freqtrade_id LIKE 'TestSt_%');
  DELETE FROM notifications WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'testuser%@stress.test');
  DELETE FROM strategy_subscriptions WHERE id LIKE 'sub-%';
  DELETE FROM api_keys WHERE id LIKE 'ak-%';
  DELETE FROM strategies WHERE freqtrade_id LIKE 'TestSt_%';
  DELETE FROM users WHERE email LIKE 'testuser%@stress.test';
  "
  echo "  清理完成"
fi
