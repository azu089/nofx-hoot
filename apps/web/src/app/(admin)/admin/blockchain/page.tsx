'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Link as LinkIcon,
  Unlink,
  Play,
  Square,
  RefreshCw,
  Wallet,
  Cpu,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Radio,
} from 'lucide-react';
import {
  AdminPageHeader,
  AdminSkeleton,
  AdminErrorState,
  AdminStatCard,
} from '@/components/admin/shared';
import { adminApi } from '@/lib/admin-auth';
import { toast } from 'sonner';

// ─── 类型 ────────────────────────────────────────────────────────

interface ChainInfo {
  name: string;
  connected: boolean;
  tokens: string[];
}

interface BlockchainStatus {
  isConnected: boolean;
  isListening: boolean;
  chains: ChainInfo[];
  tronEnabled: boolean;
  cachedAddresses: number;
  hdWallet: boolean;
}

interface ChainBalance {
  chain: string;
  address: string;
  gasBalance: string;
  gasSymbol: string;
  usdt: string;
  hoot?: string;
}

// ─── 链颜色 ──────────────────────────────────────────────────────

const CHAIN_COLORS: Record<string, { text: string; bg: string; dot: string }> = {
  BSC:     { text: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20', dot: 'bg-yellow-400' },
  ETH:     { text: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/20',   dot: 'bg-blue-400' },
  POLYGON: { text: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20', dot: 'bg-purple-400' },
  TRON:    { text: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/20',    dot: 'bg-red-400' },
};

function getChainStyle(name: string) {
  return CHAIN_COLORS[name.toUpperCase()] ?? {
    text: 'text-cyan-400', bg: 'bg-cyan-500/10 border-cyan-500/20', dot: 'bg-cyan-400',
  };
}

// ─── 主页面 ─────────────────────────────────────────────────────

export default function AdminBlockchainPage() {
  const [status, setStatus] = useState<BlockchainStatus | null>(null);
  const [balances, setBalances] = useState<ChainBalance[]>([]);
  const [statusLoading, setStatusLoading] = useState(true);
  const [balanceLoading, setBalanceLoading] = useState(true);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // ── 加载监听状态 ──────────────────────────────────────────────
  const fetchStatus = useCallback(async () => {
    setStatusLoading(true);
    setStatusError(null);
    try {
      const res = await adminApi.get<BlockchainStatus>('/blockchain/status');
      setStatus(res.data);
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : '获取区块链状态失败');
    } finally {
      setStatusLoading(false);
    }
  }, []);

  // ── 加载热钱包余额 ────────────────────────────────────────────
  const fetchBalances = useCallback(async () => {
    setBalanceLoading(true);
    try {
      const res = await adminApi.get<{ chains: ChainBalance[] }>('/blockchain/withdraw-wallet/balance');
      setBalances(res.data?.chains ?? []);
    } catch {
      // 钱包未配置时静默失败
    } finally {
      setBalanceLoading(false);
    }
  }, []);

  const refreshAll = useCallback(() => {
    fetchStatus();
    fetchBalances();
  }, [fetchStatus, fetchBalances]);

  // 初始加载 + 30s 自动刷新
  useEffect(() => {
    refreshAll();
    const id = setInterval(refreshAll, 30_000);
    return () => clearInterval(id);
  }, [refreshAll]);

  // ── 启动/停止监听 ─────────────────────────────────────────────
  const handleToggle = async () => {
    const action = status?.isListening ? 'stop' : 'start';
    setActionLoading(action);
    try {
      await adminApi.post(`/blockchain/${action}`, {});
      toast.success(action === 'start' ? '监听已启动' : '监听已停止');
      await fetchStatus();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '操作失败');
    } finally {
      setActionLoading(null);
    }
  };

  // ── 渲染 ──────────────────────────────────────────────────────

  const connectedChains = status?.chains?.filter((c) => c.connected).length ?? 0;
  const totalChains = status?.chains?.length ?? 0;

  return (
    <div className="p-6 space-y-6">
      <AdminPageHeader
        title="区块链监控"
        icon={Radio}
        subtitle="链上监听状态与热钱包余额实时监控"
        onRefresh={refreshAll}
        actions={
          status && (
            <button
              onClick={handleToggle}
              disabled={!!actionLoading || statusLoading}
              className={`flex items-center gap-2 px-4 py-2 text-sm rounded-lg border transition-colors disabled:opacity-50 ${
                status.isListening
                  ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/20'
                  : 'bg-green-500/10 hover:bg-green-500/20 text-green-400 border-green-500/20'
              }`}
            >
              {actionLoading ? (
                <RefreshCw size={14} className="animate-spin" />
              ) : status.isListening ? (
                <Square size={14} />
              ) : (
                <Play size={14} />
              )}
              {status.isListening ? '停止监听' : '启动监听'}
            </button>
          )
        }
      />

      {/* 状态概览 */}
      {statusLoading && !status ? (
        <AdminSkeleton mode="grid" count={4} cols={4} />
      ) : statusError ? (
        <AdminErrorState message={statusError} onRetry={fetchStatus} />
      ) : status ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <AdminStatCard
              title="监听状态"
              value={status.isListening ? '运行中' : '已停止'}
              icon={status.isListening ? CheckCircle : XCircle}
              color={status.isListening ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}
            />
            <AdminStatCard
              title="已连接链"
              value={`${connectedChains} / ${totalChains}`}
              icon={LinkIcon}
              color="bg-cyan-500/20 text-cyan-400"
            />
            <AdminStatCard
              title="缓存地址数"
              value={status.cachedAddresses}
              icon={Cpu}
              color="bg-blue-500/20 text-blue-400"
            />
            <AdminStatCard
              title="HD钱包"
              value={status.hdWallet ? '已初始化' : '未初始化'}
              icon={Wallet}
              color={status.hdWallet ? 'bg-purple-500/20 text-purple-400' : 'bg-[#9090A0]/20 text-[#9090A0]'}
            />
          </div>

          {/* 各链状态 */}
          <div className="bg-[#12121A] border border-[#1E1E2E] rounded-xl p-5">
            <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <Radio size={14} className="text-cyan-400" />链状态详情
            </h3>
            {status.chains.length === 0 ? (
              <p className="text-sm text-[#9090A0] text-center py-4">暂无链配置</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {status.chains.map((chain) => {
                  const style = getChainStyle(chain.name);
                  return (
                    <div
                      key={chain.name}
                      className={`flex items-start gap-3 p-4 rounded-lg border ${style.bg}`}
                    >
                      <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${chain.connected ? style.dot : 'bg-[#4A4A5A]'}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-sm font-bold ${style.text}`}>{chain.name}</span>
                          {chain.connected ? (
                            <span className="flex items-center gap-1 text-xs text-green-400">
                              <CheckCircle size={11} />已连接
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-xs text-red-400">
                              <XCircle size={11} />断开
                            </span>
                          )}
                        </div>
                        {chain.tokens.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {chain.tokens.map((token) => (
                              <span key={token} className="px-1.5 py-0.5 bg-[#1A1A24] text-[#9090A0] text-xs rounded font-mono">
                                {token}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      ) : null}

      {/* 热钱包余额 */}
      <div className="bg-[#12121A] border border-[#1E1E2E] rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <Wallet size={14} className="text-cyan-400" />热钱包余额
          {balanceLoading && <RefreshCw size={12} className="text-[#9090A0] animate-spin" />}
        </h3>
        {balances.length === 0 && !balanceLoading ? (
          <div className="flex items-center gap-2 py-4 text-sm text-[#9090A0]">
            <AlertTriangle size={14} className="text-yellow-400" />
            热钱包未配置或查询失败
          </div>
        ) : balanceLoading && !balances.length ? (
          <AdminSkeleton mode="table" count={3} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1E1E2E]">
                  <th className="text-left py-2 px-3 text-xs text-[#9090A0] font-medium">链</th>
                  <th className="text-left py-2 px-3 text-xs text-[#9090A0] font-medium">地址</th>
                  <th className="text-right py-2 px-3 text-xs text-[#9090A0] font-medium">Gas余额</th>
                  <th className="text-right py-2 px-3 text-xs text-[#9090A0] font-medium">USDT</th>
                  <th className="text-right py-2 px-3 text-xs text-[#9090A0] font-medium">HOOT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E1E2E]">
                {balances.map((b) => {
                  const style = getChainStyle(b.chain);
                  const gasLow = parseFloat(b.gasBalance) < 0.01;
                  return (
                    <tr key={b.chain} className="hover:bg-[#1A1A24] transition-colors">
                      <td className="py-3 px-3">
                        <span className={`text-xs font-bold ${style.text}`}>{b.chain}</span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="text-xs text-[#9090A0] font-mono">
                          {b.address.slice(0, 8)}...{b.address.slice(-6)}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <span className={`text-xs font-mono ${gasLow ? 'text-red-400' : 'text-white'}`}>
                          {parseFloat(b.gasBalance).toFixed(6)} {b.gasSymbol}
                        </span>
                        {gasLow && (
                          <AlertTriangle size={11} className="inline-block ml-1 text-yellow-400" />
                        )}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <span className="text-xs font-mono text-white">
                          {parseFloat(b.usdt).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <span className="text-xs font-mono text-[#9090A0]">
                          {b.hoot ? parseFloat(b.hoot).toLocaleString('en-US', { maximumFractionDigits: 2 }) : '—'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-[#4A4A5A] text-right">每 30 秒自动刷新</p>
    </div>
  );
}
