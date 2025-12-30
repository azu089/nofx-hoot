'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Button } from '@/components/ui';
import { cn } from '@/lib/utils';
import { Brain, TrendingUp, AlertTriangle } from 'lucide-react';
import { AiAnalysisModal } from './AiAnalysisModal';

/**
 * AI 交易解读卡片组件
 *
 * 功能：
 * 1. 显示每日一句（AI 生成的今日交易点评）
 * 2. 情绪得分（1-100 分，圆形进度条）
 * 3. 风险预警（根据风险得分显示提示）
 * 4. 分析按钮（展开详细分析弹窗）
 *
 * 使用方式（在 Dashboard 页面）：
 * ```tsx
 * import { AiInsightCard } from '@/components/features/dashboard';
 *
 * // 放置在概览卡片下方
 * <AiInsightCard />
 * ```
 */
export function AiInsightCard() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  // 模拟数据（实际应从 API 获取）
  const dailyInsight = '今日市场波动较大，建议降低仓位，等待信号明确后再入场。';
  const emotionalScore = 68; // 1-100
  const riskScore = 42; // 1-100

  // 根据情绪得分确定颜色
  const getEmotionalColor = (score: number): string => {
    if (score >= 70) return 'text-[var(--success)]'; // 绿色
    if (score >= 50) return 'text-[var(--warning)]'; // 黄色
    return 'text-[var(--danger)]'; // 红色
  };

  // 根据风险得分确定预警级别
  const getRiskLevel = (score: number): { label: string; color: string; bgColor: string } => {
    if (score >= 70) {
      return {
        label: '高风险',
        color: 'text-[var(--danger)]',
        bgColor: 'bg-[var(--danger-bg)]',
      };
    }
    if (score >= 40) {
      return {
        label: '中风险',
        color: 'text-[var(--warning)]',
        bgColor: 'bg-[var(--warning-bg)]',
      };
    }
    return {
      label: '低风险',
      color: 'text-[var(--success)]',
      bgColor: 'bg-[var(--success-bg)]',
    };
  };

  const riskLevel = getRiskLevel(riskScore);

  return (
    <>
      <Card className="border border-[var(--border-primary)] bg-[var(--bg-secondary)]">
        <CardHeader className="border-b border-[var(--border-primary)]">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-[var(--text-primary)]">
              <Brain className="w-5 h-5 text-[var(--brand-primary)]" />
              AI 交易解读
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsModalOpen(true)}
              className="text-sm"
            >
              详细分析
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* 每日一句 */}
          <div className="pt-4">
            <div className="flex items-start gap-2">
              <TrendingUp className="w-4 h-4 text-[var(--brand-primary)] mt-0.5 flex-shrink-0" />
              <p className="text-sm text-[var(--text-primary)] leading-relaxed">{dailyInsight}</p>
            </div>
          </div>

          {/* 情绪得分与风险预警 */}
          <div className="grid grid-cols-2 gap-4">
            {/* 情绪得分 */}
            <div className="space-y-2">
              <div className="text-xs text-[var(--text-secondary)]">情绪得分</div>
              <div className="flex items-center gap-3">
                {/* 圆形进度条 */}
                <div className="relative w-12 h-12 flex-shrink-0">
                  <svg className="w-12 h-12 transform -rotate-90">
                    {/* 背景圆环 */}
                    <circle
                      cx="24"
                      cy="24"
                      r="20"
                      fill="none"
                      stroke="var(--border-primary)"
                      strokeWidth="4"
                    />
                    {/* 进度圆环 */}
                    <circle
                      cx="24"
                      cy="24"
                      r="20"
                      fill="none"
                      stroke={
                        emotionalScore >= 70
                          ? 'var(--success)'
                          : emotionalScore >= 50
                          ? 'var(--warning)'
                          : 'var(--danger)'
                      }
                      strokeWidth="4"
                      strokeLinecap="round"
                      strokeDasharray={`${(emotionalScore / 100) * 125.6} 125.6`}
                      className="transition-all duration-500"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className={cn('text-xs font-semibold', getEmotionalColor(emotionalScore))}>
                      {emotionalScore}
                    </span>
                  </div>
                </div>
                <div>
                  <div className={cn('text-base font-semibold font-numeric', getEmotionalColor(emotionalScore))}>
                    {emotionalScore >= 70 ? '良好' : emotionalScore >= 50 ? '一般' : '较差'}
                  </div>
                  <div className="text-xs text-[var(--text-tertiary)]">交易心态稳定</div>
                </div>
              </div>
            </div>

            {/* 风险预警 */}
            <div className="space-y-2">
              <div className="text-xs text-[var(--text-secondary)]">风险预警</div>
              <div className="flex items-center gap-2">
                <AlertTriangle className={cn('w-4 h-4', riskLevel.color)} />
                <div>
                  <div className={cn('text-base font-semibold', riskLevel.color)}>{riskLevel.label}</div>
                  <div className="text-xs text-[var(--text-tertiary)]">风险得分 {riskScore}</div>
                </div>
              </div>
              <div className={cn('px-3 py-2 rounded-md text-xs', riskLevel.bgColor, riskLevel.color)}>
                {riskScore >= 70
                  ? '建议降低仓位，谨慎操作'
                  : riskScore >= 40
                  ? '保持观察，控制风险'
                  : '风险可控，可适当操作'}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 详细分析弹窗 */}
      <AiAnalysisModal open={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
}
