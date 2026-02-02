'use client'

import { useState, useCallback } from 'react'
import api from '@/lib/api'
import { StrategyConfigData } from '@/components/ui-v3/shared/strategy-config-types'

// 后端 DTO 类型
interface CreateSubscriptionDto {
  basic: {
    apiKeyId: string
    amountPerTrade: number
    tradingType: 'spot' | 'futures'
    direction: 'long' | 'short' | 'both'
    tradingPairs: string[]
    autoClose: boolean
    stopLossPercent?: number
    takeProfitPercent?: number
  }
  advanced?: {
    leverage: number
    marginMode: 'cross' | 'isolated'
    slippageTolerance: number
    maxPositions: number
    // 移动止损
    trailingStopEnabled: boolean
    trailingStopActivation?: number
    trailingStopCallback?: number
    // DCA
    dcaEnabled: boolean
    dcaMaxCount: number
    dcaTrigger: number
    dcaMultiplier: number
    // 防瀑布
    waterfallProtection: boolean
    waterfallTriggerPercent: number
    // 黑天鹅
    blackSwanProtection: boolean
    blackSwanTrigger: number
    blackSwanAction: 'close_all' | 'close_half' | 'pause'
    // 单日亏损
    dailyMaxLossEnabled: boolean
    dailyMaxLossPercent: number
  }
}

// 前端配置 -> 后端 DTO 转换
function toSubscriptionDto(
  config: StrategyConfigData
): CreateSubscriptionDto {
  return {
    basic: {
      apiKeyId: config.apiKeyId,
      amountPerTrade: config.positionAmount,
      tradingType: config.tradingType,
      direction: config.direction,
      tradingPairs: config.tradingPairs,
      autoClose: true,
      stopLossPercent: config.stopLoss,
      takeProfitPercent: config.takeProfit,
    },
    advanced: {
      leverage: config.leverage,
      marginMode: config.marginMode,
      slippageTolerance: config.slippage,
      maxPositions: config.maxPositions,
      // 移动止损
      trailingStopEnabled: config.trailingStopEnabled,
      trailingStopActivation: config.trailingActivation,
      trailingStopCallback: config.trailingCallback,
      // DCA
      dcaEnabled: config.dcaEnabled,
      dcaMaxCount: config.dcaCount,
      dcaTrigger: config.dcaTrigger,
      dcaMultiplier: config.dcaMultiplier,
      // 防瀑布
      waterfallProtection: config.waterfallProtection,
      waterfallTriggerPercent: config.waterfallTrigger,
      // 黑天鹅
      blackSwanProtection: config.blackSwanEnabled,
      blackSwanTrigger: config.blackSwanTrigger,
      blackSwanAction: config.blackSwanAction,
      // 单日亏损
      dailyMaxLossEnabled: config.dailyLossEnabled,
      dailyMaxLossPercent: config.dailyLossPercent,
    },
  }
}

// 后端响应 -> 前端配置转换
function fromSubscriptionResponse(response: any): StrategyConfigData {
  const { basic, advanced } = response
  return {
    apiKeyId: basic.apiKeyId || '', // 从响应获取
    exchange: 'Binance', // 需要从 apiKey 关联获取
    tradingType: basic.tradingType,
    tradingPairs: basic.tradingPairs || [],
    positionAmount: parseFloat(basic.amountPerTrade),
    direction: basic.direction,
    leverage: advanced.leverage,
    marginMode: advanced.marginMode,
    maxPositions: advanced.maxPositions,
    takeProfit: parseFloat(basic.takeProfitPercent) || 15,
    stopLoss: parseFloat(basic.stopLossPercent) || 10,
    slippage: parseFloat(advanced.slippageTolerance) || 0.5,
    trailingStopEnabled: advanced.trailingStopEnabled,
    trailingActivation: parseFloat(advanced.trailingStopActivation) || 8,
    trailingCallback: parseFloat(advanced.trailingStopCallback) || 3,
    dcaEnabled: advanced.dcaEnabled,
    dcaCount: advanced.dcaMaxCount,
    dcaTrigger: parseFloat(advanced.dcaTrigger) || 5,
    dcaMultiplier: parseFloat(advanced.dcaMultiplier) || 1.5,
    waterfallProtection: advanced.waterfallProtection,
    waterfallTrigger: parseFloat(advanced.waterfallTriggerPercent) || 15,
    blackSwanEnabled: advanced.blackSwanProtection,
    blackSwanTrigger: parseFloat(advanced.blackSwanTrigger) || 10,
    blackSwanAction: advanced.blackSwanAction,
    dailyLossEnabled: advanced.dailyMaxLossEnabled,
    dailyLossPercent: parseFloat(advanced.dailyMaxLossPercent) || 20,
  }
}

