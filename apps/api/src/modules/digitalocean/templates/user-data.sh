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

# ==================== 配置 Swap（防止 1GB VPS 内存不足）====================
echo "[1.5/12] 配置 Swap..."
if [ ! -f /swapfile ]; then
  # 创建 1GB swap 文件
  fallocate -l 1G /swapfile 2>/dev/null || dd if=/dev/zero of=/swapfile bs=1M count=1024
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  # 开机自动挂载
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
  # 调整 swappiness（较低的值减少 swap 使用，但在内存紧张时仍会使用）
  sysctl vm.swappiness=10
  echo 'vm.swappiness=10' >> /etc/sysctl.conf
  echo "✅ Swap 配置完成（1GB）"
else
  echo "✅ Swap 已存在"
fi

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

# 验证主服务器 IP 格式
MASTER_IP="{{MASTER_SERVER_IP}}"
if [[ "$MASTER_IP" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+(/[0-9]+)?$ ]]; then
  # 允许 SSH（仅来自主服务器）
  ufw allow from $MASTER_IP to any port 22
  # 允许代理服务（仅来自主服务器）
  ufw allow from $MASTER_IP to any port 8081
  echo "✅ UFW 已配置 IP 白名单: $MASTER_IP"
else
  # 降级：如果 IP 无效，允许所有来源（但有 fail2ban 保护）
  echo "⚠️ MASTER_SERVER_IP 格式无效 ($MASTER_IP)，降级为允许所有来源"
  ufw allow 22/tcp
  ufw allow 8081/tcp
fi

# 允许 Freqtrade API（全开放，因为有 JWT 验证）
ufw allow 8080/tcp

# 启用防火墙（非交互式）
echo "y" | ufw enable 2>/dev/null || true

echo "✅ UFW 防火墙配置完成"

# ==================== SSH 配置 ====================
echo "[7/12] 配置 SSH..."

# 重要：保留密码登录，确保可以通过统一密码访问 VPS
# 同时启用公钥认证作为备选方式
sed -i 's/^#*PasswordAuthentication.*/PasswordAuthentication yes/' /etc/ssh/sshd_config
sed -i 's/^#*PermitRootLogin.*/PermitRootLogin yes/' /etc/ssh/sshd_config
sed -i 's/^#*PubkeyAuthentication.*/PubkeyAuthentication yes/' /etc/ssh/sshd_config

