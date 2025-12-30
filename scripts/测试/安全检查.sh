#!/bin/bash
# QuantFi 安全检查脚本
# 用途：检查常见安全问题和 OWASP Top 10 漏洞
#
# 使用方式：
# ./scripts/测试/安全检查.sh

set -e

# ==================== 配置 ====================

API_BASE="${API_URL:-http://localhost:4001/api}"
WEB_BASE="${WEB_URL:-http://localhost:3001}"
BASE_DIR="$(cd "$(dirname "$0")/../.." && pwd)"

# ==================== 颜色 ====================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# ==================== 计数 ====================

PASS=0
WARN=0
FAIL=0

# ==================== 函数 ====================

log_pass() {
  echo -e "${GREEN}[PASS]${NC} $1"
  PASS=$((PASS + 1))
}

log_warn() {
  echo -e "${YELLOW}[WARN]${NC} $1"
  WARN=$((WARN + 1))
}

log_fail() {
  echo -e "${RED}[FAIL]${NC} $1"
  FAIL=$((FAIL + 1))
}

# ==================== 主程序 ====================

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║              QuantFi 安全检查                                 ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "检查时间: $(date)"
echo "API 地址: $API_BASE"
echo "Web 地址: $WEB_BASE"
echo ""

# ==================== 1. 敏感文件检查 ====================

echo "═══ 1. 敏感文件检查 ═══"

# 检查 .env 文件是否在 gitignore 中
if grep -q "^\.env" "$BASE_DIR/.gitignore" 2>/dev/null; then
  log_pass ".env 已在 .gitignore 中"
else
  log_fail ".env 未在 .gitignore 中，可能泄露"
fi

# 检查是否有硬编码的密钥
if grep -rE "(password|secret|api_key|token)\s*=\s*['\"][^'\"]+['\"]" "$BASE_DIR/apps" --include="*.ts" --include="*.js" 2>/dev/null | grep -v "example" | grep -v "test" | grep -v ".spec."; then
  log_fail "发现可能的硬编码密钥"
else
  log_pass "未发现硬编码密钥"
fi

# 检查私钥文件
if find "$BASE_DIR" -name "*.pem" -o -name "*.key" 2>/dev/null | grep -v node_modules | head -1 | grep -q .; then
  log_warn "发现私钥文件，请确认是否应该在仓库中"
else
  log_pass "未发现私钥文件"
fi

echo ""

# ==================== 2. HTTP 安全头检查 ====================

echo "═══ 2. HTTP 安全头检查 ═══"

# 检查 X-Frame-Options
if curl -sI "$WEB_BASE" 2>/dev/null | grep -qi "X-Frame-Options"; then
  log_pass "X-Frame-Options 头已设置"
else
  log_warn "缺少 X-Frame-Options 头（防止点击劫持）"
fi

# 检查 X-Content-Type-Options
if curl -sI "$WEB_BASE" 2>/dev/null | grep -qi "X-Content-Type-Options"; then
  log_pass "X-Content-Type-Options 头已设置"
else
  log_warn "缺少 X-Content-Type-Options 头"
fi

# 检查 X-XSS-Protection
if curl -sI "$WEB_BASE" 2>/dev/null | grep -qi "X-XSS-Protection"; then
  log_pass "X-XSS-Protection 头已设置"
else
  log_warn "缺少 X-XSS-Protection 头"
fi

# 检查 Content-Security-Policy
if curl -sI "$WEB_BASE" 2>/dev/null | grep -qi "Content-Security-Policy"; then
  log_pass "Content-Security-Policy 头已设置"
else
  log_warn "缺少 Content-Security-Policy 头"
fi

# 检查 Strict-Transport-Security
if curl -sI "$WEB_BASE" 2>/dev/null | grep -qi "Strict-Transport-Security"; then
  log_pass "Strict-Transport-Security 头已设置"
else
  log_warn "缺少 HSTS 头（生产环境需要）"
fi

echo ""

# ==================== 3. API 安全检查 ====================

echo "═══ 3. API 安全检查 ═══"

# 检查未授权访问
unauthorized=$(curl -s "$API_BASE/wallets/me" 2>/dev/null)
if echo "$unauthorized" | grep -q '"code":41'; then
  log_pass "未授权请求被正确拒绝"
else
  log_fail "未授权请求未被拒绝"
fi

# 检查 SQL 注入（基础）
sql_injection=$(curl -s "$API_BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com OR 1=1","password":"test"}' 2>/dev/null)
if echo "$sql_injection" | grep -qi "error\|syntax\|sql"; then
  log_fail "可能存在 SQL 注入漏洞"
else
  log_pass "SQL 注入测试通过"
fi

