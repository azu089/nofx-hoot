'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Select } from '@/components/ui';
import { aiApi } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
import {
  Sparkles,
  Zap,
  AlertCircle,
  Download,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  BarChart3,
} from 'lucide-react';

interface GeneratedStrategy {
  name: string;
  code: string;
  explanation: string;
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

export default function AIStrategyPage() {
  // 表单状态
  const [description, setDescription] = useState('');
  const [riskLevel, setRiskLevel] = useState<'low' | 'medium' | 'high'>('medium');
  const [tradingPair, setTradingPair] = useState('');

  // 配额状态
  const [quota, setQuota] = useState<{ remaining: number; limit: number } | null>(null);

  // 生成结果
  const [result, setResult] = useState<GeneratedStrategy | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 历史记录
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // 复制状态
  const [copied, setCopied] = useState(false);

  // 加载配额
  useEffect(() => {
    const fetchQuota = async () => {
      try {
        const res = await aiApi.getQuota();
        setQuota(res.data);
      } catch (err) {
        console.error('Failed to fetch quota:', err);
      }
    };
    fetchQuota();
  }, []);

  // 加载历史
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await aiApi.getHistory('strategy', 5);
        setHistory(res.data || []);
      } catch (err) {
        console.error('Failed to fetch history:', err);
      }
    };
    fetchHistory();
  }, [result]); // 生成新策略后刷新

  // 生成策略
  const handleGenerate = async () => {
    if (!description.trim()) {
      setError('请输入策略描述');
      return;
    }

    if (quota && quota.limit !== -1 && quota.remaining <= 0) {
      setError('本月配额已用完，请升级 VIP 获取更多配额');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await aiApi.generateStrategy({
        description: description.trim(),
        riskLevel,
        tradingPair: tradingPair.trim() || undefined,
      });
      setResult(res.data);

      // 更新配额
      if (quota && quota.limit !== -1) {
        setQuota({ ...quota, remaining: quota.remaining - 1 });
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '生成失败，请稍后重试';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // 复制代码
  const handleCopy = async () => {
    if (!result?.code) return;

    try {
      await navigator.clipboard.writeText(result.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // 下载代码
  const handleDownload = () => {
    if (!result?.code) return;

    const blob = new Blob([result.code], { type: 'text/python' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${result.name || 'strategy'}.py`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 从历史加载
  const loadFromHistory = (item: HistoryItem) => {
    try {
      const input = JSON.parse(item.input);
      const output = JSON.parse(item.output);
      setDescription(input.description || '');
      setRiskLevel(input.riskLevel || 'medium');
      setTradingPair(input.tradingPair || '');
      setResult(output);
    } catch (err) {
      console.error('Failed to parse history:', err);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-brand-primary" />
            AI 策略生成器
          </h1>
          <p className="text-text-secondary mt-1">
            使用 AI 自动生成 Freqtrade 交易策略代码
          </p>
        </div>

        {/* 配额显示 */}
        {quota && (
          <div className="text-right">
            <div className="text-sm text-text-secondary">本月剩余配额</div>
            <div className="text-xl font-bold text-white">
              {quota.limit === -1 ? (
                <span className="text-brand-primary">无限制</span>
              ) : (
                <>
                  <span className={quota.remaining > 0 ? 'text-success' : 'text-danger'}>
                    {quota.remaining}
                  </span>
                  <span className="text-text-tertiary"> / {quota.limit}</span>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左侧：生成表单 */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-warning" />
                策略参数
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 策略描述 */}
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  策略描述 <span className="text-danger">*</span>
                </label>
                <textarea
                  className="w-full px-3 py-2 bg-bg-tertiary border border-border-secondary rounded-lg text-white resize-none focus:outline-none focus:ring-2 focus:ring-brand-primary"
                  rows={4}
                  placeholder="描述你想要的策略，例如：基于 RSI 和 MACD 的趋势跟踪策略，在超卖区间买入，超买区间卖出..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              {/* 风险等级 */}
              <Select
                label="风险等级"
                value={riskLevel}
                onChange={(e) => setRiskLevel(e.target.value as 'low' | 'medium' | 'high')}
              >
                <option value="low">低风险 - 保守策略，小止损小止盈</option>
                <option value="medium">中风险 - 平衡策略，适中止损止盈</option>
                <option value="high">高风险 - 激进策略，大止损大止盈</option>
              </Select>

              {/* 交易对 */}
              <Input
                label="交易对（可选）"
                placeholder="例如：BTC/USDT"
                value={tradingPair}
                onChange={(e) => setTradingPair(e.target.value)}
              />

              {/* 错误提示 */}
              {error && (
                <div className="flex items-center gap-2 text-danger text-sm">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </div>
              )}

              {/* 生成按钮 */}
              <Button
                className="w-full"
                onClick={handleGenerate}
                disabled={loading || !description.trim()}
              >
                {loading ? (
                  <>
                    <span className="animate-spin mr-2">...</span>
                    生成中...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    生成策略
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* 历史记录 */}
          <Card>
            <CardHeader>
              <button
                className="w-full flex items-center justify-between"
                onClick={() => setShowHistory(!showHistory)}
              >
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-text-secondary" />
                  生成历史
                </CardTitle>
                {showHistory ? (
                  <ChevronUp className="w-5 h-5 text-text-secondary" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-text-secondary" />
                )}
              </button>
            </CardHeader>
            {showHistory && (
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
                          <div className="text-sm text-white truncate">
                            {input.description?.substring(0, 50)}...
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
            )}
          </Card>
        </div>

        {/* 右侧：生成结果 */}
        <div className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-brand-primary" />
                  生成结果
                </CardTitle>
                {result && (
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={handleCopy}>
                      {copied ? (
                        <>
                          <Check className="w-4 h-4 mr-1 text-success" />
                          已复制
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4 mr-1" />
                          复制代码
                        </>
                      )}
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleDownload}>
                      <Download className="w-4 h-4 mr-1" />
                      下载
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {!result && !loading && (
                <div className="flex flex-col items-center justify-center py-16 text-text-tertiary">
                  <Sparkles className="w-16 h-16 mb-4 opacity-50" />
                  <p>输入策略描述，点击生成按钮开始</p>
                </div>
              )}

              {loading && (
                <div className="flex flex-col items-center justify-center py-16">
                  <div className="animate-pulse">
                    <Sparkles className="w-16 h-16 text-brand-primary" />
                  </div>
                  <p className="text-text-secondary mt-4">AI 正在生成策略代码...</p>
                  <p className="text-text-tertiary text-sm mt-2">这可能需要 10-30 秒</p>
                </div>
              )}

              {result && (
                <div className="space-y-4">
                  {/* 策略名称 */}
                  <div className="p-3 bg-bg-tertiary/50 rounded-lg">
                    <div className="text-sm text-text-secondary">策略名称</div>
                    <div className="text-lg font-medium text-white">{result.name}</div>
                  </div>

                  {/* 策略说明 */}
                  <div className="p-3 bg-bg-tertiary/50 rounded-lg">
                    <div className="text-sm text-text-secondary mb-1">策略说明</div>
                    <div className="text-white whitespace-pre-wrap">{result.explanation}</div>
                  </div>

                  {/* 代码 */}
                  <div className="relative">
                    <div className="text-sm text-text-secondary mb-2">策略代码</div>
                    <pre className="p-4 bg-bg-secondary rounded-lg overflow-x-auto text-sm text-success max-h-[500px] overflow-y-auto">
                      <code>{result.code}</code>
                    </pre>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
