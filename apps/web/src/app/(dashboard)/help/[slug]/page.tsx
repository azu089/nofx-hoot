'use client';

import { useRouter, useParams } from 'next/navigation';
import { HelpArticlePage } from '@/components/ui-v3/help/help-article-page';

// 有效的帮助文章 slug 列表
const validSlugs = [
  'getting-started',
  'api-keys',
  'strategies',
  'deposits-withdrawals',
  'security',
  'billing'
];

export default function HelpArticlePageRoute() {
  const router = useRouter();
  const params = useParams();
  const slug = params.slug as string;

  const handleBack = () => {
    router.push('/help');
  };

  const handleNavigate = (path: string) => {
    router.push(path);
  };

  // 检查是否是有效的 slug
  if (!validSlugs.includes(slug)) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] text-[#F8F8FC] flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">页面不存在</h1>
          <p className="text-[#9090A0] mb-6">抱歉，您访问的帮助文章不存在。</p>
          <button
            onClick={handleBack}
            className="px-6 py-2 bg-[#06B6D4] text-white rounded-lg hover:bg-[#06B6D4]/80 transition-colors"
          >
            返回帮助中心
          </button>
        </div>
      </div>
    );
  }

  return (
    <HelpArticlePage
      slug={slug}
      onBack={handleBack}
      onNavigate={handleNavigate}
    />
  );
}