# 检查 XSS（基础）
xss_test=$(curl -s "$API_BASE/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"<script>alert(1)</script>@test.com","password":"test123"}' 2>/dev/null)
if echo "$xss_test" | grep -q "<script>"; then
  log_fail "可能存在 XSS 漏洞"
else
  log_pass "XSS 测试通过"
fi

# 检查请求限流
echo -n "检查请求限流..."
rate_limit_triggered=false
for i in {1..50}; do
  result=$(curl -s -o /dev/null -w "%{http_code}" "$API_BASE/health" 2>/dev/null)
  if [ "$result" = "429" ]; then
    rate_limit_triggered=true
    break
  fi
done
if $rate_limit_triggered; then
  log_pass "请求限流已生效"
else
  log_warn "未检测到请求限流（可能配置较高阈值）"
fi

echo ""

# ==================== 4. 密码安全检查 ====================

echo "═══ 4. 密码安全检查 ═══"

# 检查弱密码是否被拒绝
weak_password=$(curl -s "$API_BASE/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"weak@test.com","password":"123"}' 2>/dev/null)
if echo "$weak_password" | grep -qi "password\|密码"; then
  log_pass "弱密码被正确拒绝"
else
  log_warn "可能接受弱密码"
fi

echo ""

# ==================== 5. 依赖漏洞检查 ====================

echo "═══ 5. 依赖漏洞检查 ═══"

# 检查 npm audit
if command -v pnpm &> /dev/null; then
  echo "运行 pnpm audit..."
  cd "$BASE_DIR"
  audit_result=$(pnpm audit --audit-level high 2>&1 || true)
  if echo "$audit_result" | grep -qi "high\|critical"; then
    log_warn "发现高危或严重漏洞依赖"
    echo "$audit_result" | head -20
  else
    log_pass "未发现高危漏洞依赖"
  fi
else
  log_warn "pnpm 未安装，跳过依赖检查"
fi

echo ""

# ==================== 6. 端口暴露检查 ====================

echo "═══ 6. 端口暴露检查 ═══"

# 检查 PostgreSQL 端口
if curl -s --connect-timeout 2 "http://localhost:5433" 2>/dev/null | grep -qi "postgresql\|postgres"; then
  log_fail "PostgreSQL 端口可能对外暴露"
else
  log_pass "PostgreSQL 端口检查通过"
fi

# 检查 Redis 端口
if curl -s --connect-timeout 2 "http://localhost:6379" 2>/dev/null | grep -qi "redis"; then
  log_fail "Redis 端口可能对外暴露"
else
  log_pass "Redis 端口检查通过"
fi

echo ""

# ==================== 7. 敏感信息泄露检查 ====================

echo "═══ 7. 敏感信息泄露检查 ═══"

# 检查错误信息是否泄露敏感信息
error_response=$(curl -s "$API_BASE/nonexistent" 2>/dev/null)
if echo "$error_response" | grep -qi "stack\|trace\|at Object\|node_modules"; then
  log_fail "错误响应可能泄露堆栈信息"
else
  log_pass "错误响应未泄露敏感信息"
fi

# 检查 API 文档是否需要认证
swagger_response=$(curl -s -o /dev/null -w "%{http_code}" "$API_BASE/docs" 2>/dev/null)
if [ "$swagger_response" = "200" ]; then
  log_warn "Swagger 文档公开可访问（生产环境应限制）"
else
  log_pass "Swagger 文档已限制访问"
fi

echo ""

# ==================== 8. CORS 检查 ====================

echo "═══ 8. CORS 检查 ═══"

cors_response=$(curl -sI -X OPTIONS "$API_BASE/health" \
  -H "Origin: https://evil.com" \
  -H "Access-Control-Request-Method: GET" 2>/dev/null)

if echo "$cors_response" | grep -qi "Access-Control-Allow-Origin: \*"; then
  log_warn "CORS 配置为允许所有来源（*）"
elif echo "$cors_response" | grep -qi "Access-Control-Allow-Origin: https://evil.com"; then
  log_fail "CORS 配置过于宽松"
else
  log_pass "CORS 配置正确"
fi

echo ""

# ==================== 结果汇总 ====================

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                      检查结果                                 ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo -e "  ${GREEN}通过: $PASS${NC}"
echo -e "  ${YELLOW}警告: $WARN${NC}"
echo -e "  ${RED}失败: $FAIL${NC}"
echo ""

if [ $FAIL -gt 0 ]; then
  echo -e "  ${RED}⚠️  发现 $FAIL 个安全问题需要修复${NC}"
  exit 1
elif [ $WARN -gt 0 ]; then
  echo -e "  ${YELLOW}⚠️  发现 $WARN 个警告需要关注${NC}"
  exit 0
else
  echo -e "  ${GREEN}🎉 所有安全检查通过！${NC}"
  exit 0
fi
