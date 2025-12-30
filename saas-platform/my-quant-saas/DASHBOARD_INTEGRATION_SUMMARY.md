# Dashboard API 对接完成总结

## 任务完成

### 已实现内容

#### 1. 创建 API 客户端模块

新增 5 个 API 模块文件，位于 `apps/app/lib/api/`:

| 文件 | 功能 | 方法 |
|------|------|------|
| `wallet.ts` | 钱包 API | `getBalance()`, `getApiKeys()`, `addApiKey()`, `verifyApiKey()`, `deleteApiKey()` |
| `billing.ts` | 计费 API | `getTodayPnL()`, `getPnLCurve()`, `getBillingLogs()` |
| `instances.ts` | VPS 实例 API | `list()`, `get()`, `create()`, `destroy()`, `heartbeat()` |
| `trading.ts` | 交易 API | `getTrades()`, `getPositions()`, `getOrders()`, `getBotStatus()`, `startBot()`, `stopBot()` |
| `strategies.ts` | 策略 API | `list()`, `get()`, `getMyStrategies()`, `subscribe()`, `unsubscribe()`, `toggleStatus()` |

#### 2. 修改 Dashboard 页面

**文件**: `apps/app/app/(authenticated)/(dashboard)/dashboard/page.tsx`

**核心变更**:

```typescript
// 1. 导入 API 客户端
import { walletApi, billingApi, instancesApi, tradingApi, strategiesApi } from '@/lib/api';

// 2. 并行调用多个 API
const [walletRes, pnlRes, instancesRes, strategiesRes, tradesRes] = await Promise.all([
  walletApi.getBalance().catch(() => null),
  billingApi.getTodayPnL().catch(() => null),
  instancesApi.list().catch(() => null),
  strategiesApi.getMyStrategies().catch(() => null),
  tradingApi.getTrades(10).catch(() => null),
]);

// 3. 数据转换和状态设置
setData({
  wallet: walletData,
  todayPnL: pnlRes?.data || null,
  instances: instancesRes?.data || [],
  activeStrategies,
  recentTrades,
  announcements,
});

// 4. 错误处理 - 使用 Mock 数据作为 fallback
catch (err) {
  setError(errorMsg);
  setData(getMockData()); // 确保页面仍然可用
}
```

#### 3. 添加用户体验增强

- **Loading 状态**: 骨架屏显示（4 个卡片）
- **Error 状态**: 红色警告卡片 + 重试按钮
- **Empty 状态**: 空数据提示（已有）
- **Refresh 功能**: 刷新按钮带旋转动画

---

## 测试步骤

### 1. 确认后端运行

```bash
# 检查健康状态
curl http://localhost:4001/api/health

# 预期输出包含 "status": "ok" 或 "degraded"
```

### 2. 启动前端开发服务器

```bash
cd /Users/azu/主QuantFi/saas-platform/my-quant-saas
pnpm dev
```

### 3. 访问 Dashboard

打开浏览器: `http://localhost:3001/dashboard`

### 4. 观察控制台日志

**API 调用成功**:
```
✅ Dashboard 数据加载成功 {
  wallet: true,
  todayPnL: true,
  instances: 2,
  strategies: 3,
  trades: 10
}
```

**API 调用失败（fallback 模式）**:
```
❌ Dashboard 数据加载失败，使用 Mock 数据
```

页面会显示红色错误提示卡片：
```
⚠️ API 连接失败
Network Error - 当前显示模拟数据，请稍后重试
[重试] 按钮
```

---

## 当前状态

### ✅ 已完成
- [x] 创建 5 个 API 模块
- [x] 统一导出 `lib/api/index.ts`
- [x] Dashboard 页面调用真实 API
- [x] 错误处理和 fallback 机制
- [x] TypeScript 类型检查通过
- [x] 控制台日志输出

### ⚠️ 后端需要补充的字段

1. **Wallet API** (`/wallets/me`)
   - 缺少 `staked_amount: string` 字段

2. **Strategy API** (`/strategies/subscribed`)
   - 缺少 `todayProfit: number` 字段

3. **Trade API** (`/trades`)
   - 缺少 `strategy_name: string` 字段

### 🔧 待开发功能

- [ ] 公告系统 API（当前使用 Mock）
- [ ] Token 自动刷新机制
- [ ] WebSocket 实时数据推送

---

## 文件清单

### 新增文件
```
apps/app/lib/api/
├── index.ts          # 统一导出
├── wallet.ts         # 钱包 API
├── billing.ts        # 计费 API
├── instances.ts      # VPS 实例 API
├── trading.ts        # 交易 API
└── strategies.ts     # 策略 API
```

### 修改文件
```
apps/app/app/(authenticated)/(dashboard)/dashboard/page.tsx
  - 第 35 行: 导入 API 客户端
  - 第 127 行: 添加 error 状态
  - 第 166-245 行: 重写 fetchData 函数
  - 第 303-321 行: 添加错误提示卡片
```

---

## 风险点 & 自检清单

### 风险点
1. **API 不可用时**: 使用 Mock 数据确保页面仍可浏览（已处理）
2. **数据格式不匹配**: 使用可选链 `?.` 和默认值（已处理）
3. **并发请求失败**: 每个 API 独立 catch，不影响其他数据（已处理）

### 自检清单
- [x] TypeScript 编译无错误（Dashboard 页面）
- [x] 所有 API 调用都有错误处理
- [x] Loading 状态正常显示
- [x] Error 状态正常显示
- [x] Mock 数据 fallback 正常工作
- [x] 环境变量 `NEXT_PUBLIC_API_URL` 已配置

---

## 回滚方案

### 方式 1: Git 回退

```bash
git checkout HEAD -- apps/app/app/(authenticated)/(dashboard)/dashboard/page.tsx
```

### 方式 2: 临时切换到纯 Mock 模式

在 `fetchData` 函数开头添加：

```typescript
const fetchData = async () => {
  // 临时使用 Mock 数据
  setData(getMockData());
  setLoading(false);
  setRefreshing(false);
  return;
  
  // 下面的 API 调用不会执行
  try { ... }
};
```

---

## 验收要求

打开 Dashboard 页面后应该看到：

1. **加载阶段** (1-2 秒)
   - 4 个骨架屏卡片
   - "仪表盘" 标题

2. **成功加载** (API 正常)
   - 显示真实数据
   - 无错误提示
   - 控制台显示 ✅ 成功日志

3. **失败加载** (API 不可用)
   - 显示 Mock 模拟数据
   - 红色错误提示卡片
   - 控制台显示 ❌ 失败日志
   - 可点击"重试"按钮

4. **刷新功能**
   - 点击"刷新"按钮
   - 按钮图标旋转
   - 重新加载数据

---

## 环境变量确认

确保 `apps/app/.env.local` 包含：

```env
NEXT_PUBLIC_API_URL="http://localhost:4001/api"
```

---

## 下一步建议

1. **后端补充字段**: 修复上述 3 个缺失字段
2. **认证集成**: 确认 Token 正确传递（已有拦截器）
3. **其他页面对接**: 使用相同模式对接策略、钱包等页面
4. **公告系统**: 开发后端 API 替换 Mock 数据
