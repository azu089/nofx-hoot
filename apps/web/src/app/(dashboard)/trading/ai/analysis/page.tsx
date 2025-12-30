'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Button, Select } from '@/components/ui';
import { aiApi } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
import {
  Brain,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Lightbulb,
  ThumbsUp,
  ThumbsDown,
  Activity,
  Clock,
} from 'lucide-react';

interface AnalysisResult {
  summary: string;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  emotionalScore: number;
  riskScore: number;
}

interface HistoryItem {
  id: string;
  type: string;
  input: string;
  output: string;
  tokens_used: number;
  model: string;
  created_at: string;
}

export default function AIAnalysisPage() {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  // 加载历史
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await aiApi.getHistory('analysis', 5);
        setHistory(res.data || []);
      } catch (err) {
        console.error('Failed to fetch history:', err);
      }
    };
    fetchHistory();
  }, [result]);

  // 执行分析
  const handleAnalyze = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await aiApi.analyzeTrades(timeRange);
      setResult(res.data);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '分析失败，请稍后重试';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // 从历史加载
  const loadFromHistory = (item: HistoryItem) => {
    try {
      const output = JSON.parse(item.output);
      const input = JSON.parse(item.input);
      setTimeRange(input.timeRange || '30d');
      setResult(output);
    } catch (err) {
      console.error('Failed to parse history:', err);
    }
  };

  // 获取分数颜色
  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-success';
    if (score >= 40) return 'text-warning';
    return 'text-danger';
  };

  // 获取分数背景
  const getScoreBg = (score: number) => {
    if (score >= 70) return 'bg-success/20';
    if (score >= 40) return 'bg-warning/20';
    return 'bg-danger/20';
  };

  return (
    <div className="p-6 space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Brain className="w-6 h-6 text-purple-500" />
          AI 交易解读
        </h1>
        <p className="text-text-secondary mt-1">
          AI 分析你的交易数据，给出专业评价和改进建议
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左侧：分析控制 */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-brand-primary" />
                分析设置
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select
                label="分析时间范围"
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value as '7d' | '30d' | '90d')}
              >
                <option value="7d">最近 7 天</option>
                <option value="30d">最近 30 天</option>
                <option value="90d">最近 90 天</option>
              </Select>

              {error && (
                <div className="flex items-center gap-2 text-danger text-sm">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </div>
              )}

              <Button
                className="w-full"
                onClick={handleAnalyze}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="animate-spin mr-2">...</span>
                    分析中...
                  </>
                ) : (
                  <>
                    <Brain className="w-4 h-4 mr-2" />
                    开始分析
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* 历史记录 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-text-secondary" />
                分析历史
              </CardTitle>
            </CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <p className="text-text-tertiary text-center py-4">暂无历史记录</p>
              ) : (
                <div className="space-y-2">
                  {history.map((item) => {
                    const input = JSON.parse(item.input);
                    return (
                      <button
                        key={item.id}
                        className="w-full text-left p-3 bg-bg-tertiary/50 rounded-lg hover:bg-bg-tertiary transition-colors"
                        onClick={() => loadFromHistory(item)}
                      >
                        <div className="text-sm text-white">
                          {input.timeRange} 分析报告
                        </div>
                        <div className="text-xs text-text-tertiary mt-1">
                          {formatDateTime(item.created_at)}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 右侧：分析结果 */}
        <div className="lg:col-span-2 space-y-4">
          {!result && !loading && (
            <Card className="h-full">
              <CardContent className="flex flex-col items-center justify-center py-16 text-text-tertiary">
                <Brain className="w-16 h-16 mb-4 opacity-50" />
                <p>选择时间范围，点击开始分析</p>
              </CardContent>
            </Card>
          )}

          {loading && (
            <Card className="h-full">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <div className="animate-pulse">
                  <Brain className="w-16 h-16 text-purple-500" />
                </div>
                <p className="text-text-secondary mt-4">AI 正在分析你的交易数据...</p>
              </CardContent>
            </Card>
          )}

          {result && (
            <>
              {/* 总结 */}
              <Card>
                <CardHeader>
                  <CardTitle>总体评价</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-lg text-white">{result.summary}</p>
                </CardContent>
              </Card>

              {/* 分数卡片 */}
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <div className="text-sm text-text-secondary mb-2">情绪稳定性</div>
                      <div className={`text-4xl font-bold ${getScoreColor(result.emotionalScore)}`}>
                        {result.emotionalScore}
                      </div>
                      <div className="text-sm text-text-tertiary mt-1">/ 100</div>
                      <div className={`mt-3 h-2 rounded-full ${getScoreBg(result.emotionalScore)}`}>
                        <div
                          className={`h-full rounded-full ${getScoreColor(result.emotionalScore).replace('text-', 'bg-')}`}
                          style={{ width: `${result.emotionalScore}%` }}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <div className="text-sm text-text-secondary mb-2">风控能力</div>
                      <div className={`text-4xl font-bold ${getScoreColor(result.riskScore)}`}>
                        {result.riskScore}
                      </div>
                      <div className="text-sm text-text-tertiary mt-1">/ 100</div>
                      <div className={`mt-3 h-2 rounded-full ${getScoreBg(result.riskScore)}`}>
                        <div
                          className={`h-full rounded-full ${getScoreColor(result.riskScore).replace('text-', 'bg-')}`}
                          style={{ width: `${result.riskScore}%` }}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* 优势与不足 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-success">
                      <ThumbsUp className="w-5 h-5" />
                      交易优势
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {result.strengths.map((item, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <TrendingUp className="w-4 h-4 text-success mt-1 flex-shrink-0" />
                          <span className="text-text-primary">{item}</span>
                        </li>
                      ))}
                      {result.strengths.length === 0 && (
                        <li className="text-text-tertiary">暂无数据</li>
                      )}
                    </ul>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-danger">
                      <ThumbsDown className="w-5 h-5" />
                      需要改进
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {result.weaknesses.map((item, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <TrendingDown className="w-4 h-4 text-danger mt-1 flex-shrink-0" />
                          <span className="text-text-primary">{item}</span>
                        </li>
                      ))}
                      {result.weaknesses.length === 0 && (
                        <li className="text-text-tertiary">暂无数据</li>
                      )}
                    </ul>
                  </CardContent>
                </Card>
              </div>

              {/* 改进建议 */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-warning">
                    <Lightbulb className="w-5 h-5" />
                    改进建议
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {result.suggestions.map((item, index) => (
                      <li key={index} className="flex items-start gap-3 p-3 bg-bg-tertiary/50 rounded-lg">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-warning/20 text-warning text-sm flex-shrink-0">
                          {index + 1}
                        </span>
                        <span className="text-text-primary">{item}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
