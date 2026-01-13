'use client';

import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { userApi } from '@/lib/api';
import { ChevronLeft, Loader2 } from 'lucide-react';
import { MobileHeader } from '@/components/ui';

interface UserProfile {
  id: string;
  email: string;
  vip_level: number;
  created_at: string;
}

/**
 * 账户信息页面 - 极简流畅风格
 * 显示邮箱、会员等级、注册时间、用户ID
 */
export default function AccountInfoPage() {
  const router = useRouter();

  const { data: profileData, isLoading } = useQuery({
    queryKey: ['user', 'profile'],
    queryFn: () => userApi.getProfile(),
  });

  const profile = profileData?.data as UserProfile | undefined;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getVipLevelName = (level: number) => {
    const names: Record<number, string> = {
      0: '普通用户',
      1: 'VIP 1',
      2: 'VIP 2',
      3: 'VIP 3',
    };
    return names[level] || `VIP ${level}`;
  };

  // 账户信息列表
  const accountItems = profile
    ? [
        { label: '邮箱', value: profile.email, action: '修改' },
        { label: '会员等级', value: getVipLevelName(profile.vip_level), action: '升级' },
        { label: '注册时间', value: formatDate(profile.created_at) },
        { label: '用户 ID', value: profile.id, isMono: true, action: '复制' },
      ]
    : [];

  return (
    <div className="min-h-screen bg-bg-primary lg:p-6 pb-24 lg:pb-6">
      {/* 移动端标题 */}
      <MobileHeader title="账户信息" />

      {/* 顶部导航 - 仅桌面端显示 */}
      <div className="mb-6 hidden lg:block">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
          <span>设置</span>
        </button>
        <h1 className="text-2xl font-bold text-text-primary mt-4">账户信息</h1>
      </div>

      {/* 移动端极简列表 */}
      <div className="lg:hidden">
        {isLoading ? (
          <div className="p-12 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
          </div>
        ) : profile ? (
          <div>
            {accountItems.map((item, index) => (
              <div
                key={item.label}
                className={`px-4 py-4 flex items-center justify-between ${
                  index % 2 === 1 ? 'bg-bg-secondary' : ''
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-text-tertiary mb-1">{item.label}</p>
                  <p
                    className={`text-sm text-text-primary font-medium ${
                      item.isMono ? 'font-mono truncate' : ''
                    }`}
                  >
                    {item.value}
                  </p>
                </div>
                {item.action && (
                  <button className="text-brand-primary text-sm ml-4 flex-shrink-0">
                    {item.action}
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="p-12 text-center">
            <p className="text-text-secondary">加载失败</p>
          </div>
        )}
      </div>

      {/* 桌面端卡片 */}
      <div className="hidden lg:block max-w-2xl mx-auto">
        <div className="bg-bg-secondary rounded-xl border border-border-primary overflow-hidden">
          {isLoading ? (
            <div className="p-12 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
            </div>
          ) : profile ? (
            <div className="divide-y divide-border-primary">
              {/* 邮箱 */}
              <div className="p-4 flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm text-text-tertiary mb-1">邮箱</p>
                  <p className="text-text-primary font-medium">{profile.email}</p>
                </div>
                <button className="text-brand-primary text-sm hover:underline">
                  修改
                </button>
              </div>

              {/* VIP 等级 */}
              <div className="p-4 flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm text-text-tertiary mb-1">会员等级</p>
                  <p className="text-text-primary font-medium">
                    {getVipLevelName(profile.vip_level)}
                  </p>
                </div>
                <button className="text-brand-primary text-sm hover:underline">
                  升级
                </button>
              </div>

              {/* 注册时间 */}
              <div className="p-4">
                <p className="text-sm text-text-tertiary mb-1">注册时间</p>
                <p className="text-text-primary font-medium">
                  {formatDate(profile.created_at)}
                </p>
              </div>

              {/* 用户 ID */}
              <div className="p-4 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text-tertiary mb-1">用户 ID</p>
                  <p className="text-text-secondary font-mono text-sm truncate">
                    {profile.id}
                  </p>
                </div>
                <button className="text-text-tertiary text-sm hover:text-text-secondary ml-4">
                  复制
                </button>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center">
              <p className="text-text-secondary">加载失败</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
