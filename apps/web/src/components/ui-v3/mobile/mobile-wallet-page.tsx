"use client"

import { useState, useMemo } from "react"
import { toast } from "sonner"
import Image from "next/image"
import { useTranslations } from "next-intl"
import { useQuery, useQueries, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import {
  ArrowUpRight,
  ArrowDownLeft,
  ArrowLeftRight,
  Plus,
  Edit2,
  CheckCircle,
  Trash2,
  Calendar,
  Clock,
  ChevronDown,
  XCircle,
  FileText,
  AlertCircle,
  RefreshCw,
  Key,
  X,
  Eye,
  EyeOff,
  Copy,
  Check,
  Shield,
  ExternalLink,
  AlertTriangle,
  Loader2,
  Wallet,
} from "lucide-react"
import { MobileEcosystemV3 } from "./mobile-ecosystem-v3"

type MainTab = "wallet" | "api" | "ecosystem"
type WalletSubTab = "assets" | "history"

interface AssetItem {
  name: string
  symbol: string
  amount: string
  value: string
  locked?: boolean
  releaseProgress?: number
  releaseInfo?: string
  icon?: string
}

interface TransactionItem {
  id: string
  type: 'deposit' | 'withdraw' | 'exchange' | 'membership' | 'gas_fee' | 'fee' | 'reward' | 'referral'
  asset: string
  amount: string
  status: 'completed' | 'pending' | 'failed' | 'refunded' | 'cancelled' | 'processing'
  remark?: string
  time: string
  trend: "up" | "down"
}

interface APIKeyItem {
  id: string
  name: string // 用户备注的名称 (label)
  exchange: string // 交易所名称 (如 Binance, OKX)
  icon?: string
  status: 'active' | 'error'
  apiKey?: string
  permissions?: string[]
  createdAt?: string
  balance?: number
  error?: string
  isLoading?: boolean
}

interface ApiKeyData {
  id: string
  exchange: string
  label: string
  maskedKey: string
  isActive: boolean
  createdAt: string
  authType?: 'api_key' | 'wallet'
  walletAddress?: string
  isTestnet?: boolean
}

// 支持的交易所
const supportedExchanges = [
  { id: 'binance', name: 'Binance', logo: '/icons/exchanges/币安.webp', guideUrl: 'https://www.binance.com/api-management' },
  { id: 'okx', name: 'OKX', logo: '/icons/exchanges/okx.webp', guideUrl: 'https://www.okx.com/account/my-api' },
  { id: 'bybit', name: 'Bybit', logo: '/icons/exchanges/bybit.webp', guideUrl: 'https://www.bybit.com/app/user/api-management' },
  { id: 'gate', name: 'Gate.io', logo: '/icons/exchanges/gate.webp', guideUrl: 'https://www.gate.io/myaccount/apikeys' },
  { id: 'bitget', name: 'Bitget', logo: '/icons/exchanges/bitget.webp', guideUrl: 'https://www.bitget.com/api' },
  { id: 'coinbase', name: 'Coinbase', logo: '/icons/exchanges/coinbase.webp', guideUrl: 'https://www.coinbase.com/settings/api' },
]

// DEX 交易所
const supportedDexExchanges = [
  { id: 'hyperliquid', name: 'Hyperliquid', logo: '/icons/exchanges/hyperliquid.webp' },
  { id: 'aster', name: 'Aster DEX', logo: '/icons/exchanges/aster-dex.webp' },
  { id: 'lighter', name: 'Lighter', logo: '/icons/exchanges/lighter.webp' },
]

interface MobileWalletPageProps {
  initialTab?: 'wallet' | 'api' | 'ecosystem'
  onNavigate?: (path: string) => void
}

export function MobileWalletPage({ initialTab = 'wallet', onNavigate }: MobileWalletPageProps) {
  const t = useTranslations('wallet')
  const tDex = useTranslations('dex')
  const tCommon = useTranslations('common')
  const queryClient = useQueryClient()
  const { isAuthenticated } = useAuth()
  const [mainTab, setMainTab] = useState<MainTab>(initialTab)

  // 获取钱包余额
  const { data: balanceData } = useQuery({
    queryKey: ['wallet', 'balance'],
    queryFn: async () => {
      const response = await api.get<{ usdt: string; hoot: string; point: string }>('/wallet/balance')
      return response.data
    },
    enabled: isAuthenticated,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  })

  // 获取空投余额（含锁仓信息）
  const { data: airdropData } = useQuery({
    queryKey: ['airdrop', 'balance'],
    queryFn: async () => {
      const response = await api.get<{
        totalBalance: string
        lockedBalance: string
        availableBalance: string
        vestingProgress: number
      }>('/airdrop/balance')
      return response.data
    },
    enabled: isAuthenticated,
  })

  // 获取交易记录
  const { data: transactionsData } = useQuery({
    queryKey: ['wallet', 'transactions'],
    queryFn: async () => {
      const response = await api.get<{
        items: Array<{
          id: string
          type: string
          asset: string
          amount: string
          status: string
          remark?: string
          createdAt: string
        }>
        total: number
      }>('/wallet/transactions')
      return response.data
    },
    enabled: isAuthenticated,
  })
  const [walletSubTab, setWalletSubTab] = useState<WalletSubTab>("assets")

  // 历史账单筛选状态
  const [showTypeFilter, setShowTypeFilter] = useState(false)
  const [showAssetFilter, setShowAssetFilter] = useState(false)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [txTypeFilter, setTxTypeFilter] = useState<'all' | 'deposit' | 'withdraw' | 'exchange' | 'membership' | 'gas_fee'>('all')
  const [txAssetFilter, setTxAssetFilter] = useState<'all' | 'USDT' | 'HOOT' | 'POINT'>('all')
  // 默认显示本月
  const [dateRange, setDateRange] = useState(() => {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0]
    }
  })

  // API 管理弹窗状态
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showVerifyModal, setShowVerifyModal] = useState(false)
  const [verifyStatus, setVerifyStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [verifyResult, setVerifyResult] = useState<{
    permissions?: string[]
    assets?: { symbol: string; amount: string; value: number }[]
    totalValue?: number
    balanceFetchError?: boolean
    error?: string
  } | null>(null)
  const [selectedExchange, setSelectedExchange] = useState<string | null>(null)
  const [selectedApiKey, setSelectedApiKey] = useState<APIKeyItem | null>(null)
  const [showSecret, setShowSecret] = useState(false)
  const [copied, setCopied] = useState(false)
  const [formData, setFormData] = useState({ apiKey: '', secretKey: '', passphrase: '', label: '' })
  const [editFormData, setEditFormData] = useState({ apiKey: '', secretKey: '', passphrase: '', label: '' })

  // DEX 相关状态
  const [apiSubTab, setApiSubTab] = useState<'cex' | 'dex'>('cex')
  const [showAddDexModal, setShowAddDexModal] = useState(false)
  const [showDeleteDexModal, setShowDeleteDexModal] = useState(false)
  const [selectedDexExchange, setSelectedDexExchange] = useState<string | null>(null)
  const [selectedDexWallet, setSelectedDexWallet] = useState<ApiKeyData | null>(null)
  const [showDexPrivateKey, setShowDexPrivateKey] = useState(false)
  const [dexFormData, setDexFormData] = useState({
    walletAddress: '',
    privateKey: '',
    label: '',
    lighterApiKeyPrivateKey: '',
    lighterApiKeyIndex: 0,
    asterSignerAddress: '',
    isTestnet: false,
  })

  // 筛选选项
  const typeFilterOptions = [
    { value: 'all', label: t('allTypes') },
    { value: 'deposit', label: t('deposit') },
    { value: 'withdraw', label: t('withdraw') },
    { value: 'exchange', label: t('exchange') },
    { value: 'membership', label: t('membership') },
    { value: 'gas_fee', label: t('gasFeeType') },
  ]

  const assetFilterOptions = [
    { value: 'all', label: t('allAssets') },
    { value: 'USDT', label: 'USDT' },
    { value: 'HOOT', label: 'HOOT' },
    { value: 'POINT', label: t('gasCard') },
  ]

  const getTypeLabel = (value: string) => typeFilterOptions.find(o => o.value === value)?.label || t('allTypes')
  const getAssetLabel = (value: string) => assetFilterOptions.find(o => o.value === value)?.label || t('allAssets')

  // API 管理处理函数
  const handleOpenAdd = () => {
    setSelectedExchange(null)
    setFormData({ apiKey: '', secretKey: '', passphrase: '', label: '' })
    setShowAddModal(true)
  }

  const handleOpenEdit = (api: APIKeyItem) => {
    setSelectedApiKey(api)
    setEditFormData({ apiKey: api.apiKey || '', secretKey: '', passphrase: '', label: api.name })
    setShowEditModal(true)
  }

  const handleOpenDelete = (api: APIKeyItem) => {
    setSelectedApiKey(api)
    setShowDeleteModal(true)
  }

  // 删除 API Key mutation
  const deleteApiKeyMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api-keys/${id}`)
    },
    onSuccess: () => {
      toast.success(t('apiDeleteSuccess') || '删除成功')
      queryClient.invalidateQueries({ queryKey: ['api-keys'] })
      queryClient.invalidateQueries({ queryKey: ['api-key-balance'] })
      setShowDeleteModal(false)
      setSelectedApiKey(null)
    },
    onError: (error: Error) => {
      toast.error(error.message || t('apiDeleteError') || '删除失败')
    },
  })

  const handleConfirmDelete = () => {
    if (!selectedApiKey) return
    deleteApiKeyMutation.mutate(selectedApiKey.id)
  }

  // 更新 API Key mutation
  const updateApiKeyMutation = useMutation({
    mutationFn: async (data: { id: string; label?: string; apiKey?: string; apiSecret?: string }) => {
      const response = await api.patch(`/api-keys/${data.id}`, {
        label: data.label,
        apiKey: data.apiKey || undefined,
        apiSecret: data.apiSecret || undefined,
      })
      return response.data
    },
    onSuccess: () => {
      toast.success(t('apiUpdateSuccess') || '更新成功')
      queryClient.invalidateQueries({ queryKey: ['api-keys'] })
      queryClient.invalidateQueries({ queryKey: ['api-key-balance'] })
      setShowEditModal(false)
      setSelectedApiKey(null)
    },
    onError: (error: Error) => {
      toast.error(error.message || t('apiUpdateError') || '更新失败')
    },
  })

  const handleConfirmEdit = () => {
    if (!selectedApiKey) return

    // 构建更新数据，只包含有值的字段
    const updateData: { id: string; label?: string; apiKey?: string; apiSecret?: string } = {
      id: selectedApiKey.id,
    }

    // 只有当 label 有值时才包含
    if (editFormData.label && editFormData.label.trim()) {
      updateData.label = editFormData.label.trim()
    }

    // 只有当同时填写了新的 apiKey 和 secretKey 时才更新密钥
    if (editFormData.apiKey && editFormData.secretKey) {
      updateData.apiKey = editFormData.apiKey
      updateData.apiSecret = editFormData.secretKey
    }

    updateApiKeyMutation.mutate(updateData)
  }

  // 验证 API Key - 调用真实 API
  const handleVerify = async (apiItem: APIKeyItem) => {
    setSelectedApiKey(apiItem)
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
      }>(`/api-keys/${apiItem.id}/verify`)

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
        // 更新 selectedApiKey 的权限，确保编辑弹窗显示一致的权限
        setSelectedApiKey({
          ...apiItem,
          permissions: data.permissions,
          balance: data.totalUsdValue
        })
        // 刷新 API Keys 列表缓存，确保卡片上显示最新数据
        queryClient.invalidateQueries({ queryKey: ['api-key-balance', apiItem.id] })
      } else {
        setVerifyStatus('error')
        setVerifyResult({
          error: data.error || t('apiVerifyError')
        })
      }
    } catch (err: unknown) {
      setVerifyStatus('error')
      setVerifyResult({
        error: err instanceof Error ? err.message : t('apiVerifyError')
      })
    }
  }

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // 创建 API Key mutation
  const createApiKeyMutation = useMutation({
    mutationFn: async (data: { exchange: string; label: string; apiKey: string; apiSecret: string }) => {
      const response = await api.post('/api-keys', data)
      return response.data as { id: string; exchange: string; label: string; maskedKey?: string }
    },
    onSuccess: (newKey) => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] })
      setShowAddModal(false)
      setSelectedExchange(null)
      setFormData({ apiKey: '', secretKey: '', passphrase: '', label: '' })
      // 绑定完成后自动弹出验证结果（含交易所 logo）
      const allExchanges = [...supportedExchanges, ...supportedDexExchanges]
      const exchangeInfo = allExchanges.find(e => e.id === newKey.exchange.toLowerCase())
      handleVerify({
        id: newKey.id,
        name: newKey.label || newKey.exchange,
        exchange: newKey.exchange,
        status: 'active',
        icon: exchangeInfo?.logo,
      })
    },
    onError: (error: Error) => {
      toast.error(error.message || t('apiAddError'))
    },
  })

  // 处理添加 API Key
  const handleAddApiKey = async () => {
    if (!selectedExchange || !formData.apiKey || !formData.secretKey) {
      return
    }
    createApiKeyMutation.mutate({
      exchange: selectedExchange.toLowerCase(),
      label: formData.label || `${selectedExchange} ${t('account')}`,
      apiKey: formData.apiKey,
      apiSecret: formData.secretKey,
    })
  }

  // DEX 凭证创建 mutation
  const createDexMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const response = await api.post('/api-keys/dex', data)
      return response.data
    },
    onSuccess: () => {
      toast.success(tDex('addSuccess'))
      queryClient.invalidateQueries({ queryKey: ['api-keys'] })
      setShowAddDexModal(false)
      setSelectedDexExchange(null)
      setDexFormData({ walletAddress: '', privateKey: '', label: '', lighterApiKeyPrivateKey: '', lighterApiKeyIndex: 0, asterSignerAddress: '', isTestnet: false })
    },
    onError: (error: Error) => {
      toast.error(error.message || tDex('addError'))
    },
  })

  // DEX 添加处理
  const handleSubmitAddDex = () => {
    if (!selectedDexExchange) return
    const dexName = supportedDexExchanges.find(e => e.id === selectedDexExchange)?.name || selectedDexExchange
    const payload: Record<string, unknown> = {
      exchange: selectedDexExchange,
      label: dexFormData.label || `${dexName} ${t('account')}`,
      isTestnet: dexFormData.isTestnet,
    }
    if (selectedDexExchange === 'hyperliquid') {
      if (!dexFormData.walletAddress || !dexFormData.privateKey) {
        toast.error(tDex('fillWalletAndKey'))
        return
      }
      payload.walletAddress = dexFormData.walletAddress
      payload.privateKey = dexFormData.privateKey
    } else if (selectedDexExchange === 'lighter') {
      if (!dexFormData.walletAddress || !dexFormData.privateKey || !dexFormData.lighterApiKeyPrivateKey) {
        toast.error(tDex('fillLighterFields'))
        return
      }
      payload.walletAddress = dexFormData.walletAddress
      payload.privateKey = dexFormData.privateKey
      payload.lighterApiKeyPrivateKey = dexFormData.lighterApiKeyPrivateKey
      payload.lighterApiKeyIndex = dexFormData.lighterApiKeyIndex
    } else if (selectedDexExchange === 'aster') {
      if (!dexFormData.walletAddress || !dexFormData.privateKey) {
        toast.error(tDex('fillAsterFields'))
        return
      }
      payload.asterUserAddress = dexFormData.walletAddress
      payload.asterSignerAddress = dexFormData.asterSignerAddress || dexFormData.walletAddress
      payload.privateKey = dexFormData.privateKey
    }
    createDexMutation.mutate(payload)
  }

  const handleOpenDeleteDex = (wallet: ApiKeyData) => {
    setSelectedDexWallet(wallet)
    setShowDeleteDexModal(true)
  }

  const handleConfirmDeleteDex = () => {
    if (!selectedDexWallet) return
    deleteApiKeyMutation.mutate(selectedDexWallet.id)
    setShowDeleteDexModal(false)
    setSelectedDexWallet(null)
  }

  // 资产数据 - 从真实 API 获取
  const assets = useMemo<AssetItem[]>(() => {
    const result: AssetItem[] = []

    // USDT
    const usdtBalance = parseFloat(balanceData?.usdt || '0')
    result.push({
      name: "USDT",
      symbol: "USDT",
      amount: usdtBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      value: usdtBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      icon: "/icons/usdt.svg",
    })

    // HOOT（可用）= 总额 - 锁定，涵盖所有来源（兑换/充值/已释放空投）
    const hootBalance = parseFloat(balanceData?.hoot || '0')
    const lockedHootForCalc = parseFloat(airdropData?.lockedBalance || '0')
    const usableHoot = Math.max(0, hootBalance - lockedHootForCalc)
    result.push({
      name: "HOOT",
      symbol: "HOOT",
      amount: usableHoot.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      value: usableHoot.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      icon: "/icons/hoot/token.png",
    })

    // HOOT 锁仓释放中 - 始终显示
    const lockedHoot = parseFloat(airdropData?.lockedBalance || '0')
    result.push({
      name: t('hootReleasing'),
      symbol: "HOOT",
      amount: lockedHoot.toLocaleString('en-US', { minimumFractionDigits: 0 }),
      value: lockedHoot.toLocaleString('en-US', { minimumFractionDigits: 0 }),
      locked: true,
      releaseProgress: airdropData?.vestingProgress || 0,
      releaseInfo: t('airdropLock'),
      icon: "/icons/hoot/token.png",
    })

    // 点卡 - 始终显示
    const pointBalance = parseFloat(balanceData?.point || '0')
    result.push({
      name: t('gasCard'),
      symbol: "GAS",
      amount: pointBalance.toLocaleString('en-US', { minimumFractionDigits: 0 }),
      value: pointBalance.toLocaleString('en-US', { minimumFractionDigits: 0 }),
      icon: "/icons/gas-card.svg",
    })

    return result
  }, [balanceData, airdropData, t])

  // 交易历史数据 - 从真实 API 获取
  const transactions = useMemo<TransactionItem[]>(() => {
    if (!transactionsData?.items) return []
    return transactionsData.items.map(tx => {
      const numAmount = parseFloat(tx.amount)
      const isPositive = numAmount >= 0
      const absAmount = Math.abs(numAmount).toFixed(2)
      return {
        id: tx.id,
        type: tx.type as TransactionItem['type'],
        asset: tx.asset,
        amount: isPositive ? `+${absAmount}` : `-${absAmount}`,
        status: tx.status as TransactionItem['status'],
        remark: tx.remark,
        time: new Date(tx.createdAt).toLocaleString('zh-CN'),
        trend: isPositive ? 'up' as const : 'down' as const,
      }
    })
  }, [transactionsData])

  // 计算总余额
  // hootBalance = availableBalance + lockedBalance，已包含锁定部分，不需要再加
  const totalBalance = useMemo(() => {
    const usdtBalance = parseFloat(balanceData?.usdt || '0')
    const hootBalance = parseFloat(balanceData?.hoot || '0')
    const pointBalance = parseFloat(balanceData?.point || '0')
    // 暂时假设 HOOT 价格为 1（后续可从行情 API 获取）
    return usdtBalance + hootBalance + pointBalance
  }, [balanceData])

  // 筛选交易记录
  const filteredTransactions = transactions.filter(tx => {
    const matchesType = txTypeFilter === 'all' || tx.type === txTypeFilter
    const matchesAsset = txAssetFilter === 'all' || tx.asset === txAssetFilter

    // 时间过滤
    let matchesDate = true
    if (tx.time && dateRange.start && dateRange.end) {
      const txDateStr = tx.time.split(' ')[0].replace(/\//g, '-')
      const txDate = new Date(txDateStr)
      const startDate = new Date(dateRange.start)
      const endDate = new Date(dateRange.end)
      endDate.setHours(23, 59, 59, 999)
      matchesDate = txDate >= startDate && txDate <= endDate
    }

    return matchesType && matchesAsset && matchesDate
  })

  // 获取类型文本
  const getTypeText = (type: string) => {
    switch (type) {
      case 'deposit': return t('deposit')
      case 'withdraw': return t('withdraw')
      case 'exchange': return t('exchange')
      case 'membership': return t('membership')
      case 'gas_fee': return t('gasFeeType')
      case 'fee': return t('fee')
      case 'reward': return t('reward')
      case 'referral': return t('referral')
      default: return type
    }
  }

  // 获取状态图标和文本 — 只有成功/处理中/失败三种
  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'completed':
        return { icon: <CheckCircle className="w-3.5 h-3.5 text-[#22C55E]" />, text: t('completed'), color: 'text-[#22C55E]' }
      case 'pending':
      case 'processing':
        return { icon: <Clock className="w-3.5 h-3.5 text-[#F59E0B]" />, text: t('pending'), color: 'text-[#F59E0B]' }
      default:
        // failed / refunded / cancelled 统一显示"失败"红色
        return { icon: <XCircle className="w-3.5 h-3.5 text-[#EF4444]" />, text: t('failed'), color: 'text-[#EF4444]' }
    }
  }

  // 从后端获取真实 API Key 列表
  const { data: apiKeysData } = useQuery({
    queryKey: ['api-keys'],
    queryFn: async () => {
      const response = await api.get<{ items: ApiKeyData[]; total: number }>('/api-keys')
      return response.data?.items || []
    },
    enabled: isAuthenticated,
  })

  // 交易所 logo 映射
  const exchangeLogos: Record<string, string> = {
    binance: '/icons/exchanges/币安.webp',
    okx: '/icons/exchanges/okx.webp',
    bybit: '/icons/exchanges/bybit.webp',
    gate: '/icons/exchanges/gate.webp',
    bitget: '/icons/exchanges/bitget.webp',
    coinbase: '/icons/exchanges/coinbase.webp',
    hyperliquid: '/icons/exchanges/hyperliquid.webp',
    aster: '/icons/exchanges/aster-dex.webp',
    lighter: '/icons/exchanges/lighter.webp',
  }

  // 分离 CEX 和 DEX（放在 useQueries 之前，确保索引一致）
  const cexApiKeysRaw = (apiKeysData || []).filter((key: ApiKeyData) => !key.authType || key.authType === 'api_key')
  const dexWallets = (apiKeysData || []).filter((key: ApiKeyData) => key.authType === 'wallet')

  // 仅为 CEX API Key 获取实时余额（30秒缓存）— 索引与 cexApiKeysRaw 一致
  const apiKeyBalanceQueries = useQueries({
    queries: cexApiKeysRaw.map((key: ApiKeyData) => ({
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
      staleTime: 30 * 1000, // 30秒缓存
      refetchOnWindowFocus: true,
    })),
  })

  // 截断钱包地址显示
  const truncateAddress = (address: string) => {
    if (address.length <= 10) return address
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  // 转换为组件需要的格式（使用 label 代替 exchange 名称）— 仅 CEX
  const apiKeys: APIKeyItem[] = cexApiKeysRaw.map((key: ApiKeyData, index: number) => {
    const balanceQuery = apiKeyBalanceQueries[index]
    const balanceData = balanceQuery?.data
    const isVerifyFailed = balanceData && balanceData.valid === false

    return {
      id: key.id,
      name: key.label || key.exchange, // 用户备注名称，如果没有则使用交易所名称
      exchange: key.exchange, // 交易所名称
      icon: exchangeLogos[key.exchange.toLowerCase()] || '/icons/exchanges/default.webp',
      status: isVerifyFailed ? 'error' : (key.isActive ? 'active' : 'error'),
      apiKey: key.maskedKey || '****',
      permissions: balanceData?.permissions || [],
      createdAt: new Date(key.createdAt).toLocaleDateString('zh-CN'),
      balance: balanceData?.totalUsdValue || 0,
      error: isVerifyFailed ? (balanceData?.error || '无法连接到交易所') : (key.isActive ? undefined : 'API Key 已禁用'),
      isLoading: balanceQuery?.isLoading || balanceQuery?.isFetching,
    }
  })

  // 获取代币图标
  const getAssetIcon = (asset: string) => {
    if (asset.includes('USDT')) return '/icons/usdt.svg'
    if (asset.includes('HOOT')) return '/icons/hoot/token.png'
    if (asset === 'POINT') return '/icons/gas-card.svg'
    return null
  }

  return (
    <div className="min-h-screen bg-[#0A0A0F] pb-20">
      {/* Header - 标题 */}
      <div className="sticky top-0 z-50 bg-[#0A0A0F]/95 backdrop-blur-lg border-b border-[#1E1E2E]">
        <div className="flex items-center justify-center px-4 h-14">
          <h1 className="text-base font-semibold text-white">{t('title')}</h1>
        </div>
      </div>

      {/* 主 Tab 切换 */}
      <div className="px-4 pt-4">
        <div className="flex gap-2 p-1 bg-[#12121A] rounded-xl">
          <button
            type="button"
            onClick={() => setMainTab("wallet")}
            aria-label="钱包"
            className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${
              mainTab === "wallet"
                ? "bg-[#06B6D4] text-white shadow-lg shadow-[#06B6D4]/20"
                : "text-[#94A3B8] hover:text-white"
            }`}
          >
            钱包
          </button>
          <button
            type="button"
            onClick={() => setMainTab("api")}
            aria-label={t('api')}
            className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${
              mainTab === "api"
                ? "bg-[#06B6D4] text-white shadow-lg shadow-[#06B6D4]/20"
                : "text-[#94A3B8] hover:text-white"
            }`}
          >
            {t('api')}
          </button>
          <button
            type="button"
            onClick={() => setMainTab("ecosystem")}
            aria-label={t('ecosystem')}
            className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${
              mainTab === "ecosystem"
                ? "bg-[#06B6D4] text-white shadow-lg shadow-[#06B6D4]/20"
                : "text-[#94A3B8] hover:text-white"
            }`}
          >
            {t('ecosystem')}
          </button>
        </div>
      </div>

      {/* 钱包 Tab 内容 */}
      {mainTab === "wallet" && (
        <div className="px-4 pt-4 space-y-4">
          {/* 资产卡片 - 呼吸光感效果 */}
          <div className="glow-card relative overflow-hidden bg-gradient-to-br from-[#12121A]/80 to-[#1A1A24]/80 rounded-2xl p-6 border border-cyan-500/10 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
            {/* 顶部高光线 */}
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/30 to-transparent" />
            {/* 内发光效果 */}
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-cyan-400/[0.06] via-transparent to-transparent pointer-events-none" />
            {/* 呼吸光晕 */}
            <div className="absolute -top-20 -right-20 w-40 h-40 bg-cyan-500/10 rounded-full blur-3xl animate-pulse" />
            <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-cyan-500/5 rounded-full blur-2xl animate-[pulse_2s_ease-in-out_infinite_1s]" />
            <div className="relative z-10">
              <p className="text-sm text-[#94A3B8] mb-1">{t('totalAssets')}</p>
              <div className="flex items-baseline gap-3 mb-4">
                <h2 className="text-3xl font-bold text-white">
                  ${totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </h2>
                {/* 日变化率暂时隐藏，后续接入行情 API 后启用 */}
              </div>

              {/* 快捷操作按钮 - 标准移动端尺寸 */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onNavigate?.('/wallet/deposit')}
                  aria-label={t('deposit')}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-[#06B6D4] hover:bg-[#06B6D4]/90 active:scale-[0.97] active:opacity-80 text-white rounded-xl text-sm font-medium transition-all duration-100 select-none"
                >
                  <ArrowUpRight className="w-4 h-4" />
                  {t('deposit')}
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate?.('/wallet/withdraw')}
                  aria-label={t('withdraw')}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-[#1E1E2E] border border-[#2A2A3A] hover:border-[#06B6D4] active:scale-[0.97] active:opacity-80 text-white rounded-xl text-sm font-medium transition-all duration-100 select-none"
                >
                  <ArrowDownLeft className="w-4 h-4" />
                  {t('withdraw')}
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate?.('/wallet/exchange')}
                  aria-label={t('exchange')}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-[#1E1E2E] border border-[#2A2A3A] hover:border-[#06B6D4] active:scale-[0.97] active:opacity-80 text-white rounded-xl text-sm font-medium transition-all duration-100 select-none"
                >
                  <ArrowLeftRight className="w-4 h-4" />
                  {t('exchange')}
                </button>
              </div>
            </div>
          </div>

          {/* 子 Tab 切换 */}
          <div className="flex gap-6 border-b border-[#1E1E2E]">
            <button
              type="button"
              onClick={() => setWalletSubTab("assets")}
              aria-label={t('assetDetails')}
              className={`pb-3 text-sm font-medium transition-colors relative ${
                walletSubTab === "assets"
                  ? "text-[#06B6D4]"
                  : "text-[#94A3B8] hover:text-white"
              }`}
            >
              {t('assetDetails')}
              {walletSubTab === "assets" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#06B6D4]" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setWalletSubTab("history")}
              aria-label={t('historyBills')}
              className={`pb-3 text-sm font-medium transition-colors relative ${
                walletSubTab === "history"
                  ? "text-[#06B6D4]"
                  : "text-[#94A3B8] hover:text-white"
              }`}
            >
              {t('historyBills')}
              {walletSubTab === "history" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#06B6D4]" />
              )}
            </button>
          </div>

          {/* 资产明细列表 */}
          {walletSubTab === "assets" && (
            <div className="space-y-3">
              {assets.map((asset, index) => (
                <div
                  key={index}
                  className={`bg-[#12121A] rounded-xl p-4 border transition-colors ${
                    asset.locked
                      ? 'border-[#F59E0B]/30'
                      : 'border-[#1E1E2E] hover:border-[#06B6D4]/30'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    {/* 左侧：图标 + 名称 */}
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#2A2A3A] flex items-center justify-center overflow-hidden relative">
                        {asset.icon ? (
                          <Image
                            src={asset.icon}
                            alt={asset.name}
                            fill
                            sizes="40px"
                            className="object-contain"
                          />
                        ) : (
                          <span className="text-xs font-bold text-[#06B6D4]">{asset.symbol.charAt(0)}</span>
                        )}
                      </div>
                      <div>
                        <h3 className={`font-medium ${asset.locked ? 'text-[#F59E0B]' : 'text-white'}`}>
                          {asset.name}
                        </h3>
                        {asset.locked && asset.releaseInfo && (
                          <p className="text-xs text-[#F59E0B]/70">{asset.releaseInfo}</p>
                        )}
                      </div>
                    </div>

                    {/* 右侧：数量 + 价值 */}
                    <div className="text-right">
                      <p className={`font-semibold ${asset.locked ? 'text-[#F59E0B]' : 'text-white'}`}>
                        {asset.amount}
                      </p>
                      <p className="text-sm text-[#94A3B8]">
                        ≈ ${asset.value}
                      </p>
                    </div>
                  </div>

                  {/* 释放进度条 */}
                  {asset.locked && asset.releaseProgress !== undefined && (
                    <div className="mt-3 pt-3 border-t border-[#1E1E2E]">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-1.5 bg-[#1A1A24] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-[#F59E0B] to-[#D97706] rounded-full"
                            style={{ width: `${asset.releaseProgress}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium text-[#F59E0B] whitespace-nowrap">
                          {asset.releaseProgress}%
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* 历史账单 */}
          {walletSubTab === "history" && (
            <div className="space-y-4">
              {/* 筛选按钮组 - 下拉筛选器 */}
              <div className="flex gap-2">
                {/* 类型筛选 */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setShowTypeFilter(!showTypeFilter)
                      setShowAssetFilter(false)
                      setShowDatePicker(false)
                    }}
                    className={`flex items-center gap-1.5 px-3 py-2 bg-[#12121A] border rounded-lg text-sm transition-colors ${
                      txTypeFilter !== 'all'
                        ? 'border-[#06B6D4] text-[#06B6D4]'
                        : 'border-[#1E1E2E] text-[#94A3B8] hover:border-[#06B6D4]'
                    }`}
                  >
                    <span>{getTypeLabel(txTypeFilter)}</span>
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showTypeFilter ? 'rotate-180' : ''}`} />
                  </button>
                  {showTypeFilter && (
                    <div className="absolute top-full left-0 mt-1 w-32 bg-[#12121A]/95 backdrop-blur-xl border border-[#1E1E2E] rounded-lg shadow-lg z-50 overflow-hidden">
                      {typeFilterOptions.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => {
                            setTxTypeFilter(option.value as typeof txTypeFilter)
                            setShowTypeFilter(false)
                          }}
                          className={`w-full px-3 py-2.5 text-left text-sm transition-colors ${
                            txTypeFilter === option.value
                              ? 'bg-[#06B6D4]/10 text-[#06B6D4]'
                              : 'text-white hover:bg-[#1E1E2E]'
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* 资产筛选 */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAssetFilter(!showAssetFilter)
                      setShowTypeFilter(false)
                      setShowDatePicker(false)
                    }}
                    className={`flex items-center gap-1.5 px-3 py-2 bg-[#12121A] border rounded-lg text-sm transition-colors ${
                      txAssetFilter !== 'all'
                        ? 'border-[#06B6D4] text-[#06B6D4]'
                        : 'border-[#1E1E2E] text-[#94A3B8] hover:border-[#06B6D4]'
                    }`}
                  >
                    <span>{getAssetLabel(txAssetFilter)}</span>
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAssetFilter ? 'rotate-180' : ''}`} />
                  </button>
                  {showAssetFilter && (
                    <div className="absolute top-full left-0 mt-1 w-32 bg-[#12121A]/95 backdrop-blur-xl border border-[#1E1E2E] rounded-lg shadow-lg z-50 overflow-hidden">
                      {assetFilterOptions.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => {
                            setTxAssetFilter(option.value as typeof txAssetFilter)
                            setShowAssetFilter(false)
                          }}
                          className={`w-full px-3 py-2.5 text-left text-sm transition-colors ${
                            txAssetFilter === option.value
                              ? 'bg-[#06B6D4]/10 text-[#06B6D4]'
                              : 'text-white hover:bg-[#1E1E2E]'
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* 时间选择 */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setShowDatePicker(!showDatePicker)
                      setShowTypeFilter(false)
                      setShowAssetFilter(false)
                    }}
                    className="flex items-center gap-1.5 px-3 py-2 bg-[#12121A] border border-[#06B6D4] rounded-lg text-sm text-[#06B6D4] transition-colors"
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    <span className="text-xs">{dateRange.start.slice(5)} ~ {dateRange.end.slice(5)}</span>
                  </button>
                  {showDatePicker && (
                    <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center">
                      <div className="w-full max-w-md bg-[#12121A] rounded-t-2xl p-4 space-y-4 animate-in slide-in-from-bottom">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-semibold text-white">{t('startDate')} ~ {t('endDate')}</h3>
                          <button
                            type="button"
                            onClick={() => setShowDatePicker(false)}
                            className="p-1 rounded-lg hover:bg-[#1E1E2E]"
                          >
                            <X className="w-5 h-5 text-[#94A3B8]" />
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label htmlFor="mobile-date-start" className="text-xs text-[#94A3B8] mb-1 block">{t('startDate')}</label>
                            <input
                              id="mobile-date-start"
                              type="date"
                              value={dateRange.start}
                              onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                              className="w-full bg-[#0A0A0F] border border-[#1E1E2E] rounded-lg px-3 py-2.5 text-sm text-white focus:border-cyan-500/50 focus:outline-none"
                            />
                          </div>
                          <div>
                            <label htmlFor="mobile-date-end" className="text-xs text-[#94A3B8] mb-1 block">{t('endDate')}</label>
                            <input
                              id="mobile-date-end"
                              type="date"
                              value={dateRange.end}
                              onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                              className="w-full bg-[#0A0A0F] border border-[#1E1E2E] rounded-lg px-3 py-2.5 text-sm text-white focus:border-cyan-500/50 focus:outline-none"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {[
                            { label: t('thisWeek'), days: 7 },
                            { label: t('thisMonth'), days: 30 },
                            { label: t('last3Months'), days: 90 },
                          ].map((preset) => (
                            <button
                              key={preset.label}
                              type="button"
                              onClick={() => {
                                const end = new Date()
                                const start = new Date()
                                start.setDate(start.getDate() - preset.days)
                                setDateRange({
                                  start: start.toISOString().split('T')[0],
                                  end: end.toISOString().split('T')[0]
                                })
                              }}
                              className="flex-1 py-2 text-xs bg-[#1E1E2E] hover:bg-[#2A2A3A] text-[#94A3B8] rounded-lg transition-colors"
                            >
                              {preset.label}
                            </button>
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowDatePicker(false)}
                          className="w-full py-3 bg-[#06B6D4] text-white rounded-xl font-medium hover:bg-[#0891B2] transition-colors"
                        >
                          {t('confirm')}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* 清除筛选 */}
                {(txTypeFilter !== 'all' || txAssetFilter !== 'all') && (
                  <button
                    type="button"
                    onClick={() => {
                      setTxTypeFilter('all')
                      setTxAssetFilter('all')
                    }}
                    className="px-3 py-2 text-xs text-[#94A3B8] hover:text-white transition-colors"
                  >
                    {tCommon('cancel')}
                  </button>
                )}
              </div>

              {/* 交易记录列表 */}
              <div className="space-y-3">
                {filteredTransactions.map((tx) => {
                  const statusInfo = getStatusInfo(tx.status)
                  const assetIcon = getAssetIcon(tx.asset)
                  return (
                    <div
                      key={tx.id}
                      className="bg-[#12121A] rounded-xl p-4 border border-[#1E1E2E] hover:bg-[#12121A]/80 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {/* 代币图标 */}
                        <div className="w-10 h-10 rounded-full bg-[#2A2A3A] flex items-center justify-center overflow-hidden relative flex-shrink-0">
                          {assetIcon ? (
                            <Image
                              src={assetIcon}
                              alt={tx.asset}
                              fill
                              sizes="40px"
                              className="object-contain"
                            />
                          ) : (
                            <span className="text-xs font-bold text-[#06B6D4]">
                              {tx.asset.charAt(0)}
                            </span>
                          )}
                        </div>

                        {/* 交易信息 */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium text-white">
                              {getTypeText(tx.type)}
                            </h4>
                            <p
                              className={`text-lg font-bold ${
                                tx.trend === "up"
                                  ? "text-[#22C55E]"
                                  : "text-[#94A3B8]"
                              }`}
                            >
                              {tx.amount}
                            </p>
                          </div>
                          <div className="flex items-center justify-between mt-1">
                            <p className="text-sm text-[#94A3B8]">{tx.asset}</p>
                            <div className="flex items-center gap-1">
                              {statusInfo.icon}
                              <span className={`text-xs ${statusInfo.color}`}>
                                {statusInfo.text}
                              </span>
                            </div>
                          </div>
                          {/* 失败原因 */}
                          {tx.remark && tx.status !== 'completed' && tx.status !== 'pending' && tx.status !== 'processing' && (
                            <p className="text-xs text-[#EF4444]/80 mt-1.5 bg-[#EF4444]/5 rounded px-2 py-1">
                              {tx.remark}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* 时间 */}
                      <p className="text-xs text-[#94A3B8] flex items-center gap-1 mt-3 pt-3 border-t border-[#1E1E2E]">
                        <Calendar className="w-3 h-3" />
                        {tx.time}
                      </p>
                    </div>
                  )
                })}
              </div>

              {/* 空状态 */}
              {filteredTransactions.length === 0 && (
                <div className="text-center py-12">
                  <div className="w-16 h-16 rounded-full bg-[#12121A] flex items-center justify-center mx-auto mb-4">
                    <FileText className="w-8 h-8 text-[#94A3B8]" />
                  </div>
                  <p className="text-[#94A3B8]">
                    {txTypeFilter === 'all' && txAssetFilter === 'all'
                      ? t('noRecords')
                      : t('noMatchingRecords')}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* API Tab 内容 */}
      {mainTab === "api" && (
        <div className="px-4 pt-4 space-y-4">
          {/* CEX / DEX 子标签切换 */}
          <div className="flex gap-2 p-1 bg-[#12121A] rounded-xl border border-[#1E1E2E]">
            <button
              type="button"
              onClick={() => setApiSubTab('cex')}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                apiSubTab === 'cex'
                  ? 'bg-[#06B6D4]/10 text-[#06B6D4] border border-[#06B6D4]'
                  : 'text-[#94A3B8] hover:text-white'
              }`}
            >
              CEX 交易所
            </button>
            <button
              type="button"
              onClick={() => setApiSubTab('dex')}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                apiSubTab === 'dex'
                  ? 'bg-[#06B6D4]/10 text-[#06B6D4] border border-[#06B6D4]'
                  : 'text-[#94A3B8] hover:text-white'
              }`}
            >
              DEX 钱包
            </button>
          </div>

          {/* 添加按钮 - 根据子标签切换 */}
          <button
            type="button"
            onClick={() => apiSubTab === 'cex' ? handleOpenAdd() : setShowAddDexModal(true)}
            aria-label={apiSubTab === 'cex' ? t('addApi') : tDex('addWallet')}
            className="w-full flex items-center justify-center gap-2 py-3 bg-[#06B6D4] hover:bg-[#06B6D4]/90 text-white rounded-xl font-medium transition-colors"
          >
            <Plus className="w-5 h-5" />
            {apiSubTab === 'cex' ? t('addApi') : tDex('addWallet')}
          </button>

          {/* ===== CEX API 列表 ===== */}
          {apiSubTab === 'cex' && (
            <>
              {apiKeys.length === 0 ? (
                <div className="p-8 rounded-xl bg-[#12121A] border border-[#1E1E2E] text-center">
                  <Key className="w-12 h-12 text-[#94A3B8] mx-auto mb-3" />
                  <p className="text-[#94A3B8]">{t('noApiKey')}</p>
                  <p className="text-[#94A3B8] text-sm mt-1">{t('clickToAdd')}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {apiKeys.map((apiItem) => (
                    <div
                      key={apiItem.id}
                      className={`bg-[#12121A] rounded-xl p-4 border transition-colors ${
                        apiItem.status === 'error' ? 'border-[#F43F5E]/30' : 'border-[#1E1E2E]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden relative ${
                            apiItem.status === 'error' ? 'bg-[#F43F5E]/10' : 'bg-[#1E1E2E]'
                          }`}>
                            {apiItem.icon ? (
                              <Image src={apiItem.icon} alt={apiItem.name} fill sizes="40px" className={`object-contain ${apiItem.status === 'error' ? 'opacity-50' : ''}`} />
                            ) : (
                              <span className="text-lg text-white">{apiItem.name.charAt(0)}</span>
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-medium text-white">{apiItem.name}</h3>
                              {apiItem.isLoading ? (
                                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-[#3B82F6]/20 text-[#3B82F6]">
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                </span>
                              ) : apiItem.status === 'error' ? (
                                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-[#F43F5E]/20 text-[#F43F5E]">
                                  <AlertTriangle className="w-3 h-3" />
                                </span>
                              ) : (
                                <CheckCircle className="w-4 h-4 text-[#10B981]" />
                              )}
                            </div>
                            {apiItem.isLoading ? (
                              <p className="text-sm text-[#94A3B8] flex items-center gap-1">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                {t('loadingBalance')}
                              </p>
                            ) : apiItem.status === 'error' && apiItem.error ? (
                              <p className="text-xs text-[#F43F5E]">{apiItem.error}</p>
                            ) : (
                              <p className="text-lg font-bold text-[#10B981]">
                                ${apiItem.balance?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={() => handleVerify(apiItem)} aria-label={t('verify')} className="p-2 hover:bg-[#1E1E2E] rounded-lg transition-colors">
                            <RefreshCw className="w-4 h-4 text-[#94A3B8]" />
                          </button>
                          <button type="button" onClick={() => handleOpenEdit(apiItem)} aria-label={t('edit')} className="p-2 hover:bg-[#1E1E2E] rounded-lg transition-colors">
                            <Edit2 className="w-4 h-4 text-[#94A3B8]" />
                          </button>
                          <button type="button" onClick={() => handleOpenDelete(apiItem)} aria-label={t('delete')} className="p-2 hover:bg-[#F43F5E]/10 rounded-lg transition-colors">
                            <Trash2 className="w-4 h-4 text-[#F43F5E]/70" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ===== DEX 钱包列表 ===== */}
          {apiSubTab === 'dex' && (
            <>
              {dexWallets.length === 0 ? (
                <div className="p-8 rounded-xl bg-[#12121A] border border-[#1E1E2E] text-center">
                  <Wallet className="w-12 h-12 text-[#94A3B8] mx-auto mb-3" />
                  <p className="text-[#94A3B8]">{tDex('noWallets')}</p>
                  <p className="text-[#94A3B8] text-sm mt-1">{tDex('noWalletsHint')}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {dexWallets.map((wallet) => {
                    const dexInfo = supportedDexExchanges.find(e => e.id === wallet.exchange)
                    return (
                      <div key={wallet.id} className="bg-[#12121A] rounded-xl p-4 border border-[#1E1E2E]">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-[#1E1E2E] flex items-center justify-center overflow-hidden relative">
                              {dexInfo?.logo ? (
                                <Image src={dexInfo.logo} alt={dexInfo.name} fill sizes="40px" className="object-contain" />
                              ) : (
                                <span className="text-lg text-white">{wallet.exchange.charAt(0).toUpperCase()}</span>
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="font-medium text-white">{wallet.label}</h3>
                                {wallet.isActive ? (
                                  <CheckCircle className="w-4 h-4 text-[#10B981]" />
                                ) : (
                                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-[#F43F5E]/20 text-[#F43F5E]">
                                    <AlertTriangle className="w-3 h-3" />
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-[#94A3B8] font-mono mt-0.5">
                                {wallet.walletAddress ? truncateAddress(wallet.walletAddress) : wallet.maskedKey}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button type="button" onClick={() => queryClient.invalidateQueries({ queryKey: ['api-keys'] })} aria-label={t('verify')} className="p-2 hover:bg-[#1E1E2E] rounded-lg transition-colors">
                              <RefreshCw className="w-4 h-4 text-[#94A3B8]" />
                            </button>
                            <button type="button" onClick={() => handleOpenDeleteDex(wallet)} aria-label={t('delete')} className="p-2 hover:bg-[#F43F5E]/10 rounded-lg transition-colors">
                              <Trash2 className="w-4 h-4 text-[#F43F5E]/70" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* 生态 Tab 内容 - 使用独立组件 */}
      {mainTab === "ecosystem" && (
        <div className="pt-2">
          <MobileEcosystemV3 embedded />
        </div>
      )}

      {/* ===== 弹窗组件 ===== */}

      {/* 移动端弹窗动画样式 */}
      <style>{`
        @keyframes slideUp {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleIn {
          from {
            transform: scale(0.95);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }
        .mobile-sheet {
          animation: slideUp 0.3s ease-out forwards;
        }
        .mobile-overlay {
          animation: fadeIn 0.2s ease-out forwards;
        }
        .mobile-dialog {
          animation: scaleIn 0.2s ease-out forwards;
        }
      `}</style>

      {/* 添加 API Key 弹窗 - 底部抽屉式 */}
      {showAddModal && (
        <div
          className="fixed inset-0 bg-black/70 z-[100] mobile-overlay"
          onClick={() => {
            setShowAddModal(false)
            setSelectedExchange(null)
            setFormData({ apiKey: '', secretKey: '', passphrase: '', label: '' })
          }}
        >
          <div
            className="absolute bottom-0 left-0 right-0 max-h-[85vh] bg-[#12121A] rounded-t-3xl overflow-hidden mobile-sheet"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 拖动指示器 */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 bg-[#3A3A4A] rounded-full" />
            </div>

            <div className="px-5 pb-8 pt-2 overflow-y-auto max-h-[calc(85vh-40px)]">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-bold text-white">
                  {selectedExchange
                    ? t('bindApiTitle', { name: supportedExchanges.find(e => e.id === selectedExchange)?.name || '' })
                    : t('selectExchange')
                  }
                </h3>
                <button
                  type="button"
                  title={t('close')}
                  onClick={() => {
                    setShowAddModal(false)
                    setSelectedExchange(null)
                    setFormData({ apiKey: '', secretKey: '', passphrase: '', label: '' })
                  }}
                  className="p-2 hover:bg-[#1E1E2E] rounded-lg transition-colors -mr-2"
                >
                  <X className="w-5 h-5 text-[#94A3B8]" />
                </button>
              </div>

            {!selectedExchange ? (
              <div className="grid grid-cols-3 gap-3">
                {supportedExchanges.map((exchange) => (
                  <button
                    key={exchange.id}
                    type="button"
                    onClick={() => setSelectedExchange(exchange.id)}
                    className="p-4 rounded-xl bg-[#1E1E2E] hover:bg-[#2A2A3A] transition-colors text-center"
                  >
                    <div className="w-10 h-10 mx-auto mb-2 rounded-lg bg-[#12121A] flex items-center justify-center overflow-hidden relative">
                      <Image src={exchange.logo} alt={exchange.name} fill className="object-contain" />
                    </div>
                    <span className="text-xs text-white">{exchange.name}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                <a
                  href={supportedExchanges.find(e => e.id === selectedExchange)?.guideUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-[#06B6D4] text-sm hover:underline"
                >
                  <ExternalLink className="w-4 h-4" />
                  {t('howToGetApiKey')}
                </a>

                <div>
                  <label htmlFor="mobile-add-api-key" className="text-sm text-[#94A3B8] block mb-1">API Key *</label>
                  <input
                    id="mobile-add-api-key"
                    type="text"
                    value={formData.apiKey}
                    onChange={(e) => {
                      const value = e.target.value
                      setFormData(prev => ({ ...prev, apiKey: value }))
                    }}
                    onInput={(e) => {
                      const value = (e.target as HTMLInputElement).value
                      setFormData(prev => ({ ...prev, apiKey: value }))
                    }}
                    autoComplete="off"
                    placeholder={t('enterApiKey')}
                    className="w-full px-4 py-3 rounded-lg bg-[#1E1E2E] border border-[#2A2A3A] text-white placeholder-[#64748B] focus:outline-none focus:border-[#06B6D4]"
                  />
                </div>

                <div>
                  <label htmlFor="mobile-add-secret-key" className="text-sm text-[#94A3B8] block mb-1">Secret Key *</label>
                  <div className="relative">
                    <input
                      id="mobile-add-secret-key"
                      type={showSecret ? 'text' : 'password'}
                      value={formData.secretKey}
                      onChange={(e) => {
                        const value = e.target.value
                        setFormData(prev => ({ ...prev, secretKey: value }))
                      }}
                      onInput={(e) => {
                        const value = (e.target as HTMLInputElement).value
                        setFormData(prev => ({ ...prev, secretKey: value }))
                      }}
                      autoComplete="off"
                      placeholder={t('enterSecretKey')}
                      className="w-full px-4 py-3 pr-12 rounded-lg bg-[#1E1E2E] border border-[#2A2A3A] text-white placeholder-[#64748B] focus:outline-none focus:border-[#06B6D4]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSecret(!showSecret)}
                      title={showSecret ? t('hideSecret') : t('showSecret')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#94A3B8]"
                    >
                      {showSecret ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {selectedExchange === 'okx' && (
                  <div>
                    <label htmlFor="mobile-add-passphrase" className="text-sm text-[#94A3B8] block mb-1">Passphrase *</label>
                    <input
                      id="mobile-add-passphrase"
                      type="password"
                      value={formData.passphrase}
                      onChange={(e) => {
                        const value = e.target.value
                        setFormData(prev => ({ ...prev, passphrase: value }))
                      }}
                      onInput={(e) => {
                        const value = (e.target as HTMLInputElement).value
                        setFormData(prev => ({ ...prev, passphrase: value }))
                      }}
                      autoComplete="off"
                      placeholder={t('enterPassphrase')}
                      className="w-full px-4 py-3 rounded-lg bg-[#1E1E2E] border border-[#2A2A3A] text-white placeholder-[#64748B] focus:outline-none focus:border-[#06B6D4]"
                    />
                  </div>
                )}

                <div>
                  <label htmlFor="mobile-add-label" className="text-sm text-[#94A3B8] block mb-1">{t('labelOptional')}</label>
                  <input
                    id="mobile-add-label"
                    type="text"
                    value={formData.label}
                    onChange={(e) => {
                      const value = e.target.value
                      setFormData(prev => ({ ...prev, label: value }))
                    }}
                    onInput={(e) => {
                      const value = (e.target as HTMLInputElement).value
                      setFormData(prev => ({ ...prev, label: value }))
                    }}
                    autoComplete="off"
                    placeholder={t('labelPlaceholder')}
                    className="w-full px-4 py-3 rounded-lg bg-[#1E1E2E] border border-[#2A2A3A] text-white placeholder-[#64748B] focus:outline-none focus:border-[#06B6D4]"
                  />
                </div>

                <div className="p-3 rounded-lg bg-[#1E1E2E] border border-[#2A2A3A]">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-white">{t('ipWhitelist')}</p>
                      <p className="text-[#94A3B8] text-xs">{t('ipWhitelistTip')}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopy('47.89.192.xxx')}
                      className="flex items-center gap-1 text-[#06B6D4] text-sm"
                    >
                      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      {copied ? t('copied') : t('copy')}
                    </button>
                  </div>
                  <p className="font-mono text-sm mt-2 text-[#94A3B8]">47.89.192.xxx</p>
                </div>

                {/* 安全提示 */}
                <div className="p-3 rounded-lg bg-[#12121A] border-l-4 border-l-[#06B6D4] border border-[#1E1E2E]">
                  <div className="flex items-start gap-2">
                    <Shield className="w-4 h-4 text-[#06B6D4] mt-0.5 flex-shrink-0" />
                    <ul className="text-[#94A3B8] text-xs space-y-1">
                      <li>• {t('securityTip1')}</li>
                      <li>• {t('securityTip2')}</li>
                    </ul>
                  </div>
                </div>

                {/* 底部按钮固定 */}
                <div className="flex gap-3 pt-4 pb-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false)
                      setSelectedExchange(null)
                      setFormData({ apiKey: '', secretKey: '', passphrase: '', label: '' })
                    }}
                    className="flex-1 py-3.5 border border-[#2A2A3A] text-[#94A3B8] rounded-xl hover:bg-[#1E1E2E] transition-colors font-medium"
                  >
                    {tCommon('cancel')}
                  </button>
                  <button
                    type="button"
                    onClick={handleAddApiKey}
                    disabled={createApiKeyMutation.isPending || !formData.apiKey || !formData.secretKey}
                    className="flex-1 py-3.5 bg-[#06B6D4] hover:bg-[#06B6D4]/90 text-white rounded-xl transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {createApiKeyMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                    {t('verifyAndBind')}
                  </button>
                </div>
              </div>
            )}
            </div>
          </div>
        </div>
      )}

      {/* 编辑 API Key 弹窗 - 底部抽屉式 */}
      {showEditModal && selectedApiKey && (
        <div
          className="fixed inset-0 bg-black/70 z-[100] mobile-overlay"
          onClick={() => {
            setShowEditModal(false)
            setSelectedApiKey(null)
          }}
        >
          <div
            className="absolute bottom-0 left-0 right-0 max-h-[85vh] bg-[#12121A] rounded-t-3xl overflow-hidden mobile-sheet"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 拖动指示器 */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 bg-[#3A3A4A] rounded-full" />
            </div>

            <div className="px-5 pb-8 pt-2 overflow-y-auto max-h-[calc(85vh-40px)]">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-[#1E1E2E] flex items-center justify-center overflow-hidden relative">
                    {selectedApiKey.icon ? (
                      <Image src={selectedApiKey.icon} alt={selectedApiKey.name} fill className="object-contain" />
                    ) : (
                      <span className="text-lg text-white">{selectedApiKey.name.charAt(0)}</span>
                    )}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">{t('editApiTitle', { name: selectedApiKey.name })}</h3>
                    <p className="text-[#94A3B8] text-xs">{t('updateApiConfig')}</p>
                  </div>
                </div>
                <button
                  type="button"
                  title={t('close')}
                  onClick={() => {
                    setShowEditModal(false)
                    setSelectedApiKey(null)
                  }}
                  className="p-2 hover:bg-[#1E1E2E] rounded-lg transition-colors -mr-2"
                >
                  <X className="w-5 h-5 text-[#94A3B8]" />
                </button>
              </div>

              <div className="space-y-4">
              {/* 绑定信息卡片 */}
              <div className="p-4 rounded-xl bg-[#0A0A0F] border border-[#1E1E2E] space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-[#94A3B8]">API Key</p>
                    <p className="font-mono text-[#94A3B8] text-sm mt-0.5">{selectedApiKey.apiKey}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-[#94A3B8]">{t('bindTime')}</p>
                    <p className="text-[#94A3B8] text-sm mt-0.5">{selectedApiKey.createdAt || '-'}</p>
                  </div>
                </div>
                {selectedApiKey.permissions && selectedApiKey.permissions.length > 0 && (
                  <div className="pt-3 border-t border-[#1E1E2E]">
                    <p className="text-xs text-[#94A3B8] mb-2">{t('authorizedPermissions')}</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedApiKey.permissions.map((perm, i) => (
                        <span key={i} className="px-2 py-1 text-xs rounded-md bg-[#1E1E2E] text-[#10B981]">
                          {perm}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label htmlFor="mobile-edit-api-key" className="text-sm text-[#94A3B8] block mb-1">{t('newApiKeyOptional')}</label>
                <input
                  id="mobile-edit-api-key"
                  type="text"
                  value={editFormData.apiKey}
                  onChange={(e) => setEditFormData({ ...editFormData, apiKey: e.target.value })}
                  placeholder={t('enterNewApiKey')}
                  className="w-full px-4 py-3 rounded-lg bg-[#1E1E2E] border border-[#2A2A3A] text-white placeholder-[#64748B] focus:outline-none focus:border-[#06B6D4]"
                />
              </div>

              <div>
                <label htmlFor="mobile-edit-secret-key" className="text-sm text-[#94A3B8] block mb-1">{t('newSecretKeyOptional')}</label>
                <div className="relative">
                  <input
                    id="mobile-edit-secret-key"
                    type={showSecret ? 'text' : 'password'}
                    value={editFormData.secretKey}
                    onChange={(e) => setEditFormData({ ...editFormData, secretKey: e.target.value })}
                    placeholder={t('enterNewSecretKey')}
                    className="w-full px-4 py-3 pr-12 rounded-lg bg-[#1E1E2E] border border-[#2A2A3A] text-white placeholder-[#64748B] focus:outline-none focus:border-[#06B6D4]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                    title={showSecret ? t('hideSecret') : t('showSecret')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#94A3B8]"
                  >
                    {showSecret ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="mobile-edit-label" className="text-sm text-[#94A3B8] block mb-1">{t('labelName')}</label>
                <input
                  id="mobile-edit-label"
                  type="text"
                  value={editFormData.label}
                  onChange={(e) => setEditFormData({ ...editFormData, label: e.target.value })}
                  placeholder={t('labelPlaceholder')}
                  className="w-full px-4 py-3 rounded-lg bg-[#1E1E2E] border border-[#2A2A3A] text-white placeholder-[#64748B] focus:outline-none focus:border-[#06B6D4]"
                />
              </div>

              <div className="flex gap-3 pt-4 pb-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false)
                    setSelectedApiKey(null)
                  }}
                  className="flex-1 py-3.5 border border-[#2A2A3A] text-[#94A3B8] rounded-xl hover:bg-[#1E1E2E] transition-colors font-medium"
                >
                  {tCommon('cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleConfirmEdit}
                  disabled={updateApiKeyMutation.isPending}
                  className="flex-1 py-3.5 bg-[#06B6D4] hover:bg-[#06B6D4]/90 text-white rounded-xl transition-colors font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {updateApiKeyMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  {t('saveChanges')}
                </button>
              </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 删除确认弹窗 - 居中对话框 */}
      {showDeleteModal && selectedApiKey && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100] p-5 mobile-overlay"
          onClick={() => {
            setShowDeleteModal(false)
            setSelectedApiKey(null)
          }}
        >
          <div
            className="w-full max-w-sm bg-[#12121A] border border-[#1E1E2E] rounded-2xl p-5 mobile-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#F43F5E]/10 flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-[#F43F5E]" />
              </div>

              <h3 className="text-xl font-bold text-white mb-2">{t('confirmDelete')}</h3>
              <p className="text-[#94A3B8] text-sm mb-5">
                {t('deleteApiConfirm', { name: selectedApiKey.name })}
              </p>

              <div className="flex items-center gap-3 p-3 mb-4 rounded-xl bg-[#1E1E2E]/50 border border-[#2A2A3A]">
                <div className="w-10 h-10 rounded-xl bg-[#2A2A3A] flex items-center justify-center overflow-hidden relative">
                  {selectedApiKey.icon ? (
                    <Image src={selectedApiKey.icon} alt={selectedApiKey.name} fill className="object-contain" />
                  ) : (
                    <span className="text-lg text-white">{selectedApiKey.name.charAt(0)}</span>
                  )}
                </div>
                <div className="text-left min-w-0">
                  <p className="font-semibold text-white text-sm">{selectedApiKey.name}</p>
                  <p className="text-[#94A3B8] text-xs font-mono truncate">{selectedApiKey.apiKey}</p>
                </div>
              </div>

              <div className="p-3 mb-5 rounded-xl bg-[#F43F5E]/10 border border-[#F43F5E]/20 text-left">
                <p className="text-xs text-[#F43F5E] flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{t('deleteWarning')}</span>
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteModal(false)
                    setSelectedApiKey(null)
                  }}
                  className="flex-1 py-3.5 border border-[#2A2A3A] text-[#94A3B8] rounded-xl hover:bg-[#1E1E2E] transition-colors font-medium"
                >
                  {tCommon('cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="flex-1 py-3.5 bg-[#F43F5E] hover:bg-[#F43F5E]/90 text-white rounded-xl transition-colors font-medium flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  {tCommon('delete')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 验证结果弹窗 - 居中对话框 */}
      {showVerifyModal && selectedApiKey && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100] p-5 mobile-overlay"
          onClick={() => {
            setShowVerifyModal(false)
            setSelectedApiKey(null)
            setVerifyResult(null)
          }}
        >
          <div
            className="w-full max-w-sm bg-[#12121A] border border-[#1E1E2E] rounded-2xl p-5 max-h-[80vh] overflow-y-auto mobile-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center">
              {/* Loading 状态 */}
              {verifyStatus === 'loading' && (
                <>
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#06B6D4]/10 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 text-[#06B6D4] animate-spin" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">{t('verifying')}</h3>
                  <p className="text-[#94A3B8] text-sm">{t('verifyingConnection', { name: selectedApiKey.name })}</p>
                </>
              )}

              {/* 成功状态 */}
              {verifyStatus === 'success' && verifyResult && (
                <>
                  {verifyResult.balanceFetchError ? (
                    /* 余额获取失败：amber 警告状态 */
                    <>
                      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#F59E0B]/10 flex items-center justify-center">
                        <AlertTriangle className="w-8 h-8 text-[#F59E0B]" />
                      </div>
                      <h3 className="text-xl font-bold text-[#F59E0B] mb-2">API Key 有效</h3>
                      <p className="text-[#94A3B8] text-sm mb-5">连接异常，余额暂时无法获取</p>
                    </>
                  ) : (
                    /* 完全成功：绿色成功状态 */
                    <>
                      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#10B981]/10 flex items-center justify-center">
                        <CheckCircle className="w-8 h-8 text-[#10B981]" />
                      </div>
                      <h3 className="text-xl font-bold text-[#10B981] mb-2">{t('verifySuccess')}</h3>
                      <p className="text-[#94A3B8] text-sm mb-5">{t('verifySuccessMessage')}</p>
                    </>
                  )}

                  {/* 验证详情 */}
                  <div className="space-y-3 text-left">
                    {/* 交易所信息 */}
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-[#1E1E2E] border border-[#2A2A3A]">
                      <div className="w-10 h-10 rounded-xl bg-[#2A2A3A] flex items-center justify-center overflow-hidden relative">
                        {selectedApiKey.icon ? (
                          <Image src={selectedApiKey.icon} alt={selectedApiKey.exchange} fill className="object-contain" />
                        ) : (
                          <span className="text-lg text-white">{selectedApiKey.exchange?.charAt(0) || 'E'}</span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-white text-sm">{selectedApiKey.name}</p>
                        <p className="text-[#94A3B8] text-xs">{selectedApiKey.exchange} · <span className="font-mono">{selectedApiKey.apiKey}</span></p>
                      </div>
                    </div>

                    {/* 权限列表（余额获取失败时隐藏：权限来自 fallback 逻辑，不可靠） */}
                    {!verifyResult.balanceFetchError && (
                      <div className="p-3 rounded-xl bg-[#1E1E2E] border border-[#2A2A3A]">
                        <p className="text-[#94A3B8] text-xs mb-2">{t('apiPermissions')}</p>
                        <div className="flex flex-wrap gap-2">
                          {verifyResult.permissions?.map((perm, index) => (
                            <span key={index} className="px-2.5 py-1 rounded-lg bg-[#10B981]/10 text-[#10B981] text-xs font-medium">
                              {perm}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 资产列表 */}
                    <div className="p-3 rounded-xl bg-[#1E1E2E] border border-[#2A2A3A]">
                      {/* 总资产 */}
                      <div className="flex justify-between items-center mb-3 pb-3 border-b border-[#2A2A3A]">
                        <span className="text-[#94A3B8] text-sm">{t('totalAssetValue')}</span>
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
                        <p className="text-[#606070] text-xs leading-relaxed">
                          余额查询失败，可能是网络连接问题。API Key 格式正确，策略功能仍可正常使用。请稍后再次点击"验证"重试。
                        </p>
                      )}
                      {/* 币种明细 */}
                      {!verifyResult.balanceFetchError && verifyResult.assets && verifyResult.assets.length > 0 && (
                        <>
                          <p className="text-[#94A3B8] text-xs mb-2">{t('assetBreakdown')}</p>
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
                        <p className="text-[#606070] text-xs leading-relaxed">
                          现货与合约账户余额为空。若资金在 Binance Earn 理财中，请在 Binance App「理财」页确认后转入现货钱包再使用。
                        </p>
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
                  <h3 className="text-xl font-bold text-[#F43F5E] mb-2">{t('verifyFailed')}</h3>
                  <p className="text-[#94A3B8] text-sm mb-5">{t('verifyFailedMessage')}</p>

                  {/* 错误详情 */}
                  <div className="p-3 rounded-xl bg-[#F43F5E]/10 border border-[#F43F5E]/20 text-left mb-4">
                    <p className="text-sm text-[#F43F5E] flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <span>{verifyResult.error}</span>
                    </p>
                  </div>

                  {/* 可能的解决方案 */}
                  <div className="p-3 rounded-xl bg-[#1E1E2E] border border-[#2A2A3A] text-left">
                    <p className="text-[#94A3B8] text-xs mb-2">{t('checkFollowing')}</p>
                    <ul className="text-[#94A3B8] text-xs space-y-1.5">
                      <li>• {t('checkApiKeySecret')}</li>
                      <li>• {t('checkApiExpired')}</li>
                      <li>• {t('checkIpWhitelist')}</li>
                      <li>• {t('checkTradingPermission')}</li>
                    </ul>
                  </div>
                </>
              )}

              {/* 关闭按钮 */}
              <button
                type="button"
                onClick={() => {
                  setShowVerifyModal(false)
                  setSelectedApiKey(null)
                  setVerifyResult(null)
                }}
                className="w-full mt-5 py-3.5 bg-[#1E1E2E] hover:bg-[#2A2A3A] border border-[#2A2A3A] text-white rounded-xl transition-colors font-medium"
              >
                {t('close')}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ===== DEX 添加钱包弹窗 ===== */}
      {showAddDexModal && (
        <div
          className="fixed inset-0 bg-black/70 z-[100] mobile-overlay"
          onClick={() => {
            setShowAddDexModal(false)
            setSelectedDexExchange(null)
            setDexFormData({ walletAddress: '', privateKey: '', label: '', lighterApiKeyPrivateKey: '', lighterApiKeyIndex: 0, asterSignerAddress: '', isTestnet: false })
          }}
        >
          <div
            className="absolute bottom-0 left-0 right-0 max-h-[85vh] bg-[#12121A] rounded-t-3xl overflow-hidden mobile-sheet"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 bg-[#3A3A4A] rounded-full" />
            </div>

            <div className="px-5 pb-8 pt-2 overflow-y-auto max-h-[calc(85vh-40px)]">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-bold text-white">
                  {selectedDexExchange
                    ? `${tDex('connect')} ${supportedDexExchanges.find(e => e.id === selectedDexExchange)?.name || ''}`
                    : tDex('selectDex')
                  }
                </h3>
                <button
                  type="button"
                  title={t('close')}
                  onClick={() => {
                    setShowAddDexModal(false)
                    setSelectedDexExchange(null)
                    setDexFormData({ walletAddress: '', privateKey: '', label: '', lighterApiKeyPrivateKey: '', lighterApiKeyIndex: 0, asterSignerAddress: '', isTestnet: false })
                  }}
                  className="p-2 hover:bg-[#1E1E2E] rounded-lg transition-colors -mr-2"
                >
                  <X className="w-5 h-5 text-[#94A3B8]" />
                </button>
              </div>

              {!selectedDexExchange ? (
                <div className="grid grid-cols-3 gap-3">
                  {supportedDexExchanges.map((dex) => (
                    <button
                      key={dex.id}
                      type="button"
                      onClick={() => setSelectedDexExchange(dex.id)}
                      className="p-4 rounded-xl bg-[#1E1E2E] hover:bg-[#2A2A3A] transition-colors text-center"
                    >
                      <div className="w-10 h-10 mx-auto mb-2 rounded-lg bg-[#12121A] flex items-center justify-center overflow-hidden relative">
                        <Image src={dex.logo} alt={dex.name} fill className="object-contain" />
                      </div>
                      <span className="text-xs text-white">{dex.name}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Hyperliquid 表单 */}
                  {selectedDexExchange === 'hyperliquid' && (
                    <>
                      <div>
                        <label htmlFor="m-dex-hl-wallet" className="text-sm text-[#94A3B8] block mb-1">{tDex('hyperliquid.mainWallet')} *</label>
                        <input id="m-dex-hl-wallet" type="text" value={dexFormData.walletAddress}
                          onChange={(e) => setDexFormData({ ...dexFormData, walletAddress: e.target.value })}
                          placeholder="0x..."
                          className="w-full px-4 py-3 rounded-lg bg-[#1E1E2E] border border-[#2A2A3A] text-white placeholder-[#64748B] focus:outline-none focus:border-[#06B6D4]" />
                      </div>
                      <div>
                        <label htmlFor="m-dex-hl-pk" className="text-sm text-[#94A3B8] block mb-1">{tDex('hyperliquid.agentPrivateKey')} *</label>
                        <div className="relative">
                          <input id="m-dex-hl-pk" type={showDexPrivateKey ? 'text' : 'password'} value={dexFormData.privateKey}
                            onChange={(e) => setDexFormData({ ...dexFormData, privateKey: e.target.value })}
                            placeholder="Hyperliquid Agent Wallet 私钥"
                            className="w-full px-4 py-3 pr-12 rounded-lg bg-[#1E1E2E] border border-[#2A2A3A] text-white placeholder-[#64748B] focus:outline-none focus:border-[#06B6D4]" />
                          <button type="button" onClick={() => setShowDexPrivateKey(!showDexPrivateKey)}
                            title={showDexPrivateKey ? t('hideSecret') : t('showSecret')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8]">
                            {showDexPrivateKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                          </button>
                        </div>
                        <p className="text-xs text-[#64748B] mt-1">{tDex('hyperliquid.agentHint')}</p>
                      </div>
                    </>
                  )}

                  {/* Lighter 表单 */}
                  {selectedDexExchange === 'lighter' && (
                    <>
                      <div>
                        <label htmlFor="m-dex-lt-wallet" className="text-sm text-[#94A3B8] block mb-1">{tDex('lighter.walletAddress')} *</label>
                        <input id="m-dex-lt-wallet" type="text" value={dexFormData.walletAddress}
                          onChange={(e) => setDexFormData({ ...dexFormData, walletAddress: e.target.value })}
                          placeholder="0x..."
                          className="w-full px-4 py-3 rounded-lg bg-[#1E1E2E] border border-[#2A2A3A] text-white placeholder-[#64748B] focus:outline-none focus:border-[#06B6D4]" />
                      </div>
                      <div>
                        <label htmlFor="m-dex-lt-pk" className="text-sm text-[#94A3B8] block mb-1">{tDex('lighter.walletPrivateKey')} *</label>
                        <div className="relative">
                          <input id="m-dex-lt-pk" type={showDexPrivateKey ? 'text' : 'password'} value={dexFormData.privateKey}
                            onChange={(e) => setDexFormData({ ...dexFormData, privateKey: e.target.value })}
                            placeholder="钱包私钥（0x...）"
                            className="w-full px-4 py-3 pr-12 rounded-lg bg-[#1E1E2E] border border-[#2A2A3A] text-white placeholder-[#64748B] focus:outline-none focus:border-[#06B6D4]" />
                          <button type="button" onClick={() => setShowDexPrivateKey(!showDexPrivateKey)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8]">
                            {showDexPrivateKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                          </button>
                        </div>
                      </div>
                      <div>
                        <label htmlFor="m-dex-lt-apk" className="text-sm text-[#94A3B8] block mb-1">{tDex('lighter.apiKeyPrivateKey')} *</label>
                        <input id="m-dex-lt-apk" type="password" value={dexFormData.lighterApiKeyPrivateKey}
                          onChange={(e) => setDexFormData({ ...dexFormData, lighterApiKeyPrivateKey: e.target.value })}
                          placeholder="Lighter API Key 私钥（40字节 hex）"
                          className="w-full px-4 py-3 rounded-lg bg-[#1E1E2E] border border-[#2A2A3A] text-white placeholder-[#64748B] focus:outline-none focus:border-[#06B6D4]" />
                      </div>
                      <div>
                        <label htmlFor="m-dex-lt-idx" className="text-sm text-[#94A3B8] block mb-1">{tDex('lighter.apiKeyIndex')}</label>
                        <input id="m-dex-lt-idx" type="number" min={0} max={255} value={dexFormData.lighterApiKeyIndex}
                          onChange={(e) => setDexFormData({ ...dexFormData, lighterApiKeyIndex: parseInt(e.target.value) || 0 })}
                          className="w-full px-4 py-3 rounded-lg bg-[#1E1E2E] border border-[#2A2A3A] text-white focus:outline-none focus:border-[#06B6D4]" />
                        <p className="text-xs text-[#64748B] mt-1">{tDex('lighter.apiKeyIndexHint')}</p>
                      </div>
                    </>
                  )}

                  {/* Aster 表单 */}
                  {selectedDexExchange === 'aster' && (
                    <>
                      <div>
                        <label htmlFor="m-dex-ast-user" className="text-sm text-[#94A3B8] block mb-1">{tDex('aster.userWallet')} *</label>
                        <input id="m-dex-ast-user" type="text" value={dexFormData.walletAddress}
                          onChange={(e) => setDexFormData({ ...dexFormData, walletAddress: e.target.value })}
                          placeholder="0x... 主钱包地址"
                          className="w-full px-4 py-3 rounded-lg bg-[#1E1E2E] border border-[#2A2A3A] text-white placeholder-[#64748B] focus:outline-none focus:border-[#06B6D4]" />
                      </div>
                      <div>
                        <label htmlFor="m-dex-ast-signer" className="text-sm text-[#94A3B8] block mb-1">{tDex('aster.signerWallet')}</label>
                        <input id="m-dex-ast-signer" type="text" value={dexFormData.asterSignerAddress}
                          onChange={(e) => setDexFormData({ ...dexFormData, asterSignerAddress: e.target.value })}
                          placeholder={tDex('aster.signerWalletPlaceholder')}
                          className="w-full px-4 py-3 rounded-lg bg-[#1E1E2E] border border-[#2A2A3A] text-white placeholder-[#64748B] focus:outline-none focus:border-[#06B6D4]" />
                      </div>
                      <div>
                        <label htmlFor="m-dex-ast-pk" className="text-sm text-[#94A3B8] block mb-1">{tDex('aster.signerPrivateKey')} *</label>
                        <div className="relative">
                          <input id="m-dex-ast-pk" type={showDexPrivateKey ? 'text' : 'password'} value={dexFormData.privateKey}
                            onChange={(e) => setDexFormData({ ...dexFormData, privateKey: e.target.value })}
                            placeholder="签名钱包的私钥"
                            className="w-full px-4 py-3 pr-12 rounded-lg bg-[#1E1E2E] border border-[#2A2A3A] text-white placeholder-[#64748B] focus:outline-none focus:border-[#06B6D4]" />
                          <button type="button" onClick={() => setShowDexPrivateKey(!showDexPrivateKey)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8]">
                            {showDexPrivateKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                          </button>
                        </div>
                      </div>
                    </>
                  )}

                  {/* 通用字段: 备注名称 */}
                  <div>
                    <label htmlFor="m-dex-label" className="text-sm text-[#94A3B8] block mb-1">{t('labelOptional')}</label>
                    <input id="m-dex-label" type="text" value={dexFormData.label}
                      onChange={(e) => setDexFormData({ ...dexFormData, label: e.target.value })}
                      placeholder={`${tDex('myWallet')} ${supportedDexExchanges.find(e => e.id === selectedDexExchange)?.name || ''}`}
                      className="w-full px-4 py-3 rounded-lg bg-[#1E1E2E] border border-[#2A2A3A] text-white placeholder-[#64748B] focus:outline-none focus:border-[#06B6D4]" />
                  </div>

                  {/* 测试网开关 */}
                  <div className="flex items-center justify-between p-3 rounded-lg bg-[#1E1E2E] border border-[#2A2A3A]">
                    <div>
                      <p className="text-sm font-medium text-white">{tDex('testnetMode')}</p>
                      <p className="text-xs text-[#64748B]">{tDex('testnetHint')}</p>
                    </div>
                    <button type="button"
                      onClick={() => setDexFormData({ ...dexFormData, isTestnet: !dexFormData.isTestnet })}
                      className={`relative w-11 h-6 rounded-full transition-colors ${dexFormData.isTestnet ? 'bg-[#06B6D4]' : 'bg-[#2A2A3A]'}`}>
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${dexFormData.isTestnet ? 'translate-x-[18px]' : 'translate-x-0'}`} />
                    </button>
                  </div>

                  {/* 安全提示 */}
                  <div className="p-3 rounded-lg bg-[#12121A] border-l-4 border-l-[#06B6D4] border border-[#1E1E2E]">
                    <div className="flex items-start gap-2">
                      <Shield className="w-4 h-4 text-[#06B6D4] mt-0.5 flex-shrink-0" />
                      <p className="text-[#94A3B8] text-xs">
                        {tDex('securityNotice')}
                      </p>
                    </div>
                  </div>

                  {/* 底部按钮 */}
                  <div className="flex gap-3 pt-4 pb-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddDexModal(false)
                        setSelectedDexExchange(null)
                        setDexFormData({ walletAddress: '', privateKey: '', label: '', lighterApiKeyPrivateKey: '', lighterApiKeyIndex: 0, asterSignerAddress: '', isTestnet: false })
                      }}
                      className="flex-1 py-3.5 border border-[#2A2A3A] text-[#94A3B8] rounded-xl hover:bg-[#1E1E2E] transition-colors font-medium"
                    >
                      {tCommon('cancel')}
                    </button>
                    <button
                      type="button"
                      onClick={handleSubmitAddDex}
                      disabled={createDexMutation.isPending}
                      className="flex-1 py-3.5 bg-[#06B6D4] hover:bg-[#06B6D4]/90 text-white rounded-xl transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {createDexMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                      {tDex('connectWallet')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== DEX 删除确认弹窗 ===== */}
      {showDeleteDexModal && selectedDexWallet && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100] p-5 mobile-overlay"
          onClick={() => { setShowDeleteDexModal(false); setSelectedDexWallet(null) }}
        >
          <div
            className="w-full max-w-sm bg-[#12121A] border border-[#1E1E2E] rounded-2xl p-5 mobile-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#F43F5E]/10 flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-[#F43F5E]" />
              </div>

              <h3 className="text-xl font-bold text-white mb-2">{t('confirmDelete')}</h3>
              <p className="text-[#94A3B8] text-sm mb-5">
                {tDex('deleteConfirm')}
              </p>

              <div className="flex items-center gap-3 p-3 mb-4 rounded-xl bg-[#1E1E2E]/50 border border-[#2A2A3A]">
                <div className="w-10 h-10 rounded-xl bg-[#2A2A3A] flex items-center justify-center overflow-hidden relative">
                  {exchangeLogos[selectedDexWallet.exchange] ? (
                    <Image src={exchangeLogos[selectedDexWallet.exchange]} alt={selectedDexWallet.exchange} fill className="object-contain" />
                  ) : (
                    <span className="text-lg text-white">{selectedDexWallet.exchange.charAt(0).toUpperCase()}</span>
                  )}
                </div>
                <div className="text-left min-w-0">
                  <p className="font-semibold text-white text-sm">{selectedDexWallet.label}</p>
                  <p className="text-[#94A3B8] text-xs font-mono truncate">
                    {selectedDexWallet.walletAddress ? truncateAddress(selectedDexWallet.walletAddress) : selectedDexWallet.maskedKey}
                  </p>
                </div>
              </div>

              <div className="p-3 mb-5 rounded-xl bg-[#F43F5E]/10 border border-[#F43F5E]/20 text-left">
                <p className="text-xs text-[#F43F5E] flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{tDex('deleteConfirmHint')}</span>
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setShowDeleteDexModal(false); setSelectedDexWallet(null) }}
                  className="flex-1 py-3.5 border border-[#2A2A3A] text-[#94A3B8] rounded-xl hover:bg-[#1E1E2E] transition-colors font-medium"
                >
                  {tCommon('cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteDex}
                  className="flex-1 py-3.5 bg-[#F43F5E] hover:bg-[#F43F5E]/90 text-white rounded-xl transition-colors font-medium flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  {tCommon('delete')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Named export for MobileWalletPage
