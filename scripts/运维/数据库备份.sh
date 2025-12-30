#!/bin/bash
# QuantFi 数据库备份脚本
# 用途：定时备份 PostgreSQL 数据库到本地和 S3
#
# 使用方式：
# 1. 手动执行：./scripts/运维/数据库备份.sh
# 2. 定时任务：0 3 * * * /opt/quantfi/scripts/运维/数据库备份.sh
#
# 环境变量：
# - DATABASE_HOST: 数据库主机
# - DATABASE_USER: 数据库用户
# - DATABASE_NAME: 数据库名
# - DATABASE_PASSWORD: 数据库密码
# - BACKUP_DIR: 备份目录
# - S3_BUCKET: S3 存储桶
# - BACKUP_RETENTION_DAYS: 本地备份保留天数

set -e

# ==================== 配置 ====================

# 数据库配置
DB_HOST="${DATABASE_HOST:-localhost}"
DB_PORT="${DATABASE_PORT:-5433}"
DB_USER="${DATABASE_USER:-quantfi}"
DB_NAME="${DATABASE_NAME:-quantfi}"

# 备份配置
BACKUP_DIR="${BACKUP_DIR:-/opt/quantfi/backups}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"

# S3 配置
S3_BUCKET="${S3_BUCKET:-}"
S3_PREFIX="${S3_PREFIX:-backups/database}"

# 时间戳
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="quantfi_${TIMESTAMP}.sql.gz"

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

cleanup_old_backups() {
  log_info "清理 ${BACKUP_RETENTION_DAYS} 天前的本地备份..."

  find "$BACKUP_DIR" -name "quantfi_*.sql.gz" -type f -mtime +${BACKUP_RETENTION_DAYS} -delete 2>/dev/null || true

  local count
  count=$(find "$BACKUP_DIR" -name "quantfi_*.sql.gz" -type f | wc -l)
  log_info "当前本地备份文件数: $count"
}

upload_to_s3() {
  local file="$1"

  if [ -z "$S3_BUCKET" ]; then
    log_warn "未配置 S3_BUCKET，跳过 S3 上传"
    return 0
  fi

  if ! command -v aws &> /dev/null; then
    log_warn "AWS CLI 未安装，跳过 S3 上传"
    return 0
  fi

  log_info "上传到 S3: s3://${S3_BUCKET}/${S3_PREFIX}/${BACKUP_FILE}"

  if aws s3 cp "$file" "s3://${S3_BUCKET}/${S3_PREFIX}/${BACKUP_FILE}"; then
    log_info "S3 上传成功"
    return 0
  else
    log_error "S3 上传失败"
    return 1
  fi
}

# ==================== 主程序 ====================

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║              QuantFi 数据库备份                               ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# 创建备份目录
mkdir -p "$BACKUP_DIR"

# 1. 执行数据库备份
log_info "开始备份数据库: ${DB_NAME}@${DB_HOST}:${DB_PORT}"

BACKUP_PATH="${BACKUP_DIR}/${BACKUP_FILE}"

# 使用 Docker 执行备份
if command -v docker &> /dev/null; then
  # 尝试生产环境容器
  if docker ps --format '{{.Names}}' | grep -q "quantfi-postgres-prod"; then
    log_info "使用 Docker 容器执行备份 (quantfi-postgres-prod)..."
    docker exec quantfi-postgres-prod pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_PATH"
  elif docker ps --format '{{.Names}}' | grep -q "quantfi-postgres"; then
    log_info "使用 Docker 容器执行备份 (quantfi-postgres)..."
    docker exec quantfi-postgres pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_PATH"
  else
    # 使用 pg_dump 直接连接
    log_info "使用 pg_dump 直接连接..."
    PGPASSWORD="${DATABASE_PASSWORD}" pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_PATH"
  fi
else
  # 使用 pg_dump 直接连接
  log_info "使用 pg_dump 直接连接..."
  PGPASSWORD="${DATABASE_PASSWORD}" pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_PATH"
fi

# 验证备份文件
if [ -f "$BACKUP_PATH" ] && [ -s "$BACKUP_PATH" ]; then
  BACKUP_SIZE=$(du -h "$BACKUP_PATH" | cut -f1)
  log_info "备份成功: $BACKUP_PATH ($BACKUP_SIZE)"
else
  log_error "备份失败: 文件为空或不存在"
  exit 1
fi

# 2. 上传到 S3
upload_to_s3 "$BACKUP_PATH"

# 3. 清理旧备份
cleanup_old_backups

# 4. 完成
echo ""
log_info "备份完成！"
echo ""
echo "备份文件: $BACKUP_PATH"
echo "文件大小: $BACKUP_SIZE"
echo ""
