#!/bin/bash
# Hook: 任务完成通知
# 触发时机: Stop
# 功能: 任务完成时发送系统通知（macOS）

# 检查是否是 macOS
if [[ "$OSTYPE" == "darwin"* ]]; then
  osascript -e 'display notification "Claude Code 任务已完成，等待您的输入" with title "QuantFi 开发"' 2>/dev/null || true
fi

exit 0
