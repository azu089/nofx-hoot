'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // 记录错误到控制台，便于调试
    console.error('[全局错误边界]', error)
  }, [error])

  // 截断错误信息到 200 字符
  const errorMessage = error.message
    ? error.message.slice(0, 200)
    : '未知错误，请稍后重试'

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-16"
      style={{ backgroundColor: '#0A0A0F' }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-8 flex flex-col items-center text-center"
        style={{
          backgroundColor: '#12121A',
          border: '1px solid #2A2A3A',
        }}
      >
        {/* 错误图标 */}
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mb-6"
          style={{ backgroundColor: 'rgba(239, 68, 68, 0.12)' }}
        >
          <AlertTriangle
            size={32}
            style={{ color: '#EF4444' }}
            aria-hidden="true"
          />
        </div>

        {/* 标题 */}
        <h1
          className="text-2xl font-bold mb-2"
          style={{ color: '#F8F8FC' }}
        >
          出现了一些问题
        </h1>

        {/* 副标题 / 错误信息 */}
        <p
          className="text-sm mb-2 leading-relaxed"
          style={{ color: '#9090A0' }}
        >
          应用遇到了意外错误，您可以尝试重试或返回首页。
        </p>

        {/* 错误详情 */}
        {errorMessage && (
          <div
            className="w-full rounded-lg px-4 py-3 mb-8 text-left"
            style={{ backgroundColor: 'rgba(239, 68, 68, 0.06)', border: '1px solid rgba(239, 68, 68, 0.2)' }}
          >
            <p
              className="text-xs font-mono break-words"
              style={{ color: '#EF4444' }}
            >
              {errorMessage}
            </p>
            {error.digest && (
              <p
                className="text-xs mt-1"
                style={{ color: '#9090A0' }}
              >
                错误代码: {error.digest}
              </p>
            )}
          </div>
        )}

        {/* 按钮区域 */}
        <div className="flex flex-col sm:flex-row gap-3 w-full">
          {/* 重试按钮 */}
          <button
            onClick={reset}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition-all duration-200 hover:opacity-90 active:scale-95"
            style={{
              backgroundColor: '#06B6D4',
              color: '#0A0A0F',
            }}
          >
            <RefreshCw size={16} aria-hidden="true" />
            重试
          </button>

          {/* 返回首页按钮 */}
          <Link
            href="/"
            className="flex-1 flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition-all duration-200 hover:opacity-80 active:scale-95"
            style={{
              backgroundColor: 'transparent',
              color: '#F8F8FC',
              border: '1px solid #2A2A3A',
            }}
          >
            <Home size={16} aria-hidden="true" />
            返回首页
          </Link>
        </div>
      </div>
    </div>
  )
}
