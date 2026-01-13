'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui';
import { userApi } from '@/lib/api';
import {
  Users,
  Copy,
  Check,
  QrCode,
  Download,
  Loader2,
  Crown,
  Link2,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface InviteInfo {
  inviteCode: string;
  inviteLink: string;
}

interface InviteStats {
  totalInvites: number;
  activeUsers: number;
  totalCommission: string;
  pendingCommission: string;
}

interface TeamMember {
  id: string;
  email: string;
  status: string;
  vipLevel: number;
  createdAt: string;
  commission: string;
  level: number;
}

interface TeamData {
  level1: TeamMember[];
  level2: TeamMember[];
  total: number;
  level1Count: number;
  level2Count: number;
}

export default function ReferralPage() {
  const [loading, setLoading] = useState(true);
  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null);
  const [stats, setStats] = useState<InviteStats | null>(null);
  const [teamData, setTeamData] = useState<TeamData | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'level1' | 'level2'>('all');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [infoRes, statsRes, teamRes] = await Promise.all([
        userApi.getInviteInfo(),
        userApi.getInviteStats(),
        userApi.getTeamMembers(),
      ]);

      if (infoRes.code === 0) setInviteInfo(infoRes.data);
      if (statsRes.code === 0) setStats(statsRes.data);
      if (teamRes.code === 0) setTeamData(teamRes.data);
    } catch (error) {
      console.error('Failed to fetch referral data:', error);
      toast.error('获取邀请信息失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = async () => {
    if (!inviteInfo?.inviteCode) return;
    try {
      await navigator.clipboard.writeText(inviteInfo.inviteCode);
      setCopiedCode(true);
      toast.success('邀请码已复制');
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      toast.error('复制失败');
    }
  };

  const handleCopyLink = async () => {
    if (!inviteInfo?.inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteInfo.inviteLink);
      setCopiedLink(true);
      toast.success('邀请链接已复制');
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      toast.error('复制失败');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-primary">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
        </div>
      </div>
    );
  }

  const inviteCode = inviteInfo?.inviteCode || '------';
  const displayStats = stats || { totalCommission: '0' };
  const displayTeam = teamData || { level1: [], level2: [], total: 0, level1Count: 0, level2Count: 0 };

  const displayMembers = activeTab === 'all'
    ? [...displayTeam.level1, ...displayTeam.level2]
    : activeTab === 'level1'
    ? displayTeam.level1
    : displayTeam.level2;

  return (
    <div className="min-h-screen bg-bg-primary pb-24">

      {/* ========== 邀请码区域 - 统一资产卡片 + 光球脉动 ========== */}
      <div className="mx-4 mt-4 mb-6 relative bg-bg-secondary rounded-2xl p-5 overflow-hidden">
        {/* 光球脉动效果 */}
        <div className="pointer-events-none absolute -top-20 right-0 h-40 w-40 animate-pulse rounded-full opacity-30 blur-3xl bg-brand-primary" />

        <div className="relative z-10">
          {/* 邀请码 */}
          <div className="text-center mb-5">
            <p className="text-text-tertiary text-xs mb-2">我的邀请码</p>
            <div
              onClick={handleCopyCode}
              className="inline-flex items-center gap-3 px-6 py-3 bg-white/5 rounded-xl cursor-pointer active:scale-[0.98] transition-transform"
            >
              <span className="text-3xl font-bold font-mono tracking-widest text-white">
                {inviteCode}
              </span>
              {copiedCode ? (
                <Check className="w-5 h-5 text-success" />
              ) : (
                <Copy className="w-5 h-5 text-text-tertiary" />
              )}
            </div>
          </div>

          {/* 数据统计 - 三列布局 */}
          <div className="grid grid-cols-3 gap-4 pt-4">
            <div className="text-center">
              <p className="text-2xl font-bold font-mono text-white">{displayTeam.level1Count}</p>
              <p className="text-text-tertiary text-xs">一级成员</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold font-mono text-success">{displayTeam.level2Count}</p>
              <p className="text-text-tertiary text-xs">二级成员</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold font-mono text-warning">{parseFloat(displayStats.totalCommission).toFixed(0)}</p>
              <p className="text-text-tertiary text-xs">累计返佣</p>
            </div>
          </div>

          {/* 返佣规则 */}
          <p className="text-center text-xs text-text-tertiary mt-4">
            一级 <span className="text-brand-primary">10%</span> ·
            二级 <span className="text-success">5%</span> ·
            <span className="text-warning">永久有效</span>
          </p>
        </div>
      </div>

      {/* ========== 分享操作按钮 ========== */}
      <div className="px-4 mb-6">
        <div className="flex gap-3">
          <button
            onClick={handleCopyLink}
            className="flex-1 flex flex-col items-center gap-2 py-4 bg-bg-secondary rounded-xl active:bg-bg-tertiary transition-colors"
          >
            {copiedLink ? (
              <Check className="w-6 h-6 text-success" />
            ) : (
              <Link2 className="w-6 h-6 text-brand-primary" />
            )}
            <span className="text-sm text-white">复制链接</span>
          </button>
          <button className="flex-1 flex flex-col items-center gap-2 py-4 bg-bg-secondary rounded-xl active:bg-bg-tertiary transition-colors">
            <QrCode className="w-6 h-6 text-success" />
            <span className="text-sm text-white">二维码</span>
          </button>
          <button className="flex-1 flex flex-col items-center gap-2 py-4 bg-bg-secondary rounded-xl active:bg-bg-tertiary transition-colors">
            <Download className="w-6 h-6 text-warning" />
            <span className="text-sm text-white">分享海报</span>
          </button>
        </div>
      </div>

      {/* ========== 团队成员列表 ========== */}
      <div>
        {/* Tab 切换 */}
        <div className="px-4 flex items-center gap-4 mb-3">
          <div className="flex items-center gap-1">
            <Users className="w-4 h-4 text-text-tertiary" />
            <span className="text-white font-medium">团队成员</span>
          </div>
          <div className="flex gap-2 flex-1">
            <button
              onClick={() => setActiveTab('all')}
              className={cn(
                'px-3 py-1 text-xs rounded-full transition-colors',
                activeTab === 'all'
                  ? 'bg-brand-primary text-white'
                  : 'bg-bg-secondary text-text-secondary'
              )}
            >
              全部 ({displayTeam.total})
            </button>
            <button
              onClick={() => setActiveTab('level1')}
              className={cn(
                'px-3 py-1 text-xs rounded-full transition-colors',
                activeTab === 'level1'
                  ? 'bg-brand-primary text-white'
                  : 'bg-bg-secondary text-text-secondary'
              )}
            >
              一级 ({displayTeam.level1Count})
            </button>
            <button
              onClick={() => setActiveTab('level2')}
              className={cn(
                'px-3 py-1 text-xs rounded-full transition-colors',
                activeTab === 'level2'
                  ? 'bg-brand-primary text-white'
                  : 'bg-bg-secondary text-text-secondary'
              )}
            >
              二级 ({displayTeam.level2Count})
            </button>
          </div>
        </div>

        {/* 成员列表 */}
        {displayMembers.length === 0 ? (
          <div className="px-4 py-16 text-center">
            <Users className="w-16 h-16 mx-auto text-text-tertiary/30 mb-4" />
            <p className="text-text-secondary mb-1">暂无团队成员</p>
            <p className="text-text-tertiary text-xs">分享邀请链接，邀请好友加入</p>
          </div>
        ) : (
          <div className="space-y-px">
            {displayMembers.map((member) => (
              <div
                key={member.id}
                className="bg-bg-secondary px-4 py-3 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center',
                    member.level === 1 ? 'bg-brand-primary/20' : 'bg-success/20'
                  )}>
                    <Users className={cn(
                      'w-5 h-5',
                      member.level === 1 ? 'text-brand-primary' : 'text-success'
                    )} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-white text-sm">
                        {member.email.replace(/(.{3}).*(@.*)/, '$1***$2')}
                      </p>
                      {member.vipLevel > 0 && (
                        <span className="flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] bg-warning/20 text-warning rounded">
                          <Crown className="w-2.5 h-2.5" />
                          V{member.vipLevel}
                        </span>
                      )}
                    </div>
                    <p className="text-text-tertiary text-xs">
                      <span className={cn(
                        member.level === 1 ? 'text-brand-primary' : 'text-success'
                      )}>
                        {member.level === 1 ? '一级' : '二级'}
                      </span>
                      {' · '}
                      {new Date(member.createdAt).toLocaleDateString('zh-CN')}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={cn(
                    'font-medium',
                    parseFloat(member.commission) > 0 ? 'text-success' : 'text-text-tertiary'
                  )}>
                    {parseFloat(member.commission) > 0 ? '+' : ''}{parseFloat(member.commission).toFixed(2)}
                  </p>
                  <p className="text-text-tertiary text-xs">返佣</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
