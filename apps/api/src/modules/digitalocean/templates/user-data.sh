#!/bin/bash
# QuantFi VPS 初始化脚本（含网络安全配置 + Freqtrade 自动启动）
# 实例 ID: {{INSTANCE_ID}}
# 生成时间: {{GENERATED_AT}}

set -e

echo "=========================================="
echo "QuantFi VPS 初始化开始"
echo "实例 ID: {{INSTANCE_ID}}"
echo "=========================================="

# ==================== 设置统一密码 ====================
echo "[0/10] 设置 root 密码..."
echo "root:{{VPS_PASSWORD}}" | chpasswd
echo "✅ root 密码已设置"

# ==================== 系统更新 ====================
echo "[1/10] 更新系统..."
apt-get update -y
apt-get upgrade -y

# ==================== 安装 Docker ====================
echo "[2/10] 安装 Docker..."
if ! command -v docker &> /dev/null; then
  curl -fsSL https://get.docker.com -o get-docker.sh
  sh get-docker.sh
  systemctl start docker
  systemctl enable docker
  rm get-docker.sh
fi

# 安装 Docker Compose
if ! command -v docker-compose &> /dev/null; then
  curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
  chmod +x /usr/local/bin/docker-compose
fi

# ==================== 安装 Node.js ====================
echo "[3/10] 安装 Node.js..."
if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

# ==================== 安装 fail2ban ====================
echo "[4/10] 安装 fail2ban..."
apt-get install -y fail2ban

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

systemctl enable fail2ban
systemctl restart fail2ban

# ==================== 配置 UFW 防火墙 ====================
echo "[5/10] 配置防火墙..."

# 重要：不能使用 iptables -F，会破坏 Docker 创建的网络规则
# Docker 启动时会创建必要的 iptables chains，清除会导致容器无法联网

# 确保 UFW 已安装
apt-get install -y ufw

# 重置 UFW 规则（非交互式）
echo "y" | ufw reset

# 设置 UFW 默认策略
ufw default deny incoming
ufw default allow outgoing

# 允许 SSH（仅来自主服务器）
ufw allow from {{MASTER_SERVER_IP}} to any port 22

# 允许 Freqtrade API（全开放，因为有 JWT 验证）
ufw allow 8080/tcp

# 允许代理服务（仅来自主服务器）
ufw allow from {{MASTER_SERVER_IP}} to any port 8081

# 允许 ICMP（ping）- UFW 默认允许出站 ping
# 入站 ping 需要通过 before.rules 配置，这里跳过（非必须）

# 启用防火墙（非交互式）
echo "y" | ufw enable

# 显示防火墙状态
ufw status verbose

echo "✅ UFW 防火墙配置完成"

# ==================== SSH 加固 ====================
echo "[6/10] 加固 SSH..."

# 禁用密码登录（仅允许密钥）
sed -i 's/^#*PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sed -i 's/^#*PermitRootLogin.*/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config
sed -i 's/^#*PubkeyAuthentication.*/PubkeyAuthentication yes/' /etc/ssh/sshd_config

# 限制 SSH 登录尝试
grep -q "^MaxAuthTries" /etc/ssh/sshd_config || echo "MaxAuthTries 3" >> /etc/ssh/sshd_config
grep -q "^LoginGraceTime" /etc/ssh/sshd_config || echo "LoginGraceTime 30" >> /etc/ssh/sshd_config

# 重启 SSH
systemctl restart sshd

# ==================== 创建工作目录 ====================
echo "[7/10] 创建工作目录..."
mkdir -p /opt/quantfi/freqtrade/user_data/strategies
mkdir -p /opt/quantfi/freqtrade/user_data/data
mkdir -p /opt/quantfi/logs
# 设置日志目录权限（Freqtrade 容器使用 ftuser 用户）
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
echo "[8/10] 配置 Freqtrade..."

# 生成 Freqtrade JWT 密钥
FREQTRADE_JWT_KEY=$(openssl rand -hex 32)

# 写入 Freqtrade 配置文件
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

