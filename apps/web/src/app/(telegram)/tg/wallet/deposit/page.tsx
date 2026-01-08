'use client';

import { useEffect, useState } from 'react';
import { Copy, Check, QrCode, ChevronDown } from 'lucide-react';
import { useTelegramContext } from '@/components/providers/TelegramProvider';
import { api } from '@/lib/api';

interface DepositAddress {
  chain: string;
  address: string;
}

interface WalletData {
  depositAddresses: DepositAddress[];
}

const chainInfo: Record<string, { name: string; fee: string; time: string; color: string }> = {
  TRC20: { name: 'Tron (TRC20)', fee: '1 USDT', time: '1-5 分钟', color: 'bg-red-500' },
  ERC20: { name: 'Ethereum (ERC20)', fee: '10-30 USDT', time: '3-10 分钟', color: 'bg-blue-500' },
  BEP20: { name: 'BSC (BEP20)', fee: '0.5 USDT', time: '1-3 分钟', color: 'bg-yellow-500' },
};

export default function TelegramDeposit() {
  const { haptic } = useTelegramContext();
  const [data, setData] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedChain, setSelectedChain] = useState<string>('TRC20');
  const [copied, setCopied] = useState(false);
  const [showChainSelect, setShowChainSelect] = useState(false);

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

  const selectedAddress = data?.depositAddresses.find(
    (addr) => addr.chain === selectedChain
  );

  const copyAddress = async () => {
    if (!selectedAddress) return;

    haptic('notification_success');
    try {
      await navigator.clipboard.writeText(selectedAddress.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('复制失败:', error);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-12 bg-bg-secondary rounded-xl animate-pulse" />
        <div className="h-64 bg-bg-secondary rounded-xl animate-pulse" />
        <div className="h-32 bg-bg-secondary rounded-xl animate-pulse" />
      </div>
    );
  }

  const info = chainInfo[selectedChain] || chainInfo.TRC20;

  return (
    <div className="space-y-4">
      {/* 链选择 */}
      <div className="relative">
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
                    手续费: {chainData.fee} · {chainData.time}
                  </p>
                </div>
                {selectedChain === chain && (
                  <Check size={16} className="text-success" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 二维码 */}
      <div className="bg-bg-secondary border border-border-primary rounded-xl p-6 flex flex-col items-center">
        <div className="w-48 h-48 bg-white rounded-xl p-4 mb-4 flex items-center justify-center">
          <QrCode size={140} className="text-gray-800" />
        </div>
        <p className="text-xs text-text-tertiary text-center mb-2">
          扫描二维码或复制下方地址充值
        </p>
        <p className="text-xs text-warning text-center">
          仅支持 USDT ({selectedChain})
        </p>
      </div>

      {/* 充值地址 */}
      <div className="bg-bg-secondary border border-border-primary rounded-xl p-4">
        <p className="text-xs text-text-tertiary mb-2">充值地址</p>
        <div className="flex items-center gap-2">
          <p className="flex-1 text-sm text-text-primary break-all font-mono">
            {selectedAddress?.address || '获取中...'}
          </p>
          <button
            className={`p-2 rounded-lg transition-colors ${
              copied ? 'bg-success/10' : 'bg-bg-tertiary'
            }`}
            onClick={copyAddress}
          >
            {copied ? (
              <Check size={18} className="text-success" />
            ) : (
              <Copy size={18} className="text-text-tertiary" />
            )}
          </button>
        </div>
      </div>

      {/* 注意事项 */}
      <div className="bg-bg-secondary border border-border-primary rounded-xl p-4">
        <h3 className="text-sm font-medium text-text-primary mb-3">注意事项</h3>
        <ul className="space-y-2 text-xs text-text-secondary">
          <li className="flex items-start gap-2">
            <span className="text-warning">•</span>
            <span>请确保选择正确的网络，转错网络将导致资产丢失</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-warning">•</span>
            <span>最小充值金额：10 USDT</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-warning">•</span>
            <span>充值确认后，预计 {info.time} 到账</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-warning">•</span>
            <span>如有问题，请联系客服</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
