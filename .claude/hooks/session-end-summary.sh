#!/bin/bash
# Hook: 会话结束统计
# 触发时机: SessionEnd
# 功能: 记录会话统计信息

LOG_DIR="$HOME/.claude/logs"
SUMMARY_FILE="$LOG_DIR/session-summary.log"

mkdir -p "$LOG_DIR"

# 记录会话结束时间
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Session ended - QuantFi" >> "$SUMMARY_FILE"

exit 0
