'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, Button, Dialog, DialogFooter } from '@/components/ui';
import { strategiesApi, instancesApi, apiKeysApi } from '@/lib/api';
import {
  Play,
  Pause,
  Settings,
  Trash2,
  Plus,
  Upload,
  CheckCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  Eye,
  TrendingUp,
  Activity,
  DollarSign,
  BarChart3,
  Code,
  Store,
  XCircle,
  Loader2,
} from 'lucide-react';

// ============ 类型定义 ============

// 运行中的策略配置
interface StrategyConfig {
  id: string;
  user_id: string;
  strategy_id: string;
  instance_id: string | null;
  stake_amount: string;
  max_open_trades: number;
  leverage: number;
  stoploss: string;
  trailing_stop: boolean;
  trailing_stop_positive: string | null;
  blacklist: string[];
  custom_config: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  strategy: {
    id: string;
    name: string;
    description: string | null;
    is_public: boolean;
    owner_type?: 'system' | 'user';
    content?: string; // 策略代码（上架时需要）
    trade_type?: 'spot' | 'futures'; // 现货/合约
    // 回测数据
    backtest_total_return?: string;
    backtest_win_rate?: string;
    backtest_max_drawdown?: string;
    backtest_sharpe_ratio?: string; // 夏普比率
  };
}

// 筛选器配置
const SOURCE_FILTERS = [
  { key: 'all', label: '全部来源' },
  { key: 'personal', label: '个人' },
  { key: 'community', label: '社区' },
  { key: 'official', label: '官方' },
];

const TYPE_FILTERS = [
  { key: 'all', label: '全部类型' },
  { key: 'spot', label: '现货' },
  { key: 'futures', label: '合约' },
];

