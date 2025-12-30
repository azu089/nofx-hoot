#!/bin/bash
# QuantFi 服务监控脚本
# 用途：检查所有服务状态，发送告警
#
# 使用方式：
# 1. 手动执行：./scripts/运维/监控检查.sh
# 2. 定时任务：*/5 * * * * /opt/quantfi/scripts/运维/监控检查.sh

set -e

# ==================== 配置 ====================

# 服务配置
API_URL="${API_URL:-http://localhost:4001}"
WEB_URL="${WEB_URL:-http://localhost:3001}"

# 告警配置（可选）
SLACK_WEBHOOK="${SLACK_WEBHOOK:-}"
EMAIL_TO="${ALERT_EMAIL:-}"

# 阈值配置
DISK_THRESHOLD=80       # 磁盘使用率告警阈值 (%)
MEMORY_THRESHOLD=80     # 内存使用率告警阈值 (%)
CPU_THRESHOLD=80        # CPU 使用率告警阈值 (%)

# ==================== 颜色 ====================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# ==================== 函数 ====================

log_info() {
  echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

send_alert() {
  local level="$1"
  local message="$2"

  # Slack 通知
  if [ -n "$SLACK_WEBHOOK" ]; then
    local emoji="⚠️"
    [ "$level" = "error" ] && emoji="🚨"
    [ "$level" = "ok" ] && emoji="✅"

    curl -s -X POST "$SLACK_WEBHOOK" \
      -H "Content-Type: application/json" \
      -d "{\"text\": \"$emoji QuantFi 监控告警: $message\"}" > /dev/null 2>&1
  fi

  # 邮件通知（需要配置 mailutils）
  if [ -n "$EMAIL_TO" ] && command -v mail &> /dev/null; then
    echo "$message" | mail -s "QuantFi 监控告警 [$level]" "$EMAIL_TO"
  fi
}

check_url() {
  local name="$1"
  local url="$2"
  local expected="${3:-200}"

  local code
  code=$(curl -s -o /dev/null -w '%{http_code}' --connect-timeout 5 "$url" 2>/dev/null || echo "000")

  if [ "$code" = "$expected" ]; then
    log_info "$name: 正常 (HTTP $code)"
    return 0
  else
    log_error "$name: 异常 (HTTP $code, 期望 $expected)"
    send_alert "error" "$name 服务异常 (HTTP $code)"
    return 1
  fi
}

check_docker_service() {
  local name="$1"

  if docker ps --format '{{.Names}}' | grep -q "^${name}$"; then
    local status
    status=$(docker inspect --format='{{.State.Status}}' "$name" 2>/dev/null)
    if [ "$status" = "running" ]; then
      log_info "Docker $name: 运行中"
      return 0
    fi
  fi

  log_error "Docker $name: 未运行"
  send_alert "error" "Docker 容器 $name 未运行"
  return 1
}

check_disk() {
  local usage
  usage=$(df -h / | awk 'NR==2 {print $5}' | tr -d '%')

  if [ "$usage" -gt "$DISK_THRESHOLD" ]; then
    log_warn "磁盘使用率: ${usage}% (阈值 ${DISK_THRESHOLD}%)"
    send_alert "warn" "磁盘使用率过高: ${usage}%"
    return 1
  else
    log_info "磁盘使用率: ${usage}%"
    return 0
  fi
}

check_memory() {
  local usage
  if command -v free &> /dev/null; then
    usage=$(free | awk '/Mem:/ {printf("%.0f", $3/$2 * 100)}')
  else
    # macOS
    usage=$(vm_stat | awk '/Pages active/ {active=$3} /Pages wired/ {wired=$4} /Pages free/ {free=$3} END {printf("%.0f", (active+wired)/(active+wired+free)*100)}' 2>/dev/null || echo "0")
  fi

  if [ "$usage" -gt "$MEMORY_THRESHOLD" ]; then
    log_warn "内存使用率: ${usage}% (阈值 ${MEMORY_THRESHOLD}%)"
    send_alert "warn" "内存使用率过高: ${usage}%"
    return 1
  else
    log_info "内存使用率: ${usage}%"
    return 0
  fi
}

check_database() {
  if command -v docker &> /dev/null; then
    if docker exec quantfi-postgres-prod pg_isready -U quantfi -d quantfi > /dev/null 2>&1; then
      log_info "PostgreSQL: 正常"
      return 0
    elif docker exec quantfi-postgres pg_isready -U quantfi -d quantfi > /dev/null 2>&1; then
      log_info "PostgreSQL: 正常"
      return 0
    fi
  fi

  log_error "PostgreSQL: 无法连接"
  send_alert "error" "PostgreSQL 数据库无法连接"
  return 1
}

check_redis() {
  if command -v docker &> /dev/null; then
    if docker exec quantfi-redis-prod redis-cli ping > /dev/null 2>&1; then
      log_info "Redis: 正常"
      return 0
    elif docker exec quantfi-redis redis-cli ping > /dev/null 2>&1; then
      log_info "Redis: 正常"
      return 0
    fi
  fi

  log_error "Redis: 无法连接"
  send_alert "error" "Redis 缓存无法连接"
  return 1
}

# ==================== 主程序 ====================

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║              QuantFi 服务监控检查                             ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "检查时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

ERRORS=0

# 1. HTTP 服务检查
echo "═══ HTTP 服务 ═══"
check_url "API 健康检查" "$API_URL/api/health" || ((ERRORS++))
check_url "前端服务" "$WEB_URL" || ((ERRORS++))
echo ""

# 2. Docker 容器检查
echo "═══ Docker 容器 ═══"
if command -v docker &> /dev/null; then
  check_docker_service "quantfi-postgres-prod" || check_docker_service "quantfi-postgres" || ((ERRORS++))
  check_docker_service "quantfi-redis-prod" || check_docker_service "quantfi-redis" || ((ERRORS++))
  check_docker_service "quantfi-api-prod" 2>/dev/null || log_info "Docker quantfi-api-prod: 未使用容器部署"
  check_docker_service "quantfi-web-prod" 2>/dev/null || log_info "Docker quantfi-web-prod: 未使用容器部署"
else
  log_warn "Docker 未安装，跳过容器检查"
fi
echo ""

# 3. 数据库检查
echo "═══ 数据库服务 ═══"
check_database || ((ERRORS++))
check_redis || ((ERRORS++))
echo ""

# 4. 系统资源检查
echo "═══ 系统资源 ═══"
check_disk || ((ERRORS++))
check_memory || ((ERRORS++))
echo ""

# 5. 结果汇总
echo "═══ 检查结果 ═══"
if [ $ERRORS -eq 0 ]; then
  log_info "所有检查通过 ✅"
  exit 0
else
  log_error "发现 $ERRORS 个问题 ❌"
  exit 1
fi
