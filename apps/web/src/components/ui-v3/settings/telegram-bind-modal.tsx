'use client'

import { useState, useEffect } from 'react'
import { X, Copy, Check, Send, ExternalLink, Loader2 } from 'lucide-react'
import { useTranslations } from '@/i18n/provider'

interface TelegramBindModalProps {
  isOpen: boolean
  onClose: () => void
  bindCode: string | null
  expiresAt: Date | null
  isLoading: boolean
  onGenerateCode: () => Promise<unknown>
  botUsername?: string
}

export function TelegramBindModal({
  isOpen,
  onClose,
  bindCode,
  expiresAt,
  isLoading,
  onGenerateCode,
  botUsername = 'HootQuantBot',
}: TelegramBindModalProps) {
  const t = useTranslations('settings')
  const [copied, setCopied] = useState(false)
  const [countdown, setCountdown] = useState(0)

  // 计算剩余时间
  useEffect(() => {
    if (!expiresAt) {
      queueMicrotask(() => setCountdown(0))
      return
    }

    const updateCountdown = () => {
      const now = new Date()
      const diff = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000))
      setCountdown(diff)
    }

    updateCountdown()
    const interval = setInterval(updateCountdown, 1000)
    return () => clearInterval(interval)
  }, [expiresAt])

  // 初次打开时生成绑定码
  useEffect(() => {
    if (isOpen && !bindCode && !isLoading) {
      queueMicrotask(() => {
        void onGenerateCode()
      })
    }
  }, [isOpen, bindCode, isLoading, onGenerateCode])

  // 复制绑定码
  const handleCopy = async () => {
    if (!bindCode) return
    try {
      await navigator.clipboard.writeText(bindCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // 复制失败
    }
  }

  // 打开 TG Bot
  const handleOpenBot = () => {
    window.open(`https://t.me/${botUsername}`, '_blank')
  }

  if (!isOpen) return null

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const isExpired = countdown === 0 && bindCode

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-sm bg-[#12121A] border border-[#1E1E2E] rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1E1E2E]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#0088cc]/20 flex items-center justify-center">
              <Send className="w-5 h-5 text-[#0088cc]" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">{t('bindTelegram')}</h3>
              <p className="text-xs text-[#9090A0]">@{botUsername}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-[#1E1E2E] rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-[#9090A0]" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <Loader2 className="w-8 h-8 text-[#0088cc] animate-spin" />
              <p className="text-sm text-[#9090A0]">{t('generatingCode')}</p>
            </div>
          ) : (
            <>
              {/* 步骤说明 */}
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-[#0088cc]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-[#0088cc]">1</span>
                  </div>
                  <p className="text-sm text-[#F8F8FC]">{t('bindStep1')}</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-[#0088cc]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-[#0088cc]">2</span>
                  </div>
                  <p className="text-sm text-[#F8F8FC]">{t('bindStep2')}</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-[#0088cc]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-[#0088cc]">3</span>
                  </div>
                  <p className="text-sm text-[#F8F8FC]">{t('bindStep3')}</p>
                </div>
              </div>

              {/* 绑定码 */}
              <div className="relative">
                <div className={`p-4 rounded-xl border ${isExpired ? 'bg-[#EF4444]/10 border-[#EF4444]/30' : 'bg-[#0088cc]/10 border-[#0088cc]/30'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-[#9090A0]">{t('bindCode')}</span>
                    {!isExpired && countdown > 0 && (
                      <span className="text-xs text-[#9090A0]">
                        {t('expiresIn')} {formatTime(countdown)}
                      </span>
                    )}
                    {isExpired && (
                      <span className="text-xs text-[#EF4444]">{t('expired')}</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <code className={`text-2xl font-mono font-bold tracking-widest ${isExpired ? 'text-[#EF4444]/50' : 'text-white'}`}>
                      {isExpired ? '------' : bindCode || '------'}
                    </code>
                    {!isExpired && bindCode && (
                      <button
                        type="button"
                        onClick={handleCopy}
                        className="p-2 hover:bg-[#1E1E2E] rounded-lg transition-colors"
                      >
                        {copied ? (
                          <Check className="w-5 h-5 text-[#22C55E]" />
                        ) : (
                          <Copy className="w-5 h-5 text-[#9090A0]" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* 操作按钮 */}
              <div className="flex gap-3">
                {isExpired ? (
                  <button
                    type="button"
                    onClick={onGenerateCode}
                    disabled={isLoading}
                    className="flex-1 py-3 bg-[#0088cc] hover:bg-[#0099dd] text-white rounded-xl transition-colors font-medium"
                  >
                    {t('regenerateCode')}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleOpenBot}
                    className="flex-1 py-3 bg-[#0088cc] hover:bg-[#0099dd] text-white rounded-xl transition-colors font-medium flex items-center justify-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    {t('openBot')}
                    <ExternalLink className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* 提示 */}
              <p className="text-xs text-center text-[#606070]">
                {t('bindTip')}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
