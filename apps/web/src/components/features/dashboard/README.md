# Dashboard 功能组件

## AiInsightCard - AI 交易解读卡片

### 功能

1. **每日一句** - AI 生成的今日交易点评
2. **情绪得分** - 1-100 分，圆形进度条显示
3. **风险预警** - 根据风险得分显示提示（绿色/黄色/红色）
4. **分析按钮** - 点击展开详细分析弹窗

### 使用方式

```tsx
import { AiInsightCard } from '@/components/features/dashboard';

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* 其他概览卡片... */}
      
      {/* AI 解读卡片 */}
      <AiInsightCard />
    </div>
  );
}
```

### UI 规范

- **卡片背景**: `#131722` (var(--bg-secondary))
- **情绪得分颜色**:
  - \>= 70: 绿色 `#00C087`
  - 50-70: 黄色 `#F7931A`
  - < 50: 红色 `#F23645`
- **圆形进度条**: SVG 实现，动画 500ms

---

## AiAnalysisModal - AI 详细分析弹窗

### 功能

1. **时间范围选择** - 7天/30天/90天
2. **分析按钮** - 触发 AI 分析（调用 `/ai/analyze-trades` 接口）
3. **分析结果展示**:
   - 总体评价 (summary)
   - 优势列表 (strengths)
   - 不足列表 (weaknesses)
   - 改进建议 (suggestions)
   - 情绪得分仪表盘
   - 风险得分仪表盘

### 使用方式

```tsx
import { useState } from 'react';
import { AiAnalysisModal } from '@/components/features/dashboard';

export function MyComponent() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <button onClick={() => setIsModalOpen(true)}>
        查看详细分析
      </button>

      <AiAnalysisModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
}
```

### API 调用

```typescript
// POST /api/ai/analyze-trades
{
  "timeRange": "7d" | "30d" | "90d"
}

// Response
{
  "code": 0,
  "message": "success",
  "data": {
    "summary": "总体表现良好，盈利稳定...",
    "strengths": ["止损执行到位", "选币策略合理"],
    "weaknesses": ["开仓时机偏早", "仓位管理需优化"],
    "suggestions": ["建议增加技术指标确认", "控制单次开仓比例"],
    "emotionalScore": 68,
    "riskScore": 42
  }
}
```

---

## 集成示例

在 Dashboard 页面完整集成：

```tsx
// apps/web/src/app/(dashboard)/dashboard/page.tsx
import { AiInsightCard } from '@/components/features/dashboard';

export default function DashboardPage() {
  return (
    <div className="space-y-6 p-6">
      {/* 顶部公告 */}
      <AnnouncementBanner />

      {/* 资产概览卡片（3列） */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <AssetCard title="总资产" amount="12345.67" />
        <AssetCard title="今日盈亏" amount="123.45" change="+1.25%" />
        <AssetCard title="点卡余额" amount="5000" unit="点" />
      </div>

      {/* 收益曲线图 */}
      <PnLCurve />

      {/* AI 交易解读（新增） */}
      <AiInsightCard />

      {/* 机器人状态 & VPS 状态 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <BotStatusCard />
        <VpsStatusCard />
      </div>

      {/* 当前持仓 */}
      <PositionList />
    </div>
  );
}
```

---

## 注意事项

1. **必须在 ToastProvider 内使用** - 组件依赖 `useToast` hook
2. **API 配置** - 确保后端已实现 `/ai/analyze-trades` 接口
3. **权限控制** - 可根据用户 VIP 等级限制 AI 分析次数
4. **错误处理** - 接口失败会通过 Toast 提示用户
5. **样式继承** - 使用 CSS 变量，自动适配深色主题
