# AI 模块

提供 AI 驱动的策略生成和交易分析功能。

## 功能特性

### 1. 策略生成
- 基于用户描述自动生成 Freqtrade Python 策略代码
- 支持 3 种风险等级 (low/medium/high)
- 自动设置止损、止盈、移动止损参数
- 安全校验（禁止危险函数）

### 2. 交易分析
- 分析用户的交易历史数据
- 评估胜率、盈亏比、持仓时间
- 生成优势/不足/建议列表
- 计算情绪得分和风险得分

### 3. 配额管理
- VIP 0: 3 次/月
- VIP 1: 10 次/月
- VIP 2: 30 次/月
- VIP 3: 无限制

## API 接口

### 生成策略
```http
POST /api/ai/generate-strategy
Authorization: Bearer {token}

{
  "description": "基于 RSI 和 MACD 的趋势跟踪策略",
  "riskLevel": "medium",
  "tradingPair": "BTC/USDT"
}
```

响应：
```json
{
  "code": 0,
  "message": "策略生成成功",
  "data": {
    "name": "AI_medium_Strategy",
    "code": "# Python 策略代码...",
    "explanation": "策略逻辑解释..."
  }
}
```

### 分析交易
```http
POST /api/ai/analyze-trades
Authorization: Bearer {token}

{
  "timeRange": "7d"
}
```

响应：
```json
{
  "code": 0,
  "message": "分析完成",
  "data": {
    "summary": "整体表现不错...",
    "strengths": ["优势1", "优势2"],
    "weaknesses": ["不足1", "不足2"],
    "suggestions": ["建议1", "建议2"],
    "emotionalScore": 75,
    "riskScore": 80
  }
}
```

### 查询配额
```http
GET /api/ai/generation-quota
Authorization: Bearer {token}
```

响应：
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "remaining": 8,
    "limit": 10
  }
}
```

### 查询历史
```http
GET /api/ai/generation-history?type=strategy&limit=10
Authorization: Bearer {token}
```

## 环境变量

```bash
# OpenAI API Key（可选，未配置时使用沙盒模式）
OPENAI_API_KEY=sk-...

# OpenAI Model（默认 gpt-4）
OPENAI_MODEL=gpt-4
```

## 沙盒模式

当未配置 `OPENAI_API_KEY` 时，AI 模块自动进入沙盒模式：
- 返回模拟生成的策略代码
- 返回模拟分析结果
- 不消耗 OpenAI Token
- 仍然记录生成历史和消耗配额

这允许在开发环境中测试功能，而无需配置真实的 OpenAI API Key。

## 测试

```bash
# 运行测试脚本
./test-ai-module.sh
```

## 安全性

### 策略代码校验
AI 生成的策略代码会经过安全校验，禁止以下内容：
- `os.system()` - 系统命令执行
- `subprocess` - 子进程
- `exec()` / `eval()` - 代码执行
- `open()` / `file()` - 文件操作
- `__import__` - 动态导入
- `requests.` - 网络请求（ccxt 除外）

如果检测到危险代码，会抛出错误并拦截。

## 数据库表

### ai_generations
```sql
id          UUID PRIMARY KEY
user_id     UUID
type        VARCHAR(20)  -- 'strategy' | 'analysis'
input       TEXT         -- 用户输入
output      TEXT         -- AI 输出
tokens_used INT          -- 消耗的 Token 数
model       VARCHAR(50)  -- 使用的模型
created_at  TIMESTAMP
```

## 限流策略

- 按月计算配额
- 每月 1 号重置
- 配额不累计
- 超限后返回 403 错误

## 错误码

| 错误码 | 说明 |
|-------|------|
| 40001 | 参数错误 |
| 40301 | 配额已用尽 |
| 50001 | AI 服务暂时不可用 |
