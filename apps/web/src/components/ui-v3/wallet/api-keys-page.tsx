'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Key, Plus, Trash2, Eye, EyeOff, CheckCircle, AlertCircle, ExternalLink, Copy, Check, X, XCircle, AlertTriangle, Edit, Loader2, RefreshCw } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useQuery, useQueries, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useTranslations } from '@/i18n/provider'

// 后端 API 响应类型
interface ApiKeyResponse {
  id: string
  exchange: string
  label: string
  maskedKey: string
  isActive: boolean
  createdAt: string
  authType?: 'api_key' | 'wallet'   // 认证类型
  walletAddress?: string             // DEX 钱包地址
}

// 支持的交易所（与后端一致：binance, okx, bybit, gate, bitget, coinbase）
const supportedExchanges = [
  { id: 'binance', name: 'Binance', logo: '/icons/exchanges/币安.webp', guideUrl: 'https://www.binance.com/api-management' },
  { id: 'okx', name: 'OKX', logo: '/icons/exchanges/okx.webp', guideUrl: 'https://www.okx.com/account/my-api' },
  { id: 'bybit', name: 'Bybit', logo: '/icons/exchanges/bybit.webp', guideUrl: 'https://www.bybit.com/app/user/api-management' },
  { id: 'gate', name: 'Gate.io', logo: '/icons/exchanges/gate.webp', guideUrl: 'https://www.gate.io/myaccount/apiv4keys' },
  { id: 'bitget', name: 'Bitget', logo: '/icons/exchanges/bitget.webp', guideUrl: 'https://www.bitget.com/account/newapi' },
  { id: 'coinbase', name: 'Coinbase', logo: '/icons/exchanges/coinbase.webp', guideUrl: 'https://www.coinbase.com/settings/api' },
]

// 支持的 DEX（id 与后端 SUPPORTED_DEX_EXCHANGES 一致）
const supportedDexExchanges = [
  { id: 'hyperliquid', name: 'Hyperliquid', logo: '/icons/exchanges/hyperliquid.webp', color: '#00FF00' },
  { id: 'aster', name: 'Aster DEX', logo: '/icons/exchanges/aster-dex.webp', color: '#6366F1' },
  { id: 'lighter', name: 'Lighter', logo: '/icons/exchanges/lighter.webp', color: '#F59E0B' },
]

// 获取交易所 logo
const getExchangeLogo = (exchange: string) => {
  const found = supportedExchanges.find(e => e.id === exchange)
  return found?.logo || '/icons/exchanges/default.webp'
}

// 获取交易所名称
const getExchangeName = (exchange: string) => {
  const found = supportedExchanges.find(e => e.id === exchange)
  if (found) return found.name
  const foundDex = supportedDexExchanges.find(e => e.id === exchange)
  return foundDex?.name || exchange
}

