/**
 * Web3 钱包连接 Hook
 * 使用 wagmi 实现钱包连接功能
 */
'use client'

import { useAccount, useConnect, useDisconnect, useSignMessage } from 'wagmi'
import { useState, useCallback } from 'react'

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

  // 钱包登录（连接 + 签名）
  const walletLogin = useCallback(async (walletId: string) => {
    // 1. 连接钱包
    await connectWallet(walletId)

    // 等待连接完成后再签名
    // 注意：这里可能需要等待状态更新
    return new Promise<{ address: string; signature: string }>((resolve, reject) => {
      // 使用 setTimeout 确保状态更新
      setTimeout(async () => {
        try {
          const timestamp = Date.now()
          const message = `HOOT 登录验证\n\n时间戳: ${timestamp}\n\n请签名以验证您的钱包所有权`
          const signature = await signMessageAsync({ message })

          // 调用后端验证
          // TODO: 实际调用后端 API

          resolve({
            address: address || '',
            signature,
          })
        } catch (err) {
          reject(err)
        }
      }, 1000)
    })
  }, [connectWallet, signMessageAsync, address])

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
