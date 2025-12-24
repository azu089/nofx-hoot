#!/bin/bash
# Hook: 自动格式化代码
# 触发时机: PostToolUse (Edit|Write)
# 功能: 自动运行 prettier 格式化 TypeScript 文件

input=$(cat)
file_path=$(echo "$input" | jq -r '.tool_input.file_path // empty')

if [[ -z "$file_path" ]]; then
  exit 0
fi

# 只处理 TypeScript 文件
if [[ "$file_path" == *.ts || "$file_path" == *.tsx ]]; then
  # 检查 prettier 是否可用
  if command -v npx &> /dev/null; then
    npx prettier --write "$file_path" 2>/dev/null || true
  fi
fi

exit 0
