'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Link as LinkIcon,
  Play,
  Square,
  RefreshCw,
  Wallet,
  Cpu,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Radio,
  Layers,
  Zap,
  Edit3,
  Save,
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

interface SweepAddress {
  chain: string;
  address: string;
  index: number;
  usdt: string;
  gasBalance: string;
  gasSymbol: string;
}

interface SweepResult {
  scanned: number;
  swept: number;
  totalUsdt: string;
  results: { address: string; chain: string; status: string; txHash?: string; error?: string }[];
}

interface SweepConfig {
  evmAddress: string;
  tronAddress: string;
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

  // 归集状态
  const [sweepAddresses, setSweepAddresses] = useState<SweepAddress[]>([]);
  const [sweepLoading, setSweepLoading] = useState(false);
  const [sweepExecuting, setSweepExecuting] = useState(false);
  const [sweepResult, setSweepResult] = useState<SweepResult | null>(null);

  // 归集地址配置
  const [sweepConfig, setSweepConfig] = useState<SweepConfig>({ evmAddress: '', tronAddress: '' });
  const [sweepConfigLoading, setSweepConfigLoading] = useState(true);
  const [sweepConfigEditing, setSweepConfigEditing] = useState(false);
  const [sweepConfigForm, setSweepConfigForm] = useState<SweepConfig>({ evmAddress: '', tronAddress: '' });
  const [sweepConfigSaving, setSweepConfigSaving] = useState(false);

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

  // ── 加载归集地址配置 ──────────────────────────────────────────
  const fetchSweepConfig = useCallback(async () => {
    setSweepConfigLoading(true);
    try {
      const res = await adminApi.get<SweepConfig>('/blockchain/sweep/config');
      setSweepConfig(res.data);
      setSweepConfigForm(res.data);
    } catch {
      // 静默失败
    } finally {
      setSweepConfigLoading(false);
    }
  }, []);

  const refreshAll = useCallback(() => {
    fetchStatus();
    fetchBalances();
  }, [fetchStatus, fetchBalances]);

  // 初始加载 + 30s 自动刷新
  useEffect(() => {
    refreshAll();
    fetchSweepConfig();
    const id = setInterval(refreshAll, 30_000);
    return () => clearInterval(id);
  }, [refreshAll, fetchSweepConfig]);

  // ── 保存归集地址配置 ──────────────────────────────────────────
  const handleSaveSweepConfig = async () => {
    setSweepConfigSaving(true);
    try {
      const res = await adminApi.put<SweepConfig>('/blockchain/sweep/config', sweepConfigForm);
      setSweepConfig(res.data);
      setSweepConfigForm(res.data);
      setSweepConfigEditing(false);
      toast.success('归集地址已更新');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSweepConfigSaving(false);
    }
  };

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

  // ── 扫描归集地址 ───────────────────────────────────────────────
  const handleScanSweep = async () => {
    setSweepLoading(true);
    setSweepAddresses([]);
    setSweepResult(null);
    try {
      const res = await adminApi.get<{ addresses: SweepAddress[] }>('/blockchain/sweep/scan');
      setSweepAddresses(res.data?.addresses ?? []);
      if ((res.data?.addresses ?? []).length === 0) {
        toast.success('扫描完成，暂无可归集余额');
      } else {
        toast.success(`发现 ${res.data.addresses.length} 个有余额的地址`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '扫描失败');
    } finally {
      setSweepLoading(false);
    }
  };

  // ── 执行归集 ──────────────────────────────────────────────────
  const handleExecuteSweep = async () => {
    setSweepExecuting(true);
    setSweepResult(null);
    try {
      const res = await adminApi.post<SweepResult>('/blockchain/sweep/execute', {});
      setSweepResult(res.data);
      toast.success(`归集完成，共转移 ${res.data?.totalUsdt ?? '0'} USDT`);
      fetchBalances();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '归集失败');
    } finally {
      setSweepExecuting(false);
    }
  };

  // ── 渲染 ──────────────────────────────────────────────────────

