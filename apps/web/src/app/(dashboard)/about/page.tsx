'use client';

import { useRouter } from 'next/navigation';
import { AboutPage } from '@/components/ui-v3/about/about-page';
import { MobileAboutPage } from '@/components/ui-v3/mobile/mobile-about-page';

export default function AboutPageRoute() {
  const router = useRouter();

  const handleNavigate = (path: string) => {
    router.push(path);
  };

  return (
    <>
      {/* 桌面端 */}
      <div className="hidden md:block">
        <AboutPage
          appVersion="v1.19.0"
          buildNumber="2026.01.30"
          onNavigate={handleNavigate}
        />
      </div>

      {/* 移动端 */}
      <div className="block md:hidden">
        <MobileAboutPage onBack={() => router.back()} onNavigate={handleNavigate} />
      </div>
    </>
  );
}
