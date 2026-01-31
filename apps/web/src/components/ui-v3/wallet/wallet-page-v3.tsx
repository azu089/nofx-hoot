'use client'

import { useState } from 'react'
import Image from 'next/image'
import {
  Wallet,
  ArrowDownToLine,
  ArrowUpFromLine,
  Plus,
  Key,
  Trash2,
  Edit,
  CheckCircle,
  Clock,
  XCircle,
  TrendingUp,
  TrendingDown,
  ArrowLeftRight,
  Calendar,
  ChevronDown,
  FileText,
  Sparkles,
  Shield,
  AlertCircle,
  AlertTriangle,
  ExternalLink,
  Eye,
  EyeOff,
  Copy,
  Check,
  X,
  RefreshCw,
  Loader2
} from 'lucide-react'
import { EcosystemPageV3 } from '../ecosystem/ecosystem-page-v3'

interface Asset {
  id: string
  name: string
  symbol: string
  balance: number
  value: number
  price?: number
  icon: string
  isReleasing?: boolean // 是否是释放中的资产
  releasedAmount?: number // 已释放数量
  totalLocked?: number // 总锁定数量
}

interface Exchange {
  id: string
  name: string
  icon?: string
  status: 'active' | 'inactive' | 'error'
  lastUsed: string
  createdAt?: string // 绑定日期
  balance?: number // 交易所USDT余额
  totalAssets?: number // 交易所总资产
  apiKey?: string // API Key（脱敏显示）
  permissions?: string[] // 权限列表
  error?: string // 错误信息
}

interface Transaction {
  id: string
  type: 'deposit' | 'withdraw' | 'buy' | 'exchange'
  amount: number
  asset: string
  status: 'completed' | 'pending' | 'failed'
  time: string
}

interface WalletPageV3Props {
  totalBalance?: number
  dailyChange?: number
  assets?: Asset[]
  exchanges?: Exchange[]
  transactions?: Transaction[]
  onDeposit?: () => void
  onWithdraw?: () => void
  onExchange?: () => void
  onGoToEcosystem?: () => void
  onAddExchange?: () => void
  onEditExchange?: (id: string) => void
  onDeleteExchange?: (id: string) => void
  onActivateExchange?: (id: string) => void
}

const defaultAssets: Asset[] = [
  {
    id: '1',
    name: 'USDT',
    symbol: 'USDT',
    balance: 10346.57,
    value: 10346.57,
    icon: '/icons/usdt.svg'
  },
  {
    id: '2',
    name: 'HOOT',
    symbol: 'HOOT',
    balance: 2500.75,
    value: 2500.75,
    icon: '/icons/hoot/token.png'
  },
  {
    id: '3',
    name: 'HOOT 释放中',
    symbol: 'HOOT',
    balance: 15000,
    value: 15000,
    icon: '/icons/hoot/token.png',
    isReleasing: true,
    releasedAmount: 3000,
    totalLocked: 18000
  },
  {
    id: '4',
    name: '点卡',
    symbol: 'GAS',
    balance: 1250,
    value: 1250,
    icon: '/icons/gas-card.svg'
  }
]

const defaultExchanges: Exchange[] = [
  {
    id: '1',
    name: 'Binance',
    icon: '/icons/exchanges/币安.webp',
    status: 'active',
    lastUsed: '2024-01-15 14:30',
    createdAt: '2026-01-10',
    balance: 5234.56,
    totalAssets: 8945.23,
    apiKey: 'vK8x ... j2Qp',
    permissions: ['现货交易', '合约交易']
  },
  {
    id: '2',
    name: 'OKX',
    icon: '/icons/exchanges/okx.webp',
    status: 'error',
    lastUsed: '2024-01-14 09:15',
    createdAt: '2025-12-20',
    balance: 0,
    totalAssets: 0,
    apiKey: 'aB3c ... 9dEf',
    permissions: ['现货交易'],
    error: 'API Key 已过期'
  }
]

// 支持的交易所
const supportedExchanges = [
  { id: 'binance', name: 'Binance', logo: '/icons/exchanges/币安.webp', guideUrl: 'https://www.binance.com/api-management' },
  { id: 'okx', name: 'OKX', logo: '/icons/exchanges/okx.webp', guideUrl: 'https://www.okx.com/account/my-api' },
  { id: 'bybit', name: 'Bybit', logo: '/icons/exchanges/bybit.webp', guideUrl: 'https://www.bybit.com/app/user/api-management' },
  { id: 'gate', name: 'Gate.io', logo: '/icons/exchanges/gate.webp', guideUrl: 'https://www.gate.io/myaccount/apikeys' },
  { id: 'bitget', name: 'Bitget', logo: '/icons/exchanges/bitget.webp', guideUrl: 'https://www.bitget.com/api' },
  { id: 'coinbase', name: 'Coinbase', logo: '/icons/exchanges/coinbase.webp', guideUrl: 'https://www.coinbase.com/settings/api' },
]

const defaultTransactions: Transaction[] = [
  {
    id: '1',
    type: 'deposit',
    amount: 1000,
    asset: 'USDT',
    status: 'completed',
    time: '2024-01-15 14:30'
  },
  {
    id: '2',
    type: 'withdraw',
    amount: 500,
    asset: 'USDT',
    status: 'pending',
    time: '2024-01-15 12:15'
  },
  {
    id: '3',
    type: 'exchange',
    amount: 250,
    asset: 'USDT → HOOT',
    status: 'completed',
    time: '2024-01-14 18:20'
  }
]

