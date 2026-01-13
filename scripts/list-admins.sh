#!/bin/bash

# QuantFi 管理员列表查询脚本

echo "=================================="
echo "  QuantFi 管理员列表"
echo "=================================="
echo ""

# 检查必要的环境变量
if [ -z "$DATABASE_URL" ]; then
    DB_HOST="${DB_HOST:-localhost}"
    DB_PORT="${DB_PORT:-5433}"
    DB_USER="${DB_USER:-quantfi}"
    DB_NAME="${DB_NAME:-quantfi}"
    DB_PASSWORD="${DB_PASSWORD:-quantfi}"
    export PGPASSWORD="$DB_PASSWORD"
    PSQL_CMD="psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME"
else
    PSQL_CMD="psql $DATABASE_URL"
fi

echo "当前管理员账号:"
echo ""

$PSQL_CMD -c "
SELECT
    email,
    role,
    status,
    created_at::date as 注册日期,
    last_login_at::date as 最后登录
FROM users
WHERE role IN ('admin', 'super_admin')
ORDER BY role DESC, created_at ASC;
" 2>/dev/null

echo ""
echo "角色统计:"
$PSQL_CMD -c "
SELECT
    role as 角色,
    COUNT(*) as 数量
FROM users
WHERE role IN ('admin', 'super_admin')
GROUP BY role;
" 2>/dev/null
