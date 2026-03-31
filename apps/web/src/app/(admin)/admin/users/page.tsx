'use client';

import { useState } from 'react';
import {
  Users,
  BarChart3,
  UserCheck,
  UserPlus,
  Ban,
  CheckCircle,
  Wallet,
  KeyRound,
  MessageSquare,
  X,
  Loader2,
  Pencil,
  History,
  Layers,
  TrendingUp,
  Mail,
  Phone,
  ShieldOff,
  ShieldCheck,
  Copy,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  AdminPageHeader,
  AdminSkeleton,
  AdminErrorState,
  AdminEmptyState,
  AdminTable,
  AdminPagination,
  AdminStatCard,
  AdminSearchBar,
  AdminConfirmDialog,
  AdminTabs,
  AdminStatusBadge,
  AdminColumn,
} from '@/components/admin/shared';
import { useAdminApi, useAdminList, useAdminMutation } from '@/hooks/useAdminApi';
import { adminApi } from '@/lib/admin-auth';

// ─────────────────────────── 类型 ───────────────────────────

interface UserItem {
  id: string;
  uid?: number;
  userCode?: string;
  email: string;
  nickname: string;
  status: string;
  usdtBalance: string;
  hootBalance: string;
  pointBalance: string;
  membershipStatus?: string;
  membershipExpireAt?: string | null;
  telegramUsername?: string;
  walletAddress?: string;
  lastLoginIp?: string | null;
  lastLoginAt?: string | null;
  createdAt: string;
}

interface UserDetail extends UserItem {
  phone?: string;
  apiKeys?: { id: string; exchange: string; label?: string; isActive: boolean; createdAt: string }[];
  subscriptions?: {
    id: string;
    status: string;
    startAt: string;
    expireAt?: string;
    strategy?: { id: string; name: string };
  }[];
  positions?: {
    id: string;
    exchange: string;
    symbol: string;
    side: string;
    status: string;
    entryPrice: string;
    amount: string;
    closePrice?: string;
    pnl?: string;
    closeReason?: string;
    createdAt: string;
    closedAt?: string;
  }[];
  transactions?: {
    id: string;
    type: string;
    amount: string;
    status: string;
    createdAt: string;
    description?: string;
  }[];
}

interface UserStats {
  totalUsers: number;
  activeToday: number;
  newToday: number;
  newThisWeek: number;
}

interface TrendItem {
  date: string;
  count: number;
}

interface AssetItem {
  range: string;
  count: number;
}

interface SourceItem {
  source: string;
  count: number;
}

// ─────────────────────────── 用户详情对话框 ───────────────────────────

const DETAIL_TABS = [
  { key: 'info', label: '基本信息' },
  { key: 'edit', label: '编辑用户' },
  { key: 'invitees', label: '下级用户' },
  { key: 'subscriptions', label: '订阅记录' },
  { key: 'positions', label: '持仓记录' },
  { key: 'transactions', label: '交易流水' },
  { key: 'actions', label: '操作' },
];

