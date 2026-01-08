'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, Button, MobileHeader } from '@/components/ui';
import { Input } from '@/components/ui/input';
import { SymbolSearch } from '@/components/features/trading';
import { instancesApi, strategiesApi } from '@/lib/api';
import {
  Code,
  Play,
  Loader2,
  AlertCircle,
  AlertTriangle,
  FileCode,
  Target,
  CheckCircle,
  XCircle,
  Shield,
  Clock,
  RotateCcw,
} from 'lucide-react';

// 回测结果
interface BacktestResult {
  success: boolean;
  totalReturn: number;
  winRate: number;
  totalTrades: number;
  maxDrawdown: number;
  sharpeRatio: number;
  profitFactor: number;
  avgProfit: number;
  avgLoss: number;
  trades: Array<{
    pair: string;
    side: string;
    entryPrice: number;
    exitPrice: number;
    pnl: number;
    entryTime: string;
    exitTime: string;
  }>;
  errors?: string[];
  warnings?: string[];
}

// VPS 实例
interface VpsInstance {
  id: string;
  status: string;
  ip_address: string | null;
}

// 代码模板
const CODE_TEMPLATE = `# 量化策略模板
# 请根据您的需求修改以下代码

from freqtrade.strategy import IStrategy
from pandas import DataFrame
import talib.abstract as ta

class MyCustomStrategy(IStrategy):
    """
    自定义策略示例
    - 使用 RSI 指标判断买卖时机
    - 止损设置为 -5%
    - 止盈设置为 +10%
    """

    # 策略参数
    minimal_roi = {
        "0": 0.10,   # 10% 止盈
        "30": 0.05,  # 30分钟后 5% 止盈
        "60": 0.02,  # 60分钟后 2% 止盈
    }

    stoploss = -0.05  # 5% 止损

    # 时间周期
    timeframe = '5m'

    def populate_indicators(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        """添加技术指标"""
        # RSI 指标
        dataframe['rsi'] = ta.RSI(dataframe, timeperiod=14)

        # 移动平均线
        dataframe['sma_20'] = ta.SMA(dataframe, timeperiod=20)
        dataframe['sma_50'] = ta.SMA(dataframe, timeperiod=50)

        return dataframe

    def populate_entry_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        """买入信号"""
        dataframe.loc[
            (
                (dataframe['rsi'] < 30) &  # RSI 超卖
                (dataframe['sma_20'] > dataframe['sma_50'])  # 金叉
            ),
            'enter_long'] = 1

        return dataframe

    def populate_exit_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        """卖出信号"""
        dataframe.loc[
            (
                (dataframe['rsi'] > 70) |  # RSI 超买
                (dataframe['sma_20'] < dataframe['sma_50'])  # 死叉
            ),
            'exit_long'] = 1

        return dataframe
`;

// 危险代码关键词
const DANGEROUS_KEYWORDS = [
  'import os',
  'import subprocess',
  'import sys',
  'exec(',
  'eval(',
  '__import__',
  'open(',
  'file(',
  'input(',
  'raw_input',
  'compile(',
  'getattr(',
  'setattr(',
  'globals(',
  'locals(',
];

