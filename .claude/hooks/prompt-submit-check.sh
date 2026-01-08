#!/bin/bash
# Hook: 用户提交消息时执行
# 触发时机: user-prompt-submit-hook (在 CLAUDE.local.md 中配置)
# 功能: 强制 AI 在每次任务开始时读取核心文件

# 检查是否是开发相关的任务（包含关键词）
PROMPT="$1"

# 如果是简单的问答或确认，不触发
if echo "$PROMPT" | grep -qiE '^(是|否|好|ok|yes|no|继续|确认|取消)$'; then
  exit 0
fi

# 输出强制读取指令
cat << 'EOF'
<user-prompt-submit-hook>
【强制执行】在开始任何任务之前，你必须：

1. 先读取以下核心文件（如果本次会话还没读过）：
   - 文档/核心文档/开发顺序.md (前 300 行)
   - 文档/核心文档/项目需求.md (前 200 行)

2. 输出当前开发状态摘要：
   - 当前阶段: Phase X
   - 下一步任务: [任务名称]

3. 使用 TodoWrite 记录本次任务

如果你跳过这些步骤，PM 会打回你的交付。
</user-prompt-submit-hook>
EOF

exit 0
