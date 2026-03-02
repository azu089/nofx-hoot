'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Gift, Calendar, Clock, ChevronRight, Loader2, CheckCircle2 } from 'lucide-react'
import type { TaskItem } from '@/hooks/use-airdrop'

interface MobileAirdropPageProps {
  onBack?: () => void
  checkinStatus?: {
    checkedInToday: boolean
    streak: number
    todayReward: string | null
    nextReward: string
  }
  history?: Array<{
    id: string
    type: string
    amount: string
    status: string
    createdAt: string
    description: string
  }>
  tasks?: TaskItem[]
  onCheckin?: () => void
  isCheckinLoading?: boolean
}

// 签到奖励递增表
const CHECKIN_REWARDS = [3, 5, 7, 9, 11, 13, 15]

// 空投类型标签
const typeLabels: Record<string, { zh: string; color: string }> = {
  register: { zh: '注册奖励', color: 'text-emerald-400' },
  bind_tg: { zh: '绑定TG', color: 'text-blue-400' },
  bind_wallet: { zh: '绑定钱包', color: 'text-purple-400' },
  bind_email: { zh: '绑定邮箱', color: 'text-cyan-400' },
  referral: { zh: '邀请奖励', color: 'text-orange-400' },
  trading_profit: { zh: '交易奖励', color: 'text-yellow-400' },
  checkin: { zh: '签到奖励', color: 'text-pink-400' },
}

