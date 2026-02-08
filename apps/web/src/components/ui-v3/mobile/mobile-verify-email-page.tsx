'use client'

import React, { useState, useRef, useEffect, KeyboardEvent, ClipboardEvent } from 'react'
import Image from 'next/image'
import { ArrowLeft, CheckCircle2 } from 'lucide-react'

interface VerifyEmailPageProps {
  email: string
  onVerify?: (code: string) => Promise<void>
  onResend?: () => Promise<void>
  onBack?: () => void
  onSuccess?: () => void
}

export function MobileVerifyEmailPage({
  email,
  onVerify,
  onResend,
  onBack,
  onSuccess,
}: VerifyEmailPageProps) {
  const [code, setCode] = useState<string[]>(Array(6).fill(''))
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [error, setError] = useState('')
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  // 倒计时逻辑
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [countdown])

  // 自动聚焦第一个输入框
  useEffect(() => {
    inputRefs.current[0]?.focus()
  }, [])

  // 处理输入
  const handleChange = (index: number, value: string) => {
    // 只允许数字
    if (value && !/^\d+$/.test(value)) return

    const newCode = [...code]
    newCode[index] = value.slice(-1) // 只取最后一个字符

    setCode(newCode)
    setError('')

    // 自动跳转到下一个输入框
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }

    // 自动提交
    if (index === 5 && value) {
      const fullCode = newCode.join('')
      if (fullCode.length === 6) {
        handleVerify(fullCode)
      }
    }
  }

  // 处理粘贴
  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData('text').trim()

    // 只允许6位数字
    if (/^\d{6}$/.test(pastedData)) {
      const newCode = pastedData.split('')
      setCode(newCode)
      setError('')
      inputRefs.current[5]?.focus()

      // 自动提交
      handleVerify(pastedData)
    }
  }

  // 处理键盘事件
  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      // 删除前一个输入框的内容并聚焦
      const newCode = [...code]
      newCode[index - 1] = ''
      setCode(newCode)
      inputRefs.current[index - 1]?.focus()
    }
  }

  // 验证
  const handleVerify = async (fullCode?: string) => {
    const verifyCode = fullCode || code.join('')

    if (verifyCode.length !== 6) {
      setError('请输入完整的验证码')
      return
    }

    if (!onVerify) return

    setIsLoading(true)
    setError('')

    try {
      await onVerify(verifyCode)
      setIsSuccess(true)

      // 1.5秒后调用成功回调
      setTimeout(() => {
        onSuccess?.()
      }, 1500)
    } catch (err: any) {
      setError(err.message || '验证失败，请重试')
      setCode(Array(6).fill(''))
      inputRefs.current[0]?.focus()
    } finally {
      setIsLoading(false)
    }
  }

  // 重新发送
  const handleResend = async () => {
    if (countdown > 0 || !onResend) return

    try {
      await onResend()
      setCountdown(60)
      setCode(Array(6).fill(''))
      setError('')
      inputRefs.current[0]?.focus()
    } catch (err: any) {
      setError(err.message || '发送失败，请重试')
    }
  }

  return (
    <div className="min-h-screen w-full bg-[#0A0A0F] flex items-center justify-center p-4 relative overflow-hidden">
      {/* 背景装饰 - 与登录页同步的动态光晕效果 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -right-32 w-80 h-80 bg-[#06B6D4] rounded-full mix-blend-multiply filter blur-[100px] opacity-20 animate-pulse" />
        <div
          className="absolute -bottom-32 -left-32 w-80 h-80 bg-[#06B6D4] rounded-full mix-blend-multiply filter blur-[100px] opacity-20 animate-pulse"
          style={{ animationDelay: '1s' }}
        />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#06B6D4] rounded-full mix-blend-multiply filter blur-[150px] opacity-5" />
      </div>

      {/* 毛玻璃验证卡片 */}
      <div className="w-full max-w-md glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl p-8 shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.02)_inset] overflow-hidden z-10">
        {/* 成功状态覆盖层 */}
        {isSuccess && (
          <div className="absolute inset-0 bg-[#0A0A0F]/90 backdrop-blur-sm flex flex-col items-center justify-center z-50 rounded-2xl">
            <div className="animate-scale-in">
              <CheckCircle2 className="w-20 h-20 text-[#22C55E] mb-4" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">验证成功</h2>
            <p className="text-[#94A3B8]">正在跳转...</p>
          </div>
        )}

        {/* 顶部返回按钮 + 标题 */}
        <div className="flex items-center mb-8">
          <button
            type="button"
            onClick={onBack}
            title="返回"
            aria-label="返回"
            className="mr-3 p-2 -ml-2 text-[#94A3B8] hover:text-white transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-semibold text-white">验证邮箱</h1>
        </div>

        {/* Logo 区域 */}
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20">
            <Image
              src="/icons/hoot/logo.png?v=2"
              alt="HOOT"
              width={80}
              height={80}
              className="w-full h-full object-contain drop-shadow-[0_0_20px_rgba(6,182,212,0.3)]"
              priority
              unoptimized
            />
          </div>
        </div>

        {/* 提示文字 */}
        <div className="text-center mb-8">
          <p className="text-[#94A3B8] text-sm leading-relaxed">
            我们已向{' '}
            <span className="text-white font-medium">{email}</span>{' '}
            发送了验证码
          </p>
        </div>

        {/* 6位验证码输入框 */}
        <div className="flex justify-center gap-2 mb-6">
          {code.map((digit, index) => (
            <input
              key={index}
              ref={(el: HTMLInputElement | null) => { inputRefs.current[index] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onPaste={handlePaste}
              aria-label={`验证码第 ${index + 1} 位`}
              className="w-12 h-14 text-center text-2xl font-bold bg-[#1A1A24] border border-cyan-500/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-[#06B6D4] focus:border-transparent transition-all"
              disabled={isLoading || isSuccess}
            />
          ))}
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="mb-4 text-center">
            <p className="text-sm text-[#EF4444]">{error}</p>
          </div>
        )}

        {/* 验证按钮 */}
        <button
          type="button"
          onClick={() => handleVerify()}
          disabled={isLoading || isSuccess || code.join('').length !== 6}
          title="验证"
          aria-label="验证"
          className="w-full bg-gradient-to-r from-[#06B6D4] to-[#0891B2] text-[#0A0A0F] font-semibold py-3.5 rounded-xl hover:shadow-lg hover:shadow-[#06B6D4]/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed mb-6"
        >
          {isLoading ? '验证中...' : '验证'}
        </button>

        {/* 重新发送链接 + 倒计时 */}
        <div className="text-center mb-6">
          {countdown > 0 ? (
            <p className="text-sm text-[#94A3B8]">
              {countdown} 秒后可重新发送
            </p>
          ) : (
            <button
              type="button"
              onClick={handleResend}
              title="重新发送验证码"
              aria-label="重新发送验证码"
              className="text-sm text-[#06B6D4] hover:text-[#0891B2] font-medium transition-colors"
            >
              重新发送验证码
            </button>
          )}
        </div>

        {/* 底部提示 */}
        <div className="text-center">
          <p className="text-xs text-[#64748B]">
            验证码将在 10 分钟内有效
          </p>
        </div>
      </div>

      {/* 成功动画样式 */}
      <style>{`
        @keyframes scale-in {
          0% {
            transform: scale(0);
            opacity: 0;
          }
          50% {
            transform: scale(1.1);
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }

        .animate-scale-in {
          animation: scale-in 0.5s ease-out;
        }
      `}</style>
    </div>
  )
}
