'use client'

import { useState } from 'react'
import {
  Bell,
  Megaphone,
  Calendar,
  Check,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  AlertCircle
} from 'lucide-react'

interface Notification {
  id: string
  type: 'system' | 'announcement' | 'event'
  title: string
  description: string
  fullContent: string
  timestamp: Date
  isRead: boolean
}

interface NotificationsPageProps {
  notifications?: Notification[]
  onNavigate?: (path: string) => void
  onMarkAsRead?: (id: string) => void
  onMarkAllAsRead?: () => void
}

const defaultNotifications: Notification[] = [
  {
    id: '1',
    type: 'announcement',
    title: '新交易对上线',
    description: '我们新增了 5 个加密货币交易对，包括 SOL/USDT 和 AVAX/USDT。',
    fullContent: '我们很高兴地宣布平台新增了 5 个加密货币交易对：SOL/USDT、AVAX/USDT、MATIC/USDT、DOT/USDT 和 LINK/USDT。这些交易对现已开放现货交易，具有竞争力的费率和深度流动性。立即开始交易这些热门山寨币，让您的投资组合更加多元化。',
    timestamp: new Date('2026-01-29T10:30:00'),
    isRead: false
  },
  {
    id: '2',
    type: 'system',
    title: '系统维护完成',
    description: '我们的计划维护已成功完成。所有系统现已恢复正常运行。',
    fullContent: '我们已成功完成从 UTC 02:00 开始的计划维护。在此期间，我们升级了交易引擎基础设施以提高性能和可靠性。所有交易对现已完全恢复运行，您可能会注意到更快的订单执行速度和更好的系统响应能力。感谢您在维护期间的耐心等待。',
    timestamp: new Date('2026-01-28T15:45:00'),
    isRead: false
  },
  {
    id: '3',
    type: 'event',
    title: '比特币减半事件即将到来',
    description: '下一次比特币减半预计在大约 45 天后发生。请准备好应对潜在的市场波动。',
    fullContent: '比特币网络即将迎来下一次减半事件，预计在大约 45 天后发生。历史上，比特币减半一直是重要的市场事件，可能导致波动性增加和长期价格升值。我们建议您审查您的交易策略和风险管理方法。我们的研究团队已在教育区准备了一份全面的减半指南。',
    timestamp: new Date('2026-01-27T09:15:00'),
    isRead: true
  },
  {
    id: '4',
    type: 'system',
    title: '安全功能增强',
    description: '新的双重身份验证选项和提现确认功能现已可用。',
    fullContent: '我们已增强安全基础设施，添加了新功能以更好地保护您的账户。您现在可以启用其他 2FA 方法，包括硬件密钥和生物识别认证。我们还为大额交易实施了增强的提现确认流程，需要电子邮件和短信验证。请访问您的安全设置以启用这些新功能并加强您的账户保护。',
    timestamp: new Date('2026-01-26T14:20:00'),
    isRead: true
  },
  {
    id: '5',
    type: 'announcement',
    title: '移动应用更新 v2.1.0',
    description: '我们最新的移动应用更新包括改进的图表工具和更快的交易执行。',
    fullContent: 'Hoot 移动应用 v2.1.0 现已在 iOS 和 Android 平台上可供下载。此更新包括对我们图表界面的重大改进，新增了技术指标、增强的价格提醒功能，以及 50% 更快的交易执行速度。我们还添加了深色模式自定义选项并改进了整体用户体验。立即更新您的应用以访问这些新功能。',
    timestamp: new Date('2026-01-25T11:00:00'),
    isRead: true
  }
]

type FilterType = 'all' | 'system' | 'announcement' | 'event'

