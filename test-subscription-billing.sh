#!/bin/bash

# 订阅计费功能测试脚本

BASE_URL="http://localhost:4001/api"
TOKEN="test-token" # 实际测试需要真实 token

echo "=== QuantFi 订阅计费功能测试 ==="
echo ""

# 测试 1: 余额不足时创建 VPS（应该失败）
echo "【测试 1】余额不足创建 VPS"
curl -s -X POST "${BASE_URL}/instances" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "region": "sgp1",
    "size": "s-1vcpu-1gb"
  }' | jq

echo ""
echo "---"
echo ""

# 测试 2: 余额充足时创建 VPS（应该成功）
echo "【测试 2】余额充足创建 VPS"
echo "（需要先给用户充值 >= $25）"
echo ""

# 测试 3: 查看计费日志
echo "【测试 3】查看计费日志"
curl -s "${BASE_URL}/billing/logs?limit=10" \
  -H "Authorization: Bearer ${TOKEN}" | jq

echo ""
echo "---"
echo ""

# 测试 4: 手动触发订阅续费检查（需要后端暴露测试接口）
echo "【测试 4】手动触发订阅续费检查"
echo "（仅在测试环境可用）"
echo ""

# 测试 5: 手动触发余额检查（需要后端暴露测试接口）
echo "【测试 5】手动触发余额检查"
echo "（仅在测试环境可用）"
echo ""

echo "=== 测试完成 ==="
