'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowUpDown, Clock, AlertCircle, ChevronDown, Loader2, History, Wallet } from 'lucide-react';
import { Button, Card, Input, Empty } from '@/components/ui';
import { MobileHeader } from '@/components/ui/MobileBackButton';
import { exchangeApi, userApi } from '@/lib/api';

// 资产类型
type AssetType = 'usdt' | 'card' | 'points' | 'token';

// 资产配置 - 使用专业货币图标 (参考 Binance/OKX 设计)
const ASSET_CONFIG: Record<AssetType, { label: string; icon: string; color: string; bgColor: string }> = {
  usdt: { label: 'USDT', icon: '/icons/usdt.svg', color: 'text-[#26A17B]', bgColor: 'bg-[#26A17B]/20' },
  card: { label: '点卡', icon: '/icons/card.svg', color: 'text-[#F7931A]', bgColor: 'bg-[#F7931A]/20' },
  points: { label: '积分', icon: '/icons/points.svg', color: 'text-[#FFD700]', bgColor: 'bg-[#FFD700]/20' },
  token: { label: 'QFI', icon: '/icons/qfi.svg', color: 'text-[#3772FF]', bgColor: 'bg-[#3772FF]/20' },
};

// 兑换规则矩阵
const EXCHANGE_RULES: Record<AssetType, AssetType[]> = {
  usdt: ['card', 'token'],    // USDT → 点卡, QFI
  card: [],                   // 点卡不可兑换
  points: ['token'],          // 积分 → QFI
  token: ['usdt'],            // QFI → USDT
};

// 点卡套餐配置（燃油费预充）
const CARD_PACKAGES = [
  { amount: 50, bonus: 0, label: '体验' },
  { amount: 100, bonus: 5, label: '入门' },
  { amount: 200, bonus: 8, label: '标准' },
  { amount: 500, bonus: 12, label: '高级' },
  { amount: 1000, bonus: 18, label: '尊享' },
  { amount: 2000, bonus: 25, label: '旗舰' },
];

