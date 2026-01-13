'use client';

import { useState, useEffect } from 'react';
import { Gift, Flame, Star, Check, Sparkles } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

interface CheckinResult {
  success: boolean;
  pointsEarned: string;
  streakDays: number;
  alreadyCheckedIn: boolean;
  nextCheckinAt: string;
}

export default function CheckinPage() {
  const [result, setResult] = useState<CheckinResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [animating, setAnimating] = useState(false);

  const handleCheckin = async () => {
    if (loading || result?.alreadyCheckedIn) return;

    setLoading(true);
    setAnimating(true);

    try {
      const response = await api.post('/telegram/checkin');
      setResult(response.data);

      if (response.data.success) {
        toast.success(`签到成功！获得 ${response.data.pointsEarned} 积分`);
      } else if (response.data.alreadyCheckedIn) {
        toast.info('今日已签到，明天再来');
      }
    } catch (error: any) {
      console.error('签到失败:', error);
      toast.error(error.response?.data?.message || '签到失败');
    } finally {
      setLoading(false);
      setTimeout(() => setAnimating(false), 500);
    }
  };

  // 本周签到日期
  const weekDays = ['一', '二', '三', '四', '五', '六', '日'];
  const today = new Date().getDay();
  const todayIndex = today === 0 ? 6 : today - 1;

  // 计算奖励
  const getReward = (day: number) => {
    const base = 10;
    const bonus = Math.min((day - 1) * 2, 40);
    return base + bonus;
  };

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* 签到卡片 */}
      <div className="bg-gradient-to-br from-warning/20 to-orange-500/10 border border-warning/30 rounded-2xl p-6 text-center">
        <div
          className={`w-24 h-24 mx-auto mb-4 rounded-full bg-warning/20 flex items-center justify-center transition-transform ${
            animating ? 'scale-110' : ''
          }`}
        >
          {result?.success || result?.alreadyCheckedIn ? (
            <Check size={48} className="text-success" />
          ) : (
            <Gift size={48} className="text-warning" />
          )}
        </div>

        <h2 className="text-xl font-bold text-text-primary mb-2">
          {result?.alreadyCheckedIn
            ? '今日已签到'
            : result?.success
            ? '签到成功！'
            : '每日签到'}
        </h2>

        {result ? (
          <div className="space-y-2">
            <div className="flex items-center justify-center gap-2">
              <Sparkles size={20} className="text-warning" />
              <span className="text-2xl font-bold text-warning">
                +{result.pointsEarned}
              </span>
              <span className="text-text-secondary">积分</span>
            </div>
            <div className="flex items-center justify-center gap-2 text-sm text-text-tertiary">
              <Flame size={16} className="text-orange-500" />
              <span>连续签到 {result.streakDays} 天</span>
            </div>
          </div>
        ) : (
          <p className="text-text-secondary text-sm">
            连续签到可获得更多积分奖励
          </p>
        )}

        <button
          className={`w-full mt-6 py-3 rounded-xl font-medium transition-all ${
            result?.alreadyCheckedIn
              ? 'bg-bg-tertiary text-text-tertiary cursor-not-allowed'
              : 'bg-warning text-black hover:bg-warning/90'
          }`}
          onClick={handleCheckin}
          disabled={loading || result?.alreadyCheckedIn}
        >
          {loading
            ? '签到中...'
            : result?.alreadyCheckedIn
            ? '明天再来'
            : result?.success
            ? '已签到'
            : '立即签到'}
        </button>
      </div>

      {/* 本周签到进度 */}
      <div className="bg-bg-secondary border border-border-primary rounded-xl p-4">
        <h3 className="text-sm font-medium text-text-primary mb-4">本周签到</h3>
        <div className="grid grid-cols-7 gap-2">
          {weekDays.map((day, index) => {
            const isPast = index < todayIndex;
            const isToday = index === todayIndex;
            const isChecked = isPast || (isToday && (result?.success || result?.alreadyCheckedIn));

            return (
              <div key={day} className="flex flex-col items-center gap-1">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    isChecked
                      ? 'bg-success text-white'
                      : isToday
                      ? 'bg-warning/20 border-2 border-warning text-warning'
                      : 'bg-bg-tertiary text-text-tertiary'
                  }`}
                >
                  {isChecked ? (
                    <Check size={18} />
                  ) : (
                    <span className="text-xs font-medium">{day}</span>
                  )}
                </div>
                <span className="text-xs text-text-tertiary">
                  +{getReward(index + 1)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 积分规则 */}
      <div className="bg-bg-secondary border border-border-primary rounded-xl p-4">
        <h3 className="text-sm font-medium text-text-primary mb-3">签到规则</h3>
        <ul className="space-y-2 text-xs text-text-secondary">
          <li className="flex items-start gap-2">
            <Star size={14} className="text-warning flex-shrink-0 mt-0.5" />
            <span>每日签到可获得 10 基础积分</span>
          </li>
          <li className="flex items-start gap-2">
            <Flame size={14} className="text-orange-500 flex-shrink-0 mt-0.5" />
            <span>连续签到每天额外 +2 积分，最高 +40</span>
          </li>
          <li className="flex items-start gap-2">
            <Gift size={14} className="text-purple-500 flex-shrink-0 mt-0.5" />
            <span>连续 7 天签到可获得神秘大礼</span>
          </li>
          <li className="flex items-start gap-2">
            <Sparkles size={14} className="text-brand-primary flex-shrink-0 mt-0.5" />
            <span>积分可兑换 QFI 代币或抵扣 VIP 订阅费</span>
          </li>
        </ul>
      </div>

      {/* 积分用途 */}
      <div className="bg-bg-secondary border border-border-primary rounded-xl p-4">
        <h3 className="text-sm font-medium text-text-primary mb-3">积分用途</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-bg-tertiary rounded-lg">
            <p className="text-sm text-text-primary">兑换 QFI</p>
            <p className="text-xs text-text-tertiary">100:1 兑换比例</p>
          </div>
          <div className="p-3 bg-bg-tertiary rounded-lg">
            <p className="text-sm text-text-primary">抵扣 VIP 订阅费</p>
            <p className="text-xs text-text-tertiary">1 积分 = 1 USDT</p>
          </div>
          <div className="p-3 bg-bg-tertiary rounded-lg">
            <p className="text-sm text-text-primary">VIP 加速</p>
            <p className="text-xs text-text-tertiary">提升 VIP 等级</p>
          </div>
          <div className="p-3 bg-bg-tertiary rounded-lg">
            <p className="text-sm text-text-primary">抽奖活动</p>
            <p className="text-xs text-text-tertiary">参与限时活动</p>
          </div>
        </div>
      </div>
    </div>
  );
}
