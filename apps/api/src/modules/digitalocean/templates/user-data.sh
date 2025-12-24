#!/bin/bash
# QuantFi VPS 初始化脚本
# 变量由服务端替换: {{INSTANCE_ID}}, {{API_ENDPOINT}}, {{API_KEY_ENCRYPTED}}

set -e  # 遇到错误立即退出

echo "[$(date)] ===== QuantFi VPS 初始化开始 ====="

# 1. 系统更新
echo "[$(date)] 更新系统..."
apt-get update -y
apt-get upgrade -y

# 2. 安装 Docker
echo "[$(date)] 检查 Docker..."
if ! command -v docker &> /dev/null; then
  echo "[$(date)] 安装 Docker..."
  curl -fsSL https://get.docker.com -o get-docker.sh
  sh get-docker.sh
  systemctl start docker
  systemctl enable docker
  rm -f get-docker.sh
  echo "[$(date)] Docker 安装完成"
else
  echo "[$(date)] Docker 已安装，跳过"
fi

# 3. 安装 Node.js 20 (用于心跳脚本)
echo "[$(date)] 检查 Node.js..."
if ! command -v node &> /dev/null; then
  echo "[$(date)] 安装 Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
  echo "[$(date)] Node.js 安装完成: $(node -v)"
else
  echo "[$(date)] Node.js 已安装: $(node -v)"
fi

# 4. 创建工作目录
echo "[$(date)] 创建工作目录..."
mkdir -p /opt/quantfi/{config,data,logs}
cd /opt/quantfi

# 5. 拉取 Freqtrade 镜像
echo "[$(date)] 拉取 Freqtrade 镜像..."
docker pull freqtradeorg/freqtrade:stable

# 6. 创建心跳上报脚本
echo "[$(date)] 配置心跳上报脚本..."
cat > /opt/quantfi/heartbeat.sh << 'HEARTBEAT_EOF'
#!/bin/bash
# 心跳上报脚本 - 每 5 分钟执行一次

# 获取 CPU 使用率 (%)
CPU=$(top -bn1 | grep "Cpu(s)" | sed "s/.*, *\([0-9.]*\)%* id.*/\1/" | awk '{print 100 - $1}')

# 获取内存使用率 (%)
MEM=$(free | grep Mem | awk '{print ($3/$2) * 100.0}')

# 上报到 API
curl -X POST "{{API_ENDPOINT}}/api/instances/{{INSTANCE_ID}}/heartbeat" \
  -H "Content-Type: application/json" \
  -d "{\"cpuUsage\": ${CPU}, \"memoryUsage\": ${MEM}}" \
  --max-time 10 \
  --silent \
  --fail \
  >> /opt/quantfi/logs/heartbeat.log 2>&1

# 记录日志
echo "[$(date)] 心跳上报完成: CPU=${CPU}%, MEM=${MEM}%" >> /opt/quantfi/logs/heartbeat.log
HEARTBEAT_EOF

chmod +x /opt/quantfi/heartbeat.sh

# 7. 配置 cron 定时任务（每 5 分钟）
echo "[$(date)] 配置 cron 任务..."
(crontab -l 2>/dev/null || echo "") | grep -v "quantfi/heartbeat.sh" > /tmp/cron_new
echo "*/5 * * * * /opt/quantfi/heartbeat.sh" >> /tmp/cron_new
crontab /tmp/cron_new
rm -f /tmp/cron_new
echo "[$(date)] Cron 任务配置完成"

# 8. 立即执行一次心跳（验证连通性）
echo "[$(date)] 执行首次心跳..."
/opt/quantfi/heartbeat.sh || echo "[$(date)] 首次心跳失败（可能网络未就绪）"

# 9. 创建 Freqtrade 配置文件（占位符，后续任务实现）
echo "[$(date)] 创建 Freqtrade 配置..."
cat > /opt/quantfi/config/config.json << 'CONFIG_EOF'
{
  "max_open_trades": 3,
  "stake_currency": "USDT",
  "stake_amount": "unlimited",
  "tradable_balance_ratio": 0.99,
  "dry_run": true,
  "dry_run_wallet": 1000,
  "cancel_open_orders_on_exit": false,
  "unfilledtimeout": {
    "entry": 10,
    "exit": 10,
    "exit_timeout_count": 0,
    "unit": "minutes"
  },
  "exchange": {
    "name": "binance",
    "key": "",
    "secret": "",
    "ccxt_config": {},
    "ccxt_async_config": {},
    "pair_whitelist": [],
    "pair_blacklist": []
  },
  "api_server": {
    "enabled": false,
    "listen_ip_address": "0.0.0.0",
    "listen_port": 8080
  }
}
CONFIG_EOF

# 10. 标记初始化完成
echo "[$(date)] 创建初始化完成标记..."
touch /opt/quantfi/.initialized
echo "$(date)" > /opt/quantfi/.initialized

# 11. 输出初始化完成信息
echo "[$(date)] ===== QuantFi VPS 初始化完成 ====="
echo "[$(date)] 实例 ID: {{INSTANCE_ID}}"
echo "[$(date)] API 端点: {{API_ENDPOINT}}"
echo "[$(date)] Docker 版本: $(docker --version)"
echo "[$(date)] Node.js 版本: $(node -v)"
echo "[$(date)] Freqtrade 镜像: freqtradeorg/freqtrade:stable"
echo "[$(date)] 工作目录: /opt/quantfi"
echo "[$(date)] 心跳日志: /opt/quantfi/logs/heartbeat.log"
echo "[$(date)] 心跳间隔: 5 分钟"