function UserDetailDialog({
  userId,
  onClose,
  onChanged,
}: {
  userId: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { data: user, loading, error, refetch } = useAdminApi<UserDetail>(
    `/admin/users/${userId}`,
    { enabled: !!userId }
  );
  const { mutate, loading: mutLoading } = useAdminMutation({ onSuccess: () => { refetch(); onChanged(); } });

  const [activeTab, setActiveTab] = useState('info');

  // 余额调整 state
  const [balanceOpen, setBalanceOpen] = useState(false);
  const [balanceType, setBalanceType] = useState<'usdt' | 'hoot'>('usdt');
  const [balanceAction, setBalanceAction] = useState<'adjust' | 'deduct'>('adjust');
  const [balanceAmount, setBalanceAmount] = useState('');
  const [balanceReason, setBalanceReason] = useState('');
  const [balanceLoading, setBalanceLoading] = useState(false);

  // 确认对话框
  const [confirmDialog, setConfirmDialog] = useState<
    null | 'reset-password' | 'unbind-tg' | 'unbind-wallet'
  >(null);

  // 昵称编辑
  const [editNickname, setEditNickname] = useState('');
  const [nicknameOpen, setNicknameOpen] = useState(false);
  const [nicknameLoading, setNicknameLoading] = useState(false);

  // 用户编辑表单
  const [editForm, setEditForm] = useState({ email: '', phone: '', nickname: '' });
  const [editLoading, setEditLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);

  const handleBalanceSubmit = async () => {
    if (!balanceAmount || isNaN(parseFloat(balanceAmount))) {
      toast.error('请输入有效金额');
      return;
    }
    if (!balanceReason.trim()) {
      toast.error('请填写调整原因');
      return;
    }
    setBalanceLoading(true);
    try {
      await adminApi.post(`/admin/users/${userId}/adjust-balance`, {
        asset: balanceType,
        action: balanceAction === 'adjust' ? 'add' : 'subtract',
        amount: balanceAmount,
        reason: balanceReason.trim(),
      });
      toast.success('余额调整成功');
      setBalanceOpen(false);
      setBalanceAmount('');
      setBalanceReason('');
      refetch();
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '操作失败');
    } finally {
      setBalanceLoading(false);
    }
  };

  const handleNicknameSave = async () => {
    if (!editNickname.trim()) { toast.error('昵称不能为空'); return; }
    setNicknameLoading(true);
    try {
      await adminApi.put(`/admin/users/${userId}`, { nickname: editNickname.trim() });
      toast.success('昵称修改成功');
      setNicknameOpen(false);
      refetch();
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '修改失败');
    } finally {
      setNicknameLoading(false);
    }
  };

  const handleEditSave = async () => {
    setEditLoading(true);
    try {
      const payload: Record<string, string> = {};
      if (editForm.email.trim()) payload.email = editForm.email.trim();
      if (editForm.phone.trim()) payload.phone = editForm.phone.trim();
      if (editForm.nickname.trim()) payload.nickname = editForm.nickname.trim();
      if (Object.keys(payload).length === 0) { toast.error('请填写要修改的信息'); setEditLoading(false); return; }
      await adminApi.put(`/admin/users/${userId}`, payload);
      toast.success('用户信息修改成功');
      setEditForm({ email: '', phone: '', nickname: '' });
      refetch();
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '修改失败');
    } finally {
      setEditLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: 'active' | 'suspended' | 'banned') => {
    setStatusLoading(true);
    try {
      await adminApi.put(`/admin/users/${userId}/status`, { status: newStatus });
      toast.success(`状态已更新为：${newStatus === 'active' ? '正常' : newStatus === 'suspended' ? '冻结' : '封禁'}`);
      refetch();
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '操作失败');
    } finally {
      setStatusLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!confirmDialog) return;
    const pathMap = {
      'reset-password': [`/admin/users/${userId}/reset-password`, 'post'] as const,
      'unbind-tg': [`/admin/users/${userId}/unbind-telegram`, 'delete'] as const,
      'unbind-wallet': [`/admin/users/${userId}/unbind-wallet`, 'delete'] as const,
    };
    const [path, method] = pathMap[confirmDialog];
    await mutate(path, method);
    setConfirmDialog(null);
  };

  const inputCls = 'w-full px-3 py-2 bg-[#0A0A0F] border border-[#1E1E2E] rounded-lg text-sm text-white placeholder-[#9090A0] focus:outline-none focus:border-cyan-500/50';

  const pnlColor = (v?: string) => {
    if (!v) return 'text-[#9090A0]';
    const n = parseFloat(v);
    return n > 0 ? 'text-green-400' : n < 0 ? 'text-red-400' : 'text-[#9090A0]';
  };

  const TX_TYPE: Record<string, string> = {
    deposit: '充值', withdraw: '提现', admin_adjust: '管理调整',
    subscription: '订阅扣费', gas_fee: '燃油费', transfer: '转账', point_card: 'GAS充值',
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#12121A] border border-[#1E1E2E] rounded-xl w-full max-w-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1E1E2E]">
          <h3 className="text-base font-semibold text-white">
            用户详情
            {user && <span className="text-xs text-[#9090A0] ml-2 font-normal">{user.email}</span>}
          </h3>
          <button onClick={onClose} className="text-[#9090A0] hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Tab 切换 */}
        <div className="flex border-b border-[#1E1E2E] overflow-x-auto">
          {DETAIL_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`shrink-0 px-4 py-2.5 text-xs font-medium transition-colors border-b-2 ${
                activeTab === t.key
                  ? 'text-cyan-400 border-cyan-400'
                  : 'text-[#9090A0] border-transparent hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* 内容 */}
        <div className="p-6 max-h-[60vh] overflow-y-auto">
          {loading && <div className="py-8 text-center text-[#9090A0] text-sm">加载中...</div>}
          {error && <div className="py-4 text-center text-red-400 text-sm">{error}</div>}

          {user && (
            <>
              {/* Tab: 基本信息 */}
              {activeTab === 'info' && (
                <div className="space-y-2 text-sm">
                  {[
                    ['短 ID', user.uid ? `USR${user.uid}` : '-'],
                    ['邮箱', user.email],
                    ['昵称', user.nickname || '-'],
                    ['手机', (user as UserDetail).phone || '未填写'],
                    ['状态', <AdminStatusBadge key="s" status={user.status} />],
                    ['USDT 余额', `${parseFloat(user.usdtBalance).toFixed(2)} USDT`],
                    ['HOOT 余额', `${parseFloat(user.hootBalance).toFixed(4)} HOOT`],
                    ['GAS 余额', `${parseFloat(user.pointBalance || '0').toFixed(2)}`],
                    ['TG 用户名', user.telegramUsername || '未绑定'],
                    ['钱包地址', user.walletAddress ? `${user.walletAddress.slice(0, 10)}...${user.walletAddress.slice(-6)}` : '未绑定'],
                    ['API Key 数', `${(user as UserDetail).apiKeys?.length ?? 0} 个`],
                    ['注册时间', new Date(user.createdAt).toLocaleString('zh-CN')],
                  ].map(([label, val]) => (
                    <div key={String(label)} className="flex items-center gap-3 py-1 border-b border-[#1E1E2E]/50 last:border-0">
                      <span className="w-24 text-[#9090A0] shrink-0">{label}</span>
                      <span className="text-white">{val}</span>
                    </div>
                  ))}
                  <div className="flex items-start gap-3 pt-1 border-t border-[#1E1E2E]">
                    <span className="w-24 text-[#9090A0] shrink-0 text-xs pt-0.5">用户 UUID</span>
                    <span
                      className="text-[#64748B] text-xs font-mono break-all cursor-pointer hover:text-[#9090A0] transition-colors"
                      title="点击复制"
                      onClick={() => { navigator.clipboard.writeText(user.id); toast.success('已复制'); }}
                    >
                      {user.id}
                    </span>
                  </div>
                </div>
              )}

              {/* Tab: 下级用户 */}
              {activeTab === 'invitees' && <InviteesTab userId={userId} />}

              {/* Tab: 编辑用户 */}
              {activeTab === 'edit' && (
                <div className="space-y-5">
                  {/* 修改基本信息 */}
                  <div className="bg-[#0A0A0F] border border-[#1E1E2E] rounded-xl p-4 space-y-3">
                    <p className="text-xs font-medium text-[#9090A0] mb-3">修改用户信息（留空表示不修改）</p>
                    <div>
                      <label className="block text-xs text-[#9090A0] mb-1">
                        <Mail size={11} className="inline mr-1" />新邮箱
                      </label>
                      <input
                        type="email"
                        value={editForm.email}
                        onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                        placeholder={`当前: ${user.email}`}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[#9090A0] mb-1">
                        <Phone size={11} className="inline mr-1" />手机号
                      </label>
                      <input
                        type="tel"
                        value={editForm.phone}
                        onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                        placeholder={`当前: ${(user as UserDetail).phone || '未填写'}`}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[#9090A0] mb-1">
                        <Pencil size={11} className="inline mr-1" />昵称
                      </label>
                      <input
                        type="text"
                        value={editForm.nickname}
                        onChange={(e) => setEditForm({ ...editForm, nickname: e.target.value })}
                        placeholder={`当前: ${user.nickname || '未设置'}`}
                        maxLength={32}
                        className={inputCls}
                      />
                    </div>
                    <button
                      onClick={handleEditSave}
                      disabled={editLoading}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {editLoading && <Loader2 size={14} className="animate-spin" />}
                      保存修改
                    </button>
                  </div>

                  {/* 账号状态管理 */}
                  <div className="bg-[#0A0A0F] border border-[#1E1E2E] rounded-xl p-4">
                    <p className="text-xs font-medium text-[#9090A0] mb-3">账号状态管理</p>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs text-[#9090A0] w-20">当前状态</span>
                      <AdminStatusBadge status={user.status} />
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-3">
                      <button
                        onClick={() => handleStatusChange('active')}
                        disabled={statusLoading || user.status === 'active'}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 bg-green-500/10 hover:bg-green-500/20 text-green-400 text-xs rounded-lg border border-green-500/20 transition-colors disabled:opacity-40"
                      >
                        <ShieldCheck size={12} />正常
                      </button>
                      <button
                        onClick={() => handleStatusChange('suspended')}
                        disabled={statusLoading || user.status === 'suspended'}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 text-xs rounded-lg border border-yellow-500/20 transition-colors disabled:opacity-40"
                      >
                        <ShieldOff size={12} />冻结
                      </button>
                      <button
                        onClick={() => handleStatusChange('banned')}
                        disabled={statusLoading || user.status === 'banned'}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs rounded-lg border border-red-500/20 transition-colors disabled:opacity-40"
                      >
                        <Ban size={12} />封禁
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab: 订阅记录 */}
              {activeTab === 'subscriptions' && (
                <div>
                  {!(user as UserDetail).subscriptions?.length ? (
                    <p className="text-center text-[#9090A0] text-sm py-8">暂无订阅记录</p>
                  ) : (
                    <div className="space-y-2">
                      {(user as UserDetail).subscriptions!.map((sub) => (
                        <div key={sub.id} className="flex items-center justify-between px-4 py-3 bg-[#0A0A0F] rounded-lg border border-[#1E1E2E]">
                          <div>
                            <p className="text-sm text-white font-medium">{sub.strategy?.name || '未知策略'}</p>
                            <p className="text-xs text-[#9090A0] mt-0.5">
                              {new Date(sub.startAt).toLocaleDateString('zh-CN')}
                              {sub.expireAt && ` → ${new Date(sub.expireAt).toLocaleDateString('zh-CN')}`}
                            </p>
                          </div>
                          <AdminStatusBadge status={sub.status} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tab: 持仓记录 */}
              {activeTab === 'positions' && (
                <div>
                  {!(user as UserDetail).positions?.length ? (
                    <p className="text-center text-[#9090A0] text-sm py-8">暂无持仓记录</p>
                  ) : (
                    <div className="space-y-2">
                      {(user as UserDetail).positions!.map((pos) => (
                        <div key={pos.id} className="px-4 py-3 bg-[#0A0A0F] rounded-lg border border-[#1E1E2E]">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-white font-mono font-medium">{pos.symbol}</span>
                              <span className={`text-xs px-1.5 py-0.5 rounded ${pos.side === 'long' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                                {pos.side === 'long' ? '多' : '空'}
                              </span>
                              <AdminStatusBadge status={pos.status} />
                            </div>
                            {pos.pnl && (
                              <span className={`text-sm font-mono font-semibold ${pnlColor(pos.pnl)}`}>
                                {parseFloat(pos.pnl) >= 0 ? '+' : ''}{parseFloat(pos.pnl).toFixed(2)} USDT
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-xs text-[#9090A0]">
                            <span>入场 {parseFloat(pos.entryPrice).toFixed(4)}</span>
                            {pos.closePrice && <span>出场 {parseFloat(pos.closePrice).toFixed(4)}</span>}
                            <span>数量 {pos.amount}</span>
                            {pos.closeReason && <span className="text-yellow-400/80">{pos.closeReason}</span>}
                          </div>
                          <p className="text-[10px] text-[#9090A0] mt-1">
                            {new Date(pos.createdAt).toLocaleString('zh-CN')}
                            {pos.closedAt && ` → ${new Date(pos.closedAt).toLocaleString('zh-CN')}`}
                          </p>
                        </div>
                      ))}
                      <p className="text-xs text-[#9090A0] text-center pt-2">显示最近 10 条</p>
                    </div>
                  )}
                </div>
              )}

              {/* Tab: 交易流水 */}
              {activeTab === 'transactions' && (
                <div>
                  {!(user as UserDetail).transactions?.length ? (
                    <p className="text-center text-[#9090A0] text-sm py-8">暂无交易记录</p>
                  ) : (
                    <div className="space-y-2">
                      {(user as UserDetail).transactions!.map((tx) => (
                        <div key={tx.id} className="flex items-center justify-between px-4 py-3 bg-[#0A0A0F] rounded-lg border border-[#1E1E2E]">
                          <div>
                            <p className="text-sm text-white">{TX_TYPE[tx.type] || tx.type}</p>
                            <p className="text-xs text-[#9090A0] mt-0.5">{new Date(tx.createdAt).toLocaleString('zh-CN')}</p>
                            {tx.description && <p className="text-xs text-[#9090A0] mt-0.5">{tx.description}</p>}
                          </div>
                          <div className="text-right">
                            <p className={`text-sm font-mono font-semibold ${parseFloat(tx.amount) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {parseFloat(tx.amount) >= 0 ? '+' : ''}{parseFloat(tx.amount).toFixed(2)}
                            </p>
                            <AdminStatusBadge status={tx.status} />
                          </div>
                        </div>
                      ))}
                      <p className="text-xs text-[#9090A0] text-center pt-2">显示最近 20 条</p>
                    </div>
                  )}
                </div>
              )}

              {/* Tab: 操作 */}
              {activeTab === 'actions' && (
                <div className="space-y-3">
                  <button
                    onClick={() => { setEditNickname(user.nickname || ''); setNicknameOpen(true); }}
                    className="w-full flex items-center gap-2 px-4 py-3 bg-green-500/10 hover:bg-green-500/20 text-green-400 text-sm rounded-lg border border-green-500/20 transition-colors"
                  >
                    <Pencil size={14} />快速编辑昵称
                  </button>
                  <button
                    onClick={() => setBalanceOpen(true)}
                    className="w-full flex items-center gap-2 px-4 py-3 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 text-sm rounded-lg border border-cyan-500/20 transition-colors"
                  >
                    <Wallet size={14} />余额调整
                  </button>
                  <button
                    onClick={() => setConfirmDialog('reset-password')}
                    className="w-full flex items-center gap-2 px-4 py-3 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 text-sm rounded-lg border border-yellow-500/20 transition-colors"
                  >
                    <KeyRound size={14} />重置密码（发送邮件）
                  </button>
                  <button
                    onClick={() => setConfirmDialog('unbind-tg')}
                    disabled={!user.telegramUsername}
                    className="w-full flex items-center gap-2 px-4 py-3 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-sm rounded-lg border border-blue-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <MessageSquare size={14} />解绑 Telegram
                    {!user.telegramUsername && <span className="text-[#9090A0] text-xs ml-auto">未绑定</span>}
                  </button>
                  <button
                    onClick={() => setConfirmDialog('unbind-wallet')}
                    disabled={!user.walletAddress}
                    className="w-full flex items-center gap-2 px-4 py-3 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 text-sm rounded-lg border border-purple-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Wallet size={14} />解绑钱包地址
                    {!user.walletAddress && <span className="text-[#9090A0] text-xs ml-auto">未绑定</span>}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* 昵称编辑弹窗 */}
      {nicknameOpen && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-4"
          onClick={() => setNicknameOpen(false)}
        >
          <div
            className="bg-[#12121A] border border-[#1E1E2E] rounded-xl p-6 w-full max-w-sm shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h4 className="text-base font-semibold text-white mb-4">编辑昵称</h4>
            <input
              type="text"
              value={editNickname}
              onChange={(e) => setEditNickname(e.target.value)}
              placeholder="请输入新昵称"
              maxLength={32}
              className="w-full px-3 py-2 bg-[#0A0A0F] border border-[#1E1E2E] rounded-lg text-sm text-white placeholder-[#9090A0] focus:outline-none focus:border-cyan-500/50 mb-4"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setNicknameOpen(false)}
                className="flex-1 px-4 py-2 text-sm text-[#9090A0] bg-[#1E1E2E] hover:bg-[#2A2A3A] rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleNicknameSave}
                disabled={nicknameLoading}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm text-green-400 bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 rounded-lg transition-colors disabled:opacity-50"
              >
                {nicknameLoading && <Loader2 size={14} className="animate-spin" />}
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 余额调整弹窗 */}
      {balanceOpen && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-4"
          onClick={() => setBalanceOpen(false)}
        >
          <div
            className="bg-[#12121A] border border-[#1E1E2E] rounded-xl p-6 w-full max-w-sm shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h4 className="text-base font-semibold text-white mb-4">余额调整</h4>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-[#9090A0] mb-1">资产类型</label>
                <select
                  value={balanceType}
                  onChange={(e) => setBalanceType(e.target.value as 'usdt' | 'hoot')}
                  className="w-full px-3 py-2 bg-[#0A0A0F] border border-[#1E1E2E] rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500/50"
                >
                  <option value="usdt">USDT</option>
                  <option value="hoot">HOOT</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-[#9090A0] mb-1">操作</label>
                <select
                  value={balanceAction}
                  onChange={(e) => setBalanceAction(e.target.value as 'adjust' | 'deduct')}
                  className="w-full px-3 py-2 bg-[#0A0A0F] border border-[#1E1E2E] rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500/50"
                >
                  <option value="adjust">增加</option>
                  <option value="deduct">扣减</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-[#9090A0] mb-1">金额</label>
                <input
                  type="number"
                  value={balanceAmount}
                  onChange={(e) => setBalanceAmount(e.target.value)}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2 bg-[#0A0A0F] border border-[#1E1E2E] rounded-lg text-sm text-white placeholder-[#9090A0] focus:outline-none focus:border-cyan-500/50"
                />
              </div>
              <div>
                <label className="block text-xs text-[#9090A0] mb-1">调整原因 <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  value={balanceReason}
                  onChange={(e) => setBalanceReason(e.target.value)}
                  placeholder="请填写调整原因（必填）"
                  maxLength={100}
                  className="w-full px-3 py-2 bg-[#0A0A0F] border border-[#1E1E2E] rounded-lg text-sm text-white placeholder-[#9090A0] focus:outline-none focus:border-cyan-500/50"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setBalanceOpen(false)}
                className="flex-1 px-4 py-2 text-sm text-[#9090A0] bg-[#1E1E2E] hover:bg-[#2A2A3A] rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleBalanceSubmit}
                disabled={balanceLoading}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 rounded-lg transition-colors disabled:opacity-50"
              >
                {balanceLoading && <Loader2 size={14} className="animate-spin" />}
                确认
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 确认弹窗 */}
      <AdminConfirmDialog
        open={confirmDialog === 'reset-password'}
        onClose={() => setConfirmDialog(null)}
        onConfirm={handleConfirm}
        title="重置密码"
        description="将为该用户生成随机新密码并通过邮件发送，确认操作？"
        confirmText="重置"
        loading={mutLoading}
      />
      <AdminConfirmDialog
        open={confirmDialog === 'unbind-tg'}
        onClose={() => setConfirmDialog(null)}
        onConfirm={handleConfirm}
        title="解绑 Telegram"
        description="解绑后用户无法通过 TG 登录，确认操作？"
        confirmText="解绑"
        variant="danger"
        loading={mutLoading}
      />
      <AdminConfirmDialog
        open={confirmDialog === 'unbind-wallet'}
        onClose={() => setConfirmDialog(null)}
        onConfirm={handleConfirm}
        title="解绑钱包"
        description="解绑后用户钱包地址将被清除，确认操作？"
        confirmText="解绑"
        variant="danger"
        loading={mutLoading}
      />
    </div>
  );
}

// ─────────────────────────── 下级用户 Tab ───────────────────────────

function InviteesTab({ userId }: { userId: string }) {
  const { data, loading, error } = useAdminApi<{
    items: { id: string; email: string; nickname: string; usdtBalance: string; subscriptionCount: number; positionCount: number; rewardGenerated: string; createdAt: string }[];
    total: number;
  }>(`/admin/referral/users/${userId}/invitees?limit=50`, { enabled: !!userId });

  if (loading) return <div className="py-8 text-center text-[#9090A0] text-sm">加载中...</div>;
  if (error) return <div className="py-4 text-center text-red-400 text-sm">{error}</div>;

  const items = data?.items ?? [];
  if (items.length === 0) return <p className="text-center text-[#9090A0] text-sm py-8">暂无下级用户</p>;

  return (
    <div className="space-y-2">
      <p className="text-xs text-[#9090A0] mb-2">共 {data?.total ?? items.length} 个下级用户</p>
      {items.map(inv => (
        <div key={inv.id} className="flex items-center justify-between px-4 py-3 bg-[#0A0A0F] rounded-lg border border-[#1E1E2E]">
          <div>
            <p className="text-sm text-white">{inv.nickname || inv.email}</p>
            <p className="text-xs text-[#9090A0] mt-0.5">
              USDT {parseFloat(inv.usdtBalance || '0').toFixed(2)} · 订阅 {inv.subscriptionCount} · 持仓 {inv.positionCount}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-green-400 font-mono">+{parseFloat(inv.rewardGenerated || '0').toFixed(2)}</p>
            <p className="text-[10px] text-[#5E5E6E] mt-0.5">{new Date(inv.createdAt).toLocaleDateString('zh-CN')}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────── 复制按钮 ───────────────────────────

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1200); });
      }}
      className="inline-flex items-center justify-center w-5 h-5 rounded hover:bg-[#2A2A3A] text-[#4A4A5A] hover:text-cyan-400 transition-colors shrink-0"
      title="复制"
    >
      {copied ? <Check size={10} className="text-green-400" /> : <Copy size={10} />}
    </button>
  );
}

// ─────────────────────────── 用户列表 Tab ───────────────────────────

function UserListTab() {
  const {
    items,
    total,
    page,
    totalPages,
    loading,
    error,
    search,
    filters,
    setPage,
    setSearch,
    setFilter,
    refetch,
  } = useAdminList<UserItem>('/admin/users');

  const { mutate: statusMutate, loading: statusLoading } = useAdminMutation({
    onSuccess: refetch,
  });
  const [statusLoadingId, setStatusLoadingId] = useState<string | null>(null);
  const [detailUserId, setDetailUserId] = useState<string | null>(null);

  const handleStatusToggle = async (user: UserItem) => {
    const newStatus = user.status === 'active' ? 'suspended' : 'active';
    setStatusLoadingId(user.id);
    await statusMutate(`/admin/users/${user.id}/status`, 'put', { status: newStatus });
    setStatusLoadingId(null);
  };

  const columns: AdminColumn<UserItem>[] = [
    {
      key: 'uid',
      title: 'ID',
      width: '110px',
      render: (row) => {
        const shortId = row.userCode || (row.uid ? `USR${String(row.uid).padStart(5, '0')}` : '—');
        return (
          <div className="flex flex-col gap-0.5">
            <span className="inline-flex items-center gap-0.5">
              <span className="font-mono text-cyan-400 text-xs font-semibold">{shortId}</span>
              <CopyBtn text={shortId} />
            </span>
            <span className="font-mono text-[#4A4A5A] text-[10px] truncate max-w-[100px]">{row.id.slice(0, 8)}…</span>
          </div>
        );
      },
    },
    {
      key: 'email',
      title: '邮箱',
      width: '160px',
      render: (row) => (
        <span className="inline-flex items-center gap-0.5 max-w-[155px]">
          <span className="text-white text-xs truncate">{row.email}</span>
          <CopyBtn text={row.email} />
        </span>
      ),
    },
    {
      key: 'nickname',
      title: '昵称',
      width: '100px',
      render: (row) => row.nickname ? (
        <span className="inline-flex items-center gap-0.5 max-w-[95px]">
          <span className="text-[#9090A0] text-xs truncate">{row.nickname}</span>
          <CopyBtn text={row.nickname} />
        </span>
      ) : <span className="text-[#4A4A5A] text-xs">-</span>,
    },
    {
      key: 'usdtBalance',
      title: 'USDT',
      width: '70px',
      align: 'right',
      render: (row) => (
        <span className="font-mono text-white text-xs whitespace-nowrap">
          {parseFloat(row.usdtBalance).toFixed(2)}
        </span>
      ),
    },
    {
      key: 'hootBalance',
      title: 'HOOT',
      width: '70px',
      align: 'right',
      render: (row) => (
        <span className="font-mono text-cyan-400 text-xs whitespace-nowrap">
          {parseFloat(row.hootBalance).toFixed(2)}
        </span>
      ),
    },
    {
      key: 'pointBalance',
      title: 'Gas',
      width: '60px',
      align: 'right',
      render: (row) => (
        <span className="font-mono text-green-400 text-xs whitespace-nowrap">
          {parseFloat(row.pointBalance).toFixed(2)}
        </span>
      ),
    },
    {
      key: 'binding',
      title: '绑定',
      width: '55px',
      align: 'center',
      render: (row) => (
        <div className="flex items-center justify-center gap-1 whitespace-nowrap">
          <span title={row.telegramUsername ? `TG: @${row.telegramUsername}` : '未绑定TG'} className={`text-[10px] px-1 py-0.5 rounded ${row.telegramUsername ? 'bg-blue-500/10 text-blue-400' : 'text-[#4A4A5A]'}`}>
            TG
          </span>
          <span title={row.walletAddress || '未绑定钱包'} className={`text-[10px] px-1 py-0.5 rounded ${row.walletAddress ? 'bg-purple-500/10 text-purple-400' : 'text-[#4A4A5A]'}`}>
            钱包
          </span>
        </div>
      ),
    },
    {
      key: 'status',
      title: '状态',
      width: '40px',
      align: 'center',
      render: (row) => {
        const map: Record<string, { label: string; cls: string }> = {
          active: { label: '正常', cls: 'text-green-400' },
          suspended: { label: '冻结', cls: 'text-yellow-400' },
          banned: { label: '封禁', cls: 'text-red-400' },
        };
        const s = map[row.status] || { label: row.status, cls: 'text-[#9090A0]' };
        return <span className={`text-[10px] font-medium whitespace-nowrap ${s.cls}`}>{s.label}</span>;
      },
    },
    {
      key: 'membershipStatus',
      title: '会员',
      width: '70px',
      align: 'center',
      render: (row) => {
        const s = row.membershipStatus;
        if (!s || s === 'none') return <span className="text-[#4A4A5A] text-xs">—</span>;
        const expireAt = row.membershipExpireAt ? new Date(row.membershipExpireAt) : null;
        const expired = expireAt && expireAt < new Date();
        const labelMap: Record<string, string> = { pro: 'Pro', basic: 'Basic', vip: 'VIP', enterprise: '企业' };
        const label = labelMap[s] || s;
        return (
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded whitespace-nowrap ${expired ? 'bg-red-500/10 text-red-400' : 'bg-cyan-500/10 text-cyan-400'}`}>
            {label}{expireAt ? ` ${expireAt.getMonth() + 1}/${expireAt.getDate()}` : ''}{expired ? '过期' : ''}
          </span>
        );
      },
    },
    {
      key: 'createdAt',
      title: '注册',
      width: '75px',
      align: 'center',
      render: (row) => (
        <span className="text-[#9090A0] text-xs whitespace-nowrap">
          {new Date(row.createdAt).toLocaleDateString('zh-CN')}
        </span>
      ),
    },
    {
      key: 'lastLoginIp',
      title: 'IP',
      width: '100px',
      render: (row) => row.lastLoginIp ? (
        <span className="inline-flex items-center gap-0.5">
          <span className="text-[#9090A0] text-[10px] font-mono">{row.lastLoginIp}</span>
          <CopyBtn text={row.lastLoginIp} />
        </span>
      ) : <span className="text-[#4A4A5A] text-[10px]">—</span>,
    },
    {
      key: 'actions',
      title: '操作',
      align: 'center',
      width: '100px',
      render: (row) => (
        <div className="flex items-center justify-center gap-1 whitespace-nowrap">
          <button
            onClick={() => handleStatusToggle(row)}
            disabled={statusLoadingId === row.id}
            className={`inline-flex items-center gap-0.5 px-1.5 py-1 rounded text-[10px] transition-colors disabled:opacity-50 ${
              row.status === 'active'
                ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                : 'bg-green-500/10 text-green-400 hover:bg-green-500/20'
            }`}
          >
            {statusLoadingId === row.id ? <Loader2 size={10} className="animate-spin" /> : row.status === 'active' ? <Ban size={10} /> : <CheckCircle size={10} />}
            {row.status === 'active' ? '封禁' : '解封'}
          </button>
          <button
            onClick={() => setDetailUserId(row.id)}
            className="px-1.5 py-1 bg-[#1E1E2E] hover:bg-[#2A2A3A] text-[#9090A0] hover:text-white rounded text-[10px] transition-colors"
          >
            详情
          </button>
        </div>
      ),
    },
  ];

  if (error) return <AdminErrorState message={error} onRetry={refetch} />;

  return (
    <div className="space-y-4">
      {/* 搜索 + 筛选 */}
      <div className="flex flex-wrap items-center gap-2">
        <AdminSearchBar
          value={search}
          onChange={setSearch}
          onSearch={refetch}
          placeholder="搜索 UID、邮箱、昵称..."
        />
        {/* TG 绑定筛选 */}
        <select
          value={filters.hasTelegram ?? ''}
          onChange={(e) => setFilter('hasTelegram', e.target.value)}
          className="px-3 py-2 bg-[#12121A] border border-[#1E1E2E] rounded-lg text-xs text-[#9090A0] focus:outline-none focus:border-cyan-500/50"
        >
          <option value="">全部TG状态</option>
          <option value="true">已绑TG</option>
          <option value="false">未绑TG</option>
        </select>
        {/* 钱包绑定筛选 */}
        <select
          value={filters.hasWallet ?? ''}
          onChange={(e) => setFilter('hasWallet', e.target.value)}
          className="px-3 py-2 bg-[#12121A] border border-[#1E1E2E] rounded-lg text-xs text-[#9090A0] focus:outline-none focus:border-cyan-500/50"
        >
          <option value="">全部钱包</option>
          <option value="true">已绑钱包</option>
          <option value="false">未绑钱包</option>
        </select>
        {/* 账号状态筛选 */}
        <select
          value={filters.status ?? ''}
          onChange={(e) => setFilter('status', e.target.value)}
          className="px-3 py-2 bg-[#12121A] border border-[#1E1E2E] rounded-lg text-xs text-[#9090A0] focus:outline-none focus:border-cyan-500/50"
        >
          <option value="">全部状态</option>
          <option value="active">正常</option>
          <option value="suspended">冻结</option>
          <option value="banned">封禁</option>
        </select>
      </div>

      {loading && !items.length ? (
        <AdminSkeleton mode="table" count={8} />
      ) : (
        <>
          <AdminTable<UserItem>
            columns={columns}
            data={items}
            rowKey="id"
            loading={loading}
          />
          {!items.length && !loading && (
            <AdminEmptyState icon={Users} title="暂无用户数据" />
          )}
          <AdminPagination
            page={page}
            totalPages={totalPages}
            total={total}
            onPageChange={setPage}
          />
        </>
      )}

      {detailUserId && (
        <UserDetailDialog
          userId={detailUserId}
          onClose={() => setDetailUserId(null)}
          onChanged={refetch}
        />
      )}
    </div>
  );
}

// ─────────────────────────── 用户统计 Tab ───────────────────────────

function UserStatsTab() {
  const { data: stats, loading: statsLoading, error: statsError, refetch: statsRefetch } =
    useAdminApi<UserStats>('/admin/stats/users');

  const { data: trend, loading: trendLoading } =
    useAdminApi<TrendItem[]>('/admin/stats/users/trend?days=30');

  const { data: assets } = useAdminApi<AssetItem[]>('/admin/stats/users/assets');
  const { data: sources } = useAdminApi<SourceItem[]>('/admin/stats/users/source');

  if (statsLoading) return <AdminSkeleton mode="grid" count={4} cols={4} />;
  if (statsError) return <AdminErrorState message={statsError} onRetry={statsRefetch} />;

  const trendData = Array.isArray(trend) ? trend : [];
  const maxCount = trendData.length > 0 ? Math.max(...trendData.map((t) => t.count), 1) : 1;

  return (
    <div className="space-y-6">
      {/* 统计卡片 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <AdminStatCard title="总用户" value={stats?.totalUsers ?? '-'} icon={Users} color="bg-blue-500/20 text-blue-400" />
        <AdminStatCard title="今日活跃" value={stats?.activeToday ?? '-'} icon={UserCheck} color="bg-green-500/20 text-green-400" />
        <AdminStatCard title="今日新增" value={stats?.newToday ?? '-'} icon={UserPlus} color="bg-cyan-500/20 text-cyan-400" />
        <AdminStatCard title="本周新增" value={stats?.newThisWeek ?? '-'} icon={BarChart3} color="bg-purple-500/20 text-purple-400" />
      </div>

      {/* 增长趋势 */}
      <div className="bg-[#12121A] border border-[#1E1E2E] rounded-xl p-4">
        <p className="text-sm font-medium text-white mb-4">30 天用户增长</p>
        {trendLoading ? (
          <div className="h-32 flex items-center justify-center text-[#9090A0] text-sm">加载中...</div>
        ) : trendData.length === 0 ? (
          <div className="h-32 flex items-center justify-center text-[#9090A0] text-sm">暂无数据</div>
        ) : (
          <div className="flex items-end gap-1 h-32">
            {trendData.map((item, idx) => {
              const heightPct = (item.count / maxCount) * 100;
              return (
                <div key={idx} className="flex-1 flex flex-col items-center justify-end group">
                  <div className="relative w-full">
                    <div
                      className="w-full bg-cyan-500/30 rounded-t hover:bg-cyan-500/60 transition-colors min-h-[2px]"
                      style={{ height: `${Math.max(heightPct, 2)}%` }}
                    />
                    <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block bg-[#2A2A3A] text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                      {item.date}: {item.count}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 资产分布 + 来源统计 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-[#12121A] border border-[#1E1E2E] rounded-xl p-4">
          <p className="text-sm font-medium text-white mb-3">资产分布</p>
          {Array.isArray(assets) && assets.length > 0 ? (
            <div className="space-y-2">
              {assets.map((item) => (
                <div key={item.range} className="flex items-center justify-between text-sm">
                  <span className="text-[#9090A0]">{item.range}</span>
                  <span className="text-white font-mono">{item.count} 人</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[#9090A0] text-sm">暂无数据</p>
          )}
        </div>
        <div className="bg-[#12121A] border border-[#1E1E2E] rounded-xl p-4">
          <p className="text-sm font-medium text-white mb-3">注册来源</p>
          {Array.isArray(sources) && sources.length > 0 ? (
            <div className="space-y-2">
              {sources.map((item) => (
                <div key={item.source} className="flex items-center justify-between text-sm">
                  <span className="text-[#9090A0]">{item.source || '直接注册'}</span>
                  <span className="text-white font-mono">{item.count} 人</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[#9090A0] text-sm">暂无数据</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────── 主页面 ───────────────────────────

const TABS = [
  { key: 'list', label: '用户列表', icon: Users },
  { key: 'stats', label: '用户统计', icon: BarChart3 },
];

export default function AdminUsersPage() {
  const [activeTab, setActiveTab] = useState('list');

  return (
    <div className="p-6 space-y-4">
      <AdminPageHeader title="用户管理" icon={Users} subtitle="用户列表管理、详情查看、统计分析" />
      <AdminTabs tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />
      {activeTab === 'list' && <UserListTab />}
      {activeTab === 'stats' && <UserStatsTab />}
    </div>
  );
}
