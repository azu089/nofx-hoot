#!/bin/bash

# 质押系统测试脚本
# 测试 A/B 类质押、解押、权重计算

API_BASE="http://localhost:4001/api"
USER_ID="mock-user-id"

echo "=== QuantFi 质押系统测试 ==="

# 1. 质押列表（初始状态）
echo ""
echo "1. 查询质押列表（初始）"
curl -X GET "$API_BASE/staking/list" \
  -H "Content-Type: application/json" \
  2>/dev/null | jq '.'

# 2. A 类质押（1000 Token）
echo ""
echo "2. A 类质押（1000 Token）"
curl -X POST "$API_BASE/staking/stake" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": "1000.00000000",
    "stake_type": "A",
    "lock_days": 0
  }' \
  2>/dev/null | jq '.'

# 3. B 类质押（2000 Token，锁定 180 天）
echo ""
echo "3. B 类质押（2000 Token，锁定 180 天）"
curl -X POST "$API_BASE/staking/stake" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": "2000.00000000",
    "stake_type": "B",
    "lock_days": 180
  }' \
  2>/dev/null | jq '.'

# 4. 质押列表（质押后）
echo ""
echo "4. 查询质押列表（质押后）"
curl -X GET "$API_BASE/staking/list" \
  -H "Content-Type: application/json" \
  2>/dev/null | jq '.'

# 5. 收益统计
echo ""
echo "5. 收益统计"
curl -X GET "$API_BASE/staking/rewards" \
  -H "Content-Type: application/json" \
  2>/dev/null | jq '.'

echo ""
echo "=== 测试完成 ==="
echo ""
echo "说明："
echo "- A 类质押：随时解押，权重固定 1.0x，无惩罚"
echo "- B 类质押：锁定期 180 天，权重 1.0x-3.0x（随时间递增），提前解押惩罚 20%"
echo ""
echo "权重计算公式（B 类）："
echo "weight = min(1.0 + (已质押天数 / 180), 3.0)"