// 策略订阅 Hook
export function useStrategySubscription(strategyId: string) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 创建订阅
  const createSubscription = useCallback(
    async (config: StrategyConfigData) => {
      if (!config.apiKeyId) {
        setError('请选择交易所 API Key')
        throw new Error('请选择交易所 API Key')
      }
      setLoading(true)
      setError(null)
      try {
        const dto = toSubscriptionDto(config)
        const response = await api.post(`/strategies/${strategyId}/subscription`, dto)
        return response.data
      } catch (err: any) {
        setError(err.message || '创建订阅失败')
        throw err
      } finally {
        setLoading(false)
      }
    },
    [strategyId]
  )

  // 更新订阅配置
  const updateSubscription = useCallback(
    async (subscriptionId: string, config: StrategyConfigData) => {
      if (!config.apiKeyId) {
        setError('请选择交易所 API Key')
        throw new Error('请选择交易所 API Key')
      }
      setLoading(true)
      setError(null)
      try {
        const dto = toSubscriptionDto(config)
        const response = await api.put(
          `/strategies/subscription/${subscriptionId}/config`,
          dto
        )
        return response.data
      } catch (err: any) {
        setError(err.message || '更新配置失败')
        throw err
      } finally {
        setLoading(false)
      }
    },
    []
  )

  // 获取订阅配置
  const getSubscriptionConfig = useCallback(async (subscriptionId: string) => {
    setLoading(true)
    setError(null)
    try {
      const response = await api.get<any>(
        `/strategies/subscription/${subscriptionId}/config`
      )
      return fromSubscriptionResponse(response.data)
    } catch (err: any) {
      setError(err.message || '获取配置失败')
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  // 切换订阅状态
  const toggleSubscription = useCallback(
    async (subscriptionId: string, isActive: boolean) => {
      setLoading(true)
      setError(null)
      try {
        const response = await api.post(
          `/strategies/subscription/${subscriptionId}/toggle`,
          { isActive }
        )
        return response.data
      } catch (err: any) {
        setError(err.message || '切换状态失败')
        throw err
      } finally {
        setLoading(false)
      }
    },
    []
  )

  return {
    loading,
    error,
    createSubscription,
    updateSubscription,
    getSubscriptionConfig,
    toggleSubscription,
  }
}

// 获取用户 API Keys Hook
export function useApiKeys() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [apiKeys, setApiKeys] = useState<any[]>([])

  const fetchApiKeys = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await api.get<{ items: any[]; total: number }>('/api-keys')
      // 确保返回的是数组 - API 返回 { items: [...], total: n }
      const keys = Array.isArray(response.data?.items) ? response.data.items : []
      setApiKeys(keys)
      return keys
    } catch (err: any) {
      setError(err.message || '获取 API Keys 失败')
      // 失败时保持空数组
      setApiKeys([])
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  return { loading, error, apiKeys, fetchApiKeys }
}

// 获取交易所余额 Hook
export function useExchangeBalance(apiKeyId: string) {
  const [loading, setLoading] = useState(false)
  const [balance, setBalance] = useState<number | null>(null)

  const fetchBalance = useCallback(async () => {
    if (!apiKeyId) return
    setLoading(true)
    try {
      const response = await api.get<{ balance: number }>(`/api-keys/${apiKeyId}/balance`)
      setBalance(response.data.balance)
      return response.data.balance
    } catch {
      setBalance(null)
    } finally {
      setLoading(false)
    }
  }, [apiKeyId])

  return { loading, balance, fetchBalance }
}