# 写入默认策略（SampleStrategy）
cat > /opt/quantfi/freqtrade/user_data/strategies/SampleStrategy.py <<'STRATEOF'
# pragma pylint: disable=missing-docstring, invalid-name, pointless-string-statement
from freqtrade.strategy import IStrategy
from pandas import DataFrame
import talib.abstract as ta

class SampleStrategy(IStrategy):
    INTERFACE_VERSION = 3

    # 时间周期
    timeframe = '5m'

    # ROI 设置
    minimal_roi = {
        "60": 0.01,
        "30": 0.02,
        "0": 0.04
    }

    # 止损
    stoploss = -0.10

    # 尾随止损
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
            (
                (dataframe['rsi'] < 30) &
                (dataframe['ema_short'] > dataframe['ema_long']) &
                (dataframe['volume'] > 0)
            ),
            'enter_long'] = 1
        return dataframe

    def populate_exit_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe.loc[
            (
                (dataframe['rsi'] > 70) |
                (dataframe['ema_short'] < dataframe['ema_long'])
            ),
            'exit_long'] = 1
        return dataframe
STRATEOF

# 写入 Docker Compose 文件
# 注意：不使用 --logfile 参数，Freqtrade 2025.12 版本有日志配置 bug
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
      start_period: 40s
DCEOF

# ==================== 创建 API 代理服务 ====================
echo "[9/11] 创建 API 代理服务..."

# 初始化 npm 项目并安装依赖
mkdir -p /opt/quantfi/proxy
cd /opt/quantfi/proxy

cat > /opt/quantfi/proxy/package.json <<'PKGEOF'
{
  "name": "quantfi-proxy",
  "version": "1.0.0",
  "description": "QuantFi API Key 验证代理服务",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "ccxt": "^4.2.0"
  }
}
PKGEOF

# 写入代理服务代码（全英文避免编码问题）
cat > /opt/quantfi/proxy/server.js <<'PROXYEOF'
const express = require('express');
const ccxt = require('ccxt');
const fs = require('fs');
const { exec } = require('child_process');

const app = express();
app.use(express.json());

const PORT = 8081;

// Supported exchanges
const SUPPORTED_EXCHANGES = ['binance', 'okx', 'bybit', 'gate', 'huobi', 'kucoin'];

// Create exchange instance
function createExchange(exchangeName, apiKey, secretKey, type = 'spot') {
  const exchangeId = exchangeName.toLowerCase();
  if (!SUPPORTED_EXCHANGES.includes(exchangeId)) {
    throw new Error('Unsupported exchange: ' + exchangeName);
  }

  const ExchangeClass = ccxt[exchangeId];
  return new ExchangeClass({
    apiKey,
    secret: secretKey,
    enableRateLimit: true,
    timeout: 30000,
    options: { defaultType: type },
  });
}

// Verify API Key
app.post('/api/verify', async (req, res) => {
  const { exchange, apiKey, secretKey } = req.body;

  if (!exchange || !apiKey || !secretKey) {
    return res.status(400).json({ valid: false, error: 'Missing required parameters' });
  }

  try {
    // 1. Verify spot permissions
    const spotEx = createExchange(exchange, apiKey, secretKey, 'spot');
    const balanceData = await spotEx.fetchBalance();

    // Extract main currency balances
    const mainCurrencies = ['USDT', 'USDC', 'BTC', 'ETH', 'BNB', 'SOL'];
    const balances = [];
    let totalUsdt = 0;

    for (const currency of mainCurrencies) {
      const balance = balanceData[currency];
      if (balance && (Number(balance.total) > 0 || currency === 'USDT')) {
        balances.push({
          currency,
          free: String(balance.free || 0),
          used: String(balance.used || 0),
          total: String(balance.total || 0),
        });
      }
    }

    const usdtBalance = balanceData['USDT'];
    if (usdtBalance) {
      totalUsdt = Number(usdtBalance.total) || 0;
    }

    // 2. Check futures permissions
    const permissions = ['spot'];
    try {
      const exchangeId = exchange.toLowerCase();
      // Binance uses 'future' (USDT-M), others use 'swap' (perpetual)
      const futuresType = exchangeId === 'binance' ? 'future' : 'swap';
      const futuresEx = createExchange(exchange, apiKey, secretKey, futuresType);
      await futuresEx.fetchBalance();
      permissions.push('futures');
      console.log('Futures permission verified, exchange:', exchangeId, 'type:', futuresType);
    } catch (futuresErr) {
      console.log('Futures permission check failed:', futuresErr.message);
    }

    res.json({
      valid: true,
      permissions,
      balances,
      totalBalanceUsdt: totalUsdt.toFixed(2),
    });
  } catch (error) {
    console.error('Verification failed:', error.message);
    res.json({ valid: false, error: error.message });
  }
});

