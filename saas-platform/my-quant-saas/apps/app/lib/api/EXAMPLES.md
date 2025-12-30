# API 使用示例集合

## 快速开始

### 1. 基础导入

```typescript
// 在任何组件中导入
import {
  authApi,
  walletApi,
  strategiesApi,
  tradingApi,
  gamefiApi,
  billingApi,
  instancesApi,
  depositsApi,
  withdrawalsApi,
  setToken,
  getToken,
  removeToken,
} from '@/lib/api';

// 导入类型
import type { User, Wallet, Strategy, Trade } from '@/lib/api';
```

### 2. 登录流程完整示例

```typescript
'use client';

import { useState } from 'react';
import { authApi, setToken } from '@/lib/api';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await authApi.login(email, password);

      // 保存 token
      setToken(response.data.access_token);

      // 跳转到仪表盘
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleLogin}>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="邮箱"
        required
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="密码"
        required
      />
      {error && <p className="text-red-500">{error}</p>}
      <button type="submit" disabled={loading}>
        {loading ? '登录中...' : '登录'}
      </button>
    </form>
  );
}
```

### 3. 钱包余额展示（带 React Query）

```typescript
'use client';

import { useQuery } from '@tanstack/react-query';
import { walletApi } from '@/lib/api';

export default function WalletBalance() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['wallet'],
    queryFn: () => walletApi.getBalance(),
    refetchInterval: 10000, // 每 10 秒刷新
  });

  if (isLoading) {
    return <div>加载中...</div>;
  }

  if (error) {
    return (
      <div className="text-red-500">
        错误: {error.message}
        <button onClick={() => refetch()}>重试</button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <h3>USDT 余额</h3>
        <p className="text-2xl">{data?.data.usdt_balance}</p>
      </div>
      <div className="card">
        <h3>积分余额</h3>
        <p className="text-2xl">{data?.data.point_balance}</p>
      </div>
      <div className="card">
        <h3>冻结金额</h3>
        <p className="text-2xl">{data?.data.frozen_balance}</p>
      </div>
    </div>
  );
}
```

### 4. 策略订阅（带状态管理）

```typescript
'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { strategiesApi } from '@/lib/api';
import type { Strategy } from '@/lib/api';
import { toast } from 'sonner';

interface StrategyCardProps {
  strategy: Strategy;
}

export function StrategyCard({ strategy }: StrategyCardProps) {
  const queryClient = useQueryClient();

  const subscribeMutation = useMutation({
    mutationFn: (allocatedCapital: string) =>
      strategiesApi.subscribe(strategy.id, allocatedCapital),
    onSuccess: () => {
      toast.success('订阅成功');
      // 刷新我的策略列表
      queryClient.invalidateQueries({ queryKey: ['my-strategies'] });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleSubscribe = () => {
    const capital = prompt('请输入分配资金（USDT）:');
    if (capital) {
      subscribeMutation.mutate(capital);
    }
  };

  return (
    <div className="card">
      <h3>{strategy.name}</h3>
      <p>{strategy.description}</p>
      <div className="flex gap-4">
        <span>风险等级: {strategy.risk_level}</span>
        <span>预期收益: {strategy.expected_return}</span>
        <span>胜率: {strategy.win_rate}</span>
      </div>
      <button
        onClick={handleSubscribe}
        disabled={subscribeMutation.isPending}
      >
        {subscribeMutation.isPending ? '订阅中...' : '立即订阅'}
      </button>
    </div>
  );
}
```

### 5. 实时交易监控

