'use client';

import { useRouter } from 'next/navigation';
import { HelpCenterPage } from '@/components/ui-v3/help/help-center-page';
import { MobileHelpPage } from '@/components/ui-v3/mobile/mobile-help-page';

export default function HelpPage() {
  const router = useRouter();

  const handleNavigate = (path: string) => {
    router.push(path);
  };

  const handleContactSupport = (method: 'email' | 'chat') => {
    if (method === 'email') {
      window.location.href = 'mailto:support@hoot.trade';
    } else {
      window.open('https://t.me/hoot', '_blank');
    }
  };

  return (
    <>
      {/* 桌面端 */}
      <div className="hidden md:block">
        <HelpCenterPage
          appVersion="v1.19.0"
          onNavigate={handleNavigate}
          onContactSupport={handleContactSupport}
        />
      </div>

      {/* 移动端 */}
      <div className="block md:hidden">
        <MobileHelpPage onBack={() => router.push('/profile')} onNavigate={handleNavigate} />
      </div>
    </>
  );
}
