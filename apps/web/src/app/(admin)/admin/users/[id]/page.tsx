'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Mail,
  Shield,
  DollarSign,
  Calendar,
  Clock,
  Ban,
  Key,
  LogOut,
  TrendingUp,
  Server,
  CreditCard,
  Activity,
  MapPin,
  Monitor,
} from 'lucide-react';
import { adminApi } from '@/lib/api';

type TabType = 'instances' | 'trades' | 'billing' | 'logs';

export default function UserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const userId = params.id as string;

  const [activeTab, setActiveTab] = useState<TabType>('instances');
  const [showVipModal, setShowVipModal] = useState(false);
  const [newVipLevel, setNewVipLevel] = useState(0);

  // 获取用户详情
  const { data: userRes, isLoading: userLoading } = useQuery({
    queryKey: ['admin', 'user', userId],
    queryFn: () => adminApi.getUserDetail(userId),
  });
  const user = userRes?.data;

  // 获取用户实例
  const { data: instancesRes, isLoading: instancesLoading } = useQuery({
    queryKey: ['admin', 'user', userId, 'instances'],
    queryFn: () => adminApi.getUserInstances(userId),
    enabled: activeTab === 'instances',
  });
  const instances = instancesRes?.data;

  // 获取交易记录
  const { data: tradesRes, isLoading: tradesLoading } = useQuery({
    queryKey: ['admin', 'user', userId, 'trades'],
    queryFn: () => adminApi.getUserTrades(userId),
    enabled: activeTab === 'trades',
  });
  const trades = tradesRes?.data;

  // 获取账单流水
  const { data: billingRes, isLoading: billingLoading } = useQuery({
    queryKey: ['admin', 'user', userId, 'billing'],
    queryFn: () => adminApi.getUserBilling(userId),
    enabled: activeTab === 'billing',
  });
  const billing = billingRes?.data;

  // 获取登录日志
  const { data: logsRes, isLoading: logsLoading } = useQuery({
    queryKey: ['admin', 'user', userId, 'login-logs'],
    queryFn: () => adminApi.getUserLoginLogs(userId),
    enabled: activeTab === 'logs',
  });
  const logs = logsRes?.data;

  // 封禁/解禁用户
  const banMutation = useMutation({
    mutationFn: adminApi.banUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'user', userId] });
      alert('操作成功');
    },
  });

  // 重置密码
  const resetPasswordMutation = useMutation({
    mutationFn: adminApi.resetPassword,
    onSuccess: (res) => {
      alert(`临时密码: ${res.data?.tempPassword}\n请复制并发送给用户`);
    },
  });

  // 调整 VIP 等级
  const updateVipMutation = useMutation({
    mutationFn: ({ userId, vipLevel }: { userId: string; vipLevel: number }) =>
      adminApi.updateUserVip(userId, vipLevel),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'user', userId] });
      setShowVipModal(false);
      alert('VIP 等级调整成功');
    },
  });

  if (userLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-text-secondary">加载中...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="text-text-secondary">用户不存在</div>
        <button
          onClick={() => router.back()}
          className="px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-secondary"
        >
          返回
        </button>
      </div>
    );
  }

  const tabs: { key: TabType; label: string; icon: typeof Server }[] = [
    { key: 'instances', label: 'VPS实例', icon: Server },
    { key: 'trades', label: '交易历史', icon: TrendingUp },
    { key: 'billing', label: '账单流水', icon: CreditCard },
    { key: 'logs', label: '登录日志', icon: Activity },
  ];

  return (
    <div className="space-y-6">
      {/* 返回按钮 */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-text-secondary hover:text-white"
      >
        <ArrowLeft className="w-5 h-5" />
        返回用户列表
      </button>

      {/* 用户信息卡片 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左侧：用户基本信息 */}
        <div className="lg:col-span-2 glass-card p-4">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-brand-primary/10 rounded-full flex items-center justify-center">
                <Mail className="w-8 h-8 text-brand-primary" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">{user.email}</h2>
                <p className="text-text-secondary text-sm mt-1">{user.id}</p>
              </div>
            </div>
            <span
              className={`px-3 py-1 rounded text-sm font-medium ${
                user.status === 'active'
                  ? 'bg-success/10 text-success'
                  : 'bg-danger/10 text-danger'
              }`}
            >
              {user.status === 'active' ? '正常' : '已封禁'}
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-text-secondary text-sm mb-1">VIP 等级</p>
              <p className="text-white font-medium flex items-center gap-1">
                <Shield className="w-4 h-4 text-brand-primary" />
                VIP {user.vipLevel}
              </p>
            </div>
            <div>
              <p className="text-text-secondary text-sm mb-1">余额</p>
              <p className="text-white font-medium flex items-center gap-1">
                <DollarSign className="w-4 h-4 text-success" />
                {user.balance}
              </p>
            </div>
            <div>
              <p className="text-text-secondary text-sm mb-1">注册时间</p>
              <p className="text-white text-sm flex items-center gap-1">
                <Calendar className="w-4 h-4 text-text-secondary" />
                {user.createdAt}
              </p>
            </div>
            <div>
              <p className="text-text-secondary text-sm mb-1">最后登录</p>
              <p className="text-white text-sm flex items-center gap-1">
                <Clock className="w-4 h-4 text-text-secondary" />
                {user.lastLogin}
              </p>
            </div>
          </div>
        </div>

        {/* 右侧：操作按钮 */}
        <div className="glass-card p-4">
          <h3 className="text-white font-medium mb-4">管理操作</h3>
          <div className="space-y-3">
            <button
              onClick={() => banMutation.mutate(userId)}
              className={`w-full px-4 py-3 rounded-lg flex items-center gap-2 ${
                user.status === 'active'
                  ? 'bg-danger/10 text-danger hover:bg-danger/20'
                  : 'bg-success/10 text-success hover:bg-success/20'
              }`}
            >
              <Ban className="w-5 h-5" />
              {user.status === 'active' ? '封禁用户' : '解除封禁'}
            </button>
            <button
              onClick={() => resetPasswordMutation.mutate(userId)}
              className="w-full px-4 py-3 bg-bg-tertiary text-white rounded-lg flex items-center gap-2 hover:bg-bg-tertiary"
            >
              <Key className="w-5 h-5" />
              重置密码
            </button>
            <button
              onClick={() => {
                setNewVipLevel(user.vipLevel);
                setShowVipModal(true);
              }}
              className="w-full px-4 py-3 bg-bg-tertiary text-white rounded-lg flex items-center gap-2 hover:bg-bg-tertiary"
            >
              <Shield className="w-5 h-5" />
              调整VIP等级
            </button>
            <button className="w-full px-4 py-3 bg-bg-tertiary text-white rounded-lg flex items-center gap-2 hover:bg-bg-tertiary">
              <LogOut className="w-5 h-5" />
              强制登出
            </button>
          </div>
        </div>
      </div>

      {/* Tab 导航 */}
      <div className="glass-card overflow-hidden">
        <div className="border-b border-border-primary">
          <div className="flex">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex-1 px-6 py-4 flex items-center justify-center gap-2 ${
                    activeTab === tab.key
                      ? 'text-brand-primary border-b-2 border-brand-primary'
                      : 'text-text-secondary hover:text-white'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab 内容 */}
        <div className="p-6">
          {/* VPS 实例 */}
          {activeTab === 'instances' && (
            <div className="overflow-x-auto">
              {instancesLoading ? (
                <div className="text-center py-8 text-text-secondary">加载中...</div>
              ) : !instances || instances.length === 0 ? (
                <div className="text-center py-8 text-text-secondary">暂无实例</div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border-primary">
                      <th className="px-4 py-3 text-left text-sm font-medium text-text-secondary">实例ID</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-text-secondary">状态</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-text-secondary">IP地址</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-text-secondary">区域</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-text-secondary">创建时间</th>
                    </tr>
                  </thead>
                  <tbody>
                    {instances.map((instance) => (
                      <tr key={instance.id} className="border-b border-border-primary">
                        <td className="px-4 py-3 text-white text-sm">{instance.id}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-1 rounded text-xs ${
                              instance.status === 'running'
                                ? 'bg-success/10 text-success'
                                : 'bg-text-secondary/10 text-text-secondary'
                            }`}
                          >
                            {instance.status === 'running' ? '运行中' : '已停止'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-white text-sm">{instance.ipAddress}</td>
                        <td className="px-4 py-3 text-text-secondary text-sm">{instance.region}</td>
                        <td className="px-4 py-3 text-text-secondary text-sm">{instance.createdAt}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* 交易历史 */}
          {activeTab === 'trades' && (
            <div className="overflow-x-auto">
              {tradesLoading ? (
                <div className="text-center py-8 text-text-secondary">加载中...</div>
              ) : !trades?.data || trades.data.length === 0 ? (
                <div className="text-center py-8 text-text-secondary">暂无交易记录</div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border-primary">
                      <th className="px-4 py-3 text-left text-sm font-medium text-text-secondary">交易对</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-text-secondary">方向</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-text-secondary">数量</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-text-secondary">价格</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-text-secondary">盈亏</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-text-secondary">时间</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trades.data.map((trade) => (
                      <tr key={trade.id} className="border-b border-border-primary">
                        <td className="px-4 py-3 text-white text-sm">{trade.pair}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-1 rounded text-xs ${
                              trade.side === 'buy'
                                ? 'bg-success/10 text-success'
                                : 'bg-danger/10 text-danger'
                            }`}
                          >
                            {trade.side === 'buy' ? '买入' : '卖出'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-white text-sm text-right">{trade.amount}</td>
                        <td className="px-4 py-3 text-white text-sm text-right">{trade.price}</td>
                        <td className="px-4 py-3 text-right">
                          <span
                            className={`text-sm ${
                              parseFloat(trade.pnl) >= 0 ? 'text-success' : 'text-danger'
                            }`}
                          >
                            {parseFloat(trade.pnl) >= 0 ? '+' : ''}
                            {trade.pnl}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-text-secondary text-sm">{trade.executedAt}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* 账单流水 */}
          {activeTab === 'billing' && (
            <div className="overflow-x-auto">
              {billingLoading ? (
                <div className="text-center py-8 text-text-secondary">加载中...</div>
              ) : !billing?.data || billing.data.length === 0 ? (
                <div className="text-center py-8 text-text-secondary">暂无账单记录</div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border-primary">
                      <th className="px-4 py-3 text-left text-sm font-medium text-text-secondary">类型</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-text-secondary">金额</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-text-secondary">描述</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-text-secondary">时间</th>
                    </tr>
                  </thead>
                  <tbody>
                    {billing.data.map((bill) => (
                      <tr key={bill.id} className="border-b border-border-primary">
                        <td className="px-4 py-3">
                          <span className="px-2 py-1 bg-brand-primary/10 text-brand-primary rounded text-xs">
                            {bill.type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-white text-sm text-right">{bill.amount}</td>
                        <td className="px-4 py-3 text-text-secondary text-sm">{bill.description}</td>
                        <td className="px-4 py-3 text-text-secondary text-sm">{bill.createdAt}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* 登录日志 */}
          {activeTab === 'logs' && (
            <div className="overflow-x-auto">
              {logsLoading ? (
                <div className="text-center py-8 text-text-secondary">加载中...</div>
              ) : !logs?.data || logs.data.length === 0 ? (
                <div className="text-center py-8 text-text-secondary">暂无登录记录</div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border-primary">
                      <th className="px-4 py-3 text-left text-sm font-medium text-text-secondary">IP 地址</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-text-secondary">设备</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-text-secondary">位置</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-text-secondary">时间</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.data.map((log) => (
                      <tr key={log.id} className="border-b border-border-primary">
                        <td className="px-4 py-3 text-white text-sm">{log.ip}</td>
                        <td className="px-4 py-3 text-text-secondary text-sm flex items-center gap-2">
                          <Monitor className="w-4 h-4" />
                          {log.device}
                        </td>
                        <td className="px-4 py-3 text-text-secondary text-sm flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          {log.location}
                        </td>
                        <td className="px-4 py-3 text-text-secondary text-sm">{log.createdAt}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </div>

      {/* VIP 等级调整弹窗 */}
      {showVipModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-bg-secondary rounded-xl p-6 w-full max-w-md border border-border-primary">
            <h3 className="text-lg font-semibold text-white mb-4">调整 VIP 等级</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-text-secondary text-sm mb-2">当前等级: VIP {user.vipLevel}</label>
                <select
                  value={newVipLevel}
                  onChange={(e) => setNewVipLevel(Number(e.target.value))}
                  className="w-full px-4 py-3 bg-bg-tertiary border border-border-primary rounded-lg text-white focus:outline-none focus:border-brand-primary"
                >
                  <option value={0}>VIP 0 (普通用户)</option>
                  <option value={1}>VIP 1</option>
                  <option value={2}>VIP 2</option>
                  <option value={3}>VIP 3</option>
                  <option value={4}>VIP 4</option>
                  <option value={5}>VIP 5 (至尊)</option>
                </select>
              </div>
            </div>
            <div className="flex gap-4 mt-6">
              <button
                onClick={() => setShowVipModal(false)}
                className="flex-1 px-4 py-2 bg-bg-tertiary text-white rounded-lg hover:bg-bg-tertiary"
              >
                取消
              </button>
              <button
                onClick={() => updateVipMutation.mutate({ userId, vipLevel: newVipLevel })}
                className="flex-1 px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-secondary"
              >
                确认调整
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
