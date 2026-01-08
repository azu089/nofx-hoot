'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  History,
  Coins,
  Zap,
  CreditCard,
  Lock,
  ChevronRight,
} from 'lucide-react';
import { useTelegramContext } from '@/components/providers/TelegramProvider';
import { api } from '@/lib/api';

interface WalletData {
  usdtBalance: string;
  usdtFrozen: string;
  cardBalance: string;
  pointsBalance: string;
  tokenBalance: string;
  tokenLocked: string;
  depositAddresses: Array<{
    chain: string;
    address: string;
  }>;
}

export default function TelegramWallet() {
  const { haptic } = useTelegramContext();
  const [data, setData] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchWallet() {
      try {
        const response = await api.get('/telegram/wallet');
        setData(response.data);
      } catch (error) {
        console.error('获取钱包数据失败:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchWallet();
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-40 bg-bg-secondary rounded-xl animate-pulse" />
        <div className="h-24 bg-bg-secondary rounded-xl animate-pulse" />
        <div className="h-32 bg-bg-secondary rounded-xl animate-pulse" />
      </div>
    );
  }

  const usdtBalance = parseFloat(data?.usdtBalance || '0');
  const usdtFrozen = parseFloat(data?.usdtFrozen || '0');
  const availableBalance = usdtBalance - usdtFrozen;

  return (
    <div className="space-y-4">
      {/* 总资产卡片 */}
      <div className="bg-gradient-to-br from-brand-primary to-brand-secondary rounded-xl p-5 text-white">
        <div className="flex items-center gap-2 mb-3">
          <Wallet size={20} />
          <span className="text-sm opacity-90">总资产 (USDT)</span>
        </div>
        <p className="text-3xl font-bold mb-4">
          ${usdtBalance.toFixed(2)}
        </p>
        <div className="flex gap-6">
          <div>
            <p className="text-xs opacity-70 mb-0.5">可用</p>
            <p className="text-sm font-medium">${availableBalance.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs opacity-70 mb-0.5">冻结</p>
            <p className="text-sm font-medium">${usdtFrozen.toFixed(2)}</p>
          </div>
        </div>
      </div>

      {/* 快捷操作 */}
      <div className="grid grid-cols-3 gap-3">
        <Link
          href="/tg/wallet/deposit"
          className="flex flex-col items-center gap-2 p-4 bg-bg-secondary border border-border-primary rounded-xl"
          onClick={() => haptic('selection')}
        >
          <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center">
            <ArrowDownLeft size={20} className="text-success" />
          </div>
          <span className="text-sm text-text-secondary">充值</span>
        </Link>

        <Link
          href="/tg/wallet/withdraw"
          className="flex flex-col items-center gap-2 p-4 bg-bg-secondary border border-border-primary rounded-xl"
          onClick={() => haptic('selection')}
        >
          <div className="w-10 h-10 rounded-full bg-warning/10 flex items-center justify-center">
            <ArrowUpRight size={20} className="text-warning" />
          </div>
          <span className="text-sm text-text-secondary">提现</span>
        </Link>

        <Link
          href="/tg/wallet/history"
          className="flex flex-col items-center gap-2 p-4 bg-bg-secondary border border-border-primary rounded-xl"
          onClick={() => haptic('selection')}
        >
          <div className="w-10 h-10 rounded-full bg-brand-primary/10 flex items-center justify-center">
            <History size={20} className="text-brand-primary" />
          </div>
          <span className="text-sm text-text-secondary">记录</span>
        </Link>
      </div>

      {/* 资产明细 */}
      <div className="bg-bg-secondary border border-border-primary rounded-xl divide-y divide-border-primary">
        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-warning/10 flex items-center justify-center">
              <Coins size={20} className="text-warning" />
            </div>
            <div>
              <p className="text-sm text-text-primary">积分</p>
              <p className="text-xs text-text-tertiary">Points</p>
            </div>
          </div>
          <p className="text-lg font-medium text-text-primary">
            {parseFloat(data?.pointsBalance || '0').toFixed(0)}
          </p>
        </div>

        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-brand-primary/10 flex items-center justify-center">
              <Zap size={20} className="text-brand-primary" />
            </div>
            <div>
              <p className="text-sm text-text-primary">QFI</p>
              <p className="text-xs text-text-tertiary">可用</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-lg font-medium text-text-primary">
              {parseFloat(data?.tokenBalance || '0').toFixed(2)}
            </p>
            {parseFloat(data?.tokenLocked || '0') > 0 && (
              <div className="flex items-center gap-1 text-xs text-text-tertiary">
                <Lock size={10} />
                <span>{parseFloat(data?.tokenLocked || '0').toFixed(2)} 锁定</span>
              </div>
            )}
          </div>
        </div>

        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center">
              <CreditCard size={20} className="text-purple-500" />
            </div>
            <div>
              <p className="text-sm text-text-primary">卡余额</p>
              <p className="text-xs text-text-tertiary">Card</p>
            </div>
          </div>
          <p className="text-lg font-medium text-text-primary">
            ${parseFloat(data?.cardBalance || '0').toFixed(2)}
          </p>
        </div>
      </div>

      {/* 充值地址 */}
      <div className="bg-bg-secondary border border-border-primary rounded-xl p-4">
        <h3 className="text-sm font-medium text-text-primary mb-3">充值地址</h3>
        <div className="space-y-2">
          {data?.depositAddresses.map((addr, index) => (
            <div
              key={index}
              className="flex items-center justify-between py-2"
            >
              <span className="text-sm text-text-secondary">{addr.chain}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-tertiary truncate max-w-[120px]">
                  {addr.address}
                </span>
                <ChevronRight size={14} className="text-text-tertiary" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
