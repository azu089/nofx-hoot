'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { X, Download, Share } from 'lucide-react'

// 扩展 window 上的 beforeinstallprompt 事件
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001/api'

// 模块级标记，防止 React 严格模式 / Fast Refresh 导致重复触发
let promptShownInSession = false

export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showPrompt, setShowPrompt] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)
  const initRef = useRef(false)

  // 检查后端开关
  const checkEnabled = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/config/pwa`)
      if (!res.ok) return false // API 返回非 200 时不显示
      const json = await res.json()
      return json.data?.enabled ?? json.enabled ?? false
    } catch {
      return false // 网络错误时不显示
    }
  }, [])

  useEffect(() => {
    // 防止重复初始化（严格模式 / Fast Refresh）
    if (initRef.current) return
    initRef.current = true

    // 本次会话已经显示过，不再弹出
    if (promptShownInSession) return

    // 已安装（独立窗口运行）则不显示
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || (navigator as unknown as { standalone?: boolean }).standalone === true
    setIsStandalone(standalone)
    if (standalone) return

    // 检测 iOS
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as unknown as { MSStream?: unknown }).MSStream
    setIsIOS(ios)

    // 检查是否已被用户关闭过（24 小时内不再显示）
    const dismissed = localStorage.getItem('pwa_prompt_dismissed')
    if (dismissed) {
      const dismissedTime = parseInt(dismissed, 10)
      if (Date.now() - dismissedTime < 24 * 60 * 60 * 1000) return
    }

    // 监听 beforeinstallprompt 事件（Android Chrome）
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      // 检查后端开关再显示
      checkEnabled().then((enabled) => {
        if (enabled && !promptShownInSession) {
          promptShownInSession = true
          setShowPrompt(true)
        }
      })
    }
    window.addEventListener('beforeinstallprompt', handler)

    // iOS 延迟显示提示
    if (ios) {
      const timer = setTimeout(() => {
        checkEnabled().then((enabled) => {
          if (enabled && !promptShownInSession) {
            promptShownInSession = true
            setShowPrompt(true)
          }
        })
      }, 3000)
      return () => {
        clearTimeout(timer)
        window.removeEventListener('beforeinstallprompt', handler)
      }
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
    }
  }, [checkEnabled])

  // 安装应用（Android）
  const handleInstall = async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setShowPrompt(false)
    }
    setDeferredPrompt(null)
  }

  // 关闭提示
  const handleDismiss = () => {
    setShowPrompt(false)
    localStorage.setItem('pwa_prompt_dismissed', Date.now().toString())
  }

  // 已安装或不显示
  if (isStandalone || !showPrompt) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[9999] safe-area-bottom">
      <div className="mx-3 mb-3 bg-[#1A1A24] border border-cyan-500/20 rounded-2xl shadow-[0_-4px_24px_rgba(0,0,0,0.6)] p-4">
        <div className="flex items-start gap-3">
          {/* 图标 */}
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center shrink-0">
            <Download className="w-6 h-6 text-white" />
          </div>

          {/* 文案 */}
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-white mb-1">安装 HOOT 应用</h3>
            <p className="text-xs text-[#9090A0] leading-relaxed">
              {isIOS
                ? '点击下方 Safari 分享按钮，选择「添加到主屏幕」'
                : '将 HOOT 添加到桌面，获得更好的交易体验'
              }
            </p>
          </div>

          {/* 关闭按钮 */}
          <button
            type="button"
            onClick={handleDismiss}
            className="p-1 -mr-1 -mt-1"
          >
            <X className="w-4 h-4 text-[#9090A0]" />
          </button>
        </div>

        {/* 操作按钮 */}
        <div className="mt-3 flex gap-2">
          {isIOS ? (
            <button
              type="button"
              onClick={handleDismiss}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-cyan-500 text-black text-sm font-medium"
            >
              <Share className="w-4 h-4" />
              我知道了
            </button>
          ) : (
            <button
              type="button"
              onClick={handleInstall}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-cyan-500 text-black text-sm font-medium active:scale-95 transition-transform"
            >
              <Download className="w-4 h-4" />
              立即安装
            </button>
          )}
          <button
            type="button"
            onClick={handleDismiss}
            className="px-4 py-2.5 rounded-lg bg-[#1E1E2E] text-[#9090A0] text-sm"
          >
            稍后
          </button>
        </div>
      </div>
    </div>
  )
}