```typescript
'use client';

import { useQuery } from '@tanstack/react-query';
import { tradingApi } from '@/lib/api';

export function TradingMonitor({ instanceId }: { instanceId: string }) {
  // 获取机器人状态（每 5 秒刷新）
  const { data: status } = useQuery({
    queryKey: ['bot-status', instanceId],
    queryFn: () => tradingApi.getBotStatus(instanceId),
    refetchInterval: 5000,
  });

  // 获取持仓（每 3 秒刷新）
  const { data: positions } = useQuery({
    queryKey: ['positions'],
    queryFn: () => tradingApi.getPositions(),
    refetchInterval: 3000,
  });

  // 获取最近交易（每 10 秒刷新）
  const { data: trades } = useQuery({
    queryKey: ['trades'],
    queryFn: () => tradingApi.getTrades(20),
    refetchInterval: 10000,
  });

  return (
    <div className="space-y-6">
      {/* 机器人状态 */}
      <div className="card">
        <h3>机器人状态</h3>
        <div className="flex items-center gap-2">
          <div
            className={`h-3 w-3 rounded-full ${
              status?.data.running ? 'bg-green-500' : 'bg-red-500'
            }`}
          />
          <span>{status?.data.running ? '运行中' : '已停止'}</span>
        </div>
        {status?.data.running && (
          <>
            <p>运行时长: {Math.floor((status.data.uptime || 0) / 60)} 分钟</p>
            <p>今日交易: {status.data.trades_today} 笔</p>
          </>
        )}
      </div>

      {/* 持仓列表 */}
      <div className="card">
        <h3>当前持仓</h3>
        {positions?.data.length === 0 ? (
          <p>暂无持仓</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>交易对</th>
                <th>方向</th>
                <th>数量</th>
                <th>开仓价</th>
                <th>当前价</th>
                <th>浮动盈亏</th>
              </tr>
            </thead>
            <tbody>
              {positions?.data.map((pos) => (
                <tr key={pos.id}>
                  <td>{pos.symbol}</td>
                  <td>{pos.side}</td>
                  <td>{pos.size}</td>
                  <td>{pos.entry_price}</td>
                  <td>{pos.current_price}</td>
                  <td
                    className={
                      parseFloat(pos.unrealized_pnl) >= 0
                        ? 'text-green-500'
                        : 'text-red-500'
                    }
                  >
                    {pos.unrealized_pnl}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 交易历史 */}
      <div className="card">
        <h3>最近交易</h3>
        {trades?.data.map((trade) => (
          <div key={trade.id} className="flex justify-between py-2 border-b">
            <div>
              <span className="font-bold">{trade.symbol}</span>
              <span className="ml-2 text-gray-500">{trade.side}</span>
            </div>
            <div>
              <span>{trade.size} @ {trade.price}</span>
              <span
                className={`ml-4 ${
                  parseFloat(trade.pnl) >= 0 ? 'text-green-500' : 'text-red-500'
                }`}
              >
                {trade.pnl}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### 6. GameFi 质押操作

```typescript
'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { gamefiApi } from '@/lib/api';
import { toast } from 'sonner';

