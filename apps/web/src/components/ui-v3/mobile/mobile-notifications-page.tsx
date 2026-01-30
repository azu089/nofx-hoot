'use client'

import { useState } from 'react'
import { ArrowLeft, Bell, Megaphone, Calendar, AlertCircle, CheckCheck, ChevronDown } from 'lucide-react'

type NotificationType = 'system' | 'announcement' | 'activity'

interface Notification {
  id: string
  type: NotificationType
  title: string
  summary: string
  content: string
  time: string
  isRead: boolean
}

const mockNotifications: Notification[] = [
  {
    id: '1',
    type: 'system',
    title: '系统维护通知',
    summary: '平台将于今晚进行系统升级维护',
    content: '我们将于今晚 22:00-24:00 进行系统升级维护，期间部分功能可能暂时无法使用。',
    time: '2小时前',
    isRead: false,
  },
  {
    id: '2',
    type: 'announcement',
    title: '新功能上线',
    summary: 'AI 智能交易助手正式上线',
    content: 'AI 智能交易助手功能正式上线，为您提供实时市场分析和交易建议。',
    time: '5小时前',
    isRead: false,
  },
  {
    id: '3',
    type: 'activity',
    title: '邀请返佣活动',
    summary: '邀请好友各得 50 USDT',
    content: '邀请好友注册并完成首笔交易，双方各得 50 USDT 奖励。',
    time: '1天前',
    isRead: false,
  },
  {
    id: '4',
    type: 'system',
    title: '安全提醒',
    summary: '请定期修改密码',
    content: '建议您定期修改登录密码，并开启双重身份验证。',
    time: '2天前',
    isRead: true,
  },
]

const typeConfig: Record<NotificationType, { icon: typeof Bell; label: string }> = {
  system: { icon: Bell, label: '系统' },
  announcement: { icon: Megaphone, label: '公告' },
  activity: { icon: Calendar, label: '活动' },
}

const filterOptions = [
  { value: 'all', label: '全部' },
  { value: 'system', label: '系统' },
  { value: 'announcement', label: '公告' },
  { value: 'activity', label: '活动' },
] as const

interface MobileNotificationsPageProps {
  onBack?: () => void
}

export function MobileNotificationsPage({ onBack }: MobileNotificationsPageProps) {
  const [activeTab, setActiveTab] = useState<'all' | NotificationType>('all')
  const [notifications, setNotifications] = useState<Notification[]>(mockNotifications)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showFilter, setShowFilter] = useState(false)

  const filteredNotifications = activeTab === 'all'
    ? notifications
    : notifications.filter(n => n.type === activeTab)

  const unreadCount = notifications.filter(n => !n.isRead).length
  const currentFilter = filterOptions.find(f => f.value === activeTab)

  const handleMarkAllRead = () => {
    setNotifications(notifications.map(n => ({ ...n, isRead: true })))
  }

  const handleToggleExpand = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null)
    } else {
      setExpandedId(id)
      setNotifications(notifications.map(n =>
        n.id === id ? { ...n, isRead: true } : n
      ))
    }
  }

  const handleFilterSelect = (value: 'all' | NotificationType) => {
    setActiveTab(value)
    setShowFilter(false)
  }

  return (
    <div className="min-h-screen bg-[#0A0A0F] pb-6">
      {/* 顶部导航 */}
      <div className="sticky top-0 z-50 bg-[#0A0A0F]/95 backdrop-blur-xl border-b border-[#1E1E2E]">
        <div className="flex items-center justify-between px-4 h-14">
          <button
            type="button"
            onClick={onBack}
            className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-[#12121A] transition-colors"
            aria-label="返回"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-medium text-white">通知</h1>
            {unreadCount > 0 && (
              <span className="min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[10px] font-medium text-white bg-red-500 rounded-full">
                {unreadCount}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={handleMarkAllRead}
            disabled={unreadCount === 0}
            className="w-10 h-10 flex items-center justify-center text-cyan-400 disabled:opacity-50"
            aria-label="全部已读"
          >
            <CheckCheck className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-3">
        {/* 筛选下拉 */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowFilter(!showFilter)}
            className="glass-border-glow relative w-full bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-xl overflow-hidden px-4 py-3 flex items-center justify-between"
          >            <div className="flex items-center gap-2">
              <span className="text-sm text-[#94A3B8]">筛选</span>
              <span className="text-sm font-medium text-white">{currentFilter?.label}</span>
              <span className="text-xs text-[#94A3B8]">({filteredNotifications.length})</span>
            </div>
            <ChevronDown className={`w-4 h-4 text-[#94A3B8] transition-transform ${showFilter ? 'rotate-180' : ''}`} />
          </button>

          {showFilter && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-[#1A1A24] border border-[#1E1E2E] rounded-xl overflow-hidden shadow-xl z-30">
              {filterOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleFilterSelect(option.value as 'all' | NotificationType)}
                  className={`w-full px-4 py-3 text-left text-sm transition-colors ${
                    activeTab === option.value
                      ? 'bg-cyan-500/10 text-cyan-400'
                      : 'text-white hover:bg-[#12121A]'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 通知列表 */}
        {filteredNotifications.length === 0 ? (
          <div className="glass-border-glow relative flex flex-col items-center justify-center py-12 bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl overflow-hidden">
            <AlertCircle className="w-10 h-10 text-[#94A3B8] mb-3" />
            <p className="text-[#94A3B8] text-sm">暂无通知</p>
          </div>
        ) : (
          <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden">
            <div className="divide-y divide-[#1E1E2E]/50">
              {filteredNotifications.map((notification) => {
                const config = typeConfig[notification.type]
                const Icon = config.icon
                const isExpanded = expandedId === notification.id

                return (
                  <div
                    key={notification.id}
                    onClick={() => handleToggleExpand(notification.id)}
                    className="p-4 cursor-pointer active:bg-[#1A1A24]/50 transition-colors"
                  >
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-9 h-9 bg-cyan-500/10 rounded-xl flex items-center justify-center">
                        <Icon className="w-4 h-4 text-cyan-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-sm font-medium text-white truncate">{notification.title}</h3>
                          {!notification.isRead && (
                            <span className="w-1.5 h-1.5 bg-red-500 rounded-full flex-shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-[#94A3B8] line-clamp-1">{notification.summary}</p>
                        {isExpanded && (
                          <p className="text-xs text-[#94A3B8] mt-2 leading-relaxed">{notification.content}</p>
                        )}
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-[11px] text-[#606070]">{notification.time}</span>
                          <ChevronDown className={`w-3.5 h-3.5 text-[#94A3B8] transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
