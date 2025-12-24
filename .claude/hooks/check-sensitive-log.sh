#!/bin/bash
# Hook: 检查敏感信息日志
# 触发时机: PreToolUse (Edit|Write)
# 功能: 警告日志中输出敏感信息

input=$(cat)
new_content=$(echo "$input" | jq -r '.tool_input.new_string // .tool_input.content // empty')

if [[ -z "$new_content" ]]; then
  exit 0
fi

# 检查是否在日志中输出敏感信息
sensitive_patterns=(
  "logger.*password"
  "logger.*apiKey"
  "logger.*token"
  "logger.*secret"
  "console.log.*password"
  "console.log.*apiKey"
  "console.log.*token"
)

for pattern in "${sensitive_patterns[@]}"; do
  if echo "$new_content" | grep -qiE "$pattern"; then
    echo "WARNING: 检测到日志中可能输出敏感信息" >&2
    echo "QuantFi 规范要求：日志必须脱敏，禁止输出密码、API Key、Token 等" >&2
    # 只警告，不阻止
  fi
done

exit 0
