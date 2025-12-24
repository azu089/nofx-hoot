#!/bin/bash
# Hook: 检查资金字段类型
# 触发时机: PreToolUse (Edit|Write)
# 功能: 警告使用 number 类型处理资金相关字段

input=$(cat)
file_path=$(echo "$input" | jq -r '.tool_input.file_path // empty')
new_content=$(echo "$input" | jq -r '.tool_input.new_string // .tool_input.content // empty')

if [[ -z "$file_path" || -z "$new_content" ]]; then
  exit 0
fi

# 检查是否涉及资金相关文件
if [[ "$file_path" == *"wallet"* || "$file_path" == *"billing"* || "$file_path" == *"balance"* || "$file_path" == *"amount"* || "$file_path" == *"price"* ]]; then
  # 检查是否使用了 number 类型处理金额
  if echo "$new_content" | grep -qE "(balance|amount|price|fee|total):\s*number"; then
    echo "WARNING: 检测到资金字段使用 number 类型" >&2
    echo "QuantFi 规范要求：资金字段必须使用 string 类型（DECIMAL）" >&2
    echo "建议使用：balance: string; 并用 decimal.js 计算" >&2
    # 只警告，不阻止
  fi
fi

exit 0
