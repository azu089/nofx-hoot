'use client';

import { useRouter } from 'next/navigation';
import { NotificationsPage } from '@/components/ui-v3/notifications/notifications-page';
import { MobileNotificationsPage } from '@/components/ui-v3/mobile/mobile-notifications-page';

export default function NotificationsPageRoute() {
  const router = useRouter();

  const handleNavigate = (path: string) => {
    router.push(path);
  };

  const handleMarkAsRead = (_id: string) => {
    // NEXT-SPRINT: 接入后端通知 API 标记已读
  };

  const handleMarkAllAsRead = () => {
    // NEXT-SPRINT: 接入后端通知 API 全部标记已读
  };

  return (
    <>
      {/* 桌面端 */}
      <div className="hidden md:block">
        <NotificationsPage
          onNavigate={handleNavigate}
          onMarkAsRead={handleMarkAsRead}
          onMarkAllAsRead={handleMarkAllAsRead}
        />
      </div>

      {/* 移动端 */}
      <div className="block md:hidden">
        <MobileNotificationsPage onBack={() => router.back()} />
      </div>
    </>
  );
}
