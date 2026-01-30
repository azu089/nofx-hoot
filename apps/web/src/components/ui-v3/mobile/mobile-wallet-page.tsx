"use client"

import { useState } from "react"
import Image from "next/image"
import {
  TrendingUp,
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
  type: 'deposit' | 'withdraw' | 'exchange'
  asset: string
  amount: string
  status: 'completed' | 'pending' | 'failed'
  time: string
  trend: "up" | "down"
}

interface APIKeyItem {
  id: string
  name: string
  icon?: string
  status: 'active' | 'error'
  apiKey?: string
  permissions?: string[]
  createdAt?: string
  balance?: number
  error?: string
}

// 支持的交易所
const supportedExchanges = [
  { id: 'binance', name: 'Binance', logo: '/icons/exchanges/币安.png', guideUrl: 'https://www.binance.com/api-management' },
  { id: 'okx', name: 'OKX', logo: '/icons/exchanges/okx.png', guideUrl: 'https://www.okx.com/account/my-api' },
  { id: 'bybit', name: 'Bybit', logo: '/icons/exchanges/bybit.png', guideUrl: 'https://www.bybit.com/app/user/api-management' },
  { id: 'gate', name: 'Gate.io', logo: '/icons/exchanges/gate.png', guideUrl: 'https://www.gate.io/myaccount/apikeys' },
  { id: 'bitget', name: 'Bitget', logo: '/icons/exchanges/bitget.png', guideUrl: 'https://www.bitget.com/api' },
  { id: 'coinbase', name: 'Coinbase', logo: '/icons/exchanges/coinbase.png', guideUrl: 'https://www.coinbase.com/settings/api' },
]

interface MobileWalletPageProps {
  onNavigate?: (path: string) => void
}