// 截断钱包地址显示
const truncateAddress = (address: string) => {
  if (address.length <= 10) return address
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

export function ApiKeysPage() {
  const queryClient = useQueryClient()
  const tc = useTranslations('common')
  // Tab 状态
  const [activeTab, setActiveTab] = useState<'cex' | 'dex'>('cex')

  // CEX 弹窗状态
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [selectedExchange, setSelectedExchange] = useState<string | null>(null)
  const [selectedApiKey, setSelectedApiKey] = useState<ApiKeyResponse | null>(null)
  const [showSecret, setShowSecret] = useState(false)
  const [copied, setCopied] = useState(false)

  // DEX 弹窗状态
  const [showAddDexModal, setShowAddDexModal] = useState(false)
  const [showEditDexModal, setShowEditDexModal] = useState(false)
  const [showDeleteDexModal, setShowDeleteDexModal] = useState(false)
  const [selectedDexExchange, setSelectedDexExchange] = useState<string | null>(null)
  const [selectedDexWallet, setSelectedDexWallet] = useState<ApiKeyResponse | null>(null)
  const [showDexPrivateKey, setShowDexPrivateKey] = useState(false)

  // 验证弹窗状态（与移动端一致）
  const [showVerifyModal, setShowVerifyModal] = useState(false)
  const [verifyStatus, setVerifyStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [verifyResult, setVerifyResult] = useState<{
    permissions?: string[]
    assets?: { symbol: string; amount: string; value: number }[]
    totalValue?: number
    balanceFetchError?: boolean
    error?: string
  } | null>(null)

  // 获取 API Key 列表（与 wallet-page-v3 统一数据结构）
  const { data: apiKeysData, isLoading } = useQuery({
    queryKey: ['api-keys'],
    queryFn: async () => {
      const response = await api.get<{ items: ApiKeyResponse[]; total: number }>('/api-keys')
      return response.data?.items || []
    },
  })

  const allApiKeys = apiKeysData || []
  // 分离 CEX 和 DEX
  const boundApiKeys = allApiKeys.filter(key => !key.authType || key.authType === 'api_key')
  const boundDexWallets = allApiKeys.filter(key => key.authType === 'wallet')

  // 为每个 API Key 获取余额（现货+合约）
  const apiKeyBalanceQueries = useQueries({
    queries: boundApiKeys.map((key: ApiKeyResponse) => ({
      queryKey: ['api-key-balance', key.id],
      queryFn: async () => {
        try {
          const response = await api.get<{
            valid: boolean
            totalUsdValue: number
            spotValue: number
            futuresValue: number
            permissions: string[]
            error?: string
          }>(`/api-keys/${key.id}/verify`)
          return response.data
        } catch {
          return { valid: false, totalUsdValue: 0, spotValue: 0, futuresValue: 0, permissions: [], error: '网络错误' }
        }
      },
      enabled: !!key.id,
      staleTime: 30 * 1000, // 30秒缓存（更快刷新）
      refetchOnWindowFocus: true,
    })),
  })

  // 创建 API Key
  const createMutation = useMutation({
    mutationFn: async (data: { exchange: string; label: string; apiKey: string; apiSecret: string; authType?: string; walletAddress?: string }) => {
      const response = await api.post('/api-keys', data)
      return response.data as ApiKeyResponse
    },
    onSuccess: (newKey: ApiKeyResponse) => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] })
      setShowAddModal(false)
      setSelectedExchange(null)
      setFormData({ apiKey: '', secretKey: '', passphrase: '', label: '' })
      // 绑定完成后自动弹出验证结果（拉取真实账户信息）
      handleVerify(newKey)
    },
    onError: (error: Error) => {
      toast.error(error.message || tc('addFailed'))
    },
  })

  // 删除 API Key
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api-keys/${id}`)
      return id
    },
    onSuccess: (deletedId) => {
      // 立即从缓存中移除，不等待 refetch
      queryClient.setQueryData(['api-keys'], (oldData: { items: ApiKeyResponse[]; total: number } | undefined) => {
        if (!oldData) return { items: [], total: 0 }
        return {
          items: oldData.items.filter((key) => key.id !== deletedId),
          total: oldData.total - 1,
        }
      })
      // 移除对应的余额缓存
      queryClient.removeQueries({ queryKey: ['api-key-balance', deletedId] })
      // 然后重新获取确保数据同步
      queryClient.invalidateQueries({ queryKey: ['api-keys'] })
      toast.success(tc('apiKeyDeleteSuccess'))
      setShowDeleteModal(false)
      setSelectedApiKey(null)
    },
    onError: (error: Error) => {
      toast.error(error.message || tc('deleteFailed'))
    },
  })

  // 更新 API Key
  const updateMutation = useMutation({
    mutationFn: async (data: { id: string; label?: string; apiKey?: string; apiSecret?: string }) => {
      const { id, ...updateData } = data
      const response = await api.patch(`/api-keys/${id}`, updateData)
      return response.data
    },
    onSuccess: () => {
      toast.success(tc('apiKeyUpdateSuccess'))
      // 刷新列表和余额
      queryClient.invalidateQueries({ queryKey: ['api-keys'] })
      if (selectedApiKey) {
        queryClient.invalidateQueries({ queryKey: ['api-key-balance', selectedApiKey.id] })
      }
      setShowEditModal(false)
      setSelectedApiKey(null)
      setEditFormData({ apiKey: '', secretKey: '', passphrase: '', label: '' })
    },
    onError: (error: Error) => {
      toast.error(error.message || tc('updateFailed'))
    },
  })

  // 验证 API Key - 调用真实 API（与移动端一致的弹窗流程）
  const handleVerify = async (key: ApiKeyResponse) => {
    setSelectedApiKey(key)
    setVerifyStatus('loading')
    setVerifyResult(null)
    setShowVerifyModal(true)

    try {
      const response = await api.get<{
        valid: boolean
        permissions: string[]
        balances: { symbol: string; free: number; total: number; usdValue?: number }[]
        totalUsdValue: number
        balanceFetchError?: boolean
        error?: string
      }>(`/api-keys/${key.id}/verify`)

      const data = response.data
      if (data.valid) {
        const STABLECOINS = new Set(['USDT', 'USD', 'BUSD', 'USDC', 'FDUSD', 'TUSD', 'DAI'])
        setVerifyStatus('success')
        setVerifyResult({
          permissions: data.permissions,
          assets: data.balances.map(b => ({
            symbol: b.symbol,
            amount: b.total.toFixed(STABLECOINS.has(b.symbol) ? 2 : 6),
            value: b.usdValue || 0
          })),
          totalValue: data.totalUsdValue,
          balanceFetchError: data.balanceFetchError,
        })
        // 刷新余额缓存
        queryClient.invalidateQueries({ queryKey: ['api-key-balance', key.id] })
      } else {
        setVerifyStatus('error')
        setVerifyResult({
          error: data.error || '验证失败，请检查 API Key 配置'
        })
      }
    } catch (err: unknown) {
      setVerifyStatus('error')
      setVerifyResult({
        error: err instanceof Error ? err.message : '验证失败，请检查网络连接'
      })
    }
  }

  // 表单状态
  const [formData, setFormData] = useState({
    apiKey: '',
    secretKey: '',
    passphrase: '',
    label: '',
  })

  // 编辑表单状态
  const [editFormData, setEditFormData] = useState({
    apiKey: '',
    secretKey: '',
    passphrase: '',
    label: '',
  })

  // DEX 表单状态（含交易所专属字段）
  const [dexFormData, setDexFormData] = useState({
    walletAddress: '',
    privateKey: '',
    label: '',
    // Lighter 专属
    lighterApiKeyPrivateKey: '',
    lighterApiKeyIndex: 0,
    // Aster 专属
    asterSignerAddress: '',
    // 通用
    isTestnet: false,
  })

  // DEX 编辑表单状态
  const [editDexFormData, setEditDexFormData] = useState({
    walletAddress: '',
    privateKey: '',
    label: '',
  })

  // 打开编辑弹窗
  const handleOpenEdit = (apiKey: ApiKeyResponse) => {
    setSelectedApiKey(apiKey)
    // 标准 UX：API Key 和 Secret 留空（用户可选择性更新），Label 预填当前值
    setEditFormData({
      apiKey: '', // 留空，让用户输入新的（如需更新）
      secretKey: '', // 留空
      passphrase: '',
      label: apiKey.label,
    })
    setShowEditModal(true)
  }

  // 打开删除确认弹窗
  const handleOpenDelete = (apiKey: ApiKeyResponse) => {
    setSelectedApiKey(apiKey)
    setShowDeleteModal(true)
  }

  // 确认删除
  const handleConfirmDelete = () => {
    if (selectedApiKey) {
      deleteMutation.mutate(selectedApiKey.id)
    }
  }

  // 确认编辑
  const handleConfirmEdit = () => {
    if (!selectedApiKey) return

    // 构建更新数据
    const updateData: { id: string; label?: string; apiKey?: string; apiSecret?: string } = {
      id: selectedApiKey.id,
    }

    // 只有填写了的字段才更新
    if (editFormData.label && editFormData.label !== selectedApiKey.label) {
      updateData.label = editFormData.label
    }

    // 如果要更新 API Key，必须同时提供 Secret
    if (editFormData.apiKey && editFormData.secretKey) {
      updateData.apiKey = editFormData.apiKey
      updateData.apiSecret = editFormData.secretKey
    } else if (editFormData.apiKey && !editFormData.secretKey) {
      toast.error(tc('apiKeyRequireSecret'))
      return
    } else if (!editFormData.apiKey && editFormData.secretKey) {
      toast.error(tc('secretRequireApiKey'))
      return
    }

    // 如果没有任何更新，直接关闭
    if (Object.keys(updateData).length === 1) {
      toast.info(tc('noChanges'))
      setShowEditModal(false)
      setSelectedApiKey(null)
      return
    }

    updateMutation.mutate(updateData)
  }

  // 提交添加
  const handleSubmitAdd = () => {
    if (!selectedExchange) return
    if (!formData.apiKey || !formData.secretKey) {
      toast.error(tc('fillApiKeyAndSecret'))
      return
    }
    createMutation.mutate({
      exchange: selectedExchange,
      label: formData.label || getExchangeName(selectedExchange),
      apiKey: formData.apiKey,
      apiSecret: formData.secretKey,
    })
  }

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // 创建 DEX 凭证 mutation（使用专用 /api-keys/dex 端点）
  const createDexMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const response = await api.post('/api-keys/dex', data)
      return response.data
    },
    onSuccess: () => {
      toast.success(tc('dexAddSuccess'))
      queryClient.invalidateQueries({ queryKey: ['api-keys'] })
      setShowAddDexModal(false)
      setSelectedDexExchange(null)
      setDexFormData({ walletAddress: '', privateKey: '', label: '', lighterApiKeyPrivateKey: '', lighterApiKeyIndex: 0, asterSignerAddress: '', isTestnet: false })
    },
    onError: (error: Error) => {
      toast.error(error.message || tc('addFailed'))
    },
  })

  // DEX 钱包操作函数
  const handleSubmitAddDex = () => {
    if (!selectedDexExchange) return

    const dexName = supportedDexExchanges.find(e => e.id === selectedDexExchange)?.name || selectedDexExchange

    // 构建 CreateDexCredentialDto 请求体
    const payload: Record<string, unknown> = {
      exchange: selectedDexExchange,
      label: dexFormData.label || `${dexName} 钱包`,
      isTestnet: dexFormData.isTestnet,
    }

    // 按交易所类型填充必填字段
    if (selectedDexExchange === 'hyperliquid') {
      if (!dexFormData.walletAddress || !dexFormData.privateKey) {
        toast.error(tc('fillHLFields'))
        return
      }
      payload.walletAddress = dexFormData.walletAddress
      payload.privateKey = dexFormData.privateKey
    } else if (selectedDexExchange === 'lighter') {
      if (!dexFormData.walletAddress || !dexFormData.privateKey || !dexFormData.lighterApiKeyPrivateKey) {
        toast.error(tc('fillLighterFields'))
        return
      }
      payload.walletAddress = dexFormData.walletAddress
      payload.privateKey = dexFormData.privateKey
      payload.lighterApiKeyPrivateKey = dexFormData.lighterApiKeyPrivateKey
      payload.lighterApiKeyIndex = dexFormData.lighterApiKeyIndex
    } else if (selectedDexExchange === 'aster') {
      if (!dexFormData.walletAddress || !dexFormData.privateKey) {
        toast.error(tc('fillAsterFields'))
        return
      }
      payload.asterUserAddress = dexFormData.walletAddress
      payload.asterSignerAddress = dexFormData.asterSignerAddress || dexFormData.walletAddress
      payload.privateKey = dexFormData.privateKey
    }

    createDexMutation.mutate(payload)
  }

  const handleOpenEditDex = (wallet: ApiKeyResponse) => {
    setSelectedDexWallet(wallet)
    setEditDexFormData({
      walletAddress: wallet.walletAddress || '',
      privateKey: '', // 私钥留空
      label: wallet.label,
    })
    setShowEditDexModal(true)
  }

  const handleOpenDeleteDex = (wallet: ApiKeyResponse) => {
    setSelectedDexWallet(wallet)
    setShowDeleteDexModal(true)
  }

  const handleConfirmDeleteDex = () => {
    if (selectedDexWallet) {
      deleteMutation.mutate(selectedDexWallet.id)
      setShowDeleteDexModal(false)
      setSelectedDexWallet(null)
    }
  }

  const handleConfirmEditDex = () => {
    if (!selectedDexWallet) return

    const updateData: { id: string; label?: string; apiKey?: string; apiSecret?: string } = {
      id: selectedDexWallet.id,
    }

    // 只有填写了的字段才更新
    if (editDexFormData.label && editDexFormData.label !== selectedDexWallet.label) {
      updateData.label = editDexFormData.label
    }

    // 如果填写了新私钥
    if (editDexFormData.privateKey) {
      updateData.apiKey = editDexFormData.privateKey
      updateData.apiSecret = 'not_used_for_dex'
    }

    // 如果没有任何更新，直接关闭
    if (Object.keys(updateData).length === 1) {
      toast.info(tc('noChanges'))
      setShowEditDexModal(false)
      setSelectedDexWallet(null)
      return
    }

    updateMutation.mutate(updateData)
    setShowEditDexModal(false)
    setSelectedDexWallet(null)
    setEditDexFormData({ walletAddress: '', privateKey: '', label: '' })
  }

  // 加载状态
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
      </div>
    )
  }

  return (
    <div className="text-[#F8F8FC] font-sans">
          {/* Tab 切换 */}
          <div className="flex gap-2 mb-6 p-1 rounded-xl bg-[#12121A] border border-[#1E1E2E]">
            <button
              type="button"
              onClick={() => setActiveTab('cex')}
              className={cn(
                "flex-1 py-2.5 px-4 rounded-lg font-medium transition-all",
                activeTab === 'cex'
                  ? "bg-[#06B6D4]/10 text-[#06B6D4] border border-[#06B6D4]"
                  : "text-[#9090A0] hover:text-[#F8F8FC]"
              )}
            >
              CEX 交易所
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('dex')}
              className={cn(
                "flex-1 py-2.5 px-4 rounded-lg font-medium transition-all",
                activeTab === 'dex'
                  ? "bg-[#06B6D4]/10 text-[#06B6D4] border border-[#06B6D4]"
                  : "text-[#9090A0] hover:text-[#F8F8FC]"
              )}
            >
              DEX 钱包
            </button>
          </div>

          {/* 添加按钮 - 根据 Tab 切换 */}
          <button
            type="button"
            onClick={() => activeTab === 'cex' ? setShowAddModal(true) : setShowAddDexModal(true)}
            className="w-full py-3.5 mb-6 rounded-xl bg-[#06B6D4] hover:bg-[#0891B2] text-white font-medium transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(6,182,212,0.2)] hover:shadow-[0_0_30px_rgba(6,182,212,0.3)]"
          >
            <Plus className="w-5 h-5" />
            {activeTab === 'cex' ? '添加 CEX API' : '添加 DEX 钱包'}
          </button>

          {/* CEX API Keys List */}
          {activeTab === 'cex' && (
            <div className="mb-8">
              {boundApiKeys.length === 0 ? (
              <Card className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.02)_inset] overflow-hidden">
                <CardContent className="p-8 text-center">
                  <Key className="w-12 h-12 text-[#606070] mx-auto mb-3" />
                  <p className="text-[#9090A0]">暂无绑定的 API Key</p>
                  <p className="text-[#606070] text-sm mt-1">点击上方按钮添加您的第一个交易所</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {boundApiKeys.map((key, index) => {
                  // 获取对应的余额数据
                  const balanceQuery = apiKeyBalanceQueries[index]
                  const balanceData = balanceQuery?.data
                  const totalValue = balanceData?.totalUsdValue || 0
                  const isLoadingBalance = balanceQuery?.isLoading || balanceQuery?.isFetching
                  const isVerifyFailed = balanceData && balanceData.valid === false
                  const verifyError = balanceData?.error

                  return (
                  <Card key={key.id} className={cn(
                    "glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.02)_inset] overflow-hidden",
                    isVerifyFailed ? "border border-[#F43F5E]/30" : "border border-cyan-500/[0.08]"
                  )}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          {/* Exchange Logo */}
                          <div className={cn(
                            "w-12 h-12 rounded-xl flex items-center justify-center overflow-hidden",
                            isVerifyFailed ? "bg-[#F43F5E]/10" : "bg-[#2A2A3A]"
                          , "relative"
                          )}>
                            <Image src={getExchangeLogo(key.exchange)} alt={getExchangeName(key.exchange)} fill className={cn("object-contain p-1.5", isVerifyFailed && "opacity-50")} />
                          </div>

                          {/* Info */}
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">{key.label}</span>
                              {isLoadingBalance ? (
                                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-[#3B82F6]/20 text-[#3B82F6]">
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                  验证中
                                </span>
                              ) : isVerifyFailed ? (
                                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-[#F43F5E]/20 text-[#F43F5E]">
                                  <AlertTriangle className="w-3 h-3" />
                                  验证失败
                                </span>
                              ) : key.isActive ? (
                                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-[#10B981]/20 text-[#10B981]">
                                  <CheckCircle className="w-3 h-3" />
                                  已连接
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-[#F43F5E]/20 text-[#F43F5E]">
                                  <AlertCircle className="w-3 h-3" />
                                  已禁用
                                </span>
                              )}
                            </div>
                            {/* 余额显示 - 极简模式：只显示总额 */}
                            <div className="mt-1">
                              {isLoadingBalance ? (
                                <span className="text-[#9090A0] text-sm flex items-center gap-1">
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                  加载余额...
                                </span>
                              ) : isVerifyFailed ? (
                                <div className="text-[#F43F5E] text-sm">
                                  <span className="flex items-center gap-1">
                                    <AlertCircle className="w-3 h-3" />
                                    {verifyError || '无法连接到交易所，请检查 API 配置'}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-lg font-bold text-[#10B981]">
                                  ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Actions - 图标按钮（与移动端一致） */}
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleVerify(key)}
                            title="验证连接"
                            className="p-2 hover:bg-[#1E1E2E] rounded-lg transition-colors"
                          >
                            <RefreshCw className={cn("w-4 h-4 text-[#9090A0] hover:text-[#F8F8FC]", isLoadingBalance && "animate-spin")} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(key)}
                            title="编辑"
                            className="p-2 hover:bg-[#1E1E2E] rounded-lg transition-colors"
                          >
                            <Edit className="w-4 h-4 text-[#9090A0] hover:text-[#F8F8FC]" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenDelete(key)}
                            title="删除"
                            disabled={deleteMutation.isPending}
                            className="p-2 hover:bg-[#F43F5E]/10 rounded-lg transition-colors disabled:opacity-50"
                          >
                            <Trash2 className="w-4 h-4 text-[#F43F5E]/70" />
                          </button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  )
                })}
              </div>
            )}
            </div>
          )}

          {/* DEX Wallets List */}
          {activeTab === 'dex' && (
            <div className="mb-8">
              {boundDexWallets.length === 0 ? (
                <Card className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.02)_inset] overflow-hidden">
                  <CardContent className="p-8 text-center">
                    <Key className="w-12 h-12 text-[#606070] mx-auto mb-3" />
                    <p className="text-[#9090A0]">暂无绑定的 DEX 钱包</p>
                    <p className="text-[#606070] text-sm mt-1">点击上方按钮添加您的第一个 DEX 钱包</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {boundDexWallets.map((wallet) => {
                    const dexInfo = supportedDexExchanges.find(e => e.id === wallet.exchange)
                    return (
                      <Card key={wallet.id} className={cn(
                        "glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.02)_inset] overflow-hidden border border-cyan-500/[0.08]"
                      )}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              {/* DEX Logo */}
                              <div className="w-12 h-12 rounded-xl bg-[#1E1E2E] flex items-center justify-center overflow-hidden">
                                <Image
                                  src={dexInfo?.logo || '/icons/exchanges/default.webp'}
                                  alt={dexInfo?.name || wallet.exchange}
                                  width={32}
                                  height={32}
                                  className="object-contain"
                                />
                              </div>

                              {/* Info */}
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold">{wallet.label}</span>
                                  {wallet.isActive ? (
                                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-[#10B981]/20 text-[#10B981]">
                                      <CheckCircle className="w-3 h-3" />
                                      已连接
                                    </span>
                                  ) : (
                                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-[#F43F5E]/20 text-[#F43F5E]">
                                      <AlertCircle className="w-3 h-3" />
                                      未验证
                                    </span>
                                  )}
                                </div>
                                <div className="mt-1 space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm text-[#9090A0]">地址:</span>
                                    <span className="font-mono text-sm text-[#F8F8FC]">
                                      {wallet.walletAddress ? truncateAddress(wallet.walletAddress) : 'N/A'}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => queryClient.invalidateQueries({ queryKey: ['api-keys'] })}
                                title="刷新"
                                className="p-2 hover:bg-[#1E1E2E] rounded-lg transition-colors"
                              >
                                <RefreshCw className="w-4 h-4 text-[#9090A0] hover:text-[#F8F8FC]" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenEditDex(wallet)}
                                title="编辑"
                                className="p-2 hover:bg-[#1E1E2E] rounded-lg transition-colors"
                              >
                                <Edit className="w-4 h-4 text-[#9090A0] hover:text-[#F8F8FC]" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenDeleteDex(wallet)}
                                title="删除"
                                disabled={deleteMutation.isPending}
                                className="p-2 hover:bg-[#F43F5E]/10 rounded-lg transition-colors disabled:opacity-50"
                              >
                                <Trash2 className="w-4 h-4 text-[#F43F5E]/70" />
                              </button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              )}
            </div>
          )}

      {/* Add API Key Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => { setShowAddModal(false); setSelectedExchange(''); }}>
          <Card className="w-full max-w-lg glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.02)_inset] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold">
                  {selectedExchange
                    ? `绑定 ${supportedExchanges.find(e => e.id === selectedExchange)?.name} API`
                    : '选择交易所'
                  }
                </h3>
                <button type="button" onClick={() => { setShowAddModal(false); setSelectedExchange(''); }} className="p-1 hover:bg-[#1E1E2E] rounded-lg transition-colors">
                  <X className="w-5 h-5 text-[#9090A0]" />
                </button>
              </div>

              {!selectedExchange ? (
                // Exchange Selection
                <div className="grid grid-cols-3 gap-3">
                  {supportedExchanges.map((exchange) => (
                    <button
                      key={exchange.id}
                      type="button"
                      onClick={() => setSelectedExchange(exchange.id)}
                      className="p-4 rounded-xl bg-[#1E1E2E] hover:bg-[#2A2A3A] transition-colors text-center"
                    >
                      <div className="relative w-10 h-10 mx-auto mb-2 rounded-lg bg-[#12121A] overflow-hidden">
                        <Image src={exchange.logo} alt={exchange.name} fill className="object-cover" />
                      </div>
                      <span className="text-sm">{exchange.name}</span>
                    </button>
                  ))}
                </div>
              ) : (
                // API Key Form
                <div className="space-y-4">
                  {/* Guide Link */}
                  <a
                    href={supportedExchanges.find(e => e.id === selectedExchange)?.guideUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-cyan-400 text-sm hover:underline"
                  >
                    <ExternalLink className="w-4 h-4" />
                    如何获取 API Key？
                  </a>

                  {/* API Key Input */}
                  <div>
                    <label htmlFor="add-api-key" className="text-sm text-[#9090A0] block mb-1">API Key *</label>
                    <input
                      id="add-api-key"
                      type="text"
                      value={formData.apiKey}
                      onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                      placeholder="请输入 API Key"
                      className="w-full px-4 py-2.5 rounded-lg bg-[#1E1E2E] border border-[#2A2A3A] text-[#F8F8FC] placeholder-[#606070] focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  {/* Secret Key Input */}
                  <div>
                    <label htmlFor="add-secret-key" className="text-sm text-[#9090A0] block mb-1">Secret Key *</label>
                    <div className="relative">
                      <input
                        id="add-secret-key"
                        type={showSecret ? 'text' : 'password'}
                        value={formData.secretKey}
                        onChange={(e) => setFormData({ ...formData, secretKey: e.target.value })}
                        placeholder="请输入 Secret Key"
                        className="w-full px-4 py-2.5 pr-10 rounded-lg bg-[#1E1E2E] border border-[#2A2A3A] text-[#F8F8FC] placeholder-[#606070] focus:outline-none focus:border-cyan-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSecret(!showSecret)}
                        title={showSecret ? '隐藏密钥' : '显示密钥'}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#606070] hover:text-[#9090A0]"
                      >
                        {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Passphrase (for OKX) */}
                  {selectedExchange === 'okx' && (
                    <div>
                      <label htmlFor="add-passphrase" className="text-sm text-[#9090A0] block mb-1">Passphrase *</label>
                      <input
                        id="add-passphrase"
                        type="password"
                        value={formData.passphrase}
                        onChange={(e) => setFormData({ ...formData, passphrase: e.target.value })}
                        placeholder="请输入 Passphrase"
                        className="w-full px-4 py-2.5 rounded-lg bg-[#1E1E2E] border border-[#2A2A3A] text-[#F8F8FC] placeholder-[#606070] focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                  )}

                  {/* Label Input */}
                  <div>
                    <label htmlFor="add-label" className="text-sm text-[#9090A0] block mb-1">备注名称（可选）</label>
                    <input
                      id="add-label"
                      type="text"
                      value={formData.label}
                      onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                      placeholder="如：主账户"
                      className="w-full px-4 py-2.5 rounded-lg bg-[#1E1E2E] border border-[#2A2A3A] text-[#F8F8FC] placeholder-[#606070] focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  {/* IP Whitelist Info */}
                  <Card className="bg-[#1E1E2E] border-[#2A2A3A]">
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">IP 白名单</p>
                          <p className="text-[#606070] text-xs">请将以下 IP 添加到交易所白名单</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopy('47.89.192.xxx')}
                          className="flex items-center gap-1 text-cyan-400 text-sm"
                        >
                          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                          {copied ? '已复制' : '复制'}
                        </button>
                      </div>
                      <p className="font-mono text-sm mt-2 text-[#9090A0]">47.89.192.xxx</p>
                    </CardContent>
                  </Card>

                  {/* Actions */}
                  <div className="flex gap-3 pt-2">
                    <Button
                      variant="outline"
                      className="flex-1 border-[#2A2A3A] text-[#9090A0]"
                      onClick={() => {
                        setShowAddModal(false)
                        setSelectedExchange(null)
                        setFormData({ apiKey: '', secretKey: '', passphrase: '', label: '' })
                      }}
                      disabled={createMutation.isPending}
                    >
                      取消
                    </Button>
                    <Button
                      className="flex-1 bg-cyan-500 hover:bg-cyan-600 text-white"
                      onClick={handleSubmitAdd}
                      disabled={createMutation.isPending}
                    >
                      {createMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          绑定中...
                        </>
                      ) : (
                        '验证并绑定'
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Edit API Key Modal */}
      {showEditModal && selectedApiKey && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowEditModal(false)}>
          <Card className="w-full max-w-lg glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.02)_inset] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="relative w-10 h-10 rounded-xl bg-[#1E1E2E] overflow-hidden">
                    <Image src={getExchangeLogo(selectedApiKey.exchange)} alt={getExchangeName(selectedApiKey.exchange)} fill className="object-cover" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">编辑 {selectedApiKey.label || getExchangeName(selectedApiKey.exchange)} API</h3>
                    <p className="text-[#9090A0] text-xs">更新 API 密钥配置</p>
                  </div>
                </div>
                <button
                  type="button"
                  title="关闭"
                  onClick={() => {
                    setShowEditModal(false)
                    setSelectedApiKey(null)
                  }}
                  className="p-2 hover:bg-[#1E1E2E] rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-[#9090A0]" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Current API Key Info (readonly) */}
                <div className="p-3 rounded-lg bg-[#0A0A0F] border border-[#1E1E2E]">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-[#606070] mb-1">当前绑定的 API Key</p>
                      <p className="font-mono text-[#9090A0]">{selectedApiKey.maskedKey}</p>
                    </div>
                    <span className="text-xs px-2 py-1 rounded bg-[#1E1E2E] text-[#10B981]">
                      <CheckCircle className="w-3 h-3 inline mr-1" />
                      已加密
                    </span>
                  </div>
                </div>

                {/* Divider with hint */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-[#2A2A3A]" />
                  <span className="text-xs text-[#606070]">以下字段留空则保持不变</span>
                  <div className="flex-1 h-px bg-[#2A2A3A]" />
                </div>

                {/* New API Key Input */}
                <div>
                  <label htmlFor="edit-api-key" className="text-sm text-[#9090A0] block mb-1">新 API Key</label>
                  <input
                    id="edit-api-key"
                    type="text"
                    value={editFormData.apiKey}
                    onChange={(e) => setEditFormData({ ...editFormData, apiKey: e.target.value })}
                    placeholder="留空保持当前密钥"
                    className="w-full px-4 py-2.5 rounded-lg bg-[#1E1E2E] border border-[#2A2A3A] text-[#F8F8FC] placeholder-[#606070] focus:outline-none focus:border-cyan-500"
                  />
                </div>

                {/* New Secret Key Input */}
                <div>
                  <label htmlFor="edit-secret-key" className="text-sm text-[#9090A0] block mb-1">新 Secret Key</label>
                  <div className="relative">
                    <input
                      id="edit-secret-key"
                      type={showSecret ? 'text' : 'password'}
                      value={editFormData.secretKey}
                      onChange={(e) => setEditFormData({ ...editFormData, secretKey: e.target.value })}
                      placeholder="留空保持当前密钥"
                      className="w-full px-4 py-2.5 pr-10 rounded-lg bg-[#1E1E2E] border border-[#2A2A3A] text-[#F8F8FC] placeholder-[#606070] focus:outline-none focus:border-cyan-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSecret(!showSecret)}
                      title={showSecret ? '隐藏密钥' : '显示密钥'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#606070] hover:text-[#9090A0]"
                    >
                      {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-[#606070] mt-1">更新密钥时需同时填写 API Key 和 Secret Key</p>
                </div>

                {/* Passphrase (for OKX) - 后端暂不支持 passphrase */}
                {selectedApiKey?.exchange === 'okx' && (
                  <div>
                    <label htmlFor="edit-passphrase" className="text-sm text-[#9090A0] block mb-1">Passphrase（留空则不更新）</label>
                    <input
                      id="edit-passphrase"
                      type="password"
                      value={editFormData.passphrase}
                      onChange={(e) => setEditFormData({ ...editFormData, passphrase: e.target.value })}
                      placeholder="输入新的 Passphrase"
                      className="w-full px-4 py-2.5 rounded-lg bg-[#1E1E2E] border border-[#2A2A3A] text-[#F8F8FC] placeholder-[#606070] focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                )}

                {/* Label Input */}
                <div>
                  <label htmlFor="edit-label" className="text-sm text-[#9090A0] block mb-1">备注名称</label>
                  <input
                    id="edit-label"
                    type="text"
                    value={editFormData.label}
                    onChange={(e) => setEditFormData({ ...editFormData, label: e.target.value })}
                    placeholder="如：主账户"
                    className="w-full px-4 py-2.5 rounded-lg bg-[#1E1E2E] border border-[#2A2A3A] text-[#F8F8FC] placeholder-[#606070] focus:outline-none focus:border-cyan-500"
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-4">
                  <Button
                    variant="outline"
                    className="flex-1 border-[#2A2A3A] text-[#9090A0]"
                    onClick={() => {
                      setShowEditModal(false)
                      setSelectedApiKey(null)
                    }}
                    disabled={updateMutation.isPending}
                  >
                    取消
                  </Button>
                  <Button
                    onClick={handleConfirmEdit}
                    className="flex-1 bg-[#06B6D4] hover:bg-[#0891B2] text-white"
                    disabled={updateMutation.isPending}
                  >
                    {updateMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        保存中...
                      </>
                    ) : (
                      '保存更改'
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedApiKey && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => { setShowDeleteModal(false); setSelectedApiKey(null); }}>
          <Card className="w-full max-w-md glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.02)_inset] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <CardContent className="p-6">
              <div className="text-center">
                {/* Warning Icon */}
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#F43F5E]/10 flex items-center justify-center">
                  <AlertTriangle className="w-8 h-8 text-[#F43F5E]" />
                </div>

                <h3 className="text-xl font-bold mb-2">确认删除</h3>
                <p className="text-[#9090A0] mb-6">
                  您确定要删除 <span className="text-[#F8F8FC] font-semibold">{selectedApiKey.label || getExchangeName(selectedApiKey.exchange)}</span> 的 API 密钥吗？
                </p>

                {/* API Key Info */}
                <div className="flex items-center gap-3 p-4 mb-6 rounded-xl bg-[#1E1E2E]/50 border border-[#2A2A3A]">
                  <div className="relative w-10 h-10 rounded-xl bg-[#2A2A3A] overflow-hidden">
                    <Image src={getExchangeLogo(selectedApiKey.exchange)} alt={getExchangeName(selectedApiKey.exchange)} fill className="object-cover" />
                  </div>
                  <div className="text-left">
                    <p className="font-semibold">{selectedApiKey.label || getExchangeName(selectedApiKey.exchange)}</p>
                    <p className="text-[#9090A0] text-sm font-mono">{selectedApiKey.maskedKey}</p>
                  </div>
                </div>

                {/* Warning Message */}
                <div className="p-3 mb-6 rounded-lg bg-[#F43F5E]/10 border border-[#F43F5E]/20 text-left">
                  <p className="text-sm text-[#F43F5E]">
                    <AlertCircle className="w-4 h-4 inline mr-1" />
                    删除后，使用此 API 的策略将无法继续执行交易。此操作不可撤销。
                  </p>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1 border-[#2A2A3A] text-[#9090A0]"
                    onClick={() => {
                      setShowDeleteModal(false)
                      setSelectedApiKey(null)
                    }}
                    disabled={deleteMutation.isPending}
                  >
                    取消
                  </Button>
                  <Button
                    onClick={handleConfirmDelete}
                    className="flex-1 bg-[#F43F5E] hover:bg-[#E11D48] text-white"
                    disabled={deleteMutation.isPending}
                  >
                    {deleteMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4 mr-2" />
                        确认删除
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Add DEX Wallet Modal */}
      {showAddDexModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => { setShowAddDexModal(false); setSelectedDexExchange(''); }}>
          <Card className="w-full max-w-lg glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.02)_inset] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold">
                  {selectedDexExchange
                    ? `连接 ${supportedDexExchanges.find(e => e.id === selectedDexExchange)?.name} 钱包`
                    : '选择 DEX'
                  }
                </h3>
                <button type="button" onClick={() => { setShowAddDexModal(false); setSelectedDexExchange(''); }} className="p-1 hover:bg-[#1E1E2E] rounded-lg transition-colors">
                  <X className="w-5 h-5 text-[#9090A0]" />
                </button>
              </div>

              {!selectedDexExchange ? (
                // DEX Selection
                <div className="grid grid-cols-3 gap-3">
                  {supportedDexExchanges.map((dex) => (
                    <button
                      key={dex.id}
                      type="button"
                      onClick={() => setSelectedDexExchange(dex.id)}
                      className="p-4 rounded-xl bg-[#1E1E2E] hover:bg-[#2A2A3A] transition-colors text-center"
                    >
                      <div className="relative w-10 h-10 mx-auto mb-2 rounded-lg bg-[#12121A] overflow-hidden">
                        <Image src={dex.logo} alt={dex.name} fill className="object-cover" />
                      </div>
                      <span className="text-sm">{dex.name}</span>
                    </button>
                  ))}
                </div>
              ) : (
                // DEX Wallet Form — 按交易所显示不同字段
                <div className="space-y-4">
                  {/* === Hyperliquid 表单 === */}
                  {selectedDexExchange === 'hyperliquid' && (
                    <>
                      <div>
                        <label htmlFor="add-dex-wallet" className="text-sm text-[#9090A0] block mb-1">主钱包地址 *</label>
                        <input id="add-dex-wallet" type="text" value={dexFormData.walletAddress}
                          onChange={(e) => setDexFormData({ ...dexFormData, walletAddress: e.target.value })}
                          placeholder="0x..." className="w-full px-4 py-2.5 rounded-lg bg-[#1E1E2E] border border-[#2A2A3A] text-[#F8F8FC] placeholder-[#606070] focus:outline-none focus:border-cyan-500" />
                      </div>
                      <div>
                        <label htmlFor="add-dex-pk" className="text-sm text-[#9090A0] block mb-1">Agent 私钥 *</label>
                        <div className="relative">
                          <input id="add-dex-pk" type={showDexPrivateKey ? 'text' : 'password'} value={dexFormData.privateKey}
                            onChange={(e) => setDexFormData({ ...dexFormData, privateKey: e.target.value })}
                            placeholder="Hyperliquid Agent Wallet 私钥" className="w-full px-4 py-2.5 pr-10 rounded-lg bg-[#1E1E2E] border border-[#2A2A3A] text-[#F8F8FC] placeholder-[#606070] focus:outline-none focus:border-cyan-500" />
                          <button type="button" onClick={() => setShowDexPrivateKey(!showDexPrivateKey)} title={showDexPrivateKey ? '隐藏' : '显示'}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#606070] hover:text-[#9090A0]">
                            {showDexPrivateKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        <p className="text-xs text-[#606070] mt-1">在 Hyperliquid 中创建 Agent Wallet 后获取</p>
                      </div>
                    </>
                  )}

                  {/* === Lighter 表单 === */}
                  {selectedDexExchange === 'lighter' && (
                    <>
                      <div>
                        <label htmlFor="add-lighter-wallet" className="text-sm text-[#9090A0] block mb-1">钱包地址 *</label>
                        <input id="add-lighter-wallet" type="text" value={dexFormData.walletAddress}
                          onChange={(e) => setDexFormData({ ...dexFormData, walletAddress: e.target.value })}
                          placeholder="0x..." className="w-full px-4 py-2.5 rounded-lg bg-[#1E1E2E] border border-[#2A2A3A] text-[#F8F8FC] placeholder-[#606070] focus:outline-none focus:border-cyan-500" />
                      </div>
                      <div>
                        <label htmlFor="add-lighter-pk" className="text-sm text-[#9090A0] block mb-1">钱包私钥 *</label>
                        <div className="relative">
                          <input id="add-lighter-pk" type={showDexPrivateKey ? 'text' : 'password'} value={dexFormData.privateKey}
                            onChange={(e) => setDexFormData({ ...dexFormData, privateKey: e.target.value })}
                            placeholder="钱包私钥（0x...）" className="w-full px-4 py-2.5 pr-10 rounded-lg bg-[#1E1E2E] border border-[#2A2A3A] text-[#F8F8FC] placeholder-[#606070] focus:outline-none focus:border-cyan-500" />
                          <button type="button" onClick={() => setShowDexPrivateKey(!showDexPrivateKey)} title={showDexPrivateKey ? '隐藏' : '显示'}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#606070] hover:text-[#9090A0]">
                            {showDexPrivateKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                      <div>
                        <label htmlFor="add-lighter-apk" className="text-sm text-[#9090A0] block mb-1">API Key 私钥 *</label>
                        <input id="add-lighter-apk" type="password" value={dexFormData.lighterApiKeyPrivateKey}
                          onChange={(e) => setDexFormData({ ...dexFormData, lighterApiKeyPrivateKey: e.target.value })}
                          placeholder="Lighter API Key 私钥（40字节 hex）" className="w-full px-4 py-2.5 rounded-lg bg-[#1E1E2E] border border-[#2A2A3A] text-[#F8F8FC] placeholder-[#606070] focus:outline-none focus:border-cyan-500" />
                      </div>
                      <div>
                        <label htmlFor="add-lighter-idx" className="text-sm text-[#9090A0] block mb-1">API Key 索引</label>
                        <input id="add-lighter-idx" type="number" min={0} max={255} value={dexFormData.lighterApiKeyIndex}
                          onChange={(e) => setDexFormData({ ...dexFormData, lighterApiKeyIndex: parseInt(e.target.value) || 0 })}
                          className="w-full px-4 py-2.5 rounded-lg bg-[#1E1E2E] border border-[#2A2A3A] text-[#F8F8FC] focus:outline-none focus:border-cyan-500" />
                        <p className="text-xs text-[#606070] mt-1">范围 0-255，通常为 0</p>
                      </div>
                    </>
                  )}

                  {/* === Aster 表单 === */}
                  {selectedDexExchange === 'aster' && (
                    <>
                      <div>
                        <label htmlFor="add-aster-user" className="text-sm text-[#9090A0] block mb-1">用户钱包地址 *</label>
                        <input id="add-aster-user" type="text" value={dexFormData.walletAddress}
                          onChange={(e) => setDexFormData({ ...dexFormData, walletAddress: e.target.value })}
                          placeholder="0x... 主钱包地址" className="w-full px-4 py-2.5 rounded-lg bg-[#1E1E2E] border border-[#2A2A3A] text-[#F8F8FC] placeholder-[#606070] focus:outline-none focus:border-cyan-500" />
                      </div>
                      <div>
                        <label htmlFor="add-aster-signer" className="text-sm text-[#9090A0] block mb-1">签名钱包地址（可选）</label>
                        <input id="add-aster-signer" type="text" value={dexFormData.asterSignerAddress}
                          onChange={(e) => setDexFormData({ ...dexFormData, asterSignerAddress: e.target.value })}
                          placeholder="留空则使用用户钱包地址" className="w-full px-4 py-2.5 rounded-lg bg-[#1E1E2E] border border-[#2A2A3A] text-[#F8F8FC] placeholder-[#606070] focus:outline-none focus:border-cyan-500" />
                        <p className="text-xs text-[#606070] mt-1">Aster API 钱包地址，留空则与用户钱包相同</p>
                      </div>
                      <div>
                        <label htmlFor="add-aster-pk" className="text-sm text-[#9090A0] block mb-1">签名私钥 *</label>
                        <div className="relative">
                          <input id="add-aster-pk" type={showDexPrivateKey ? 'text' : 'password'} value={dexFormData.privateKey}
                            onChange={(e) => setDexFormData({ ...dexFormData, privateKey: e.target.value })}
                            placeholder="签名钱包的私钥" className="w-full px-4 py-2.5 pr-10 rounded-lg bg-[#1E1E2E] border border-[#2A2A3A] text-[#F8F8FC] placeholder-[#606070] focus:outline-none focus:border-cyan-500" />
                          <button type="button" onClick={() => setShowDexPrivateKey(!showDexPrivateKey)} title={showDexPrivateKey ? '隐藏' : '显示'}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#606070] hover:text-[#9090A0]">
                            {showDexPrivateKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    </>
                  )}

                  {/* 通用字段: 备注名称 + 测试网开关 */}
                  <div>
                    <label htmlFor="add-dex-label" className="text-sm text-[#9090A0] block mb-1">备注名称（可选）</label>
                    <input id="add-dex-label" type="text" value={dexFormData.label}
                      onChange={(e) => setDexFormData({ ...dexFormData, label: e.target.value })}
                      placeholder={`如：我的 ${supportedDexExchanges.find(e => e.id === selectedDexExchange)?.name}`}
                      className="w-full px-4 py-2.5 rounded-lg bg-[#1E1E2E] border border-[#2A2A3A] text-[#F8F8FC] placeholder-[#606070] focus:outline-none focus:border-cyan-500" />
                  </div>

                  {/* 测试网开关 */}
                  <div className="flex items-center justify-between p-3 rounded-lg bg-[#1E1E2E] border border-[#2A2A3A]">
                    <div>
                      <p className="text-sm font-medium">测试网模式</p>
                      <p className="text-xs text-[#606070]">启用后连接测试网络</p>
                    </div>
                    <button type="button"
                      onClick={() => setDexFormData({ ...dexFormData, isTestnet: !dexFormData.isTestnet })}
                      className={cn(
                        "relative w-11 h-6 rounded-full transition-colors",
                        dexFormData.isTestnet ? "bg-[#06B6D4]" : "bg-[#2A2A3A]"
                      )}>
                      <span className={cn(
                        "absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform",
                        dexFormData.isTestnet ? "translate-x-5" : "translate-x-0.5"
                      )} />
                    </button>
                  </div>

                  {/* Security Notice */}
                  <Card className="bg-[#1E1E2E] border-[#2A2A3A]">
                    <CardContent className="p-3">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-5 h-5 text-[#06B6D4] flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium">安全提示</p>
                          <p className="text-[#9090A0] text-xs mt-1">
                            您的私钥将使用 AES-256-GCM 加密存储，仅在执行交易时解密使用。请确保您信任此平台。
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Actions */}
                  <div className="flex gap-3 pt-2">
                    <Button
                      variant="outline"
                      className="flex-1 border-[#2A2A3A] text-[#9090A0]"
                      onClick={() => {
                        setShowAddDexModal(false)
                        setSelectedDexExchange(null)
                        setDexFormData({ walletAddress: '', privateKey: '', label: '', lighterApiKeyPrivateKey: '', lighterApiKeyIndex: 0, asterSignerAddress: '', isTestnet: false })
                      }}
                      disabled={createDexMutation.isPending}
                    >
                      取消
                    </Button>
                    <Button
                      className="flex-1 bg-cyan-500 hover:bg-cyan-600 text-white"
                      onClick={handleSubmitAddDex}
                      disabled={createDexMutation.isPending}
                    >
                      {createDexMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          连接中...
                        </>
                      ) : (
                        '连接钱包'
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Edit DEX Wallet Modal */}
      {showEditDexModal && selectedDexWallet && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <Card className="w-full max-w-lg glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.02)_inset] overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#1E1E2E] flex items-center justify-center overflow-hidden">
                    <Image
                      src={supportedDexExchanges.find(e => e.id === selectedDexWallet.exchange)?.logo || '/icons/exchanges/default.webp'}
                      alt={getExchangeName(selectedDexWallet.exchange)}
                      width={28}
                      height={28}
                      className="object-contain"
                    />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">编辑 {selectedDexWallet.label || getExchangeName(selectedDexWallet.exchange)} 钱包</h3>
                    <p className="text-[#9090A0] text-xs">更新钱包配置</p>
                  </div>
                </div>
                <button
                  type="button"
                  title="关闭"
                  onClick={() => {
                    setShowEditDexModal(false)
                    setSelectedDexWallet(null)
                  }}
                  className="p-2 hover:bg-[#1E1E2E] rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-[#9090A0]" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Current Wallet Address (readonly) */}
                <div className="p-3 rounded-lg bg-[#0A0A0F] border border-[#1E1E2E]">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-[#606070] mb-1">当前钱包地址</p>
                      <p className="font-mono text-[#9090A0]">{selectedDexWallet.walletAddress ? truncateAddress(selectedDexWallet.walletAddress) : 'N/A'}</p>
                    </div>
                    <span className="text-xs px-2 py-1 rounded bg-[#1E1E2E] text-[#10B981]">
                      <CheckCircle className="w-3 h-3 inline mr-1" />
                      已加密
                    </span>
                  </div>
                </div>

                {/* Divider with hint */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-[#2A2A3A]" />
                  <span className="text-xs text-[#606070]">以下字段留空则保持不变</span>
                  <div className="flex-1 h-px bg-[#2A2A3A]" />
                </div>

                {/* New Private Key Input */}
                <div>
                  <label htmlFor="edit-dex-private-key" className="text-sm text-[#9090A0] block mb-1">新私钥</label>
                  <div className="relative">
                    <input
                      id="edit-dex-private-key"
                      type={showDexPrivateKey ? 'text' : 'password'}
                      value={editDexFormData.privateKey}
                      onChange={(e) => setEditDexFormData({ ...editDexFormData, privateKey: e.target.value })}
                      placeholder="留空保持当前私钥"
                      className="w-full px-4 py-2.5 pr-10 rounded-lg bg-[#1E1E2E] border border-[#2A2A3A] text-[#F8F8FC] placeholder-[#606070] focus:outline-none focus:border-cyan-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowDexPrivateKey(!showDexPrivateKey)}
                      title={showDexPrivateKey ? '隐藏私钥' : '显示私钥'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#606070] hover:text-[#9090A0]"
                    >
                      {showDexPrivateKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-[#606070] mt-1">更新私钥后将重新加密存储</p>
                </div>

                {/* Label Input */}
                <div>
                  <label htmlFor="edit-dex-label" className="text-sm text-[#9090A0] block mb-1">备注名称</label>
                  <input
                    id="edit-dex-label"
                    type="text"
                    value={editDexFormData.label}
                    onChange={(e) => setEditDexFormData({ ...editDexFormData, label: e.target.value })}
                    placeholder="如：我的钱包"
                    className="w-full px-4 py-2.5 rounded-lg bg-[#1E1E2E] border border-[#2A2A3A] text-[#F8F8FC] placeholder-[#606070] focus:outline-none focus:border-cyan-500"
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-4">
                  <Button
                    variant="outline"
                    className="flex-1 border-[#2A2A3A] text-[#9090A0]"
                    onClick={() => {
                      setShowEditDexModal(false)
                      setSelectedDexWallet(null)
                    }}
                    disabled={updateMutation.isPending}
                  >
                    取消
                  </Button>
                  <Button
                    onClick={handleConfirmEditDex}
                    className="flex-1 bg-[#06B6D4] hover:bg-[#0891B2] text-white"
                    disabled={updateMutation.isPending}
                  >
                    {updateMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        保存中...
                      </>
                    ) : (
                      '保存更改'
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Delete DEX Wallet Confirmation Modal */}
      {showDeleteDexModal && selectedDexWallet && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => { setShowDeleteDexModal(false); setSelectedDexWallet(null); }}>
          <Card className="w-full max-w-md glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.02)_inset] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <CardContent className="p-6">
              <div className="text-center">
                {/* Warning Icon */}
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#F43F5E]/10 flex items-center justify-center">
                  <AlertTriangle className="w-8 h-8 text-[#F43F5E]" />
                </div>

                <h3 className="text-xl font-bold mb-2">确认删除</h3>
                <p className="text-[#9090A0] mb-6">
                  您确定要删除 <span className="text-[#F8F8FC] font-semibold">{selectedDexWallet.label || getExchangeName(selectedDexWallet.exchange)}</span> 钱包吗？
                </p>

                {/* Wallet Info */}
                <div className="flex items-center gap-3 p-4 mb-6 rounded-xl bg-[#1E1E2E]/50 border border-[#2A2A3A]">
                  <div className="w-10 h-10 rounded-xl bg-[#2A2A3A] flex items-center justify-center overflow-hidden">
                    <Image
                      src={supportedDexExchanges.find(e => e.id === selectedDexWallet.exchange)?.logo || '/icons/exchanges/default.webp'}
                      alt={getExchangeName(selectedDexWallet.exchange)}
                      width={28}
                      height={28}
                      className="object-contain"
                    />
                  </div>
                  <div className="text-left">
                    <p className="font-semibold">{selectedDexWallet.label || getExchangeName(selectedDexWallet.exchange)}</p>
                    <p className="text-[#9090A0] text-sm font-mono">
                      {selectedDexWallet.walletAddress ? truncateAddress(selectedDexWallet.walletAddress) : 'N/A'}
                    </p>
                  </div>
                </div>

                {/* Warning Message */}
                <div className="p-3 mb-6 rounded-lg bg-[#F43F5E]/10 border border-[#F43F5E]/20 text-left">
                  <p className="text-sm text-[#F43F5E]">
                    <AlertCircle className="w-4 h-4 inline mr-1" />
                    删除后，使用此钱包的策略将无法继续执行交易。此操作不可撤销。
                  </p>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1 border-[#2A2A3A] text-[#9090A0]"
                    onClick={() => {
                      setShowDeleteDexModal(false)
                      setSelectedDexWallet(null)
                    }}
                    disabled={deleteMutation.isPending}
                  >
                    取消
                  </Button>
                  <Button
                    onClick={handleConfirmDeleteDex}
                    className="flex-1 bg-[#F43F5E] hover:bg-[#E11D48] text-white"
                    disabled={deleteMutation.isPending}
                  >
                    {deleteMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4 mr-2" />
                        确认删除
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ===== 验证结果弹窗（与移动端对齐） ===== */}
      {showVerifyModal && selectedApiKey && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100] p-5"
          onClick={() => {
            setShowVerifyModal(false)
            setSelectedApiKey(null)
            setVerifyResult(null)
          }}
        >
          <div
            className="w-full max-w-md bg-[#12121A] border border-[#1E1E2E] rounded-2xl p-6 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 右上角关闭 */}
            <div className="flex justify-end mb-2">
              <button
                type="button"
                onClick={() => {
                  setShowVerifyModal(false)
                  setSelectedApiKey(null)
                  setVerifyResult(null)
                }}
                className="p-1 hover:bg-[#1E1E2E] rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-[#9090A0]" />
              </button>
            </div>

            <div className="text-center">
              {/* Loading 状态 */}
              {verifyStatus === 'loading' && (
                <>
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#06B6D4]/10 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 text-[#06B6D4] animate-spin" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">验证中</h3>
                  <p className="text-[#94A3B8] text-sm">正在验证 {getExchangeName(selectedApiKey.exchange)} 连接状态...</p>
                </>
              )}

              {/* 成功状态 */}
              {verifyStatus === 'success' && verifyResult && (
                <>
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#10B981]/10 flex items-center justify-center">
                    <CheckCircle className="w-8 h-8 text-[#10B981]" />
                  </div>
                  <h3 className="text-xl font-bold text-[#10B981] mb-2">验证成功</h3>
                  <p className="text-[#94A3B8] text-sm mb-5">API Key 连接正常，以下是账户信息</p>

                  {/* 验证详情 */}
                  <div className="space-y-3 text-left">
                    {/* 交易所信息 */}
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-[#1E1E2E] border border-[#2A2A3A]">
                      <div className="w-10 h-10 rounded-xl bg-[#2A2A3A] flex items-center justify-center overflow-hidden relative">
                        <Image src={getExchangeLogo(selectedApiKey.exchange)} alt={getExchangeName(selectedApiKey.exchange)} fill className="object-contain p-1" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-white text-sm">{selectedApiKey.label}</p>
                        <p className="text-[#94A3B8] text-xs">{getExchangeName(selectedApiKey.exchange)} · <span className="font-mono">{selectedApiKey.maskedKey}</span></p>
                      </div>
                    </div>

                    {/* 权限列表 */}
                    {verifyResult.permissions && verifyResult.permissions.length > 0 && (
                      <div className="p-3 rounded-xl bg-[#1E1E2E] border border-[#2A2A3A]">
                        <p className="text-[#94A3B8] text-xs mb-2">API 权限</p>
                        <div className="flex flex-wrap gap-2">
                          {verifyResult.permissions.map((perm, index) => (
                            <span key={index} className="px-2.5 py-1 rounded-lg bg-[#10B981]/10 text-[#10B981] text-xs font-medium">
                              {perm}
                            </span>
                          ))}
                        </div>
                        {/* 缺少合约交易权限时的警告（网格/Solo策略需要合约权限） */}
                        {!verifyResult.permissions.includes('合约交易') && (
                          <div className="mt-2 p-2 rounded-lg bg-[#F59E0B]/10 border border-[#F59E0B]/20 flex items-start gap-2">
                            <span className="text-[#F59E0B] text-xs mt-0.5">⚠</span>
                            <p className="text-[#F59E0B] text-xs">未检测到合约交易权限。AI 网格/合约策略需要在 Binance 后台开启合约交易权限。</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* 资产列表 */}
                    <div className="p-3 rounded-xl bg-[#1E1E2E] border border-[#2A2A3A]">
                      {/* 总资产 */}
                      <div className="flex justify-between items-center mb-3 pb-3 border-b border-[#2A2A3A]">
                        <span className="text-[#94A3B8] text-sm">总资产价值</span>
                        {verifyResult.balanceFetchError ? (
                          <span className="text-sm text-[#F59E0B] font-medium">获取失败，请稍后重试</span>
                        ) : (
                          <span className="text-xl font-bold font-mono text-[#10B981]">
                            ${(verifyResult.totalValue ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        )}
                      </div>
                      {/* 余额获取失败提示 */}
                      {verifyResult.balanceFetchError && (
                        <p className="text-[#606070] text-xs">
                          API Key 验证通过，但余额查询失败（可能是网络问题）。策略功能正常可用。
                        </p>
                      )}
                      {/* 币种明细 */}
                      {!verifyResult.balanceFetchError && verifyResult.assets && verifyResult.assets.length > 0 && (
                        <>
                          <p className="text-[#94A3B8] text-xs mb-2">资产明细</p>
                          <div className="space-y-2.5">
                            {verifyResult.assets.map((asset, index) => (
                              <div key={index} className="flex justify-between items-center">
                                <span className="text-white font-medium text-sm">{asset.symbol}</span>
                                <div className="text-right">
                                  <span className="text-white font-mono text-sm">{asset.amount}</span>
                                  {asset.value > 0 && (
                                    <span className="text-[#606070] text-xs ml-1.5">${asset.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                      {/* 余额为0的说明 */}
                      {!verifyResult.balanceFetchError && (!verifyResult.assets || verifyResult.assets.length === 0) && (
                        <p className="text-[#606070] text-xs">交易所账户余额为空</p>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* 失败状态 */}
              {verifyStatus === 'error' && verifyResult && (
                <>
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#F43F5E]/10 flex items-center justify-center">
                    <XCircle className="w-8 h-8 text-[#F43F5E]" />
                  </div>
                  <h3 className="text-xl font-bold text-[#F43F5E] mb-2">验证失败</h3>
                  <p className="text-[#94A3B8] text-sm mb-5">无法连接到交易所，请检查配置</p>

                  {/* 错误详情 */}
                  <div className="p-3 rounded-xl bg-[#F43F5E]/10 border border-[#F43F5E]/20 text-left mb-4">
                    <p className="text-sm text-[#F43F5E] flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <span>{verifyResult.error}</span>
                    </p>
                  </div>

                  {/* 排查建议 */}
                  <div className="p-3 rounded-xl bg-[#1E1E2E] border border-[#2A2A3A] text-left">
                    <p className="text-[#94A3B8] text-xs mb-2">请检查以下项目</p>
                    <ul className="text-[#94A3B8] text-xs space-y-1.5">
                      <li>• API Key 和 Secret 是否正确</li>
                      <li>• API Key 是否已过期</li>
                      <li>• IP 白名单是否包含服务器地址</li>
                      <li>• 是否开启了交易权限</li>
                    </ul>
                  </div>
                </>
              )}

              {/* 底部关闭按钮 */}
              <button
                type="button"
                onClick={() => {
                  setShowVerifyModal(false)
                  setSelectedApiKey(null)
                  setVerifyResult(null)
                }}
                className="w-full mt-5 py-3.5 bg-[#1E1E2E] hover:bg-[#2A2A3A] border border-[#2A2A3A] text-white rounded-xl transition-colors font-medium"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
