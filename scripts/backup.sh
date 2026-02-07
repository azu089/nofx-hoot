#!/bin/bash
# HOOT 数据库备份脚本
# 支持本地备份和 S3 上传
# 用法: ./backup.sh [--upload-s3]

set -e

# ==================== 配置 ====================
BACKUP_DIR="${BACKUP_DIR:-/var/backups/hoot}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="hoot_db_${TIMESTAMP}.sql.gz"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

# 数据库配置
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5433}"
DB_NAME="${DB_NAME:-quantfi}"
DB_USER="${DB_USER:-quantfi}"

# Docker 容器名称（支持多种命名）
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-quantfi-postgres}"

# S3 配置（可选）
S3_BUCKET="${S3_BUCKET:-}"
S3_REGION="${S3_REGION:-ap-southeast-1}"

# Telegram 通知配置（可选）
TG_BOT_API="${TG_BOT_API:-}"
ADMIN_TG_ID="${ADMIN_TG_ID:-}"

# ==================== 函数 ====================

# 发送 Telegram 通知
send_notification() {
  local message="$1"

  if [ -n "$TG_BOT_API" ] && [ -n "$ADMIN_TG_ID" ]; then
    curl -s -X POST "$TG_BOT_API/send-message" \
      -H "Content-Type: application/json" \
      -d "{\"telegramId\":\"$ADMIN_TG_ID\",\"message\":\"$message\"}" \
      > /dev/null 2>&1 || true
  fi

  echo "$message"
}

# 检查依赖
check_dependencies() {
  # 检查 gzip
  if ! command -v gzip &> /dev/null; then
    echo "错误: gzip 未安装"
    exit 1
  fi

  # 检查 pg_dump（本地或 Docker 容器中）
  if ! command -v pg_dump &> /dev/null; then
    # 检查 Docker 容器是否可用
    if ! docker ps --format '{{.Names}}' 2>/dev/null | grep -qE "postgres|db"; then
      echo "错误: pg_dump 未安装，且未检测到 PostgreSQL Docker 容器"
      exit 1
    fi
    echo "注意: 本地未安装 pg_dump，将使用 Docker 容器内的 pg_dump"
  fi
}

# 创建备份目录
create_backup_dir() {
  if [ ! -d "$BACKUP_DIR" ]; then
    mkdir -p "$BACKUP_DIR"
    echo "创建备份目录: $BACKUP_DIR"
  fi
}

# 执行数据库备份
do_backup() {
  echo "开始备份数据库..."
  echo "  主机: $DB_HOST:$DB_PORT"
  echo "  数据库: $DB_NAME"
  echo "  输出文件: $BACKUP_DIR/$BACKUP_FILE"

  # 使用 Docker 执行 pg_dump（如果数据库在 Docker 中）
  if docker ps --format '{{.Names}}' 2>/dev/null | grep -qE "$POSTGRES_CONTAINER|hoot-postgres|quantfi-postgres"; then
    # 检测实际运行的容器名
    ACTUAL_CONTAINER=$(docker ps --format '{{.Names}}' | grep -E "$POSTGRES_CONTAINER|hoot-postgres|quantfi-postgres" | head -1)
    echo "检测到 Docker 环境，使用容器 $ACTUAL_CONTAINER 内的 pg_dump..."
    docker exec "$ACTUAL_CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" | gzip > "$BACKUP_DIR/$BACKUP_FILE"
  else
    # 直接使用 pg_dump
    PGPASSWORD="$DB_PASSWORD" pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" | gzip > "$BACKUP_DIR/$BACKUP_FILE"
  fi

  # 检查备份文件
  if [ -f "$BACKUP_DIR/$BACKUP_FILE" ]; then
    local file_size=$(du -h "$BACKUP_DIR/$BACKUP_FILE" | cut -f1)
    echo "备份成功: $BACKUP_FILE ($file_size)"
    return 0
  else
    echo "备份失败: 文件未创建"
    return 1
  fi
}

# 上传到 S3
upload_to_s3() {
  if [ -z "$S3_BUCKET" ]; then
    echo "S3 未配置，跳过上传"
    return 0
  fi

  if ! command -v aws &> /dev/null; then
    echo "警告: AWS CLI 未安装，跳过 S3 上传"
    return 0
  fi

  echo "上传到 S3: s3://$S3_BUCKET/database/$BACKUP_FILE"

  aws s3 cp "$BACKUP_DIR/$BACKUP_FILE" "s3://$S3_BUCKET/database/$BACKUP_FILE" \
    --region "$S3_REGION" \
    --storage-class STANDARD_IA

  if [ $? -eq 0 ]; then
    echo "S3 上传成功"
    return 0
  else
    echo "S3 上传失败"
    return 1
  fi
}

# 清理旧备份
cleanup_old_backups() {
  echo "清理 ${RETENTION_DAYS} 天前的备份..."

  # 清理本地
  local deleted_count=$(find "$BACKUP_DIR" -name "hoot_db_*.sql.gz" -mtime "+$RETENTION_DAYS" -delete -print | wc -l)
  echo "已删除 $deleted_count 个本地旧备份"

  # 清理 S3（如果配置）
  if [ -n "$S3_BUCKET" ] && command -v aws &> /dev/null; then
    echo "清理 S3 旧备份..."
    # 列出并删除超过保留天数的文件
    local cutoff_date=$(date -v-${RETENTION_DAYS}d +%Y-%m-%d 2>/dev/null || date -d "-$RETENTION_DAYS days" +%Y-%m-%d)

    aws s3 ls "s3://$S3_BUCKET/database/" --region "$S3_REGION" 2>/dev/null | while read -r line; do
      file_date=$(echo "$line" | awk '{print $1}')
      file_name=$(echo "$line" | awk '{print $4}')

      if [[ "$file_date" < "$cutoff_date" ]] && [ -n "$file_name" ]; then
        aws s3 rm "s3://$S3_BUCKET/database/$file_name" --region "$S3_REGION" 2>/dev/null
        echo "  已删除 S3: $file_name"
      fi
    done
  fi
}

# 显示备份统计
show_stats() {
  echo ""
  echo "=== 备份统计 ==="

  # 本地备份
  local local_count=$(find "$BACKUP_DIR" -name "hoot_db_*.sql.gz" 2>/dev/null | wc -l)
  local local_size=$(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1)
  echo "本地备份: $local_count 个文件, 共 $local_size"

  # S3 备份
  if [ -n "$S3_BUCKET" ] && command -v aws &> /dev/null; then
    local s3_count=$(aws s3 ls "s3://$S3_BUCKET/database/" --region "$S3_REGION" 2>/dev/null | wc -l)
    echo "S3 备份: $s3_count 个文件"
  fi
}

# ==================== 主程序 ====================

echo "=== HOOT 数据库备份 ==="
echo "时间: $(date)"
echo ""

# 检查参数
UPLOAD_S3=false
if [ "$1" = "--upload-s3" ]; then
  UPLOAD_S3=true
fi

# 执行流程
check_dependencies
create_backup_dir

if do_backup; then
  # 备份成功
  if [ "$UPLOAD_S3" = true ]; then
    upload_to_s3
  fi

  cleanup_old_backups
  show_stats

  send_notification "✅ HOOT 数据库备份成功: $BACKUP_FILE"

  echo ""
  echo "=== 备份完成 ==="
  exit 0
else
  # 备份失败
  send_notification "❌ HOOT 数据库备份失败"

  echo ""
  echo "=== 备份失败 ==="
  exit 1
fi
