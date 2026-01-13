'use client';

import { TrendingUp, TrendingDown, Users, Zap, Shield, Target } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface StrategyCardV2Props {
  id: string;
  name: string;
  description?: string;
  riskLevel: 'low' | 'medium' | 'high';
  type: 'spot' | 'futures' | 'ai';
  annualReturn: { min: number; max: number };
  maxDrawdown: number;
  winRate: number;
  sharpeRatio: number;
  userCount: number;
  sparklineData?: number[];
  isSubscribed?: boolean;
  isPro?: boolean;
}

/**
 * 策略卡片 V2 - 高保真设计
 * 专业量化策略展示，含迷你收益曲线
 */
export function StrategyCardV2({
  id,
  name,
  description,
  riskLevel,
  type,
  annualReturn,
  maxDrawdown,
  winRate,
  sharpeRatio,
  userCount,
  sparklineData = [],
  isSubscribed = false,
  isPro = false,
}: StrategyCardV2Props) {
  const router = useRouter();

  // 风险等级配置
  const riskConfig = {
    low: { label: '低风险', color: 'text-success', bgColor: 'bg-success/10', borderColor: 'border-success/30' },
    medium: { label: '中风险', color: 'text-warning', bgColor: 'bg-warning/10', borderColor: 'border-warning/30' },
    high: { label: '高风险', color: 'text-danger', bgColor: 'bg-danger/10', borderColor: 'border-danger/30' },
  };

  // 类型配置
  const typeConfig = {
    spot: { label: '现货', icon: Shield, color: 'text-success' },
    futures: { label: '合约', icon: Zap, color: 'text-warning' },
    ai: { label: 'AI', icon: Target, color: 'text-purple-400' },
  };

  const risk = riskConfig[riskLevel];
  const typeInfo = typeConfig[type];
  const TypeIcon = typeInfo.icon;

  // 生成迷你 Sparkline
  const renderSparkline = () => {
    if (sparklineData.length < 2) return null;

    const min = Math.min(...sparklineData);
    const max = Math.max(...sparklineData);
    const range = max - min || 1;
    const width = 80;
    const height = 24;

    const points = sparklineData.map((value, index) => {
      const x = (index / (sparklineData.length - 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${x},${y}`;
    }).join(' ');

    const isPositive = sparklineData[sparklineData.length - 1] >= sparklineData[0];

    return (
      <svg width={width} height={height} className="overflow-visible">
        <polyline
          points={points}
          fill="none"
          stroke={isPositive ? '#00C087' : '#F23645'}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  };

  return (
    <div
      className="group relative rounded-xl p-4 bg-bg-secondary border border-border-primary
                 transition-all duration-300 hover:-translate-y-1 hover:border-brand-primary/50
                 hover:shadow-[0_0_20px_rgba(55,114,255,0.15)] cursor-pointer"
      onClick={() => router.push(`/strategies/${id}`)}
    >
      {/* Pro 标记 */}
      {isPro && (
        <div className="absolute -top-2 -right-2 px-2 py-0.5 text-xs font-bold rounded-full bg-gradient-to-r from-warning to-orange-400 text-white shadow-lg">
          PRO
        </div>
      )}

      {/* 头部：名称 + 标签 */}
      <div className="mb-3">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="text-lg font-bold text-white truncate">{name}</h3>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* 风险等级 */}
          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${risk.bgColor} ${risk.color}`}>
            {risk.label}
          </span>
          {/* 类型 */}
          <span className={`px-2 py-0.5 text-xs font-medium rounded-full bg-bg-tertiary ${typeInfo.color} flex items-center gap-1`}>
            <TypeIcon className="w-3 h-3" />
            {typeInfo.label}
          </span>
          {/* 已订阅 */}
          {isSubscribed && (
            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-brand-primary/20 text-brand-primary">
              已订阅
            </span>
          )}
        </div>
      </div>

      {/* 核心指标网格 */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {/* 年化收益 */}
        <div className="p-2.5 rounded-lg bg-bg-tertiary">
          <p className="text-xs text-text-tertiary mb-1">历史年化</p>
          <div className="flex items-baseline gap-1">
            <TrendingUp className="w-3.5 h-3.5 text-success" />
            <span className="text-lg font-bold text-success font-mono">
              {annualReturn.min}-{annualReturn.max}%
            </span>
          </div>
        </div>

        {/* 最大回撤 */}
        <div className="p-2.5 rounded-lg bg-bg-tertiary">
          <p className="text-xs text-text-tertiary mb-1">最大回撤</p>
          <div className="flex items-baseline gap-1">
            <TrendingDown className="w-3.5 h-3.5 text-danger" />
            <span className="text-lg font-bold text-danger font-mono">
              {maxDrawdown}%
            </span>
          </div>
        </div>

        {/* 胜率 */}
        <div className="p-2.5 rounded-lg bg-bg-tertiary">
          <p className="text-xs text-text-tertiary mb-1">胜率</p>
          <span className="text-lg font-bold text-white font-mono">{winRate}%</span>
        </div>

        {/* 夏普比率 */}
        <div className="p-2.5 rounded-lg bg-bg-tertiary">
          <p className="text-xs text-text-tertiary mb-1">夏普比率</p>
          <span className="text-lg font-bold text-white font-mono">{sharpeRatio.toFixed(1)}</span>
        </div>
      </div>

      {/* 迷你收益曲线 + 用户数 */}
      <div className="flex items-center justify-between">
        <div className="flex-shrink-0">
          {renderSparkline()}
        </div>
        <div className="flex items-center gap-1.5 text-text-secondary">
          <Users className="w-4 h-4" />
          <span className="text-sm font-medium">{userCount.toLocaleString()}</span>
        </div>
      </div>

      {/* 底部操作按钮 */}
      <div className="mt-4 pt-3 border-t border-border-primary">
        <button
          className={`w-full py-2.5 rounded-lg font-medium text-sm transition-all duration-200
            ${isSubscribed
              ? 'bg-bg-tertiary text-text-secondary hover:bg-bg-tertiary/80'
              : 'bg-brand-primary text-white hover:bg-brand-secondary shadow-[0_0_12px_rgba(55,114,255,0.3)]'
            }`}
          onClick={(e) => {
            e.stopPropagation();
            if (!isSubscribed) {
              router.push(`/strategies/${id}`);
            }
          }}
        >
          {isSubscribed ? '查看详情' : '使用此策略'}
        </button>
      </div>
    </div>
  );
}

export default StrategyCardV2;
