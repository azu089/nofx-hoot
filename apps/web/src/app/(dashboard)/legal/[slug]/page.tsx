'use client';

import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LegalPage } from '@/components/ui-v3/legal/legal-page';
import { MobileLegalPage } from '@/components/ui-v3/mobile/mobile-legal-page';

// 有效的法律文档 slug 列表
const validSlugs = ['terms', 'privacy', 'risk'];

export default function LegalPageRoute() {
  const router = useRouter();
  const params = useParams();
  const slug = params.slug as string;
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleBack = () => {
    router.back();
  };

  // 检查是否是有效的 slug
  if (!validSlugs.includes(slug)) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] text-[#F8F8FC] flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">文档不存在</h1>
          <p className="text-[#9090A0] mb-6">抱歉，您访问的法律文档不存在。</p>
          <button
            type="button"
            onClick={() => router.push('/about')}
            className="px-6 py-2 bg-[#06B6D4] text-white rounded-lg hover:bg-[#06B6D4]/80 transition-colors"
          >
            返回关于页面
          </button>
        </div>
      </div>
    );
  }

  const PageComponent = isMobile ? MobileLegalPage : LegalPage;

  return (
    <PageComponent
      slug={slug as 'terms' | 'privacy' | 'risk'}
      onBack={handleBack}
    />
  );
}
