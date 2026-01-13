#!/bin/bash
# ==========================================
# QuantFi 部署前检查脚本
# ==========================================
# 运行方式: ./scripts/pre-deploy-check.sh [production|staging]
# ==========================================

set -e

ENV=${1:-production}
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=========================================="
echo "QuantFi 部署前检查 - 环境: $ENV"
echo "检查时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo "=========================================="
echo ""

ERRORS=0
WARNINGS=0

# 检查函数
check_pass() {
  echo -e "${GREEN}✅ $1${NC}"
}

check_fail() {
  echo -e "${RED}❌ $1${NC}"
  ((ERRORS++))
}

check_warn() {
  echo -e "${YELLOW}⚠️  $1${NC}"
  ((WARNINGS++))
}

# ============ 1. 环境变量检查 ============
echo "📋 1. 检查环境变量配置..."

ENV_FILE=".env.production"
if [ "$ENV" = "staging" ]; then
  ENV_FILE=".env.staging"
fi

if [ -f "$ENV_FILE" ]; then
  check_pass "环境文件 $ENV_FILE 存在"

  # 检查必需变量
  REQUIRED_VARS="DATABASE_URL JWT_SECRET ENCRYPTION_KEY CORS_ORIGIN"
  for var in $REQUIRED_VARS; do
    if grep -q "^${var}=" "$ENV_FILE" && ! grep -q "^${var}=YOUR_" "$ENV_FILE"; then
      check_pass "$var 已配置"
    else
      check_fail "$var 未配置或使用占位符"
    fi
  done

  # 检查 JWT_SECRET 长度
  JWT_SECRET=$(grep "^JWT_SECRET=" "$ENV_FILE" | cut -d'=' -f2)
  if [ ${#JWT_SECRET} -ge 32 ]; then
    check_pass "JWT_SECRET 长度足够 (${#JWT_SECRET} 字符)"
  else
    check_fail "JWT_SECRET 长度不足 (需要 >= 32 字符)"
  fi
else
  check_fail "环境文件 $ENV_FILE 不存在"
fi

echo ""

# ============ 2. 代码检查 ============
echo "📋 2. 检查代码质量..."

# TypeScript 类型检查
if pnpm tsc --noEmit --project apps/api/tsconfig.json 2>/dev/null; then
  check_pass "后端 TypeScript 类型检查通过"
else
  check_fail "后端 TypeScript 类型检查失败"
fi

if pnpm tsc --noEmit --project apps/web/tsconfig.json 2>/dev/null; then
  check_pass "前端 TypeScript 类型检查通过"
else
  check_fail "前端 TypeScript 类型检查失败"
fi

echo ""

# ============ 3. 构建检查 ============
echo "📋 3. 检查构建..."

if [ -d "apps/api/dist" ]; then
  check_pass "后端已构建 (apps/api/dist)"
else
  check_warn "后端未构建，请先运行 pnpm build"
fi

if [ -d "apps/web/.next" ]; then
  check_pass "前端已构建 (apps/web/.next)"
else
  check_warn "前端未构建，请先运行 pnpm build"
fi

echo ""

# ============ 4. Docker 检查 ============
echo "📋 4. 检查 Docker 配置..."

if [ -f "docker-compose.prod.yml" ]; then
  check_pass "docker-compose.prod.yml 存在"

  # 验证 Docker Compose 配置
  if docker compose -f docker-compose.prod.yml config >/dev/null 2>&1; then
    check_pass "Docker Compose 配置有效"
  else
    check_fail "Docker Compose 配置无效"
  fi
else
  check_fail "docker-compose.prod.yml 不存在"
fi

if [ -f "apps/api/Dockerfile" ]; then
  check_pass "后端 Dockerfile 存在"
else
  check_fail "后端 Dockerfile 不存在"
fi

if [ -f "apps/web/Dockerfile" ]; then
  check_pass "前端 Dockerfile 存在"
else
  check_fail "前端 Dockerfile 不存在"
fi

echo ""

# ============ 5. 数据库迁移检查 ============
echo "📋 5. 检查数据库迁移..."

if [ -d "apps/api/prisma/migrations" ]; then
  MIGRATION_COUNT=$(ls -1 apps/api/prisma/migrations 2>/dev/null | wc -l | tr -d ' ')
  check_pass "发现 $MIGRATION_COUNT 个迁移文件"
else
  check_warn "没有发现迁移目录"
fi

echo ""

# ============ 6. SSL 证书检查 ============
echo "📋 6. 检查 SSL 配置..."

if [ -d "nginx/ssl" ]; then
  if [ -f "nginx/ssl/quantfi.io.crt" ] && [ -f "nginx/ssl/quantfi.io.key" ]; then
    check_pass "SSL 证书文件存在"
  else
    check_warn "SSL 证书文件缺失，需要配置 Let's Encrypt"
  fi
else
  check_warn "nginx/ssl 目录不存在，需要配置 SSL"
fi

echo ""

# ============ 7. 安全检查 ============
echo "📋 7. 安全检查..."

# 检查是否有硬编码密钥
if grep -r "password123\|secret123\|dev_password" apps/api/src apps/web/src 2>/dev/null | grep -v ".example" | grep -v "test" | grep -v "spec"; then
  check_warn "发现可能的硬编码密码"
else
  check_pass "未发现硬编码密码"
fi

# 检查 .env 是否在 .gitignore 中
if grep -q "\.env$\|\.env\." .gitignore 2>/dev/null; then
  check_pass ".env 文件已在 .gitignore 中"
else
  check_fail ".env 文件未在 .gitignore 中"
fi

echo ""

# ============ 结果汇总 ============
echo "=========================================="
echo "检查结果汇总"
echo "=========================================="

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
  echo -e "${GREEN}✅ 所有检查通过！可以部署。${NC}"
  exit 0
elif [ $ERRORS -eq 0 ]; then
  echo -e "${YELLOW}⚠️  有 $WARNINGS 个警告，建议处理后再部署。${NC}"
  exit 0
else
  echo -e "${RED}❌ 有 $ERRORS 个错误，$WARNINGS 个警告。${NC}"
  echo -e "${RED}   请修复所有错误后再部署！${NC}"
  exit 1
fi