export function MobileWalletPage({ onNavigate }: MobileWalletPageProps) {
  const [mainTab, setMainTab] = useState<MainTab>("wallet")
  const [walletSubTab, setWalletSubTab] = useState<WalletSubTab>("assets")

  // 历史账单筛选状态
  const [showTypeFilter, setShowTypeFilter] = useState(false)
  const [showAssetFilter, setShowAssetFilter] = useState(false)
  const [txTypeFilter, setTxTypeFilter] = useState<'all' | 'deposit' | 'withdraw' | 'exchange'>('all')
  const [txAssetFilter, setTxAssetFilter] = useState<'all' | 'USDT' | 'HOOT'>('all')

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
    error?: string
  } | null>(null)
  const [selectedExchange, setSelectedExchange] = useState<string | null>(null)
  const [selectedApiKey, setSelectedApiKey] = useState<APIKeyItem | null>(null)
  const [showSecret, setShowSecret] = useState(false)
  const [copied, setCopied] = useState(false)
  const [formData, setFormData] = useState({ apiKey: '', secretKey: '', passphrase: '', label: '' })
  const [editFormData, setEditFormData] = useState({ apiKey: '', secretKey: '', passphrase: '', label: '' })

  // 筛选选项
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
  const handleVerify = (api: APIKeyItem) => {
    setSelectedApiKey(api)
    setVerifyStatus('loading')
    setVerifyResult(null)
    setShowVerifyModal(true)

    // 模拟 API 验证请求
    setTimeout(() => {
      if (api.status === 'active') {
        setVerifyStatus('success')
        setVerifyResult({
          permissions: api.permissions || ['现货交易'],
          assets: [
            { symbol: 'USDT', amount: '3,234.56', value: 3234.56 },
            { symbol: 'BTC', amount: '0.05432', value: 1856.78 },
            { symbol: 'ETH', amount: '0.8521', value: 143.22 }
          ],
          totalValue: api.balance || 5234.56
        })
      } else {
        setVerifyStatus('error')
        setVerifyResult({
          error: api.error || 'API Key 验证失败，请检查密钥是否正确'
        })
      }
    }, 1500)
  }

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // 资产数据 - 极简风格
  const assets: AssetItem[] = [
    {
      name: "USDT",
      symbol: "USDT",
      amount: "10,346.57",
      value: "10,346.57",
      icon: "/icons/usdt.svg",
    },
    {
      name: "HOOT",
      symbol: "HOOT",
      amount: "2,500.75",
      value: "2,500.75",
      icon: "/icons/hoot/token.png",
    },
    {
      name: "HOOT 释放中",
      symbol: "HOOT",
      amount: "15,000",
      value: "15,000",
      locked: true,
      releaseProgress: 17,
      releaseInfo: "空投锁仓 · 每日释放",
      icon: "/icons/hoot/token.png",
    },
    {
      name: "点卡",
      symbol: "GAS",
      amount: "1,250",
      value: "1,250",
      icon: "/icons/gas-card.svg",
    },
  ]

  // 交易历史数据
  const transactions: TransactionItem[] = [
    {
      id: "1",
      type: "deposit",
      asset: "USDT",
      amount: "+500.00",
      status: "completed",
      time: "2024-01-20 14:30",
      trend: "up",
    },
    {
      id: "2",
      type: "withdraw",
      asset: "HOOT",
      amount: "-100.00",
      status: "completed",
      time: "2024-01-19 10:15",
      trend: "down",
    },
    {
      id: "3",
      type: "exchange",
      asset: "USDT → HOOT",
      amount: "1000.00",
      status: "completed",
      time: "2024-01-18 16:45",
      trend: "up",
    },
    {
      id: "4",
      type: "deposit",
      asset: "USDT",
      amount: "+1000.00",
      status: "pending",
      time: "2024-01-17 09:00",
      trend: "up",
    },
  ]

  // 筛选交易记录
  const filteredTransactions = transactions.filter(tx => {
    const matchesType = txTypeFilter === 'all' || tx.type === txTypeFilter
    const matchesAsset = txAssetFilter === 'all' || tx.asset.includes(txAssetFilter)
    return matchesType && matchesAsset
  })

  // 获取类型文本
  const getTypeText = (type: string) => {
    switch (type) {
      case 'deposit': return '充值'
      case 'withdraw': return '提现'
      case 'exchange': return '兑换'
      default: return type
    }
  }

  // 获取状态图标和文本
  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'completed':
        return { icon: <CheckCircle className="w-3.5 h-3.5 text-[#22C55E]" />, text: '成功', color: 'text-[#22C55E]' }
      case 'pending':
        return { icon: <Clock className="w-3.5 h-3.5 text-[#F59E0B]" />, text: '处理中', color: 'text-[#F59E0B]' }
      case 'failed':
        return { icon: <XCircle className="w-3.5 h-3.5 text-[#EF4444]" />, text: '失败', color: 'text-[#EF4444]' }
      default:
        return { icon: null, text: status, color: 'text-[#94A3B8]' }
    }
  }

  // API Key 数据 - 与桌面端对齐
  const apiKeys: APIKeyItem[] = [
    {
      id: "1",
      name: "Binance",
      icon: "/icons/exchanges/币安.png",
      status: "active",
      apiKey: "vK8x ... j2Qp",
      permissions: ["现货交易", "合约交易"],
      createdAt: "2026-01-10",
      balance: 5234.56,
    },
    {
      id: "2",
      name: "OKX",
      icon: "/icons/exchanges/okx.png",
      status: "error",
      apiKey: "aB3c ... 9dEf",
      permissions: ["现货交易"],
      createdAt: "2025-12-20",
      balance: 0,
      error: "API Key 已过期",
    },
  ]

  // 获取代币图标
  const getAssetIcon = (asset: string) => {
    if (asset.includes('USDT')) return '/icons/usdt.svg'
    if (asset.includes('HOOT')) return '/icons/hoot/token.png'
    return null
  }

  return (
    <div className="min-h-screen bg-[#0A0A0F] pb-20">
      {/* 顶部标题 */}
      <div className="sticky top-0 z-10 bg-[#0A0A0F]/80 backdrop-blur-lg border-b border-[#1E1E2E] px-4 py-4">
        <h1 className="text-xl font-bold text-white">资产</h1>
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
            aria-label="API"
            className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${
              mainTab === "api"
                ? "bg-[#06B6D4] text-white shadow-lg shadow-[#06B6D4]/20"
                : "text-[#94A3B8] hover:text-white"
            }`}
          >
            API
          </button>
          <button
            type="button"
            onClick={() => setMainTab("ecosystem")}
            aria-label="生态"
            className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${
              mainTab === "ecosystem"
                ? "bg-[#06B6D4] text-white shadow-lg shadow-[#06B6D4]/20"
                : "text-[#94A3B8] hover:text-white"
            }`}
          >
            生态
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
              <p className="text-sm text-[#94A3B8] mb-1">总资产 (USDT)</p>
              <div className="flex items-baseline gap-3 mb-4">
                <h2 className="text-3xl font-bold text-white">$12,847.32</h2>
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#22C55E]/10 text-[#22C55E]">
                  <TrendingUp className="w-3 h-3" />
                  <span className="text-xs font-medium">+2.34% 24h</span>
                </div>
              </div>

              {/* 快捷操作按钮 - 紧凑行内样式 */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onNavigate?.('/deposit')}
                  aria-label="充值"
                  className="flex items-center justify-center gap-1 px-3 py-1.5 bg-[#06B6D4] hover:bg-[#06B6D4]/90 text-white rounded-lg text-xs font-medium transition-colors"
                >
                  <ArrowUpRight className="w-3 h-3" />
                  充值
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate?.('/withdraw')}
                  aria-label="提现"
                  className="flex items-center justify-center gap-1 px-3 py-1.5 bg-[#1E1E2E] border border-[#2A2A3A] hover:border-[#06B6D4] text-white rounded-lg text-xs font-medium transition-colors"
                >
                  <ArrowDownLeft className="w-3 h-3" />
                  提现
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate?.('/exchange')}
                  aria-label="兑换"
                  className="flex items-center justify-center gap-1 px-3 py-1.5 bg-[#1E1E2E] border border-[#2A2A3A] hover:border-[#06B6D4] text-white rounded-lg text-xs font-medium transition-colors"
                >
                  <ArrowLeftRight className="w-3 h-3" />
                  兑换
                </button>
              </div>
            </div>
          </div>

          {/* 子 Tab 切换 */}
          <div className="flex gap-6 border-b border-[#1E1E2E]">
            <button
              type="button"
              onClick={() => setWalletSubTab("assets")}
              aria-label="资产明细"
              className={`pb-3 text-sm font-medium transition-colors relative ${
                walletSubTab === "assets"
                  ? "text-[#06B6D4]"
                  : "text-[#94A3B8] hover:text-white"
              }`}
            >
              资产明细
              {walletSubTab === "assets" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#06B6D4]" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setWalletSubTab("history")}
              aria-label="历史账单"
              className={`pb-3 text-sm font-medium transition-colors relative ${
                walletSubTab === "history"
                  ? "text-[#06B6D4]"
                  : "text-[#94A3B8] hover:text-white"
              }`}
            >
              历史账单
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
                    清除
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
                      ? '暂无账单记录'
                      : '没有符合筛选条件的记录'}
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
          {/* 添加 API 按钮 - 铺满宽度 */}
          <button
            type="button"
            onClick={handleOpenAdd}
            aria-label="添加 API"
            className="w-full flex items-center justify-center gap-2 py-3 bg-[#06B6D4] hover:bg-[#06B6D4]/90 text-white rounded-xl font-medium transition-colors"
          >
            <Plus className="w-5 h-5" />
            添加 API
          </button>

          {/* API 列表 */}
          {apiKeys.length === 0 ? (
            <div className="p-8 rounded-xl bg-[#12121A] border border-[#1E1E2E] text-center">
              <Key className="w-12 h-12 text-[#94A3B8] mx-auto mb-3" />
              <p className="text-[#94A3B8]">暂无绑定的 API Key</p>
              <p className="text-[#94A3B8] text-sm mt-1">点击上方按钮添加您的第一个交易所</p>
            </div>
          ) : (
            <div className="space-y-3">
              {apiKeys.map((api) => (
                <div
                  key={api.id}
                  className={`bg-[#12121A] rounded-xl p-4 border transition-colors ${
                    api.status === 'error' ? 'border-[#F43F5E]/30' : 'border-[#1E1E2E]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    {/* 左侧：图标 + 信息 */}
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#1E1E2E] flex items-center justify-center overflow-hidden relative">
                        {api.icon ? (
                          <Image src={api.icon} alt={api.name} fill className="object-contain" />
                        ) : (
                          <span className="text-lg text-white">{api.name.charAt(0)}</span>
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-white">{api.name}</h3>
                          {api.status === "active" ? (
                            <CheckCircle className="w-4 h-4 text-[#10B981]" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-[#F43F5E]" />
                          )}
                        </div>
                        {api.status === 'error' && api.error ? (
                          <p className="text-xs text-[#F43F5E]">{api.error}</p>
                        ) : (
                          <p className="text-sm text-[#94A3B8]">
                            ${api.balance?.toLocaleString() || '0'}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* 右侧：操作按钮 */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleVerify(api)}
                        aria-label="验证"
                        className="p-2 hover:bg-[#1E1E2E] rounded-lg transition-colors"
                      >
                        <RefreshCw className="w-4 h-4 text-[#94A3B8]" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(api)}
                        aria-label="编辑"
                        className="p-2 hover:bg-[#1E1E2E] rounded-lg transition-colors"
                      >
                        <Edit2 className="w-4 h-4 text-[#94A3B8]" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenDelete(api)}
                        aria-label="删除"
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
      )}

      {/* 生态 Tab 内容 - 使用独立组件 */}
      {mainTab === "ecosystem" && (
        <div className="-mx-4 -mt-4">
          <MobileEcosystemV3 />
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
          className="fixed inset-0 bg-black/70 z-50 mobile-overlay"
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
                  如何获取 API Key？
                </a>

                <div>
                  <label htmlFor="mobile-add-api-key" className="text-sm text-[#94A3B8] block mb-1">API Key *</label>
                  <input
                    id="mobile-add-api-key"
                    type="text"
                    value={formData.apiKey}
                    onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                    placeholder="请输入 API Key"
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
                      onChange={(e) => setFormData({ ...formData, secretKey: e.target.value })}
                      placeholder="请输入 Secret Key"
                      className="w-full px-4 py-3 pr-12 rounded-lg bg-[#1E1E2E] border border-[#2A2A3A] text-white placeholder-[#64748B] focus:outline-none focus:border-[#06B6D4]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSecret(!showSecret)}
                      title={showSecret ? '隐藏密钥' : '显示密钥'}
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
                      onChange={(e) => setFormData({ ...formData, passphrase: e.target.value })}
                      placeholder="请输入 Passphrase"
                      className="w-full px-4 py-3 rounded-lg bg-[#1E1E2E] border border-[#2A2A3A] text-white placeholder-[#64748B] focus:outline-none focus:border-[#06B6D4]"
                    />
                  </div>
                )}

                <div>
                  <label htmlFor="mobile-add-label" className="text-sm text-[#94A3B8] block mb-1">备注名称（可选）</label>
                  <input
                    id="mobile-add-label"
                    type="text"
                    value={formData.label}
                    onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                    placeholder="如：主账户"
                    className="w-full px-4 py-3 rounded-lg bg-[#1E1E2E] border border-[#2A2A3A] text-white placeholder-[#64748B] focus:outline-none focus:border-[#06B6D4]"
                  />
                </div>

                <div className="p-3 rounded-lg bg-[#1E1E2E] border border-[#2A2A3A]">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-white">IP 白名单</p>
                      <p className="text-[#94A3B8] text-xs">请将以下 IP 添加到交易所白名单</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopy('47.89.192.xxx')}
                      className="flex items-center gap-1 text-[#06B6D4] text-sm"
                    >
                      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      {copied ? '已复制' : '复制'}
                    </button>
                  </div>
                  <p className="font-mono text-sm mt-2 text-[#94A3B8]">47.89.192.xxx</p>
                </div>

                {/* 安全提示 */}
                <div className="p-3 rounded-lg bg-[#12121A] border-l-4 border-l-[#06B6D4] border border-[#1E1E2E]">
                  <div className="flex items-start gap-2">
                    <Shield className="w-4 h-4 text-[#06B6D4] mt-0.5 flex-shrink-0" />
                    <ul className="text-[#94A3B8] text-xs space-y-1">
                      <li>• 仅开启「交易」权限，禁止开启「提现」权限</li>
                      <li>• 建议绑定 IP 白名单以增强安全性</li>
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
                    取消
                  </button>
                  <button
                    type="button"
                    className="flex-1 py-3.5 bg-[#06B6D4] hover:bg-[#06B6D4]/90 text-white rounded-xl transition-colors font-medium"
                  >
                    验证并绑定
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
          className="fixed inset-0 bg-black/70 z-50 mobile-overlay"
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
                    <h3 className="text-lg font-bold text-white">编辑 {selectedApiKey.name} API</h3>
                    <p className="text-[#94A3B8] text-xs">更新 API 密钥配置</p>
                  </div>
                </div>
                <button
                  type="button"
                  title="关闭"
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
                    <p className="text-xs text-[#94A3B8]">绑定时间</p>
                    <p className="text-[#94A3B8] text-sm mt-0.5">{selectedApiKey.createdAt || '-'}</p>
                  </div>
                </div>
                {selectedApiKey.permissions && selectedApiKey.permissions.length > 0 && (
                  <div className="pt-3 border-t border-[#1E1E2E]">
                    <p className="text-xs text-[#94A3B8] mb-2">已授权权限</p>
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
                <label htmlFor="mobile-edit-api-key" className="text-sm text-[#94A3B8] block mb-1">新 API Key（留空则不更新）</label>
                <input
                  id="mobile-edit-api-key"
                  type="text"
                  value={editFormData.apiKey}
                  onChange={(e) => setEditFormData({ ...editFormData, apiKey: e.target.value })}
                  placeholder="输入新的 API Key"
                  className="w-full px-4 py-3 rounded-lg bg-[#1E1E2E] border border-[#2A2A3A] text-white placeholder-[#64748B] focus:outline-none focus:border-[#06B6D4]"
                />
              </div>

              <div>
                <label htmlFor="mobile-edit-secret-key" className="text-sm text-[#94A3B8] block mb-1">新 Secret Key（留空则不更新）</label>
                <div className="relative">
                  <input
                    id="mobile-edit-secret-key"
                    type={showSecret ? 'text' : 'password'}
                    value={editFormData.secretKey}
                    onChange={(e) => setEditFormData({ ...editFormData, secretKey: e.target.value })}
                    placeholder="输入新的 Secret Key"
                    className="w-full px-4 py-3 pr-12 rounded-lg bg-[#1E1E2E] border border-[#2A2A3A] text-white placeholder-[#64748B] focus:outline-none focus:border-[#06B6D4]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                    title={showSecret ? '隐藏密钥' : '显示密钥'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#94A3B8]"
                  >
                    {showSecret ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="mobile-edit-label" className="text-sm text-[#94A3B8] block mb-1">备注名称</label>
                <input
                  id="mobile-edit-label"
                  type="text"
                  value={editFormData.label}
                  onChange={(e) => setEditFormData({ ...editFormData, label: e.target.value })}
                  placeholder="如：主账户"
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
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleConfirmEdit}
                  className="flex-1 py-3.5 bg-[#06B6D4] hover:bg-[#06B6D4]/90 text-white rounded-xl transition-colors font-medium"
                >
                  保存更改
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
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-5 mobile-overlay"
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

              <h3 className="text-xl font-bold text-white mb-2">确认删除</h3>
              <p className="text-[#94A3B8] text-sm mb-5">
                您确定要删除 <span className="text-white font-semibold">{selectedApiKey.name}</span> 的 API 密钥吗？
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
                  <span>删除后，使用此 API 的策略将无法继续执行交易。此操作不可撤销。</span>
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
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="flex-1 py-3.5 bg-[#F43F5E] hover:bg-[#F43F5E]/90 text-white rounded-xl transition-colors font-medium flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  删除
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 验证结果弹窗 - 居中对话框 */}
      {showVerifyModal && selectedApiKey && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-5 mobile-overlay"
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
                  <h3 className="text-xl font-bold text-white mb-2">正在验证</h3>
                  <p className="text-[#94A3B8] text-sm">正在连接 {selectedApiKey.name} 验证 API 状态...</p>
                </>
              )}

              {/* 成功状态 */}
              {verifyStatus === 'success' && verifyResult && (
                <>
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#10B981]/10 flex items-center justify-center">
                    <CheckCircle className="w-8 h-8 text-[#10B981]" />
                  </div>
                  <h3 className="text-xl font-bold text-[#10B981] mb-2">验证成功</h3>
                  <p className="text-[#94A3B8] text-sm mb-5">API 连接正常，可正常使用</p>

                  {/* 验证详情 */}
                  <div className="space-y-3 text-left">
                    {/* 交易所信息 */}
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-[#1E1E2E] border border-[#2A2A3A]">
                      <div className="w-10 h-10 rounded-xl bg-[#2A2A3A] flex items-center justify-center overflow-hidden relative">
                        {selectedApiKey.icon ? (
                          <Image src={selectedApiKey.icon} alt={selectedApiKey.name} fill className="object-contain" />
                        ) : (
                          <span className="text-lg text-white">{selectedApiKey.name.charAt(0)}</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-white text-sm">{selectedApiKey.name}</p>
                        <p className="text-[#94A3B8] text-xs font-mono truncate">{selectedApiKey.apiKey}</p>
                      </div>
                    </div>

                    {/* 权限列表 */}
                    <div className="p-3 rounded-xl bg-[#1E1E2E] border border-[#2A2A3A]">
                      <p className="text-[#94A3B8] text-xs mb-2">API 权限</p>
                      <div className="flex flex-wrap gap-2">
                        {verifyResult.permissions?.map((perm, index) => (
                          <span key={index} className="px-2.5 py-1 rounded-lg bg-[#10B981]/10 text-[#10B981] text-xs font-medium">
                            {perm}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* 资产列表 */}
                    <div className="p-3 rounded-xl bg-[#1E1E2E] border border-[#2A2A3A]">
                      {/* 总资产在上面 */}
                      <div className="flex justify-between items-center mb-3 pb-3 border-b border-[#2A2A3A]">
                        <span className="text-[#94A3B8] text-sm">总资产</span>
                        <span className="text-xl font-bold font-mono text-[#10B981]">${verifyResult.totalValue?.toLocaleString()}</span>
                      </div>
                      {/* 币种明细 */}
                      <p className="text-[#94A3B8] text-xs mb-2">资产明细</p>
                      <div className="space-y-2.5">
                        {verifyResult.assets?.map((asset, index) => (
                          <div key={index} className="flex justify-between items-center">
                            <span className="text-white font-medium text-sm">{asset.symbol}</span>
                            <div className="text-right">
                              <span className="text-white font-mono text-sm">{asset.amount}</span>
                              <span className="text-[#94A3B8] text-xs ml-2">≈ ${asset.value.toLocaleString()}</span>
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
                  <h3 className="text-xl font-bold text-[#F43F5E] mb-2">验证失败</h3>
                  <p className="text-[#94A3B8] text-sm mb-5">无法连接到交易所，请检查 API 配置</p>

                  {/* 错误详情 */}
                  <div className="p-3 rounded-xl bg-[#F43F5E]/10 border border-[#F43F5E]/20 text-left mb-4">
                    <p className="text-sm text-[#F43F5E] flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <span>{verifyResult.error}</span>
                    </p>
                  </div>

                  {/* 可能的解决方案 */}
                  <div className="p-3 rounded-xl bg-[#1E1E2E] border border-[#2A2A3A] text-left">
                    <p className="text-[#94A3B8] text-xs mb-2">请检查以下事项：</p>
                    <ul className="text-[#94A3B8] text-xs space-y-1.5">
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

// Named export for MobileWalletPage