// ============ 主组件 ============
export default function MyStrategiesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  // 策略配置数据
  const [configs, setConfigs] = useState<StrategyConfig[]>([]);
  const [hasInstance, setHasInstance] = useState(false);
  const [runningInstance, setRunningInstance] = useState<{ id: string; ip_address: string | null } | null>(null);
  const [apiKeys, setApiKeys] = useState<Array<{ id: string; exchange: string; is_valid: boolean }>>([]);

  // 启动前检查状态
  const [preflightChecks, setPreflightChecks] = useState<{
    checking: boolean;
    vpsRunning: boolean;
    apiKeyExists: boolean;
    apiKeyValid: boolean;
    balanceSufficient: boolean | null; // null = 未检查
    exchangeBalance: number | null;
    noConflict: boolean;
    hasError: string | null;
  }>({
    checking: false,
    vpsRunning: false,
    apiKeyExists: false,
    apiKeyValid: false,
    balanceSufficient: null,
    exchangeBalance: null,
    noConflict: true,
    hasError: null,
  });

  // 筛选器状态
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // 弹窗状态
  const [selectedConfig, setSelectedConfig] = useState<StrategyConfig | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showStartModal, setShowStartModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // 编辑表单
  const [editForm, setEditForm] = useState({
    stake_amount: '',
    max_open_trades: 3,
    stoploss: '-5',
    take_profit: '10',
    leverage: 1,
    timeframe: '5m',           // 新增：K线周期
    exchange: 'binance',       // 新增：交易所
    trailing_stop: false,
    trailing_stop_positive: '1',
    trailing_stop_offset: '2',
    trailing_only_offset_reached: true,
    stoploss_on_exchange: true, // 默认开启交易所止损
    crash_protection: false,
    crash_threshold: '-10',
    crash_timeframe: '5',
    crash_action: 'pause',     // 新增：黑天鹅触发动作
  });
  const [showAdvanced, setShowAdvanced] = useState(true);

  // 上架状态
  const [uploadStep, setUploadStep] = useState<'conditions' | 'checking' | 'form' | 'uploading' | 'result'>('conditions');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploadResult, setUploadResult] = useState<{
    success: boolean;
    reviewStatus?: string;
    warnings?: string[];
    backtestSummary?: {
      totalReturn: number;
      winRate: number;
      maxDrawdown: number;
      sharpeRatio: number;
    };
    error?: string;
  } | null>(null);
  // 上架前置检测结果
  const [listingChecks, setListingChecks] = useState<{
    hasBacktest: boolean;
    backtestReturn: number | null;
    backtestWinRate: number | null;
    backtestDrawdown: number | null;
    hasDescription: boolean;
    passAll: boolean;
    failReasons: string[];
  }>({
    hasBacktest: false,
    backtestReturn: null,
    backtestWinRate: null,
    backtestDrawdown: null,
    hasDescription: false,
    passAll: false,
    failReasons: [],
  });

  // 初始化数据
  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [instancesRes, configsRes, apiKeysRes] = await Promise.all([
        instancesApi.list().catch(() => ({ data: [] })),
        strategiesApi.getMyConfigs().catch(() => ({ data: [] })),
        apiKeysApi.list().catch(() => ({ data: [] })),
      ]);

      // VPS 实例检查
      const instance = instancesRes.data?.find(
        (i: { status: string; id: string; ip_address: string | null }) => i.status === 'running' || i.status === 'provisioning'
      );
      setHasInstance(!!instance);
      setRunningInstance(instance ? { id: instance.id, ip_address: instance.ip_address } : null);

      // API Keys
      setApiKeys(apiKeysRes.data || []);

      // 策略配置
      setConfigs(configsRes.data || []);
    } catch (error) {
      console.error('获取数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // ============ 启动前检查 ============
  const runPreflightChecks = async (config: StrategyConfig) => {
    setPreflightChecks(prev => ({ ...prev, checking: true, hasError: null }));

    try {
      // 获取策略配置的交易所
      const customConfig = (config.custom_config || {}) as Record<string, unknown>;
      const targetExchange = (customConfig.exchange as string) || 'binance';

      // 1. 检查 VPS 是否运行中
      const vpsRunning = hasInstance && runningInstance !== null;

      // 2. 检查是否有对应交易所的 API Key
      const matchingKey = apiKeys.find(k => k.exchange.toLowerCase() === targetExchange.toLowerCase());
      const apiKeyExists = !!matchingKey;
      const apiKeyValid = matchingKey?.is_valid ?? false;

      // 3. 检查是否有其他运行中的策略（可能导致资金冲突）
      const otherRunningConfigs = configs.filter(c => c.is_active && c.id !== config.id);
      const noConflict = otherRunningConfigs.length === 0;

      // 4. 检查交易所余额（需要调用 API）
      let balanceSufficient: boolean | null = null;
      let exchangeBalance: number | null = null;

      if (vpsRunning && runningInstance?.id) {
        try {
          const balanceRes = await instancesApi.getBalance(runningInstance.id);
          if (balanceRes.data?.total !== undefined) {
            exchangeBalance = balanceRes.data.total;
            const requiredBalance = parseFloat(config.stake_amount) * config.max_open_trades;
            balanceSufficient = exchangeBalance >= requiredBalance;
          }
        } catch {
          // 余额检查失败，不阻止启动，但显示警告
          balanceSufficient = null;
        }
      }

      setPreflightChecks({
        checking: false,
        vpsRunning,
        apiKeyExists,
        apiKeyValid,
        balanceSufficient,
        exchangeBalance,
        noConflict,
        hasError: null,
      });
    } catch (error) {
      setPreflightChecks(prev => ({
        ...prev,
        checking: false,
        hasError: error instanceof Error ? error.message : '检查失败',
      }));
    }
  };

  // 打开启动弹窗时执行检查
  const handleOpenStartModal = (config: StrategyConfig) => {
    setSelectedConfig(config);
    setShowStartModal(true);
    runPreflightChecks(config);
  };

  // ============ 策略操作 ============
  const handleStartStrategy = async () => {
    if (!selectedConfig || !hasInstance) return;
    setActionLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      setConfigs(prev => prev.map(c =>
        c.id === selectedConfig.id ? { ...c, is_active: true } : c
      ));
      setShowStartModal(false);
    } catch (error) {
      alert(error instanceof Error ? error.message : '启动失败');
    } finally {
      setActionLoading(false);
    }
  };

  const handleStopStrategy = async (config: StrategyConfig) => {
    if (!confirm('确定要停止该策略吗？')) return;
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      setConfigs(prev => prev.map(c =>
        c.id === config.id ? { ...c, is_active: false } : c
      ));
    } catch (error) {
      alert(error instanceof Error ? error.message : '停止失败');
    }
  };

  const handleDeleteConfig = async () => {
    if (!selectedConfig) return;
    setActionLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      setConfigs(prev => prev.filter(c => c.id !== selectedConfig.id));
      setShowDeleteModal(false);
    } catch (error) {
      alert(error instanceof Error ? error.message : '删除失败');
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenEditModal = (config: StrategyConfig) => {
    setSelectedConfig(config);
    const customConfig = (config.custom_config || {}) as Record<string, unknown>;
    setEditForm({
      stake_amount: config.stake_amount,
      max_open_trades: config.max_open_trades,
      stoploss: (parseFloat(config.stoploss) * 100).toString(),
      take_profit: customConfig.take_profit ? String(parseFloat(String(customConfig.take_profit)) * 100) : '10',
      leverage: config.leverage,
      timeframe: (customConfig.timeframe as string) || '5m',
      exchange: (customConfig.exchange as string) || 'binance',
      trailing_stop: config.trailing_stop,
      trailing_stop_positive: config.trailing_stop_positive
        ? (parseFloat(config.trailing_stop_positive) * 100).toString()
        : '1',
      trailing_stop_offset: customConfig.trailing_stop_offset
        ? String(parseFloat(String(customConfig.trailing_stop_offset)) * 100)
        : '2',
      trailing_only_offset_reached: customConfig.trailing_only_offset_reached !== false,
      stoploss_on_exchange: customConfig.stoploss_on_exchange !== false, // 默认 true
      crash_protection: customConfig.crash_protection === true,
      crash_threshold: customConfig.crash_threshold ? String(customConfig.crash_threshold) : '-10',
      crash_timeframe: customConfig.crash_timeframe ? String(customConfig.crash_timeframe) : '5',
      crash_action: (customConfig.crash_action as string) || 'pause',
    });
    setShowAdvanced(false);
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedConfig) return;

    // 前端验证：止损必须在 -100% 到 0% 之间
    const stoplossValue = parseFloat(editForm.stoploss);
    if (isNaN(stoplossValue) || stoplossValue < -100 || stoplossValue > 0) {
      alert('止损值必须在 -100% 到 0% 之间');
      return;
    }

    setActionLoading(true);
    try {
      // 构建 API 请求数据（使用 number 类型）
      const apiData = {
        stake_amount: editForm.stake_amount,
        max_open_trades: editForm.max_open_trades,
        stoploss: stoplossValue / 100, // API 需要 number，转为小数
        leverage: editForm.leverage,
        trailing_stop: editForm.trailing_stop,
        trailing_stop_positive: editForm.trailing_stop && editForm.trailing_stop_positive
          ? parseFloat(editForm.trailing_stop_positive) / 100 // API 需要 number
          : undefined,
        timeframe: editForm.timeframe,
        // 扩展配置存到 custom_config
        custom_config: {
          take_profit: parseFloat(editForm.take_profit) / 100,
          exchange: editForm.exchange,
          trailing_stop_offset: editForm.trailing_stop && editForm.trailing_stop_offset
            ? parseFloat(editForm.trailing_stop_offset) / 100
            : null,
          trailing_only_offset_reached: editForm.trailing_only_offset_reached,
          stoploss_on_exchange: editForm.stoploss_on_exchange,
          crash_protection: editForm.crash_protection,
          crash_threshold: editForm.crash_protection ? editForm.crash_threshold : null,
          crash_timeframe: editForm.crash_protection ? editForm.crash_timeframe : null,
          crash_action: editForm.crash_protection ? editForm.crash_action : null,
        },
      };

      // 调用 API 保存
      await strategiesApi.updateConfig(selectedConfig.id, apiData);

      // 更新本地状态（转回显示格式）
      setConfigs(prev => prev.map(c =>
        c.id === selectedConfig.id ? {
          ...c,
          stake_amount: editForm.stake_amount,
          max_open_trades: editForm.max_open_trades,
          stoploss: (parseFloat(editForm.stoploss) / 100).toString(),
          leverage: editForm.leverage,
          trailing_stop: editForm.trailing_stop,
          trailing_stop_positive: editForm.trailing_stop && editForm.trailing_stop_positive
            ? (parseFloat(editForm.trailing_stop_positive) / 100).toString()
            : null,
          custom_config: apiData.custom_config,
        } : c
      ));
      setShowEditModal(false);
    } catch (error) {
      alert(error instanceof Error ? error.message : '保存失败');
    } finally {
      setActionLoading(false);
    }
  };

  // 打开上架弹窗
  const handleOpenUploadModal = (config: StrategyConfig) => {
    setSelectedConfig(config);
    setUploadDescription(config.strategy.description || '');
    setUploadStep('conditions'); // 先显示上架条件说明
    setUploadResult(null);
    setListingChecks({
      hasBacktest: false,
      backtestReturn: null,
      backtestWinRate: null,
      backtestDrawdown: null,
      hasDescription: false,
      passAll: false,
      failReasons: [],
    });
    setShowUploadModal(true);
  };

  // 关闭上架弹窗
  const handleCloseUploadModal = () => {
    setShowUploadModal(false);
    setUploadStep('conditions');
    setUploadResult(null);
  };

  // 执行上架前置检测
  const runListingChecks = async () => {
    if (!selectedConfig) return;

    setUploadStep('checking');

    // 模拟检测延迟，让用户看到检测过程
    await new Promise(resolve => setTimeout(resolve, 1000));

    const strategy = selectedConfig.strategy;
    const failReasons: string[] = [];

    // 检测 1: 是否有回测记录
    const hasBacktest = !!(
      strategy.backtest_total_return ||
      strategy.backtest_win_rate ||
      strategy.backtest_max_drawdown
    );
    if (!hasBacktest) {
      failReasons.push('缺少回测数据，请先进行策略回测');
    }

    // 检测 2: 回测收益 > 0%
    const backtestReturn = strategy.backtest_total_return
      ? parseFloat(strategy.backtest_total_return)
      : null;
    if (backtestReturn !== null && backtestReturn <= 0) {
      failReasons.push(`回测收益 ${backtestReturn.toFixed(2)}% 需大于 0%`);
    }

    // 检测 3: 最大回撤 < 50%
    const backtestDrawdown = strategy.backtest_max_drawdown
      ? Math.abs(parseFloat(strategy.backtest_max_drawdown))
      : null;
    if (backtestDrawdown !== null && backtestDrawdown > 50) {
      failReasons.push(`最大回撤 ${backtestDrawdown.toFixed(2)}% 超过 50% 上限`);
    }

    // 检测 4: 胜率 > 30%
    const backtestWinRate = strategy.backtest_win_rate
      ? parseFloat(strategy.backtest_win_rate)
      : null;
    if (backtestWinRate !== null && backtestWinRate < 30) {
      failReasons.push(`胜率 ${backtestWinRate.toFixed(2)}% 低于 30% 要求`);
    }

    // 检测 5: 策略描述 > 10 字符
    const description = uploadDescription.trim();
    const hasDescription = description.length >= 10;
    if (!hasDescription) {
      failReasons.push('策略描述至少需要 10 个字符');
    }

    const passAll = failReasons.length === 0 && hasBacktest;

    setListingChecks({
      hasBacktest,
      backtestReturn,
      backtestWinRate,
      backtestDrawdown,
      hasDescription,
      passAll,
      failReasons,
    });

    // 检测完成后跳转
    if (passAll) {
      setUploadStep('form'); // 通过检测，进入填写信息
    } else {
      setUploadStep('result'); // 检测失败，显示结果
      setUploadResult({
        success: false,
        error: '未通过上架条件检测',
      });
    }
  };

  // 提交策略到市场（进入人工审核）
  const handleUploadStrategy = async () => {
    if (!selectedConfig) {
      alert('请选择策略');
      return;
    }

    setUploadStep('uploading');

    try {
      // 调用提交审核 API（不执行回测，直接进入人工审核队列）
      const res = await strategiesApi.submitForReview(selectedConfig.strategy.id, {
        description: uploadDescription.trim(),
        autoCheckResult: {
          backtestReturn: listingChecks.backtestReturn,
          backtestWinRate: listingChecks.backtestWinRate,
          backtestDrawdown: listingChecks.backtestDrawdown,
        },
      });

      if (res && res.code === 0) {
        setUploadResult({
          success: true,
          reviewStatus: 'pending_review',
          backtestSummary: {
            totalReturn: listingChecks.backtestReturn || 0,
            winRate: listingChecks.backtestWinRate || 0,
            maxDrawdown: listingChecks.backtestDrawdown || 0,
            sharpeRatio: 0,
          },
        });
        // 刷新数据
        await fetchAllData();
      } else {
        setUploadResult({
          success: false,
          error: res?.message || '提交失败',
        });
      }
      setUploadStep('result');
    } catch (error: unknown) {
      let errorMessage = '提交失败';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'object' && error !== null) {
        const err = error as { response?: { data?: { message?: string } }; message?: string };
        errorMessage = err.response?.data?.message || err.message || '提交失败';
      }
      setUploadResult({
        success: false,
        error: errorMessage,
      });
      setUploadStep('result');
    }
  };

  // 获取策略来源类型
  const getStrategySource = (strategy: StrategyConfig['strategy']) => {
    if (strategy.owner_type === 'system') {
      return { key: 'official', label: '官方', color: 'bg-gradient-to-r from-amber-500 to-orange-500', textColor: 'text-white' };
    }
    if (strategy.is_public) {
      return { key: 'community', label: '社区', color: 'bg-brand-primary/20', textColor: 'text-brand-primary' };
    }
    return { key: 'personal', label: '个人', color: 'bg-success/20', textColor: 'text-success' };
  };

  // 获取交易类型
  const getTradeType = (strategy: StrategyConfig['strategy']) => {
    const type = strategy.trade_type || 'spot'; // 默认现货
    return type === 'futures'
      ? { key: 'futures', label: '合约', color: 'bg-warning/20', textColor: 'text-warning' }
      : { key: 'spot', label: '现货', color: 'bg-brand-primary/20', textColor: 'text-brand-primary' };
  };

  // 筛选后的策略配置
  const filteredConfigs = useMemo(() => {
    return configs.filter(config => {
      const source = getStrategySource(config.strategy);
      const tradeType = getTradeType(config.strategy);

      // 来源筛选
      if (sourceFilter !== 'all' && source.key !== sourceFilter) {
        return false;
      }
      // 类型筛选
      if (typeFilter !== 'all' && tradeType.key !== typeFilter) {
        return false;
      }
      return true;
    });
  }, [configs, sourceFilter, typeFilter]);

  // 统计数据
  const stats = useMemo(() => {
    const totalCount = configs.length;
    const runningCount = configs.filter(c => c.is_active).length;
    const totalInvested = configs.reduce((sum, c) => sum + parseFloat(c.stake_amount || '0'), 0);
    const personalCount = configs.filter(c => !c.strategy.is_public && c.strategy.owner_type !== 'system').length;
    const spotCount = configs.filter(c => (c.strategy.trade_type || 'spot') === 'spot').length;
    const futuresCount = configs.filter(c => c.strategy.trade_type === 'futures').length;

    return { totalCount, runningCount, totalInvested, personalCount, spotCount, futuresCount };
  }, [configs]);

  // ============ 加载状态 ============
  if (loading) {
    return (
      <div className="space-y-4 pb-20">
        {/* 筛选器骨架 */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-bg-tertiary rounded-lg animate-pulse" />
          <div className="w-20 h-8 bg-bg-tertiary rounded-md animate-pulse" />
          <div className="w-20 h-8 bg-bg-tertiary rounded-md animate-pulse" />
        </div>
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 bg-bg-tertiary rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  // ============ 渲染 ============
  return (
    <div className="space-y-4 pb-20">
      {/* 返回按钮 */}
      <div className="flex items-center">
        <button
          onClick={() => router.back()}
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-bg-secondary hover:bg-bg-tertiary transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-text-secondary" />
        </button>
      </div>

      {/* 入口按钮组 */}
      <div className="grid grid-cols-2 gap-3">
        <Button
          variant="outline"
          onClick={() => router.push('/strategies')}
          className="h-9 flex items-center justify-center gap-1.5 text-sm"
        >
          <Store className="w-3.5 h-3.5" />
          <span>添加策略</span>
        </Button>
        <Button
          onClick={() => router.push('/strategies/create')}
          className="h-9 flex items-center justify-center gap-1.5 text-sm"
        >
          <Code className="w-3.5 h-3.5" />
          <span>创建策略</span>
        </Button>
      </div>

      {/* 筛选器 */}
      <div className="flex items-center gap-2">
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className="px-2 py-1 bg-bg-secondary rounded text-xs text-text-secondary focus:outline-none"
        >
          {SOURCE_FILTERS.map(f => (
            <option key={f.key} value={f.key}>{f.label}</option>
          ))}
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-2 py-1 bg-bg-secondary rounded text-xs text-text-secondary focus:outline-none"
        >
          {TYPE_FILTERS.map(f => (
            <option key={f.key} value={f.key}>{f.label}</option>
          ))}
        </select>
        <span className="text-xs text-text-tertiary ml-auto">
          共 {filteredConfigs.length} 个
        </span>
      </div>

      {/* 策略列表 */}
      {filteredConfigs.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Settings className="w-12 h-12 text-text-tertiary mx-auto mb-3 opacity-50" />
            <h3 className="text-base font-medium text-text-primary mb-2">还没有配置策略</h3>
            <p className="text-text-secondary text-sm mb-4">
              从策略市场选择，或创建自己的策略
            </p>
            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={() => router.push('/strategies')}>
                <Store className="w-4 h-4 mr-2" />
                添加策略
              </Button>
              <Button onClick={() => router.push('/strategies/create')}>
                <Code className="w-4 h-4 mr-2" />
                创建策略
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredConfigs.map((config) => {
            const isActive = config.is_active;
            const source = getStrategySource(config.strategy);
            const tradeType = getTradeType(config.strategy);
            // 只有个人策略（非公开且非系统）才能上传
            const canUpload = !config.strategy.is_public && config.strategy.owner_type !== 'system';

            // 回测数据
            const backtestWinRate = parseFloat(config.strategy.backtest_win_rate || '0');
            const backtestDrawdown = parseFloat(config.strategy.backtest_max_drawdown || '0');
            const backtestSharpe = parseFloat(config.strategy.backtest_sharpe_ratio || '0');

            return (
              <Card
                key={config.id}
                className="transition-all border-0"
              >
                <CardContent className="p-4">
                  {/* ===== Row 1: 策略名 + 现货/合约 + 来源 + 运行状态 + 启停按钮 ===== */}
                  <div className="flex items-center gap-2 mb-3">
                    {/* 策略名称 */}
                    <h3 className="text-white font-semibold text-base truncate flex-1">{config.strategy.name}</h3>
                    {/* 交易类型标签 (现货/合约) */}
                    <span className={`text-xs px-2 py-0.5 rounded font-medium shrink-0 ${tradeType.color} ${tradeType.textColor}`}>
                      {tradeType.label}
                    </span>
                    {/* 来源标签 (社区/官方/个人) */}
                    <span className={`text-xs px-2 py-0.5 rounded font-medium shrink-0 ${source.color} ${source.textColor}`}>
                      {source.label}
                    </span>
                    {/* 运行状态 */}
                    <div className={`flex items-center gap-1 px-2 py-0.5 rounded shrink-0 ${isActive ? 'bg-success/10' : 'bg-bg-tertiary'}`}>
                      <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-success animate-pulse' : 'bg-text-tertiary'}`} />
                      <span className={`text-xs font-medium ${isActive ? 'text-success' : 'text-text-tertiary'}`}>
                        {isActive ? '运行中' : '已停止'}
                      </span>
                    </div>
                    {/* 启停按钮 */}
                    {isActive ? (
                      <button
                        onClick={() => handleStopStrategy(config)}
                        className="w-9 h-9 flex items-center justify-center rounded-lg bg-danger/10 text-danger hover:bg-danger/20 transition-colors shrink-0"
                      >
                        <Pause className="w-5 h-5" />
                      </button>
                    ) : (
                      <button
                        onClick={() => handleOpenStartModal(config)}
                        className="w-9 h-9 flex items-center justify-center rounded-lg bg-success/10 text-success hover:bg-success/20 transition-colors shrink-0"
                      >
                        <Play className="w-5 h-5" />
                      </button>
                    )}
                  </div>

                  {/* ===== Row 2: 胜率 | 回撤 | 夏普 (3列) ===== */}
                  <div className="grid grid-cols-3 gap-3 py-3">
                    <div className="text-center">
                      <p className="text-lg font-bold text-white">{backtestWinRate.toFixed(0)}%</p>
                      <p className="text-xs text-text-tertiary">胜率</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold text-danger">-{Math.abs(backtestDrawdown).toFixed(1)}%</p>
                      <p className="text-xs text-text-tertiary">最大回撤</p>
                    </div>
                    <div className="text-center">
                      <p className={`text-lg font-bold ${backtestSharpe >= 1 ? 'text-success' : backtestSharpe >= 0.5 ? 'text-warning' : 'text-text-secondary'}`}>
                        {backtestSharpe.toFixed(2)}
                      </p>
                      <p className="text-xs text-text-tertiary">夏普比率</p>
                    </div>
                  </div>

                  {/* ===== Row 3: 操作按钮行 ===== */}
                  <div className="flex items-center gap-2 pt-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => router.push(`/strategies/${config.strategy_id}`)}
                      className="flex-1 h-8 text-sm text-text-secondary hover:text-white"
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      详情
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenEditModal(config)}
                      className="flex-1 h-8 text-sm text-text-secondary hover:text-white"
                    >
                      <Settings className="w-4 h-4 mr-1" />
                      编辑
                    </Button>
                    {/* 上架按钮 - 仅个人策略 */}
                    {canUpload && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenUploadModal(config)}
                        className="flex-1 h-8 text-sm text-brand-primary hover:bg-brand-primary/10"
                      >
                        <Upload className="w-4 h-4 mr-1" />
                        上架
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setSelectedConfig(config); setShowDeleteModal(true); }}
                      disabled={isActive}
                      className="h-8 px-2 text-text-tertiary hover:text-danger disabled:opacity-30"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}

        </div>
      )}

      {/* 启动确认弹窗 */}
      <Dialog
        open={showStartModal}
        onClose={() => setShowStartModal(false)}
        title="启动策略"
      >
        {selectedConfig && (
          <div className="space-y-4">
            {/* 策略基本信息 */}
            <div className="p-4 bg-bg-tertiary rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-text-secondary">策略名称</span>
                <span className="text-white font-medium">{selectedConfig.strategy.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-secondary">投入资本</span>
                <span className="text-white font-medium">${parseFloat(selectedConfig.stake_amount).toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-secondary">杠杆 / 持仓</span>
                <span className="text-white font-medium">{selectedConfig.leverage}x / {selectedConfig.max_open_trades}个</span>
              </div>
            </div>

            {/* 启动前检查结果 */}
            <div className="p-4 bg-bg-tertiary rounded-lg">
              <h4 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                {preflightChecks.checking ? (
                  <Loader2 className="w-4 h-4 animate-spin text-brand-primary" />
                ) : (
                  <Activity className="w-4 h-4 text-brand-primary" />
                )}
                启动前检查
              </h4>
              <div className="space-y-2">
                {/* VPS 状态 */}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-text-secondary">VPS 实例</span>
                  {preflightChecks.checking ? (
                    <Loader2 className="w-4 h-4 animate-spin text-text-tertiary" />
                  ) : preflightChecks.vpsRunning ? (
                    <span className="flex items-center gap-1 text-success">
                      <CheckCircle className="w-4 h-4" /> 运行中
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-danger">
                      <XCircle className="w-4 h-4" /> 未运行
                    </span>
                  )}
                </div>
                {/* API Key 存在 */}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-text-secondary">API Key ({(selectedConfig.custom_config?.exchange as string) || 'binance'})</span>
                  {preflightChecks.checking ? (
                    <Loader2 className="w-4 h-4 animate-spin text-text-tertiary" />
                  ) : preflightChecks.apiKeyExists ? (
                    preflightChecks.apiKeyValid ? (
                      <span className="flex items-center gap-1 text-success">
                        <CheckCircle className="w-4 h-4" /> 已配置
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-warning">
                        <AlertTriangle className="w-4 h-4" /> 待验证
                      </span>
                    )
                  ) : (
                    <span className="flex items-center gap-1 text-danger">
                      <XCircle className="w-4 h-4" /> 未配置
                    </span>
                  )}
                </div>
                {/* 交易所余额 */}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-text-secondary">交易所余额</span>
                  {preflightChecks.checking ? (
                    <Loader2 className="w-4 h-4 animate-spin text-text-tertiary" />
                  ) : preflightChecks.exchangeBalance !== null ? (
                    preflightChecks.balanceSufficient ? (
                      <span className="flex items-center gap-1 text-success">
                        <CheckCircle className="w-4 h-4" /> ${preflightChecks.exchangeBalance.toLocaleString()}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-danger">
                        <XCircle className="w-4 h-4" /> ${preflightChecks.exchangeBalance.toLocaleString()} (不足)
                      </span>
                    )
                  ) : (
                    <span className="text-text-tertiary">-</span>
                  )}
                </div>
                {/* 策略冲突 */}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-text-secondary">策略冲突</span>
                  {preflightChecks.checking ? (
                    <Loader2 className="w-4 h-4 animate-spin text-text-tertiary" />
                  ) : preflightChecks.noConflict ? (
                    <span className="flex items-center gap-1 text-success">
                      <CheckCircle className="w-4 h-4" /> 无冲突
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-warning">
                      <AlertTriangle className="w-4 h-4" /> 有其他运行中
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* 警告提示 */}
            {(!preflightChecks.vpsRunning || !preflightChecks.apiKeyExists) && !preflightChecks.checking && (
              <div className="flex items-center gap-2 p-3 bg-danger/10 border border-danger/30 rounded-lg">
                <XCircle className="w-4 h-4 text-danger flex-shrink-0" />
                <p className="text-sm text-text-secondary">
                  {!preflightChecks.vpsRunning
                    ? '请先启动 VPS 实例'
                    : `请先配置 ${(selectedConfig.custom_config?.exchange as string) || 'binance'} 的 API Key`}
                </p>
              </div>
            )}

            {preflightChecks.vpsRunning && preflightChecks.apiKeyExists && (
              <div className="flex items-center gap-2 p-3 bg-warning/10 border border-warning/30 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0" />
                <p className="text-sm text-text-secondary">
                  启动后策略将开始实盘交易，请确认配置无误
                </p>
              </div>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => setShowStartModal(false)} disabled={actionLoading}>取消</Button>
          <Button
            onClick={handleStartStrategy}
            isLoading={actionLoading}
            disabled={preflightChecks.checking || !preflightChecks.vpsRunning || !preflightChecks.apiKeyExists}
          >
            <Play className="w-4 h-4 mr-2" />
            确认启动
          </Button>
        </DialogFooter>
      </Dialog>

      {/* 删除确认弹窗 */}
      <Dialog
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="删除配置"
        description="确认要删除该策略配置吗？"
      >
        {selectedConfig && (
          <div className="p-4 bg-danger/10 border border-danger/30 rounded-lg">
            <p className="text-danger font-medium mb-2">删除后无法恢复</p>
            <p className="text-sm text-text-secondary">
              策略配置 "{selectedConfig.strategy.name}" 将被永久删除。
            </p>
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => setShowDeleteModal(false)} disabled={actionLoading}>取消</Button>
          <Button variant="danger" onClick={handleDeleteConfig} isLoading={actionLoading}>
            <Trash2 className="w-4 h-4 mr-2" />
            确认删除
          </Button>
        </DialogFooter>
      </Dialog>

      {/* 编辑配置弹窗 */}
      <Dialog
        open={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="编辑策略配置"
      >
        {selectedConfig && (
          <EditConfigForm
            form={editForm}
            setForm={setEditForm}
            showAdvanced={showAdvanced}
            setShowAdvanced={setShowAdvanced}
            isRunning={selectedConfig.is_active}
          />
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => setShowEditModal(false)} disabled={actionLoading}>取消</Button>
          <Button onClick={handleSaveEdit} isLoading={actionLoading}>
            <CheckCircle className="w-4 h-4 mr-2" />
            保存修改
          </Button>
        </DialogFooter>
      </Dialog>

      {/* 上架策略到市场弹窗 */}
      <Dialog
        open={showUploadModal}
        onClose={handleCloseUploadModal}
        title={
          uploadStep === 'conditions' ? '上架条件' :
          uploadStep === 'checking' ? '检测中' :
          uploadStep === 'form' ? '确认上架' :
          uploadStep === 'result' ? (uploadResult?.success ? '提交成功' : '检测未通过') :
          '策略上架'
        }
      >
        {/* Step 1: 上架条件说明 */}
        {uploadStep === 'conditions' && selectedConfig && (
          <div className="space-y-4">
            {/* 策略信息 */}
            <div className="p-3 bg-bg-tertiary rounded-lg">
              <p className="text-white font-medium">{selectedConfig.strategy.name}</p>
              <p className="text-xs text-text-tertiary mt-1">
                {selectedConfig.strategy.trade_type === 'futures' ? '合约' : '现货'}策略
              </p>
            </div>

            {/* 上架条件说明 */}
            <div>
              <p className="text-sm text-white mb-3">上架需满足以下条件：</p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-brand-primary mt-0.5">1.</span>
                  <span className="text-text-secondary">策略已完成至少一次回测</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-brand-primary mt-0.5">2.</span>
                  <span className="text-text-secondary">回测总收益 &gt; 0%</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-brand-primary mt-0.5">3.</span>
                  <span className="text-text-secondary">最大回撤 &lt; 50%</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-brand-primary mt-0.5">4.</span>
                  <span className="text-text-secondary">胜率 &gt; 30%</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-brand-primary mt-0.5">5.</span>
                  <span className="text-text-secondary">策略描述至少 10 个字符</span>
                </li>
              </ul>
            </div>

            {/* 策略描述输入 */}
            <div>
              <p className="text-xs text-text-tertiary mb-2">策略描述（用于展示给其他用户）</p>
              <textarea
                value={uploadDescription}
                onChange={(e) => setUploadDescription(e.target.value)}
                className="w-full px-3 py-3 bg-bg-tertiary rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-brand-primary resize-y min-h-[80px] max-h-[120px]"
                rows={3}
                maxLength={200}
                placeholder="描述策略的特点、适用场景..."
              />
              <p className="text-xs text-text-tertiary mt-1 text-right">{uploadDescription.length}/200</p>
            </div>

            {/* 审核说明 */}
            <div className="p-3 bg-warning/10 border border-warning/30 rounded-lg">
              <p className="text-xs text-warning">
                通过自动检测后将进入人工审核，审核结果将通过站内消息通知。
                上架后其他用户订阅将为您带来 10%-30% 收益分成。
              </p>
            </div>
          </div>
        )}

        {/* Step 2: 检测中 */}
        {uploadStep === 'checking' && (
          <div className="py-8 text-center">
            <Loader2 className="w-10 h-10 text-brand-primary animate-spin mx-auto mb-4" />
            <p className="text-white mb-1">正在检测策略...</p>
            <p className="text-xs text-text-tertiary">检查回测数据和上架条件</p>
          </div>
        )}

        {/* Step 3: 确认提交（检测通过后） */}
        {uploadStep === 'form' && selectedConfig && (
          <div className="space-y-4">
            {/* 检测通过提示 */}
            <div className="flex items-center gap-3 p-3 bg-success/10 border border-success/30 rounded-lg">
              <CheckCircle className="w-5 h-5 text-success flex-shrink-0" />
              <div>
                <p className="text-sm text-success font-medium">检测通过</p>
                <p className="text-xs text-text-tertiary">策略符合上架条件</p>
              </div>
            </div>

            {/* 检测结果摘要 */}
            <div className="grid grid-cols-3 gap-2">
              <div className="p-2 bg-bg-tertiary rounded-lg text-center">
                <p className="text-success text-sm font-medium">
                  {listingChecks.backtestReturn !== null ? `${listingChecks.backtestReturn.toFixed(1)}%` : '--'}
                </p>
                <p className="text-xs text-text-tertiary">收益率</p>
              </div>
              <div className="p-2 bg-bg-tertiary rounded-lg text-center">
                <p className="text-white text-sm font-medium">
                  {listingChecks.backtestWinRate !== null ? `${listingChecks.backtestWinRate.toFixed(1)}%` : '--'}
                </p>
                <p className="text-xs text-text-tertiary">胜率</p>
              </div>
              <div className="p-2 bg-bg-tertiary rounded-lg text-center">
                <p className="text-danger text-sm font-medium">
                  {listingChecks.backtestDrawdown !== null ? `${listingChecks.backtestDrawdown.toFixed(1)}%` : '--'}
                </p>
                <p className="text-xs text-text-tertiary">回撤</p>
              </div>
            </div>

            {/* 策略信息确认 */}
            <div className="p-3 bg-bg-tertiary rounded-lg">
              <p className="text-xs text-text-tertiary mb-1">策略名称</p>
              <p className="text-white">{selectedConfig.strategy.name}</p>
              <p className="text-xs text-text-tertiary mt-3 mb-1">策略描述</p>
              <p className="text-sm text-text-secondary">{uploadDescription || '无描述'}</p>
            </div>

            <p className="text-xs text-text-tertiary">
              提交后将进入人工审核队列，审核通过后策略将上架到策略市场。
            </p>
          </div>
        )}

        {/* Step 4: 提交中 */}
        {uploadStep === 'uploading' && (
          <div className="py-8 text-center">
            <Loader2 className="w-8 h-8 text-brand-primary animate-spin mx-auto mb-3" />
            <p className="text-sm text-text-secondary">正在提交审核...</p>
          </div>
        )}

        {/* Step 5: 结果 */}
        {uploadStep === 'result' && (
          <div className="py-4">
            {uploadResult?.success ? (
              <div className="text-center">
                <CheckCircle className="w-12 h-12 text-success mx-auto mb-3" />
                <p className="text-white mb-1">提交成功</p>
                <p className="text-xs text-text-tertiary mb-4">策略已进入人工审核队列</p>
                <p className="text-xs text-text-tertiary">
                  审核结果将通过站内消息通知，请留意消息中心。
                </p>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <XCircle className="w-10 h-10 text-danger flex-shrink-0" />
                  <div>
                    <p className="text-white font-medium">检测未通过</p>
                    <p className="text-xs text-text-tertiary">请根据以下提示修改后重试</p>
                  </div>
                </div>
                {/* 失败原因列表 */}
                {listingChecks.failReasons.length > 0 && (
                  <ul className="space-y-2">
                    {listingChecks.failReasons.map((reason, index) => (
                      <li key={index} className="flex items-start gap-2 p-2 bg-danger/10 rounded-lg">
                        <XCircle className="w-4 h-4 text-danger flex-shrink-0 mt-0.5" />
                        <span className="text-sm text-text-secondary">{reason}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {uploadResult?.error && !listingChecks.failReasons.length && (
                  <p className="text-sm text-text-secondary p-2 bg-danger/10 rounded-lg">
                    {uploadResult.error}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {uploadStep === 'conditions' && (
            <>
              <Button variant="ghost" onClick={handleCloseUploadModal}>取消</Button>
              <Button onClick={runListingChecks} disabled={uploadDescription.trim().length < 10}>
                开始检测
              </Button>
            </>
          )}
          {uploadStep === 'checking' && (
            <Button variant="ghost" disabled>检测中...</Button>
          )}
          {uploadStep === 'form' && (
            <>
              <Button variant="ghost" onClick={() => setUploadStep('conditions')}>返回</Button>
              <Button onClick={handleUploadStrategy}>
                <Upload className="w-4 h-4 mr-2" />
                提交审核
              </Button>
            </>
          )}
          {uploadStep === 'uploading' && (
            <Button variant="ghost" disabled>提交中...</Button>
          )}
          {uploadStep === 'result' && (
            <Button onClick={handleCloseUploadModal}>
              {uploadResult?.success ? '完成' : '关闭'}
            </Button>
          )}
        </DialogFooter>
      </Dialog>
    </div>
  );
}

// ============ 编辑配置表单 ============
function EditConfigForm({
  form,
  setForm,
  showAdvanced,
  setShowAdvanced,
  isRunning,
}: {
  form: {
    stake_amount: string;
    max_open_trades: number;
    stoploss: string;
    take_profit: string;
    leverage: number;
    timeframe: string;
    exchange: string;
    trailing_stop: boolean;
    trailing_stop_positive: string;
    trailing_stop_offset: string;
    trailing_only_offset_reached: boolean;
    stoploss_on_exchange: boolean;
    crash_protection: boolean;
    crash_threshold: string;
    crash_timeframe: string;
    crash_action: string;
  };
  setForm: React.Dispatch<React.SetStateAction<typeof form>>;
  showAdvanced: boolean;
  setShowAdvanced: (v: boolean) => void;
  isRunning: boolean;
}) {
  // 开关组件
  const Toggle = ({ checked, onChange, color = 'brand-primary' }: { checked: boolean; onChange: () => void; color?: string }) => (
    <button
      type="button"
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        checked ? (color === 'warning' ? 'bg-warning' : 'bg-brand-primary') : 'bg-bg-primary'
      }`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
        checked ? 'translate-x-6' : 'translate-x-1'
      }`} />
    </button>
  );

  return (
    <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
      {/* 投入资本 */}
      <div>
        <label className="block text-sm text-text-secondary mb-2">投入资本 (USDT)</label>
        <input
          type="number"
          value={form.stake_amount}
          onChange={(e) => setForm(prev => ({ ...prev, stake_amount: e.target.value }))}
          className="w-full px-4 py-3 bg-bg-tertiary border border-border-primary rounded-lg text-white text-lg font-medium focus:border-brand-primary focus:outline-none"
          placeholder="10000"
        />
      </div>

      {/* 核心参数 2x3 网格 */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-text-tertiary mb-1">止损 %</label>
          <input
            type="number"
            value={form.stoploss}
            onChange={(e) => setForm(prev => ({ ...prev, stoploss: e.target.value }))}
            min="-100"
            max="0"
            step="0.1"
            className="w-full px-3 py-2 bg-bg-tertiary border border-border-primary rounded-lg text-white text-sm focus:border-brand-primary focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs text-text-tertiary mb-1">止盈 %</label>
          <input
            type="number"
            value={form.take_profit}
            onChange={(e) => setForm(prev => ({ ...prev, take_profit: e.target.value }))}
            className="w-full px-3 py-2 bg-bg-tertiary border border-border-primary rounded-lg text-white text-sm focus:border-brand-primary focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs text-text-tertiary mb-1">杠杆</label>
          <select
            value={form.leverage}
            onChange={(e) => setForm(prev => ({ ...prev, leverage: parseInt(e.target.value) }))}
            className="w-full px-3 py-2 bg-bg-tertiary border border-border-primary rounded-lg text-white text-sm focus:border-brand-primary focus:outline-none"
          >
            <option value={1}>1x</option>
            <option value={2}>2x</option>
            <option value={3}>3x</option>
            <option value={5}>5x</option>
            <option value={10}>10x</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-text-tertiary mb-1">持仓数</label>
          <input
            type="number"
            value={form.max_open_trades}
            onChange={(e) => setForm(prev => ({ ...prev, max_open_trades: parseInt(e.target.value) || 1 }))}
            className="w-full px-3 py-2 bg-bg-tertiary border border-border-primary rounded-lg text-white text-sm focus:border-brand-primary focus:outline-none"
            min={1}
            max={10}
          />
        </div>
        <div>
          <label className="block text-xs text-text-tertiary mb-1">K线周期</label>
          <select
            value={form.timeframe}
            onChange={(e) => setForm(prev => ({ ...prev, timeframe: e.target.value }))}
            className="w-full px-3 py-2 bg-bg-tertiary border border-border-primary rounded-lg text-white text-sm focus:border-brand-primary focus:outline-none"
          >
            <option value="1m">1分钟</option>
            <option value="5m">5分钟</option>
            <option value="15m">15分钟</option>
            <option value="1h">1小时</option>
            <option value="4h">4小时</option>
            <option value="1d">1天</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-text-tertiary mb-1">交易所</label>
          <select
            value={form.exchange}
            onChange={(e) => setForm(prev => ({ ...prev, exchange: e.target.value }))}
            className="w-full px-3 py-2 bg-bg-tertiary border border-border-primary rounded-lg text-white text-sm focus:border-brand-primary focus:outline-none"
          >
            <option value="binance">Binance</option>
            <option value="okx">OKX</option>
            <option value="bybit">Bybit</option>
          </select>
        </div>
      </div>

      {/* 风控开关 */}
      <div className="pt-3 border-t border-border-primary space-y-2">
        <div className="flex items-center justify-between py-2">
          <span className="text-white text-sm">追踪止损</span>
          <Toggle
            checked={form.trailing_stop}
            onChange={() => setForm(prev => ({ ...prev, trailing_stop: !prev.trailing_stop }))}
          />
        </div>
        <div className="flex items-center justify-between py-2">
          <span className="text-white text-sm">交易所止损</span>
          <Toggle
            checked={form.stoploss_on_exchange}
            onChange={() => setForm(prev => ({ ...prev, stoploss_on_exchange: !prev.stoploss_on_exchange }))}
          />
        </div>
        <div className="flex items-center justify-between py-2">
          <span className="text-white text-sm">黑天鹅防护</span>
          <Toggle
            checked={form.crash_protection}
            onChange={() => setForm(prev => ({ ...prev, crash_protection: !prev.crash_protection }))}
            color="warning"
          />
        </div>
      </div>

      {/* 黑天鹅详细配置 */}
      {form.crash_protection && (
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="block text-xs text-text-tertiary mb-1">跌幅 %</label>
            <input
              type="number"
              value={form.crash_threshold}
              onChange={(e) => setForm(prev => ({ ...prev, crash_threshold: e.target.value }))}
              className="w-full px-2 py-1.5 bg-bg-tertiary border border-border-primary rounded text-white text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-text-tertiary mb-1">监测(分钟)</label>
            <input
              type="number"
              value={form.crash_timeframe}
              onChange={(e) => setForm(prev => ({ ...prev, crash_timeframe: e.target.value }))}
              className="w-full px-2 py-1.5 bg-bg-tertiary border border-border-primary rounded text-white text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-text-tertiary mb-1">触发动作</label>
            <select
              value={form.crash_action}
              onChange={(e) => setForm(prev => ({ ...prev, crash_action: e.target.value }))}
              className="w-full px-2 py-1.5 bg-bg-tertiary border border-border-primary rounded text-white text-sm"
            >
              <option value="pause">暂停</option>
              <option value="close_all">平仓</option>
              <option value="notify_only">通知</option>
            </select>
          </div>
        </div>
      )}

      {/* 追踪止损高级配置 */}
      {form.trailing_stop && (
        <>
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full flex items-center justify-between py-2 text-text-secondary hover:text-white transition-colors"
          >
            <span className="text-xs">追踪止损高级配置</span>
            {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showAdvanced && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-text-tertiary mb-1">正向偏移 %</label>
                <input
                  type="number"
                  value={form.trailing_stop_positive}
                  onChange={(e) => setForm(prev => ({ ...prev, trailing_stop_positive: e.target.value }))}
                  className="w-full px-2 py-1.5 bg-bg-tertiary border border-border-primary rounded text-white text-sm"
                  placeholder="1"
                />
              </div>
              <div>
                <label className="block text-xs text-text-tertiary mb-1">止损偏移 %</label>
                <input
                  type="number"
                  value={form.trailing_stop_offset}
                  onChange={(e) => setForm(prev => ({ ...prev, trailing_stop_offset: e.target.value }))}
                  className="w-full px-2 py-1.5 bg-bg-tertiary border border-border-primary rounded text-white text-sm"
                  placeholder="2"
                />
              </div>
              <div className="col-span-2 flex items-center justify-between py-2">
                <span className="text-xs text-text-secondary">仅偏移触发后追踪</span>
                <Toggle
                  checked={form.trailing_only_offset_reached}
                  onChange={() => setForm(prev => ({ ...prev, trailing_only_offset_reached: !prev.trailing_only_offset_reached }))}
                />
              </div>
            </div>
          )}
        </>
      )}

      {/* 运行中提示 */}
      {isRunning && (
        <p className="text-xs text-warning">修改后下次交易时生效</p>
      )}
    </div>
  );
}
