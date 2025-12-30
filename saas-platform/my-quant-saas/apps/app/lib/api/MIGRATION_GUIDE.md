# API 客户端迁移指南

## 从旧版 API 迁移到新版

### 主要变更

1. **模块化结构**：API 按功能拆分为独立模块
2. **类型安全**：完整的 TypeScript 类型支持
3. **统一导出**：从 `@/lib/api` 统一导入
4. **响应格式一致**：所有 API 返回 `ApiResponse<T>`

### 迁移步骤

#### 1. 更新导入路径

**旧版**:
```typescript
import { api } from '@/lib/api';
const response = await api.get('/wallets');
```

**新版**:
```typescript
import { walletApi } from '@/lib/api';
const response = await walletApi.getBalance();
```

#### 2. 类型导入

**旧版**:
```typescript
interface Wallet {
  // 手动定义
}
```

**新版**:
```typescript
import type { Wallet } from '@/lib/api';
```

#### 3. API 调用对照表

| 功能 | 旧版 | 新版 |
|-----|------|------|
| 获取余额 | `api.get('/wallets')` | `walletApi.getBalance()` |
| 登录 | `api.post('/auth/login', data)` | `authApi.login(email, password)` |
| 获取策略 | `api.get('/strategies')` | `strategiesApi.list()` |
| 订阅策略 | `api.post('/strategies/:id/subscribe')` | `strategiesApi.subscribe(id, capital)` |
| 获取持仓 | `api.get('/trading/positions')` | `tradingApi.getPositions()` |
| 创建质押 | `api.post('/gamefi/stake')` | `gamefiApi.stake(type, amount, days)` |

### 完整 API 模块映射

```typescript
// 认证
authApi.login(email, password)
authApi.register(email, password, inviteCode?)
authApi.me()

// 钱包
walletApi.getBalance()
walletApi.getApiKeys()
walletApi.addApiKey(data)
walletApi.verifyApiKey(id)
walletApi.deleteApiKey(id)

// 充值
depositsApi.list(params?)
depositsApi.create(data)
depositsApi.getById(id)

// 提现
withdrawalsApi.list(params?)
withdrawalsApi.create(data)
withdrawalsApi.getById(id)

// 计费
billingApi.getTodayPnL()
billingApi.getPnLCurve(params?)
billingApi.getBillingLogs(params?)

// VPS 实例
instancesApi.list()
instancesApi.get(id)
instancesApi.create(data)
instancesApi.destroy(id)
instancesApi.heartbeat(id, data)

// 策略
strategiesApi.list(params?)
strategiesApi.get(id)
strategiesApi.getMyStrategies()
strategiesApi.subscribe(id, capital)
strategiesApi.unsubscribe(id)
strategiesApi.toggleStatus(id, status)

// 交易
tradingApi.getPositions()
tradingApi.getOrders(params?)
tradingApi.getTrades(limit?)
tradingApi.getBotStatus(instanceId)
tradingApi.startBot(instanceId, strategyId)
tradingApi.stopBot(instanceId)

// GameFi
gamefiApi.getStakes()
gamefiApi.stake(type, amount, lockDays)
gamefiApi.unstake(id)
gamefiApi.getPointsHistory(limit?)
gamefiApi.exchangePoints(points)
gamefiApi.getLeaderboard()
```

### 常见问题

#### Q1: 如何处理 401 错误？
A: 新版 API 自动处理 401，会清除 token 并跳转到登录页 `/sign-in`。

#### Q2: 如何自定义 API 超时时间？
A: 修改 `lib/api/client.ts` 中的 `timeout` 配置。

```typescript
export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 修改这里
  // ...
});
```

#### Q3: 如何使用 Clerk 认证代替 localStorage？
A: 修改 `lib/api/client.ts` 中的 Token 管理部分：

```typescript
import { useAuth } from '@clerk/nextjs';

// 请求拦截器
api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const { getToken } = useAuth();
    const token = await getToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);
```

#### Q4: 响应格式有变化吗？
A: 没有，所有 API 仍返回 `ApiResponse<T>` 格式：

```typescript
interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
  request_id?: string;
}
```

### 测试清单

迁移完成后，确保以下功能正常：

- [ ] 登录/注册功能
- [ ] Token 自动添加到请求头
- [ ] 401 自动跳转登录页
- [ ] 钱包余额获取
- [ ] 策略订阅/取消
- [ ] 交易机器人启停
- [ ] 充值/提现创建
- [ ] 质押/解质押操作

### 性能优化建议

1. **使用 React Query**：缓存服务器状态，减少请求
2. **设置 staleTime**：避免频繁重复请求
3. **使用 refetchInterval**：自动刷新实时数据（持仓、订单等）
4. **乐观更新**：提升用户体验

### 需要帮助？

查看完整文档：
- [API 使用指南](./README.md)
- [使用示例](./EXAMPLES.md)
