# QuantFi API 客户端使用指南

## 目录结构

```
apps/app/lib/api/
├── index.ts          # 统一导出
├── client.ts         # axios 实例配置
├── types.ts          # TypeScript 类型定义
├── auth.ts           # 认证 API
├── wallet.ts         # 钱包 API
├── deposits.ts       # 充值 API
├── withdrawals.ts    # 提现 API
├── billing.ts        # 计费 API
├── instances.ts      # VPS 实例 API
├── strategies.ts     # 策略 API
├── trading.ts        # 交易 API
└── gamefi.ts         # GameFi API
```

## 环境配置

### 1. 复制环境变量模板

```bash
cp .env.example .env.local
```

### 2. 配置 API 地址

```env
# .env.local
NEXT_PUBLIC_API_URL=http://localhost:4001/api
```

## 基础使用

### 导入方式

```typescript
// 方式 1: 导入特定 API
import { authApi, walletApi, tradingApi } from '@/lib/api';

// 方式 2: 导入所有
import * as api from '@/lib/api';

// 方式 3: 导入类型
import type { ApiResponse, User, Wallet } from '@/lib/api';
```

### Token 管理

```typescript
import { setToken, getToken, removeToken } from '@/lib/api';

// 登录后保存 token
const { data } = await authApi.login(email, password);
setToken(data.access_token);

// 获取当前 token
const token = getToken();

// 退出登录
removeToken();
```

## API 模块使用示例

### 1. 认证模块 (authApi)

```typescript
import { authApi } from '@/lib/api';

// 用户登录
try {
  const response = await authApi.login('user@example.com', 'password123');
  console.log('Token:', response.data.access_token);
} catch (error) {
  console.error('登录失败:', error.message);
}

// 用户注册
const response = await authApi.register(
  'user@example.com',
  'password123',
  'INVITE_CODE' // 可选
);

// 获取当前用户信息
const { data: user } = await authApi.me();
console.log('当前用户:', user);
```

### 2. 钱包模块 (walletApi)

```typescript
import { walletApi } from '@/lib/api';

// 获取钱包余额
const { data: wallet } = await walletApi.getBalance();
console.log('USDT 余额:', wallet.usdt_balance);
console.log('积分余额:', wallet.point_balance);

// 获取 API Keys
const { data: keys } = await walletApi.getApiKeys();

// 添加 API Key
await walletApi.addApiKey({
  exchange: 'binance',
  label: '我的币安账户',
  apiKey: 'xxx',
  secretKey: 'xxx',
  passphrase: 'xxx', // 可选
});

// 验证 API Key
const { data: verification } = await walletApi.verifyApiKey(keyId);
if (verification.valid) {
  console.log('余额:', verification.balances);
}
```

### 3. 充值/提现模块

```typescript
import { depositsApi, withdrawalsApi } from '@/lib/api';

// 创建充值订单
const { data: deposit } = await depositsApi.create({
  amount: '100.00000000',
  method: 'USDT-TRC20',
});

// 获取充值记录
const { data: deposits } = await depositsApi.list();

// 创建提现订单
const { data: withdrawal } = await withdrawalsApi.create({
  amount: '50.00000000',
  chain: 'TRC20',
  toAddress: 'Txxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
});

// 获取提现记录
const { data: withdrawals } = await withdrawalsApi.list();
```

### 4. VPS 实例模块 (instancesApi)

```typescript
import { instancesApi } from '@/lib/api';

// 获取实例列表
const { data: instances } = await instancesApi.list();

// 创建新实例
const { data: instance } = await instancesApi.create({
  region: 'sgp1',
  strategyId: 'strategy-id', // 可选
});

// 获取实例详情
const { data: detail } = await instancesApi.get(instanceId);

// 发送心跳
await instancesApi.heartbeat(instanceId, {
  cpu_usage: '45.2',
  memory_usage: '67.8',
});

// 销毁实例
await instancesApi.destroy(instanceId);
```

### 5. 计费模块 (billingApi)

```typescript
import { billingApi } from '@/lib/api';

// 获取今日盈亏
const { data: todayPnL } = await billingApi.getTodayPnL();
console.log('今日盈亏:', todayPnL.todayPnl);
console.log('今日盈利:', todayPnL.todayProfit);
console.log('今日手续费:', todayPnL.todayGasFee);

// 获取盈亏曲线
const { data: curve } = await billingApi.getPnLCurve({ days: 30 });
console.log('总盈亏:', curve.totalPnl);
console.log('最大回撤:', curve.maxDrawdown);

// 获取账单明细
const { data: logs } = await billingApi.getBillingLogs({
  type: 'subscription', // 可选：筛选类型
  page: 1,
  limit: 50,
});
```

