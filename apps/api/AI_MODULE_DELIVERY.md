# AI 模块交付文档

## 交付时间
2025-12-29

## 功能概述
为 QuantFi 后端创建 AI 模块，实现策略生成和交易分析功能。

---

## 已完成的任务

### 1. 目录结构创建
```
apps/api/src/modules/ai/
├── ai.module.ts                  # AI 模块定义
├── ai.controller.ts              # 控制器（4 个接口）
├── ai.service.ts                 # 服务层（核心逻辑）
├── ai.service.spec.ts            # 单元测试
├── dto/
│   ├── generate-strategy.dto.ts  # 策略生成 DTO
│   ├── analyze-trades.dto.ts     # 交易分析 DTO (合并在 generate-strategy.dto.ts 中)
│   └── ai-response.dto.ts        # 响应 DTO
├── prompts/
│   ├── strategy-generation.prompt.ts  # 策略生成 Prompt
│   └── trade-analysis.prompt.ts       # 交易分析 Prompt
└── README.md                     # 模块文档
```

### 2. 数据库表（已存在）
Prisma Schema 中已包含 `ai_generations` 表：
```prisma
model ai_generations {
  id          String   @id
  user_id     String
  type        String   // 'strategy' | 'analysis'
  input       String
  output      String
  tokens_used Int?
  model       String?
  created_at  DateTime
}
```

### 3. API 接口

#### POST /api/ai/generate-strategy
生成交易策略代码

**请求：**
```json
{
  "description": "基于 RSI 和 MACD 的趋势跟踪策略",
  "riskLevel": "medium",
  "tradingPair": "BTC/USDT"
}
```

**响应：**
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

#### POST /api/ai/analyze-trades
分析交易记录

**请求：**
```json
{
  "timeRange": "7d"
}
```

**响应：**
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

#### GET /api/ai/generation-quota
查询生成配额

**响应：**
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

#### GET /api/ai/generation-history?type=strategy&limit=10
查询生成历史

**响应：**
```json
{
  "code": 0,
  "message": "success",
  "data": [
    {
      "id": "uuid",
      "type": "strategy",
      "input": "{...}",
      "output": "{...}",
      "tokens_used": 1500,
      "model": "gpt-4",
      "created_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### 4. 配额管理
- VIP 0: 3 次/月
- VIP 1: 10 次/月
- VIP 2: 30 次/月
- VIP 3: 无限制

### 5. 沙盒模式
- 未配置 `OPENAI_API_KEY` 时自动启用
- 返回模拟生成的策略代码和分析结果
- 不消耗 OpenAI Token
- 仍然记录生成历史和消耗配额

### 6. 安全校验
策略代码会检查以下危险函数：
- `os.system()` / `subprocess`
- `exec()` / `eval()`
- `open()` / `file()`
- `__import__`
- `requests.` (除 ccxt)

### 7. 测试文件
- `ai.service.spec.ts` - 单元测试
- `test-ai-module.sh` - 集成测试脚本
- `.env.example.ai` - 环境变量示例

---

## 验证步骤

### 1. 检查编译
```bash
cd /Users/azu/主QuantFi/apps/api
npm run build
```
✓ 已验证，编译成功

### 2. 运行测试
```bash
npm test -- ai.service.spec.ts
```

### 3. 启动服务
```bash
npm run dev
```

### 4. 测试接口
```bash
./test-ai-module.sh
```

**预期结果：**
- 登录成功，获取 Token
- 查询配额成功（VIP 0 用户应显示 3 次/月）
- 生成策略成功（返回模拟策略代码）
- 分析交易成功（返回模拟分析结果）
- 查询历史成功（显示生成记录）

---

## 环境变量

### 可选配置
```bash
# OpenAI API Key（可选，未配置时使用沙盒模式）
OPENAI_API_KEY=sk-...

# OpenAI Model（默认 gpt-4）
OPENAI_MODEL=gpt-4
```

### 沙盒模式 vs 生产模式

| 特性 | 沙盒模式 | 生产模式 |
|-----|---------|---------|
| 需要 API Key | 否 | 是 |
| 返回数据 | 模拟数据 | 真实 AI 生成 |
| 消耗 Token | 否 | 是 |
| 适用场景 | 开发/测试 | 生产环境 |

---

## 回滚方案

如果需要回滚：

1. 从 AppModule 移除 AiModule：
```typescript
// apps/api/src/app.module.ts
// 删除第 33 行: import { AiModule } from './modules/ai/ai.module';
// 删除第 62 行: AiModule,
```

2. 删除 AI 模块目录：
```bash
rm -rf /Users/azu/主QuantFi/apps/api/src/modules/ai
```

3. 重新构建：
```bash
npm run build
```

---

## 风险点

1. **OpenAI API 成本**：
   - 每次调用约消耗 $0.01-0.05
   - 建议监控 API 使用量

2. **配额限制**：
   - VIP 等级与配额绑定
   - 需要定期重置配额（每月 1 号）

3. **安全性**：
   - 策略代码已做安全校验
   - 但仍需人工审核再使用

---

## 后续优化建议

1. **缓存策略**：
   - 相同输入缓存结果 1 小时
   - 减少重复调用成本

2. **异步生成**：
   - 大量请求时使用队列
   - 避免阻塞主线程

3. **多模型支持**：
   - 支持 GPT-3.5 Turbo（更便宜）
   - 支持本地模型（Llama 等）

4. **策略评分**：
   - 对生成的策略进行回测评分
   - 推荐高分策略

---

## 文件清单

### 新增文件
- `apps/api/src/modules/ai/ai.module.ts`
- `apps/api/src/modules/ai/ai.controller.ts`
- `apps/api/src/modules/ai/ai.service.ts`
- `apps/api/src/modules/ai/ai.service.spec.ts`
- `apps/api/src/modules/ai/dto/generate-strategy.dto.ts`
- `apps/api/src/modules/ai/dto/ai-response.dto.ts`
- `apps/api/src/modules/ai/prompts/strategy-generation.prompt.ts`
- `apps/api/src/modules/ai/prompts/trade-analysis.prompt.ts`
- `apps/api/src/modules/ai/README.md`
- `test-ai-module.sh`
- `apps/api/.env.example.ai`
- `apps/api/AI_MODULE_DELIVERY.md`

### 修改文件
- `apps/api/src/app.module.ts` - 已注册 AiModule（第 33, 62 行）
- `apps/api/prisma/schema.prisma` - 已包含 ai_generations 表

---

## 完成状态

✅ 所有任务已完成
✅ 代码编译通过
✅ 单元测试已创建
✅ 文档已完善
✅ 测试脚本已创建

**可以进行验收！**