# 添加主服务器的 SSH 公钥（如果提供了的话）
# 检查：非空、不包含 {{ 占位符、以 ssh- 开头（有效公钥格式）
MASTER_KEY="{{MASTER_SSH_KEY}}"
if [ -n "$MASTER_KEY" ] && [[ ! "$MASTER_KEY" =~ \{\{ ]] && [[ "$MASTER_KEY" =~ ^ssh- ]]; then
  mkdir -p /root/.ssh
  chmod 700 /root/.ssh
  echo "$MASTER_KEY" >> /root/.ssh/authorized_keys
  chmod 600 /root/.ssh/authorized_keys
  echo "✅ 主服务器 SSH 公钥已添加"
else
  echo "ℹ️ 未提供有效的 SSH 公钥，跳过"
fi

# SSH 安全加固（不影响密码登录）
grep -q "^MaxAuthTries" /etc/ssh/sshd_config || echo "MaxAuthTries 5" >> /etc/ssh/sshd_config
grep -q "^LoginGraceTime" /etc/ssh/sshd_config || echo "LoginGraceTime 60" >> /etc/ssh/sshd_config

systemctl restart sshd || true
echo "✅ SSH 配置完成（密码登录已启用）"

# ==================== 创建工作目录 ====================
echo "[8/12] 创建工作目录..."
mkdir -p /opt/quantfi/freqtrade/user_data/strategies
mkdir -p /opt/quantfi/freqtrade/user_data/data
mkdir -p /opt/quantfi/logs
chmod 755 /opt/quantfi/logs
cd /opt/quantfi

# 写入环境变量（安全：先设置权限再写入）
touch /opt/quantfi/.env
chmod 600 /opt/quantfi/.env
cat > /opt/quantfi/.env <<ENVEOF
INSTANCE_ID={{INSTANCE_ID}}
API_ENDPOINT={{API_ENDPOINT}}
INSTANCE_TOKEN={{INSTANCE_TOKEN}}
FREQTRADE_API_TOKEN={{FREQTRADE_API_TOKEN}}
ENVEOF
echo "✅ 环境变量文件已创建（权限 600）"

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
    "price_side": "other",
    "use_order_book": true,
    "order_book_top": 1,
    "price_last_balance": 0.0,
    "check_depth_of_market": {
      "enabled": false,
      "bids_to_ask_delta": 1
    }
  },
  "exit_pricing": {
    "price_side": "other",
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
    // 修复：正确处理值中包含 '=' 的情况（如 URL）
    const idx = line.indexOf('=');
    if (idx > 0) {
      const key = line.substring(0, idx).trim();
      const value = line.substring(idx + 1).trim();
      if (key && value && !process.env[key]) {
        process.env[key] = value;
      }
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
      // 安全检查：防止路径注入，只允许字母数字下划线
      const safeName = strategyName.replace(/[^a-zA-Z0-9_-]/g, '');
      if (!safeName || safeName !== strategyName) {
        return res.status(400).json({ error: 'Invalid strategy name' });
      }
      fs.writeFileSync('/opt/quantfi/freqtrade/user_data/strategies/' + safeName + '.py', strategyCode, 'utf8');

      // 同时更新 docker-compose.yml 中的策略名（关键修复！）
      const dockerComposePath = '/opt/quantfi/docker-compose.yml';
      let dockerCompose = fs.readFileSync(dockerComposePath, 'utf8');
      // 替换 --strategy 后面的策略名
      dockerCompose = dockerCompose.replace(/--strategy\s+\S+/g, '--strategy ' + safeName);
      fs.writeFileSync(dockerComposePath, dockerCompose, 'utf8');
      console.log('✅ docker-compose.yml 策略名已更新为:', safeName);
    }
    if (config) {
      fs.writeFileSync('/opt/quantfi/freqtrade/user_data/config.json', JSON.stringify(config, null, 2), 'utf8');
    }
    // 使用 up -d --force-recreate 确保使用新的 docker-compose.yml 配置
    exec('cd /opt/quantfi && docker compose up -d --force-recreate freqtrade', (error) => {
      if (error) return res.status(500).json({ error: 'Restart failed: ' + error.message });
      res.json({ success: true, message: 'Config updated', strategy: strategyName });
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

# 【方案A】独立轻量心跳脚本 - 包含 Freqtrade 状态检测
# 设计目标：即使 CPU 100% 也能成功发送，且能检测 Freqtrade 运行状态
cat > /opt/quantfi/heartbeat-lite.sh <<'HBLITEEOF'
#!/bin/bash
# 轻量心跳 - 检测 Freqtrade 容器状态（不采集系统指标）
# 设计目标：
#   1. 即使 CPU 100% 也能成功发送
#   2. 能检测 Freqtrade 是否在运行
#   3. 不依赖 top/free 等可能卡住的命令

# 读取环境变量（最简单的方式）
source /opt/quantfi/.env 2>/dev/null || true

# 如果变量为空，从文件手动读取
if [ -z "$INSTANCE_ID" ]; then
  INSTANCE_ID=$(grep "^INSTANCE_ID=" /opt/quantfi/.env 2>/dev/null | cut -d= -f2)
fi
if [ -z "$API_ENDPOINT" ]; then
  API_ENDPOINT=$(grep "^API_ENDPOINT=" /opt/quantfi/.env 2>/dev/null | cut -d= -f2)
fi
if [ -z "$INSTANCE_TOKEN" ]; then
  INSTANCE_TOKEN=$(grep "^INSTANCE_TOKEN=" /opt/quantfi/.env 2>/dev/null | cut -d= -f2)
fi

# 快速检测 Freqtrade 容器状态（docker ps 非常轻量，不受 CPU 负载影响）
FT_STATUS="stopped"
if docker ps 2>/dev/null | grep -q freqtrade; then
  FT_STATUS="running"
fi

# 发送轻量心跳（包含 Freqtrade 状态，5秒超时）
curl -s --max-time 5 \
  -X POST "${API_ENDPOINT}/api/instances/${INSTANCE_ID}/heartbeat" \
  -H "Content-Type: application/json" \
  -H "X-Instance-Token: ${INSTANCE_TOKEN}" \
  -d "{\"freqtradeStatus\": \"${FT_STATUS}\"}" > /dev/null 2>&1

# 退出码不影响 cron
exit 0
HBLITEEOF

chmod +x /opt/quantfi/heartbeat-lite.sh
echo "✅ 轻量心跳脚本已创建"

# 完整心跳脚本 - 采集系统指标（可能在高负载时超时，但不影响轻量心跳）
cat > /opt/quantfi/heartbeat.sh <<'HBEOF'
#!/bin/bash
source /opt/quantfi/.env

# CPU 使用率（兼容不同 Linux 版本，不依赖 bc）
# 解析 us + sy 得到总 CPU 使用率
CPU_LINE=$(top -bn1 2>/dev/null | grep -E "Cpu|%Cpu" | head -1)
if [ -n "$CPU_LINE" ]; then
  CPU_US=$(echo "$CPU_LINE" | grep -oP '\d+\.?\d*\s*us' | grep -oP '\d+\.?\d*' | head -1)
  CPU_SY=$(echo "$CPU_LINE" | grep -oP '\d+\.?\d*\s*sy' | grep -oP '\d+\.?\d*' | head -1)
  # 使用 awk 替代 bc，避免依赖问题
  CPU_USAGE=$(echo "${CPU_US:-0} ${CPU_SY:-0}" | awk '{printf "%.1f", $1 + $2}' 2>/dev/null || echo "0")
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

# 发送完整心跳（含指标，10秒超时）
curl -s --max-time 10 -X POST "${API_ENDPOINT}/api/instances/${INSTANCE_ID}/heartbeat" \
  -H "Content-Type: application/json" \
  -H "X-Instance-Token: ${INSTANCE_TOKEN}" \
  -d "{\"cpuUsage\": ${CPU_USAGE}, \"memoryUsage\": ${MEM_USAGE}, \"diskUsage\": ${DISK_USAGE}, \"freqtradeStatus\": \"${FT_STATUS}\"}" > /dev/null 2>&1
HBEOF

chmod +x /opt/quantfi/heartbeat.sh
echo "✅ 完整心跳脚本已创建"

# 配置 cron 心跳任务：
# 1. 轻量心跳：每分钟运行（高优先级，不依赖任何复杂命令）
# 2. 完整心跳：每分钟 30 秒时运行（采集指标，可能在高负载时超时）
(crontab -l 2>/dev/null | grep -v "heartbeat"; \
echo "# QuantFi 轻量心跳（每分钟，高优先级）"; \
echo "* * * * * /opt/quantfi/heartbeat-lite.sh"; \
echo "# QuantFi 完整心跳（每分钟30秒，含指标）"; \
echo "* * * * * sleep 30 && /opt/quantfi/heartbeat.sh >> /opt/quantfi/logs/heartbeat.log 2>&1") | crontab -

echo "✅ 心跳 cron 配置完成（轻量版 + 完整版）"

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
