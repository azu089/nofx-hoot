'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, Button, Dialog, DialogFooter, MobileHeader } from '@/components/ui';
import { strategiesApi, instancesApi } from '@/lib/api';
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
  Eye,
  TrendingUp,
  Activity,
  DollarSign,
  BarChart3,
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
    trade_type?: 'spot' | 'futures'; // 现货/合约
    // 回测数据
    backtest_total_return?: string;
    backtest_win_rate?: string;
    backtest_max_drawdown?: string;
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
    trailing_stop: false,
    trailing_stop_positive: '1',
    trailing_stop_offset: '2',
    trailing_only_offset_reached: true,
    stoploss_on_exchange: false,
    crash_protection: false,
    crash_threshold: '-10',
    crash_timeframe: '5',
  });
  const [showAdvanced, setShowAdvanced] = useState(false);

  // 初始化数据
  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [instancesRes, configsRes] = await Promise.all([
        instancesApi.list().catch(() => ({ data: [] })),
        strategiesApi.getMyConfigs().catch(() => ({ data: [] })),
      ]);

      // VPS 实例检查
      const runningInstance = instancesRes.data?.find(
        (i: { status: string }) => i.status === 'running' || i.status === 'provisioning'
      );
      setHasInstance(!!runningInstance);

      // 策略配置
      setConfigs(configsRes.data || []);
    } catch (error) {
      console.error('获取数据失败:', error);
    } finally {
      setLoading(false);
    }
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
    const customConfig = config.custom_config || {};
    setEditForm({
      stake_amount: config.stake_amount,
      max_open_trades: config.max_open_trades,
      stoploss: (parseFloat(config.stoploss) * 100).toString(),
      take_profit: customConfig.take_profit ? String(parseFloat(String(customConfig.take_profit)) * 100) : '10',
      leverage: config.leverage,
      trailing_stop: config.trailing_stop,
      trailing_stop_positive: config.trailing_stop_positive
        ? (parseFloat(config.trailing_stop_positive) * 100).toString()
        : '1',
      trailing_stop_offset: customConfig.trailing_stop_offset
        ? String(parseFloat(String(customConfig.trailing_stop_offset)) * 100)
        : '2',
      trailing_only_offset_reached: customConfig.trailing_only_offset_reached !== false,
      stoploss_on_exchange: customConfig.stoploss_on_exchange === true,
      crash_protection: customConfig.crash_protection === true,
      crash_threshold: customConfig.crash_threshold ? String(customConfig.crash_threshold) : '-10',
      crash_timeframe: customConfig.crash_timeframe ? String(customConfig.crash_timeframe) : '5',
    });
    setShowAdvanced(false);
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedConfig) return;
    setActionLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      setConfigs(prev => prev.map(c =>
        c.id === selectedConfig.id ? {
          ...c,
          stake_amount: editForm.stake_amount,
          max_open_trades: editForm.max_open_trades,
          stoploss: (parseFloat(editForm.stoploss) / 100).toString(),
          leverage: editForm.leverage,
          trailing_stop: editForm.trailing_stop,
          trailing_stop_positive: editForm.trailing_stop
            ? (parseFloat(editForm.trailing_stop_positive) / 100).toString()
            : null,
        } : c
      ));
      setShowEditModal(false);
    } catch (error) {
      alert(error instanceof Error ? error.message : '保存失败');
    } finally {
      setActionLoading(false);
    }
  };

  // 上传策略到市场
  const handleUploadStrategy = async () => {
    if (!selectedConfig) return;
    setActionLoading(true);
    try {
      await strategiesApi.submitForReview(selectedConfig.strategy_id);
      setShowUploadModal(false);
      // 跳转到策略管理页面查看状态
      router.push('/strategies/manage');
    } catch (error) {
      alert(error instanceof Error ? error.message : '提交失败');
    } finally {
      setActionLoading(false);
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
      <div className="space-y-6">
        <MobileHeader title="我的策略" />
        <div className="animate-pulse space-y-4">
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
      <MobileHeader title="我的策略" />

      {/* 页面描述 */}
      <p className="text-text-secondary text-sm -mt-2">
        管理已配置的策略，控制启停
      </p>

      {/* 数据统计卡片 */}
      <Card className="bg-gradient-to-r from-brand-primary/10 to-success/10 border-brand-primary/30">
        <CardContent className="p-4">
          <div className="grid grid-cols-4 gap-3">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <BarChart3 className="w-3.5 h-3.5 text-brand-primary" />
                <span className="text-lg font-bold text-white">{stats.totalCount}</span>
              </div>
              <p className="text-[10px] text-text-tertiary">已配置</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Activity className="w-3.5 h-3.5 text-success" />
                <span className="text-lg font-bold text-success">{stats.runningCount}</span>
              </div>
              <p className="text-[10px] text-text-tertiary">运行中</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <DollarSign className="w-3.5 h-3.5 text-warning" />
                <span className="text-lg font-bold text-white">${stats.totalInvested.toLocaleString()}</span>
              </div>
              <p className="text-[10px] text-text-tertiary">总投入</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <TrendingUp className="w-3.5 h-3.5 text-brand-primary" />
                <span className="text-lg font-bold text-brand-primary">{stats.personalCount}</span>
              </div>
              <p className="text-[10px] text-text-tertiary">个人策略</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 筛选器 */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {/* 来源筛选 */}
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className="px-3 py-1.5 bg-bg-secondary border border-border-primary rounded-md text-xs text-text-secondary focus:border-brand-primary focus:outline-none"
        >
          {SOURCE_FILTERS.map(f => (
            <option key={f.key} value={f.key}>{f.label}</option>
          ))}
        </select>
        {/* 类型筛选 */}
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-1.5 bg-bg-secondary border border-border-primary rounded-md text-xs text-text-secondary focus:border-brand-primary focus:outline-none"
        >
          {TYPE_FILTERS.map(f => (
            <option key={f.key} value={f.key}>{f.label}</option>
          ))}
        </select>
        {/* 数量提示 */}
        <span className="text-xs text-text-tertiary py-1.5 ml-auto whitespace-nowrap">
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
              去策略市场选择策略，配置参数后开始交易
            </p>
            <Button onClick={() => router.push('/strategies')}>
              <Plus className="w-4 h-4 mr-2" />
              去策略市场
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredConfigs.map((config) => {
            const isActive = config.is_active;
            const stoplossPercent = (parseFloat(config.stoploss) * 100).toFixed(1);
            const source = getStrategySource(config.strategy);
            const tradeType = getTradeType(config.strategy);
            // 只有个人策略（非公开且非系统）才能上传
            const canUpload = !config.strategy.is_public && config.strategy.owner_type !== 'system';

            // 回测数据
            const backtestReturn = parseFloat(config.strategy.backtest_total_return || '0');
            const backtestWinRate = parseFloat(config.strategy.backtest_win_rate || '0');
            const backtestDrawdown = parseFloat(config.strategy.backtest_max_drawdown || '0');

            return (
              <Card
                key={config.id}
                className={`transition-all ${isActive ? 'border-success/30' : 'border-border-primary'}`}
              >
                <CardContent className="p-3">
                  {/* ===== 头部：策略名 + 标签 + 状态 + 启停按钮 ===== */}
                  <div className="flex items-center gap-1.5 mb-2">
                    <h3 className="text-white font-semibold text-sm truncate flex-1">{config.strategy.name}</h3>
                    {/* 交易类型标签 */}
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${tradeType.color} ${tradeType.textColor}`}>
                      {tradeType.label}
                    </span>
                    {/* 来源标签 */}
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${source.color} ${source.textColor}`}>
                      {source.label}
                    </span>
                    {/* 运行状态 */}
                    <div className="flex items-center gap-0.5 shrink-0">
                      <div className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-success animate-pulse' : 'bg-text-tertiary'}`} />
                      <span className={`text-[10px] ${isActive ? 'text-success' : 'text-text-tertiary'}`}>
                        {isActive ? '运行中' : '已停止'}
                      </span>
                    </div>
                    {/* 启停按钮 */}
                    {isActive ? (
                      <button
                        onClick={() => handleStopStrategy(config)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-danger/10 text-danger hover:bg-danger/20 transition-colors shrink-0"
                      >
                        <Pause className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        onClick={() => { setSelectedConfig(config); setShowStartModal(true); }}
                        disabled={!hasInstance}
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-success/10 text-success hover:bg-success/20 transition-colors disabled:opacity-50 shrink-0"
                      >
                        <Play className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* ===== 核心数据：收益/胜率/回撤 居中 ===== */}
                  <div className="grid grid-cols-3 gap-2 py-2">
                    <div className="text-center">
                      <p className={`text-base font-bold ${backtestReturn >= 0 ? 'text-success' : 'text-danger'}`}>
                        {backtestReturn >= 0 ? '+' : ''}{backtestReturn.toFixed(1)}%
                      </p>
                      <p className="text-[10px] text-text-tertiary">回测收益</p>
                    </div>
                    <div className="text-center">
                      <p className="text-base font-bold text-white">{backtestWinRate.toFixed(0)}%</p>
                      <p className="text-[10px] text-text-tertiary">胜率</p>
                    </div>
                    <div className="text-center">
                      <p className="text-base font-bold text-danger">-{Math.abs(backtestDrawdown).toFixed(0)}%</p>
                      <p className="text-[10px] text-text-tertiary">回撤</p>
                    </div>
                  </div>

                  {/* ===== 参数行：一行显示 ===== */}
                  <div className="flex items-center gap-1.5 py-1.5 text-xs text-text-secondary overflow-x-auto">
                    <span className="flex items-center gap-1 whitespace-nowrap">
                      <DollarSign className="w-3 h-3 text-warning" />
                      ${parseFloat(config.stake_amount).toLocaleString()}
                    </span>
                    <span className="text-text-tertiary">·</span>
                    <span className="whitespace-nowrap">{config.leverage}x杠杆</span>
                    <span className="text-text-tertiary">·</span>
                    <span className="text-danger whitespace-nowrap">{stoplossPercent}%止损</span>
                    <span className="text-text-tertiary">·</span>
                    <span className="whitespace-nowrap">最大{config.max_open_trades}仓</span>
                    {config.trailing_stop && (
                      <>
                        <span className="text-text-tertiary">·</span>
                        <span className="text-brand-primary whitespace-nowrap flex items-center gap-0.5">
                          <CheckCircle className="w-3 h-3" />
                          追踪止损
                        </span>
                      </>
                    )}
                  </div>

                  {/* ===== 操作按钮行 ===== */}
                  <div className="flex items-center gap-1.5 pt-1.5 border-t border-border-primary/30">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => router.push(`/strategies/${config.strategy_id}`)}
                      className="flex-1 h-7 text-xs text-text-secondary hover:text-white"
                    >
                      <Eye className="w-3 h-3 mr-0.5" />
                      详情
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenEditModal(config)}
                      className="flex-1 h-7 text-xs text-text-secondary hover:text-white"
                    >
                      <Settings className="w-3 h-3 mr-0.5" />
                      编辑
                    </Button>
                    {/* 上架按钮 - 仅个人策略 */}
                    {canUpload && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setSelectedConfig(config); setShowUploadModal(true); }}
                        className="flex-1 h-7 text-xs text-brand-primary hover:bg-brand-primary/10"
                      >
                        <Upload className="w-3 h-3 mr-0.5" />
                        上架
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setSelectedConfig(config); setShowDeleteModal(true); }}
                      disabled={isActive}
                      className="h-7 px-1.5 text-text-tertiary hover:text-danger disabled:opacity-30"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {/* 添加更多配置入口 */}
          <Button variant="outline" className="w-full h-12" onClick={() => router.push('/strategies')}>
            <Plus className="w-4 h-4 mr-2" />
            从策略市场添加
          </Button>
        </div>
      )}

      {/* 启动确认弹窗 */}
      <Dialog
        open={showStartModal}
        onClose={() => setShowStartModal(false)}
        title="启动策略"
        description="确认要启动该策略吗？"
      >
        {selectedConfig && (
          <div className="space-y-4">
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
            <div className="flex items-center gap-2 p-3 bg-warning/10 border border-warning/30 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0" />
              <p className="text-sm text-text-secondary">
                启动后策略将开始实盘交易，请确保 API Key 已正确配置
              </p>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => setShowStartModal(false)} disabled={actionLoading}>取消</Button>
          <Button onClick={handleStartStrategy} isLoading={actionLoading}>
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
        description={selectedConfig ? `修改 ${selectedConfig.strategy.name} 的运行参数` : ''}
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

      {/* 上传策略到市场弹窗 */}
      <Dialog
        open={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        title="上传策略到市场"
        description="将您的策略分享到策略市场，其他用户可以订阅使用"
      >
        {selectedConfig && (
          <div className="space-y-4">
            <div className="p-4 bg-bg-tertiary rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-text-secondary">策略名称</span>
                <span className="text-white font-medium">{selectedConfig.strategy.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-secondary">策略描述</span>
                <span className="text-text-secondary text-sm">{selectedConfig.strategy.description || '暂无描述'}</span>
              </div>
            </div>

            <div className="p-3 bg-brand-primary/10 border border-brand-primary/30 rounded-lg">
              <p className="text-sm text-text-secondary mb-2">上架流程说明：</p>
              <ol className="text-xs text-text-tertiary space-y-1 list-decimal list-inside">
                <li>提交后系统自动进行回测验证</li>
                <li>回测通过后需完成 7 天试运行</li>
                <li>试运行期间需完成至少 10 笔交易</li>
                <li>审核通过后策略将上架市场</li>
              </ol>
            </div>

            <div className="flex items-center gap-2 p-3 bg-warning/10 border border-warning/30 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0" />
              <p className="text-sm text-text-secondary">
                上架后您将获得用户订阅的收益分成
              </p>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => setShowUploadModal(false)} disabled={actionLoading}>取消</Button>
          <Button onClick={handleUploadStrategy} isLoading={actionLoading}>
            <Upload className="w-4 h-4 mr-2" />
            申请上架
          </Button>
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
    trailing_stop: boolean;
    trailing_stop_positive: string;
    trailing_stop_offset: string;
    trailing_only_offset_reached: boolean;
    stoploss_on_exchange: boolean;
    crash_protection: boolean;
    crash_threshold: string;
    crash_timeframe: string;
  };
  setForm: React.Dispatch<React.SetStateAction<typeof form>>;
  showAdvanced: boolean;
  setShowAdvanced: (v: boolean) => void;
  isRunning: boolean;
}) {
  return (
    <div className="space-y-4 max-h-[60vh] overflow-y-auto">
      {/* 投入资本 */}
      <div>
        <label className="block text-sm text-text-secondary mb-2">投入资本 (USDT)</label>
        <input
          type="number"
          value={form.stake_amount}
          onChange={(e) => setForm(prev => ({ ...prev, stake_amount: e.target.value }))}
          className="w-full px-3 py-2 bg-bg-tertiary border border-border-primary rounded-lg text-white focus:border-brand-primary focus:outline-none"
        />
      </div>

      {/* 最大持仓数 */}
      <div>
        <label className="block text-sm text-text-secondary mb-2">最大持仓数</label>
        <input
          type="number"
          value={form.max_open_trades}
          onChange={(e) => setForm(prev => ({ ...prev, max_open_trades: parseInt(e.target.value) || 1 }))}
          className="w-full px-3 py-2 bg-bg-tertiary border border-border-primary rounded-lg text-white focus:border-brand-primary focus:outline-none"
          min={1}
          max={10}
        />
      </div>

      {/* 止损/止盈 */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm text-text-secondary mb-2">止损 (%)</label>
          <input
            type="number"
            value={form.stoploss}
            onChange={(e) => setForm(prev => ({ ...prev, stoploss: e.target.value }))}
            className="w-full px-3 py-2 bg-bg-tertiary border border-border-primary rounded-lg text-white focus:border-brand-primary focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm text-text-secondary mb-2">止盈 (%)</label>
          <input
            type="number"
            value={form.take_profit}
            onChange={(e) => setForm(prev => ({ ...prev, take_profit: e.target.value }))}
            className="w-full px-3 py-2 bg-bg-tertiary border border-border-primary rounded-lg text-white focus:border-brand-primary focus:outline-none"
          />
        </div>
      </div>

      {/* 杠杆倍数 */}
      <div>
        <label className="block text-sm text-text-secondary mb-2">杠杆倍数</label>
        <select
          value={form.leverage}
          onChange={(e) => setForm(prev => ({ ...prev, leverage: parseInt(e.target.value) }))}
          className="w-full px-3 py-2 bg-bg-tertiary border border-border-primary rounded-lg text-white focus:border-brand-primary focus:outline-none"
        >
          <option value={1}>1x (无杠杆)</option>
          <option value={2}>2x</option>
          <option value={3}>3x</option>
          <option value={5}>5x</option>
          <option value={10}>10x</option>
        </select>
      </div>

      {/* 追踪止损 */}
      <div className="flex items-center justify-between p-3 bg-bg-tertiary rounded-lg">
        <div>
          <p className="text-white text-sm">追踪止损</p>
          <p className="text-xs text-text-tertiary">价格上涨时自动提高止损位</p>
        </div>
        <button
          type="button"
          onClick={() => setForm(prev => ({ ...prev, trailing_stop: !prev.trailing_stop }))}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            form.trailing_stop ? 'bg-brand-primary' : 'bg-bg-primary'
          }`}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            form.trailing_stop ? 'translate-x-6' : 'translate-x-1'
          }`} />
        </button>
      </div>

      {/* 高级参数 */}
      <button
        type="button"
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="w-full flex items-center justify-between p-3 bg-bg-tertiary rounded-lg text-text-secondary hover:text-white transition-colors"
      >
        <span className="text-sm font-medium">高级参数</span>
        {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {showAdvanced && (
        <div className="space-y-4 p-4 bg-bg-tertiary/30 rounded-lg border border-border-primary">
          {/* 黑天鹅防护 */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-warning" />
                黑天鹅防护
              </p>
              <p className="text-xs text-text-tertiary">短时间大幅下跌时自动暂停</p>
            </div>
            <button
              type="button"
              onClick={() => setForm(prev => ({ ...prev, crash_protection: !prev.crash_protection }))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                form.crash_protection ? 'bg-warning' : 'bg-bg-primary'
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                form.crash_protection ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </div>

          {form.crash_protection && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-text-secondary mb-1">跌幅阈值 (%)</label>
                <input
                  type="number"
                  value={form.crash_threshold}
                  onChange={(e) => setForm(prev => ({ ...prev, crash_threshold: e.target.value }))}
                  className="w-full px-3 py-2 bg-bg-tertiary border border-border-primary rounded-lg text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-text-secondary mb-1">监测时间 (分钟)</label>
                <input
                  type="number"
                  value={form.crash_timeframe}
                  onChange={(e) => setForm(prev => ({ ...prev, crash_timeframe: e.target.value }))}
                  className="w-full px-3 py-2 bg-bg-tertiary border border-border-primary rounded-lg text-white text-sm"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* 运行中警告 */}
      {isRunning && (
        <div className="flex items-center gap-2 p-3 bg-warning/10 border border-warning/30 rounded-lg">
          <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0" />
          <p className="text-sm text-text-secondary">
            策略正在运行中，修改配置后会在下次交易时生效
          </p>
        </div>
      )}
    </div>
  );
}
