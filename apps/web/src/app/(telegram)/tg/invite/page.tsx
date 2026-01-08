'use client';

import { useEffect, useState } from 'react';
import {
  Users,
  Copy,
  Check,
  Share2,
  Gift,
  TrendingUp,
  Crown,
  ChevronRight,
} from 'lucide-react';
import { useTelegramContext } from '@/components/providers/TelegramProvider';
import { api } from '@/lib/api';

interface InviteData {
  inviteCode: string;
  inviteLink: string;
  telegramShareLink: string;
  totalInvited: number;
  totalCommission: string;
}

export default function TelegramInvite() {
  const { haptic, webApp } = useTelegramContext();
  const [data, setData] = useState<InviteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);

  useEffect(() => {
    async function fetchInvite() {
      try {
        const response = await api.get('/telegram/invite');
        setData(response.data);
      } catch (error) {
        console.error('获取邀请信息失败:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchInvite();
  }, []);

  const copyToClipboard = async (text: string, type: 'code' | 'link') => {
    haptic('notification_success');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    } catch (error) {
      console.error('复制失败:', error);
    }
  };

  const shareToTelegram = () => {
    haptic('impact_medium');
    if (data?.telegramShareLink) {
      window.open(data.telegramShareLink, '_blank');
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-40 bg-bg-secondary rounded-xl animate-pulse" />
        <div className="h-24 bg-bg-secondary rounded-xl animate-pulse" />
        <div className="h-32 bg-bg-secondary rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 邀请统计 */}
      <div className="bg-gradient-to-br from-purple-500/20 to-pink-500/10 border border-purple-500/30 rounded-2xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center">
            <Users size={24} className="text-purple-500" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-text-primary">邀请返佣</h2>
            <p className="text-xs text-text-tertiary">邀请好友，共享收益</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-bg-secondary/50 rounded-xl p-3">
            <p className="text-xs text-text-tertiary mb-1">已邀请人数</p>
            <p className="text-2xl font-bold text-text-primary">
              {data?.totalInvited || 0}
            </p>
          </div>
          <div className="bg-bg-secondary/50 rounded-xl p-3">
            <p className="text-xs text-text-tertiary mb-1">累计返佣</p>
            <p className="text-2xl font-bold text-success">
              ${parseFloat(data?.totalCommission || '0').toFixed(2)}
            </p>
          </div>
        </div>
      </div>

      {/* 邀请码 */}
      <div className="bg-bg-secondary border border-border-primary rounded-xl p-4">
        <p className="text-xs text-text-tertiary mb-2">我的邀请码</p>
        <div className="flex items-center gap-2">
          <p className="flex-1 text-xl font-bold text-text-primary font-mono tracking-wider">
            {data?.inviteCode || '--------'}
          </p>
          <button
            className={`p-2.5 rounded-lg transition-colors ${
              copied === 'code' ? 'bg-success/10' : 'bg-bg-tertiary'
            }`}
            onClick={() => copyToClipboard(data?.inviteCode || '', 'code')}
          >
            {copied === 'code' ? (
              <Check size={18} className="text-success" />
            ) : (
              <Copy size={18} className="text-text-tertiary" />
            )}
          </button>
        </div>
      </div>

      {/* 邀请链接 */}
      <div className="bg-bg-secondary border border-border-primary rounded-xl p-4">
        <p className="text-xs text-text-tertiary mb-2">邀请链接</p>
        <div className="flex items-center gap-2">
          <p className="flex-1 text-sm text-text-secondary truncate">
            {data?.inviteLink || '获取中...'}
          </p>
          <button
            className={`p-2.5 rounded-lg transition-colors ${
              copied === 'link' ? 'bg-success/10' : 'bg-bg-tertiary'
            }`}
            onClick={() => copyToClipboard(data?.inviteLink || '', 'link')}
          >
            {copied === 'link' ? (
              <Check size={18} className="text-success" />
            ) : (
              <Copy size={18} className="text-text-tertiary" />
            )}
          </button>
        </div>
      </div>

      {/* 分享按钮 */}
      <button
        className="w-full flex items-center justify-center gap-2 p-4 bg-brand-primary text-white rounded-xl font-medium"
        onClick={shareToTelegram}
      >
        <Share2 size={18} />
        <span>分享给好友</span>
      </button>

      {/* 返佣规则 */}
      <div className="bg-bg-secondary border border-border-primary rounded-xl p-4">
        <h3 className="text-sm font-medium text-text-primary mb-3">返佣规则</h3>
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-success/10 flex items-center justify-center flex-shrink-0">
              <TrendingUp size={16} className="text-success" />
            </div>
            <div>
              <p className="text-sm text-text-primary">一级返佣 30%</p>
              <p className="text-xs text-text-tertiary">
                直接邀请用户的交易手续费返佣
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-warning/10 flex items-center justify-center flex-shrink-0">
              <Gift size={16} className="text-warning" />
            </div>
            <div>
              <p className="text-sm text-text-primary">二级返佣 10%</p>
              <p className="text-xs text-text-tertiary">
                间接邀请用户的交易手续费返佣
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-purple-500/10 flex items-center justify-center flex-shrink-0">
              <Crown size={16} className="text-purple-500" />
            </div>
            <div>
              <p className="text-sm text-text-primary">VIP 加成</p>
              <p className="text-xs text-text-tertiary">
                VIP 等级越高，返佣比例越高
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 邀请记录入口 */}
      <button
        className="w-full flex items-center justify-between p-4 bg-bg-secondary border border-border-primary rounded-xl"
        onClick={() => {
          haptic('selection');
          // 跳转到邀请记录页面
        }}
      >
        <div className="flex items-center gap-3">
          <Users size={20} className="text-text-tertiary" />
          <span className="text-sm text-text-primary">邀请记录</span>
        </div>
        <ChevronRight size={18} className="text-text-tertiary" />
      </button>

      {/* 返佣明细入口 */}
      <button
        className="w-full flex items-center justify-between p-4 bg-bg-secondary border border-border-primary rounded-xl"
        onClick={() => {
          haptic('selection');
          // 跳转到返佣明细页面
        }}
      >
        <div className="flex items-center gap-3">
          <TrendingUp size={20} className="text-text-tertiary" />
          <span className="text-sm text-text-primary">返佣明细</span>
        </div>
        <ChevronRight size={18} className="text-text-tertiary" />
      </button>
    </div>
  );
}
