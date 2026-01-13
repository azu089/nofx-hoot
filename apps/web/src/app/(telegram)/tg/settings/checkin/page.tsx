'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTelegramContext } from '@/components/providers/TelegramProvider';
import { gamefiApi } from '@/lib/api';
import {
  ArrowLeft,
  Gift,
  Coins,
  Calendar,
  CheckCircle,
  Flame,
} from 'lucide-react';

export default function TgCheckinPage() {
  const router = useRouter();
  const { haptic } = useTelegramContext();
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [checkedToday, setCheckedToday] = useState(false);
  const [streak, setStreak] = useState(0);
  const [totalPoints, setTotalPoints] = useState(0);
  const [weekDays, setWeekDays] = useState<boolean[]>([]);

  const fetchData = async () => {
    try {
      const res = await gamefiApi.getCheckinStatus();
      setCheckedToday(res.data?.checkedToday || false);
      setStreak(res.data?.streak || 0);
      setTotalPoints(res.data?.totalPoints || 0);
      setWeekDays(res.data?.weekDays || [false, false, false, false, false, false, false]);
    } catch (error) {
      console.error('Failed to fetch checkin status:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCheckin = async () => {
    if (checkedToday) return;

    setChecking(true);
    haptic('impact_medium');
    try {
      const res = await gamefiApi.checkin();
      haptic('notification_success');
      setCheckedToday(true);
      setStreak(res.data?.streak || streak + 1);
      setTotalPoints(res.data?.totalPoints || totalPoints + getReward(streak));
      alert(`签到成功！获得 ${getReward(streak)} 积分`);
    } catch (error: any) {
      haptic('notification_error');
      alert(error?.message || '签到失败');
    } finally {
      setChecking(false);
    }
  };

  const getReward = (day: number) => {
    const rewards = [10, 15, 20, 25, 30, 40, 50];
    return rewards[Math.min(day, 6)];
  };

  const dayLabels = ['一', '二', '三', '四', '五', '六', '日'];

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-10 bg-bg-tertiary/50 rounded-lg w-32" />
        <div className="h-32 bg-bg-tertiary/50 rounded-xl" />
        <div className="h-24 bg-bg-tertiary/50 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-24">
      {/* 顶部 */}
      <button
        onClick={() => { haptic('selection'); router.back(); }}
        className="flex items-center gap-2 text-text-secondary"
      >
        <ArrowLeft size={20} />
        <span className="text-lg font-medium text-white">每日签到</span>
      </button>

      {/* 签到状态 */}
      <div className={`rounded-xl p-6 text-center ${
        checkedToday
          ? 'bg-success/10 border border-success/30'
          : 'bg-gradient-to-r from-warning/20 to-warning/10 border border-warning/30'
      }`}>
        <div className={`w-16 h-16 rounded-full mx-auto mb-3 flex items-center justify-center ${
          checkedToday ? 'bg-success/20' : 'bg-warning/20'
        }`}>
          {checkedToday ? (
            <CheckCircle className="w-8 h-8 text-success" />
          ) : (
            <Gift className="w-8 h-8 text-warning" />
          )}
        </div>
        <h2 className="text-white font-bold text-lg mb-1">
          {checkedToday ? '今日已签到' : '今日待签到'}
        </h2>
        <p className="text-text-tertiary text-sm">
          {checkedToday
            ? `已连续签到 ${streak} 天`
            : `签到可获得 ${getReward(streak)} 积分`
          }
        </p>
      </div>

      {/* 连续签到 */}
      <div className="bg-bg-secondary border border-border-primary rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-warning" />
            <span className="text-white font-medium">连续签到</span>
          </div>
          <span className="text-warning font-bold">{streak} 天</span>
        </div>

        {/* 周签到 */}
        <div className="grid grid-cols-7 gap-2">
          {dayLabels.map((day, idx) => (
            <div
              key={idx}
              className={`aspect-square rounded-lg flex flex-col items-center justify-center ${
                weekDays[idx]
                  ? 'bg-success/20 border border-success/30'
                  : 'bg-bg-tertiary border border-border-primary'
              }`}
            >
              <span className="text-text-tertiary text-xs mb-1">{day}</span>
              {weekDays[idx] ? (
                <CheckCircle className="w-4 h-4 text-success" />
              ) : (
                <span className="text-text-tertiary text-xs">{getReward(idx)}</span>
              )}
            </div>
          ))}
        </div>

        <p className="text-text-tertiary text-xs text-center mt-3">
          连续签到天数越多，奖励越丰厚
        </p>
      </div>

      {/* 积分统计 */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-bg-secondary border border-border-primary rounded-xl p-4 text-center">
          <Coins className="w-6 h-6 text-warning mx-auto mb-2" />
          <p className="text-2xl font-bold text-white">{totalPoints}</p>
          <p className="text-text-tertiary text-xs">累计获得积分</p>
        </div>
        <div className="bg-bg-secondary border border-border-primary rounded-xl p-4 text-center">
          <Calendar className="w-6 h-6 text-brand-primary mx-auto mb-2" />
          <p className="text-2xl font-bold text-white">{streak}</p>
          <p className="text-text-tertiary text-xs">连续签到天数</p>
        </div>
      </div>

      {/* 签到按钮 */}
      <button
        onClick={handleCheckin}
        disabled={checkedToday || checking}
        className={`w-full py-4 rounded-xl font-medium flex items-center justify-center gap-2 ${
          checkedToday
            ? 'bg-bg-tertiary text-text-tertiary'
            : 'bg-warning text-white'
        }`}
      >
        {checkedToday ? (
          <>
            <CheckCircle className="w-5 h-5" />
            明天再来
          </>
        ) : (
          <>
            <Gift className="w-5 h-5" />
            {checking ? '签到中...' : '立即签到'}
          </>
        )}
      </button>
    </div>
  );
}
