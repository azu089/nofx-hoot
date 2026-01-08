'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, Button } from '@/components/ui';
import { userApi } from '@/lib/api';
import {
  Gift,
  Users,
  Copy,
  Check,
  Share2,
  QrCode,
  ChevronRight,
  ChevronLeft,
  Download,
  Loader2,
  Crown,
  UserPlus,
  ChevronDown,
  ChevronUp,
  Link2,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

/**
 * 邀请返佣页面 - 重构版
 * 设计理念：Hero 区域突出邀请码，简化视觉层次
 */

interface InviteInfo {
  inviteCode: string;
  inviteLink: string;
}

interface InviteStats {
  totalInvites: number;
  activeUsers: number;
  totalCommission: string;
  pendingCommission: string;
  recentInvites: Array<{
    id: string;
    email: string;
    createdAt: string;
    status: string;
    commission: string;
  }>;
}

interface TeamMember {
  id: string;
  email: string;
  status: string;
  vipLevel: number;
  createdAt: string;
  commission: string;
  level: number;
  referrerEmail?: string;
}

interface TeamData {
  level1: TeamMember[];
  level2: TeamMember[];
  total: number;
  level1Count: number;
  level2Count: number;
}

export default function ReferralPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null);
  const [stats, setStats] = useState<InviteStats | null>(null);
  const [teamData, setTeamData] = useState<TeamData | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [teamExpanded, setTeamExpanded] = useState(false);
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

      if (infoRes.code === 0) {
        setInviteInfo(infoRes.data);
      }
      if (statsRes.code === 0) {
        setStats(statsRes.data);
      }
      if (teamRes.code === 0) {
        setTeamData(teamRes.data);
      }
    } catch (error) {
      console.error('Failed to fetch referral data:', error);
      toast.error('获取邀请信息失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = async () => {
    if (!inviteInfo?.inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteInfo.inviteLink);
      setCopiedLink(true);
      toast.success('邀请链接已复制');
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
      toast.error('复制失败');
    }
  };

  const handleCopyCode = async () => {
    if (!inviteInfo?.inviteCode) return;
    try {
      await navigator.clipboard.writeText(inviteInfo.inviteCode);
      setCopiedCode(true);
      toast.success('邀请码已复制');
      setTimeout(() => setCopiedCode(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
      toast.error('复制失败');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
      </div>
    );
  }

  const inviteCode = inviteInfo?.inviteCode || '';
  const inviteLink = inviteInfo?.inviteLink || '';
  const displayStats = stats || {
    totalInvites: 0,
    activeUsers: 0,
    totalCommission: '0',
    pendingCommission: '0',
    recentInvites: [],
  };
  const displayTeam = teamData || {
    level1: [],
    level2: [],
    total: 0,
    level1Count: 0,
    level2Count: 0,
  };

  // 根据选中 Tab 显示对应成员
  const displayMembers = activeTab === 'all'
    ? [...displayTeam.level1, ...displayTeam.level2]
    : activeTab === 'level1'
    ? displayTeam.level1
    : displayTeam.level2;

  return (
    <div className="space-y-4 pb-20 lg:pb-6">
      {/* 移动端返回按钮 */}
      <div className="lg:hidden">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1 text-text-secondary -ml-1"
        >
          <ChevronLeft className="w-5 h-5" />
          <span className="text-lg font-medium text-text-primary">邀请返佣</span>
        </button>
      </div>

      {/* ============ Hero 区域 ============ */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-brand-primary/20 via-bg-secondary to-success/10 border border-brand-primary/20">
        {/* 装饰背景 */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-brand-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-success/10 rounded-full blur-2xl" />

        <div className="relative p-5 lg:p-6">
          {/* 标题 */}
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-brand-primary" />
            <h1 className="text-lg lg:text-xl font-bold text-text-primary">邀请好友 · 赚取返佣</h1>
          </div>

          {/* 邀请码 - 大号居中显示 */}
          <div className="text-center py-4">
            <p className="text-xs text-text-tertiary mb-2">我的邀请码</p>
            <div className="inline-flex items-center gap-3 px-6 py-3 bg-bg-primary/60 backdrop-blur rounded-xl border border-border-primary">
              <span className="text-3xl lg:text-4xl font-bold font-mono tracking-wider text-brand-primary">
                {inviteCode || '------'}
              </span>
              <button
                onClick={handleCopyCode}
                disabled={!inviteCode}
                className="p-2 rounded-lg bg-brand-primary/20 hover:bg-brand-primary/30 transition-colors"
              >
                {copiedCode ? (
                  <Check className="w-5 h-5 text-success" />
                ) : (
                  <Copy className="w-5 h-5 text-brand-primary" />
                )}
              </button>
            </div>
          </div>

          {/* 统计数据 - 横向排列 */}
          <div className="grid grid-cols-3 gap-3 mt-4">
            <div className="text-center p-3 rounded-lg bg-bg-primary/40 backdrop-blur">
              <p className="text-xl lg:text-2xl font-bold text-text-primary">{displayTeam.level1Count}</p>
              <p className="text-xs text-text-tertiary mt-0.5">一级成员</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-bg-primary/40 backdrop-blur">
              <p className="text-xl lg:text-2xl font-bold text-success">{displayTeam.level2Count}</p>
              <p className="text-xs text-text-tertiary mt-0.5">二级成员</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-bg-primary/40 backdrop-blur">
              <p className="text-xl lg:text-2xl font-bold text-warning">
                {parseFloat(displayStats.totalCommission).toFixed(0)}
              </p>
              <p className="text-xs text-text-tertiary mt-0.5">累计返佣</p>
            </div>
          </div>

          {/* 规则一行说明 */}
          <div className="mt-4 pt-4 border-t border-white/10 text-center">
            <p className="text-xs text-text-secondary">
              一级返佣 <span className="text-brand-primary font-medium">10%</span> ·
              二级返佣 <span className="text-success font-medium">5%</span> ·
              <span className="text-warning font-medium">永久有效</span>
            </p>
          </div>
        </div>
      </div>

      {/* ============ 分享按钮区 ============ */}
      <div className="grid grid-cols-3 gap-3">
        <button
          onClick={handleCopyLink}
          className="flex flex-col items-center gap-2 p-4 rounded-xl bg-bg-secondary border border-border-primary hover:border-brand-primary/50 transition-all group"
        >
          <div className="w-10 h-10 rounded-full bg-brand-primary/20 flex items-center justify-center group-hover:bg-brand-primary/30 transition-colors">
            {copiedLink ? (
              <Check className="w-5 h-5 text-success" />
            ) : (
              <Link2 className="w-5 h-5 text-brand-primary" />
            )}
          </div>
          <span className="text-sm text-text-primary font-medium">复制链接</span>
        </button>

        <button className="flex flex-col items-center gap-2 p-4 rounded-xl bg-bg-secondary border border-border-primary hover:border-brand-primary/50 transition-all group">
          <div className="w-10 h-10 rounded-full bg-success/20 flex items-center justify-center group-hover:bg-success/30 transition-colors">
            <QrCode className="w-5 h-5 text-success" />
          </div>
          <span className="text-sm text-text-primary font-medium">二维码</span>
        </button>

        <button className="flex flex-col items-center gap-2 p-4 rounded-xl bg-bg-secondary border border-border-primary hover:border-brand-primary/50 transition-all group">
          <div className="w-10 h-10 rounded-full bg-warning/20 flex items-center justify-center group-hover:bg-warning/30 transition-colors">
            <Download className="w-5 h-5 text-warning" />
          </div>
          <span className="text-sm text-text-primary font-medium">分享海报</span>
        </button>
      </div>

      {/* ============ 团队成员（可折叠） ============ */}
      <Card>
        <button
          onClick={() => setTeamExpanded(!teamExpanded)}
          className="w-full flex items-center justify-between p-4"
        >
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-brand-primary" />
            <span className="font-medium text-text-primary">团队成员</span>
            <span className="text-xs text-text-tertiary">({displayTeam.total} 人)</span>
          </div>
          {teamExpanded ? (
            <ChevronUp className="w-5 h-5 text-text-tertiary" />
          ) : (
            <ChevronDown className="w-5 h-5 text-text-tertiary" />
          )}
        </button>

        {teamExpanded && (
          <CardContent className="pt-0">
            {/* Tab 切换 */}
            <div className="flex gap-2 mb-3">
              <button
                onClick={() => setActiveTab('all')}
                className={cn(
                  'px-3 py-1.5 text-xs rounded-lg transition-colors',
                  activeTab === 'all'
                    ? 'bg-brand-primary text-white'
                    : 'bg-bg-tertiary text-text-secondary hover:text-text-primary'
                )}
              >
                全部 ({displayTeam.total})
              </button>
              <button
                onClick={() => setActiveTab('level1')}
                className={cn(
                  'px-3 py-1.5 text-xs rounded-lg transition-colors',
                  activeTab === 'level1'
                    ? 'bg-brand-primary text-white'
                    : 'bg-bg-tertiary text-text-secondary hover:text-text-primary'
                )}
              >
                一级 ({displayTeam.level1Count})
              </button>
              <button
                onClick={() => setActiveTab('level2')}
                className={cn(
                  'px-3 py-1.5 text-xs rounded-lg transition-colors',
                  activeTab === 'level2'
                    ? 'bg-success text-white'
                    : 'bg-bg-tertiary text-text-secondary hover:text-text-primary'
                )}
              >
                二级 ({displayTeam.level2Count})
              </button>
            </div>

            {displayMembers.length === 0 ? (
              <div className="text-center py-8">
                <Users className="w-12 h-12 mx-auto text-text-tertiary opacity-50 mb-3" />
                <p className="text-sm text-text-secondary">暂无团队成员</p>
                <p className="text-xs text-text-tertiary mt-1">分享邀请链接，邀请好友加入</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {displayMembers.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-bg-tertiary/30"
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'w-8 h-8 rounded-full flex items-center justify-center',
                        member.level === 1 ? 'bg-brand-primary/20' : 'bg-success/20'
                      )}>
                        <Users className={cn(
                          'w-4 h-4',
                          member.level === 1 ? 'text-brand-primary' : 'text-success'
                        )} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-text-primary">
                            {member.email.replace(/(.{3}).*(@.*)/, '$1***$2')}
                          </p>
                          {member.vipLevel > 0 && (
                            <span className="flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] bg-warning/20 text-warning rounded">
                              <Crown className="w-2.5 h-2.5" />
                              V{member.vipLevel}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-text-tertiary">
                          <span className={cn(
                            'px-1.5 py-0.5 rounded text-[10px]',
                            member.level === 1 ? 'bg-brand-primary/10 text-brand-primary' : 'bg-success/10 text-success'
                          )}>
                            {member.level === 1 ? '一级' : '二级'}
                          </span>
                          <span>{new Date(member.createdAt).toLocaleDateString('zh-CN')}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={cn(
                        'text-sm font-medium',
                        parseFloat(member.commission) > 0 ? 'text-success' : 'text-text-tertiary'
                      )}>
                        {parseFloat(member.commission) > 0 ? '+' : ''}{parseFloat(member.commission).toFixed(2)}
                      </p>
                      <p className="text-[10px] text-text-tertiary">返佣积分</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* ============ 返佣规则（简化版） ============ */}
      <Card className="p-4">
        <div className="flex items-start gap-3">
          <Gift className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
          <div className="space-y-2 text-sm">
            <p className="font-medium text-text-primary">返佣规则</p>
            <ul className="space-y-1 text-text-secondary text-xs">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-primary" />
                一级好友消费燃油费，返佣 <span className="text-brand-primary font-medium">10%</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-success" />
                二级好友消费燃油费，返佣 <span className="text-success font-medium">5%</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-warning" />
                返佣以积分发放，可兑换 QFI 代币
              </li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}
