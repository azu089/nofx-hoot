'use client';

import Link from 'next/link';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui';

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center">
      <div className="text-center max-w-md mx-auto px-6">
        {/* 图标 */}
        <div className="w-24 h-24 bg-danger/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <ShieldAlert className="w-12 h-12 text-danger" />
        </div>

        {/* 标题 */}
        <h1 className="text-3xl font-bold text-white mb-4">权限不足</h1>

        {/* 描述 */}
        <p className="text-text-secondary mb-8">
          抱歉，您没有访问管理后台的权限。
          <br />
          如需管理员权限，请联系系统管理员。
        </p>

        {/* 操作按钮 */}
        <div className="flex flex-col gap-3">
          <Link href="/dashboard">
            <Button className="w-full" size="lg">
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回用户端
            </Button>
          </Link>
          <Link href="/" className="text-brand-primary hover:text-brand-primary/80 text-sm">
            返回首页
          </Link>
        </div>
      </div>
    </div>
  );
}
