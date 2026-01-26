#!/bin/bash
# QuantFi VPS 初始化脚本（含网络安全配置 + Freqtrade 自动启动）
# 实例 ID: {{INSTANCE_ID}}
# 生成时间: {{GENERATED_AT}}

# 重要：不使用 set -e，确保脚本能执行到 ready 回调
# 每个关键步骤单独处理错误

LOG_FILE="/var/log/quantfi-init.log"
exec > >(tee -a "$LOG_FILE") 2>&1

echo "=========================================="
echo "QuantFi VPS 初始化开始"
echo "实例 ID: {{INSTANCE_ID}}"
echo "时间: $(date)"
echo "=========================================="

# 错误计数器
ERROR_COUNT=0

# 重试函数（最多重试 3 次）
retry() {
  local n=1
  local max=3
  local delay=5
  while true; do
    "$@" && break || {
      if [[ $n -lt $max ]]; then
        ((n++))
        echo "⚠️ 命令失败，$delay 秒后重试 ($n/$max)..."
        sleep $delay
      else
        echo "❌ 命令失败，已达最大重试次数"
        ((ERROR_COUNT++))
        return 1
      fi
    }
  done
}

# ==================== 设置统一密码 ====================
echo "[1/12] 设置 root 密码..."
echo "root:{{VPS_PASSWORD}}" | chpasswd && echo "✅ root 密码已设置" || echo "⚠️ root 密码设置失败"

# ==================== 系统更新 ====================
echo "[2/12] 更新系统..."
retry apt-get update -y || echo "⚠️ apt-get update 失败，继续执行..."
# 跳过 upgrade 加快速度，只安装必要的安全更新
# apt-get upgrade -y

# ==================== 安装 Docker ====================
echo "[3/12] 安装 Docker..."
if ! command -v docker &> /dev/null; then
  retry curl -fsSL https://get.docker.com -o get-docker.sh
  if [ -f get-docker.sh ]; then
    sh get-docker.sh || ((ERROR_COUNT++))
    systemctl start docker || true
    systemctl enable docker || true
    rm -f get-docker.sh
  else
    echo "❌ Docker 安装脚本下载失败"
    ((ERROR_COUNT++))
  fi
else
  echo "✅ Docker 已安装"
fi

# Docker Compose V2 已内置在 Docker 中，无需单独安装
# 验证 docker compose 命令是否可用
if docker compose version &> /dev/null; then
  echo "✅ Docker Compose V2 可用"
else
  echo "⚠️ Docker Compose V2 不可用，尝试安装插件..."
  apt-get install -y docker-compose-plugin || true
fi

# ==================== 安装 Node.js ====================
echo "[4/12] 安装 Node.js..."
if ! command -v node &> /dev/null; then
  retry curl -fsSL https://deb.nodesource.com/setup_20.x -o nodesource_setup.sh
  if [ -f nodesource_setup.sh ]; then
    bash nodesource_setup.sh || ((ERROR_COUNT++))
    apt-get install -y nodejs || ((ERROR_COUNT++))
    rm -f nodesource_setup.sh
  else
    echo "❌ Node.js 安装脚本下载失败"
    ((ERROR_COUNT++))
  fi
else
  echo "✅ Node.js 已安装: $(node -v)"
fi

# ==================== 安装 fail2ban ====================
echo "[5/12] 安装 fail2ban..."
apt-get install -y fail2ban || echo "⚠️ fail2ban 安装失败"

# 配置 fail2ban
cat > /etc/fail2ban/jail.local <<'F2BEOF'
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 86400

[sshd-ddos]
enabled = true
port = ssh
filter = sshd-ddos
logpath = /var/log/auth.log
maxretry = 6
bantime = 172800
F2BEOF

systemctl enable fail2ban 2>/dev/null || true
systemctl restart fail2ban 2>/dev/null || true

# ==================== 配置 UFW 防火墙 ====================
echo "[6/12] 配置防火墙..."

apt-get install -y ufw || echo "⚠️ ufw 安装失败"

# 重置 UFW 规则（非交互式）
echo "y" | ufw reset 2>/dev/null || true

# 设置 UFW 默认策略
ufw default deny incoming
ufw default allow outgoing

