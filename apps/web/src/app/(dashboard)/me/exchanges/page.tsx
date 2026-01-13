'use client';

import { useState } from 'react';
import { Copy, ExternalLink, Check, Loader2, ChevronDown, ChevronUp, Info } from 'lucide-react';
import { MobileHeader } from '@/components/ui';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { exchangeLinksApi } from '@/lib/api';
import { cn } from '@/lib/utils';

/**
 * 推荐交易所页面
 * 从后台 API 获取推广链接配置
 */

interface Exchange {
  id: string;
  exchange_id: string;
  name: string;
  logo: string;
  rebate: string;
  link: string;
  description: string | null;
  features: string[];
}

export default function ExchangesPage() {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showTips, setShowTips] = useState(false);

  // 从 API 获取交易所链接
  const { data, isLoading, error } = useQuery({
    queryKey: ['exchange-links'],
    queryFn: () => exchangeLinksApi.getActiveLinks(),
  });

  const exchanges = (data?.data as Exchange[]) || [];

  // 复制链接
  const handleCopy = async (exchange: Exchange) => {
    try {
      await navigator.clipboard.writeText(exchange.link);
      setCopiedId(exchange.exchange_id);
      toast.success(`已复制 ${exchange.name} 推广链接`);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      toast.error('复制失败，请手动复制');
    }
  };

  // 打开链接
  const handleOpen = (link: string) => {
    window.open(link, '_blank');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-bg-primary">
        <MobileHeader title="交易所" />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-bg-primary">
        <MobileHeader title="交易所" />
        <div className="px-4 py-20 text-center">
          <p className="text-danger mb-4">加载失败，请稍后重试</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary pb-24">
      <MobileHeader title="交易所" />

      {/* ========== 交易所列表 ========== */}
      {exchanges.length === 0 ? (
        <div className="px-4 py-20 text-center">
          <p className="text-text-secondary">暂无推荐交易所</p>
        </div>
      ) : (
        <div>
          <div className="space-y-px">
            {exchanges.map((exchange) => (
              <div key={exchange.id} className="bg-bg-secondary">
                {/* 交易所信息 */}
                <div className="px-4 py-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-bg-tertiary flex items-center justify-center text-2xl">
                        {exchange.logo}
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-white">{exchange.name}</h3>
                        <p className="text-xs text-text-tertiary">{exchange.description}</p>
                      </div>
                    </div>
                    <span className="text-success text-sm font-medium">
                      返佣 {exchange.rebate}
                    </span>
                  </div>

                  {/* 特性标签 */}
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {exchange.features.map((feature, index) => (
                      <span
                        key={index}
                        className="px-2 py-0.5 bg-bg-tertiary text-text-secondary text-xs rounded"
                      >
                        {feature}
                      </span>
                    ))}
                  </div>

                  {/* 推广链接 */}
                  <div className="mb-3">
                    <p className="text-[10px] text-text-tertiary mb-1.5">推广链接</p>
                    <div className="px-3 py-2.5 bg-bg-tertiary rounded-lg">
                      <p className="text-sm text-text-secondary font-mono truncate">
                        {exchange.link}
                      </p>
                    </div>
                  </div>

                  {/* 操作按钮 */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleCopy(exchange)}
                      className={cn(
                        'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg transition-colors',
                        copiedId === exchange.exchange_id
                          ? 'bg-success/20 text-success'
                          : 'bg-bg-tertiary text-white'
                      )}
                    >
                      {copiedId === exchange.exchange_id ? (
                        <>
                          <Check className="w-4 h-4" />
                          <span className="text-sm">已复制</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          <span className="text-sm">复制链接</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => handleOpen(exchange.link)}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-brand-primary text-white rounded-lg"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span className="text-sm">立即注册</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========== 温馨提示 - 可收起展开 ========== */}
      <div className="px-4 mt-6">
        <button
          onClick={() => setShowTips(!showTips)}
          className="flex items-center justify-between w-full py-3 text-left"
        >
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-brand-primary" />
            <span className="text-sm text-text-secondary">温馨提示</span>
          </div>
          {showTips ? (
            <ChevronUp className="w-4 h-4 text-text-tertiary" />
          ) : (
            <ChevronDown className="w-4 h-4 text-text-tertiary" />
          )}
        </button>

        {showTips && (
          <div className="pb-4 space-y-2 text-xs text-text-tertiary">
            <p>• 点击"复制链接"可将推广链接复制到剪贴板</p>
            <p>• 点击"立即注册"将在新窗口中打开注册页面</p>
            <p>• 使用推广链接注册，您可享受手续费返佣优惠</p>
            <p>• 如有问题，请联系客服获取帮助</p>
          </div>
        )}
      </div>
    </div>
  );
}