export default function CodeBacktestPage() {
  const router = useRouter();

  // VPS 状态（仅在点击回测时检查）
  const [hasActiveVps, setHasActiveVps] = useState(false);

  // 代码状态
  const [code, setCode] = useState(CODE_TEMPLATE);

  // 回测参数
  const [selectedPairs, setSelectedPairs] = useState<string[]>(['BTC/USDT', 'ETH/USDT']);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [initialCapital, setInitialCapital] = useState('10000');

  // 状态
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [codeValid, setCodeValid] = useState<boolean | null>(null);

  // 检查用户是否有活跃的 VPS（仅在点击回测时调用）
  const checkVpsStatus = async (): Promise<boolean> => {
    try {
      const res = await instancesApi.list();
      const instances: VpsInstance[] = res.data || [];
      const running = instances.find(
        (i) => i.status === 'running' && i.ip_address
      );
      const hasVps = !!running;
      setHasActiveVps(hasVps);
      return hasVps;
    } catch {
      setHasActiveVps(false);
      return false;
    }
  };

  // 设置默认日期
  useEffect(() => {
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - 3);
    setEndDate(end.toISOString().split('T')[0]);
    setStartDate(start.toISOString().split('T')[0]);
  }, []);

  // 验证代码安全性
  const validateCode = (codeToValidate: string): { valid: boolean; warnings: string[]; errors: string[] } => {
    const foundWarnings: string[] = [];
    const foundErrors: string[] = [];

    // 检查危险关键词
    for (const keyword of DANGEROUS_KEYWORDS) {
      if (codeToValidate.includes(keyword)) {
        foundErrors.push(`检测到危险代码: "${keyword}" - 禁止使用系统调用或文件操作`);
      }
    }

    // 检查必要的类定义
    if (!codeToValidate.includes('class') || !codeToValidate.includes('IStrategy')) {
      foundErrors.push('策略代码必须继承 IStrategy 类');
    }

    // 检查必要的方法
    if (!codeToValidate.includes('populate_indicators')) {
      foundWarnings.push('建议实现 populate_indicators 方法添加技术指标');
    }
    if (!codeToValidate.includes('populate_entry_trend') && !codeToValidate.includes('populate_buy_trend')) {
      foundErrors.push('必须实现 populate_entry_trend 或 populate_buy_trend 方法');
    }
    if (!codeToValidate.includes('populate_exit_trend') && !codeToValidate.includes('populate_sell_trend')) {
      foundErrors.push('必须实现 populate_exit_trend 或 populate_sell_trend 方法');
    }

    return {
      valid: foundErrors.length === 0,
      warnings: foundWarnings,
      errors: foundErrors,
    };
  };

  // 代码变化时验证
  useEffect(() => {
    if (!code.trim()) {
      setCodeValid(null);
      setWarnings([]);
      return;
    }

    setValidating(true);
    const timer = setTimeout(() => {
      const result = validateCode(code);
      setCodeValid(result.valid);
      setWarnings(result.warnings);
      if (!result.valid) {
        setError(result.errors.join('\n'));
      } else {
        setError(null);
      }
      setValidating(false);
    }, 500);

    return () => clearTimeout(timer);
  }, [code]);

  // 重置为模板
  const handleResetToTemplate = () => {
    setCode(CODE_TEMPLATE);
    setError(null);
  };

  // 执行回测
  const handleBacktest = async () => {
    setError(null);
    setResult(null);

    // 验证代码
    const validation = validateCode(code);
    if (!validation.valid) {
      setError(validation.errors.join('\n'));
      return;
    }

    if (selectedPairs.length === 0) {
      setError('请至少选择一个交易对');
      return;
    }

    setLoading(true);

    // 检查 VPS 状态（仅在点击回测时检查）
    const vpsReady = await checkVpsStatus();
    if (!vpsReady) {
      setLoading(false);
      setError('您还没有活跃的 VPS 实例。请先完成会员订阅，VPS 将自动启动。\n\n点击下方按钮前往订阅页面。');
      return;
    }

    try {
      // 调用后端 API，代理到 VPS Freqtrade 执行回测
      const response = await strategiesApi.runCodeBacktest({
        code,
        pairs: selectedPairs,
        startDate,
        endDate,
        initialCapital: parseFloat(initialCapital),
      });

      // API 已返回标准 ApiResponse 格式：{ code, message, data }
      if (response.code !== 0) {
        throw new Error(response.message || '回测失败');
      }

      const backtestData = response.data;

      // 转换后端返回格式
      const backtestResult: BacktestResult = {
        success: true,
        totalReturn: backtestData.total_return || 0,
        winRate: backtestData.win_rate || 0,
        totalTrades: backtestData.total_trades || 0,
        maxDrawdown: backtestData.max_drawdown || 0,
        sharpeRatio: backtestData.sharpe_ratio || 0,
        profitFactor: backtestData.profit_factor || 0,
        avgProfit: backtestData.avg_profit || 0,
        avgLoss: backtestData.avg_loss || 0,
        trades: (backtestData.trades || []).map((t: {
          pair: string;
          side: string;
          entry_price: number;
          exit_price: number;
          pnl: number;
          entry_time: string;
          exit_time: string;
        }) => ({
          pair: t.pair,
          side: t.side,
          entryPrice: t.entry_price,
          exitPrice: t.exit_price,
          pnl: t.pnl,
          entryTime: t.entry_time,
          exitTime: t.exit_time,
        })),
        warnings: validation.warnings,
      };

      setResult(backtestResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : '回测失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <MobileHeader title="代码回测" />

      {/* 安全提示 */}
      <div className="flex items-start gap-3 p-4 bg-brand-primary/10 border border-brand-primary/30 rounded-xl">
        <Shield className="w-5 h-5 text-brand-primary flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-text-primary font-medium">安全代码回测</p>
          <p className="text-text-secondary text-sm mt-1">
            直接粘贴 Python 策略代码，无需上传文件。
            代码将在您的专属服务器上执行真实回测。
          </p>
        </div>
      </div>

      {/* 代码编辑器 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Code className="w-5 h-5 text-brand-primary" />
              策略代码
              {validating && <Loader2 className="w-4 h-4 animate-spin text-text-tertiary" />}
              {codeValid === true && <CheckCircle className="w-4 h-4 text-success" />}
              {codeValid === false && <XCircle className="w-4 h-4 text-danger" />}
            </span>
            <Button variant="ghost" size="sm" onClick={handleResetToTemplate}>
              <RotateCcw className="w-4 h-4 mr-1" />
              重置模板
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* 代码编辑区 - 纯粘贴方式，无文件上传风险 */}
          <div className="relative">
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full h-96 p-4 bg-bg-tertiary border border-border-primary rounded-xl font-mono text-sm text-text-primary resize-none focus:outline-none focus:ring-2 focus:ring-brand-primary"
              placeholder="在此输入或粘贴您的 Python 策略代码..."
              spellCheck={false}
            />
            <div className="absolute bottom-3 right-3 flex items-center gap-2 text-xs text-text-tertiary">
              <FileCode className="w-4 h-4" />
              {code.split('\n').length} 行
            </div>
          </div>

          {/* 警告信息 */}
          {warnings.length > 0 && (
            <div className="mt-4 space-y-2">
              {warnings.map((warning, index) => (
                <div key={index} className="flex items-center gap-2 text-warning text-sm">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  {warning}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 回测参数 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-text-secondary" />
            回测参数
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-text-secondary mb-2">开始日期</label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm text-text-secondary mb-2">结束日期</label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm text-text-secondary mb-2">初始资金 (USDT)</label>
                <Input
                  type="number"
                  value={initialCapital}
                  onChange={(e) => setInitialCapital(e.target.value)}
                  min="100"
                />
              </div>
            </div>

            <SymbolSearch
              selectedSymbols={selectedPairs}
              onSelectionChange={setSelectedPairs}
              maxSelection={10}
              label="交易对选择"
            />
          </div>
        </CardContent>
      </Card>

      {/* 错误提示 */}
      {error && (
        <div className="p-4 bg-danger/10 border border-danger/30 rounded-xl">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-danger flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-danger font-medium">错误</p>
              <pre className="text-danger/80 text-sm mt-2 whitespace-pre-wrap">{error}</pre>
              {/* 如果是 VPS 未激活错误，显示订阅按钮 */}
              {error.includes('VPS') && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => router.push('/subscription')}
                >
                  前往订阅
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 开始回测按钮 */}
      <Button
        onClick={handleBacktest}
        disabled={loading || codeValid === false}
        className="w-full py-4"
      >
        {loading ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            正在执行回测...
          </>
        ) : (
          <>
            <Play className="w-5 h-5 mr-2" />
            开始回测
          </>
        )}
      </Button>

      {/* 回测结果 */}
      {result && (
        <Card className="border-brand-primary/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5 text-brand-primary" />
              回测结果
              {result.success ? (
                <span className="px-2 py-0.5 bg-success/20 text-success text-xs rounded">成功</span>
              ) : (
                <span className="px-2 py-0.5 bg-danger/20 text-danger text-xs rounded">失败</span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* 统计指标 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="p-4 bg-bg-tertiary/50 rounded-xl">
                <p className="text-text-secondary text-sm mb-1">总收益率</p>
                <p className={`text-2xl font-bold ${result.totalReturn >= 0 ? 'text-success' : 'text-danger'}`}>
                  {result.totalReturn >= 0 ? '+' : ''}{result.totalReturn.toFixed(2)}%
                </p>
              </div>
              <div className="p-4 bg-bg-tertiary/50 rounded-xl">
                <p className="text-text-secondary text-sm mb-1">胜率</p>
                <p className="text-2xl font-bold text-text-primary">{result.winRate.toFixed(1)}%</p>
              </div>
              <div className="p-4 bg-bg-tertiary/50 rounded-xl">
                <p className="text-text-secondary text-sm mb-1">总交易次数</p>
                <p className="text-2xl font-bold text-text-primary">{result.totalTrades}</p>
              </div>
              <div className="p-4 bg-bg-tertiary/50 rounded-xl">
                <p className="text-text-secondary text-sm mb-1">最大回撤</p>
                <p className="text-2xl font-bold text-danger">{result.maxDrawdown.toFixed(2)}%</p>
              </div>
              <div className="p-4 bg-bg-tertiary/50 rounded-xl">
                <p className="text-text-secondary text-sm mb-1">夏普比率</p>
                <p className="text-2xl font-bold text-text-primary">{result.sharpeRatio.toFixed(2)}</p>
              </div>
              <div className="p-4 bg-bg-tertiary/50 rounded-xl">
                <p className="text-text-secondary text-sm mb-1">盈亏比</p>
                <p className="text-2xl font-bold text-text-primary">{result.profitFactor.toFixed(2)}</p>
              </div>
              <div className="p-4 bg-bg-tertiary/50 rounded-xl">
                <p className="text-text-secondary text-sm mb-1">平均盈利</p>
                <p className="text-2xl font-bold text-success">+${result.avgProfit.toFixed(2)}</p>
              </div>
              <div className="p-4 bg-bg-tertiary/50 rounded-xl">
                <p className="text-text-secondary text-sm mb-1">平均亏损</p>
                <p className="text-2xl font-bold text-danger">${result.avgLoss.toFixed(2)}</p>
              </div>
            </div>

            {/* 交易记录 */}
            <div>
              <h4 className="text-text-primary font-medium mb-3">最近交易记录</h4>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {result.trades.slice(0, 10).map((trade, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-bg-tertiary/30 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-0.5 text-xs rounded ${
                        trade.side === 'long' ? 'bg-success/20 text-success' : 'bg-danger/20 text-danger'
                      }`}>
                        {trade.side === 'long' ? '多' : '空'}
                      </span>
                      <span className="text-text-primary font-medium">{trade.pair}</span>
                      <span className="text-text-tertiary text-sm">
                        {trade.entryPrice.toFixed(2)} → {trade.exitPrice.toFixed(2)}
                      </span>
                    </div>
                    <span className={`font-medium ${trade.pnl >= 0 ? 'text-success' : 'text-danger'}`}>
                      {trade.pnl >= 0 ? '+' : ''}{trade.pnl.toFixed(2)} USDT
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