export function WalletPageV3({
  totalBalance = 12847.32,
  dailyChange = 2.34,
  assets = defaultAssets,
  exchanges = defaultExchanges,
  transactions = defaultTransactions,
  onDeposit,
  onWithdraw,
  onExchange,
  onGoToEcosystem: _onGoToEcosystem,
  onAddExchange: _onAddExchange,
  onEditExchange: _onEditExchange,
  onDeleteExchange: _onDeleteExchange,
  onActivateExchange: _onActivateExchange
}: WalletPageV3Props) {
  void _onGoToEcosystem
  void _onAddExchange
  void _onEditExchange
  void _onDeleteExchange
  void _onActivateExchange
  // 页面级 Tab 切换：资产 / API / 生态
  const [pageTab, setPageTab] = useState<'wallet' | 'api' | 'ecosystem'>('wallet')
  const [selectedTab, setSelectedTab] = useState<'assets' | 'transactions'>('assets')
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [showTypeFilter, setShowTypeFilter] = useState(false)
  const [showAssetFilter, setShowAssetFilter] = useState(false)
  const [dateRange, setDateRange] = useState({ start: '2026-01-01', end: '2026-01-29' })
  const [txTypeFilter, setTxTypeFilter] = useState<'all' | 'deposit' | 'withdraw' | 'exchange'>('all')
  const [txAssetFilter, setTxAssetFilter] = useState<'all' | 'USDT' | 'HOOT'>('all')
  const isPositiveChange = dailyChange > 0

  // API 管理相关状态
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showVerifyModal, setShowVerifyModal] = useState(false)
  const [verifyStatus, setVerifyStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [verifyResult, setVerifyResult] = useState<{
    permissions?: string[]
    assets?: { symbol: string; amount: string; value: number }[]
    totalValue?: number
    error?: string
  } | null>(null)
  const [selectedExchange, setSelectedExchange] = useState<string | null>(null)
  const [selectedApiKey, setSelectedApiKey] = useState<Exchange | null>(null)
  const [showSecret, setShowSecret] = useState(false)
  const [copied, setCopied] = useState(false)
  const [formData, setFormData] = useState({ apiKey: '', secretKey: '', passphrase: '', label: '' })
  const [editFormData, setEditFormData] = useState({ apiKey: '', secretKey: '', passphrase: '', label: '' })

  // API 管理处理函数
  const handleOpenEdit = (exchange: Exchange) => {
    setSelectedApiKey(exchange)
    setEditFormData({ apiKey: exchange.apiKey || '', secretKey: '', passphrase: '', label: exchange.name })
    setShowEditModal(true)
  }

  const handleOpenDelete = (exchange: Exchange) => {
    setSelectedApiKey(exchange)
    setShowDeleteModal(true)
  }

  const handleConfirmDelete = () => {
    console.log('删除 API Key:', selectedApiKey?.id)
    setShowDeleteModal(false)
    setSelectedApiKey(null)
  }

  const handleConfirmEdit = () => {
    console.log('更新 API Key:', selectedApiKey?.id, editFormData)
    setShowEditModal(false)
    setSelectedApiKey(null)
  }

  // 验证 API Key
  const handleVerify = (exchange: Exchange) => {
    setSelectedApiKey(exchange)
    setVerifyStatus('loading')
    setVerifyResult(null)
    setShowVerifyModal(true)

    // 模拟 API 验证请求
    setTimeout(() => {
      // 模拟验证结果：status 为 active 时成功，否则失败
      if (exchange.status === 'active') {
        setVerifyStatus('success')
        setVerifyResult({
          permissions: exchange.permissions || ['现货交易'],
          assets: [
            { symbol: 'USDT', amount: '3,234.56', value: 3234.56 },
            { symbol: 'BTC', amount: '0.05432', value: 1856.78 },
            { symbol: 'ETH', amount: '0.8521', value: 143.22 }
          ],
          totalValue: exchange.balance || 5234.56
        })
      } else {
        setVerifyStatus('error')
        setVerifyResult({
          error: exchange.error || 'API Key 验证失败，请检查密钥是否正确'
        })
      }
    }, 1500)
  }

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleOpenAdd = () => {
    setSelectedExchange(null)
    setFormData({ apiKey: '', secretKey: '', passphrase: '', label: '' })
    setShowAddModal(true)
  }

  const typeFilterOptions = [
    { value: 'all', label: '全部类型' },
    { value: 'deposit', label: '充值' },
    { value: 'withdraw', label: '提现' },
    { value: 'exchange', label: '兑换' }
  ]

  const assetFilterOptions = [
    { value: 'all', label: '全部币种' },
    { value: 'USDT', label: 'USDT' },
    { value: 'HOOT', label: 'HOOT' }
  ]

  const getTypeLabel = (value: string) => typeFilterOptions.find(o => o.value === value)?.label || '全部类型'
  const getAssetLabel = (value: string) => assetFilterOptions.find(o => o.value === value)?.label || '全部币种'

  // 筛选交易记录
  const filteredTransactions = transactions.filter(tx => {
    const matchesType = txTypeFilter === 'all' || tx.type === txTypeFilter
    const matchesAsset = txAssetFilter === 'all' || tx.asset.includes(txAssetFilter)
    return matchesType && matchesAsset
  })

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-400" />
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-400" />
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-400" />
      default:
        return null
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return '成功'
      case 'pending':
        return '处理中'
      case 'failed':
        return '失败'
      default:
        return status
    }
  }

  const getTypeText = (type: string) => {
    switch (type) {
      case 'deposit':
        return '充值'
      case 'withdraw':
        return '提现'
      case 'buy':
        return '购买'
      case 'exchange':
        return '兑换'
      default:
        return type
    }
  }

  // 获取代币图标
  const getAssetIcon = (asset: string) => {
    if (asset.includes('USDT')) return '/icons/usdt.svg'
    if (asset.includes('HOOT')) return '/icons/hoot/token.png'
    return null
  }

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-[#F8F8FC] p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header with Page Tabs */}
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-[#F8F8FC]">资产</h1>

          {/* Page Tab Segment */}
          <div className="flex mt-4 p-1 bg-[#1E1E2E]/50 rounded-xl w-fit">
            <button
              type="button"
              onClick={() => setPageTab('wallet')}
              className={`px-5 py-2 rounded-lg font-medium text-sm transition-all ${
                pageTab === 'wallet'
                  ? 'bg-[#06B6D4] text-white shadow-lg'
                  : 'text-[#9090A0] hover:text-[#F8F8FC]'
              }`}
            >
              <Wallet className="w-4 h-4 inline-block mr-2" />
              钱包
            </button>
            <button
              type="button"
              onClick={() => setPageTab('api')}
              className={`px-5 py-2 rounded-lg font-medium text-sm transition-all ${
                pageTab === 'api'
                  ? 'bg-[#06B6D4] text-white shadow-lg'
                  : 'text-[#9090A0] hover:text-[#F8F8FC]'
              }`}
            >
              <Key className="w-4 h-4 inline-block mr-2" />
              API
            </button>
            <button
              type="button"
              onClick={() => setPageTab('ecosystem')}
              className={`px-5 py-2 rounded-lg font-medium text-sm transition-all ${
                pageTab === 'ecosystem'
                  ? 'bg-[#06B6D4] text-white shadow-lg'
                  : 'text-[#9090A0] hover:text-[#F8F8FC]'
              }`}
            >
              <Sparkles className="w-4 h-4 inline-block mr-2" />
              生态
            </button>
          </div>
        </div>

        {/* ===== 钱包 Tab 内容 ===== */}
        {pageTab === 'wallet' && (
          <>
            {/* Balance Card - 资产卡片（含快捷操作按钮）- 呼吸光感效果 */}
            <div className="glow-card relative overflow-hidden backdrop-blur-xl bg-gradient-to-br from-[#12121A]/80 to-[#1A1A24]/80 rounded-2xl p-6 border border-cyan-500/10 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
              {/* 顶部高光线 */}
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/30 to-transparent" />
              {/* 内发光效果 */}
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-cyan-400/[0.06] via-transparent to-transparent pointer-events-none" />
              {/* 呼吸光晕 */}
              <div className="absolute -top-24 -right-24 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl animate-pulse" />
              <div className="absolute -bottom-12 -left-12 w-36 h-36 bg-cyan-500/5 rounded-full blur-2xl animate-[pulse_2s_ease-in-out_infinite_1s]" />
              <p className="relative z-10 text-[#9090A0] text-sm mb-2">总资产 (USDT)</p>
              <div className="relative z-10 flex items-baseline gap-4 mb-6">
                <span className="text-4xl font-bold">${totalBalance.toLocaleString()}</span>
                <div className={`flex items-center gap-1 px-2 py-1 rounded-lg ${
                  isPositiveChange ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                }`}>
                  {isPositiveChange ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                  <span className="text-sm font-medium">
                    {isPositiveChange ? '+' : ''}{dailyChange}% 24h
                  </span>
                </div>
              </div>
              {/* Quick Actions - 卡片内按钮组 */}
              <div className="relative z-10 flex gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={onDeposit}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[#06B6D4] hover:bg-[#0891B2] text-white rounded-xl font-medium transition-all shadow-[0_0_20px_rgba(6,182,212,0.2)] hover:shadow-[0_0_30px_rgba(6,182,212,0.3)]"
                >
                  <ArrowDownToLine className="w-4 h-4" />
                  充值
                </button>
                <button
                  type="button"
                  onClick={onWithdraw}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[#1E1E2E] hover:bg-[#2A2A3A] border border-[#2A2A3A] hover:border-[#3A3A4A] text-[#F8F8FC] rounded-xl font-medium transition-all"
                >
                  <ArrowUpFromLine className="w-4 h-4" />
                  提现
                </button>
                <button
                  type="button"
                  onClick={onExchange}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[#1E1E2E] hover:bg-[#2A2A3A] border border-[#2A2A3A] hover:border-[#3A3A4A] text-[#F8F8FC] rounded-xl font-medium transition-all"
                >
                  <ArrowLeftRight className="w-4 h-4" />
                  兑换
                </button>
              </div>
            </div>

            {/* Main Content - Assets & Transactions */}
            <div className="mt-6">
              <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.02)_inset] overflow-hidden">
              {/* 顶部高光 */}              {/* 内发光效果 */}              {/* Tab Navigation - 卡片内顶部 */}
              <div className="relative z-[2] flex border-b border-[#1E1E2E]">
                <button
                  type="button"
                  onClick={() => setSelectedTab('assets')}
                  className={`flex-1 py-4 px-6 font-medium transition-all duration-200 relative ${
                    selectedTab === 'assets'
                      ? 'text-[#06B6D4]'
                      : 'text-[#9090A0] hover:text-[#F8F8FC]'
                  }`}
                >
                  资产明细
                  {selectedTab === 'assets' && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#06B6D4]" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedTab('transactions')}
                  className={`flex-1 py-4 px-6 font-medium transition-all duration-200 flex items-center justify-center gap-2 relative ${
                    selectedTab === 'transactions'
                      ? 'text-[#06B6D4]'
                      : 'text-[#9090A0] hover:text-[#F8F8FC]'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  历史账单
                  {selectedTab === 'transactions' && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#06B6D4]" />
                  )}
                </button>
              </div>

              {/* Assets Tab Content */}
              {selectedTab === 'assets' && (
                <div className="relative z-[2] p-6">
                  <div className="space-y-4">
                    {assets.map((asset) => (
                      <div
                        key={asset.id}
                        className={`flex items-center justify-between p-4 rounded-xl transition-colors ${
                          asset.isReleasing
                            ? 'border border-[#F59E0B]/30'
                            : 'bg-[#1E1E2E]/30 hover:bg-[#1E1E2E]/50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-[#2A2A3A] flex items-center justify-center overflow-hidden relative">
                            {asset.icon && asset.icon.startsWith('/') ? (
                              <Image
                                src={asset.icon}
                                alt={asset.name}
                                fill
                                className="object-contain"
                              />
                            ) : (
                              <span className="text-xs font-bold text-[#06B6D4]">{asset.symbol.charAt(0)}</span>
                            )}
                          </div>
                          <div>
                            <p className={`font-medium ${asset.isReleasing ? 'text-[#F59E0B]' : ''}`}>
                              {asset.name}
                            </p>
                            {asset.isReleasing && (
                              <p className="text-xs text-[#F59E0B]/70">
                                空投锁仓 · 每日释放
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`font-semibold ${asset.isReleasing ? 'text-[#F59E0B]' : ''}`}>
                            {asset.balance.toLocaleString()} {asset.symbol}
                          </p>
                          <p className="text-[#9090A0] text-sm">
                            ≈ ${asset.value.toLocaleString()}
                            {asset.price && !asset.isReleasing && asset.symbol !== 'USDT' && asset.symbol !== 'GAS' && (
                              <span className="ml-2 text-[#606070]">单价 ${asset.price.toFixed(2)}</span>
                            )}
                          </p>
                          {/* 释放进度 */}
                          {asset.isReleasing && asset.totalLocked && (
                            <div className="mt-2">
                              <div className="flex items-center justify-end gap-2 text-xs text-[#9090A0]">
                                <span>已释放 {((asset.releasedAmount || 0) / asset.totalLocked * 100).toFixed(0)}%</span>
                              </div>
                              <div className="w-24 h-1.5 bg-[#2A2A3A] rounded-full mt-1 ml-auto">
                                <div
                                  className="h-full bg-gradient-to-r from-[#F59E0B] to-[#D97706] rounded-full"
                                  style={{ width: `${((asset.releasedAmount || 0) / asset.totalLocked * 100)}%` }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Transactions Tab - 历史账单 */}
              {selectedTab === 'transactions' && (
                <div className="relative z-[2] p-6">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-[#1E1E2E]">
                          {/* 类型 - 可展开筛选 */}
                          <th className="text-left py-3 font-medium relative">
                            <button
                              type="button"
                              onClick={() => {
                                setShowTypeFilter(!showTypeFilter)
                                setShowAssetFilter(false)
                                setShowDatePicker(false)
                              }}
                              className="flex items-center gap-1.5 text-[#9090A0] hover:text-[#F8F8FC] transition-colors"
                            >
                              <span className={txTypeFilter !== 'all' ? 'text-[#06B6D4]' : ''}>
                                {txTypeFilter === 'all' ? '类型' : getTypeLabel(txTypeFilter)}
                              </span>
                              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showTypeFilter ? 'rotate-180' : ''}`} />
                            </button>
                            {showTypeFilter && (
                              <div className="absolute top-full left-0 mt-2 w-32 bg-[#12121A]/95 backdrop-blur-xl border border-[#1E1E2E] rounded-lg shadow-[0_0_30px_rgba(6,182,212,0.05)] z-50 overflow-hidden">
                                {typeFilterOptions.map((option) => (
                                  <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => {
                                      setTxTypeFilter(option.value as typeof txTypeFilter)
                                      setShowTypeFilter(false)
                                    }}
                                    className={`w-full px-4 py-2.5 text-left text-sm transition-colors ${
                                      txTypeFilter === option.value
                                        ? 'bg-[#06B6D4]/10 text-[#06B6D4]'
                                        : 'text-[#F8F8FC] hover:bg-[#1E1E2E]'
                                    }`}
                                  >
                                    {option.label}
                                  </button>
                                ))}
                              </div>
                            )}
                          </th>
                          {/* 资产 - 可展开筛选 */}
                          <th className="text-left py-3 font-medium relative">
                            <button
                              type="button"
                              onClick={() => {
                                setShowAssetFilter(!showAssetFilter)
                                setShowTypeFilter(false)
                                setShowDatePicker(false)
                              }}
                              className="flex items-center gap-1.5 text-[#9090A0] hover:text-[#F8F8FC] transition-colors"
                            >
                              <span className={txAssetFilter !== 'all' ? 'text-[#06B6D4]' : ''}>
                                {txAssetFilter === 'all' ? '资产' : getAssetLabel(txAssetFilter)}
                              </span>
                              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAssetFilter ? 'rotate-180' : ''}`} />
                            </button>
                            {showAssetFilter && (
                              <div className="absolute top-full left-0 mt-2 w-32 bg-[#12121A]/95 backdrop-blur-xl border border-[#1E1E2E] rounded-lg shadow-[0_0_30px_rgba(6,182,212,0.05)] z-50 overflow-hidden">
                                {assetFilterOptions.map((option) => (
                                  <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => {
                                      setTxAssetFilter(option.value as typeof txAssetFilter)
                                      setShowAssetFilter(false)
                                    }}
                                    className={`w-full px-4 py-2.5 text-left text-sm transition-colors ${
                                      txAssetFilter === option.value
                                        ? 'bg-[#06B6D4]/10 text-[#06B6D4]'
                                        : 'text-[#F8F8FC] hover:bg-[#1E1E2E]'
                                    }`}
                                  >
                                    {option.label}
                                  </button>
                                ))}
                              </div>
                            )}
                          </th>
                          <th className="text-left py-3 text-[#9090A0] font-medium">金额</th>
                          <th className="text-left py-3 text-[#9090A0] font-medium">状态</th>
                          {/* 时间 - 日期筛选器 */}
                          <th className="text-left py-3 font-medium relative">
                            <button
                              type="button"
                              onClick={() => {
                                setShowDatePicker(!showDatePicker)
                                setShowTypeFilter(false)
                                setShowAssetFilter(false)
                              }}
                              className="flex items-center gap-1.5 text-[#9090A0] hover:text-[#F8F8FC] transition-colors"
                            >
                              <Calendar className="w-3.5 h-3.5 text-[#06B6D4]" />
                              <span className="text-[#06B6D4]">{dateRange.start} ~ {dateRange.end}</span>
                              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showDatePicker ? 'rotate-180' : ''}`} />
                            </button>
                            {showDatePicker && (
                              <div className="absolute top-full right-0 mt-2 w-80 bg-[#12121A]/95 backdrop-blur-xl border border-[#1E1E2E] rounded-lg shadow-[0_0_30px_rgba(6,182,212,0.05)] z-50 p-4">
                                <div className="space-y-4">
                                  <div>
                                    <label htmlFor="bill-date-start" className="text-xs text-[#9090A0] mb-1 block">开始日期</label>
                                    <input
                                      id="bill-date-start"
                                      type="date"
                                      value={dateRange.start}
                                      onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                                      title="选择开始日期"
                                      className="w-full bg-[#0A0A0F] border border-[#1E1E2E] rounded-lg px-3 py-2 text-sm text-[#F8F8FC] focus:border-cyan-500/50 focus:outline-none"
                                    />
                                  </div>
                                  <div>
                                    <label htmlFor="bill-date-end" className="text-xs text-[#9090A0] mb-1 block">结束日期</label>
                                    <input
                                      id="bill-date-end"
                                      type="date"
                                      value={dateRange.end}
                                      onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                                      title="选择结束日期"
                                      className="w-full bg-[#0A0A0F] border border-[#1E1E2E] rounded-lg px-3 py-2 text-sm text-[#F8F8FC] focus:border-cyan-500/50 focus:outline-none"
                                    />
                                  </div>
                                  <div className="flex gap-2">
                                    {['本周', '本月', '近3月'].map((preset) => (
                                      <button
                                        key={preset}
                                        type="button"
                                        onClick={() => {
                                          const today = new Date()
                                          let start = new Date()
                                          if (preset === '本周') {
                                            start.setDate(today.getDate() - today.getDay())
                                          } else if (preset === '本月') {
                                            start = new Date(today.getFullYear(), today.getMonth(), 1)
                                          } else {
                                            start.setMonth(today.getMonth() - 3)
                                          }
                                          setDateRange({
                                            start: start.toISOString().split('T')[0],
                                            end: today.toISOString().split('T')[0]
                                          })
                                        }}
                                        className="flex-1 px-3 py-1.5 text-xs bg-[#1E1E2E] text-[#9090A0] rounded hover:bg-[#2A2A3A] hover:text-[#F8F8FC] transition-colors"
                                      >
                                        {preset}
                                      </button>
                                    ))}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setShowDatePicker(false)}
                                    className="w-full py-2 bg-[#06B6D4] text-white rounded-lg text-sm font-medium hover:bg-[#0891B2] transition-colors"
                                  >
                                    确认
                                  </button>
                                </div>
                              </div>
                            )}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredTransactions.map((tx) => {
                          const assetIcon = getAssetIcon(tx.asset)
                          return (
                            <tr key={tx.id} className="border-b border-[#1E1E2E]/50 hover:bg-[#1E1E2E]/20">
                              <td className="py-4">
                                <span className="font-medium">{getTypeText(tx.type)}</span>
                              </td>
                              <td className="py-4">
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-full bg-[#2A2A3A] flex items-center justify-center overflow-hidden relative">
                                    {assetIcon ? (
                                      <Image
                                        src={assetIcon}
                                        alt={tx.asset}
                                        fill
                                        className="object-contain"
                                      />
                                    ) : (
                                      <span className="text-[10px] font-bold text-[#06B6D4]">{tx.asset.charAt(0)}</span>
                                    )}
                                  </div>
                                  <span className="font-medium text-[#9090A0]">{tx.asset}</span>
                                </div>
                              </td>
                              <td className="py-4">
                                <span className="font-medium">{tx.amount}</span>
                              </td>
                              <td className="py-4">
                                <div className="flex items-center gap-2">
                                  {getStatusIcon(tx.status)}
                                  <span className="text-sm">{getStatusText(tx.status)}</span>
                                </div>
                              </td>
                              <td className="py-4 text-[#9090A0] text-sm">{tx.time}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  {filteredTransactions.length === 0 && (
                    <div className="text-center py-12">
                      <FileText className="w-12 h-12 text-[#606070] mx-auto mb-4" />
                      <p className="text-[#9090A0]">
                        {txTypeFilter === 'all' && txAssetFilter === 'all'
                          ? '暂无账单记录'
                          : '没有符合筛选条件的记录'}
                      </p>
                    </div>
                  )}
                </div>
              )}

            </div>
            </div>
          </>
        )}

        {/* ===== API Tab 内容 ===== */}
        {pageTab === 'api' && (
          <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.02)_inset] overflow-hidden">
            {/* 顶部高光 */}            {/* 内发光效果 */}            {/* Header */}
            <div className="relative z-[2] flex items-center justify-between p-6 border-b border-[#1E1E2E]">
              <div>
                <h2 className="text-lg font-bold">交易所 API 管理</h2>
              </div>
              <button
                type="button"
                onClick={handleOpenAdd}
                className="flex items-center gap-2 px-4 py-2 bg-[#06B6D4] hover:bg-[#0891B2] text-white rounded-xl font-medium transition-all"
              >
                <Plus className="w-4 h-4" />
                添加 API
              </button>
            </div>

            {/* API List */}
            <div className="relative z-[2] p-6">
              {exchanges.length === 0 ? (
                <div className="p-8 rounded-xl bg-[#1E1E2E]/30 border border-[#2A2A3A] text-center">
                  <Key className="w-12 h-12 text-[#606070] mx-auto mb-3" />
                  <p className="text-[#9090A0]">暂无绑定的 API Key</p>
                  <p className="text-[#606070] text-sm mt-1">点击上方按钮添加您的第一个交易所</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {exchanges.map((exchange) => (
                    <div
                      key={exchange.id}
                      className={`p-4 rounded-xl border transition-colors ${
                        exchange.status === 'error'
                          ? 'bg-[#1E1E2E]/30 border-[#F43F5E]/30'
                          : 'bg-[#1E1E2E]/30 border-[#2A2A3A] hover:bg-[#1E1E2E]/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        {/* 左侧：图标 + 信息 */}
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-[#1E1E2E] flex items-center justify-center overflow-hidden relative">
                            {exchange.icon?.startsWith('/') ? (
                              <Image src={exchange.icon} alt={exchange.name} fill className="object-contain" />
                            ) : (
                              <span className="text-lg">{exchange.name.charAt(0)}</span>
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{exchange.name}</span>
                              {exchange.status === 'active' ? (
                                <CheckCircle className="w-4 h-4 text-[#10B981]" />
                              ) : (
                                <AlertCircle className="w-4 h-4 text-[#F43F5E]" />
                              )}
                            </div>
                            {exchange.error ? (
                              <p className="text-[#F43F5E] text-xs">{exchange.error}</p>
                            ) : (
                              <p className="text-[#9090A0] text-sm">
                                ${exchange.balance?.toLocaleString() || '0'}
                              </p>
                            )}
                          </div>
                        </div>
                        {/* 右侧：操作按钮 */}
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleVerify(exchange)}
                            title="验证"
                            className="p-2 hover:bg-[#1E1E2E] rounded-lg transition-colors"
                          >
                            <RefreshCw className="w-4 h-4 text-[#9090A0]" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(exchange)}
                            title="编辑"
                            className="p-2 hover:bg-[#1E1E2E] rounded-lg transition-colors"
                          >
                            <Edit className="w-4 h-4 text-[#9090A0]" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenDelete(exchange)}
                            title="删除"
                            className="p-2 hover:bg-[#F43F5E]/10 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4 text-[#F43F5E]/70" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===== 生态 Tab 内容 ===== */}
        {pageTab === 'ecosystem' && (
          <EcosystemPageV3 />
        )}
      </div>

      {/* 添加 API Key 弹窗 */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="w-full max-w-lg bg-[#12121A] border border-[#1E1E2E] rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">
                {selectedExchange
                  ? `绑定 ${supportedExchanges.find(e => e.id === selectedExchange)?.name} API`
                  : '选择交易所'
                }
              </h3>
              <button
                type="button"
                title="关闭"
                onClick={() => {
                  setShowAddModal(false)
                  setSelectedExchange(null)
                  setFormData({ apiKey: '', secretKey: '', passphrase: '', label: '' })
                }}
                className="p-2 hover:bg-[#1E1E2E] rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-[#9090A0]" />
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
                    <span className="text-sm">{exchange.name}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                <a
                  href={supportedExchanges.find(e => e.id === selectedExchange)?.guideUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-cyan-400 text-sm hover:underline"
                >
                  <ExternalLink className="w-4 h-4" />
                  如何获取 API Key？
                </a>

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

                <div className="p-3 rounded-lg bg-[#1E1E2E] border border-[#2A2A3A]">
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
                </div>

                {/* 安全提示 */}
                <div className="p-3 rounded-lg bg-[#12121A] border-l-4 border-l-cyan-500 border border-[#1E1E2E]">
                  <div className="flex items-start gap-2">
                    <Shield className="w-4 h-4 text-cyan-400 mt-0.5 flex-shrink-0" />
                    <ul className="text-[#9090A0] text-xs space-y-1">
                      <li>• 仅开启「交易」权限，禁止开启「提现」权限</li>
                      <li>• 建议绑定 IP 白名单以增强安全性</li>
                    </ul>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false)
                      setSelectedExchange(null)
                      setFormData({ apiKey: '', secretKey: '', passphrase: '', label: '' })
                    }}
                    className="flex-1 py-2.5 border border-[#2A2A3A] text-[#9090A0] rounded-lg hover:bg-[#1E1E2E] transition-colors"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    className="flex-1 py-2.5 bg-[#06B6D4] hover:bg-[#0891B2] text-white rounded-lg transition-colors font-medium"
                  >
                    验证并绑定
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 编辑 API Key 弹窗 */}
      {showEditModal && selectedApiKey && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="w-full max-w-lg bg-[#12121A] border border-[#1E1E2E] rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#1E1E2E] flex items-center justify-center overflow-hidden relative">
                  {selectedApiKey.icon?.startsWith('/') ? (
                    <Image src={selectedApiKey.icon} alt={selectedApiKey.name} fill className="object-contain" />
                  ) : (
                    <span className="text-lg">{selectedApiKey.name.charAt(0)}</span>
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-bold">编辑 {selectedApiKey.name} API</h3>
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
              {/* 绑定信息卡片 */}
              <div className="p-4 rounded-xl bg-[#0A0A0F] border border-[#1E1E2E] space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-[#606070]">API Key</p>
                    <p className="font-mono text-[#9090A0] text-sm mt-0.5">{selectedApiKey.apiKey}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-[#606070]">绑定时间</p>
                    <p className="text-[#9090A0] text-sm mt-0.5">{selectedApiKey.createdAt || '-'}</p>
                  </div>
                </div>
                {selectedApiKey.permissions && selectedApiKey.permissions.length > 0 && (
                  <div className="pt-3 border-t border-[#1E1E2E]">
                    <p className="text-xs text-[#606070] mb-2">已授权权限</p>
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
                <label htmlFor="edit-api-key" className="text-sm text-[#9090A0] block mb-1">新 API Key（留空则不更新）</label>
                <input
                  id="edit-api-key"
                  type="text"
                  value={editFormData.apiKey}
                  onChange={(e) => setEditFormData({ ...editFormData, apiKey: e.target.value })}
                  placeholder="输入新的 API Key"
                  className="w-full px-4 py-2.5 rounded-lg bg-[#1E1E2E] border border-[#2A2A3A] text-[#F8F8FC] placeholder-[#606070] focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label htmlFor="edit-secret-key" className="text-sm text-[#9090A0] block mb-1">新 Secret Key（留空则不更新）</label>
                <div className="relative">
                  <input
                    id="edit-secret-key"
                    type={showSecret ? 'text' : 'password'}
                    value={editFormData.secretKey}
                    onChange={(e) => setEditFormData({ ...editFormData, secretKey: e.target.value })}
                    placeholder="输入新的 Secret Key"
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

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false)
                    setSelectedApiKey(null)
                  }}
                  className="flex-1 py-2.5 border border-[#2A2A3A] text-[#9090A0] rounded-lg hover:bg-[#1E1E2E] transition-colors"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleConfirmEdit}
                  className="flex-1 py-2.5 bg-[#06B6D4] hover:bg-[#0891B2] text-white rounded-lg transition-colors font-medium"
                >
                  保存更改
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 删除确认弹窗 */}
      {showDeleteModal && selectedApiKey && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="w-full max-w-md bg-[#12121A] border border-[#1E1E2E] rounded-2xl p-6">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#F43F5E]/10 flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-[#F43F5E]" />
              </div>

              <h3 className="text-xl font-bold mb-2">确认删除</h3>
              <p className="text-[#9090A0] mb-6">
                您确定要删除 <span className="text-[#F8F8FC] font-semibold">{selectedApiKey.name}</span> 的 API 密钥吗？
              </p>

              <div className="flex items-center gap-3 p-4 mb-6 rounded-xl bg-[#1E1E2E]/50 border border-[#2A2A3A]">
                <div className="w-10 h-10 rounded-xl bg-[#2A2A3A] flex items-center justify-center overflow-hidden relative">
                  {selectedApiKey.icon?.startsWith('/') ? (
                    <Image src={selectedApiKey.icon} alt={selectedApiKey.name} fill className="object-contain" />
                  ) : (
                    <span className="text-lg">{selectedApiKey.name.charAt(0)}</span>
                  )}
                </div>
                <div className="text-left">
                  <p className="font-semibold">{selectedApiKey.name}</p>
                  <p className="text-[#9090A0] text-sm font-mono">{selectedApiKey.apiKey}</p>
                </div>
              </div>

              <div className="p-3 mb-6 rounded-lg bg-[#F43F5E]/10 border border-[#F43F5E]/20 text-left">
                <p className="text-sm text-[#F43F5E]">
                  <AlertCircle className="w-4 h-4 inline mr-1" />
                  删除后，使用此 API 的策略将无法继续执行交易。此操作不可撤销。
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteModal(false)
                    setSelectedApiKey(null)
                  }}
                  className="flex-1 py-2.5 border border-[#2A2A3A] text-[#9090A0] rounded-lg hover:bg-[#1E1E2E] transition-colors"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="flex-1 py-2.5 bg-[#F43F5E] hover:bg-[#E11D48] text-white rounded-lg transition-colors font-medium flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  确认删除
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 验证结果弹窗 */}
      {showVerifyModal && selectedApiKey && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="w-full max-w-md bg-[#12121A] border border-[#1E1E2E] rounded-2xl p-6">
            <div className="text-center">
              {/* Loading 状态 */}
              {verifyStatus === 'loading' && (
                <>
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#06B6D4]/10 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 text-[#06B6D4] animate-spin" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">正在验证</h3>
                  <p className="text-[#9090A0]">正在连接 {selectedApiKey.name} 验证 API 状态...</p>
                </>
              )}

              {/* 成功状态 */}
              {verifyStatus === 'success' && verifyResult && (
                <>
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#10B981]/10 flex items-center justify-center">
                    <CheckCircle className="w-8 h-8 text-[#10B981]" />
                  </div>
                  <h3 className="text-xl font-bold mb-2 text-[#10B981]">验证成功</h3>
                  <p className="text-[#9090A0] mb-6">API 连接正常，可正常使用</p>

                  {/* 验证详情 */}
                  <div className="space-y-3 text-left">
                    {/* 交易所信息 */}
                    <div className="flex items-center gap-3 p-4 rounded-xl bg-[#1E1E2E] border border-[#2A2A3A]">
                      <div className="w-10 h-10 rounded-xl bg-[#2A2A3A] flex items-center justify-center overflow-hidden relative">
                        {selectedApiKey.icon?.startsWith('/') ? (
                          <Image src={selectedApiKey.icon} alt={selectedApiKey.name} fill className="object-contain" />
                        ) : (
                          <span className="text-lg">{selectedApiKey.name.charAt(0)}</span>
                        )}
                      </div>
                      <div>
                        <p className="font-semibold">{selectedApiKey.name}</p>
                        <p className="text-[#9090A0] text-sm font-mono">{selectedApiKey.apiKey}</p>
                      </div>
                    </div>

                    {/* 权限列表 */}
                    <div className="p-4 rounded-xl bg-[#1E1E2E] border border-[#2A2A3A]">
                      <p className="text-[#9090A0] text-xs mb-2">API 权限</p>
                      <div className="flex flex-wrap gap-2">
                        {verifyResult.permissions?.map((perm, index) => (
                          <span key={index} className="px-2 py-1 rounded-md bg-[#10B981]/10 text-[#10B981] text-xs">
                            {perm}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* 资产列表 */}
                    <div className="p-4 rounded-xl bg-[#1E1E2E] border border-[#2A2A3A]">
                      {/* 总资产在上面 */}
                      <div className="flex justify-between items-center mb-3 pb-3 border-b border-[#2A2A3A]">
                        <span className="text-[#9090A0] text-sm">总资产</span>
                        <span className="text-xl font-bold font-mono text-[#10B981]">${verifyResult.totalValue?.toLocaleString()}</span>
                      </div>
                      {/* 币种明细 */}
                      <p className="text-[#9090A0] text-xs mb-2">资产明细</p>
                      <div className="space-y-2">
                        {verifyResult.assets?.map((asset, index) => (
                          <div key={index} className="flex justify-between items-center">
                            <span className="text-[#F8F8FC] font-medium">{asset.symbol}</span>
                            <div className="text-right">
                              <span className="text-[#F8F8FC] font-mono">{asset.amount}</span>
                              <span className="text-[#9090A0] text-xs ml-2">≈ ${asset.value.toLocaleString()}</span>
                            </div>
                          </div>
                        ))}
                      </div>
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
                  <h3 className="text-xl font-bold mb-2 text-[#F43F5E]">验证失败</h3>
                  <p className="text-[#9090A0] mb-6">无法连接到交易所，请检查 API 配置</p>

                  {/* 错误详情 */}
                  <div className="p-4 rounded-xl bg-[#F43F5E]/10 border border-[#F43F5E]/20 text-left mb-4">
                    <p className="text-sm text-[#F43F5E] flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      {verifyResult.error}
                    </p>
                  </div>

                  {/* 可能的解决方案 */}
                  <div className="p-4 rounded-xl bg-[#1E1E2E] border border-[#2A2A3A] text-left">
                    <p className="text-[#9090A0] text-xs mb-2">请检查以下事项：</p>
                    <ul className="text-[#9090A0] text-sm space-y-1">
                      <li>• API Key 和 Secret Key 是否正确</li>
                      <li>• API 是否已过期或被禁用</li>
                      <li>• IP 白名单是否已添加服务器 IP</li>
                      <li>• 是否开启了必要的交易权限</li>
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
                className="w-full mt-6 py-2.5 bg-[#1E1E2E] hover:bg-[#2A2A3A] border border-[#2A2A3A] text-[#F8F8FC] rounded-lg transition-colors font-medium"
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
