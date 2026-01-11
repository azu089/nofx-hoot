'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Copy, ExternalLink, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { exchangeLinksApi } from '@/lib/api';

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
  const router = useRouter();
  const [copiedId, setCopiedId] = useState<string | null>(null);

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

      // 2秒后恢复按钮状态
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      toast.error('复制失败，请手动复制');
    }
  };

  // 打开链接
  const handleOpen = (link: string) => {
    window.open(link, '_blank');
  };

  return (
    <div className="min-h-screen bg-bg-primary p-4 lg:p-6 pb-24 lg:pb-6">
      {/* 顶部导航 */}
      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
          <span>返回</span>
        </button>
        <h1 className="text-2xl font-bold text-text-primary mt-4">推荐交易所</h1>
        <p className="text-text-secondary mt-2">
          使用 QuantFi 专属推广链接注册，享受手续费返佣优惠
        </p>
      </div>

      {/* 加载状态 */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
        </div>
      )}

      {/* 错误状态 */}
      {error && (
        <div className="max-w-2xl mx-auto text-center py-12">
          <p className="text-danger mb-4">加载失败，请稍后重试</p>
        </div>
      )}

      {/* 空状态 */}
      {!isLoading && !error && exchanges.length === 0 && (
        <div className="max-w-2xl mx-auto text-center py-12">
          <p className="text-text-secondary">暂无推荐交易所</p>
        </div>
      )}

      {/* 交易所列表 */}
      {!isLoading && !error && exchanges.length > 0 && (
        <div className="max-w-2xl mx-auto space-y-4">
          {exchanges.map((exchange) => (
          <div
            key={exchange.id}
            className="bg-bg-secondary rounded-xl border border-border-primary overflow-hidden"
          >
            {/* 头部：Logo + 名称 + 返佣标签 */}
            <div className="p-4 border-b border-border-primary">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-bg-tertiary flex items-center justify-center text-2xl">
                    {exchange.logo}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-text-primary">{exchange.name}</h3>
                    <p className="text-sm text-text-tertiary">{exchange.description}</p>
                  </div>
                </div>
                <div className="px-3 py-1 bg-success/20 text-success rounded-full text-sm font-medium flex-shrink-0">
                  返佣 {exchange.rebate}
                </div>
              </div>
            </div>

            {/* 特性标签 */}
            <div className="px-4 py-3 border-b border-border-primary">
              <div className="flex flex-wrap gap-2">
                {exchange.features.map((feature, index) => (
                  <span
                    key={index}
                    className="px-2 py-1 bg-bg-tertiary text-text-secondary text-xs rounded"
                  >
                    {feature}
                  </span>
                ))}
              </div>
            </div>

            {/* 推广链接 */}
            <div className="p-4 bg-bg-tertiary/30">
              <p className="text-xs text-text-tertiary mb-2">推广链接</p>
              <div className="flex items-center gap-2 p-3 bg-bg-secondary rounded-lg border border-border-primary mb-3">
                <p className="flex-1 text-sm text-text-primary font-mono truncate">
                  {exchange.link}
                </p>
              </div>

              {/* 操作按钮 */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => handleCopy(exchange)}
                >
                  {copiedId === exchange.exchange_id ? (
                    <>
                      <Check className="w-4 h-4 mr-2 text-success" />
                      已复制
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 mr-2" />
                      复制链接
                    </>
                  )}
                </Button>
                <Button
                  className="flex-1 bg-brand-primary hover:bg-brand-secondary"
                  onClick={() => handleOpen(exchange.link)}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  立即注册
                </Button>
              </div>
            </div>
          </div>
        ))}
          {/* 说明文字 */}
          <div className="mt-6 p-4 bg-bg-secondary rounded-xl border border-border-primary">
            <h4 className="text-sm font-medium text-text-primary mb-2">💡 温馨提示</h4>
            <ul className="text-sm text-text-secondary space-y-1">
              <li>• 点击"复制链接"可将推广链接复制到剪贴板</li>
              <li>• 点击"立即注册"将在新窗口中打开注册页面</li>
              <li>• 使用推广链接注册，您可享受手续费返佣优惠</li>
              <li>• 如有问题，请联系客服获取帮助</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
