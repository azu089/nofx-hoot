#!/bin/bash
# Hook: 会话开始时执行
# 触发时机: SessionStart
# 功能: 输出项目状态提醒

PROJECT_DIR="/Users/azu/主QuantFi"

# 检查开发顺序文档
if [[ -f "$PROJECT_DIR/文档/核心文档/开发顺序.md" ]]; then
  echo '{"message": "QuantFi 项目已加载。使用 /状态 查看当前进度，使用 /开发 开始开发任务。"}'
fi

exit 0