// Get balance
app.post('/api/balance', async (req, res) => {
  const { exchange, apiKey, secretKey } = req.body;

  if (!exchange || !apiKey || !secretKey) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  try {
    const ex = createExchange(exchange, apiKey, secretKey);
    const balanceData = await ex.fetchBalance();
    const usdtBalance = Number(balanceData['USDT']?.total || 0);

    res.json({ usdtBalance });
  } catch (error) {
    console.error('Failed to get balance:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'quantfi-proxy', timestamp: new Date().toISOString() });
});

// ==================== Config update endpoints ====================

// Update Freqtrade config
app.post('/api/update-config', async (req, res) => {
  const { config, strategyName, strategyCode } = req.body;

  // Verify token
  const instanceToken = process.env.INSTANCE_TOKEN;
  const requestToken = req.headers['x-instance-token'];

  if (!instanceToken || requestToken !== instanceToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // 1. Save strategy file if provided
    if (strategyName && strategyCode) {
      const strategyPath = '/opt/quantfi/freqtrade/user_data/strategies/' + strategyName + '.py';
      fs.writeFileSync(strategyPath, strategyCode, 'utf8');
      console.log('Strategy saved:', strategyPath);
    }

    // 2. Save config file
    if (config) {
      const configPath = '/opt/quantfi/freqtrade/user_data/config.json';
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
      console.log('Config updated');
    }

    // 3. Restart Freqtrade container
    exec('cd /opt/quantfi && docker-compose restart freqtrade', (error, stdout, stderr) => {
      if (error) {
        console.error('Restart failed:', error.message);
        return res.status(500).json({ error: 'Restart failed: ' + error.message });
      }
      console.log('Freqtrade restarted');
      res.json({
        success: true,
        message: 'Config updated, Freqtrade restarting',
        strategyName: strategyName || null
      });
    });
  } catch (error) {
    console.error('Config update failed:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Upload strategy only (for backtest)
app.post('/api/upload-strategy', (req, res) => {
  const { strategyName, strategyCode } = req.body;

  // Verify token
  const instanceToken = process.env.INSTANCE_TOKEN;
  const requestToken = req.headers['x-instance-token'];

  if (!instanceToken || requestToken !== instanceToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!strategyName || !strategyCode) {
    return res.status(400).json({ error: 'Missing strategy name or code' });
  }

  try {
    const strategyPath = '/opt/quantfi/freqtrade/user_data/strategies/' + strategyName + '.py';
    fs.writeFileSync(strategyPath, strategyCode, 'utf8');
    console.log('Strategy uploaded:', strategyPath);
    res.json({ success: true, message: 'Strategy uploaded', strategyName });
  } catch (error) {
    console.error('Strategy upload failed:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Restart Freqtrade
app.post('/api/restart', (req, res) => {
  const instanceToken = process.env.INSTANCE_TOKEN;
  const requestToken = req.headers['x-instance-token'];

  if (!instanceToken || requestToken !== instanceToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  exec('cd /opt/quantfi && docker-compose restart freqtrade', (error, stdout, stderr) => {
    if (error) {
      return res.status(500).json({ error: 'Restart failed: ' + error.message });
    }
    res.json({ success: true, message: 'Freqtrade restarted' });
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled request error:', err.message);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Promise rejection:', reason);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('QuantFi proxy service running on port ' + PORT);
  console.log('Health check: http://localhost:' + PORT + '/api/health');
});
PROXYEOF

# 安装依赖
cd /opt/quantfi/proxy
echo "安装代理服务依赖..."
npm install --production 2>&1 || {
  echo "生产模式安装失败，尝试完整安装..."
  npm install 2>&1
}

# 验证依赖安装
if [ ! -d "/opt/quantfi/proxy/node_modules/express" ]; then
  echo "❌ 依赖安装失败，express 模块不存在"
  exit 1
fi

if [ ! -d "/opt/quantfi/proxy/node_modules/ccxt" ]; then
  echo "❌ 依赖安装失败，ccxt 模块不存在"
  exit 1
fi

echo "✅ 依赖安装完成"

# 使用 pm2 管理代理服务
npm install -g pm2 2>&1

# 删除可能存在的旧进程和残留 node 进程
pm2 delete quantfi-proxy 2>/dev/null || true
pkill -9 -f 'node.*server.js' 2>/dev/null || true
sleep 1

# 确保端口 8081 空闲
if lsof -i :8081 > /dev/null 2>&1; then
  echo "⚠️ 端口 8081 被占用，尝试释放..."
  fuser -k 8081/tcp 2>/dev/null || true
  sleep 2
fi

# 启动代理服务
echo "启动代理服务..."
pm2 start /opt/quantfi/proxy/server.js --name quantfi-proxy --log /opt/quantfi/logs/proxy.log

# 等待 3 秒让服务启动
sleep 3

# 验证服务是否启动成功
if pm2 list | grep -q "quantfi-proxy.*online"; then
  echo "✅ 代理服务启动成功"
else
  echo "❌ 代理服务启动失败，查看日志："
  pm2 logs quantfi-proxy --lines 30 --nostream
fi

pm2 save
pm2 startup

# ==================== 启动 Freqtrade ====================
echo "[10/12] 启动 Freqtrade..."
cd /opt/quantfi
docker-compose pull
docker-compose up -d

# ==================== 等待服务就绪 ====================
echo "[11/12] 验证服务状态..."

# 等待代理服务就绪（最多等待 60 秒）
PROXY_READY=false
echo "⏳ 等待代理服务就绪..."
for i in {1..30}; do
  if curl -sf http://localhost:8081/api/health > /dev/null 2>&1; then
    PROXY_READY=true
    echo "✅ 代理服务已就绪"
    break
  fi
  echo "⏳ 等待代理服务... ($i/30)"
  sleep 2
done

if [ "$PROXY_READY" = false ]; then
  echo "⚠️ 代理服务启动超时"
fi

# 等待 Freqtrade 就绪（最多等待 60 秒）
FT_READY=false
echo "⏳ 等待交易机器人就绪..."
for i in {1..30}; do
  if curl -sf http://localhost:8080/api/v1/ping > /dev/null 2>&1; then
    FT_READY=true
    echo "✅ 交易机器人已就绪"
    break
  fi
  echo "⏳ 等待交易机器人... ($i/30)"
  sleep 2
done

if [ "$FT_READY" = false ]; then
  echo "⚠️ 交易机器人启动超时，查看日志..."
  docker-compose logs --tail=20
fi

# 确定服务状态
PROXY_STATUS="stopped"
FT_STATUS="stopped"
[ "$PROXY_READY" = true ] && PROXY_STATUS="running"
[ "$FT_READY" = true ] && FT_STATUS="running"

# 写入心跳脚本（包含 Freqtrade 状态检查）
cat > /opt/quantfi/heartbeat.sh <<'HBEOF'
#!/bin/bash
# QuantFi VPS 心跳脚本
# 每分钟执行，上报状态到平台

source /opt/quantfi/.env

# 获取系统状态
CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)
MEM_USAGE=$(free | grep Mem | awk '{print $3/$2 * 100.0}')
DISK_USAGE=$(df / | tail -1 | awk '{print $5}' | tr -d '%')

# 检查 Freqtrade 状态
FT_STATUS="stopped"
if docker ps | grep -q freqtrade; then
  FT_STATUS="running"
fi

# 上报心跳（使用正确的 API 端点：/api/instances/:id/heartbeat）
curl -s -X POST "${API_ENDPOINT}/api/instances/${INSTANCE_ID}/heartbeat" \
  -H "Content-Type: application/json" \
  -H "X-Instance-Token: ${INSTANCE_TOKEN}" \
  -d "{
    \"cpuUsage\": ${CPU_USAGE:-0},
    \"memoryUsage\": ${MEM_USAGE:-0},
    \"diskUsage\": ${DISK_USAGE:-0},
    \"freqtradeStatus\": \"${FT_STATUS}\"
  }" > /dev/null 2>&1

echo "$(date '+%Y-%m-%d %H:%M:%S') - 心跳发送完成, CPU: ${CPU_USAGE}%, MEM: ${MEM_USAGE}%, DISK: ${DISK_USAGE}%, Freqtrade: ${FT_STATUS}"
HBEOF

chmod +x /opt/quantfi/heartbeat.sh

# 写入 Freqtrade 控制脚本（全英文）
cat > /opt/quantfi/freqtrade-ctl.sh <<'CTLEOF'
#!/bin/bash
# Freqtrade control script

source /opt/quantfi/.env

case "$1" in
  start)
    cd /opt/quantfi && docker-compose up -d
    echo "Freqtrade started"
    ;;
  stop)
    cd /opt/quantfi && docker-compose stop
    echo "Freqtrade stopped"
    ;;
  restart)
    cd /opt/quantfi && docker-compose restart
    echo "Freqtrade restarted"
    ;;
  status)
    docker ps | grep freqtrade
    ;;
  logs)
    docker-compose logs --tail=100 -f
    ;;
  *)
    echo "Usage: $0 {start|stop|restart|status|logs}"
    exit 1
    ;;
esac
CTLEOF

chmod +x /opt/quantfi/freqtrade-ctl.sh

# 添加 cron 定时任务（每分钟执行心跳）
(crontab -l 2>/dev/null | grep -v "heartbeat.sh"; echo "* * * * * /opt/quantfi/heartbeat.sh >> /opt/quantfi/logs/heartbeat.log 2>&1") | crontab -

# ==================== 禁用不必要的服务 ====================
echo "[10/10] 禁用不必要的服务..."
systemctl stop avahi-daemon 2>/dev/null || true
systemctl disable avahi-daemon 2>/dev/null || true
systemctl stop cups 2>/dev/null || true
systemctl disable cups 2>/dev/null || true

# ==================== 回调通知平台 ====================
echo "[12/12] 通知平台 VPS 就绪..."
source /opt/quantfi/.env

# 发送就绪回调（包含详细服务状态）
READY_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${API_ENDPOINT}/api/instances/{{INSTANCE_ID}}/ready" \
  -H "Content-Type: application/json" \
  -H "X-Instance-Token: ${INSTANCE_TOKEN}" \
  -d "{
    \"status\": \"ready\",
    \"freqtradeStatus\": \"${FT_STATUS}\",
    \"proxyStatus\": \"${PROXY_STATUS}\"
  }" 2>/dev/null) || true

HTTP_CODE=$(echo "$READY_RESPONSE" | tail -n1)
RESPONSE_BODY=$(echo "$READY_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ 就绪通知发送成功"
else
  echo "⚠️ 就绪通知发送失败 (HTTP: ${HTTP_CODE})，将通过心跳同步状态"
fi

# ==================== 完成 ====================
echo "=========================================="
echo "QuantFi VPS 初始化完成！"
echo "实例 ID: {{INSTANCE_ID}}"
echo "代理服务: ${PROXY_STATUS}"
echo "交易机器人: ${FT_STATUS}"
echo "Freqtrade API: http://localhost:8080"
echo "代理服务 API: http://localhost:8081"
echo "控制脚本: /opt/quantfi/freqtrade-ctl.sh"
echo "=========================================="
