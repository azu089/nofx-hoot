'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * 管理后台根页面
 * 访问 / 时重定向到 /login
 */
export default function AdminRootPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/login');
  }, [router]);

  return (
    <div className="min-h-screen bg-[#0B0E11] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-[#F23645] border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-400">正在跳转...</p>
      </div>
    </div>
  );
}
