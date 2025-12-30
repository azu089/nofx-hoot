#!/bin/bash
# QuantFi 数据库恢复脚本
# 用途：从备份文件恢复 PostgreSQL 数据库
#
# 使用方式：
# ./scripts/运维/数据库恢复.sh <备份文件路径>
#
# 示例：
# ./scripts/运维/数据库恢复.sh /opt/quantfi/backups/quantfi_20251226_030000.sql.gz

set -e

# ==================== 配置 ====================

# 数据库配置
DB_HOST="${DATABASE_HOST:-localhost}"
DB_PORT="${DATABASE_PORT:-5433}"
DB_USER="${DATABASE_USER:-quantfi}"
DB_NAME="${DATABASE_NAME:-quantfi}"

# ==================== 颜色 ====================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# ==================== 函数 ====================

log_info() {
  echo -e "${GREEN}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') $1"
}

log_warn() {
  echo -e "${YELLOW}[WARN]${NC} $(date '+%Y-%m-%d %H:%M:%S') $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') $1"
}

# ==================== 参数检查 ====================

if [ -z "$1" ]; then
  echo "用法: $0 <备份文件路径>"
  echo ""
  echo "示例:"
  echo "  $0 /opt/quantfi/backups/quantfi_20251226_030000.sql.gz"
  echo ""
  echo "从 S3 下载后恢复:"
  echo "  aws s3 cp s3://bucket/backups/database/quantfi_xxx.sql.gz /tmp/"
  echo "  $0 /tmp/quantfi_xxx.sql.gz"
  exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
  log_error "备份文件不存在: $BACKUP_FILE"
  exit 1
fi

# ==================== 主程序 ====================

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║              QuantFi 数据库恢复                               ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

log_warn "即将恢复数据库，这将覆盖现有数据！"
echo ""
echo "备份文件: $BACKUP_FILE"
echo "目标数据库: ${DB_NAME}@${DB_HOST}:${DB_PORT}"
echo ""

read -p "确认继续？[y/N] " confirm
if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
  log_info "操作已取消"
  exit 0
fi

echo ""

# 1. 停止相关服务（可选）
log_info "建议在恢复前停止 API 服务..."

# 2. 执行恢复
log_info "开始恢复数据库..."

# 检测文件是否压缩
if [[ "$BACKUP_FILE" == *.gz ]]; then
  log_info "检测到压缩文件，解压后恢复..."

  if command -v docker &> /dev/null; then
    if docker ps --format '{{.Names}}' | grep -q "quantfi-postgres-prod"; then
      log_info "使用 Docker 容器执行恢复 (quantfi-postgres-prod)..."
      gunzip -c "$BACKUP_FILE" | docker exec -i quantfi-postgres-prod psql -U "$DB_USER" -d "$DB_NAME"
    elif docker ps --format '{{.Names}}' | grep -q "quantfi-postgres"; then
      log_info "使用 Docker 容器执行恢复 (quantfi-postgres)..."
      gunzip -c "$BACKUP_FILE" | docker exec -i quantfi-postgres psql -U "$DB_USER" -d "$DB_NAME"
    else
      log_info "使用 psql 直接连接..."
      gunzip -c "$BACKUP_FILE" | PGPASSWORD="${DATABASE_PASSWORD}" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME"
    fi
  else
    log_info "使用 psql 直接连接..."
    gunzip -c "$BACKUP_FILE" | PGPASSWORD="${DATABASE_PASSWORD}" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME"
  fi
else
  log_info "恢复未压缩的备份文件..."

  if command -v docker &> /dev/null; then
    if docker ps --format '{{.Names}}' | grep -q "quantfi-postgres-prod"; then
      docker exec -i quantfi-postgres-prod psql -U "$DB_USER" -d "$DB_NAME" < "$BACKUP_FILE"
    elif docker ps --format '{{.Names}}' | grep -q "quantfi-postgres"; then
      docker exec -i quantfi-postgres psql -U "$DB_USER" -d "$DB_NAME" < "$BACKUP_FILE"
    else
      PGPASSWORD="${DATABASE_PASSWORD}" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" < "$BACKUP_FILE"
    fi
  else
    PGPASSWORD="${DATABASE_PASSWORD}" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" < "$BACKUP_FILE"
  fi
fi

# 3. 验证恢复
log_info "验证恢复结果..."

if command -v docker &> /dev/null; then
  if docker ps --format '{{.Names}}' | grep -q "quantfi-postgres"; then
    TABLE_COUNT=$(docker exec quantfi-postgres psql -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'" 2>/dev/null | tr -d ' ')
  else
    TABLE_COUNT=$(PGPASSWORD="${DATABASE_PASSWORD}" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'" 2>/dev/null | tr -d ' ')
  fi
else
  TABLE_COUNT=$(PGPASSWORD="${DATABASE_PASSWORD}" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'" 2>/dev/null | tr -d ' ')
fi

echo ""
log_info "恢复完成！"
echo ""
echo "数据库表数量: $TABLE_COUNT"
echo ""
log_warn "请重启 API 服务并验证功能正常"
