'use client';

import { Brain, FlaskConical, Bot, ArrowRight } from 'lucide-react';

interface AiDashboardCardsProps {
  onResearchClick?: () => void;
  onStrategyClick?: () => void;
}

export function AiDashboardCards({
  onResearchClick,
  onStrategyClick,
}: AiDashboardCardsProps) {
  return (
    <div className="space-y-3">
      {/* Section Title */}
      <div className="flex items-center gap-2">
        <Brain className="w-4 h-4 text-[#94A3B8]" />
        <h2 className="text-[#94A3B8] text-xs uppercase tracking-wider font-medium">
          AI 交易
        </h2>
      </div>

      {/* Two Cards Grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* AI Research Card */}
        <button
          onClick={onResearchClick}
          className="group bg-[#12121A] border border-[#1E1E2E] rounded-xl p-4
                     hover:border-cyan-400/30 hover:scale-[1.02]
                     transition-all duration-200 text-left flex flex-col h-full"
        >
          {/* Icon */}
          <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center mb-3">
            <FlaskConical className="w-5 h-5 text-cyan-400" />
          </div>

          {/* Content */}
          <div className="flex-1 space-y-2">
            <h3 className="text-white font-semibold text-sm">AI 研究</h3>
            <p className="text-[#94A3B8] text-xs leading-relaxed">
              让 AI 团队分析任意币种
            </p>
          </div>

          {/* Action */}
          <div className="flex items-center gap-1 text-cyan-400 text-xs font-medium mt-3 pt-3 border-t border-[#1E1E2E]">
            <span>开始研究</span>
            <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </button>

        {/* AI Strategy Card */}
        <button
          onClick={onStrategyClick}
          className="group bg-[#12121A] border border-[#1E1E2E] rounded-xl p-4
                     hover:border-cyan-400/30 hover:scale-[1.02]
                     transition-all duration-200 text-left flex flex-col h-full"
        >
          {/* Icon */}
          <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center mb-3">
            <Bot className="w-5 h-5 text-cyan-400" />
          </div>

          {/* Content */}
          <div className="flex-1 space-y-2">
            <h3 className="text-white font-semibold text-sm">AI 策略</h3>
            <p className="text-[#94A3B8] text-xs leading-relaxed">
              AI 自动交易 7×24 小时
            </p>
          </div>

          {/* Action */}
          <div className="flex items-center gap-1 text-cyan-400 text-xs font-medium mt-3 pt-3 border-t border-[#1E1E2E]">
            <span>查看策略</span>
            <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </button>
      </div>
    </div>
  );
}
