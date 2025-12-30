'use client';

import { useState } from 'react';
import { Modal, Button, Spinner, Empty } from '@/components/ui';
import { cn } from '@/lib/utils';
import { aiApi } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { CheckCircle, XCircle, Lightbulb, TrendingUp, AlertTriangle } from 'lucide-react';

/**
 * AI 详细分析弹窗组件
 *
 * 功能：
 * 1. 时间范围选择（7天/30天/90天）
 * 2. 分析按钮（触发 AI 分析）
 * 3. 分析结果展示：
 *    - 总体评价（summary）
 *    - 优势列表（strengths）
 *    - 不足列表（weaknesses）
 *    - 改进建议（suggestions）
 *    - 情绪得分仪表盘
 *    - 风险得分仪表盘
 */

export interface AiAnalysisModalProps {
  open: boolean;
  onClose: () => void;
}

interface AnalysisResult {
  summary: string;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  emotionalScore: number;
  riskScore: number;
}

export function AiAnalysisModal({ open, onClose }: AiAnalysisModalProps) {
  const toast = useToast();
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('7d');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  // 触发 AI 分析
  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    try {
      const response = await aiApi.analyzeTrades(timeRange);
      setResult(response.data);
      toast.success('AI 已完成交易分析');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '分析失败，请稍后重试');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // 仪表盘组件
  const Gauge = ({ score, label }: { score: number; label: string }) => {
    const getColor = (s: number): string => {
      if (s >= 70) return 'var(--success)';
      if (s >= 50) return 'var(--warning)';
      return 'var(--danger)';
    };

    return (
      <div className="flex flex-col items-center gap-2">
        <div className="relative w-20 h-20">
          <svg className="w-20 h-20 transform -rotate-90">
            {/* 背景圆环 */}
            <circle
              cx="40"
              cy="40"
              r="32"
              fill="none"
              stroke="var(--border-primary)"
              strokeWidth="6"
            />
            {/* 进度圆环 */}
            <circle
              cx="40"
              cy="40"
              r="32"
              fill="none"
              stroke={getColor(score)}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={`${(score / 100) * 201} 201`}
              className="transition-all duration-700"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xl font-bold font-numeric" style={{ color: getColor(score) }}>
              {score}
            </span>
          </div>
        </div>
        <div className="text-sm text-[var(--text-secondary)]">{label}</div>
      </div>
    );
  };

  return (
    <Modal open={open} onClose={onClose} title="AI 交易分析" size="lg">
      <div className="space-y-6">
        {/* 时间范围选择 */}
        <div className="space-y-2">
          <label className="text-sm text-[var(--text-secondary)]">分析时间范围</label>
          <div className="flex gap-2">
            {[
              { value: '7d', label: '最近 7 天' },
              { value: '30d', label: '最近 30 天' },
              { value: '90d', label: '最近 90 天' },
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => setTimeRange(option.value as '7d' | '30d' | '90d')}
                className={cn(
                  'px-4 py-2 rounded-md text-sm font-medium transition-colors',
                  timeRange === option.value
                    ? 'bg-[var(--brand-primary)] text-white'
                    : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--border-primary)]'
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* 分析按钮 */}
        <Button
          onClick={handleAnalyze}
          isLoading={isAnalyzing}
          className="w-full"
          disabled={isAnalyzing}
        >
          {isAnalyzing ? '分析中...' : '开始 AI 分析'}
        </Button>

        {/* 加载中 */}
        {isAnalyzing && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Spinner size="lg" />
            <p className="text-sm text-[var(--text-secondary)]">AI 正在分析您的交易数据...</p>
          </div>
        )}

        {/* 分析结果 */}
        {!isAnalyzing && result && (
          <div className="space-y-6">
            {/* 总体评价 */}
            <div className="p-4 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)]">
              <div className="flex items-start gap-2">
                <TrendingUp className="w-5 h-5 text-[var(--brand-primary)] mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2">总体评价</h3>
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{result.summary}</p>
                </div>
              </div>
            </div>

            {/* 得分仪表盘 */}
            <div className="grid grid-cols-2 gap-6 py-4">
              <Gauge score={result.emotionalScore} label="情绪得分" />
              <Gauge score={result.riskScore} label="风险得分" />
            </div>

            {/* 优势列表 */}
            {result.strengths.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-[var(--success)]" />
                  优势
                </h3>
                <ul className="space-y-2">
                  {result.strengths.map((strength, index) => (
                    <li
                      key={index}
                      className="flex items-start gap-2 text-sm text-[var(--text-secondary)] pl-6"
                    >
                      <span className="text-[var(--success)] flex-shrink-0">•</span>
                      <span>{strength}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 不足列表 */}
            {result.weaknesses.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-[var(--danger)]" />
                  不足
                </h3>
                <ul className="space-y-2">
                  {result.weaknesses.map((weakness, index) => (
                    <li
                      key={index}
                      className="flex items-start gap-2 text-sm text-[var(--text-secondary)] pl-6"
                    >
                      <span className="text-[var(--danger)] flex-shrink-0">•</span>
                      <span>{weakness}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 改进建议 */}
            {result.suggestions.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-[var(--warning)]" />
                  改进建议
                </h3>
                <ul className="space-y-2">
                  {result.suggestions.map((suggestion, index) => (
                    <li
                      key={index}
                      className="flex items-start gap-2 text-sm text-[var(--text-secondary)] pl-6"
                    >
                      <span className="text-[var(--warning)] flex-shrink-0">•</span>
                      <span>{suggestion}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* 空状态（未分析） */}
        {!isAnalyzing && !result && (
          <Empty description='点击"开始 AI 分析"按钮，让 AI 帮您分析交易表现' />
        )}
      </div>
    </Modal>
  );
}