### 6. 策略模块 (strategiesApi)

```typescript
import { strategiesApi } from '@/lib/api';

// 获取策略市场列表
const { data: strategies } = await strategiesApi.list({
  type: 'grid', // 可选：策略类型
  risk_level: 'medium', // 可选：风险等级
});

// 获取策略详情
const { data: strategy } = await strategiesApi.get(strategyId);

// 订阅策略
await strategiesApi.subscribe(strategyId, '1000.00000000');

// 获取我的策略
const { data: myStrategies } = await strategiesApi.getMyStrategies();

// 启用/暂停策略
await strategiesApi.toggleStatus(subscriptionId, 'paused');

// 取消订阅
await strategiesApi.unsubscribe(subscriptionId);
```

### 7. 交易模块 (tradingApi)

```typescript
import { tradingApi } from '@/lib/api';

// 获取持仓列表
const { data: positions } = await tradingApi.getPositions();

// 获取订单列表
const { data: orders } = await tradingApi.getOrders({
  status: 'open', // 可选：筛选状态
  limit: 50,
});

// 获取交易历史
const { data: trades } = await tradingApi.getTrades(100);

// 获取机器人状态
const { data: status } = await tradingApi.getBotStatus(instanceId);
console.log('运行状态:', status.running);

// 启动机器人
await tradingApi.startBot(instanceId, strategyId);

// 停止机器人
await tradingApi.stopBot(instanceId);
```

### 8. GameFi 模块 (gamefiApi)

```typescript
import { gamefiApi } from '@/lib/api';

// 获取质押列表
const { data: stakes } = await gamefiApi.getStakes();

// 创建质押
await gamefiApi.stake({
  type: 'B', // A 或 B
  amount: '500.00000000',
  lockDays: 90,
});

// 解除质押
await gamefiApi.unstake(stakeId);

// 获取积分历史
const { data: history } = await gamefiApi.getPointsHistory(50);

// 积分兑换 USDT
const { data: result } = await gamefiApi.exchangePoints(1000);
console.log('兑换得到 USDT:', result.usdt);

// 获取排行榜
const { data: leaderboard } = await gamefiApi.getLeaderboard();
```

## React Query 集成示例

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { walletApi, tradingApi } from '@/lib/api';

// 查询钱包余额
function useWallet() {
  return useQuery({
    queryKey: ['wallet'],
    queryFn: () => walletApi.getBalance(),
  });
}

// 查询交易历史
function useTrades() {
  return useQuery({
    queryKey: ['trades'],
    queryFn: () => tradingApi.getTrades(50),
  });
}

// 启动机器人（变更操作）
function useStartBot() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ instanceId, strategyId }: { instanceId: string; strategyId: string }) =>
      tradingApi.startBot(instanceId, strategyId),
    onSuccess: () => {
      // 刷新机器人状态
      queryClient.invalidateQueries({ queryKey: ['bot-status'] });
    },
  });
}

// 使用示例
function Dashboard() {
  const { data: wallet, isLoading, error } = useWallet();
  const startBot = useStartBot();

  if (isLoading) return <div>加载中...</div>;
  if (error) return <div>错误: {error.message}</div>;

  return (
    <div>
      <p>USDT 余额: {wallet?.data.usdt_balance}</p>
      <button
        onClick={() =>
          startBot.mutate({ instanceId: 'xxx', strategyId: 'yyy' })
        }
      >
        启动机器人
      </button>
    </div>
  );
}
```

## 错误处理

所有 API 调用失败时都会抛出错误，建议使用 try-catch 捕获：

```typescript
try {
  const { data } = await walletApi.getBalance();
  console.log('余额:', data.usdt_balance);
} catch (error) {
  if (error instanceof Error) {
    console.error('请求失败:', error.message);
  }
}
```

## 类型支持

所有 API 都有完整的 TypeScript 类型支持：

```typescript
import type {
  User,
  Wallet,
  Instance,
  Strategy,
  Trade,
  Position,
  Stake,
} from '@/lib/api';

const wallet: Wallet = {
  id: 'xxx',
  usdt_balance: '1000.00000000',
  point_balance: '5000.00000000',
  frozen_balance: '0.00000000',
};
```

## 注意事项

1. **Token 自动管理**: 所有需要认证的请求会自动添加 Bearer Token
2. **401 自动跳转**: Token 失效时会自动跳转到登录页
3. **超时设置**: 默认请求超时 30 秒
4. **错误格式**: 统一返回 Error 对象，message 为后端返回的错误信息
5. **金额格式**: 所有金额字段使用字符串，精度为 8 位小数

## 生产环境配置

```env
# .env.production
NEXT_PUBLIC_API_URL=https://api.quantfi.com/api
```
