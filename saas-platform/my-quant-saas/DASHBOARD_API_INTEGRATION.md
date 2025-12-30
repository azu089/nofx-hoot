# Dashboard API 对接文档

## 修改内容

### 1. 新增 API 客户端模块

已创建以下 API 模块文件：

```
apps/app/lib/api/
├── index.ts          # 统一导出
├── client.ts         # Axios 客户端（已有）
├── types.ts          # 类型定义（已有）
├── auth.ts           # 认证 API（已有）
├── wallet.ts         # 钱包 API（新增）
├── billing.ts        # 计费 API（新增）
├── instances.ts      # VPS 实例 API（新增）
├── trading.ts        # 交易 API（新增）
└── strategies.ts     # 策略 API（新增）
```

### 2. Dashboard 页面改造

**文件**: `apps/app/app/(authenticated)/(dashboard)/dashboard/page.tsx`

**主要变更**:
- 导入 API 客户端模块
- 修改 `fetchData` 函数调用真实 API
- 添加错误状态处理
- 保留 Mock 数据作为 fallback

**调用的 API 端点**:
- `GET /api/wallets/me` - 钱包余额
- `GET /api/billing/today-pnl` - 今日盈亏
- `GET /api/instances` - VPS 实例列表
- `GET /api/strategies/subscribed` - 我的订阅策略
- `GET /api/trades?limit=10` - 最近交易

## API 响应格式

所有 API 返回统一格式：

```typescript
{
  code: 0,              // 0 = 成功
  message: "success",
  data: { ... },        // 实际数据
  request_id: "uuid"
}
```

## 当前状态

### ✅ 已完成
- [x] 创建 5 个 API 模块（wallet/billing/instances/trading/strategies）
- [x] 修改 Dashboard 页面调用真实 API
- [x] 添加 Loading 骨架屏
- [x] 添加 Error 错误提示
- [x] Mock 数据作为 fallback（API 失败时使用）

### ⚠️ 需要后端补充的字段

1. **Wallet API (`/wallets/me`)**
   - 缺少 `staked_amount` 字段（质押金额）

2. **Strategy API (`/strategies/subscribed`)**
   - 缺少 `todayProfit` 字段（今日盈利）

3. **Trade API (`/trades`)**
   - 缺少 `strategy_name` 字段（策略名称）

### 🔧 待开发功能
- [ ] 公告系统 API（当前使用 Mock 数据）
- [ ] 刷新 Token 机制（401 后自动续期）
- [ ] 实时数据推送（WebSocket）

## 测试步骤

### 1. 确认后端运行中

```bash
# 检查健康状态
curl http://localhost:4001/api/health

# 预期输出
{
  "code": 0,
  "message": "success",
  "data": {
    "status": "ok",
    ...
  }
}
```

### 2. 启动前端

```bash
cd /Users/azu/主QuantFi/saas-platform/my-quant-saas
pnpm dev
```

### 3. 访问 Dashboard

打开浏览器：`http://localhost:3001/dashboard`

### 4. 查看控制台日志

**成功场景**:
```
✅ Dashboard 数据加载成功 {
  wallet: true,
  todayPnL: true,
  instances: 2,
  strategies: 3,
  trades: 10
}
```

**失败场景**:
```
❌ Dashboard 数据加载失败，使用 Mock 数据
Network Error ...
```

如果看到红色错误提示卡片，说明 API 调用失败，点击"重试"按钮重新加载。

## 环境变量

确认 `.env.local` 包含：

```env
NEXT_PUBLIC_API_URL="http://localhost:4001/api"
```

## 回滚方案

如果需要回退到纯 Mock 数据模式：

```typescript
// 在 fetchData 函数开头添加：
setData(getMockData());
return;
```

或者直接还原 Git：

```bash
git checkout HEAD -- apps/app/app/(authenticated)/(dashboard)/dashboard/page.tsx
```