export function StakingPanel() {
  const [stakeType, setStakeType] = useState<'A' | 'B'>('A');
  const [amount, setAmount] = useState('');
  const [lockDays, setLockDays] = useState(30);

  const queryClient = useQueryClient();

  // 获取质押列表
  const { data: stakes } = useQuery({
    queryKey: ['stakes'],
    queryFn: () => gamefiApi.getStakes(),
  });

  // 创建质押
  const stakeMutation = useMutation({
    mutationFn: () => gamefiApi.stake(stakeType, amount, lockDays),
    onSuccess: () => {
      toast.success('质押成功');
      setAmount('');
      queryClient.invalidateQueries({ queryKey: ['stakes'] });
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // 解除质押
  const unstakeMutation = useMutation({
    mutationFn: (stakeId: string) => gamefiApi.unstake(stakeId),
    onSuccess: () => {
      toast.success('解除质押成功');
      queryClient.invalidateQueries({ queryKey: ['stakes'] });
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  return (
    <div className="space-y-6">
      {/* 质押表单 */}
      <div className="card">
        <h3>创建质押</h3>

        {/* 类型选择 */}
        <div className="flex gap-4">
          <label>
            <input
              type="radio"
              value="A"
              checked={stakeType === 'A'}
              onChange={() => setStakeType('A')}
            />
            A 类质押（无锁定，1.0x 权重）
          </label>
          <label>
            <input
              type="radio"
              value="B"
              checked={stakeType === 'B'}
              onChange={() => setStakeType('B')}
            />
            B 类质押（锁定期，最高 3.0x 权重）
          </label>
        </div>

        {/* 金额输入 */}
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="质押金额（USDT）"
          min="0"
          step="0.00000001"
        />

        {/* 锁定期选择（仅 B 类） */}
        {stakeType === 'B' && (
          <div>
            <label>锁定天数: {lockDays} 天</label>
            <input
              type="range"
              min="30"
              max="365"
              value={lockDays}
              onChange={(e) => setLockDays(Number(e.target.value))}
            />
            <p className="text-sm text-gray-500">
              权重: {Math.min(1 + lockDays / 180, 3).toFixed(2)}x
            </p>
          </div>
        )}

        <button
          onClick={() => stakeMutation.mutate()}
          disabled={!amount || stakeMutation.isPending}
        >
          {stakeMutation.isPending ? '质押中...' : '确认质押'}
        </button>
      </div>

      {/* 质押列表 */}
      <div className="card">
        <h3>我的质押</h3>
        {stakes?.data.length === 0 ? (
          <p>暂无质押记录</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>类型</th>
                <th>金额</th>
                <th>锁定天数</th>
                <th>权重</th>
                <th>解锁时间</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {stakes?.data.map((stake) => (
                <tr key={stake.id}>
                  <td>{stake.stake_type}</td>
                  <td>{stake.amount}</td>
                  <td>{stake.lock_days}</td>
                  <td>{stake.weight}x</td>
                  <td>{new Date(stake.unlocks_at).toLocaleDateString()}</td>
                  <td>{stake.status}</td>
                  <td>
                    {stake.status === 'active' &&
                      new Date(stake.unlocks_at) <= new Date() && (
                        <button
                          onClick={() => unstakeMutation.mutate(stake.id)}
                          disabled={unstakeMutation.isPending}
                        >
                          解除质押
                        </button>
                      )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
```

### 7. 盈亏曲线图表

```typescript
'use client';

import { useQuery } from '@tanstack/react-query';
import { billingApi } from '@/lib/api';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export function PnLChart({ days = 30 }: { days?: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ['pnl-curve', days],
    queryFn: () => billingApi.getPnLCurve({ days }),
  });

  if (isLoading) {
    return <div>加载中...</div>;
  }

  // 转换数据格式
  const chartData = data?.data.curve.map((item) => ({
    date: new Date(item.date).toLocaleDateString(),
    累计盈亏: parseFloat(item.cumulativePnl),
    单日盈亏: parseFloat(item.pnl),
  }));

  return (
    <div className="card">
      <div className="flex justify-between items-center mb-4">
        <h3>盈亏曲线</h3>
        <div className="text-right">
          <p className="text-sm text-gray-500">总盈亏</p>
          <p
            className={`text-2xl ${
              parseFloat(data?.data.totalPnl || '0') >= 0
                ? 'text-green-500'
                : 'text-red-500'
            }`}
          >
            {data?.data.totalPnl} USDT
          </p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData}>
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip />
          <Line
            type="monotone"
            dataKey="累计盈亏"
            stroke="#3b82f6"
            strokeWidth={2}
          />
          <Line
            type="monotone"
            dataKey="单日盈亏"
            stroke="#10b981"
            strokeWidth={1}
            strokeDasharray="5 5"
          />
        </LineChart>
      </ResponsiveContainer>

      <p className="text-sm text-gray-500 mt-2">
        最大回撤: {data?.data.maxDrawdown}
      </p>
    </div>
  );
}
```

## 最佳实践

### 1. 使用 React Query 管理服务器状态

```typescript
// hooks/useWallet.ts
import { useQuery } from '@tanstack/react-query';
import { walletApi } from '@/lib/api';

export function useWallet() {
  return useQuery({
    queryKey: ['wallet'],
    queryFn: () => walletApi.getBalance(),
    staleTime: 5000, // 5 秒内不重新请求
    refetchInterval: 10000, // 每 10 秒自动刷新
  });
}

// 使用
function MyComponent() {
  const { data, isLoading, error } = useWallet();
  // ...
}
```

### 2. 统一错误处理

```typescript
// lib/error-handler.ts
import { toast } from 'sonner';

export function handleApiError(error: unknown) {
  if (error instanceof Error) {
    toast.error(error.message);
  } else {
    toast.error('请求失败，请稍后重试');
  }
}

// 使用
try {
  await walletApi.getBalance();
} catch (error) {
  handleApiError(error);
}
```

### 3. 乐观更新

```typescript
const mutation = useMutation({
  mutationFn: (data) => strategiesApi.subscribe(strategyId, data.capital),
  onMutate: async (variables) => {
    // 取消正在进行的查询
    await queryClient.cancelQueries({ queryKey: ['my-strategies'] });

    // 保存当前值
    const previous = queryClient.getQueryData(['my-strategies']);

    // 乐观更新
    queryClient.setQueryData(['my-strategies'], (old) => {
      // 更新逻辑
    });

    return { previous };
  },
  onError: (err, variables, context) => {
    // 回滚
    queryClient.setQueryData(['my-strategies'], context?.previous);
  },
  onSettled: () => {
    // 重新获取
    queryClient.invalidateQueries({ queryKey: ['my-strategies'] });
  },
});
```
