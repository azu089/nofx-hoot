'use client';

import { useState } from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Checkbox, MobileHeader } from '@/components/ui';
import { Search, X, AlertTriangle, Save } from 'lucide-react';
import { useToast } from '@/components/ui';

// 模拟币种数据
const ALL_COINS = [
  { symbol: 'BTC', name: 'Bitcoin', isRisky: false },
  { symbol: 'ETH', name: 'Ethereum', isRisky: false },
  { symbol: 'BNB', name: 'Binance Coin', isRisky: false },
  { symbol: 'SOL', name: 'Solana', isRisky: false },
  { symbol: 'XRP', name: 'Ripple', isRisky: false },
  { symbol: 'ADA', name: 'Cardano', isRisky: false },
  { symbol: 'DOGE', name: 'Dogecoin', isRisky: false },
  { symbol: 'MATIC', name: 'Polygon', isRisky: false },
  { symbol: 'DOT', name: 'Polkadot', isRisky: false },
  { symbol: 'LINK', name: 'Chainlink', isRisky: false },
  { symbol: 'AVAX', name: 'Avalanche', isRisky: false },
  { symbol: 'UNI', name: 'Uniswap', isRisky: false },
  { symbol: 'ATOM', name: 'Cosmos', isRisky: false },
  { symbol: 'NEAR', name: 'Near Protocol', isRisky: false },
  { symbol: 'ALGO', name: 'Algorand', isRisky: false },
  // 高风险币种
  { symbol: 'LUNA', name: 'Terra Luna Classic', isRisky: true },
  { symbol: 'UST', name: 'TerraUSD Classic', isRisky: true },
  { symbol: 'FTT', name: 'FTX Token', isRisky: true },
  { symbol: 'CELR', name: 'Celer Network', isRisky: true },
];

export default function BlacklistPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [blacklist, setBlacklist] = useState<string[]>(['LUNA', 'UST', 'FTT']); // 预设高风险币种
  const [isLoading, setIsLoading] = useState(false);
  const toast = useToast();

  // 过滤币种
  const filteredCoins = ALL_COINS.filter(
    (coin) =>
      coin.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
      coin.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 切换币种黑名单状态
  const toggleBlacklist = (symbol: string) => {
    setBlacklist((prev) =>
      prev.includes(symbol)
        ? prev.filter((s) => s !== symbol)
        : [...prev, symbol]
    );
  };

  // 清空黑名单
  const handleClearAll = () => {
    setBlacklist([]);
    toast.success('已清空黑名单');
  };

  // 保存设置
  const handleSave = async () => {
    setIsLoading(true);

    try {
      // TODO: 调用 API - PATCH /api/strategies/configs/:id
      // Body: { blacklist: blacklist }
      await new Promise((resolve) => setTimeout(resolve, 1000));

      toast.success('黑名单已保存');
    } catch (error) {
      toast.error('保存失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <MobileHeader
        title="币种黑名单"
        subtitle="选择您不希望策略交易的币种"
      />

      {/* 高风险提示 */}
      <div className="flex items-start gap-3 p-4 bg-warning/10 border border-warning/20 rounded-lg">
        <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="text-warning font-medium">高风险币种提醒</p>
          <p className="text-text-secondary mt-1">
            已为您预设标记高风险币种（如 LUNA、UST、FTT），建议保持在黑名单中
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左侧：可选币种 */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>可交易币种</CardTitle>
              <div className="text-sm text-text-secondary">
                已选 {blacklist.length} 个
              </div>
            </div>

            {/* 搜索框 */}
            <div className="relative mt-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
              <Input
                type="text"
                placeholder="搜索币种..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardHeader>

          <CardContent>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredCoins.map((coin) => (
                <div
                  key={coin.symbol}
                  className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                    blacklist.includes(coin.symbol)
                      ? 'bg-danger/10 border-danger/20'
                      : 'bg-bg-tertiary/50 border-border-secondary hover:border-border-primary'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* 币种图标占位 */}
                    <div className="w-8 h-8 rounded-full bg-border-secondary flex items-center justify-center text-sm font-bold">
                      {coin.symbol.charAt(0)}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white">{coin.symbol}</span>
                        {coin.isRisky && (
                          <span className="px-2 py-0.5 bg-warning/20 text-warning text-xs rounded-full">
                            高风险
                          </span>
                        )}
                      </div>
                      <span className="text-sm text-text-secondary">{coin.name}</span>
                    </div>
                  </div>

                  <Checkbox
                    checked={blacklist.includes(coin.symbol)}
                    onChange={() => toggleBlacklist(coin.symbol)}
                  />
                </div>
              ))}

              {filteredCoins.length === 0 && (
                <div className="text-center py-8 text-text-secondary">
                  未找到匹配的币种
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 右侧：黑名单预览 */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>黑名单</CardTitle>
              {blacklist.length > 0 && (
                <button
                  onClick={handleClearAll}
                  className="text-sm text-danger hover:text-danger/80"
                >
                  清空
                </button>
              )}
            </div>
          </CardHeader>

          <CardContent>
            {blacklist.length === 0 ? (
              <div className="text-center py-8 text-text-secondary text-sm">
                暂无币种在黑名单中
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {blacklist.map((symbol) => {
                  const coin = ALL_COINS.find((c) => c.symbol === symbol);
                  if (!coin) return null;

                  return (
                    <div
                      key={symbol}
                      className="flex items-center justify-between p-2 bg-bg-tertiary/50 rounded-lg group"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-border-secondary flex items-center justify-center text-xs font-bold">
                          {symbol.charAt(0)}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-white">{symbol}</div>
                          {coin.isRisky && (
                            <div className="text-xs text-warning">高风险</div>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => toggleBlacklist(symbol)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-4 h-4 text-text-secondary hover:text-danger" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 保存按钮 */}
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          size="lg"
          isLoading={isLoading}
          className="min-w-32"
        >
          <Save className="w-4 h-4 mr-2" />
          保存设置
        </Button>
      </div>
    </div>
  );
}
