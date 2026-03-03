'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { Mail, ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react'

interface VerifyEmailPageProps {
  email: string
  onVerify?: (code: string) => Promise<void>
  onResend?: () => Promise<void>
  onBack?: () => void
  onSuccess?: () => void
}

export function VerifyEmailPage({
  email,
  onVerify,
  onResend,
  onBack,
  onSuccess
}: VerifyEmailPageProps) {
  const [code, setCode] = useState(['', '', '', '', '', ''])
  const [isVerifying, setIsVerifying] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState('')
  const [countdown, setCountdown] = useState(0)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  // 倒计时
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

  const handleInputChange = (index: number, value: string) => {
    // 只允许数字
    if (!/^\d*$/.test(value)) return

    const newCode = [...code]

    // 如果粘贴了多个字符
    if (value.length > 1) {
      const chars = value.split('').slice(0, 6 - index)
      chars.forEach((char, i) => {
        if (index + i < 6) {
          newCode[index + i] = char
        }
      })
      setCode(newCode)
      // 聚焦到最后填充的位置的下一个或最后一个
      const nextIndex = Math.min(index + chars.length, 5)
      inputRefs.current[nextIndex]?.focus()
      return
    }

    newCode[index] = value
    setCode(newCode)
    setError('')

    // 自动跳转到下一个输入框
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }

    // 如果全部填满，自动验证
    if (newCode.every(c => c) && newCode.join('').length === 6) {
      handleVerify(newCode.join(''))
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    // 退格键：删除当前字符或跳到上一个
    if (e.key === 'Backspace') {
      if (!code[index] && index > 0) {
        inputRefs.current[index - 1]?.focus()
      }
    }
    // 左箭头
    if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
    // 右箭头
    if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handleVerify = async (verificationCode: string) => {
    setIsVerifying(true)
    setError('')

    try {
      await onVerify?.(verificationCode)
      setIsSuccess(true)
      setTimeout(() => {
        onSuccess?.()
      }, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : '验证码错误，请重试')
      setCode(['', '', '', '', '', ''])
      inputRefs.current[0]?.focus()
    } finally {
      setIsVerifying(false)
    }
  }

  const handleResend = async () => {
    if (countdown > 0 || isResending) return

    setIsResending(true)
    setError('')

    try {
      await onResend?.()
      setCountdown(60)
    } catch (err) {
      setError(err instanceof Error ? err.message : '发送失败，请重试')
    } finally {
      setIsResending(false)
    }
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center p-4 relative overflow-hidden">
        {/* Background Effects */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-[#06B6D4] rounded-full mix-blend-multiply filter blur-[128px] opacity-20 animate-pulse" />
          <div
            className="absolute -bottom-40 -left-40 w-96 h-96 bg-[#06B6D4] rounded-full mix-blend-multiply filter blur-[128px] opacity-20 animate-pulse"
            style={{ animationDelay: '1s' }}
          />
        </div>

        <div className="relative text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-500/20 flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10 text-green-400" />
          </div>
          <h2 className="text-2xl font-bold text-[#F8F8FC] mb-2">验证成功</h2>
          <p className="text-[#9090A0]">正在跳转...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-[#06B6D4] rounded-full mix-blend-multiply filter blur-[128px] opacity-20 animate-pulse" />
        <div
          className="absolute -bottom-40 -left-40 w-96 h-96 bg-[#06B6D4] rounded-full mix-blend-multiply filter blur-[128px] opacity-20 animate-pulse"
          style={{ animationDelay: '1s' }}
        />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#06B6D4] rounded-full mix-blend-multiply filter blur-[200px] opacity-5" />
      </div>

      {/* Main Card */}
      <div className="relative w-full max-w-md">
        <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl p-8 shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.02)_inset] overflow-hidden">
          {/* Back Button */}
          {onBack && (
            <button
              onClick={onBack}
              className="absolute top-6 left-6 p-2 text-[#9090A0] hover:text-[#F8F8FC] transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}

          {/* Logo and Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 mb-4">
              <Image
                src="/icons/hoot/token.png"
                alt="HOOT"
                width={80}
                height={80}
                className="w-full h-full object-contain drop-shadow-[0_0_20px_rgba(6,182,212,0.3)]"
              />
            </div>
            <h1 className="text-2xl font-bold text-[#F8F8FC] mb-2">验证邮箱</h1>
            <p className="text-[#9090A0] text-sm">
              我们已向 <span className="text-cyan-400">{email}</span> 发送了验证码
            </p>
          </div>

          {/* Email Icon */}
          <div className="flex justify-center mb-8">
            <div className="w-16 h-16 rounded-full bg-cyan-500/10 flex items-center justify-center">
              <Mail className="w-8 h-8 text-cyan-400" />
            </div>
          </div>

          {/* Code Input */}
          <div className="flex justify-center gap-2 mb-6">
            {code.map((digit, index) => (
              <input
                key={index}
                ref={el => { inputRefs.current[index] = el }}
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={digit}
                onChange={e => handleInputChange(index, e.target.value)}
                onKeyDown={e => handleKeyDown(index, e)}
                disabled={isVerifying}
                className={`w-12 h-14 text-center text-2xl font-bold bg-[#1A1A24] border rounded-xl text-[#F8F8FC] focus:outline-none focus:ring-2 transition-all ${
                  error
                    ? 'border-red-500 focus:ring-red-500/50'
                    : 'border-cyan-500/20 focus:ring-cyan-500/50 focus:border-cyan-500/50'
                } disabled:opacity-50`}
              />
            ))}
          </div>

          {/* Error Message */}
          {error && (
            <p className="text-center text-sm text-red-400 mb-4">{error}</p>
          )}

          {/* Verify Button */}
          <button
            onClick={() => handleVerify(code.join(''))}
            disabled={code.some(c => !c) || isVerifying}
            className="w-full py-3.5 px-4 rounded-xl font-semibold text-black bg-gradient-to-r from-cyan-500 to-cyan-400 hover:from-cyan-400 hover:to-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 transform hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 shadow-lg shadow-cyan-500/25 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
            {isVerifying ? (
              <div className="flex items-center justify-center space-x-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>验证中...</span>
              </div>
            ) : (
              '验证'
            )}
          </button>

          {/* Resend */}
          <div className="mt-6 text-center">
            <p className="text-sm text-[#9090A0]">
              没有收到验证码？{' '}
              <button
                onClick={handleResend}
                disabled={countdown > 0 || isResending}
                className="font-semibold text-cyan-400 hover:text-cyan-300 transition-colors disabled:text-[#606070] disabled:cursor-not-allowed"
              >
                {isResending ? (
                  <span className="inline-flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    发送中...
                  </span>
                ) : countdown > 0 ? (
                  `${countdown}s 后重发`
                ) : (
                  '重新发送'
                )}
              </button>
            </p>
          </div>

          {/* Tips */}
          <div className="mt-8 p-4 bg-[#1A1A24]/50 rounded-xl border border-cyan-500/10">
            <p className="text-xs text-[#9090A0] text-center">
              提示：验证码将在 10 分钟内有效。如果没有收到邮件，请检查垃圾邮件文件夹。
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
