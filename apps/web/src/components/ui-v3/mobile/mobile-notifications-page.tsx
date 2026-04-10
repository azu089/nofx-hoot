'use client'

import { useState, useMemo } from 'react'
import { ArrowLeft, Bell, Megaphone, Calendar, AlertCircle, CheckCheck, ChevronDown } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'

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

interface MobileNotificationsPageProps {
  onBack?: () => void
}

export function MobileNotificationsPage({ onBack }: MobileNotificationsPageProps) {
  const t = useTranslations('profile')
  const tCommon = useTranslations('common')
  const { isAuthenticated } = useAuth()
  const queryClient = useQueryClient()

  const typeConfig: Record<NotificationType, { icon: typeof Bell; label: string }> = {
    system: { icon: Bell, label: t('system') },
    announcement: { icon: Megaphone, label: t('announcement') },
    activity: { icon: Calendar, label: t('activity') },
  }

  const filterOptions = [
    { value: 'all', label: tCommon('all') },
    { value: 'system', label: t('system') },
    { value: 'announcement', label: t('announcement') },
    { value: 'activity', label: t('activity') },
  ] as const

  const [activeTab, setActiveTab] = useState<'all' | NotificationType>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showFilter, setShowFilter] = useState(false)

  // 获取通知列表
  const { data: notificationsData } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const response = await api.get<{
        items: Array<{
          id: string
          type: string
          title: string
          content: string
          read: boolean
          createdAt: string
        }>
        total: number
      }>('/notifications')
      return response.data
    },
    enabled: isAuthenticated,
  })

  // 转换通知数据格式
  const notifications = useMemo<Notification[]>(() => {
    if (!notificationsData?.items) return []
    return notificationsData.items.map(n => {
      // 计算相对时间
      const createdAt = new Date(n.createdAt)
      const now = new Date()
      const diffMs = now.getTime() - createdAt.getTime()
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
      const diffDays = Math.floor(diffHours / 24)

      let timeStr: string
      if (diffDays > 0) {
        timeStr = `${diffDays}天前`
      } else if (diffHours > 0) {
        timeStr = `${diffHours}小时前`
      } else {
        timeStr = '刚刚'
      }

      return {
        id: n.id,
        type: (n.type || 'system') as NotificationType,
        title: n.title,
        summary: (n.content || '').substring(0, 30) + ((n.content || '').length > 30 ? '...' : ''),
        content: n.content || '',
        time: timeStr,
        isRead: n.read,
      }
    })
  }, [notificationsData])

  const filteredNotifications = activeTab === 'all'
    ? notifications
    : notifications.filter(n => n.type === activeTab)

  const unreadCount = notifications.filter(n => !n.isRead).length
  const currentFilter = filterOptions.find(f => f.value === activeTab)

  // 标记所有已读
  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      await api.post('/notifications/read-all', {})
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  const handleMarkAllRead = () => {
    markAllReadMutation.mutate()
  }

  // 标记单条已读
  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/notifications/${id}/read`, {})
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  const handleToggleExpand = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null)
    } else {
      setExpandedId(id)
      // 标记为已读
      const notification = notifications.find(n => n.id === id)
      if (notification && !notification.isRead) {
        markReadMutation.mutate(id)
      }
    }
  }

  const handleFilterSelect = (value: 'all' | NotificationType) => {
    setActiveTab(value)
    setShowFilter(false)
  }

  return (
    <div className="min-h-screen pb-6">
      {/* 顶部导航 */}
      <div className="sticky top-0 z-50 bg-[#05070A]/60 backdrop-blur-xl [transform:translateZ(0)] border-b border-white/5">
        <div className="flex items-center justify-between px-4 h-14">
          <button
            type="button"
            onClick={onBack}
            className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-[#0B1520] transition-colors"
            aria-label={tCommon('back')}
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold text-white">{t('notifications')}</h1>
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
            className="w-10 h-10 flex items-center justify-center text-emerald-400 disabled:opacity-50"
            aria-label={t('markAllRead')}
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
            className="bubble-card relative w-full rounded-xl overflow-hidden px-4 py-3 flex items-center justify-between"
          >            <div className="flex items-center gap-2">
              <span className="text-sm text-[#94A3B8]">{t('filter')}</span>
              <span className="text-sm font-medium text-white">{currentFilter?.label}</span>
              <span className="text-xs text-[#94A3B8]">({filteredNotifications.length})</span>
            </div>
            <ChevronDown className={`w-4 h-4 text-[#94A3B8] transition-transform ${showFilter ? 'rotate-180' : ''}`} />
          </button>

          {showFilter && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white/5 border border-white/10 rounded-xl overflow-hidden shadow-xl z-30">
              {filterOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleFilterSelect(option.value as 'all' | NotificationType)}
                  className={`w-full px-4 py-3 text-left text-sm transition-colors ${
                    activeTab === option.value
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : 'text-white hover:bg-[#0B1520]'
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
          <div className="bubble-card relative flex flex-col items-center justify-center py-12 rounded-2xl overflow-hidden">
            <AlertCircle className="w-10 h-10 text-[#94A3B8] mb-3" />
            <p className="text-[#94A3B8] text-sm">{t('noNotifications')}</p>
          </div>
        ) : (
          <div className="bubble-card relative rounded-2xl overflow-hidden">
            <div className="divide-y divide-white/10/50">
              {filteredNotifications.map((notification) => {
                const config = typeConfig[notification.type] || typeConfig.system
                const Icon = config.icon
                const isExpanded = expandedId === notification.id

                return (
                  <div
                    key={notification.id}
                    onClick={() => handleToggleExpand(notification.id)}
                    className="p-4 cursor-pointer active:bg-white/5/50 transition-colors"
                  >
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-9 h-9 bg-emerald-500/10 rounded-xl flex items-center justify-center">
                        <Icon className="w-4 h-4 text-emerald-400" />
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
