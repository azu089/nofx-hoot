'use client'

import { useState } from 'react'
import {
  ArrowLeft,
  Star,
  Users,
  Shield,
  BarChart3,
  Clock,
  Target,
  Activity,
  Play,
  Calendar,
  Check,
  AlertCircle
} from 'lucide-react'

interface TradeRecord {
  pair: string
  side: 'buy' | 'sell'
  entry: number
  exit: number
  pnl: number
  date: string
}

interface MonthlyReturn {
  month: string
  return: number
}

interface MobileStrategyDetailProps {
  onBack?: () => void
  onUseStrategy?: (id: string) => void
}

// 策略详情数据
const strategyData = {
  id: '1',
  name: 'RSI 智能抄底策略',
  author: 'Hoot Labs',
  authorVerified: true,
  description: '基于 RSI 超卖信号的智能抄底策略，结合多时间周期确认和动态止损，适合震荡市和回调买入。',
  tags: ['低风险', '现货', '抄底'],
  rating: 4.8,
  reviewCount: 256,
  subscribers: 1234,
  createdAt: '2025-06-01',

  // 性能指标
  performance: {
    monthlyReturn: 18.5,
    totalReturn: 156.8,
    maxDrawdown: -8.2,
    sharpeRatio: 2.1,
    winRate: 68.5,
    profitFactor: 2.3,
    avgHoldingDays: 3.2,
    totalTrades: 486,
  },

  // 支持的交易对
  supportedPairs: ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT', 'XRP/USDT'],

  // 策略特性
  features: [
    '自动信号执行',
    '可配置止损止盈',
    '实时交易通知',
    '多交易对支持',
    '风控参数自定义'
  ],

  // 月度收益
  monthlyReturns: [
    { month: '2025-07', return: 12.5 },
    { month: '2025-08', return: -3.2 },
    { month: '2025-09', return: 18.7 },
    { month: '2025-10', return: 8.9 },
    { month: '2025-11', return: 22.1 },
    { month: '2025-12', return: 15.3 },
    { month: '2026-01', return: 10.8 },
  ] as MonthlyReturn[],

  // 最近交易
  recentTrades: [
    { pair: 'BTC/USDT', side: 'buy' as const, entry: 42150, exit: 43280, pnl: 2.68, date: '2026-01-27' },
    { pair: 'ETH/USDT', side: 'buy' as const, entry: 2350, exit: 2420, pnl: 2.98, date: '2026-01-26' },
    { pair: 'SOL/USDT', side: 'buy' as const, entry: 98.5, exit: 95.2, pnl: -3.35, date: '2026-01-25' },
    { pair: 'BNB/USDT', side: 'buy' as const, entry: 315, exit: 328, pnl: 4.13, date: '2026-01-24' },
    { pair: 'XRP/USDT', side: 'buy' as const, entry: 0.52, exit: 0.55, pnl: 5.77, date: '2026-01-23' },
  ] as TradeRecord[],
}

