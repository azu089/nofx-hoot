#!/bin/bash
# HOOT 生产部署脚本

set -e

echo "🚀 HOOT 生产部署脚本"
echo "===================="

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查必要的环境变量
check_env() {
    echo "📋 检查环境变量..."

    required_vars=("DB_PASSWORD" "JWT_SECRET" "ENCRYPTION_KEY" "WEBHOOK_SECRET")
    missing_vars=()

    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            missing_vars+=("$var")
        fi
    done

    if [ ${#missing_vars[@]} -gt 0 ]; then
        echo -e "${RED}❌ 缺少必要的环境变量:${NC}"
        for var in "${missing_vars[@]}"; do
            echo "   - $var"
        done
        echo ""
        echo "请设置环境变量后重试，例如："
        echo "  export DB_PASSWORD=your_secure_password"
        echo "  export JWT_SECRET=\$(openssl rand -hex 32)"
        exit 1
    fi

    echo -e "${GREEN}✅ 环境变量检查通过${NC}"
}

# 构建镜像
build_images() {
    echo ""
    echo "🔨 构建 Docker 镜像..."

    # 构建 API 镜像
    echo "  构建 API 镜像..."
    docker build -t hoot-api:latest ./apps/api

    # 构建 Web 镜像
    echo "  构建 Web 镜像..."
    docker build -t hoot-web:latest ./apps/web \
        --build-arg NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL:-http://localhost:4001}

    echo -e "${GREEN}✅ 镜像构建完成${NC}"
}

# 停止旧服务
stop_services() {
    echo ""
    echo "🛑 停止旧服务..."
    docker compose -f docker-compose.prod.yml down 2>/dev/null || true
    echo -e "${GREEN}✅ 旧服务已停止${NC}"
}

# 启动服务
start_services() {
    echo ""
    echo "🚀 启动服务..."
    docker compose -f docker-compose.prod.yml up -d
    echo -e "${GREEN}✅ 服务已启动${NC}"
}

# 运行数据库迁移
run_migrations() {
    echo ""
    echo "📦 运行数据库迁移..."
    docker compose -f docker-compose.prod.yml exec -T api npx prisma migrate deploy
    echo -e "${GREEN}✅ 数据库迁移完成${NC}"
}

# 健康检查
health_check() {
    echo ""
    echo "🏥 健康检查..."

    max_retries=30
    retry_count=0

    while [ $retry_count -lt $max_retries ]; do
        api_status=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:4001/api/health/liveness 2>/dev/null || echo "000")

        if [ "$api_status" = "200" ]; then
            echo -e "${GREEN}✅ API 服务正常${NC}"
            break
        fi

        retry_count=$((retry_count + 1))
        echo "  等待 API 启动... ($retry_count/$max_retries)"
        sleep 2
    done

    if [ $retry_count -eq $max_retries ]; then
        echo -e "${RED}❌ API 服务启动超时${NC}"
        echo "请检查日志: docker logs hoot-api"
        exit 1
    fi

    # 检查 Web 服务
    web_status=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/health 2>/dev/null || echo "000")
    if [ "$web_status" = "200" ]; then
        echo -e "${GREEN}✅ Web 服务正常${NC}"
    else
        echo -e "${YELLOW}⚠️ Web 服务可能还在启动中${NC}"
    fi
}

# 显示服务状态
show_status() {
    echo ""
    echo "📊 服务状态:"
    echo "===================="
    docker compose -f docker-compose.prod.yml ps
    echo ""
    echo "🔗 访问地址:"
    echo "  - Web: http://localhost:3001"
    echo "  - API: http://localhost:4001/api"
    echo "  - 健康检查: http://localhost:4001/api/health"
    echo ""
    echo "📝 查看日志:"
    echo "  - API: docker logs -f hoot-api"
    echo "  - Web: docker logs -f hoot-web"
    echo "  - Bot: docker logs -f hoot-telegram-bot"
}

# 配置定时任务
setup_cron() {
    echo ""
    echo "⏰ 配置定时任务..."

    # 获取脚本目录
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

    # 创建定时任务配置
    CRON_FILE="/tmp/hoot_cron"

    cat > "$CRON_FILE" << EOF
# HOOT 定时任务
# 每日 3:00 备份数据库
0 3 * * * cd $PROJECT_DIR && ./scripts/backup.sh --upload-s3 >> /var/log/hoot/backup.log 2>&1

# 每 5 分钟监控检查
*/5 * * * * cd $PROJECT_DIR && ./scripts/monitor.sh --alert >> /var/log/hoot/monitor.log 2>&1

# 每周日 4:00 清理 30 天前的日志
0 4 * * 0 find /var/log/hoot -name "*.log" -mtime +30 -delete 2>/dev/null
EOF

    # 确保日志目录存在
    sudo mkdir -p /var/log/hoot
    sudo chown $(whoami):$(whoami) /var/log/hoot

    # 安装定时任务
    crontab "$CRON_FILE"
    rm "$CRON_FILE"

    echo -e "${GREEN}✅ 定时任务配置完成${NC}"
    echo ""
    echo "当前定时任务:"
    crontab -l | grep -v "^#" | grep -v "^$"
}

# 执行备份
run_backup() {
    echo ""
    echo "💾 执行数据库备份..."

    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

    if [ -f "$SCRIPT_DIR/backup.sh" ]; then
        "$SCRIPT_DIR/backup.sh" "$@"
    else
        echo -e "${RED}❌ 备份脚本不存在: $SCRIPT_DIR/backup.sh${NC}"
        exit 1
    fi
}

# 执行监控检查
run_monitor() {
    echo ""
    echo "🔍 执行健康检查..."

    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

    if [ -f "$SCRIPT_DIR/monitor.sh" ]; then
        "$SCRIPT_DIR/monitor.sh" "$@"
    else
        echo -e "${RED}❌ 监控脚本不存在: $SCRIPT_DIR/monitor.sh${NC}"
        exit 1
    fi
}

# 主流程
main() {
    case "${1:-deploy}" in
        deploy)
            check_env
            build_images
            stop_services
            start_services
            sleep 5
            run_migrations
            health_check
            show_status
            echo ""
            echo -e "${YELLOW}💡 提示: 运行 '$0 setup-cron' 配置自动备份和监控${NC}"
            ;;
        build)
            build_images
            ;;
        start)
            start_services
            health_check
            show_status
            ;;
        stop)
            stop_services
            ;;
        status)
            show_status
            ;;
        logs)
            docker compose -f docker-compose.prod.yml logs -f "${@:2}"
            ;;
        setup-cron)
            setup_cron
            ;;
        backup)
            run_backup "${@:2}"
            ;;
        monitor)
            run_monitor "${@:2}"
            ;;
        *)
            echo "用法: $0 {deploy|build|start|stop|status|logs|setup-cron|backup|monitor}"
            echo ""
            echo "命令说明:"
            echo "  deploy     - 完整部署 (构建+启动+迁移+检查)"
            echo "  build      - 仅构建镜像"
            echo "  start      - 启动服务"
            echo "  stop       - 停止服务"
            echo "  status     - 查看状态"
            echo "  logs       - 查看日志 (可指定服务: logs api)"
            echo "  setup-cron - 配置定时备份和监控"
            echo "  backup     - 手动执行备份 (--upload-s3 上传到 S3)"
            echo "  monitor    - 手动执行健康检查 (--alert 发送告警)"
            exit 1
            ;;
    esac
}

main "$@"
