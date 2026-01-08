'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, AlertCircle, ArrowUpRight } from 'lucide-react';
import { useTelegramContext } from '@/components/providers/TelegramProvider';
import { api } from '@/lib/api';

interface WalletData {
  usdtBalance: string;
  usdtFrozen: string;
}

const chainInfo: Record<string, { name: string; fee: string; min: number; color: string }> = {
  TRC20: { name: 'Tron (TRC20)', fee: '1', min: 20, color: 'bg-red-500' },
  ERC20: { name: 'Ethereum (ERC20)', fee: '15', min: 50, color: 'bg-blue-500' },
  BEP20: { name: 'BSC (BEP20)', fee: '0.5', min: 10, color: 'bg-yellow-500' },
};

export default function TelegramWithdraw() {
  const { haptic } = useTelegramContext();
  const [data, setData] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedChain, setSelectedChain] = useState<string>('TRC20');
  const [showChainSelect, setShowChainSelect] = useState(false);
  const [address, setAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchWallet() {
      try {
        const response = await api.get('/telegram/wallet');
        setData(response.data);
      } catch (err) {
        console.error('获取钱包数据失败:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchWallet();
  }, []);

  const availableBalance =
    parseFloat(data?.usdtBalance || '0') - parseFloat(data?.usdtFrozen || '0');
  const info = chainInfo[selectedChain] || chainInfo.TRC20;
  const fee = parseFloat(info.fee);
  const amountNum = parseFloat(amount) || 0;
  const receiveAmount = Math.max(0, amountNum - fee);

  const handleSubmit = async () => {
    if (!address.trim()) {
      setError('请输入提现地址');
      haptic('notification_error');
      return;
    }

    if (amountNum < info.min) {
      setError(`最小提现金额为 ${info.min} USDT`);
      haptic('notification_error');
      return;
    }

    if (amountNum > availableBalance) {
      setError('余额不足');
      haptic('notification_error');
      return;
    }

    setError('');
    setSubmitting(true);
    haptic('impact_medium');

    try {
      await api.post('/wallet/withdraw', {
        chain: selectedChain,
        address: address.trim(),
        amount: amount,
      });
      haptic('notification_success');
      // 跳转到钱包页面
      window.location.href = '/tg/wallet';
    } catch (err: any) {
      setError(err.response?.data?.message || '提现失败，请重试');
      haptic('notification_error');
    } finally {
      setSubmitting(false);
    }
  };

  const setMaxAmount = () => {
    haptic('selection');
    setAmount(availableBalance.toFixed(2));
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-12 bg-bg-secondary rounded-xl animate-pulse" />
        <div className="h-24 bg-bg-secondary rounded-xl animate-pulse" />
        <div className="h-24 bg-bg-secondary rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 可用余额 */}
      <div className="bg-bg-secondary border border-border-primary rounded-xl p-4">
        <p className="text-xs text-text-tertiary mb-1">可用余额</p>
        <p className="text-2xl font-bold text-text-primary">
          ${availableBalance.toFixed(2)}
          <span className="text-sm text-text-tertiary ml-1">USDT</span>
        </p>
      </div>

      {/* 链选择 */}
      <div className="relative">
        <p className="text-xs text-text-tertiary mb-2">选择网络</p>
        <button
          className="w-full flex items-center justify-between p-4 bg-bg-secondary border border-border-primary rounded-xl"
          onClick={() => {
            haptic('selection');
            setShowChainSelect(!showChainSelect);
          }}
        >
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${info.color}`} />
            <span className="text-text-primary">{info.name}</span>
          </div>
          <ChevronDown
            size={20}
            className={`text-text-tertiary transition-transform ${
              showChainSelect ? 'rotate-180' : ''
            }`}
          />
        </button>

        {showChainSelect && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-bg-secondary border border-border-primary rounded-xl overflow-hidden z-10">
            {Object.entries(chainInfo).map(([chain, chainData]) => (
              <button
                key={chain}
                className={`w-full flex items-center gap-3 p-4 text-left hover:bg-bg-tertiary transition-colors ${
                  selectedChain === chain ? 'bg-bg-tertiary' : ''
                }`}
                onClick={() => {
                  haptic('selection');
                  setSelectedChain(chain);
                  setShowChainSelect(false);
                }}
              >
                <div className={`w-3 h-3 rounded-full ${chainData.color}`} />
                <div className="flex-1">
                  <p className="text-sm text-text-primary">{chainData.name}</p>
                  <p className="text-xs text-text-tertiary">
                    手续费: {chainData.fee} USDT · 最小 {chainData.min} USDT
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 提现地址 */}
      <div>
        <p className="text-xs text-text-tertiary mb-2">提现地址</p>
        <input
          type="text"
          placeholder={`请输入 ${selectedChain} 地址`}
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="w-full p-4 bg-bg-secondary border border-border-primary rounded-xl text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-brand-primary font-mono"
        />
      </div>

      {/* 提现金额 */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-text-tertiary">提现金额</p>
          <button
            className="text-xs text-brand-primary"
            onClick={setMaxAmount}
          >
            全部
          </button>
        </div>
        <div className="relative">
          <input
            type="number"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full p-4 pr-16 bg-bg-secondary border border-border-primary rounded-xl text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-brand-primary"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-text-tertiary">
            USDT
          </span>
        </div>
      </div>

      {/* 费用明细 */}
      <div className="bg-bg-secondary border border-border-primary rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-text-tertiary">网络手续费</span>
          <span className="text-text-secondary">{info.fee} USDT</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-text-tertiary">预计到账</span>
          <span className="text-text-primary font-medium">
            {receiveAmount.toFixed(2)} USDT
          </span>
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-danger/10 border border-danger/20 rounded-xl">
          <AlertCircle size={16} className="text-danger flex-shrink-0" />
          <p className="text-sm text-danger">{error}</p>
        </div>
      )}

      {/* 提交按钮 */}
      <button
        className="w-full flex items-center justify-center gap-2 p-4 bg-brand-primary text-white rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        onClick={handleSubmit}
        disabled={submitting || !address || !amount}
      >
        {submitting ? (
          <span>提交中...</span>
        ) : (
          <>
            <ArrowUpRight size={18} />
            <span>确认提现</span>
          </>
        )}
      </button>

      {/* 注意事项 */}
      <div className="text-xs text-text-tertiary space-y-1">
        <p>• 提现需要审核，预计 1-24 小时内到账</p>
        <p>• 请仔细核对提现地址，转错无法找回</p>
        <p>• 每日提现限额：10,000 USDT</p>
      </div>
    </div>
  );
}
