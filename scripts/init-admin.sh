#!/bin/bash

# QuantFi 管理员初始化脚本
# 用于生产环境首次部署时创建超级管理员

set -e

echo "=================================="
echo "  QuantFi 管理员初始化工具"
echo "=================================="
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查必要的环境变量
if [ -z "$DATABASE_URL" ]; then
    echo -e "${YELLOW}提示: DATABASE_URL 未设置，使用默认本地配置${NC}"
    DB_HOST="${DB_HOST:-localhost}"
    DB_PORT="${DB_PORT:-5433}"
    DB_USER="${DB_USER:-quantfi}"
    DB_NAME="${DB_NAME:-quantfi}"
    DB_PASSWORD="${DB_PASSWORD:-quantfi}"
else
    echo -e "${GREEN}使用 DATABASE_URL 连接数据库${NC}"
fi

# 获取管理员邮箱
if [ -z "$1" ]; then
    echo -n "请输入要设为超级管理员的邮箱: "
    read ADMIN_EMAIL
else
    ADMIN_EMAIL="$1"
fi

if [ -z "$ADMIN_EMAIL" ]; then
    echo -e "${RED}错误: 邮箱不能为空${NC}"
    exit 1
fi

echo ""
echo "即将执行以下操作:"
echo "  - 将用户 $ADMIN_EMAIL 设置为超级管理员 (super_admin)"
echo ""
echo -n "确认执行? (y/N): "
read CONFIRM

if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
    echo "已取消"
    exit 0
fi

echo ""
echo "正在连接数据库..."

# 构建 psql 命令
if [ -n "$DATABASE_URL" ]; then
    PSQL_CMD="psql $DATABASE_URL"
else
    export PGPASSWORD="$DB_PASSWORD"
    PSQL_CMD="psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME"
fi

# 检查用户是否存在
USER_EXISTS=$($PSQL_CMD -t -c "SELECT COUNT(*) FROM users WHERE email = '$ADMIN_EMAIL';" 2>/dev/null | tr -d ' ')

if [ "$USER_EXISTS" = "0" ]; then
    echo -e "${RED}错误: 用户 $ADMIN_EMAIL 不存在${NC}"
    echo ""
    echo "请先通过网站注册该账号，然后再运行此脚本"
    exit 1
fi

# 获取当前角色
CURRENT_ROLE=$($PSQL_CMD -t -c "SELECT role FROM users WHERE email = '$ADMIN_EMAIL';" 2>/dev/null | tr -d ' ')

echo "当前角色: $CURRENT_ROLE"

if [ "$CURRENT_ROLE" = "super_admin" ]; then
    echo -e "${YELLOW}该用户已经是超级管理员${NC}"
    exit 0
fi

# 更新角色
$PSQL_CMD -c "UPDATE users SET role = 'super_admin' WHERE email = '$ADMIN_EMAIL';" 2>/dev/null

# 验证更新
NEW_ROLE=$($PSQL_CMD -t -c "SELECT role FROM users WHERE email = '$ADMIN_EMAIL';" 2>/dev/null | tr -d ' ')

if [ "$NEW_ROLE" = "super_admin" ]; then
    echo ""
    echo -e "${GREEN}✓ 成功! 用户 $ADMIN_EMAIL 已设置为超级管理员${NC}"
    echo ""
    echo "现在可以访问管理后台:"
    echo "  本地: http://localhost:3001/admin"
    echo "  生产: https://你的域名/admin"
else
    echo -e "${RED}错误: 更新失败${NC}"
    exit 1
fi
