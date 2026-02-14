# AI 策略创建页面 - API 集成完成

## 任务概述

将 `ai-trading-create.tsx` 中的 mock 提交逻辑替换为真实的 API 调用。

## 实现内容

### 1. 新增导入

```typescript
import { useRouter } from 'next/navigation'
import { useCreateStrategy, useStrategyControl } from '@/hooks/useAi'
```

### 2. 新增状态和 Hooks

在 `CreateStrategyWizard` 组件中添加:

```typescript
const router = useRouter()
const createStrategy = useCreateStrategy()
const strategyControl = useStrategyControl()
const [isSubmitting, setIsSubmitting] = useState(false)
```

### 3. 字段映射规则

#### 策略类型映射
- `普通策略` → `normal`
- `网格交易` → `grid`

#### 交易模式映射
- `Solo` → `solo`
- `Debate` → `debate`

#### 币种来源映射
- `手动选择` → `static`
- `AI推荐` → `ai`
- `OI榜` → `oi_top`

#### 间隔时间映射
- `15m` → 15 分钟
- `30m` → 30 分钟
- `60m` → 60 分钟
- `4h` → 240 分钟
- `24h` → 1440 分钟

#### 币种格式
将 `BTC` 转换为期货格式 `BTC/USDT:USDT`

### 4. 请求体构造

```typescript
{
  name: formData.strategyName,
  strategyType: 'normal' | 'grid',
  tradingMode: 'solo' | 'debate',
  coinSourceConfig: {
    mode: 'static' | 'ai' | 'oi_top',
    coins: ['BTC/USDT:USDT', 'ETH/USDT:USDT', ...]
  },
  indicatorConfig: {
    timeframe: '1h',
    secondaryTimeframe: '15m',
    indicators: []
  },
  riskControlConfig: {
    maxPositions: 3,
    minPositionSize: formData.customParams.minPositionSize,
    maxLeverage: formData.customParams.maxLeverage,
    maxPositionPercent: formData.customParams.maxPosition,
    minConfidence: formData.customParams.minConfidence,
    minRiskReward: formData.customParams.minRR,
    amountPerTrade: fundPool * (maxPerTrade / 100),
    maxDailyDrawdown: fundPool * (dailyDrawdown / 100)
  },
  intervalMinutes: 60
}
```

### 5. 提交流程

1. **设置加载状态**: `setIsSubmitting(true)`
2. **创建策略**: 调用 `createStrategy.mutateAsync(body)`
3. **启动策略** (如果不是仅保存):
   - 调用 `strategyControl.mutateAsync({ id, action: 'start' })`
4. **导航到详情页**: `router.push('/ai-trading/{strategyId}')`
5. **错误处理**: 捕获异常并显示提示
6. **重置状态**: `setIsSubmitting(false)`

### 6. UI 更新

两个提交按钮都添加了:
- `disabled={isSubmitting}` - 禁用状态
- `opacity-50 cursor-not-allowed` - 禁用样式
- 动态文本:
  - "保存并启动策略" → "创建中..."
  - "仅保存" → "保存中..."

## 验证步骤

### 1. 编译检查
```bash
cd /Users/azu/量化项目/HOOT/apps/web
pnpm build
```

### 2. 功能测试
1. 访问 `/ai-trading/create`
2. 填写表单（4步向导）
3. 点击"保存并启动策略"
4. 验证:
   - 按钮显示"创建中..."
   - 策略创建成功
   - 策略自动启动
   - 跳转到详情页 `/ai-trading/{id}`

### 3. 仅保存测试
1. 填写表单
2. 点击"仅保存"
3. 验证:
   - 策略创建成功
   - 策略状态为未启动
   - 跳转到详情页

## 错误处理

- API 调用失败时显示 `alert` 错误信息
- 保持 `isSubmitting` 状态正确重置
- 可后续替换为 Toast 组件

## 文件变更

### 修改文件
- `/apps/web/src/components/ui-v3/mobile/ai-trading-create.tsx`

### 变更行数
- 新增导入: 2 行
- 新增状态: 4 行
- 替换 handleSubmit: ~100 行
- 更新按钮: ~20 行

## 依赖关系

### 使用的 Hooks
- `useCreateStrategy()` - 来自 `/hooks/useAi.ts`
- `useStrategyControl()` - 来自 `/hooks/useAi.ts`
- `useRouter()` - 来自 `next/navigation`

### 类型定义
- `CreateStrategyBody` - 来自 `/types/ai.ts`
- `CreateStrategyResponse` - 来自 `/types/ai.ts`

## 后续优化建议

1. **错误提示优化**: 使用 Toast 组件替代 alert
2. **表单验证**: 添加必填字段检查（策略名称、币种选择）
3. **成功提示**: 创建成功后显示友好提示
4. **加载动画**: 优化加载状态的视觉反馈
5. **网络失败重试**: 添加重试机制

## 回滚方案

如需回滚到 mock 版本:

```bash
git diff HEAD apps/web/src/components/ui-v3/mobile/ai-trading-create.tsx
git checkout HEAD -- apps/web/src/components/ui-v3/mobile/ai-trading-create.tsx
```

## 测试清单

- [ ] TypeScript 编译通过
- [ ] 表单填写流程正常
- [ ] "保存并启动" 按钮功能正常
- [ ] "仅保存" 按钮功能正常
- [ ] 创建成功后跳转正确
- [ ] 加载状态显示正确
- [ ] 错误处理正常
- [ ] 移动端样式正常

---

**完成时间**: 2026-02-14
**状态**: ✅ 已完成