// 资产图标组件 - 专业货币 Logo 样式 (参考 Binance/OKX)
const AssetIcon = ({ asset, size = 24 }: { asset: AssetType; size?: number }) => {
  const config = ASSET_CONFIG[asset];
  return (
    <div
      className="flex items-center justify-center rounded-full overflow-hidden shrink-0"
      style={{ width: size, height: size }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={config.icon}
        alt={config.label}
        width={size}
        height={size}
        className="w-full h-full object-cover"
      />
    </div>
  );
};

interface QuoteData {
  quote_id: string;
  from_asset: string;
  from_amount: string;
  to_asset: string;
  to_amount: string;
  exchange_rate: string;
  fee_rate: string;
  fee_amount: string;
  expires_at: string;
  instant_amount?: string;
  vesting_amount?: string;
  vesting_days?: number;
  burned_amount?: string;
}

interface WalletData {
  usdt_balance: string;
  card_balance: string;
  points_balance: string;
  token_balance: string;
}

export default function ExchangePage() {
  const router = useRouter();

  // 表单状态
  const [fromAsset, setFromAsset] = useState<AssetType>('usdt');
  const [toAsset, setToAsset] = useState<AssetType>('card');
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState<'standard' | 'instant'>('standard');
  const [selectedPackage, setSelectedPackage] = useState<number | null>(null);

  // 数据状态
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [quote, setQuote] = useState<QuoteData | null>(null);
  const [quoteExpiry, setQuoteExpiry] = useState<number>(0);

  // UI 状态
  const [loading, setLoading] = useState(false);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showFromSelector, setShowFromSelector] = useState(false);
  const [showToSelector, setShowToSelector] = useState(false);

  // 获取钱包余额
  useEffect(() => {
    const fetchWallet = async () => {
      try {
        const res = await userApi.getWallet();
        setWallet({
          usdt_balance: res.data.usdt_balance,
          card_balance: res.data.card_balance,
          points_balance: res.data.points_balance,
          token_balance: res.data.token_balance,
        });
      } catch (err) {
        console.error('获取钱包失败:', err);
      }
    };
    fetchWallet();
  }, []);

  // 获取可用目标资产
  const availableToAssets = EXCHANGE_RULES[fromAsset];

  // 当来源资产改变时，自动选择第一个可用目标
  useEffect(() => {
    const available = EXCHANGE_RULES[fromAsset];
    if (available.length > 0 && !available.includes(toAsset)) {
      setToAsset(available[0]);
    }
    setQuote(null);
    setError('');
    setSelectedPackage(null);
  }, [fromAsset, toAsset]);

  // 计算套餐赠送
  const calculateBonus = useCallback(() => {
    if (fromAsset !== 'usdt' || toAsset !== 'card' || !amount) return null;
    const inputAmount = parseFloat(amount);
    if (isNaN(inputAmount) || inputAmount <= 0) return null;

    // 找到适用的套餐（从高到低匹配）
    for (let i = CARD_PACKAGES.length - 1; i >= 0; i--) {
      const pkg = CARD_PACKAGES[i];
      if (inputAmount >= pkg.amount) {
        const bonusAmount = inputAmount * (pkg.bonus / 100);
        return {
          package: pkg,
          bonusAmount,
          totalAmount: inputAmount + bonusAmount,
        };
      }
    }
    return null;
  }, [fromAsset, toAsset, amount]);

  const bonusInfo = calculateBonus();

  // 交换来源和目标
  const handleSwap = () => {
    if (EXCHANGE_RULES[toAsset].includes(fromAsset)) {
      const temp = fromAsset;
      setFromAsset(toAsset);
      setToAsset(temp);
      setAmount('');
      setQuote(null);
      setError('');
    }
  };

  // 获取余额
  const getBalance = (asset: AssetType): string => {
    if (!wallet) return '0';
    switch (asset) {
      case 'usdt': return wallet.usdt_balance;
      case 'card': return wallet.card_balance;
      case 'points': return wallet.points_balance;
      case 'token': return wallet.token_balance;
      default: return '0';
    }
  };

  // 设置最大金额
  const handleSetMax = () => {
    const balance = getBalance(fromAsset);
    setAmount(balance);
    setSelectedPackage(null);
  };

  // 选择套餐
  const handleSelectPackage = (pkg: typeof CARD_PACKAGES[0]) => {
    setAmount(pkg.amount.toString());
    setSelectedPackage(pkg.amount);
  };

  // 获取报价
  const fetchQuote = useCallback(async () => {
    if (!amount || parseFloat(amount) <= 0) {
      setQuote(null);
      return;
    }

    setQuoteLoading(true);
    setError('');

    try {
      const res = await exchangeApi.getQuote({
        from_asset: fromAsset,
        to_asset: toAsset,
        amount,
        mode: fromAsset === 'points' ? mode : undefined,
      });
      setQuote(res.data);

      // 设置过期倒计时
      const expiresAt = new Date(res.data.expires_at).getTime();
      setQuoteExpiry(Math.floor((expiresAt - Date.now()) / 1000));
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '获取报价失败';
      setError(errorMessage);
      setQuote(null);
    } finally {
      setQuoteLoading(false);
    }
  }, [amount, fromAsset, toAsset, mode]);

  // 金额改变时延迟获取报价
  useEffect(() => {
    const timer = setTimeout(() => {
      if (amount && parseFloat(amount) > 0) {
        fetchQuote();
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [amount, fetchQuote]);

  // 倒计时
  useEffect(() => {
    if (quoteExpiry <= 0) return;

    const timer = setInterval(() => {
      setQuoteExpiry((prev) => {
        if (prev <= 1) {
          // 报价过期，自动刷新
          setQuote(null);
          // 如果有金额，自动重新获取报价
          if (amount && parseFloat(amount) > 0) {
            setTimeout(() => fetchQuote(), 100);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [quoteExpiry, amount, fetchQuote]);

  // 执行兑换
  const handleConvert = async () => {
    if (!quote) return;

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await exchangeApi.convert({ quote_id: quote.quote_id });

      if (res.data.success) {
        setSuccess(`兑换成功！获得 ${res.data.to_amount} ${ASSET_CONFIG[toAsset].label}`);
        setAmount('');
        setQuote(null);

        // 刷新钱包余额
        const walletRes = await userApi.getWallet();
        setWallet({
          usdt_balance: walletRes.data.usdt_balance,
          card_balance: walletRes.data.card_balance,
          points_balance: walletRes.data.points_balance,
          token_balance: walletRes.data.token_balance,
        });
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '兑换失败';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // 检查是否可以交换
  const canSwap = EXCHANGE_RULES[toAsset].includes(fromAsset);

  return (
    <div className="max-w-lg mx-auto space-y-4">
      {/* 页面标题 - 移动端和桌面端统一 */}
      <MobileHeader
        title="闪兑"
        rightAction={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/wallet/exchange/history')}
            className="flex items-center gap-1"
          >
            <History className="w-4 h-4" />
            <span className="hidden sm:inline">兑换记录</span>
          </Button>
        }
      />

      {/* 兑换卡片 - 移动端极简风格 */}
      <div className="lg:hidden space-y-4 px-4">
        {/* 来源资产 - 支付区块 */}
        <div className="p-4 bg-bg-secondary rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-text-tertiary">支付</span>
            <span className="text-xs text-text-tertiary">
              可用: {parseFloat(getBalance(fromAsset)).toFixed(4)} {ASSET_CONFIG[fromAsset].label}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {/* 资产选择器 */}
            <button
              type="button"
              onClick={() => setShowFromSelector(!showFromSelector)}
              className="flex items-center gap-2 px-3 py-2 bg-bg-secondary rounded-lg hover:bg-bg-primary transition-colors shrink-0"
            >
              <AssetIcon asset={fromAsset} size={24} />
              <span className={`font-medium ${ASSET_CONFIG[fromAsset].color}`}>
                {ASSET_CONFIG[fromAsset].label}
              </span>
              <ChevronDown className={`w-4 h-4 text-text-tertiary transition-transform ${showFromSelector ? 'rotate-180' : ''}`} />
            </button>
            {/* 金额输入 */}
            <div className="flex-1 text-right">
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="border-0 bg-transparent text-xl font-bold text-right p-0 h-auto"
              />
            </div>
            <button
              type="button"
              onClick={handleSetMax}
              className="px-2 py-1 text-xs text-brand-primary hover:text-brand-secondary bg-brand-primary/10 rounded"
            >
              最大
            </button>
          </div>
          {/* 资产选择下拉 */}
          {showFromSelector && (
            <div className="mt-2 bg-bg-secondary border border-border-primary rounded-lg shadow-lg overflow-hidden">
              {(['usdt', 'points', 'token'] as AssetType[]).map((asset) => (
                <button
                  key={asset}
                  type="button"
                  onClick={() => {
                    setFromAsset(asset);
                    setShowFromSelector(false);
                  }}
                  className={`w-full flex items-center gap-3 p-3 hover:bg-bg-tertiary transition-colors ${
                    fromAsset === asset ? 'bg-bg-tertiary' : ''
                  }`}
                >
                  <AssetIcon asset={asset} size={28} />
                  <span className={ASSET_CONFIG[asset].color}>{ASSET_CONFIG[asset].label}</span>
                  <span className="ml-auto text-sm text-text-tertiary">
                    {parseFloat(getBalance(asset)).toFixed(2)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 交换按钮 - 居中悬浮效果 */}
        <div className="flex justify-center -my-3 relative z-10">
          <button
            type="button"
            onClick={handleSwap}
            disabled={!canSwap}
            className={`p-2 rounded-full border-4 border-bg-secondary transition-colors ${
              canSwap
                ? 'bg-brand-primary hover:bg-brand-secondary text-white'
                : 'bg-bg-tertiary text-text-tertiary cursor-not-allowed'
            }`}
          >
            <ArrowUpDown className="w-4 h-4" />
          </button>
        </div>

        {/* 目标资产 - 获得区块 */}
        <div className="p-4 bg-bg-secondary rounded-xl">
          {availableToAssets.length > 0 ? (
            <>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-text-tertiary">获得</span>
                <span className="text-xs text-text-tertiary">
                  持有: {parseFloat(getBalance(toAsset)).toFixed(4)} {ASSET_CONFIG[toAsset].label}
                </span>
              </div>
              <div className="flex items-center gap-3">
                {/* 资产选择器 */}
                <button
                  type="button"
                  onClick={() => setShowToSelector(!showToSelector)}
                  className="flex items-center gap-2 px-3 py-2 bg-bg-secondary rounded-lg hover:bg-bg-primary transition-colors shrink-0"
                >
                  <AssetIcon asset={toAsset} size={24} />
                  <span className={`font-medium ${ASSET_CONFIG[toAsset].color}`}>
                    {ASSET_CONFIG[toAsset].label}
                  </span>
                  <ChevronDown className={`w-4 h-4 text-text-tertiary transition-transform ${showToSelector ? 'rotate-180' : ''}`} />
                </button>
                {/* 金额显示 */}
                <div className="flex-1 text-right">
                  <div className="text-xl font-bold text-text-primary">
                    {quoteLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin ml-auto" />
                    ) : quote ? (
                      parseFloat(quote.to_amount).toFixed(4)
                    ) : (
                      '0'
                    )}
                  </div>
                </div>
              </div>
              {/* 资产选择下拉 */}
              {showToSelector && (
                <div className="mt-2 bg-bg-secondary border border-border-primary rounded-lg shadow-lg overflow-hidden">
                  {availableToAssets.map((asset) => (
                    <button
                      key={asset}
                      type="button"
                      onClick={() => {
                        setToAsset(asset);
                        setShowToSelector(false);
                      }}
                      className={`w-full flex items-center gap-3 p-3 hover:bg-bg-tertiary transition-colors ${
                        toAsset === asset ? 'bg-bg-tertiary' : ''
                      }`}
                    >
                      <AssetIcon asset={asset} size={28} />
                      <span className={ASSET_CONFIG[asset].color}>{ASSET_CONFIG[asset].label}</span>
                      <span className="ml-auto text-sm text-text-tertiary">
                        {parseFloat(getBalance(asset)).toFixed(2)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="py-4 text-center">
              <Wallet className="w-6 h-6 text-text-tertiary mx-auto mb-1" />
              <p className="text-sm text-text-tertiary">该资产不支持兑换</p>
            </div>
          )}
        </div>

        {/* USDT → 点卡套餐选择 */}
        {fromAsset === 'usdt' && toAsset === 'card' && (
          <div>
            <label className="block text-xs text-text-tertiary mb-2">优惠套餐</label>
            <div className="grid grid-cols-4 gap-2">
              {CARD_PACKAGES.map((pkg) => (
                <button
                  key={pkg.amount}
                  type="button"
                  onClick={() => handleSelectPackage(pkg)}
                  className={`p-2 rounded-lg text-center transition-colors ${
                    selectedPackage === pkg.amount
                      ? 'bg-brand-primary/20 ring-1 ring-brand-primary'
                      : 'bg-bg-secondary'
                  }`}
                >
                  <div className="text-sm font-medium text-text-primary">{pkg.amount}</div>
                  <div className={`text-xs ${pkg.bonus > 0 ? 'text-success' : 'text-text-tertiary'}`}>
                    {pkg.bonus > 0 ? `+${pkg.bonus}%` : '—'}
                  </div>
                </button>
              ))}
            </div>
            {bonusInfo && bonusInfo.bonusAmount > 0 && (
              <div className="mt-2 p-2 bg-success/10 rounded-lg">
                <div className="flex justify-between text-xs">
                  <span className="text-text-secondary">{bonusInfo.package.label}套餐 +{bonusInfo.package.bonus}%</span>
                  <span className="text-success font-medium">
                    +{bonusInfo.bonusAmount.toFixed(2)} 点卡
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 积分兑换模式选择 */}
        {fromAsset === 'points' && toAsset === 'token' && (
          <div className="p-3 bg-bg-secondary rounded-xl">
            <label className="block text-sm text-text-secondary mb-2">兑换模式</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMode('standard')}
                className={`p-3 rounded-lg text-left transition-colors ${
                  mode === 'standard'
                    ? 'bg-brand-primary/20 ring-1 ring-brand-primary'
                    : 'bg-bg-primary'
                }`}
              >
                <div className="font-medium text-sm text-text-primary">标准模式</div>
                <div className="text-xs text-text-tertiary mt-1">
                  20% 立即 + 80% 锁仓90天
                </div>
              </button>
              <button
                type="button"
                onClick={() => setMode('instant')}
                className={`p-3 rounded-lg text-left transition-colors ${
                  mode === 'instant'
                    ? 'bg-warning/20 ring-1 ring-warning'
                    : 'bg-bg-primary'
                }`}
              >
                <div className="font-medium text-sm text-warning">急速模式</div>
                <div className="text-xs text-text-tertiary mt-1">
                  50% 立即 + 50% 销毁
                </div>
              </button>
            </div>
          </div>
        )}

        {/* 兑换详情 */}
        {quote && (
          <div className="space-y-2 p-3 bg-bg-secondary rounded-xl">
            <div className="flex justify-between text-sm">
              <span className="text-text-tertiary">兑换比例</span>
              <span className="text-text-primary">
                1 {ASSET_CONFIG[fromAsset].label} = {parseFloat(quote.exchange_rate).toFixed(4)} {ASSET_CONFIG[toAsset].label}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-tertiary">手续费</span>
              <span className="text-text-primary">
                {parseFloat(quote.fee_amount).toFixed(4)} {ASSET_CONFIG[fromAsset].label} ({(parseFloat(quote.fee_rate) * 100).toFixed(1)}%)
              </span>
            </div>
            {/* USDT → 点卡套餐赠送显示 */}
            {bonusInfo && bonusInfo.bonusAmount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-text-tertiary">套餐赠送 (+{bonusInfo.package.bonus}%)</span>
                <span className="text-success">
                  +{bonusInfo.bonusAmount.toFixed(2)} {ASSET_CONFIG[toAsset].label}
                </span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-text-tertiary">预计到账</span>
              <span className="text-success font-medium">
                {bonusInfo
                  ? bonusInfo.totalAmount.toFixed(4)
                  : parseFloat(quote.to_amount).toFixed(4)
                } {ASSET_CONFIG[toAsset].label}
              </span>
            </div>

            {/* 积分兑换特殊显示 */}
            {quote.instant_amount && (
              <>
                <div className="border-t border-border-primary my-2" />
                <div className="flex justify-between text-sm">
                  <span className="text-text-tertiary">立即到账</span>
                  <span className="text-success">{parseFloat(quote.instant_amount).toFixed(4)} QFI</span>
                </div>
                {quote.vesting_amount && parseFloat(quote.vesting_amount) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-text-tertiary">锁仓释放 ({quote.vesting_days}天)</span>
                    <span className="text-text-primary">{parseFloat(quote.vesting_amount).toFixed(4)} QFI</span>
                  </div>
                )}
                {quote.burned_amount && parseFloat(quote.burned_amount) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-text-tertiary">销毁</span>
                    <span className="text-danger">{parseFloat(quote.burned_amount).toFixed(4)} QFI</span>
                  </div>
                )}
              </>
            )}

            {/* 报价倒计时 */}
            <div className="flex items-center gap-1 text-xs text-text-tertiary mt-2">
              <Clock className="w-3 h-3" />
              <span>报价有效期: {quoteExpiry}s</span>
            </div>
          </div>
        )}

        {/* 错误提示 */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-danger/10 rounded-lg text-danger text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* 成功提示 */}
        {success && (
          <div className="flex items-center gap-2 p-3 bg-success/10 rounded-lg text-success text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {success}
          </div>
        )}

        {/* 确认按钮 */}
        <Button
          className="w-full"
          size="lg"
          disabled={!quote || loading || quoteExpiry <= 0}
          onClick={handleConvert}
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              兑换中...
            </>
          ) : (
            '确认兑换'
          )}
        </Button>
      </div>

      {/* 提示信息 - 移动端 */}
      <div className="lg:hidden mx-4 p-4 bg-bg-secondary rounded-xl">
        <h3 className="text-sm font-medium text-text-primary mb-2">兑换说明</h3>
        <ul className="text-xs text-text-tertiary space-y-1">
          <li>• USDT → 点卡：1:1 兑换，0 手续费</li>
          <li className="pl-3 text-success">└ 套餐优惠：50体验/100+5%/200+8%/500+12%/1000+18%/2000+25%</li>
          <li>• USDT → QFI：市场价格，1% 手续费</li>
          <li>• 积分 → QFI：1000:1 兑换，支持标准/急速模式</li>
          <li>• QFI → USDT：市场价格，1% 手续费</li>
          <li>• 点卡和积分不支持反向兑换</li>
        </ul>
      </div>

      {/* 桌面端兑换卡片 */}
      <Card className="hidden lg:block p-4">
        {/* 来源资产 - 支付区块 */}
        <div className="p-3 bg-bg-tertiary rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-text-tertiary">支付</span>
            <span className="text-xs text-text-tertiary">
              可用: {parseFloat(getBalance(fromAsset)).toFixed(4)} {ASSET_CONFIG[fromAsset].label}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowFromSelector(!showFromSelector)}
              className="flex items-center gap-2 px-3 py-2 bg-bg-secondary rounded-lg hover:bg-bg-primary transition-colors shrink-0"
            >
              <AssetIcon asset={fromAsset} size={24} />
              <span className={`font-medium ${ASSET_CONFIG[fromAsset].color}`}>
                {ASSET_CONFIG[fromAsset].label}
              </span>
              <ChevronDown className={`w-4 h-4 text-text-tertiary transition-transform ${showFromSelector ? 'rotate-180' : ''}`} />
            </button>
            <div className="flex-1 text-right">
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="border-0 bg-transparent text-xl font-bold text-right p-0 h-auto"
              />
            </div>
            <button
              type="button"
              onClick={handleSetMax}
              className="px-2 py-1 text-xs text-brand-primary hover:text-brand-secondary bg-brand-primary/10 rounded"
            >
              最大
            </button>
          </div>
        </div>

        {/* 交换按钮 */}
        <div className="flex justify-center -my-3 relative z-10">
          <button
            type="button"
            onClick={handleSwap}
            disabled={!canSwap}
            className={`p-2 rounded-full border-4 border-bg-secondary transition-colors ${
              canSwap
                ? 'bg-brand-primary hover:bg-brand-secondary text-white'
                : 'bg-bg-tertiary text-text-tertiary cursor-not-allowed'
            }`}
          >
            <ArrowUpDown className="w-4 h-4" />
          </button>
        </div>

        {/* 目标资产 */}
        <div className="p-3 bg-bg-tertiary rounded-xl">
          {availableToAssets.length > 0 ? (
            <>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-text-tertiary">获得</span>
                <span className="text-xs text-text-tertiary">
                  持有: {parseFloat(getBalance(toAsset)).toFixed(4)} {ASSET_CONFIG[toAsset].label}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowToSelector(!showToSelector)}
                  className="flex items-center gap-2 px-3 py-2 bg-bg-secondary rounded-lg hover:bg-bg-primary transition-colors shrink-0"
                >
                  <AssetIcon asset={toAsset} size={24} />
                  <span className={`font-medium ${ASSET_CONFIG[toAsset].color}`}>
                    {ASSET_CONFIG[toAsset].label}
                  </span>
                  <ChevronDown className={`w-4 h-4 text-text-tertiary transition-transform ${showToSelector ? 'rotate-180' : ''}`} />
                </button>
                <div className="flex-1 text-right">
                  <div className="text-xl font-bold text-text-primary">
                    {quoteLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin ml-auto" />
                    ) : quote ? (
                      parseFloat(quote.to_amount).toFixed(4)
                    ) : (
                      '0'
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="py-4 text-center">
              <Wallet className="w-6 h-6 text-text-tertiary mx-auto mb-1" />
              <p className="text-sm text-text-tertiary">该资产不支持兑换</p>
            </div>
          )}
        </div>

        {/* 确认按钮 - 桌面端 */}
        <Button
          className="w-full mt-4"
          size="lg"
          disabled={!quote || loading || quoteExpiry <= 0}
          onClick={handleConvert}
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              兑换中...
            </>
          ) : (
            '确认兑换'
          )}
        </Button>
      </Card>

      {/* 提示信息 - 桌面端 */}
      <Card className="hidden lg:block p-4">
        <h3 className="text-sm font-medium text-text-primary mb-2">兑换说明</h3>
        <ul className="text-xs text-text-tertiary space-y-1">
          <li>• USDT → 点卡：1:1 兑换，0 手续费</li>
          <li className="pl-3 text-success">└ 套餐优惠：50体验/100+5%/200+8%/500+12%/1000+18%/2000+25%</li>
          <li>• USDT → QFI：市场价格，1% 手续费</li>
          <li>• 积分 → QFI：1000:1 兑换，支持标准/急速模式</li>
          <li>• QFI → USDT：市场价格，1% 手续费</li>
          <li>• 点卡和积分不支持反向兑换</li>
        </ul>
      </Card>

    </div>
  );
}
