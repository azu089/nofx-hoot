/**
 * Web3 钱包连接 Hook
 * 使用 wagmi 实现钱包连接功能
 */
'use client'

import { useAccount, useConnect, useDisconnect, useSignMessage } from 'wagmi'
import { useState, useCallback } from 'react'
import { api } from '@/lib/api'

// 钱包类型映射到 connector
const WALLET_CONNECTOR_MAP: Record<string, string> = {
  metamask: 'injected',
  walletconnect: 'walletConnect',
  coinbase: 'coinbaseWallet',
  okx: 'injected', // OKX 使用 injected
  trust: 'walletConnect', // Trust 通过 WalletConnect
  bitget: 'injected', // Bitget 使用 injected
}

export function useWallet() {
  const { address, isConnected, chain } = useAccount()
  const { connectors, connect, isPending: isConnecting, error: connectError } = useConnect()
  const { disconnect } = useDisconnect()
  const { signMessageAsync } = useSignMessage()
  const [error, setError] = useState<string | null>(null)

  // 连接钱包
  const connectWallet = useCallback(async (walletId: string) => {
    setError(null)

    try {
      const connectorType = WALLET_CONNECTOR_MAP[walletId] || 'injected'
      const connector = connectors.find(c => c.id === connectorType || c.name.toLowerCase().includes(walletId))

      if (!connector) {
        // 如果没找到特定连接器，尝试使用 injected
        const injectedConnector = connectors.find(c => c.id === 'injected')
        if (injectedConnector) {
          connect({ connector: injectedConnector })
          return
        }
        throw new Error(`未找到 ${walletId} 钱包，请确保已安装`)
      }

      connect({ connector })
    } catch (err) {
      const message = err instanceof Error ? err.message : '连接失败'
      setError(message)
      throw err
    }
  }, [connectors, connect])

  // 签名消息（用于后端验证）
  const signMessage = useCallback(async (message: string) => {
    if (!isConnected) {
      throw new Error('请先连接钱包')
    }

    try {
      const signature = await signMessageAsync({ message })
      return signature
    } catch (err) {
      const message = err instanceof Error ? err.message : '签名失败'
      setError(message)
      throw err
    }
  }, [isConnected, signMessageAsync])

  /**
   * 钱包完整登录流程：获取 nonce → 签名 → 后端验证
   * 调用前提：钱包已通过 wagmi 连接（isConnected === true，address 有值）
   * @param walletAddress 已连接的钱包地址
   * @returns 后端返回的 accessToken 和用户信息
   */
  const walletLogin = useCallback(async (walletAddress: string) => {
    if (!walletAddress) {
      throw new Error('钱包地址无效，请重新连接')
    }

    // 1. 向后端请求 nonce/message
    const nonceRes = await api.post<{ nonce: string; message: string }>(
      '/auth/wallet/nonce',
      { address: walletAddress }
    )
    const message = nonceRes.data.message || nonceRes.data.nonce

    // 2. 让用户对 message 进行签名
    let signature: string
    try {
      signature = await signMessageAsync({ message })
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : '签名失败'
      setError(errMsg)
      throw new Error(errMsg)
    }

    // 3. 提交签名给后端完成登录/注册
    const loginRes = await api.post<{
      accessToken: string
      refreshToken?: string
      user: {
        id: string
        email: string
        nickname: string
        walletAddress?: string
        telegramId?: string
        telegramUsername?: string
        emailVerified?: boolean
      }
    }>('/auth/wallet/login', { address: walletAddress, signature, message })

    const { accessToken, refreshToken, user } = loginRes.data

    return { address: walletAddress, signature, message, accessToken, refreshToken, user }
  }, [signMessageAsync])

  // 断开连接
  const disconnectWallet = useCallback(() => {
    disconnect()
    setError(null)
  }, [disconnect])

  return {
    // 状态
    address,
    isConnected,
    isConnecting,
    chain,
    error: error || (connectError?.message ?? null),

    // 方法
    connectWallet,
    disconnectWallet,
    signMessage,
    walletLogin,

    // 原始连接器
    connectors,
  }
}

// 格式化地址显示
export function formatAddress(address: string, startChars = 6, endChars = 4): string {
  if (!address) return ''
  if (address.length <= startChars + endChars) return address
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`
}
