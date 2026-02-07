#!/bin/bash
# HOOT 健康监控脚本（增强版）
# 支持 Telegram 告警通知
# 用法:
#   ./monitor.sh          # 显示状态
#   ./monitor.sh --alert  # 启用告警模式

# ==================== 配置 ====================

API_URL="${API_URL:-http://localhost:4001}"
WEB_URL="${WEB_URL:-http://localhost:3001}"

# Telegram 通知配置
TG_BOT_API="${TG_BOT_API:-}"
ADMIN_TG_ID="${ADMIN_TG_ID:-}"

# 告警阈值
DISK_WARN_PERCENT=80
DISK_CRIT_PERCENT=90
MEMORY_WARN_PERCENT=80

# 状态记录文件（防止重复告警）
STATE_FILE="/tmp/hoot_monitor_state"

# ==================== 函数 ====================

# 发送 Telegram 告警
send_alert() {
  local message="$1"
  local level="${2:-warning}"

  # 添加表情和时间戳
  local emoji="⚠️"
  if [ "$level" = "critical" ]; then
    emoji="🚨"
  elif [ "$level" = "info" ]; then
    emoji="ℹ️"
  elif [ "$level" = "success" ]; then
    emoji="✅"
  fi

  local full_message="$emoji [HOOT 告警] $(date '+%Y-%m-%d %H:%M:%S')

$message"

  echo "$full_message"

  # 发送 Telegram 通知
  if [ -n "$TG_BOT_API" ] && [ -n "$ADMIN_TG_ID" ]; then
    curl -s -X POST "$TG_BOT_API/send-message" \
      -H "Content-Type: application/json" \
      -d "{\"telegramId\":\"$ADMIN_TG_ID\",\"message\":\"$full_message\"}" \
      > /dev/null 2>&1 || true
  fi
}

# 检查并记录状态变化（防止重复告警）
check_state_change() {
  local key="$1"
  local new_state="$2"

  local old_state=""
  if [ -f "$STATE_FILE" ]; then
    old_state=$(grep "^$key=" "$STATE_FILE" 2>/dev/null | cut -d'=' -f2 || true)
  fi

  # 更新状态文件
  if [ -f "$STATE_FILE" ]; then
    grep -v "^$key=" "$STATE_FILE" > "${STATE_FILE}.tmp" 2>/dev/null || true
    mv "${STATE_FILE}.tmp" "$STATE_FILE" 2>/dev/null || true
  fi
  echo "$key=$new_state" >> "$STATE_FILE"

  # 返回是否状态变化
  if [ "$old_state" != "$new_state" ]; then
    return 0  # 状态变化
  else
    return 1  # 状态未变
  fi
}

# 检查 API 服务
check_api() {
  echo "📡 API 服务 ($API_URL):"

  api_status=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/api/health/liveness" 2>/dev/null || echo "000")

  if [ "$api_status" = "200" ]; then
    echo "  状态: ✅ 正常"

    api_health=$(curl -s "$API_URL/api/health" 2>/dev/null)

    # 解析状态
    status=$(echo "$api_health" | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)
    db_status=$(echo "$api_health" | grep -o '"database":{"status":"[^"]*"' | cut -d'"' -f6)
    redis_status=$(echo "$api_health" | grep -o '"redis":{"status":"[^"]*"' | cut -d'"' -f6)
    uptime=$(echo "$api_health" | grep -o '"uptime":[0-9]*' | cut -d':' -f2)

    echo "  总体状态: $status"
    echo "  数据库: $db_status"
    echo "  Redis: $redis_status"
    echo "  运行时间: ${uptime}s"

    # 检查子服务状态
    if [ "$db_status" != "up" ]; then
      if check_state_change "db" "down" && [ "$ALERT_MODE" = true ]; then
        send_alert "数据库服务异常！状态: $db_status" "critical"
      fi
    else
      if check_state_change "db" "up" && [ "$ALERT_MODE" = true ]; then
        send_alert "数据库服务已恢复正常" "success"
      fi
    fi

    if [ "$redis_status" != "up" ]; then
      if check_state_change "redis" "down" && [ "$ALERT_MODE" = true ]; then
        send_alert "Redis 服务异常！状态: $redis_status" "critical"
      fi
    else
      if check_state_change "redis" "up" && [ "$ALERT_MODE" = true ]; then
        send_alert "Redis 服务已恢复正常" "success"
      fi
    fi

    # API 恢复告警
    if check_state_change "api" "up" && [ "$ALERT_MODE" = true ]; then
      send_alert "API 服务已恢复正常" "success"
    fi

    return 0
  else
    echo "  状态: ❌ 异常 (HTTP $api_status)"

    # 发送告警
    if check_state_change "api" "down" && [ "$ALERT_MODE" = true ]; then
      send_alert "API 服务异常！HTTP 状态码: $api_status" "critical"
    fi

    return 1
  fi
}