export function MobileAirdropPage({
  onBack,
  checkinStatus,
  history,
  tasks,
  onCheckin,
  isCheckinLoading,
}: MobileAirdropPageProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'tasks' | 'history'>('tasks')

  const streak = checkinStatus?.streak || 0
  const checkedIn = checkinStatus?.checkedInToday || false
  const todayReward = checkinStatus?.todayReward
  const nextReward = checkinStatus?.nextReward || '3'

  // 日历项渲染
  const renderCalendarItem = (reward: number, index: number) => {
    const dayNum = index + 1
    const isCompleted = dayNum <= streak
    const isToday = dayNum === streak + 1 && !checkedIn
    const isTodayDone = dayNum === streak && checkedIn

    return (
      <div
        key={dayNum}
        className={`flex flex-col items-center gap-1.5 py-3 rounded-xl ${
          isCompleted || isTodayDone
            ? 'bg-purple-500/20 border border-purple-500/30'
            : isToday
              ? 'bg-[#1E1E2E] border border-cyan-500/30'
              : 'bg-[#0A0A0F] border border-[#1E1E2E]'
        }`}
      >
        <span className="text-xs text-[#9090A0]">Day{dayNum}</span>
        <Gift
          className={`w-5 h-5 ${
            isCompleted || isTodayDone
              ? 'text-purple-400'
              : isToday
                ? 'text-cyan-400'
                : 'text-[#3A3A4A]'
          }`}
        />
        <span
          className={`text-xs font-bold ${
            isCompleted || isTodayDone
              ? 'text-purple-400'
              : isToday
                ? 'text-cyan-400'
                : 'text-[#9090A0]'
          }`}
        >
          +{reward}
        </span>
      </div>
    )
  }

  // 任务卡片渲染
  const renderTaskItem = (task: TaskItem) => {
    return (
      <div
        key={task.id}
        className="glass-border-glow relative flex items-center justify-between bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] p-4"
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
              task.status === 'completed'
                ? 'bg-emerald-500/20'
                : task.status === 'repeatable'
                  ? 'bg-purple-500/20'
                  : 'bg-[#1E1E2E]'
            }`}
          >
            {task.status === 'completed' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : task.status === 'repeatable' ? (
              <Gift className="w-4 h-4 text-purple-400" />
            ) : (
              <Gift className="w-4 h-4 text-[#9090A0]" />
            )}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium">{task.label}</div>
            <div className="text-xs text-[#9090A0]">{task.description}</div>
          </div>
        </div>

        {/* 右侧操作区 */}
        <div className="shrink-0 ml-3">
          {task.status === 'incomplete' && (
            <button
              type="button"
              onClick={() => task.actionUrl && router.push(task.actionUrl)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#1E1E2E] text-xs text-[#9090A0] active:scale-95 transition-transform"
            >
              去完成
              <ChevronRight className="w-3 h-3" />
            </button>
          )}
          {task.status === 'completed' && (
            <span className="text-xs text-emerald-400 font-medium">
              已完成 +{task.rewardAmount}
            </span>
          )}
          {task.status === 'repeatable' && (
            <div className="text-right">
              <div className="text-xs font-bold text-cyan-400">{task.reward}</div>
              <div className="text-[10px] text-[#9090A0]">
                已获 {(parseFloat(task.claimedAmount || '0') || 0).toFixed(0)}
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-[#F8F8FC]">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-[#0A0A0F]/95 backdrop-blur-lg border-b border-[#1E1E2E]">
        <div className="flex items-center px-4 h-14">
          <button type="button" onClick={onBack} className="p-1 -ml-1 mr-3" title="返回">
            <ArrowLeft className="w-5 h-5 text-[#9090A0]" />
          </button>
          <h1 className="text-lg font-bold">签到领币</h1>
        </div>
      </div>

      {/* 签到主卡片 */}
      <div className="px-4 pt-4">
        <div className="glass-border-glow relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-cyan-500/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.5)] p-6">
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full -translate-y-8 translate-x-8" />

          <div className="relative z-10">
            {/* 连续签到 */}
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="w-4 h-4 text-purple-400" />
              <span className="text-sm text-[#9090A0]">
                连续签到 <span className="text-purple-400 font-bold">{streak}</span> 天
              </span>
            </div>

            {/* 签到按钮 */}
            <button
              type="button"
              onClick={onCheckin}
              disabled={checkedIn || isCheckinLoading}
              className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${
                checkedIn
                  ? 'bg-[#1E1E2E] text-[#9090A0] cursor-default'
                  : 'bg-gradient-to-r from-purple-500 to-pink-500 text-white active:scale-95'
              }`}
            >
              {isCheckinLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  签到中...
                </span>
              ) : checkedIn ? (
                <span className="flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  今日已签到 +{todayReward || nextReward} HOOT
                </span>
              ) : (
                <span>签到领 {nextReward} HOOT</span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 7天签到日历 — 4+3 两行布局 */}
      <div className="px-4 mt-4">
        <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] p-4">
          <h3 className="text-sm font-medium text-[#9090A0] mb-3">7天签到奖励</h3>
          {/* 第一行: Day1-Day4 */}
          <div className="grid grid-cols-4 gap-2">
            {CHECKIN_REWARDS.slice(0, 4).map((reward, index) =>
              renderCalendarItem(reward, index),
            )}
          </div>
          {/* 第二行: Day5-Day7 居中 */}
          <div className="grid grid-cols-4 gap-2 mt-2">
            <div /> {/* 占位 */}
            {CHECKIN_REWARDS.slice(4).map((reward, index) =>
              renderCalendarItem(reward, index + 4),
            )}
          </div>
        </div>
      </div>

      {/* 释放说明 */}
      <div className="px-4 mt-4">
        <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-medium text-[#9090A0]">释放规则</h3>
          </div>
          <p className="text-xs text-[#9090A0] leading-relaxed">
            空投 HOOT 需经过 90 天线性释放周期。锁定期 7 天后开始释放，最低提现 100 HOOT，提现手续费 5%（销毁机制）。
          </p>
        </div>
      </div>

      {/* Tab 切换 */}
      <div className="px-4 mt-4">
        <div className="flex gap-4 border-b border-[#1E1E2E]">
          <button
            type="button"
            onClick={() => setActiveTab('tasks')}
            className={`pb-3 text-sm font-medium transition-colors ${
              activeTab === 'tasks'
                ? 'text-cyan-400 border-b-2 border-cyan-400'
                : 'text-[#9090A0]'
            }`}
          >
            任务
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`pb-3 text-sm font-medium transition-colors ${
              activeTab === 'history'
                ? 'text-cyan-400 border-b-2 border-cyan-400'
                : 'text-[#9090A0]'
            }`}
          >
            空投记录
          </button>
        </div>
      </div>

      {/* Tab 内容 */}
      <div className="px-4 mt-4 pb-20">
        {activeTab === 'tasks' ? (
          <div className="space-y-3">
            {tasks && tasks.length > 0 ? (
              tasks.map((task) => renderTaskItem(task))
            ) : (
              <div className="text-center py-12">
                <Gift className="w-12 h-12 text-[#3A3A4A] mx-auto mb-3" />
                <p className="text-[#9090A0] text-sm">加载中...</p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {history && history.length > 0 ? (
              history.map((item) => {
                const typeInfo = typeLabels[item.type] || { zh: item.type, color: 'text-[#9090A0]' }
                return (
                  <div
                    key={item.id}
                    className="glass-border-glow relative flex items-center justify-between bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] p-4"
                  >
                    <div>
                      <div className="text-sm font-medium">{item.description || typeInfo.zh}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs ${typeInfo.color}`}>{typeInfo.zh}</span>
                        <span className="text-xs text-[#9090A0]">
                          {new Date(item.createdAt).toLocaleDateString('zh-CN')}
                        </span>
                      </div>
                    </div>
                    <div className="text-sm font-bold text-emerald-400">
                      +{(parseFloat(item.amount) || 0).toFixed(0)} HOOT
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="text-center py-12">
                <Gift className="w-12 h-12 text-[#3A3A4A] mx-auto mb-3" />
                <p className="text-[#9090A0] text-sm">暂无空投记录</p>
                <p className="text-[#9090A0] text-xs mt-1">完成任务获取 HOOT 奖励</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