# 允许 SSH（仅来自主服务器）
ufw allow from {{MASTER_SERVER_IP}} to any port 22

# 允许 Freqtrade API（全开放，因为有 JWT 验证）
ufw allow 8080/tcp

# 允许代理服务（仅来自主服务器）
ufw allow from {{MASTER_SERVER_IP}} to any port 8081

# 启用防火墙（非交互式）
echo "y" | ufw enable 2>/dev/null || true

echo "✅ UFW 防火墙配置完成"

# ==================== SSH 加固 ====================
echo "[7/12] 加固 SSH..."

sed -i 's/^#*PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sed -i 's/^#*PermitRootLogin.*/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config
sed -i 's/^#*PubkeyAuthentication.*/PubkeyAuthentication yes/' /etc/ssh/sshd_config

grep -q "^MaxAuthTries" /etc/ssh/sshd_config || echo "MaxAuthTries 3" >> /etc/ssh/sshd_config
grep -q "^LoginGraceTime" /etc/ssh/sshd_config || echo "LoginGraceTime 30" >> /etc/ssh/sshd_config

systemctl restart sshd || true

# ==================== 创建工作目录 ====================
echo "[8/12] 创建工作目录..."
mkdir -p /opt/quantfi/freqtrade/user_data/strategies
mkdir -p /opt/quantfi/freqtrade/user_data/data
mkdir -p /opt/quantfi/logs
chmod 777 /opt/quantfi/logs
cd /opt/quantfi

# 写入环境变量
cat > /opt/quantfi/.env <<ENVEOF
INSTANCE_ID={{INSTANCE_ID}}
API_ENDPOINT={{API_ENDPOINT}}
INSTANCE_TOKEN={{INSTANCE_TOKEN}}
FREQTRADE_API_TOKEN={{FREQTRADE_API_TOKEN}}
ENVEOF

# ==================== 配置 Freqtrade ====================
echo "[9/12] 配置 Freqtrade..."