# 检查 Web 服务
check_web() {
  echo "🌐 Web 服务 ($WEB_URL):"

  web_status=$(curl -s -o /dev/null -w "%{http_code}" "$WEB_URL" 2>/dev/null || echo "000")

  if [ "$web_status" = "200" ] || [ "$web_status" = "308" ]; then
    echo "  状态: ✅ 正常"

    if check_state_change "web" "up" && [ "$ALERT_MODE" = true ]; then
      send_alert "Web 服务已恢复正常" "success"
    fi

    return 0
  else
    echo "  状态: ❌ 异常 (HTTP $web_status)"

    if check_state_change "web" "down" && [ "$ALERT_MODE" = true ]; then
      send_alert "Web 服务异常！HTTP 状态码: $web_status" "critical"
    fi

    return 1
  fi
}

# 检查磁盘使用
check_disk() {
  echo "💾 磁盘使用:"

  # 获取根分区使用率
  disk_usage=$(df -h / | awk 'NR==2{print $5}' | tr -d '%')
  disk_info=$(df -h / | awk 'NR==2{print $3 "/" $2 " (" $5 ")"}')

  echo "  使用率: $disk_info"

  if [ "$disk_usage" -ge "$DISK_CRIT_PERCENT" ]; then
    echo "  状态: 🚨 危险"
    if check_state_change "disk" "critical" && [ "$ALERT_MODE" = true ]; then
      send_alert "磁盘空间严重不足！使用率: ${disk_usage}%（超过 ${DISK_CRIT_PERCENT}%）" "critical"
    fi
    return 1
  elif [ "$disk_usage" -ge "$DISK_WARN_PERCENT" ]; then
    echo "  状态: ⚠️ 警告"
    if check_state_change "disk" "warning" && [ "$ALERT_MODE" = true ]; then
      send_alert "磁盘空间不足！使用率: ${disk_usage}%（超过 ${DISK_WARN_PERCENT}%）" "warning"
    fi
    return 0
  else
    echo "  状态: ✅ 正常"
    check_state_change "disk" "ok" || true
    return 0
  fi
}

# 检查内存使用
check_memory() {
  echo "🧠 内存使用:"

  # macOS 和 Linux 内存检查方式不同
  if [ "$(uname)" = "Darwin" ]; then
    # macOS - 简化检查
    echo "  状态: ✅ 正常 (macOS)"
  else
    # Linux
    memory_info=$(free | awk '/Mem:/ {printf "%.0f", ($3/$2)*100}')
    memory_detail=$(free -h | awk '/Mem:/ {print $3 "/" $2}')
    echo "  使用率: $memory_detail ($memory_info%)"

    if [ -n "$memory_info" ] && [ "$memory_info" -ge "$MEMORY_WARN_PERCENT" ]; then
      echo "  状态: ⚠️ 警告"
      if check_state_change "memory" "warning" && [ "$ALERT_MODE" = true ]; then
        send_alert "内存使用率过高！使用率: ${memory_info}%（超过 ${MEMORY_WARN_PERCENT}%）" "warning"
      fi
    else
      echo "  状态: ✅ 正常"
      check_state_change "memory" "ok" || true
    fi
  fi
}

# 检查 Docker 容器
check_docker() {
  if ! command -v docker &> /dev/null; then
    return 0
  fi

  echo "🐳 Docker 容器:"

  containers=("hoot-api" "hoot-web" "hoot-postgres" "hoot-redis" "hoot-telegram-bot")
  for container in "${containers[@]}"; do
    status=$(docker inspect -f '{{.State.Status}}' "$container" 2>/dev/null || echo "")
    health=$(docker inspect -f '{{.State.Health.Status}}' "$container" 2>/dev/null || echo "")

    if [ -n "$status" ]; then
      if [ "$status" = "running" ]; then
        if [ "$health" = "healthy" ]; then
          echo "  $container: ✅ 运行中 (健康)"
          check_state_change "docker_$container" "healthy" || true
        elif [ "$health" = "unhealthy" ]; then
          echo "  $container: ⚠️ 运行中 (不健康)"
          if check_state_change "docker_$container" "unhealthy" && [ "$ALERT_MODE" = true ]; then
            send_alert "容器 $container 健康检查失败！" "warning"
          fi
        else
          echo "  $container: ✅ 运行中"
          check_state_change "docker_$container" "running" || true
        fi
      else
        echo "  $container: ❌ $status"
        if check_state_change "docker_$container" "$status" && [ "$ALERT_MODE" = true ]; then
          send_alert "容器 $container 状态异常: $status" "critical"
        fi
      fi
    fi
  done
}

# ==================== 主程序 ====================

# 解析参数
ALERT_MODE=false
if [ "$1" = "--alert" ]; then
  ALERT_MODE=true
fi

echo "=== HOOT 健康检查 ==="
echo "时间: $(date)"
if [ "$ALERT_MODE" = true ]; then
  echo "模式: 告警模式"
fi
echo ""

# 执行检查
check_api
echo ""

check_web
echo ""

check_disk
echo ""

check_memory
echo ""

check_docker
echo ""

echo "=== 检查完成 ==="