export function MobileStrategyDetail({
  onBack,
  onUseStrategy
}: MobileStrategyDetailProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'performance' | 'trades'>('overview')

  const maxReturn = Math.max(...strategyData.monthlyReturns.map(m => Math.abs(m.return)))

  const tabs = [
    { id: 'overview' as const, label: '策略概览' },
    { id: 'performance' as const, label: '历史表现' },
    { id: 'trades' as const, label: '交易记录' },
  ]

  const renderOverviewTab = () => (
    <div className="space-y-4">
      {/* 策略说明 */}
      <div className="bg-[#12121A]/80 backdrop-blur-sm border border-[#1E1E2E] rounded-xl p-4">
        <h3 className="text-[#F8F8FC] font-semibold mb-3 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-[#06B6D4]" />
          策略说明
        </h3>
        <p className="text-[#9090A0] text-sm leading-relaxed">
          {strategyData.description}
        </p>
      </div>

      {/* 支持的交易对 */}
      <div className="bg-[#12121A]/80 backdrop-blur-sm border border-[#1E1E2E] rounded-xl p-4">
        <h3 className="text-[#F8F8FC] font-semibold mb-3 flex items-center gap-2">
          <Target className="w-4 h-4 text-[#06B6D4]" />
          支持的交易对
        </h3>
        <div className="flex flex-wrap gap-2">
          {strategyData.supportedPairs.map((pair) => (
            <span
              key={pair}
              className="px-3 py-1 bg-[#06B6D4]/10 border border-[#06B6D4]/20 rounded-lg text-[#06B6D4] text-xs font-mono"
            >
              {pair}
            </span>
          ))}
        </div>
      </div>

      {/* 策略特性 */}
      <div className="bg-[#12121A]/80 backdrop-blur-sm border border-[#1E1E2E] rounded-xl p-4">
        <h3 className="text-[#F8F8FC] font-semibold mb-3 flex items-center gap-2">
          <Check className="w-4 h-4 text-[#10B981]" />
          策略特性
        </h3>
        <ul className="space-y-2">
          {strategyData.features.map((feature, index) => (
            <li key={index} className="flex items-center gap-2 text-[#9090A0] text-sm">
              <Check className="w-3.5 h-3.5 text-[#10B981]" />
              {feature}
            </li>
          ))}
        </ul>
      </div>

      {/* 快速信息 */}
      <div className="bg-[#12121A]/80 backdrop-blur-sm border border-[#1E1E2E] rounded-xl p-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[#9090A0] text-sm flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              创建时间
            </span>
            <span className="text-sm text-[#F8F8FC]">{strategyData.createdAt}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[#9090A0] text-sm flex items-center gap-2">
              <Clock className="w-4 h-4" />
              运行时长
            </span>
            <span className="text-sm text-[#F8F8FC]">8 个月</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[#9090A0] text-sm flex items-center gap-2">
              <Shield className="w-4 h-4" />
              风险等级
            </span>
            <span className="px-2 py-0.5 rounded text-xs bg-[#10B981]/20 text-[#10B981]">
              低风险
            </span>
          </div>
        </div>
      </div>

      {/* 风险提示 */}
      <div className="bg-[#F59E0B]/5 border border-[#F59E0B]/20 rounded-xl p-4">
        <h3 className="text-[#F59E0B] font-semibold mb-3 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          风险提示
        </h3>
        <p className="text-[#9090A0] text-sm leading-relaxed">
          历史收益不代表未来表现。量化交易存在风险，请根据自身风险承受能力谨慎投资。
          建议新用户先使用小额资金测试策略效果。
        </p>
      </div>
    </div>
  )

  const renderPerformanceTab = () => (
    <div className="space-y-4">
      {/* 月度收益图表 */}
      <div className="bg-[#12121A]/80 backdrop-blur-sm border border-[#1E1E2E] rounded-xl p-4">
        <h3 className="text-[#F8F8FC] font-semibold mb-4">月度收益率 (%)</h3>
        <div className="space-y-3">
          {strategyData.monthlyReturns.map((item) => (
            <div key={item.month} className="flex items-center gap-3">
              <span className="text-[#9090A0] text-xs w-8 flex-shrink-0">
                {item.month.slice(5)}月
              </span>
              <div className="flex-1 flex items-center gap-2">
                <div className="flex-1 bg-[#1E1E2E] rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      item.return >= 0 ? 'bg-[#10B981]' : 'bg-[#F43F5E]'
                    }`}
                    style={{
                      width: `${(Math.abs(item.return) / maxReturn) * 100}%`
                    }}
                  />
                </div>
                <span
                  className={`text-xs font-medium font-mono w-14 text-right ${
                    item.return >= 0 ? 'text-[#10B981]' : 'text-[#F43F5E]'
                  }`}
                >
                  {item.return > 0 ? '+' : ''}{item.return}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 详细数据 */}
      <div className="bg-[#12121A]/80 backdrop-blur-sm border border-[#1E1E2E] rounded-xl p-4">
        <h3 className="text-[#F8F8FC] font-semibold mb-4">详细数据</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-[#1E1E2E]/50 rounded-lg p-3 text-center">
            <div className="text-[#10B981] text-lg font-bold font-mono">
              +{strategyData.performance.totalReturn}%
            </div>
            <div className="text-[#9090A0] text-xs mt-1">累计收益</div>
          </div>
          <div className="bg-[#1E1E2E]/50 rounded-lg p-3 text-center">
            <div className="text-[#F8F8FC] text-lg font-bold font-mono">
              {strategyData.performance.profitFactor}
            </div>
            <div className="text-[#9090A0] text-xs mt-1">盈亏比</div>
          </div>
          <div className="bg-[#1E1E2E]/50 rounded-lg p-3 text-center">
            <div className="text-[#F8F8FC] text-lg font-bold font-mono">
              {strategyData.performance.avgHoldingDays} 天
            </div>
            <div className="text-[#9090A0] text-xs mt-1">平均持仓</div>
          </div>
          <div className="bg-[#1E1E2E]/50 rounded-lg p-3 text-center">
            <div className="text-[#F8F8FC] text-lg font-bold font-mono">
              {strategyData.performance.totalTrades}
            </div>
            <div className="text-[#9090A0] text-xs mt-1">总交易次数</div>
          </div>
        </div>
      </div>
    </div>
  )

  const renderTradesTab = () => (
    <div className="space-y-4">
      <div className="bg-[#12121A]/80 backdrop-blur-sm border border-[#1E1E2E] rounded-xl p-4">
        <h3 className="text-[#F8F8FC] font-semibold mb-4 flex items-center gap-2">
          <Activity className="w-4 h-4 text-[#06B6D4]" />
          最近交易记录
        </h3>
        <div className="space-y-3">
          {strategyData.recentTrades.map((trade, index) => (
            <div
              key={index}
              className="border border-[#1E1E2E] rounded-lg p-3 space-y-2"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[#F8F8FC] font-medium text-sm font-mono">
                    {trade.pair}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium ${
                      trade.side === 'buy'
                        ? 'bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20'
                        : 'bg-[#F43F5E]/10 text-[#F43F5E] border border-[#F43F5E]/20'
                    }`}
                  >
                    {trade.side === 'buy' ? '买入' : '卖出'}
                  </span>
                </div>
                <div className="text-right">
                  <div
                    className={`text-sm font-bold font-mono ${
                      trade.pnl >= 0 ? 'text-[#10B981]' : 'text-[#F43F5E]'
                    }`}
                  >
                    {trade.pnl >= 0 ? '+' : ''}{trade.pnl}%
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs text-[#9090A0]">
                <div className="flex items-center gap-4">
                  <span>入场: <span className="text-[#F8F8FC] font-mono">${trade.entry.toLocaleString()}</span></span>
                  <span>出场: <span className="text-[#F8F8FC] font-mono">${trade.exit.toLocaleString()}</span></span>
                </div>
                <span>{trade.date}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-[#F8F8FC] flex flex-col">
      {/* 固定顶部标题栏 */}
      <div className="sticky top-0 z-20 bg-[#0A0A0F]/95 backdrop-blur-xl border-b border-[#1E1E2E]">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            type="button"
            onClick={onBack}
            title="返回"
            aria-label="返回策略市场"
            className="flex items-center gap-2 text-[#9090A0] hover:text-[#F8F8FC] transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-semibold">策略详情</h1>
          <div className="w-5" /> {/* Spacer for centering */}
        </div>
      </div>

      {/* 可滚动内容区 */}
      <div className="flex-1 overflow-auto">
        <div className="p-4 space-y-4">
          {/* 策略头部信息 */}
          <div className="space-y-2">
            {/* 策略名称 - 单独一行 */}
            <h2 className="text-xl font-bold leading-tight">{strategyData.name}</h2>

            {/* 标签 - 单独一行 */}
            <div className="flex items-center gap-2 flex-wrap">
              {strategyData.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2.5 py-1 rounded-full text-xs bg-[#06B6D4]/20 text-[#06B6D4]"
                >
                  {tag}
                </span>
              ))}
            </div>

            {/* 作者和统计 - 单独一行 */}
            <div className="flex items-center gap-3 text-sm text-[#9090A0] pt-1">
              <span className="flex items-center gap-1">
                by {strategyData.author}
                {strategyData.authorVerified && (
                  <Check className="w-4 h-4 text-[#10B981]" />
                )}
              </span>
              <span className="flex items-center gap-1">
                <Star className="w-4 h-4 text-[#F59E0B] fill-[#F59E0B]" />
                {strategyData.rating}
              </span>
              <span className="flex items-center gap-1">
                <Users className="w-4 h-4" />
                {strategyData.subscribers.toLocaleString()}
              </span>
            </div>
          </div>

          {/* 快速数据卡片 - 合并为1个卡片 */}
          <div className="bg-[#12121A]/80 backdrop-blur-sm border border-[#1E1E2E] rounded-xl p-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <p className={`text-xl font-mono font-bold ${
                  strategyData.performance.monthlyReturn >= 0 ? 'text-[#10B981]' : 'text-[#F43F5E]'
                }`}>
                  {strategyData.performance.monthlyReturn >= 0 ? '+' : ''}{strategyData.performance.monthlyReturn}%
                </p>
                <p className="text-[#9090A0] text-xs mt-1">月化收益</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-mono font-bold text-[#F43F5E]">
                  {strategyData.performance.maxDrawdown}%
                </p>
                <p className="text-[#9090A0] text-xs mt-1">最大回撤</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-mono font-bold text-[#F8F8FC]">
                  {strategyData.performance.winRate}%
                </p>
                <p className="text-[#9090A0] text-xs mt-1">胜率</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-mono font-bold text-[#F8F8FC]">
                  {strategyData.performance.sharpeRatio}
                </p>
                <p className="text-[#9090A0] text-xs mt-1">夏普比率</p>
              </div>
            </div>
          </div>

          {/* Tab 切换 */}
          <div className="flex border-b border-[#1E1E2E]">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 pb-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  activeTab === tab.id
                    ? 'text-[#F8F8FC] border-[#06B6D4]'
                    : 'text-[#9090A0] border-transparent'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab 内容 */}
          {activeTab === 'overview' && renderOverviewTab()}
          {activeTab === 'performance' && renderPerformanceTab()}
          {activeTab === 'trades' && renderTradesTab()}
        </div>
      </div>

      {/* 底部按钮 - 不使用 fixed 定位，让它留在页面流中 */}
      <div className="bg-[#0A0A0F]/95 backdrop-blur-xl border-t border-[#1E1E2E] p-4">
        <button
          type="button"
          onClick={() => onUseStrategy?.(strategyData.id)}
          className="w-full py-3 bg-gradient-to-r from-[#06B6D4] to-[#0891B2] text-white font-semibold rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-opacity shadow-[0_0_20px_rgba(6,182,212,0.3)]"
        >
          <Play className="w-5 h-5" />
          立即使用
        </button>
      </div>
    </div>
  )
}