# 生成 JWT Key（带验证）
FREQTRADE_JWT_KEY=$(openssl rand -hex 32 2>/dev/null)
if [ -z "$FREQTRADE_JWT_KEY" ] || [ ${#FREQTRADE_JWT_KEY} -lt 32 ]; then
  echo "⚠️ openssl rand 失败，使用备用方式生成 JWT Key"
  FREQTRADE_JWT_KEY=$(head -c 32 /dev/urandom | xxd -p)
fi
echo "✅ JWT Key 已生成 (${#FREQTRADE_JWT_KEY} 字符)"

cat > /opt/quantfi/freqtrade/user_data/config.json <<FTCEOF
{
  "max_open_trades": 3,
  "stake_currency": "USDT",
  "stake_amount": "unlimited",
  "tradable_balance_ratio": 0.99,
  "fiat_display_currency": "USD",
  "dry_run": true,
  "dry_run_wallet": 1000,
  "cancel_open_orders_on_exit": false,
  "trading_mode": "spot",
  "margin_mode": "",
  "unfilledtimeout": {
    "entry": 10,
    "exit": 10,
    "exit_timeout_count": 0,
    "unit": "minutes"
  },
  "entry_pricing": {
    "price_side": "same",
    "use_order_book": true,
    "order_book_top": 1,
    "price_last_balance": 0.0,
    "check_depth_of_market": {
      "enabled": false,
      "bids_to_ask_delta": 1
    }
  },
  "exit_pricing": {
    "price_side": "same",
    "use_order_book": true,
    "order_book_top": 1
  },
  "exchange": {
    "name": "binance",
    "key": "",
    "secret": "",
    "ccxt_config": {},
    "ccxt_async_config": {},
    "pair_whitelist": ["BTC/USDT", "ETH/USDT"]
  },
  "pairlists": [
    {
      "method": "StaticPairList"
    }
  ],
  "api_server": {
    "enabled": true,
    "listen_ip_address": "0.0.0.0",
    "listen_port": 8080,
    "verbosity": "error",
    "enable_openapi": false,
    "jwt_secret_key": "${FREQTRADE_JWT_KEY}",
    "ws_token": "{{FREQTRADE_API_TOKEN}}",
    "CORS_origins": [],
    "username": "quantfi",
    "password": "{{FREQTRADE_API_TOKEN}}"
  },
  "bot_name": "quantfi-{{INSTANCE_ID}}",
  "initial_state": "running",
  "force_entry_enable": false,
  "internals": {
    "process_throttle_secs": 5
  }
}
FTCEOF

# 写入默认策略
cat > /opt/quantfi/freqtrade/user_data/strategies/SampleStrategy.py <<'STRATEOF'
from freqtrade.strategy import IStrategy
from pandas import DataFrame
import talib.abstract as ta

class SampleStrategy(IStrategy):
    INTERFACE_VERSION = 3
    timeframe = '5m'
    minimal_roi = {"60": 0.01, "30": 0.02, "0": 0.04}
    stoploss = -0.10
    trailing_stop = True
    trailing_stop_positive = 0.02
    trailing_stop_positive_offset = 0.03
    trailing_only_offset_is_reached = True

    def populate_indicators(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe['rsi'] = ta.RSI(dataframe, timeperiod=14)
        dataframe['ema_short'] = ta.EMA(dataframe, timeperiod=9)
        dataframe['ema_long'] = ta.EMA(dataframe, timeperiod=21)
        return dataframe

    def populate_entry_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe.loc[
            ((dataframe['rsi'] < 30) & (dataframe['ema_short'] > dataframe['ema_long']) & (dataframe['volume'] > 0)),
            'enter_long'] = 1
        return dataframe

    def populate_exit_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe.loc[
            ((dataframe['rsi'] > 70) | (dataframe['ema_short'] < dataframe['ema_long'])),
            'exit_long'] = 1
        return dataframe
STRATEOF

# Docker Compose 文件（使用 V2 语法）
cat > /opt/quantfi/docker-compose.yml <<'DCEOF'
services:
  freqtrade:
    image: freqtradeorg/freqtrade:stable
    container_name: freqtrade
    restart: always
    ports:
      - "8080:8080"
    volumes:
      - ./freqtrade/user_data:/freqtrade/user_data
      - ./logs:/freqtrade/logs
    command: trade --db-url sqlite:////freqtrade/user_data/data/tradesv3.sqlite --config /freqtrade/user_data/config.json --strategy SampleStrategy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/api/v1/ping"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s
DCEOF

# ==================== 创建 API 代理服务 ====================
echo "[10/12] 创建 API 代理服务..."

mkdir -p /opt/quantfi/proxy
cd /opt/quantfi/proxy

cat > /opt/quantfi/proxy/package.json <<'PKGEOF'
{
  "name": "quantfi-proxy",
  "version": "1.0.0",
  "main": "server.js",
  "dependencies": {
    "express": "^4.21.0",
    "express-rate-limit": "^7.5.0",
    "ccxt": "^4.4.0"
  }
}
PKGEOF

cat > /opt/quantfi/proxy/server.js <<'PROXYEOF'
const express = require('express');
const rateLimit = require('express-rate-limit');
const ccxt = require('ccxt');
const fs = require('fs');
const { exec } = require('child_process');

// 加载环境变量（修复 PM2 启动时环境变量丢失的问题）
const envPath = '/opt/quantfi/.env';
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value && !process.env[key]) {
      process.env[key] = value.trim();
    }
  });
  console.log('✅ 环境变量已从 .env 文件加载');
  console.log('   INSTANCE_TOKEN 前8位:', process.env.INSTANCE_TOKEN?.substring(0, 8) || 'N/A');
} else {
  console.warn('⚠️ .env 文件不存在:', envPath);
}

const app = express();
app.use(express.json());

