'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { Metadata } from 'next';

// Metadata for this page (will be defined in layout or parent server component)
// export const metadata: Metadata = {
//   title: '充值 | QuantFi',
//   description: '通过 TRC20/ERC20/BEP20 充值 USDT 到您的 QuantFi 账户',
// };
import { Card, CardContent, CardHeader, CardTitle, Button } from '@/components/ui';
import { depositsApi } from '@/lib/api';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import {
  ArrowLeft,
  Copy,
  CheckCircle,
  Clock,
  XCircle,
  RefreshCw,
  QrCode,
} from 'lucide-react';

type Chain = 'TRC20' | 'ERC20' | 'BEP20';

interface DepositAddress {
  chain: Chain;
  address: string;
  minAmount: number;
}

interface Deposit {
  id: string;
  amount: string;
  method: string;
  status: string;
  created_at: string;
}

const DEPOSIT_ADDRESSES: Record<Chain, string> = {
  TRC20: 'TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSe',
  ERC20: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
  BEP20: 'bnb1abc2def3ghi4jkl5mno6pqr7stu8vwx9yz0',
};

const CHAIN_INFO: Record<Chain, { name: string; minDeposit: number; confirmations: number }> = {
  TRC20: { name: 'TRC20 (波场)', minDeposit: 10, confirmations: 1 },
  ERC20: { name: 'ERC20 (以太坊)', minDeposit: 20, confirmations: 12 },
  BEP20: { name: 'BEP20 (币安链)', minDeposit: 10, confirmations: 15 },
};

export default function DepositPage() {
  const router = useRouter();
  const [activeChain, setActiveChain] = useState<Chain>('TRC20');
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const fetchDeposits = async () => {
    try {
      const res = await depositsApi.list();
      setDeposits(res.data || []);
    } catch (error) {
      console.error('获取充值记录失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeposits();
  }, []);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-success" />;
      case 'pending':
      case 'processing':
        return <Clock className="w-4 h-4 text-warning" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-danger" />;
      default:
        return <Clock className="w-4 h-4 text-text-secondary" />;
    }
  };

  const getStatusText = (status: string) => {
    const map: Record<string, string> = {
      pending: '待确认',
      processing: '处理中',
      completed: '已完成',
      failed: '失败',
    };
    return map[status] || status;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-2xl font-bold text-white">充值</h1>
        </div>
        <div className="animate-pulse space-y-6">
          <div className="h-64 bg-bg-tertiary rounded-xl" />
          <div className="h-64 bg-bg-tertiary rounded-xl" />
        </div>
      </div>
    );
  }

  const currentAddress = DEPOSIT_ADDRESSES[activeChain];
  const currentChainInfo = CHAIN_INFO[activeChain];

  return (
    <div className="space-y-6">
      {/* 顶部导航 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-2xl font-bold text-white">充值</h1>
        </div>
        <Button variant="ghost" size="sm" onClick={fetchDeposits}>
          <RefreshCw className="w-4 h-4 mr-2" />
          刷新
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 充值信息卡片 */}
        <Card>
          <CardHeader>
            <CardTitle>选择充值网络</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* 链选择 Tabs */}
            <div className="flex gap-2 p-1 bg-bg-tertiary rounded-lg">
              {(Object.keys(CHAIN_INFO) as Chain[]).map((chain) => (
                <button
                  key={chain}
                  onClick={() => setActiveChain(chain)}
                  className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition ${
                    activeChain === chain
                      ? 'bg-brand-primary text-white'
                      : 'text-text-secondary hover:text-white hover:bg-border-secondary'
                  }`}
                >
                  {chain}
                </button>
              ))}
            </div>

            {/* 充值地址 */}
            <div className="space-y-2">
              <label className="block text-sm text-text-secondary">充值地址</label>
              <div className="flex items-center gap-2 p-3 bg-bg-tertiary rounded-lg border border-border-secondary">
                <code className="flex-1 text-sm text-white break-all font-mono">
                  {currentAddress}
                </code>
                <button
                  onClick={() => handleCopy(currentAddress)}
                  className="p-2 hover:bg-border-secondary rounded transition flex-shrink-0"
                  title="复制地址"
                >
                  {copied ? (
                    <CheckCircle className="w-4 h-4 text-success" />
                  ) : (
                    <Copy className="w-4 h-4 text-text-secondary" />
                  )}
                </button>
              </div>
              <p className="text-xs text-text-tertiary">
                请向此地址转账 USDT，确保选择正确的网络：{currentChainInfo.name}
              </p>
            </div>

            {/* 二维码占位符 */}
            <div className="flex flex-col items-center gap-3 p-6 bg-bg-tertiary rounded-lg">
              <div className="w-48 h-48 bg-white rounded-lg flex items-center justify-center">
                <QrCode className="w-24 h-24 text-text-secondary" />
              </div>
              <p className="text-sm text-text-secondary">扫描二维码充值</p>
            </div>

            {/* 重要提示 */}
            <div className="space-y-2 p-4 bg-warning/10 border border-warning/30 rounded-lg">
              <h4 className="text-sm font-medium text-warning">重要提示</h4>
              <ul className="text-xs text-text-secondary space-y-1 list-disc list-inside">
                <li>最低充值金额: {currentChainInfo.minDeposit} USDT</li>
                <li>需要 {currentChainInfo.confirmations} 个区块确认</li>
                <li>请勿充值其他币种，否则资产将无法找回</li>
                <li>充值完成后请耐心等待，通常 10-30 分钟到账</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* 充值记录 */}
        <Card>
          <CardHeader>
            <CardTitle>充值记录</CardTitle>
          </CardHeader>
          <CardContent>
            {deposits.length === 0 ? (
              <div className="text-center py-12 text-text-secondary">
                <div className="w-16 h-16 mx-auto mb-4 bg-bg-tertiary rounded-full flex items-center justify-center">
                  <Clock className="w-8 h-8 opacity-50" />
                </div>
                <p>暂无充值记录</p>
                <p className="text-sm mt-2">充值后记录会显示在这里</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {deposits.map((deposit) => (
                  <div
                    key={deposit.id}
                    className="flex items-center justify-between p-4 bg-bg-tertiary/50 rounded-lg hover:bg-bg-tertiary transition"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-white font-medium">
                          +{formatCurrency(deposit.amount)}
                        </span>
                        <span className="px-2 py-0.5 bg-border-secondary rounded text-xs text-text-secondary">
                          {deposit.method.replace('usdt_', '').toUpperCase()}
                        </span>
                      </div>
                      <p className="text-sm text-text-tertiary">
                        {formatDateTime(deposit.created_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(deposit.status)}
                      <span className="text-sm text-text-secondary">
                        {getStatusText(deposit.status)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 充值流程说明 */}
      <Card>
        <CardHeader>
          <CardTitle>充值流程</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-brand-primary rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold">
                1
              </div>
              <div>
                <h4 className="text-white font-medium mb-1">选择网络</h4>
                <p className="text-sm text-text-secondary">
                  选择对应的充值网络（TRC20/ERC20/BEP20）
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-brand-primary rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold">
                2
              </div>
              <div>
                <h4 className="text-white font-medium mb-1">转账 USDT</h4>
                <p className="text-sm text-text-secondary">
                  从您的钱包向充值地址转账 USDT
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-brand-primary rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold">
                3
              </div>
              <div>
                <h4 className="text-white font-medium mb-1">等待到账</h4>
                <p className="text-sm text-text-secondary">
                  区块确认后自动到账，通常 10-30 分钟
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
