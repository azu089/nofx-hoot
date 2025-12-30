#!/bin/bash
# QuantFi VPS 初始化脚本（含网络安全配置 + Freqtrade 自动启动）
# 实例 ID: {{INSTANCE_ID}}
# 生成时间: {{GENERATED_AT}}

set -e

echo "=========================================="
echo "QuantFi VPS 初始化开始"
echo "实例 ID: {{INSTANCE_ID}}"
echo "=========================================="

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

# ==================== 配置 iptables 防火墙 ====================
echo "[5/10] 配置防火墙..."

# 清空现有规则
iptables -F
iptables -X

# 默认策略
iptables -P INPUT DROP
iptables -P FORWARD DROP
iptables -P OUTPUT ACCEPT

# 允许回环接口
iptables -A INPUT -i lo -j ACCEPT
iptables -A OUTPUT -o lo -j ACCEPT

# 允许已建立的连接
iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT

# SSH 白名单（管理 IP）
{{SSH_WHITELIST_RULES}}
# 拒绝其他 SSH 连接
iptables -A INPUT -p tcp --dport 22 -j DROP

# API 端口（Freqtrade API）- 需要 Token 验证
iptables -A INPUT -p tcp --dport 8080 -j ACCEPT

# 允许 ICMP（ping）
iptables -A INPUT -p icmp --icmp-type echo-request -j ACCEPT

# 保存规则
mkdir -p /etc/iptables
iptables-save > /etc/iptables/rules.v4

# 设置开机自动加载
cat > /etc/network/if-pre-up.d/iptables <<'IPEOF'
#!/bin/sh
/sbin/iptables-restore < /etc/iptables/rules.v4
IPEOF
chmod +x /etc/network/if-pre-up.d/iptables

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
    "ccxt_async_config": {}
  },
  "pairlists": [
    {
      "method": "StaticPairList",
      "pairs": ["BTC/USDT", "ETH/USDT"]
    }
  ],
  "telegram": {
    "enabled": false
  },
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
cat > /opt/quantfi/docker-compose.yml <<'DCEOF'
version: '3.8'

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
    command: trade --logfile /freqtrade/logs/freqtrade.log --db-url sqlite:////freqtrade/user_data/data/tradesv3.sqlite --config /freqtrade/user_data/config.json --strategy SampleStrategy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/api/v1/ping"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
DCEOF

# ==================== 启动 Freqtrade ====================
echo "[9/10] 启动 Freqtrade..."
cd /opt/quantfi
docker-compose pull
docker-compose up -d

# 等待 Freqtrade 启动
echo "等待 Freqtrade 启动..."
sleep 30

# 验证 Freqtrade 是否运行
if docker ps | grep -q freqtrade; then
  echo "✅ Freqtrade 已成功启动"
else
  echo "⚠️ Freqtrade 启动失败，查看日志..."
  docker-compose logs --tail=50
fi

# 写入心跳脚本（包含 Freqtrade 状态检查）
cat > /opt/quantfi/heartbeat.sh <<'HBEOF'
#!/bin/bash
# QuantFi VPS 心跳脚本
# 每分钟执行，上报状态到平台

source /opt/quantfi/.env

# 获取系统状态
CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)
MEM_USAGE=$(free | grep Mem | awk '{print $3/$2 * 100.0}')

# 检查 Freqtrade 状态
FT_STATUS="stopped"
if docker ps | grep -q freqtrade; then
  FT_STATUS="running"
fi

# 上报心跳
curl -s -X POST "${API_ENDPOINT}/api/instances/heartbeat" \
  -H "Content-Type: application/json" \
  -H "X-Instance-Token: ${INSTANCE_TOKEN}" \
  -d "{
    \"instanceId\": \"${INSTANCE_ID}\",
    \"cpuUsage\": ${CPU_USAGE:-0},
    \"memoryUsage\": ${MEM_USAGE:-0},
    \"freqtradeStatus\": \"${FT_STATUS}\"
  }" > /dev/null 2>&1

echo "$(date '+%Y-%m-%d %H:%M:%S') - 心跳发送完成, Freqtrade: ${FT_STATUS}"
HBEOF

chmod +x /opt/quantfi/heartbeat.sh

# 写入 Freqtrade 控制脚本
cat > /opt/quantfi/freqtrade-ctl.sh <<'CTLEOF'
#!/bin/bash
# Freqtrade 控制脚本

source /opt/quantfi/.env

case "$1" in
  start)
    cd /opt/quantfi && docker-compose up -d
    echo "Freqtrade 启动完成"
    ;;
  stop)
    cd /opt/quantfi && docker-compose stop
    echo "Freqtrade 已停止"
    ;;
  restart)
    cd /opt/quantfi && docker-compose restart
    echo "Freqtrade 已重启"
    ;;
  status)
    docker ps | grep freqtrade
    ;;
  logs)
    docker-compose logs --tail=100 -f
    ;;
  *)
    echo "用法: $0 {start|stop|restart|status|logs}"
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
# 通知平台 VPS 初始化完成
source /opt/quantfi/.env
curl -s -X POST "${API_ENDPOINT}/api/instances/{{INSTANCE_ID}}/ready" \
  -H "Content-Type: application/json" \
  -H "X-Instance-Token: ${INSTANCE_TOKEN}" \
  -d '{"status": "ready", "freqtrade": "running"}' > /dev/null 2>&1 || true

# ==================== 完成 ====================
echo "=========================================="
echo "QuantFi VPS 初始化完成！"
echo "实例 ID: {{INSTANCE_ID}}"
echo "Freqtrade API: http://localhost:8080"
echo "控制脚本: /opt/quantfi/freqtrade-ctl.sh"
echo "=========================================="