  const connectedChains = status?.chains?.filter((c) => c.connected).length ?? 0;
  // TRON 单独计入
  const tronCount = status?.tronEnabled ? 1 : 0;
  const totalChains = (status?.chains?.length ?? 0) + tronCount;
  const displayConnected = connectedChains + tronCount;

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
              value={`${displayConnected} / ${totalChains}`}
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
            {status.chains.length === 0 && !status.tronEnabled ? (
              <p className="text-sm text-[#9090A0] text-center py-4">暂无链配置</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* EVM 链 */}
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
                {/* TRON 链（单独渲染） */}
                {status.tronEnabled && (
                  <div className={`flex items-start gap-3 p-4 rounded-lg border ${getChainStyle('TRON').bg}`}>
                    <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${getChainStyle('TRON').dot}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-sm font-bold ${getChainStyle('TRON').text}`}>TRON</span>
                        <span className="flex items-center gap-1 text-xs text-green-400">
                          <CheckCircle size={11} />已连接
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        <span className="px-1.5 py-0.5 bg-[#1A1A24] text-[#9090A0] text-xs rounded font-mono">USDT</span>
                      </div>
                    </div>
                  </div>
                )}
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
                        <span className="text-xs text-[#9090A0] font-mono break-all">
                          {b.address}
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

      {/* 归集地址配置 */}
      <div className="bg-[#12121A] border border-[#1E1E2E] rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Wallet size={14} className="text-cyan-400" />归集地址配置
            <span className="text-xs text-[#9090A0] font-normal">资金归集的目标钱包地址</span>
          </h3>
          <div className="flex items-center gap-2">
            {sweepConfigEditing ? (
              <>
                <button
                  onClick={() => { setSweepConfigEditing(false); setSweepConfigForm(sweepConfig); }}
                  className="px-3 py-1.5 text-xs rounded-lg border border-[#2A2A3A] text-[#9090A0] hover:text-white transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleSaveSweepConfig}
                  disabled={sweepConfigSaving}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-cyan-500/20 bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 transition-colors disabled:opacity-50"
                >
                  {sweepConfigSaving ? <RefreshCw size={12} className="animate-spin" /> : <Save size={12} />}
                  保存
                </button>
              </>
            ) : (
              <button
                onClick={() => setSweepConfigEditing(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-[#2A2A3A] text-[#9090A0] hover:text-white transition-colors"
              >
                <Edit3 size={12} />编辑
              </button>
            )}
          </div>
        </div>

        {sweepConfigLoading ? (
          <AdminSkeleton mode="table" count={2} />
        ) : (
          <div className="space-y-4">
            {/* EVM 归集地址 */}
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-xs font-bold text-yellow-400">BSC / ETH</span>
                <span className="text-xs text-[#9090A0]">EVM 链归集地址（0x...）</span>
              </div>
              {sweepConfigEditing ? (
                <input
                  type="text"
                  value={sweepConfigForm.evmAddress}
                  onChange={(e) => setSweepConfigForm(f => ({ ...f, evmAddress: e.target.value }))}
                  placeholder="0x..."
                  className="w-full px-3 py-2 bg-[#0A0A0F] border border-[#2A2A3A] rounded-lg text-xs font-mono text-white placeholder-[#4A4A5A] focus:outline-none focus:border-cyan-500/50"
                />
              ) : (
                <p className="text-xs font-mono text-white break-all bg-[#0A0A0F] px-3 py-2 rounded-lg border border-[#1E1E2E]">
                  {sweepConfig.evmAddress || <span className="text-[#9090A0] italic">未配置</span>}
                </p>
              )}
            </div>

            {/* TRON 归集地址 */}
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-xs font-bold text-red-400">TRON</span>
                <span className="text-xs text-[#9090A0]">TRON 链归集地址（T...）</span>
              </div>
              {sweepConfigEditing ? (
                <input
                  type="text"
                  value={sweepConfigForm.tronAddress}
                  onChange={(e) => setSweepConfigForm(f => ({ ...f, tronAddress: e.target.value }))}
                  placeholder="T..."
                  className="w-full px-3 py-2 bg-[#0A0A0F] border border-[#2A2A3A] rounded-lg text-xs font-mono text-white placeholder-[#4A4A5A] focus:outline-none focus:border-cyan-500/50"
                />
              ) : (
                <p className="text-xs font-mono text-white break-all bg-[#0A0A0F] px-3 py-2 rounded-lg border border-[#1E1E2E]">
                  {sweepConfig.tronAddress || <span className="text-[#9090A0] italic">未配置</span>}
                </p>
              )}
            </div>

            <p className="text-xs text-[#4A4A5A]">
              * 派生地址由 HD 钱包助记词自动生成，不可在此修改。归集地址为用户资金最终汇入的目标钱包。
            </p>
          </div>
        )}
      </div>

      {/* 一键归集 */}
      <div className="bg-[#12121A] border border-[#1E1E2E] rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Layers size={14} className="text-cyan-400" />一键归集
            <span className="text-xs text-[#9090A0] font-normal">将充值地址余额转入热钱包</span>
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={handleScanSweep}
              disabled={sweepLoading || sweepExecuting}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-cyan-500/20 bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 transition-colors disabled:opacity-50"
            >
              {sweepLoading ? <RefreshCw size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              扫描余额
            </button>
            <button
              onClick={handleExecuteSweep}
              disabled={sweepExecuting || sweepLoading || sweepAddresses.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-green-500/20 bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors disabled:opacity-50"
            >
              {sweepExecuting ? <RefreshCw size={12} className="animate-spin" /> : <Zap size={12} />}
              执行归集
            </button>
          </div>
        </div>

        {/* 扫描结果 */}
        {sweepLoading ? (
          <AdminSkeleton mode="table" count={3} />
        ) : sweepAddresses.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1E1E2E]">
                  <th className="text-left py-2 px-3 text-xs text-[#9090A0] font-medium">链</th>
                  <th className="text-left py-2 px-3 text-xs text-[#9090A0] font-medium">地址</th>
                  <th className="text-right py-2 px-3 text-xs text-[#9090A0] font-medium">USDT</th>
                  <th className="text-right py-2 px-3 text-xs text-[#9090A0] font-medium">Gas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E1E2E]">
                {sweepAddresses.map((a, i) => {
                  const style = getChainStyle(a.chain);
                  return (
                    <tr key={i} className="hover:bg-[#1A1A24] transition-colors">
                      <td className="py-2 px-3">
                        <span className={`text-xs font-bold ${style.text}`}>{a.chain}</span>
                      </td>
                      <td className="py-2 px-3 max-w-xs">
                        <span className="text-xs text-[#9090A0] font-mono break-all">
                          {a.address}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right">
                        <span className="text-xs font-mono text-white">
                          {parseFloat(a.usdt).toFixed(2)}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right">
                        <span className="text-xs font-mono text-[#9090A0]">
                          {parseFloat(a.gasBalance).toFixed(6)} {a.gasSymbol}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : sweepResult ? null : (
          <p className="text-sm text-[#9090A0] text-center py-6">点击「扫描余额」查找有余额的充值地址</p>
        )}

        {/* 归集结果 */}
        {sweepResult && (
          <div className="mt-4 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
            <p className="text-sm text-green-400 font-medium mb-2">
              归集完成 — 共扫描 {sweepResult.scanned} 个地址，成功归集 {sweepResult.swept} 个，转移 {sweepResult.totalUsdt} USDT
            </p>
            {sweepResult.results?.length > 0 && (
              <div className="space-y-1 mt-2 max-h-40 overflow-y-auto">
                {sweepResult.results.map((r, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    {r.status === 'success' ? (
                      <CheckCircle size={11} className="text-green-400 shrink-0" />
                    ) : (
                      <XCircle size={11} className="text-red-400 shrink-0" />
                    )}
                    <span className="text-[#9090A0] font-mono break-all">{r.address}</span>
                    <span className={`ml-auto ${r.status === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                      {r.status === 'success' ? (r.txHash ? `TX: ${r.txHash.slice(0, 10)}...` : '成功') : r.error}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <p className="text-xs text-[#4A4A5A] text-right">每 30 秒自动刷新</p>
    </div>
  );
}
