#!/bin/bash

# QuantFi 自动审核服务测试脚本

echo "===== 测试自动审核服务 ====="
echo ""

# 测试用例 1：包含恶意代码的策略
echo "=== 测试用例 1：恶意代码检测 ==="
cat > /tmp/malicious_strategy.py << 'EOF'
import os  # 禁止的模块
import subprocess  # 禁止的模块

def populate_indicators(dataframe, metadata):
    # 尝试执行系统命令
    os.system("ls -la")
    subprocess.run(["whoami"])
    return dataframe
EOF

echo "策略代码包含："
echo "- import os"
echo "- import subprocess"
echo "- os.system()"
echo "预期结果：审核失败，检测到恶意代码"
echo ""

# 测试用例 2：包含硬编码 API Key 的策略
echo "=== 测试用例 2：API 密钥安全检测 ==="
cat > /tmp/insecure_strategy.py << 'EOF'
# Binance API 配置
api_key = "abc123def456ghi789jkl012mno345pqr"
api_secret = "xyz987wvu654tsr321qpo098nml876kji"

def populate_indicators(dataframe, metadata):
    return dataframe
EOF

echo "策略代码包含："
echo "- api_key = \"abc123...\""
echo "- api_secret = \"xyz987...\""
echo "预期结果：审核失败，检测到硬编码密钥"
echo ""

# 测试用例 3：安全的策略代码
echo "=== 测试用例 3：安全的策略代码 ==="
cat > /tmp/safe_strategy.py << 'EOF'
import pandas as pd
import talib

def populate_indicators(dataframe, metadata):
    # 使用技术指标库
    dataframe['rsi'] = talib.RSI(dataframe['close'], timeperiod=14)
    dataframe['ema'] = talib.EMA(dataframe['close'], timeperiod=20)
    return dataframe

def populate_entry_trend(dataframe, metadata):
    dataframe.loc[
        (dataframe['rsi'] < 30) &
        (dataframe['close'] > dataframe['ema']),
        'enter_long'] = 1
    return dataframe

def populate_exit_trend(dataframe, metadata):
    dataframe.loc[
        (dataframe['rsi'] > 70),
        'exit_long'] = 1
    return dataframe
EOF

echo "策略代码包含："
echo "- 使用 pandas 和 talib 技术指标库"
echo "- 标准的 Freqtrade 策略方法"
echo "- 无危险函数，无硬编码密钥"
echo "预期结果：审核通过 ✅"
echo ""

echo "=== 测试脚本创建完成 ==="
echo ""
echo "接下来需要："
echo "1. 将 AutoReviewService 注入到 StrategiesModule"
echo "2. 创建单元测试文件 auto-review.service.spec.ts"
echo "3. 执行单元测试验证功能"
