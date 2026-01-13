'use client';

import { useState, useEffect } from 'react';
import { Newspaper, ChevronDown, ChevronUp, ExternalLink, Clock } from 'lucide-react';

interface NewsItem {
  id: string;
  title: string;
  source: string;
  url: string;
  publishedAt: string;
  imageUrl?: string;
}

export function IndustryNews() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true); // 默认展开
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchNews();
  }, []);

  const fetchNews = async () => {
    try {
      setLoading(true);
      // 尝试从 CoinGecko 或其他免费 API 获取资讯
      // 这里先用 CryptoCompare News API（免费）
      const response = await fetch(
        'https://min-api.cryptocompare.com/data/v2/news/?lang=EN&categories=BTC,ETH,Trading,Technology&excludeCategories=Sponsored'
      );

      if (!response.ok) {
        throw new Error('Failed to fetch news');
      }

      const data = await response.json();

      if (data.Data && Array.isArray(data.Data)) {
        const formattedNews: NewsItem[] = data.Data.slice(0, 6).map((item: any) => ({
          id: item.id?.toString() || Math.random().toString(),
          title: item.title,
          source: item.source_info?.name || item.source || 'Unknown',
          url: item.url || item.guid,
          publishedAt: new Date(item.published_on * 1000).toISOString(),
          imageUrl: item.imageurl || item.source_info?.img,
        }));
        setNews(formattedNews);
        setError(null);
      }
    } catch (err) {
      console.error('Failed to fetch news:', err);
      setError('暂时无法获取资讯');
      // 使用备用数据
      setNews([
        {
          id: '1',
          title: 'Bitcoin Reaches New All-Time High Amid Institutional Buying',
          source: 'CoinDesk',
          url: '#',
          publishedAt: new Date().toISOString(),
        },
        {
          id: '2',
          title: 'Ethereum Layer 2 Solutions See Record Transaction Volume',
          source: 'The Block',
          url: '#',
          publishedAt: new Date(Date.now() - 3600000).toISOString(),
        },
        {
          id: '3',
          title: 'DeFi Total Value Locked Surpasses $200 Billion',
          source: 'DefiLlama',
          url: '#',
          publishedAt: new Date(Date.now() - 7200000).toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // 格式化时间为相对时间
  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return '刚刚';
    if (diffMins < 60) return `${diffMins}分钟前`;
    if (diffHours < 24) return `${diffHours}小时前`;
    return `${diffDays}天前`;
  };

  const handleNewsClick = (url: string) => {
    if (url && url !== '#') {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  if (loading) {
    return (
      <>
        {/* 移动端加载状态 */}
        <div className="lg:hidden rounded-xl bg-[#000000] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              <Newspaper className="w-4 h-4 text-brand-primary" />
              <span className="text-sm font-medium text-white">行业资讯</span>
            </div>
          </div>
          <div>
            {[1, 2, 3].map((i) => (
              <div key={i} className={`px-4 py-3 flex gap-3 animate-pulse ${i % 2 === 0 ? '' : 'bg-bg-primary'}`}>
                <div className="flex-shrink-0 w-16 h-16 rounded-lg bg-bg-tertiary" />
                <div className="flex-1">
                  <div className="h-4 bg-bg-tertiary rounded w-full mb-2" />
                  <div className="h-4 bg-bg-tertiary rounded w-3/4 mb-2" />
                  <div className="h-3 bg-bg-tertiary rounded w-1/3" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 桌面端加载状态 */}
        <div className="hidden lg:block rounded-2xl bg-bg-secondary border border-border-primary overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border-primary">
            <div className="flex items-center gap-2">
              <Newspaper className="w-4 h-4 text-brand-primary" />
              <span className="text-sm font-medium text-white">行业资讯</span>
            </div>
          </div>
          <div className="divide-y divide-border-primary/30">
            {[1, 2, 3].map((i) => (
              <div key={i} className="px-4 py-3 flex gap-3 animate-pulse">
                <div className="flex-shrink-0 w-16 h-16 rounded-lg bg-bg-tertiary" />
                <div className="flex-1">
                  <div className="h-4 bg-bg-tertiary rounded w-full mb-2" />
                  <div className="h-4 bg-bg-tertiary rounded w-3/4 mb-2" />
                  <div className="h-3 bg-bg-tertiary rounded w-1/3" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {/* 移动端极简布局 */}
      <div className="lg:hidden rounded-xl bg-[#000000] overflow-hidden">
        {/* 标题栏 - 可点击收起/展开 */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between px-4 py-3"
        >
          <div className="flex items-center gap-2">
            <Newspaper className="w-4 h-4 text-brand-primary" />
            <span className="text-sm font-medium text-white">行业资讯</span>
            {error && <span className="text-xs text-text-tertiary">(离线)</span>}
          </div>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-text-tertiary" />
          ) : (
            <ChevronDown className="w-4 h-4 text-text-tertiary" />
          )}
        </button>

        {/* 资讯列表 - 可折叠 */}
        {expanded && (
          <div>
            {news.map((item, index) => (
              <button
                key={item.id}
                onClick={() => handleNewsClick(item.url)}
                className={`w-full px-4 py-3 text-left transition-colors flex gap-3 ${
                  index % 2 === 0 ? 'bg-bg-primary' : ''
                }`}
              >
                {/* 缩略图 */}
                {item.imageUrl && (
                  <div className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-bg-tertiary">
                    <img
                      src={item.imageUrl}
                      alt=""
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                )}
                {/* 内容 */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white line-clamp-2 leading-relaxed mb-1.5">
                    {item.title}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-text-tertiary">
                    <span>{item.source}</span>
                    <span>·</span>
                    <Clock className="w-3 h-3" />
                    <span>{formatRelativeTime(item.publishedAt)}</span>
                    {item.url && item.url !== '#' && (
                      <ExternalLink className="w-3 h-3 ml-auto" />
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 桌面端卡片布局 */}
      <div className="hidden lg:block rounded-2xl bg-bg-secondary border border-border-primary overflow-hidden">
        {/* 标题栏 - 可点击收起/展开 */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between px-4 py-3 border-b border-border-primary hover:bg-bg-tertiary/30 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Newspaper className="w-4 h-4 text-brand-primary" />
            <span className="text-sm font-medium text-white">行业资讯</span>
            {error && <span className="text-xs text-text-tertiary">(离线)</span>}
          </div>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-text-tertiary" />
          ) : (
            <ChevronDown className="w-4 h-4 text-text-tertiary" />
          )}
        </button>

        {/* 资讯列表 - 可折叠 */}
        {expanded && (
          <div className="divide-y divide-border-primary/30">
            {news.map((item) => (
              <button
                key={item.id}
                onClick={() => handleNewsClick(item.url)}
                className="w-full px-4 py-3 text-left hover:bg-bg-tertiary/20 active:bg-bg-tertiary/40 transition-colors flex gap-3"
              >
                {/* 缩略图 */}
                {item.imageUrl && (
                  <div className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-bg-tertiary">
                    <img
                      src={item.imageUrl}
                      alt=""
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                )}
                {/* 内容 */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white line-clamp-2 leading-relaxed mb-1.5">
                    {item.title}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-text-tertiary">
                    <span>{item.source}</span>
                    <span>·</span>
                    <Clock className="w-3 h-3" />
                    <span>{formatRelativeTime(item.publishedAt)}</span>
                    {item.url && item.url !== '#' && (
                      <ExternalLink className="w-3 h-3 ml-auto" />
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
