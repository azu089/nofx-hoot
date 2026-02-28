#!/bin/bash
# HOOT 生产部署脚本（含回滚机制）

set -e

echo "🚀 HOOT 生产部署脚本"
echo "===================="

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 项目根目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="$PROJECT_DIR/docker-compose.prod.yml"
BACKUP_DIR="$PROJECT_DIR/.deploy-backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# 检查必要的环境变量
check_env() {
    echo "📋 检查环境变量..."

    required_vars=("DB_PASSWORD" "JWT_SECRET" "ENCRYPTION_KEY" "WEBHOOK_SECRET" "REDIS_PASSWORD" "FT_API_PASSWORD" "FT_JWT_SECRET" "FT_JWT_SECRET_OWL")
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

# 部署前备份（记录当前镜像 ID，用于回滚）
pre_deploy_backup() {
    echo ""
    echo "💾 记录当前部署状态..."

    mkdir -p "$BACKUP_DIR"
    local backup_file="$BACKUP_DIR/deploy_$TIMESTAMP.json"

    # 记录当前容器镜像信息
    echo "{" > "$backup_file"
    echo "  \"timestamp\": \"$TIMESTAMP\"," >> "$backup_file"
    echo "  \"images\": {" >> "$backup_file"

    local first=true
    for service in api web admin telegram-bot admin-bot; do
        local container="hoot-${service}"
        local image_id=$(docker inspect --format='{{.Image}}' "$container" 2>/dev/null || echo "none")
        if [ "$first" = true ]; then
            first=false
        else
            echo "," >> "$backup_file"
        fi
        printf "    \"%s\": \"%s\"" "$service" "$image_id" >> "$backup_file"
    done

    echo "" >> "$backup_file"
    echo "  }" >> "$backup_file"
    echo "}" >> "$backup_file"

    # 备份数据库
    echo "  备份数据库..."
    docker compose -f "$COMPOSE_FILE" exec -T postgres pg_dump -U hoot hoot | gzip > "$BACKUP_DIR/db_$TIMESTAMP.sql.gz" 2>/dev/null || echo "  ⚠️ 数据库备份跳过（首次部署或数据库未运行）"

    # 只保留最近 5 次备份
    ls -t "$BACKUP_DIR"/deploy_*.json 2>/dev/null | tail -n +6 | xargs rm -f 2>/dev/null
    ls -t "$BACKUP_DIR"/db_*.sql.gz 2>/dev/null | tail -n +6 | xargs rm -f 2>/dev/null

    echo -e "${GREEN}✅ 部署备份完成: $backup_file${NC}"
}

# 构建镜像
build_images() {
    echo ""
    echo "🔨 构建 Docker 镜像..."

    echo "  构建 API 镜像..."
    docker build -t hoot-api:latest "$PROJECT_DIR/apps/api"

    echo "  构建 Web 镜像..."
    docker build -t hoot-web:latest "$PROJECT_DIR/apps/web" \
        --build-arg NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL:-https://api.hoot.cool}

    echo "  构建 Admin 镜像..."
    docker build -t hoot-admin:latest "$PROJECT_DIR/apps/admin" \
        --build-arg VITE_API_URL=${VITE_API_URL:-https://api.hoot.cool}

    echo -e "${GREEN}✅ 镜像构建完成${NC}"
}

# 停止旧服务
stop_services() {
    echo ""
    echo "🛑 停止旧服务..."
    docker compose -f "$COMPOSE_FILE" down 2>/dev/null || true
    echo -e "${GREEN}✅ 旧服务已停止${NC}"
}

# 启动服务
start_services() {
    echo ""
    echo "🚀 启动服务..."
    docker compose -f "$COMPOSE_FILE" up -d
    echo -e "${GREEN}✅ 服务已启动${NC}"
}

# 运行数据库迁移（在 API 启动前用一次性容器运行，避免 onModuleInit 查询未迁移的表）
run_migrations() {
    echo ""
    echo "📦 运行数据库迁移（启动前）..."

    # 先启动 postgres + redis，等待它们健康
    docker compose -f "$COMPOSE_FILE" up -d postgres redis
    echo "  等待数据库就绪..."
    for i in $(seq 1 30); do
        if docker compose -f "$COMPOSE_FILE" exec -T postgres pg_isready -U hoot -d hoot > /dev/null 2>&1; then
            echo "  数据库就绪"
            break
        fi
        sleep 2
    done

    # 用一次性容器运行迁移（不依赖 API 容器健康状态）
    DB_URL="postgresql://hoot:${DB_PASSWORD}@postgres:5432/hoot"
    if ! docker run --rm \
        --network hoot_hoot-network \
        -e DATABASE_URL="$DB_URL" \
        hoot-api:latest \
        npx prisma migrate deploy; then
        echo -e "${RED}❌ 数据库迁移失败！自动回滚中...${NC}"
        rollback_deployment
        exit 1
    fi

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
        echo -e "${RED}❌ API 服务启动超时，自动回滚中...${NC}"
        rollback_deployment
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

# 回滚部署
rollback_deployment() {
    echo ""
    echo -e "${YELLOW}🔄 执行回滚...${NC}"

    # 找到最近的数据库备份
    local latest_db=$(ls -t "$BACKUP_DIR"/db_*.sql.gz 2>/dev/null | head -1)

    if [ -n "$latest_db" ]; then
        echo "  恢复数据库备份: $latest_db"
        # 先确保数据库在运行
        docker compose -f "$COMPOSE_FILE" up -d postgres redis
        sleep 5
        gunzip -c "$latest_db" | docker compose -f "$COMPOSE_FILE" exec -T postgres psql -U hoot -d hoot 2>/dev/null || echo "  ⚠️ 数据库恢复失败，请手动检查"
    fi

    # 重启服务
    echo "  重启服务..."
    docker compose -f "$COMPOSE_FILE" up -d

    echo -e "${YELLOW}🔄 回滚完成，请手动验证服务状态${NC}"
    show_status
}

# 显示服务状态
show_status() {
    echo ""
    echo "📊 服务状态:"
    echo "===================="
    docker compose -f "$COMPOSE_FILE" ps
    echo ""
    echo "🔗 访问地址:"
    echo "  - Web: https://hoot.cool"
    echo "  - API: https://api.hoot.cool"
    echo "  - Admin: https://admin.hoot.cool"
    echo "  - 健康检查: https://api.hoot.cool/api/health"
    echo ""
    echo "📝 查看日志:"
    echo "  - API: docker logs -f hoot-api"
    echo "  - Web: docker logs -f hoot-web"
    echo "  - Admin: docker logs -f hoot-admin"
    echo "  - Bot: docker logs -f hoot-telegram-bot"
}

# 配置定时任务
setup_cron() {
    echo ""
    echo "⏰ 配置定时任务..."

    CRON_FILE="/tmp/hoot_cron"

    cat > "$CRON_FILE" << EOF
# HOOT 定时任务
# 每日 3:00 备份数据库
0 3 * * * cd $PROJECT_DIR && ./scripts/deploy.sh backup >> /var/log/hoot/backup.log 2>&1

# 每 5 分钟监控检查
*/5 * * * * cd $PROJECT_DIR && ./scripts/deploy.sh monitor >> /var/log/hoot/monitor.log 2>&1

# 每周日 4:00 清理 30 天前的日志
0 4 * * 0 find /var/log/hoot -name "*.log" -mtime +30 -delete 2>/dev/null
EOF

    sudo mkdir -p /var/log/hoot
    sudo chown $(whoami):$(whoami) /var/log/hoot

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

    mkdir -p "$BACKUP_DIR"
    docker compose -f "$COMPOSE_FILE" exec -T postgres pg_dump -U hoot hoot | gzip > "$BACKUP_DIR/db_manual_$TIMESTAMP.sql.gz"

    echo -e "${GREEN}✅ 备份完成: $BACKUP_DIR/db_manual_$TIMESTAMP.sql.gz${NC}"
}

# 执行监控检查
run_monitor() {
    echo "🔍 [$(date)] 健康检查..."

    api_status=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:4001/api/health/liveness 2>/dev/null || echo "000")
    web_status=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/health 2>/dev/null || echo "000")

    if [ "$api_status" != "200" ]; then
        echo -e "${RED}❌ API 不可用 (HTTP $api_status)${NC}"
        # 尝试自动重启
        docker compose -f "$COMPOSE_FILE" restart api
    fi

    if [ "$web_status" != "200" ]; then
        echo -e "${YELLOW}⚠️ Web 不可用 (HTTP $web_status)${NC}"
    fi

    echo "  API: $api_status, Web: $web_status"
}

# 主流程
main() {
    cd "$PROJECT_DIR"

    case "${1:-deploy}" in
        deploy)
            check_env
            pre_deploy_backup
            build_images
            stop_services
            run_migrations
            start_services
            health_check
            show_status
            echo ""
            echo -e "${GREEN}🎉 部署完成！${NC}"
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
        restart)
            stop_services
            start_services
            health_check
            show_status
            ;;
        rollback)
            rollback_deployment
            ;;
        status)
            show_status
            ;;
        logs)
            docker compose -f "$COMPOSE_FILE" logs -f "${@:2}"
            ;;
        setup-cron)
            setup_cron
            ;;
        backup)
            run_backup
            ;;
        monitor)
            run_monitor
            ;;
        *)
            echo "用法: $0 {deploy|build|start|stop|restart|rollback|status|logs|setup-cron|backup|monitor}"
            echo ""
            echo "命令说明:"
            echo "  deploy     - 完整部署 (备份+构建+启动+迁移+检查)"
            echo "  build      - 仅构建镜像"
            echo "  start      - 启动服务"
            echo "  stop       - 停止服务"
            echo "  restart    - 重启服务"
            echo "  rollback   - 回滚到上一版本"
            echo "  status     - 查看状态"
            echo "  logs       - 查看日志 (可指定服务: logs api)"
            echo "  setup-cron - 配置定时备份和监控"
            echo "  backup     - 手动执行备份"
            echo "  monitor    - 手动执行健康检查"
            exit 1
            ;;
    esac
}

main "$@"
