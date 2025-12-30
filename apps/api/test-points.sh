#!/bin/bash

# 积分模块测试脚本
# 用于测试积分功能的 API 接口

BASE_URL="http://localhost:4001"
TOKEN=""  # 替换为实际的 JWT token

echo "=========================================="
echo "QuantFi 积分模块测试"
echo "=========================================="
echo ""

# 1. 查询积分余额
echo "1. 查询积分余额"
echo "----------------------------------------"
curl -X GET "${BASE_URL}/api/points/balance" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  | jq .
echo ""
echo ""

# 2. 查询积分流水（最近 10 条）
echo "2. 查询积分流水（最近 10 条）"
echo "----------------------------------------"
curl -X GET "${BASE_URL}/api/points/history?limit=10" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  | jq .
echo ""
echo ""

# 3. 抵扣积分（管理员接口 - 需要管理员权限）
echo "3. 抵扣积分（管理员接口）"
echo "----------------------------------------"
# 注意：此接口需要管理员权限，仅用于演示
# curl -X POST "${BASE_URL}/api/points/deduct" \
#   -H "Authorization: Bearer ${TOKEN}" \
#   -H "Content-Type: application/json" \
#   -d '{
#     "userId": "user-uuid-here",
#     "points": "10.00000000",
#     "description": "测试抵扣 VIP 订阅费"
#   }' \
#   | jq .
echo "（需要管理员权限，已注释）"
echo ""
echo ""

echo "=========================================="
echo "测试完成"
echo "=========================================="
echo ""
echo "提示："
echo "1. 请先替换脚本中的 TOKEN 为实际的 JWT token"
echo "2. 确保后端服务运行在 http://localhost:4001"
echo "3. 抵扣接口需要管理员权限（后续需要添加 AdminGuard）"
echo ""
