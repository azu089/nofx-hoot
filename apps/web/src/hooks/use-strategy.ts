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
    dcaMaxCount?: number
    dcaTrigger?: number
    dcaMultiplier?: number
    // 防瀑布
    waterfallProtection: boolean
    waterfallTriggerPercent?: number
    // 黑天鹅
    blackSwanProtection: boolean
    blackSwanType?: 'coin_drop' | 'account_loss'
    blackSwanTrigger?: number
    blackSwanAction?: 'close_all' | 'close_half' | 'pause'
    // 单日亏损
    dailyMaxLossEnabled: boolean
    dailyMaxLossPercent?: number
    dailyMaxLossAction?: 'close_all' | 'close_half' | 'pause'
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
      // 移动止损：未启用时不发送可选字段，避免触发后端 @Min 校验
      trailingStopEnabled: config.trailingStopEnabled,
      ...(config.trailingStopEnabled ? {
        trailingStopActivation: Math.max(1, config.trailingActivation),
        trailingStopCallback: Math.max(0.5, config.trailingCallback),
      } : {}),
      // DCA：未启用时不发送可选字段
      dcaEnabled: config.dcaEnabled,
      ...(config.dcaEnabled ? {
        dcaMaxCount: config.dcaCount,
        dcaTrigger: Math.max(1, config.dcaTrigger),
        dcaMultiplier: Math.max(1, config.dcaMultiplier),
      } : {}),
      // 防瀑布
      waterfallProtection: config.waterfallProtection,
      ...(config.waterfallProtection ? {
        waterfallTriggerPercent: Math.max(5, config.waterfallTrigger),
      } : {}),
      // 黑天鹅（coin_drop = 监控主流币暴跌）
      blackSwanProtection: config.blackSwanEnabled,
      ...(config.blackSwanEnabled ? {
        blackSwanType: 'coin_drop' as const,
        blackSwanTrigger: Math.max(5, config.blackSwanTrigger),
        blackSwanAction: config.blackSwanAction,
      } : {}),
      // 单日亏损
      dailyMaxLossEnabled: config.dailyLossEnabled,
      ...(config.dailyLossEnabled ? {
        dailyMaxLossPercent: Math.max(5, config.dailyLossPercent),
        dailyMaxLossAction: config.dailyLossAction,
      } : {}),
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
    dailyLossAction: advanced.dailyMaxLossAction || 'close_all',
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

// 订阅汇总类型
export interface SubscriptionSummaryDetail {
  subscriptionId: string
  strategyId: string
  strategyName: string
  apiKeyId: string
  apiKeyLabel: string
  amountPerTrade: number
  maxPositions: number
  maxExposure: number
  isActive: boolean
}

export interface SubscriptionSummary {
  activeCount: number
  totalMaxExposure: number
  subscriptions: SubscriptionSummaryDetail[]
  riskLevel: 'safe' | 'warning' | 'danger'
  riskMessage?: string
}

// 获取订阅汇总 Hook - 用于多策略风险提示
export function useSubscriptionSummary() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<SubscriptionSummary | null>(null)

  const fetchSummary = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await api.get<SubscriptionSummary>('/strategies/subscriptions/summary')
      setSummary(response.data)
      return response.data
    } catch (err: any) {
      setError(err.message || '获取订阅汇总失败')
      setSummary(null)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  return { loading, error, summary, fetchSummary }
}
