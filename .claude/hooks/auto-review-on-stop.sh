#!/bin/bash
# Hook: 响应完成时自动审查提示
# 触发时机: Stop
# 功能: 提醒进行代码审查（当有文件变更时）

LOG_FILE="$HOME/.claude/logs/quantfi-changes-$(date +%Y%m%d).log"

# 检查今天是否有变更记录
if [[ -f "$LOG_FILE" ]]; then
  change_count=$(wc -l < "$LOG_FILE" | tr -d ' ')
  if [[ "$change_count" -gt 0 ]]; then
    echo '{"remind": "今日已有 '"$change_count"' 次代码变更，建议使用 /审查 检查代码质量"}'
  fi
fi

exit 0
