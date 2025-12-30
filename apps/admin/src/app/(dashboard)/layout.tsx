'use client';

import { AdminGuard } from '@/components/layout/AdminGuard';
import { Sidebar } from '@/components/layout/Sidebar';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminGuard>
      <div className="min-h-screen bg-[#0B0E11] flex">
        {/* 左侧固定侧边栏 */}
        <Sidebar />

        {/* 右侧主内容区域 */}
        <main className="flex-1 ml-64">
          <div className="p-6">{children}</div>
        </main>
      </div>
    </AdminGuard>
  );
}