// 限流配置：防止 API 滥用
const verifyLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1 分钟窗口
  max: 10,              // 每分钟最多 10 次验证请求
  message: { error: 'Too many verify requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

const balanceLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1 分钟窗口
  max: 30,              // 每分钟最多 30 次余额查询
  message: { error: 'Too many balance requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

const configLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1 分钟窗口
  max: 5,               // 每分钟最多 5 次配置更新
  message: { error: 'Too many config update requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

const PORT = 8081;
const SUPPORTED_EXCHANGES = ['binance', 'okx', 'bybit', 'gate', 'huobi', 'kucoin', 'bitget', 'coinbase'];

function createExchange(exchangeName, apiKey, secretKey, passphrase, type = 'spot') {
  const exchangeId = exchangeName.toLowerCase();
  if (!SUPPORTED_EXCHANGES.includes(exchangeId)) {
    throw new Error('Unsupported exchange: ' + exchangeName);
  }
  const ExchangeClass = ccxt[exchangeId];
  const config = {
    apiKey,
    secret: secretKey,
    enableRateLimit: true,
    timeout: 30000,
    options: { defaultType: type },
  };
  if (passphrase) config.password = passphrase;
  return new ExchangeClass(config);
}

app.post('/api/verify', verifyLimiter, async (req, res) => {
  const { exchange, apiKey, secretKey, passphrase } = req.body;
  if (!exchange || !apiKey || !secretKey) {
    return res.status(400).json({ valid: false, error: 'Missing required parameters' });
  }
  try {
    const spotEx = createExchange(exchange, apiKey, secretKey, passphrase, 'spot');
    const balanceData = await spotEx.fetchBalance();
    const mainCurrencies = ['USDT', 'USDC', 'BTC', 'ETH', 'BNB', 'SOL'];
    const balances = [];
    let totalUsdt = 0;
    for (const currency of mainCurrencies) {
      const balance = balanceData[currency];
      if (balance && (Number(balance.total) > 0 || currency === 'USDT')) {
        balances.push({ currency, free: String(balance.free || 0), used: String(balance.used || 0), total: String(balance.total || 0) });
      }
    }
    const usdtBalance = balanceData['USDT'];
    if (usdtBalance) totalUsdt = Number(usdtBalance.total) || 0;
    const permissions = ['spot'];
    try {
      const exchangeId = exchange.toLowerCase();
      const futuresType = exchangeId === 'binance' ? 'future' : 'swap';
      const futuresEx = createExchange(exchange, apiKey, secretKey, passphrase, futuresType);
      await futuresEx.fetchBalance();
      permissions.push('futures');
    } catch (e) {}
    res.json({ valid: true, permissions, balances, totalBalanceUsdt: totalUsdt.toFixed(2) });
  } catch (error) {
    res.json({ valid: false, error: error.message });
  }
});

app.post('/api/balance', balanceLimiter, async (req, res) => {
  const { exchange, apiKey, secretKey, passphrase } = req.body;
  if (!exchange || !apiKey || !secretKey) return res.status(400).json({ error: 'Missing required parameters' });
  try {
    const ex = createExchange(exchange, apiKey, secretKey, passphrase);
    const balanceData = await ex.fetchBalance();
    res.json({ usdtBalance: Number(balanceData['USDT']?.total || 0) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'quantfi-proxy', timestamp: new Date().toISOString() });
});

app.post('/api/update-config', configLimiter, async (req, res) => {
  const { config, strategyName, strategyCode } = req.body;
  const instanceToken = process.env.INSTANCE_TOKEN;
  const requestToken = req.headers['x-instance-token'];
  if (!instanceToken || requestToken !== instanceToken) return res.status(401).json({ error: 'Unauthorized' });
  try {
    if (strategyName && strategyCode) {
      fs.writeFileSync('/opt/quantfi/freqtrade/user_data/strategies/' + strategyName + '.py', strategyCode, 'utf8');
    }
    if (config) {
      fs.writeFileSync('/opt/quantfi/freqtrade/user_data/config.json', JSON.stringify(config, null, 2), 'utf8');
    }
    exec('cd /opt/quantfi && docker compose restart freqtrade', (error) => {
      if (error) return res.status(500).json({ error: 'Restart failed: ' + error.message });
      res.json({ success: true, message: 'Config updated' });
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/restart', (req, res) => {
  const instanceToken = process.env.INSTANCE_TOKEN;
  const requestToken = req.headers['x-instance-token'];
  if (!instanceToken || requestToken !== instanceToken) return res.status(401).json({ error: 'Unauthorized' });
  exec('cd /opt/quantfi && docker compose restart freqtrade', (error) => {
    if (error) return res.status(500).json({ error: 'Restart failed: ' + error.message });
    res.json({ success: true, message: 'Freqtrade restarted' });
  });
});

app.listen(PORT, '0.0.0.0', () => console.log('QuantFi proxy running on port ' + PORT));
PROXYEOF

# 安装依赖（带重试和镜像备选）
cd /opt/quantfi/proxy
echo "安装代理服务依赖..."

# 尝试默认源
if ! retry npm install --production 2>/dev/null; then
  echo "⚠️ 默认源安装失败，尝试使用淘宝镜像..."
  npm config set registry https://registry.npmmirror.com
  if ! npm install --production 2>/dev/null; then
    echo "❌ npm install 失败"
    ((ERROR_COUNT++))
  fi
  # 恢复默认源
  npm config set registry https://registry.npmjs.org
fi

# 验证依赖
if [ -d "/opt/quantfi/proxy/node_modules/express" ] && [ -d "/opt/quantfi/proxy/node_modules/ccxt" ]; then
  echo "✅ 依赖安装完成"
else
  echo "⚠️ 依赖安装不完整"
  ((ERROR_COUNT++))
fi

# 安装 PM2
npm install -g pm2 2>/dev/null || echo "⚠️ PM2 安装失败"

# 启动代理服务
pm2 delete quantfi-proxy 2>/dev/null || true
pm2 start /opt/quantfi/proxy/server.js --name quantfi-proxy --log /opt/quantfi/logs/proxy.log || ((ERROR_COUNT++))
pm2 save 2>/dev/null || true
pm2 startup 2>/dev/null || true

# ==================== 启动 Freqtrade ====================
echo "[11/12] 启动 Freqtrade..."
cd /opt/quantfi

# 拉取镜像（带超时和重试）
echo "拉取 Freqtrade 镜像（可能需要 3-5 分钟）..."
PULL_START=$(date +%s)

# 使用 timeout 拉取，最多 10 分钟
if timeout 600 docker compose pull 2>&1; then
  PULL_END=$(date +%s)
  echo "✅ 镜像拉取完成，耗时 $((PULL_END - PULL_START)) 秒"
else
  echo "⚠️ docker compose pull 超时或失败，尝试直接启动（可能使用缓存镜像）..."
fi

# 启动容器
echo "启动 Freqtrade 容器..."
if docker compose up -d 2>&1; then
  echo "✅ 容器启动命令已执行"
else
  echo "❌ 容器启动失败"
  ((ERROR_COUNT++))
fi

# 显示容器状态
docker compose ps 2>/dev/null || true

# 等待服务就绪
echo "等待服务就绪..."
PROXY_READY=false
FT_READY=false

for i in {1..30}; do
  if [ "$PROXY_READY" = false ] && curl -sf http://localhost:8081/api/health > /dev/null 2>&1; then
    PROXY_READY=true
    echo "✅ 代理服务已就绪"
  fi
  if [ "$FT_READY" = false ] && curl -sf http://localhost:8080/api/v1/ping > /dev/null 2>&1; then
    FT_READY=true
    echo "✅ 交易机器人已就绪"
  fi
  if [ "$PROXY_READY" = true ] && [ "$FT_READY" = true ]; then
    break
  fi
  sleep 2
done

PROXY_STATUS="stopped"
FT_STATUS="stopped"
[ "$PROXY_READY" = true ] && PROXY_STATUS="running"
[ "$FT_READY" = true ] && FT_STATUS="running"

# ==================== 配置心跳 ====================
cat > /opt/quantfi/heartbeat.sh <<'HBEOF'
#!/bin/bash
source /opt/quantfi/.env

# CPU 使用率（兼容不同 Linux 版本）
# 解析 us + sy 得到总 CPU 使用率
CPU_LINE=$(top -bn1 2>/dev/null | grep -E "Cpu|%Cpu" | head -1)
if [ -n "$CPU_LINE" ]; then
  CPU_US=$(echo "$CPU_LINE" | grep -oP '\d+\.?\d*\s*us' | grep -oP '\d+\.?\d*' | head -1)
  CPU_SY=$(echo "$CPU_LINE" | grep -oP '\d+\.?\d*\s*sy' | grep -oP '\d+\.?\d*' | head -1)
  CPU_USAGE=$(echo "${CPU_US:-0} + ${CPU_SY:-0}" | bc 2>/dev/null || echo "0")
else
  CPU_USAGE=0
fi

# 内存使用率
MEM_USAGE=$(free 2>/dev/null | grep Mem | awk '{if($2>0) printf "%.1f", $3/$2*100; else print 0}')

# 磁盘使用率
DISK_USAGE=$(df / 2>/dev/null | tail -1 | awk '{print $5}' | tr -d '%')

# 确保变量是有效数字，否则使用默认值
[[ ! "$CPU_USAGE" =~ ^[0-9]+\.?[0-9]*$ ]] && CPU_USAGE=0
[[ ! "$MEM_USAGE" =~ ^[0-9]+\.?[0-9]*$ ]] && MEM_USAGE=0
[[ ! "$DISK_USAGE" =~ ^[0-9]+$ ]] && DISK_USAGE=0

# Freqtrade 状态
FT_STATUS="stopped"
docker ps 2>/dev/null | grep -q freqtrade && FT_STATUS="running"

# 发送心跳
curl -s -X POST "${API_ENDPOINT}/api/instances/${INSTANCE_ID}/heartbeat" \
  -H "Content-Type: application/json" \
  -H "X-Instance-Token: ${INSTANCE_TOKEN}" \
  -d "{\"cpuUsage\": ${CPU_USAGE}, \"memoryUsage\": ${MEM_USAGE}, \"diskUsage\": ${DISK_USAGE}, \"freqtradeStatus\": \"${FT_STATUS}\"}" > /dev/null 2>&1
HBEOF

chmod +x /opt/quantfi/heartbeat.sh

# 添加 cron（每 30 秒心跳 - 使用两条 cron 实现）
# cron 最小粒度是 1 分钟，通过两条规则 + sleep 实现 30 秒间隔
(crontab -l 2>/dev/null | grep -v "heartbeat.sh"; \
echo "* * * * * /opt/quantfi/heartbeat.sh >> /opt/quantfi/logs/heartbeat.log 2>&1"; \
echo "* * * * * sleep 30 && /opt/quantfi/heartbeat.sh >> /opt/quantfi/logs/heartbeat.log 2>&1") | crontab -

# ==================== 发送就绪回调 ====================
echo "[12/12] 通知平台 VPS 就绪..."
source /opt/quantfi/.env

# 重试发送就绪回调（最多 3 次）
READY_SENT=false
for attempt in 1 2 3; do
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${API_ENDPOINT}/api/instances/{{INSTANCE_ID}}/ready" \
    -H "Content-Type: application/json" \
    -H "X-Instance-Token: ${INSTANCE_TOKEN}" \
    -d "{\"status\": \"ready\", \"freqtradeStatus\": \"${FT_STATUS}\", \"proxyStatus\": \"${PROXY_STATUS}\", \"errorCount\": ${ERROR_COUNT}}" 2>/dev/null) || true

  if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
    echo "✅ 就绪通知发送成功 (HTTP: ${HTTP_CODE})"
    READY_SENT=true
    break
  else
    echo "⚠️ 就绪通知失败 (HTTP: ${HTTP_CODE})，重试 $attempt/3..."
    sleep 5
  fi
done

# 如果回调失败，立即发送一次心跳
if [ "$READY_SENT" = false ]; then
  echo "⚠️ 就绪回调失败，发送首次心跳..."
  /opt/quantfi/heartbeat.sh
fi

# ==================== 完成 ====================
echo "=========================================="
echo "QuantFi VPS 初始化完成！"
echo "实例 ID: {{INSTANCE_ID}}"
echo "代理服务: ${PROXY_STATUS}"
echo "交易机器人: ${FT_STATUS}"
echo "错误计数: ${ERROR_COUNT}"
echo "时间: $(date)"
echo "=========================================="

# 保存初始化状态
echo "{\"status\": \"completed\", \"proxy\": \"${PROXY_STATUS}\", \"freqtrade\": \"${FT_STATUS}\", \"errors\": ${ERROR_COUNT}, \"timestamp\": \"$(date -Iseconds)\"}" > /opt/quantfi/init-status.json
