'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTelegramContext } from '@/components/providers/TelegramProvider';
import { ArrowLeft, Users, Crown, RefreshCw } from 'lucide-react';
import { userApi } from '@/lib/api';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { PullToRefreshIndicator } from '@/components/ui/pull-to-refresh';

interface TeamMember {
  id: string;
  email: string;
  status: string;
  vipLevel: number;
  createdAt: string;
  commission: string;
  level: number;
}

export default function TgInviteMembersPage() {
  const router = useRouter();
  const { haptic } = useTelegramContext();
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'level1' | 'level2'>('all');

  const fetchData = async () => {
    try {
      const res = await userApi.getTeamMembers();
      if (res.code === 0 && res.data) {
        const allMembers = [
          ...(res.data.level1 || []).map((m: TeamMember) => ({ ...m, level: 1 })),
          ...(res.data.level2 || []).map((m: TeamMember) => ({ ...m, level: 2 })),
        ];
        setMembers(allMembers);
      }
    } catch (error) {
      console.error('获取邀请记录失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const { isRefreshing, pullDistance } = usePullToRefresh({
    onRefresh: async () => {
      haptic('impact_light');
      await fetchData();
      haptic('notification_success');
    },
  });

  useEffect(() => {
    fetchData();
  }, []);

  // 脱敏邮箱
  const maskEmail = (email: string) => {
    if (!email) return '***';
    return email.replace(/(.{2}).*(@.*)/, '$1***$2');
  };

  // 过滤成员
  const filteredMembers = members.filter((m) => {
    if (activeTab === 'level1') return m.level === 1;
    if (activeTab === 'level2') return m.level === 2;
    return true;
  });

  // 格式化时间
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  return (
    <>
      <PullToRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} />
      <div className="space-y-4 pb-24">
        {/* 顶部导航 */}
        <button
          onClick={() => { haptic('selection'); router.back(); }}
          className="flex items-center gap-2 text-text-secondary"
        >
          <ArrowLeft size={20} />
          <span className="text-lg font-medium text-white">邀请记录</span>
        </button>

        {/* 统计 */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-bg-secondary border border-border-primary rounded-xl p-4">
            <p className="text-xs text-text-tertiary mb-1">一级邀请</p>
            <p className="text-xl font-bold text-white">
              {members.filter((m) => m.level === 1).length}
            </p>
          </div>
          <div className="bg-bg-secondary border border-border-primary rounded-xl p-4">
            <p className="text-xs text-text-tertiary mb-1">二级邀请</p>
            <p className="text-xl font-bold text-white">
              {members.filter((m) => m.level === 2).length}
            </p>
          </div>
        </div>

        {/* Tab 切换 */}
        <div className="flex bg-bg-secondary rounded-xl p-1">
          {[
            { key: 'all', label: '全部' },
            { key: 'level1', label: '一级' },
            { key: 'level2', label: '二级' },
          ].map((item) => (
            <button
              key={item.key}
              onClick={() => { setActiveTab(item.key as any); haptic('selection'); }}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === item.key
                  ? 'bg-brand-primary text-white'
                  : 'text-text-secondary'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* 成员列表 */}
        {loading ? (
          <div className="flex justify-center py-12">
            <RefreshCw className="w-6 h-6 animate-spin text-text-tertiary" />
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="text-center py-12 text-text-tertiary">
            暂无邀请记录
          </div>
        ) : (
          <div className="space-y-2">
            {filteredMembers.map((member) => (
              <div
                key={member.id}
                className="bg-bg-secondary border border-border-primary rounded-xl p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-bg-tertiary flex items-center justify-center">
                      <Users className="w-5 h-5 text-text-tertiary" />
                    </div>
                    <div>
                      <p className="text-white font-medium text-sm">
                        {maskEmail(member.email)}
                      </p>
                      <p className="text-xs text-text-tertiary">
                        {formatDate(member.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1 mb-1">
                      {member.vipLevel > 0 && (
                        <span className="px-1.5 py-0.5 rounded text-xs bg-warning/20 text-warning flex items-center gap-0.5">
                          <Crown className="w-3 h-3" />
                          VIP{member.vipLevel}
                        </span>
                      )}
                      <span className={`px-1.5 py-0.5 rounded text-xs ${
                        member.level === 1
                          ? 'bg-brand-primary/20 text-brand-primary'
                          : 'bg-purple-500/20 text-purple-400'
                      }`}>
                        {member.level === 1 ? '一级' : '二级'}
                      </span>
                    </div>
                    <p className="text-xs text-success">
                      +${parseFloat(member.commission || '0').toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
