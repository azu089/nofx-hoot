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
  Settings,
  X,
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

interface ChainInfo { name: string; connected: boolean; tokens: string[] }

interface BlockchainStatus {
  isConnected: boolean; isListening: boolean;
  chains: ChainInfo[]; tronEnabled: boolean;
  cachedAddresses: number; hdWallet: boolean;
}

interface ChainBalance {
  chain: string; address: string;
  gasBalance: string; gasSymbol: string;
  usdt: string; hoot?: string;
}

interface SweepAddress {
  chain: string; address: string; index: number;
  usdt: string; gasBalance: string; gasSymbol: string;
}

interface SweepResult {
  scanned: number; swept: number; totalUsdt: string;
  results: { address: string; chain: string; status: string; txHash?: string; error?: string }[];
}

interface SweepConfig { evmAddress: string; tronAddress: string }
interface SweepConfigBalance {
  evm: { address: string; usdt: string } | null;
  tron: { address: string; usdt: string } | null;
}

// ─── 链颜色 ──────────────────────────────────────────────────────

const CHAIN_COLORS: Record<string, { text: string; bg: string; dot: string }> = {
  BSC:     { text: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20', dot: 'bg-yellow-400' },
  ETH:     { text: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/20',   dot: 'bg-blue-400' },
  POLYGON: { text: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20', dot: 'bg-purple-400' },
  TRON:    { text: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/20',    dot: 'bg-red-400' },
};
function getChainStyle(name: string) {
  return CHAIN_COLORS[name.toUpperCase()] ?? { text: 'text-cyan-400', bg: 'bg-cyan-500/10 border-cyan-500/20', dot: 'bg-cyan-400' };
}

// ─── 主页面 ─────────────────────────────────────────────────────

export default function AdminBlockchainPage() {
  const [status, setStatus] = useState<BlockchainStatus | null>(null);
  const [gasBalances, setGasBalances] = useState<ChainBalance[]>([]);
  const [statusLoading, setStatusLoading] = useState(true);
  const [gasLoading, setGasLoading] = useState(true);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // 归集地址配置 & 余额
  const [sweepConfig, setSweepConfig] = useState<SweepConfig>({ evmAddress: '', tronAddress: '' });
  const [sweepBalance, setSweepBalance] = useState<SweepConfigBalance>({ evm: null, tron: null });
  const [sweepConfigLoading, setSweepConfigLoading] = useState(true);
  const [sweepBalanceLoading, setSweepBalanceLoading] = useState(true);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [configForm, setConfigForm] = useState<SweepConfig>({ evmAddress: '', tronAddress: '' });
  const [configSaving, setConfigSaving] = useState(false);

  // 一键归集
  const [sweepAddresses, setSweepAddresses] = useState<SweepAddress[]>([]);
  const [sweepLoading, setSweepLoading] = useState(false);
  const [sweepExecuting, setSweepExecuting] = useState(false);
  const [sweepResult, setSweepResult] = useState<SweepResult | null>(null);

  // ── 数据加载 ──────────────────────────────────────────────────
  const fetchStatus = useCallback(async () => {
    setStatusLoading(true); setStatusError(null);
    try {
      const res = await adminApi.get<BlockchainStatus>('/blockchain/status');
      setStatus(res.data);
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : '获取区块链状态失败');
    } finally { setStatusLoading(false); }
  }, []);

  const fetchGasBalances = useCallback(async () => {
    setGasLoading(true);
    try {
      const res = await adminApi.get<{ chains: ChainBalance[] }>('/blockchain/withdraw-wallet/balance');
      setGasBalances(res.data?.chains ?? []);
    } catch { /* 静默 */ } finally { setGasLoading(false); }
  }, []);

  const fetchSweepConfig = useCallback(async () => {
    setSweepConfigLoading(true);
    try {
      const res = await adminApi.get<SweepConfig>('/blockchain/sweep/config');
      setSweepConfig(res.data);
      setConfigForm(res.data);
    } catch { /* 静默 */ } finally { setSweepConfigLoading(false); }
  }, []);

  const fetchSweepBalance = useCallback(async () => {
    setSweepBalanceLoading(true);
    try {
      const res = await adminApi.get<SweepConfigBalance>('/blockchain/sweep/config/balance');
      setSweepBalance(res.data);
    } catch { /* 静默 */ } finally { setSweepBalanceLoading(false); }
  }, []);

  const refreshAll = useCallback(() => {
    fetchStatus(); fetchGasBalances(); fetchSweepBalance();
  }, [fetchStatus, fetchGasBalances, fetchSweepBalance]);

  useEffect(() => {
    refreshAll(); fetchSweepConfig();
    const id = setInterval(refreshAll, 30_000);
    return () => clearInterval(id);
  }, [refreshAll, fetchSweepConfig]);

  // ── 启动/停止监听 ─────────────────────────────────────────────
  const handleToggle = async () => {
    const action = status?.isListening ? 'stop' : 'start';
    setActionLoading(action);
    try {
      await adminApi.post(`/blockchain/${action}`, {});
      toast.success(action === 'start' ? '监听已启动' : '监听已停止');
      await fetchStatus();
    } catch (err) { toast.error(err instanceof Error ? err.message : '操作失败'); }
    finally { setActionLoading(null); }
  };

  // ── 保存归集地址配置 ──────────────────────────────────────────
  const handleSaveConfig = async () => {
    setConfigSaving(true);
    try {
      const res = await adminApi.put<SweepConfig>('/blockchain/sweep/config', configForm);
      setSweepConfig(res.data);
      setShowConfigModal(false);
      toast.success('归集地址已更新');
      fetchSweepBalance();
    } catch (err) { toast.error(err instanceof Error ? err.message : '保存失败'); }
    finally { setConfigSaving(false); }
  };

  // ── 扫描归集 ──────────────────────────────────────────────────
  const handleScanSweep = async () => {
    setSweepLoading(true); setSweepAddresses([]); setSweepResult(null);
    try {
      const res = await adminApi.get<{ addresses: SweepAddress[] }>('/blockchain/sweep/scan');
      const addrs = res.data?.addresses ?? [];
      setSweepAddresses(addrs);
      toast.success(addrs.length === 0 ? '扫描完成，暂无可归集余额' : `发现 ${addrs.length} 个有余额的地址`);
    } catch (err) { toast.error(err instanceof Error ? err.message : '扫描失败'); }
    finally { setSweepLoading(false); }
  };

  const handleExecuteSweep = async () => {
    setSweepExecuting(true); setSweepResult(null);
    try {
      const res = await adminApi.post<SweepResult>('/blockchain/sweep/execute', {});
      setSweepResult(res.data);
      toast.success(`归集完成，共转移 ${res.data?.totalUsdt ?? '0'} USDT`);
      fetchSweepBalance(); fetchGasBalances();
    } catch (err) { toast.error(err instanceof Error ? err.message : '归集失败'); }
    finally { setSweepExecuting(false); }
  };

  // ── 渲染 ──────────────────────────────────────────────────────
  const connectedChains = status?.chains?.filter(c => c.connected).length ?? 0;
  const tronCount = status?.tronEnabled ? 1 : 0;
  const totalChains = (status?.chains?.length ?? 0) + tronCount;

  return (
    <div className="p-6 space-y-6">
      <AdminPageHeader
        title="区块链监控"
        icon={Radio}
        subtitle="链上监听状态与钱包余额实时监控"
        onRefresh={refreshAll}
        actions={status && (
          <button
            onClick={handleToggle}
            disabled={!!actionLoading || statusLoading}
            className={`flex items-center gap-2 px-4 py-2 text-sm rounded-lg border transition-colors disabled:opacity-50 ${
              status.isListening
                ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/20'
                : 'bg-green-500/10 hover:bg-green-500/20 text-green-400 border-green-500/20'
            }`}
          >
            {actionLoading ? <RefreshCw size={14} className="animate-spin" /> : status.isListening ? <Square size={14} /> : <Play size={14} />}
            {status.isListening ? '停止监听' : '启动监听'}
          </button>
        )}
      />

      {/* 状态概览 */}
      {statusLoading && !status ? <AdminSkeleton mode="grid" count={4} cols={4} /> :
        statusError ? <AdminErrorState message={statusError} onRetry={fetchStatus} /> :
        status ? (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <AdminStatCard title="监听状态" value={status.isListening ? '运行中' : '已停止'}
                icon={status.isListening ? CheckCircle : XCircle}
                color={status.isListening ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'} />
              <AdminStatCard title="已连接链" value={`${connectedChains + tronCount} / ${totalChains}`}
                icon={LinkIcon} color="bg-cyan-500/20 text-cyan-400" />
              <AdminStatCard title="缓存地址数" value={status.cachedAddresses}
                icon={Cpu} color="bg-blue-500/20 text-blue-400" />
              <AdminStatCard title="HD钱包" value={status.hdWallet ? '已初始化' : '未初始化'}
                icon={Wallet}
                color={status.hdWallet ? 'bg-purple-500/20 text-purple-400' : 'bg-[#9090A0]/20 text-[#9090A0]'} />
            </div>

            {/* 链状态详情 */}
            <div className="bg-[#12121A] border border-[#1E1E2E] rounded-xl p-5">
              <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                <Radio size={14} className="text-cyan-400" />链状态详情
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {status.chains.map(chain => {
                  const style = getChainStyle(chain.name);
                  return (
                    <div key={chain.name} className={`flex items-start gap-3 p-4 rounded-lg border ${style.bg}`}>
                      <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${chain.connected ? style.dot : 'bg-[#4A4A5A]'}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-sm font-bold ${style.text}`}>{chain.name}</span>
                          {chain.connected
                            ? <span className="flex items-center gap-1 text-xs text-green-400"><CheckCircle size={11} />已连接</span>
                            : <span className="flex items-center gap-1 text-xs text-red-400"><XCircle size={11} />断开</span>}
                        </div>
                        {chain.tokens.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {chain.tokens.map(token => (
                              <span key={token} className="px-1.5 py-0.5 bg-[#1A1A24] text-[#9090A0] text-xs rounded font-mono">{token}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                {status.tronEnabled && (
                  <div className={`flex items-start gap-3 p-4 rounded-lg border ${getChainStyle('TRON').bg}`}>
                    <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${getChainStyle('TRON').dot}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-sm font-bold ${getChainStyle('TRON').text}`}>TRON</span>
                        <span className="flex items-center gap-1 text-xs text-green-400"><CheckCircle size={11} />已连接</span>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        <span className="px-1.5 py-0.5 bg-[#1A1A24] text-[#9090A0] text-xs rounded font-mono">USDT</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : null}

      {/* ── 归集地址余额 ── */}
      <div className="bg-[#12121A] border border-[#1E1E2E] rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Wallet size={14} className="text-cyan-400" />归集地址余额
            <span className="text-xs text-[#9090A0] font-normal">用户资金最终汇入的钱包</span>
            {sweepBalanceLoading && <RefreshCw size={12} className="text-[#9090A0] animate-spin" />}
          </h3>
          <button
            onClick={() => { setConfigForm(sweepConfig); setShowConfigModal(true); }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-[#2A2A3A] text-[#9090A0] hover:text-white hover:border-cyan-500/30 transition-colors"
          >
            <Settings size={12} />修改归集地址
          </button>
        </div>

        {sweepConfigLoading || sweepBalanceLoading ? (
          <AdminSkeleton mode="table" count={2} />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1E1E2E]">
                <th className="text-left py-2 px-3 text-xs text-[#9090A0] font-medium">链</th>
                <th className="text-left py-2 px-3 text-xs text-[#9090A0] font-medium">归集地址</th>
                <th className="text-right py-2 px-3 text-xs text-[#9090A0] font-medium">USDT 余额</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E1E2E]">
              {/* BSC / EVM */}
              <tr className="hover:bg-[#1A1A24] transition-colors">
                <td className="py-3 px-3"><span className="text-xs font-bold text-yellow-400">BSC</span></td>
                <td className="py-3 px-3">
                  {sweepConfig.evmAddress
                    ? <span className="text-xs text-[#9090A0] font-mono break-all">{sweepConfig.evmAddress}</span>
                    : <span className="text-xs text-red-400 italic">未配置</span>}
                </td>
                <td className="py-3 px-3 text-right">
                  <span className="text-xs font-mono text-white">
                    {sweepBalance.evm ? parseFloat(sweepBalance.evm.usdt).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
                  </span>
                </td>
              </tr>
              {/* TRON */}
              <tr className="hover:bg-[#1A1A24] transition-colors">
                <td className="py-3 px-3"><span className="text-xs font-bold text-red-400">TRON</span></td>
                <td className="py-3 px-3">
                  {sweepConfig.tronAddress
                    ? <span className="text-xs text-[#9090A0] font-mono break-all">{sweepConfig.tronAddress}</span>
                    : <span className="text-xs text-red-400 italic">未配置</span>}
                </td>
                <td className="py-3 px-3 text-right">
                  <span className="text-xs font-mono text-white">
                    {sweepBalance.tron ? parseFloat(sweepBalance.tron.usdt).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        )}
      </div>

      {/* ── Gas 钱包余额（归集手续费发送方） ── */}
      <div className="bg-[#12121A] border border-[#1E1E2E] rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <Zap size={14} className="text-yellow-400" />Gas 钱包余额
          <span className="text-xs text-[#9090A0] font-normal">向派生地址发送手续费的钱包，需保持足量 BNB / TRX</span>
          {gasLoading && <RefreshCw size={12} className="text-[#9090A0] animate-spin" />}
        </h3>
        {gasBalances.length === 0 && !gasLoading ? (
          <div className="flex items-center gap-2 py-4 text-sm text-[#9090A0]">
            <AlertTriangle size={14} className="text-yellow-400" />Gas 钱包未配置或查询失败
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1E1E2E]">
                  <th className="text-left py-2 px-3 text-xs text-[#9090A0] font-medium">链</th>
                  <th className="text-left py-2 px-3 text-xs text-[#9090A0] font-medium">地址</th>
                  <th className="text-right py-2 px-3 text-xs text-[#9090A0] font-medium">Gas 余额</th>
                  <th className="text-right py-2 px-3 text-xs text-[#9090A0] font-medium">USDT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E1E2E]">
                {gasBalances.map(b => {
                  const style = getChainStyle(b.chain);
                  const gasLow = parseFloat(b.gasBalance) < 0.01;
                  return (
                    <tr key={b.chain} className="hover:bg-[#1A1A24] transition-colors">
                      <td className="py-3 px-3"><span className={`text-xs font-bold ${style.text}`}>{b.chain}</span></td>
                      <td className="py-3 px-3"><span className="text-xs text-[#9090A0] font-mono break-all">{b.address}</span></td>
                      <td className="py-3 px-3 text-right">
                        <span className={`text-xs font-mono ${gasLow ? 'text-red-400' : 'text-white'}`}>
                          {parseFloat(b.gasBalance).toFixed(6)} {b.gasSymbol}
                        </span>
                        {gasLow && <AlertTriangle size={11} className="inline-block ml-1 text-yellow-400" title="Gas 不足，归集前请充值" />}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <span className="text-xs font-mono text-[#9090A0]">
                          {parseFloat(b.usdt).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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

      {/* ── 一键归集 ── */}
      <div className="bg-[#12121A] border border-[#1E1E2E] rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Layers size={14} className="text-cyan-400" />一键归集
            <span className="text-xs text-[#9090A0] font-normal">将充值（派生）地址余额转入归集地址</span>
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

        {sweepLoading ? <AdminSkeleton mode="table" count={3} /> :
          sweepAddresses.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1E1E2E]">
                    <th className="text-left py-2 px-3 text-xs text-[#9090A0] font-medium">链</th>
                    <th className="text-left py-2 px-3 text-xs text-[#9090A0] font-medium">派生地址</th>
                    <th className="text-right py-2 px-3 text-xs text-[#9090A0] font-medium">USDT</th>
                    <th className="text-right py-2 px-3 text-xs text-[#9090A0] font-medium">Gas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E1E2E]">
                  {sweepAddresses.map((a, i) => {
                    const style = getChainStyle(a.chain);
                    return (
                      <tr key={i} className="hover:bg-[#1A1A24] transition-colors">
                        <td className="py-2 px-3"><span className={`text-xs font-bold ${style.text}`}>{a.chain}</span></td>
                        <td className="py-2 px-3 max-w-xs"><span className="text-xs text-[#9090A0] font-mono break-all">{a.address}</span></td>
                        <td className="py-2 px-3 text-right"><span className="text-xs font-mono text-white">{parseFloat(a.usdt).toFixed(2)}</span></td>
                        <td className="py-2 px-3 text-right"><span className="text-xs font-mono text-[#9090A0]">{parseFloat(a.gasBalance).toFixed(6)} {a.gasSymbol}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : sweepResult ? null : (
            <p className="text-sm text-[#9090A0] text-center py-6">点击「扫描余额」查找有余额的派生地址</p>
          )}

        {sweepResult && (
          <div className="mt-4 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
            <p className="text-sm text-green-400 font-medium mb-2">
              归集完成 — 共扫描 {sweepResult.scanned} 个地址，成功 {sweepResult.swept} 个，转移 {sweepResult.totalUsdt} USDT
            </p>
            {sweepResult.results?.length > 0 && (
              <div className="space-y-1 mt-2 max-h-40 overflow-y-auto">
                {sweepResult.results.map((r, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    {r.status === 'success'
                      ? <CheckCircle size={11} className="text-green-400 shrink-0" />
                      : <XCircle size={11} className="text-red-400 shrink-0" />}
                    <span className="text-[#9090A0] font-mono break-all">{r.address}</span>
                    <span className={`ml-auto shrink-0 ${r.status === 'success' ? 'text-green-400' : 'text-red-400'}`}>
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

      {/* ── 修改归集地址弹窗 ── */}
      {showConfigModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#12121A] border border-[#1E1E2E] rounded-xl w-full max-w-lg">
            <div className="flex items-center justify-between p-5 border-b border-[#1E1E2E]">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Settings size={14} className="text-cyan-400" />修改归集地址
              </h3>
              <button onClick={() => setShowConfigModal(false)} className="text-[#9090A0] hover:text-white transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="p-5 space-y-5">
              {/* EVM */}
              <div>
                <label className="flex items-center gap-2 text-xs font-semibold mb-2">
                  <span className="text-yellow-400">BSC / ETH</span>
                  <span className="text-[#9090A0] font-normal">EVM 链归集地址（0x...）</span>
                </label>
                <input
                  type="text"
                  value={configForm.evmAddress}
                  onChange={e => setConfigForm(f => ({ ...f, evmAddress: e.target.value }))}
                  placeholder="0x..."
                  className="w-full px-3 py-2.5 bg-[#0A0A0F] border border-[#2A2A3A] rounded-lg text-xs font-mono text-white placeholder-[#4A4A5A] focus:outline-none focus:border-cyan-500/50"
                />
              </div>
              {/* TRON */}
              <div>
                <label className="flex items-center gap-2 text-xs font-semibold mb-2">
                  <span className="text-red-400">TRON</span>
                  <span className="text-[#9090A0] font-normal">TRON 链归集地址（T...）</span>
                </label>
                <input
                  type="text"
                  value={configForm.tronAddress}
                  onChange={e => setConfigForm(f => ({ ...f, tronAddress: e.target.value }))}
                  placeholder="T..."
                  className="w-full px-3 py-2.5 bg-[#0A0A0F] border border-[#2A2A3A] rounded-lg text-xs font-mono text-white placeholder-[#4A4A5A] focus:outline-none focus:border-cyan-500/50"
                />
              </div>
              <p className="text-xs text-[#4A4A5A]">
                * 派生地址由 HD 钱包助记词自动生成，不在此修改。归集地址为用户充值资金的最终目标钱包。
              </p>
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-[#1E1E2E]">
              <button
                onClick={() => setShowConfigModal(false)}
                className="px-4 py-2 text-xs rounded-lg border border-[#2A2A3A] text-[#9090A0] hover:text-white transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSaveConfig}
                disabled={configSaving}
                className="flex items-center gap-1.5 px-4 py-2 text-xs rounded-lg bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/30 transition-colors disabled:opacity-50"
              >
                {configSaving ? <RefreshCw size={12} className="animate-spin" /> : <Save size={12} />}
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
