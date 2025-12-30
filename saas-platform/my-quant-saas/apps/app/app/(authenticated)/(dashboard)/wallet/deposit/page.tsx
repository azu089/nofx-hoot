'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@repo/design-system/components/ui/card';
import { Button } from '@repo/design-system/components/ui/button';
import { Input } from '@repo/design-system/components/ui/input';
import {
  ArrowDownToLine,
  Copy,
  CheckCircle,
  AlertTriangle,
  QrCode,
  Clock,
  Info,
} from 'lucide-react';
import { depositsApi, Deposit } from '@/lib/api';

// 充值链配置
const chains = [
  { id: 'trc20', name: 'TRC20', network: 'TRON', fee: '1 USDT', confirmations: 19, time: '~3分钟' },
  { id: 'erc20', name: 'ERC20', network: 'Ethereum', fee: '~$5-20', confirmations: 12, time: '~5分钟' },
  { id: 'bep20', name: 'BEP20', network: 'BSC', fee: '~$0.3', confirmations: 15, time: '~2分钟' },
  { id: 'polygon', name: 'Polygon', network: 'Polygon', fee: '~$0.01', confirmations: 128, time: '~5分钟' },
];

// 模拟充值地址
const mockAddresses: Record<string, string> = {
  trc20: 'TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSe',
  erc20: '0x742d35Cc6634C0532925a3b844Bc9e7595f6E42D',
  bep20: '0x742d35Cc6634C0532925a3b844Bc9e7595f6E42D',
  polygon: '0x742d35Cc6634C0532925a3b844Bc9e7595f6E42D',
};

export default function DepositPage() {
  const [selectedChain, setSelectedChain] = useState('trc20');
  const [copied, setCopied] = useState(false);
  const [depositHistory, setDepositHistory] = useState<Deposit[]>([]);
  const [loading, setLoading] = useState(true);

  const selectedChainInfo = chains.find((c) => c.id === selectedChain);
  const address = mockAddresses[selectedChain];

  useEffect(() => {
    fetchDepositHistory();
  }, []);

  const fetchDepositHistory = async () => {
    try {
      const res = await depositsApi.list({ limit: 10 });
      setDepositHistory(res.data.deposits);
    } catch (error) {
      console.error('Failed to fetch deposit history:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <span className="px-2 py-1 text-xs rounded bg-green-500/20 text-green-500 flex items-center gap-1">
            <CheckCircle className="w-3 h-3" />
            已完成
          </span>
        );
      case 'pending':
        return (
          <span className="px-2 py-1 text-xs rounded bg-yellow-500/20 text-yellow-500 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            确认中
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ArrowDownToLine className="w-7 h-7 text-green-500" />
          充值
        </h1>
        <p className="text-muted-foreground">充值 USDT 到您的账户</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 充值信息 */}
        <Card>
          <CardHeader>
            <CardTitle>选择充值网络</CardTitle>
            <CardDescription>请确保选择正确的网络，否则资产可能丢失</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 网络选择 */}
            <div className="grid grid-cols-2 gap-3">
              {chains.map((chain) => (
                <button
                  key={chain.id}
                  onClick={() => setSelectedChain(chain.id)}
                  className={`p-4 rounded-lg border text-left transition ${
                    selectedChain === chain.id
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <p className="font-medium">{chain.name}</p>
                  <p className="text-sm text-muted-foreground">{chain.network}</p>
                </button>
              ))}
            </div>

            {/* 网络详情 */}
            {selectedChainInfo && (
              <div className="p-4 bg-muted/50 rounded-lg space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">网络</span>
                  <span className="font-medium">{selectedChainInfo.network}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">手续费</span>
                  <span className="font-medium">{selectedChainInfo.fee}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">确认数</span>
                  <span className="font-medium">{selectedChainInfo.confirmations}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">预计时间</span>
                  <span className="font-medium">{selectedChainInfo.time}</span>
                </div>
              </div>
            )}

            {/* 充值地址 */}
            <div>
              <label className="block text-sm text-muted-foreground mb-2">
                充值地址
              </label>
              <div className="flex gap-2">
                <Input value={address} readOnly className="font-mono text-sm" />
                <Button variant="outline" onClick={handleCopy}>
                  {copied ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            {/* 二维码 */}
            <div className="flex justify-center p-6 bg-white rounded-lg">
              <div className="w-48 h-48 bg-gray-100 rounded-lg flex items-center justify-center">
                <QrCode className="w-32 h-32 text-gray-400" />
              </div>
            </div>

            <p className="text-center text-sm text-muted-foreground">
              扫描二维码或复制地址进行充值
            </p>
          </CardContent>
        </Card>

        {/* 充值记录 */}
        <Card>
          <CardHeader>
            <CardTitle>充值记录</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>加载中...</p>
              </div>
            ) : depositHistory.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <ArrowDownToLine className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>暂无充值记录</p>
              </div>
            ) : (
              <div className="space-y-3">
                {depositHistory.map((record) => (
                  <div
                    key={record.id}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-green-500">
                          +${record.amount}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {record.method.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(record.created_at).toLocaleString('zh-CN')}
                      </p>
                    </div>
                    {getStatusBadge(record.status)}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 注意事项 */}
      <Card className="bg-yellow-500/10 border-yellow-500/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-yellow-500">
            <AlertTriangle className="w-5 h-5" />
            注意事项
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>• 请确保选择正确的充值网络，发送到错误网络的资产无法找回</li>
            <li>• 仅支持 USDT 充值，请勿充值其他代币</li>
            <li>• 最低充值金额：10 USDT</li>
            <li>• 充值到账后会自动更新余额，如有问题请联系客服</li>
            <li>• TRC20 推荐使用，手续费最低</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
