/**
 * 账户绑定管理 Hook
 * 管理 Telegram、钱包、邮箱的绑定状态和操作
 */
'use client'

import { useState, useCallback } from 'react'
import { useSignMessage } from 'wagmi'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'

// 绑定状态类型
export interface BindingStatus {
  telegram?: {
    bound: boolean
    id?: string
    username?: string
    rewardClaimed?: boolean
  }
  wallet?: {
    bound: boolean
    address?: string
    rewardClaimed?: boolean
  }
  email?: {
    bound: boolean
    address?: string
    verified?: boolean
    rewardClaimed?: boolean
  }
}

// 完整用户资料类型
export interface FullProfile {
  id: string
  email: string | null
  emailVerified: boolean
  nickname: string | null
  telegramId: string | null
  telegramUsername: string | null
  walletAddress: string | null
  inviteCode: string | null
  usdtBalance: string
  hootBalance: string
  createdAt: string
  bindings: {
    email: boolean
    emailVerified: boolean
    telegram: boolean
    wallet: boolean
  }
}

// 绑定码响应
interface BindCodeResponse {
  bindCode: string
  expiresAt: string
}

// Nonce 响应
interface NonceResponse {
  nonce: string
  message: string
  expiresAt: string
}

export function useBindings() {
  const { user } = useAuth()
  const { signMessageAsync } = useSignMessage()

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [bindingStatus, setBindingStatus] = useState<BindingStatus>({})

  // Telegram 绑定码状态
  const [telegramBindCode, setTelegramBindCode] = useState<string | null>(null)
  const [telegramBindCodeExpiry, setTelegramBindCodeExpiry] = useState<Date | null>(null)

  // 获取完整用户资料（含绑定状态）
  const fetchProfile = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await api.get<FullProfile>('/auth/profile')
      const profile = response.data

      // 更新绑定状态
      setBindingStatus({
        telegram: {
          bound: !!profile.telegramId,
          id: profile.telegramId || undefined,
          username: profile.telegramUsername || undefined,
        },
        wallet: {
          bound: !!profile.walletAddress,
          address: profile.walletAddress || undefined,
        },
        email: {
          bound: !!profile.email,
          address: profile.email || undefined,
          verified: profile.emailVerified,
        },
      })

      return profile
    } catch (err) {
      const message = err instanceof Error ? err.message : '获取用户信息失败'
      setError(message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  // 生成 Telegram 绑定码
  const generateTelegramBindCode = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await api.post<BindCodeResponse>('/auth/telegram/bind-code', {})
      const { bindCode, expiresAt } = response.data

      setTelegramBindCode(bindCode)
      setTelegramBindCodeExpiry(new Date(expiresAt))

      return { bindCode, expiresAt: new Date(expiresAt) }
    } catch (err) {
      const message = err instanceof Error ? err.message : '生成绑定码失败'
      setError(message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  // 解绑 Telegram
  const unbindTelegram = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      await api.delete('/auth/telegram')

      // 更新本地状态
      setBindingStatus(prev => ({
        ...prev,
        telegram: { bound: false },
      }))

      // 清除绑定码
      setTelegramBindCode(null)
      setTelegramBindCodeExpiry(null)

      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : '解绑失败'
      setError(message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  // 获取钱包绑定 Nonce
  const getWalletNonce = useCallback(async (address: string) => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await api.post<NonceResponse>('/auth/wallet/nonce', { address })
      return response.data
    } catch (err) {
      const message = err instanceof Error ? err.message : '获取 Nonce 失败'
      setError(message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  // 绑定钱包（需要先连接钱包）
  const bindWallet = useCallback(async (address: string) => {
    setIsLoading(true)
    setError(null)

    try {
      // 1. 获取 nonce
      const { message } = await getWalletNonce(address)

      // 2. 签名
      const signature = await signMessageAsync({ message })

      // 3. 调用绑定 API
      const response = await api.post('/auth/bind/wallet', {
        address,
        signature,
        message,
      })

      // 4. 更新本地状态
      setBindingStatus(prev => ({
        ...prev,
        wallet: {
          bound: true,
          address,
        },
      }))

      return response.data
    } catch (err) {
      const message = err instanceof Error ? err.message : '绑定钱包失败'
      setError(message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [getWalletNonce, signMessageAsync])

  // 解绑钱包
  const unbindWallet = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      await api.delete('/auth/wallet')

      // 更新本地状态
      setBindingStatus(prev => ({
        ...prev,
        wallet: { bound: false },
      }))

      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : '解绑钱包失败'
      setError(message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  // 发送邮箱绑定验证码
  const sendEmailBindCode = useCallback(async (email: string) => {
    setIsLoading(true)
    setError(null)

    try {
      await api.post('/auth/send-verification', { email })
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : '发送验证码失败'
      setError(message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  // 绑定邮箱
  const bindEmail = useCallback(async (email: string, code: string, password?: string) => {
    setIsLoading(true)
    setError(null)

    try {
      // 先验证邮箱
      await api.post('/auth/verify-email', { email, code })

      // 如果需要设置密码，调用绑定接口
      if (password) {
        await api.post('/auth/bind/email', { email, password })
      }

      // 更新本地状态
      setBindingStatus(prev => ({
        ...prev,
        email: {
          bound: true,
          address: email,
          verified: true,
        },
      }))

      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : '绑定邮箱失败'
      setError(message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  // 清除错误
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return {
    // 状态
    isLoading,
    error,
    bindingStatus,
    telegramBindCode,
    telegramBindCodeExpiry,

    // 方法
    fetchProfile,
    generateTelegramBindCode,
    unbindTelegram,
    getWalletNonce,
    bindWallet,
    unbindWallet,
    sendEmailBindCode,
    bindEmail,
    clearError,
  }
}

// 格式化钱包地址
export function formatAddress(address: string, startChars = 6, endChars = 4): string {
  if (!address) return ''
  if (address.length <= startChars + endChars) return address
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`
}
