# Mobile AI Trading - API Integration Changelog

## 修改时间
2026-02-08

## 修改文件
- `apps/web/src/components/ui-v3/mobile/mobile-ai-trading.tsx`

## 改动说明

### 1. 导入 API Hooks
```typescript
import { useAiAnalyses, useAiStats, useTriggerAnalysis } from '@/hooks/useAiTrading'
import { Loader2 } from 'lucide-react'
```

### 2. 使用真实 API 数据
- ✅ **useAiAnalyses**: 获取 AI 分析列表（支持分页、状态筛选）
- ✅ **useAiStats**: 获取统计数据（总分析数、执行数、拦截数、成本等）
- ✅ **useTriggerAnalysis**: 触发新的 AI 分析

### 3. 数据字段映射

#### API → 前端显示
| API 字段 | 前端显示 | 说明 |
|---------|---------|------|
| `direction` | `decision` | 'buy'/'sell'/'hold' |
| `status` | `executionStatus` | 'pending'/'executed'/'blocked'/'failed'/'hold' |
| `confidence` | 置信度进度条 | 0-100 数字 |
| `consensusScore` | 共识分数进度条 | 0-100 数字（如无投票详情） |
| `executionCost` | 成本显示 | 数字 |
| `createdAt` | "X分钟前" | ISO 日期字符串 |

#### 统计数据映射
| API 字段 | 前端显示 | 说明 |
|---------|---------|------|
| `totalAnalyses` | 今日分析 | 总分析数 |
| `executedCount` | 已执行数量 | 筛选器计数 |
| `blockedCount` | 被拦截数量 | 筛选器计数 |
| `holdCount` | 观望数量 | 筛选器计数 |
| `currentSpend` | 本月成本 | 成本显示 |
| `monthlyBudget` | 预算 | 预算显示 |
| `budgetRemaining` | 剩余预算 | 计算显示 |

### 4. 添加加载状态
- ✅ 快速统计：显示 Loader2 旋转图标
- ✅ 分析列表：显示居中的加载动画
- ✅ 成本标签页：显示加载状态

### 5. 分页功能
- ✅ 添加 `page` 状态管理
- ✅ 显示"上一页/下一页"按钮
- ✅ 显示当前页/总页数
- ✅ 按钮禁用状态处理

### 6. 保留的 Mock 数据
以下数据 API 暂未提供，继续使用 mock：
- ❌ `consensusVotes` - 5 个角色的投票详情（如 API 未返回）
- ❌ `reasoning` - 推理说明（如 API 未返回）
- ❌ `pnl` - 盈亏数据（如 API 未返回）
- ❌ 模型排行榜数据
- ❌ 按交易对的成本分布
- ❌ 近7日成本趋势
- ❌ 安全防护统计

### 7. 交互增强
- ✅ "一键执行"按钮绑定 `triggerAnalysis.mutate()`
- ✅ 执行中显示 Loader2 动画
- ✅ 按钮禁用状态处理

## 数据流
```
用户打开页面
  ↓
useAiAnalyses(page, limit, undefined, statusFilter)  → 获取分析列表
useAiStats()                                         → 获取统计数据
  ↓
渲染列表 + 统计卡片
  ↓
用户点击筛选 → 更新 statusFilter → 重新请求
用户翻页 → 更新 page → 重新请求
用户点击"一键执行" → triggerAnalysis.mutate() → 刷新列表
```

## 验收步骤

### 1. 启动服务
```bash
cd /Users/azu/Desktop/HOOT
docker compose up -d  # 启动后端 API
cd apps/web
pnpm dev             # 启动前端（端口 3001）
```

### 2. 验证数据显示
- 打开 http://localhost:3001/ai-trading（移动端视图）
- 应该看到：
  - ✅ 快速统计卡片显示真实数据（准确率/本月成本/今日分析）
  - ✅ 成本进度条动态计算
  - ✅ 分析列表显示真实数据
  - ✅ 状态筛选器显示正确的计数

### 3. 验证交互
- ✅ 点击状态筛选（全部/已执行/被拦截等）→ 列表更新
- ✅ 点击"上一页/下一页"→ 列表翻页
- ✅ 点击"一键执行"→ 显示加载动画，完成后刷新列表
- ✅ 点击分析卡片 → 跳转到详情页（如已实现）

### 4. 验证加载状态
- 刷新页面时应该看到：
  - ✅ 快速统计区域显示旋转图标
  - ✅ 分析列表区域显示居中的大旋转图标
  - ✅ 数据加载后平滑显示

## 未改动部分
- ✅ 保留所有视觉设计（颜色、布局、样式）
- ✅ 保留"模型排行"标签页（仍使用 mock 数据）
- ✅ 保留"成本追踪"标签页部分内容（仍使用 mock 数据）
- ✅ 保留安全防护统计折叠面板（仍使用 mock 数据）

## 待后续实现
1. 模型排行 API 对接（需要后端提供 `/ai/models/ranking` 接口）
2. 成本明细 API 对接（需要后端提供 `/ai/costs/breakdown` 接口）
3. 安全防护统计 API 对接（需要后端提供 `/ai/safety/stats` 接口）
4. AI 分析详情页面实现

## 回滚方案
```bash
cd /Users/azu/Desktop/HOOT/apps/web
git checkout HEAD -- src/components/ui-v3/mobile/mobile-ai-trading.tsx
```

## 注意事项
1. API 返回的字段名可能与 mock 数据不同（direction vs decision, status vs executionStatus）
2. 代码兼容两种字段名，优先使用 API 字段
3. 如果 API 未返回某些字段（如 reasoning, consensusVotes），则不显示对应 UI
4. 分页参数：`page` 从 1 开始，`limit` 默认 20
