#!/bin/bash
# HOOT 健康监控脚本

API_URL="${API_URL:-http://localhost:4001}"
WEB_URL="${WEB_URL:-http://localhost:3001}"

echo "=== HOOT 健康检查 ==="
echo "时间: $(date)"
echo ""

# 检查 API
echo "📡 API 服务 ($API_URL):"
api_status=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/api/health/liveness" 2>/dev/null)
if [ "$api_status" = "200" ]; then
  echo "  状态: ✅ 正常"
  api_health=$(curl -s "$API_URL/api/health" 2>/dev/null)

  # 解析状态
  status=$(echo "$api_health" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
  db_status=$(echo "$api_health" | grep -o '"database":{"status":"[^"]*"' | cut -d'"' -f6)
  redis_status=$(echo "$api_health" | grep -o '"redis":{"status":"[^"]*"' | cut -d'"' -f6)
  uptime=$(echo "$api_health" | grep -o '"uptime":[0-9]*' | cut -d':' -f2)

  echo "  总体状态: $status"
  echo "  数据库: $db_status"
  echo "  Redis: $redis_status"
  echo "  运行时间: ${uptime}s"
else
  echo "  状态: ❌ 异常 (HTTP $api_status)"
fi

echo ""

# 检查 Web
echo "🌐 Web 服务 ($WEB_URL):"
web_status=$(curl -s -o /dev/null -w "%{http_code}" "$WEB_URL/api/health" 2>/dev/null)
if [ "$web_status" = "200" ]; then
  echo "  状态: ✅ 正常"
else
  echo "  状态: ❌ 异常 (HTTP $web_status)"
fi

echo ""

# 检查 Docker 容器（如果可用）
if command -v docker &> /dev/null; then
  echo "🐳 Docker 容器:"

  containers=("hoot-api" "hoot-web" "hoot-postgres" "hoot-redis")
  for container in "${containers[@]}"; do
    status=$(docker inspect -f '{{.State.Status}}' "$container" 2>/dev/null)
    health=$(docker inspect -f '{{.State.Health.Status}}' "$container" 2>/dev/null)

    if [ -n "$status" ]; then
      if [ "$status" = "running" ]; then
        if [ "$health" = "healthy" ]; then
          echo "  $container: ✅ 运行中 (健康)"
        elif [ "$health" = "unhealthy" ]; then
          echo "  $container: ⚠️ 运行中 (不健康)"
        else
          echo "  $container: ✅ 运行中"
        fi
      else
        echo "  $container: ❌ $status"
      fi
    fi
  done
fi

echo ""
echo "=== 检查完成 ==="
