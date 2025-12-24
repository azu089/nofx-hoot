#!/bin/bash
# Hook: 记录代码变更日志
# 触发时机: PostToolUse (Edit|Write)
# 功能: 记录所有文件变更，便于审计

LOG_DIR="$HOME/.claude/logs"
LOG_FILE="$LOG_DIR/quantfi-changes-$(date +%Y%m%d).log"

mkdir -p "$LOG_DIR"

input=$(cat)
file_path=$(echo "$input" | jq -r '.tool_input.file_path // empty')
tool_name=$(echo "$input" | jq -r '.tool_name // empty')

if [[ -n "$file_path" ]]; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $tool_name: $file_path" >> "$LOG_FILE"
fi

exit 0