export function NotificationsPage({
  notifications = defaultNotifications,
  onNavigate,
  onMarkAsRead,
  onMarkAllAsRead
}: NotificationsPageProps) {
  const [notificationList, setNotificationList] = useState<Notification[]>(notifications)
  const [activeFilter, setActiveFilter] = useState<FilterType>('all')
  const [expandedNotifications, setExpandedNotifications] = useState<Set<string>>(new Set())

  const unreadCount = notificationList.filter(n => !n.isRead).length

  const filteredNotifications = notificationList.filter(notification => {
    if (activeFilter === 'all') return true
    return notification.type === activeFilter
  })

  const getIcon = (type: Notification['type']) => {
    switch (type) {
      case 'announcement':
        return <Megaphone className="w-5 h-5 text-[#06B6D4]" />
      case 'system':
        return <Bell className="w-5 h-5 text-[#06B6D4]" />
      case 'event':
        return <Calendar className="w-5 h-5 text-[#06B6D4]" />
    }
  }

  const getTypeLabel = (type: Notification['type']) => {
    switch (type) {
      case 'announcement':
        return '公告'
      case 'system':
        return '系统'
      case 'event':
        return '活动'
    }
  }

  const formatTimestamp = (date: Date) => {
    const now = new Date()
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))

    if (diffInHours < 1) return '刚刚'
    if (diffInHours < 24) return `${diffInHours} 小时前`
    if (diffInHours < 48) return '昨天'
    return date.toLocaleDateString('zh-CN')
  }

  const toggleExpanded = (notificationId: string) => {
    const newExpanded = new Set(expandedNotifications)
    if (newExpanded.has(notificationId)) {
      newExpanded.delete(notificationId)
    } else {
      newExpanded.add(notificationId)
    }
    setExpandedNotifications(newExpanded)

    // 展开时标记为已读
    setNotificationList(prev =>
      prev.map(n =>
        n.id === notificationId ? { ...n, isRead: true } : n
      )
    )
    onMarkAsRead?.(notificationId)
  }

  const handleMarkAllAsRead = () => {
    setNotificationList(prev =>
      prev.map(n => ({ ...n, isRead: true }))
    )
    onMarkAllAsRead?.()
  }

  const filterTabs = [
    { key: 'all' as FilterType, label: '全部', count: notificationList.length },
    { key: 'system' as FilterType, label: '系统', count: notificationList.filter(n => n.type === 'system').length },
    { key: 'announcement' as FilterType, label: '公告', count: notificationList.filter(n => n.type === 'announcement').length },
    { key: 'event' as FilterType, label: '活动', count: notificationList.filter(n => n.type === 'event').length }
  ]

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-[#F8F8FC]">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#0A0A0F]/95 backdrop-blur-xl border-b border-[#1E1E2E]">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => onNavigate?.('/profile')}
                className="p-2 hover:bg-[#12121A] rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-[#9090A0]" />
              </button>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold">通知公告</h1>
                {unreadCount > 0 && (
                  <span className="bg-[#06B6D4] text-[#0A0A0F] text-sm font-semibold px-2.5 py-0.5 rounded-full min-w-[24px] text-center">
                    {unreadCount}
                  </span>
                )}
              </div>
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllAsRead}
                className="flex items-center gap-2 px-4 py-2 bg-[#12121A]/80 hover:bg-[#1E1E2E] border border-[#1E1E2E] rounded-xl transition-colors text-sm"
              >
                <Check className="w-4 h-4" />
                全部已读
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6 bg-[#12121A]/50 p-1.5 rounded-xl border border-[#1E1E2E] overflow-x-auto">
          {filterTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveFilter(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg transition-all whitespace-nowrap ${
                activeFilter === tab.key
                  ? 'bg-[#06B6D4]/20 text-[#06B6D4] border border-[#06B6D4]/30'
                  : 'text-[#9090A0] hover:text-[#F8F8FC] hover:bg-[#1E1E2E]/50'
              }`}
            >
              <span className="font-medium">{tab.label}</span>
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                activeFilter === tab.key
                  ? 'bg-[#06B6D4]/30 text-[#06B6D4]'
                  : 'bg-[#1E1E2E] text-[#606070]'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Notifications List */}
        <div className="space-y-3">
          {filteredNotifications.length === 0 ? (
            <div className="text-center py-16">
              <AlertCircle className="w-12 h-12 mx-auto mb-4 text-[#606070]" />
              <p className="text-[#9090A0]">暂无通知</p>
            </div>
          ) : (
            filteredNotifications.map((notification) => {
              const isExpanded = expandedNotifications.has(notification.id)
              return (
                <button
                  key={notification.id}
                  type="button"
                  className="w-full bg-[#12121A]/80 backdrop-blur-xl border border-[#1E1E2E] rounded-2xl overflow-hidden hover:border-[#2A2A3A] transition-all text-left"
                  onClick={() => toggleExpanded(notification.id)}
                >
                  <div className="p-5">
                    <div className="flex items-start gap-4">
                      {/* Icon */}
                      <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-[#06B6D4]/10 flex items-center justify-center">
                        {getIcon(notification.type)}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4 mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs px-2 py-0.5 rounded-full bg-[#1E1E2E] text-[#9090A0]">
                                {getTypeLabel(notification.type)}
                              </span>
                              {!notification.isRead && (
                                <div className="w-2 h-2 bg-[#06B6D4] rounded-full" />
                              )}
                            </div>
                            <h3 className={`font-semibold ${!notification.isRead ? 'text-[#F8F8FC]' : 'text-[#9090A0]'}`}>
                              {notification.title}
                            </h3>
                          </div>

                          <div className="flex items-center gap-3 flex-shrink-0">
                            <span className="text-xs text-[#606070]">
                              {formatTimestamp(notification.timestamp)}
                            </span>
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 text-[#06B6D4]" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-[#606070]" />
                            )}
                          </div>
                        </div>

                        <p className="text-sm text-[#9090A0] leading-relaxed">
                          {isExpanded ? notification.fullContent : notification.description}
                        </p>
                      </div>
                    </div>
                  </div>
                </button>
              )
            })
          )}
        </div>

        {/* Bottom Spacer */}
        <div className="h-20 md:h-0" />
      </div>
    </div>
  )
}
