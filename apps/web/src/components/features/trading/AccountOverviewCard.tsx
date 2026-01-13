'use client';

interface AccountOverviewCardProps {
  equity: number;
  unrealizedPnL: number;
  realizedPnL: number;
  availableMargin: number;
}

/**
 * 账户概览卡片 - 高保真设计
 * 专业交易界面的账户总览
 */
export function AccountOverviewCard({
  equity = 0,
  unrealizedPnL = 0,
  realizedPnL = 0,
  availableMargin = 0,
}: AccountOverviewCardProps) {
  return (
    <div className="rounded-xl p-5 relative overflow-hidden bg-bg-secondary border border-border-primary">
      {/* 光球脉动效果 */}
      <div className="absolute top-0 right-0 w-48 h-48 rounded-full blur-3xl opacity-20 pointer-events-none bg-brand-primary animate-pulse" />

      <div className="relative z-10">
        {/* 主指标：账户权益 + 未实现盈亏 */}
        <div className="flex items-baseline justify-between mb-4">
          <div>
            <p className="text-sm mb-1 font-medium text-text-secondary">账户权益</p>
            <h1 className="text-4xl font-bold font-mono tracking-tight text-white">
              ${equity.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </h1>
          </div>
          <div
            className={`text-right px-3 py-1.5 rounded-lg ${
              unrealizedPnL >= 0 ? 'bg-success/10' : 'bg-danger/10'
            }`}
          >
            <p
              className={`text-lg font-bold font-mono ${
                unrealizedPnL >= 0 ? 'text-success' : 'text-danger'
              }`}
            >
              {unrealizedPnL >= 0 ? '+' : ''}
              {unrealizedPnL.toFixed(2)}
            </p>
            <p className="text-xs text-text-secondary">未实现</p>
          </div>
        </div>

        {/* 次要指标 */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs mb-1 text-text-tertiary">今日已实现</p>
            <p
              className={`text-base font-semibold font-mono ${
                realizedPnL >= 0 ? 'text-success' : 'text-danger'
              }`}
            >
              {realizedPnL >= 0 ? '+' : ''}${realizedPnL.toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-xs mb-1 text-text-tertiary">可用保证金</p>
            <p className="text-base font-semibold font-mono text-white">
              ${availableMargin.toLocaleString('en-US')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AccountOverviewCard;
