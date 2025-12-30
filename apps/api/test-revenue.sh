#!/bin/bash

# QuantFi - Revenue 收入分配模块验收测试脚本
# 测试 40/40/20 分配规则 + 模拟回购

BASE_URL="http://localhost:4001/api"
echo "=== QuantFi Revenue 模块测试 ==="
echo "API 地址: $BASE_URL"
echo ""

# 测试 1: 获取当前周期收入
echo "1️⃣  测试：获取当前周期收入"
echo "GET $BASE_URL/revenue/current"
curl -s -X GET "$BASE_URL/revenue/current" | jq .
echo ""

# 测试 2: 获取统计数据
echo "2️⃣  测试：获取统计数据"
echo "GET $BASE_URL/revenue/stats"
curl -s -X GET "$BASE_URL/revenue/stats" | jq .
echo ""

# 测试 3: 模拟回购（沙盒）
echo "3️⃣  测试：模拟回购 1000 USDT"
echo "POST $BASE_URL/revenue/simulate-buyback"
curl -s -X POST "$BASE_URL/revenue/simulate-buyback" \
  -H "Content-Type: application/json" \
  -d '{"amount":"1000.00000000"}' | jq .
echo ""

# 测试 4: 执行收入分配（管理员）
echo "4️⃣  测试：执行收入分配（2024-01-01 ~ 2024-02-01）"
echo "POST $BASE_URL/revenue/distribute"
curl -s -X POST "$BASE_URL/revenue/distribute" \
  -H "Content-Type: application/json" \
  -d '{
    "periodStart": "2024-01-01T00:00:00Z",
    "periodEnd": "2024-02-01T00:00:00Z"
  }' | jq .
echo ""

# 测试 5: 获取分配历史
echo "5️⃣  测试：获取分配历史"
echo "GET $BASE_URL/revenue/history?page=1&limit=5"
curl -s -X GET "$BASE_URL/revenue/history?page=1&limit=5" | jq .
echo ""

# 测试 6: 参数验证 - 空参数
echo "6️⃣  测试：参数验证（空参数应报错）"
echo "POST $BASE_URL/revenue/distribute"
curl -s -X POST "$BASE_URL/revenue/distribute" \
  -H "Content-Type: application/json" \
  -d '{}' | jq .
echo ""

# 测试 7: 参数验证 - 日期倒序
echo "7️⃣  测试：参数验证（日期倒序应报错）"
echo "POST $BASE_URL/revenue/distribute"
curl -s -X POST "$BASE_URL/revenue/distribute" \
  -H "Content-Type: application/json" \
  -d '{
    "periodStart": "2024-02-01T00:00:00Z",
    "periodEnd": "2024-01-01T00:00:00Z"
  }' | jq .
echo ""

echo "✅ 测试完成！"
echo ""
echo "验收检查清单："
echo "- [ ] 当前周期收入显示正确"
echo "- [ ] 统计数据格式正确"
echo "- [ ] 模拟回购：回购=10000 QFI, 销毁=5000, 分配=5000"
echo "- [ ] 分配记录：operations_amount=40%, buyback_amount=40%, reserve_amount=20%"
echo "- [ ] 分配历史分页正常"
echo "- [ ] 空参数返回错误码 40001"
echo "- [ ] 日期倒序返回错误码 40001"
