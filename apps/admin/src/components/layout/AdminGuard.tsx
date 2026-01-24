'use client';

import { useEffect, ReactNode, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminAuthStore } from '@/stores/auth.store';

interface AdminGuardProps {
  children: ReactNode;
}

export function AdminGuard({ children }: AdminGuardProps) {
  const router = useRouter();
  const { user, isLoading, isAuthenticated, checkAuth, _hasHydrated } = useAdminAuthStore();
  const hasInitializedRef = useRef(false);
  const isCheckingRef = useRef(false);

  // 使用 useCallback 避免重复调用
  const performAuthCheck = useCallback(async () => {
    if (isCheckingRef.current) return;
    isCheckingRef.current = true;
    await checkAuth();
    isCheckingRef.current = false;
  }, [checkAuth]);

  useEffect(() => {
    // 等待 hydration 完成后，只在初始加载时调用 checkAuth
    if (_hasHydrated && !hasInitializedRef.current) {
      performAuthCheck();
    }
  }, [performAuthCheck, _hasHydrated]);

  useEffect(() => {
    // 等待 hydration 完成后进行认证检查
    // 避免在 hydration 前因 isAuthenticated 为 false 导致错误重定向
    if (!_hasHydrated) return;

    if (!isLoading && !isCheckingRef.current) {
      if (!hasInitializedRef.current) {
        // 初始检查完成
        hasInitializedRef.current = true;
        if (!isAuthenticated) {
          router.replace('/login');
        } else if (user && user.role !== 'admin' && user.role !== 'super_admin') {
          router.replace('/login');
        }
      }
    }
  }, [isLoading, isAuthenticated, user, router, _hasHydrated]);

  // 等待 hydration 完成
  if (!_hasHydrated) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0B0E11]">
        <div className="flex flex-col items-center space-y-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#2B3139] border-t-[#3772FF]"></div>
          <p className="text-sm text-[#848E9C]">加载中...</p>
        </div>
      </div>
    );
  }

  // 加载中显示 loading 状态
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0B0E11]">
        <div className="flex flex-col items-center space-y-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#2B3139] border-t-[#3772FF]"></div>
          <p className="text-sm text-[#848E9C]">加载中...</p>
        </div>
      </div>
    );
  }

  // 未登录或非管理员，不显示内容（等待重定向）
  if (!isAuthenticated || !user || (user.role !== 'admin' && user.role !== 'super_admin')) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0B0E11]">
        <div className="flex flex-col items-center space-y-4">
          <div className="text-[#F23645]">
            <svg className="h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div className="text-center">
            <h2 className="text-xl font-semibold text-white">权限不足</h2>
            <p className="mt-2 text-sm text-[#848E9C]">您没有访问管理后台的权限</p>
          </div>
        </div>
      </div>
    );
  }

  // 认证通过，显示子组件
  return <>{children}</>;
}
