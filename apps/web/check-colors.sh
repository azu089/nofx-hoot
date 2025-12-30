#!/bin/bash

# QuantFi 前端配色检查脚本
# 用途：检查项目中硬编码的颜色值，帮助迁移到统一配色系统

echo "===== QuantFi 前端配色检查 ====="
echo ""

# 进入项目目录
cd "$(dirname "$0")"

# 检查 HEX 颜色值
echo "🔍 检查硬编码的 HEX 颜色值..."
echo ""
grep -rn --include="*.tsx" --include="*.ts" --exclude-dir=node_modules '#[0-9A-Fa-f]{6}' src/ | \
  grep -v "globals.css" | \
  grep -v "COLOR_" | \
  head -20

echo ""
echo "---"
echo ""

# 检查 bg-gray-xxx
echo "🔍 检查使用了 Tailwind 内置灰色的文件..."
echo ""
grep -rn --include="*.tsx" --include="*.ts" --exclude-dir=node_modules 'bg-gray-' src/ | \
  wc -l | \
  xargs -I {} echo "找到 {} 处使用了 bg-gray-xxx"

echo ""
echo "---"
echo ""

# 检查 text-gray-xxx
echo "🔍 检查使用了 text-gray-xxx 的文件..."
echo ""
grep -rn --include="*.tsx" --include="*.ts" --exclude-dir=node_modules 'text-gray-' src/ | \
  wc -l | \
  xargs -I {} echo "找到 {} 处使用了 text-gray-xxx"

echo ""
echo "---"
echo ""

# 检查 border-gray-xxx
echo "🔍 检查使用了 border-gray-xxx 的文件..."
echo ""
grep -rn --include="*.tsx" --include="*.ts" --exclude-dir=node_modules 'border-gray-' src/ | \
  wc -l | \
  xargs -I {} echo "找到 {} 处使用了 border-gray-xxx"

echo ""
echo "---"
echo ""

# 统计需要迁移的文件数量
echo "📊 需要迁移的文件统计："
echo ""

# bg-gray
BG_GRAY_COUNT=$(grep -rl --include="*.tsx" --include="*.ts" --exclude-dir=node_modules 'bg-gray-' src/ | wc -l | xargs)
echo "  - 使用 bg-gray-xxx: $BG_GRAY_COUNT 个文件"

# text-gray
TEXT_GRAY_COUNT=$(grep -rl --include="*.tsx" --include="*.ts" --exclude-dir=node_modules 'text-gray-' src/ | wc -l | xargs)
echo "  - 使用 text-gray-xxx: $TEXT_GRAY_COUNT 个文件"

# border-gray
BORDER_GRAY_COUNT=$(grep -rl --include="*.tsx" --include="*.ts" --exclude-dir=node_modules 'border-gray-' src/ | wc -l | xargs)
echo "  - 使用 border-gray-xxx: $BORDER_GRAY_COUNT 个文件"

# HEX 颜色
HEX_COUNT=$(grep -rl --include="*.tsx" --include="*.ts" --exclude-dir=node_modules '#[0-9A-Fa-f]{6}' src/ | grep -v "globals.css" | grep -v "COLOR_" | wc -l | xargs)
echo "  - 硬编码 HEX 颜色: $HEX_COUNT 个文件"

echo ""
echo "---"
echo ""

# 给出建议
TOTAL=$((BG_GRAY_COUNT + TEXT_GRAY_COUNT + BORDER_GRAY_COUNT + HEX_COUNT))

if [ "$TOTAL" -eq 0 ]; then
  echo "✅ 恭喜！项目已完全迁移到统一配色系统。"
else
  echo "⚠️  发现 $TOTAL 个文件需要迁移。"
  echo ""
  echo "📖 迁移指南："
  echo "  1. 查看 COLOR_MIGRATION.md 了解迁移规则"
  echo "  2. 查看 COLOR_EXAMPLES.md 参考代码示例"
  echo "  3. 按优先级逐步迁移（P0 > P1 > P2 > P3）"
fi

echo ""
echo "===== 检查完成 ====="
