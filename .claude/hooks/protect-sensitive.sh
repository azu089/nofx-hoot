#!/bin/bash
# Hook: 保护敏感文件
# 触发时机: PreToolUse (Edit|Write)
# 功能: 阻止修改敏感文件

input=$(cat)
file_path=$(echo "$input" | jq -r '.tool_input.file_path // empty')

if [[ -z "$file_path" ]]; then
  exit 0
fi

# 敏感文件模式
sensitive_patterns=(
  ".env"
  ".env.local"
  ".env.production"
  ".env.development"
  "secrets"
  "credentials"
  ".pem"
  ".key"
  "docker-compose.yml"
  "docker-compose.prod.yml"
)

for pattern in "${sensitive_patterns[@]}"; do
  if [[ "$file_path" == *"$pattern"* ]]; then
    echo "BLOCKED: 禁止修改敏感文件: $file_path" >&2
    echo "如需修改，请手动操作或获得 PM 明确批准" >&2
    exit 2  # 返回 2 表示阻止操作
  fi
done

exit 0
