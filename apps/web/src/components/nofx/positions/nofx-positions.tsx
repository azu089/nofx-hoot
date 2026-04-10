'use client';

/**
 * NofxPositions —— P6c 替换 /trading 持仓页的只读视图。
 *
 * 数据流：
 *   useNofxTraders → 用户选 trader（默认第一个）
 *   useNofxPositions(traderId) → 当前持仓表
 *   useNofxAccount(traderId) → 顶部摘要
 *
 * 写功能（手动平仓）由 P6b-2 一起做（带确认弹窗 + HOOT api 限流）。
 * P6c 阶段所有操作按钮 disabled + 标记 "P6b-2 待实装"。
 *
 * 字段渲染策略：复用 nofx upstream 的字段名，宽松解析数值，禁止 parseFloat 算资金。
 */

import { useState } from 'react';
import { useTranslations } from '@/i18n/provider';
import { toast } from 'sonner';
import {
  useNofxTraders,
  useNofxAccount,
  useNofxPositions,
  useClosePosition,
} from '@/lib/nofx/hooks';

export function NofxPositions() {
  const t = useTranslations('nofxPositions');
  const tradersQ = useNofxTraders();
  const traders = tradersQ.data ?? [];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const currentId = selectedId ?? (traders[0]?.trader_id ?? null);
  const closeMut = useClosePosition();
  const [closeConfirm, setCloseConfirm] = useState<{
    symbol: string;
    side: string;
  } | null>(null);

  const accountQ = useNofxAccount(currentId);
  const positionsQ = useNofxPositions(currentId);

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white p-4 md:p-6 space-y-4 md:space-y-6">
      <header className="border-b border-[#1E1E2E] pb-3 md:pb-4 flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-[#06B6D4]">
            {t('title')}
          </h1>
          <p className="text-xs md:text-sm text-[#9090A0] mt-1">{t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="/trading?legacy=1"
            className="text-xs text-[#64748B] underline hover:text-[#22D3EE]"
          >
            {t('switchToLegacy')}
          </a>
        </div>
      </header>

      {/* trader 选择 */}
      <section className="bg-[#12121A] border border-[#1E1E2E] rounded-lg p-3 md:p-4">
        {tradersQ.isLoading && <Skeleton lines={1} />}
        {tradersQ.isError && (
          <ErrorBox
            message={t('errors.tradersFailed')}
            onRetry={() => tradersQ.refetch()}
          />
        )}
        {!tradersQ.isLoading &&
          !tradersQ.isError &&
          traders.length === 0 && <EmptyBox message={t('empty.noTraders')} />}
        {traders.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-[#9090A0]">{t('traderSelect')}:</span>
            {traders.map((tr) => {
              const tid = tr.trader_id;
              const name = tr.strategy_name ?? tid.slice(0, 12);
              const isActive = tid === currentId;
              return (
                <button
                  key={tid}
                  type="button"
                  onClick={() => setSelectedId(tid)}
                  className={`px-3 py-1 rounded text-xs border transition-colors ${
                    isActive
                      ? 'bg-[#06B6D4]/20 border-[#06B6D4] text-[#22D3EE]'
                      : 'bg-[#0A0A0F] border-[#1E1E2E] text-[#9090A0] hover:border-[#06B6D4]/50'
                  }`}
                >
                  {name}
                  <span
                    className={`ml-2 inline-block w-1.5 h-1.5 rounded-full ${
                      tr.is_running ? 'bg-[#10B981]' : 'bg-[#9090A0]'
                    }`}
                  />
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* 账户摘要 */}
      <section className="bg-[#12121A] border border-[#1E1E2E] rounded-lg p-3 md:p-4">
        <h2 className="text-sm font-medium text-[#9090A0] mb-3">
          {t('accountCard.title')}
        </h2>
        {!currentId && <EmptyBox message={t('empty.selectTrader')} />}
        {currentId && accountQ.isLoading && <Skeleton lines={2} />}
        {currentId && accountQ.isError && (
          <ErrorBox
            message={t('errors.accountFailed')}
            onRetry={() => accountQ.refetch()}
          />
        )}
        {currentId && accountQ.data && (
          <pre className="text-xs text-[#9090A0] whitespace-pre-wrap break-all font-mono">
            {JSON.stringify(accountQ.data, null, 2)}
          </pre>
        )}
      </section>

      {/* 当前持仓 */}
      <section className="bg-[#12121A] border border-[#1E1E2E] rounded-lg p-3 md:p-4">
        <h2 className="text-sm font-medium text-[#9090A0] mb-3 flex items-center justify-between">
          <span>{t('openCard.title')}</span>
          {(positionsQ.data?.length ?? 0) > 0 && (
            <span className="text-[10px] text-[#64748B]">
              {positionsQ.data?.length ?? 0} {t('openCard.countSuffix')}
            </span>
          )}
        </h2>
        {!currentId && <EmptyBox message={t('empty.selectTrader')} />}
        {currentId && positionsQ.isLoading && <Skeleton lines={3} />}
        {currentId && positionsQ.isError && (
          <ErrorBox
            message={t('errors.positionsFailed')}
            onRetry={() => positionsQ.refetch()}
          />
        )}
        {currentId &&
          !positionsQ.isLoading &&
          !positionsQ.isError &&
          (positionsQ.data?.length ?? 0) === 0 && (
            <EmptyBox message={t('empty.noPositions')} />
          )}
        {currentId && (positionsQ.data?.length ?? 0) > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-[#9090A0]">
              <thead className="text-[#06B6D4]">
                <tr>
                  <th className="text-left py-1.5">{t('cols.symbol')}</th>
                  <th className="text-left py-1.5">{t('cols.side')}</th>
                  <th className="text-right py-1.5">{t('cols.size')}</th>
                  <th className="text-right py-1.5">{t('cols.entry')}</th>
                  <th className="text-right py-1.5">{t('cols.unrealized')}</th>
                  <th className="text-right py-1.5">{t('cols.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {(positionsQ.data ?? []).map((p, idx) => {
                  const pnl = num(p.unrealized_pnl);
                  return (
                    <tr key={idx} className="border-t border-[#1E1E2E]">
                      <td className="py-1.5">{String(p.symbol ?? '-')}</td>
                      <td className="py-1.5">
                        <SideBadge side={String(p.side ?? '')} />
                      </td>
                      <td className="py-1.5 text-right">{String(p.size ?? '-')}</td>
                      <td className="py-1.5 text-right">
                        {String(p.entry_price ?? '-')}
                      </td>
                      <td
                        className={`py-1.5 text-right ${
                          pnl == null ? '' : pnl >= 0 ? 'text-[#10B981]' : 'text-[#F43F5E]'
                        }`}
                      >
                        {fmtSigned(pnl)}
                      </td>
                      <td className="py-1.5 text-right">
                        <button
                          type="button"
                          disabled={closeMut.isPending}
                          onClick={() =>
                            setCloseConfirm({
                              symbol: String(p.symbol ?? ''),
                              side: String(p.side ?? ''),
                            })
                          }
                          className="text-[10px] px-2 py-0.5 rounded border border-[#F43F5E]/40 text-[#F43F5E] hover:bg-[#F43F5E]/10 transition-colors"
                        >
                          {t('actions.close')}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 平仓确认弹窗 */}
      {closeConfirm && currentId && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-[#12121A] border border-[#1E1E2E] rounded-lg p-5 max-w-sm w-full shadow-xl">
            <h3 className="text-sm font-semibold text-white">
              {t('actions.close')} {closeConfirm.symbol}
            </h3>
            <p className="mt-2 text-xs text-[#9090A0]">
              {closeConfirm.side.toUpperCase()} — {t('confirm.closeWarning')}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCloseConfirm(null)}
                disabled={closeMut.isPending}
                className="px-3 py-1.5 rounded text-xs border border-[#1E1E2E] text-[#9090A0] hover:bg-[#1E1E2E]"
              >
                取消
              </button>
              <button
                type="button"
                disabled={closeMut.isPending}
                onClick={async () => {
                  try {
                    await closeMut.mutateAsync({
                      traderId: currentId,
                      symbol: closeConfirm.symbol,
                      side: closeConfirm.side.toUpperCase(),
                    });
                    toast.success(`${closeConfirm.symbol} ${t('toast.closed')}`);
                  } catch {
                    toast.error(t('toast.closeFailed'));
                  }
                  setCloseConfirm(null);
                }}
                className={`px-3 py-1.5 rounded text-xs text-white bg-[#F43F5E] hover:bg-[#E11D48] ${closeMut.isPending ? 'opacity-50 cursor-wait' : ''}`}
              >
                {closeMut.isPending ? '...' : t('actions.close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 内联子组件
// ============================================================================

function SideBadge({ side }: { side: string }) {
  const s = side.toLowerCase();
  const isLong = s === 'long' || s === 'buy';
  const isShort = s === 'short' || s === 'sell';
  const cls = isLong
    ? 'bg-[#10B981]/15 text-[#10B981]'
    : isShort
      ? 'bg-[#F43F5E]/15 text-[#F43F5E]'
      : 'bg-[#1E1E2E] text-[#9090A0]';
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] ${cls}`}>
      {side || '-'}
    </span>
  );
}

function Skeleton({ lines }: { lines: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-3 bg-[#1E1E2E] rounded animate-pulse"
          style={{ width: `${60 + ((i * 13) % 35)}%` }}
        />
      ))}
    </div>
  );
}

function EmptyBox({ message }: { message: string }) {
  return <p className="text-xs text-[#64748B] italic">{message}</p>;
}

function ErrorBox({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="text-xs text-[#F43F5E]">
      <span>{message}</span>
      <button
        type="button"
        onClick={onRetry}
        className="ml-2 underline hover:text-[#22D3EE]"
      >
        ↻
      </button>
    </div>
  );
}

function num(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === 'string' ? Number(v) : (v as number);
  return Number.isFinite(n) ? n : null;
}

function fmtSigned(v: number | null): string {
  if (v == null) return '—';
  const sign = v >= 0 ? '+' : '';
  return `${sign}$${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}
