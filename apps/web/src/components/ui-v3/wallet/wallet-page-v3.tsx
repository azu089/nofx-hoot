'use client'

import { useState, useMemo } from 'react'
import Image from 'next/image'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import {
  Wallet,
  ArrowDownToLine,
  ArrowUpFromLine,
  Key,
  CheckCircle,
  Clock,
  XCircle,
  TrendingUp,
  TrendingDown,
  ArrowLeftRight,
  Calendar,
  ChevronDown,
  FileText,
  Sparkles
} from 'lucide-react'
import { EcosystemPageV3 } from '../ecosystem/ecosystem-page-v3'
import { ApiKeysPage } from './api-keys-page'

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

interface Transaction {
  id: string
  type: 'deposit' | 'withdraw' | 'buy' | 'exchange'
  amount: number
  asset: string
  status: 'completed' | 'pending' | 'failed'
  time: string
}

interface WalletPageV3Props {
  initialTab?: 'wallet' | 'api' | 'ecosystem'
  onDeposit?: () => void
  onWithdraw?: () => void
  onExchange?: () => void
  onGoToEcosystem?: () => void
  onAddExchange?: () => void
  onEditExchange?: (id: string) => void
  onDeleteExchange?: (id: string) => void
  onActivateExchange?: (id: string) => void
}

export function WalletPageV3({
  initialTab = 'wallet',
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

  const { isAuthenticated } = useAuth()

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
          createdAt: string
        }>
        total: number
      }>('/wallet/transactions')
      return response.data
    },
    enabled: isAuthenticated,
  })

  // 转换余额数据为资产列表 - 始终显示所有资产类型
  const assets = useMemo<Asset[]>(() => {
    const result: Asset[] = []

    // USDT - 始终显示
    const usdtBalance = parseFloat(balanceData?.usdt || '0')
    result.push({
      id: 'usdt',
      name: 'USDT',
      symbol: 'USDT',
      balance: usdtBalance,
      value: usdtBalance,
      icon: '/icons/usdt.svg'
    })

    // HOOT（可用）= 总额 - 锁定，涵盖所有来源（兑换/充值/已释放空投）
    const hootBalance = parseFloat(balanceData?.hoot || '0')
    const lockedHoot = parseFloat(airdropData?.lockedBalance || '0')
    const usableHoot = Math.max(0, hootBalance - lockedHoot)

    result.push({
      id: 'hoot',
      name: 'HOOT',
      symbol: 'HOOT',
      balance: usableHoot,
      value: usableHoot,
      icon: '/icons/hoot/token.png'
    })

    // HOOT 锁仓释放中 - 始终显示
    const totalHoot = parseFloat(airdropData?.totalBalance || '0')
    result.push({
      id: 'hoot-locked',
      name: 'HOOT 释放中',
      symbol: 'HOOT',
      balance: lockedHoot,
      value: lockedHoot,
      icon: '/icons/hoot/token.png',
      isReleasing: true,
      releasedAmount: totalHoot - lockedHoot,
      totalLocked: totalHoot
    })

    // GAS - 始终显示
    const pointBalance = parseFloat(balanceData?.point || '0')
    result.push({
      id: 'point',
      name: 'GAS',
      symbol: 'GAS',
      balance: pointBalance,
      value: pointBalance,
      icon: '/icons/gas-card.svg'
    })

    return result
  }, [balanceData, airdropData])

  // 计算总余额
  const totalBalance = useMemo(() => {
    return assets.reduce((sum, asset) => sum + asset.value, 0)
  }, [assets])

  // 转换交易记录
  const transactions = useMemo<Transaction[]>(() => {
    if (!transactionsData?.items) return []
    return transactionsData.items.map(tx => ({
      id: tx.id,
      type: tx.type as Transaction['type'],
      amount: parseFloat(tx.amount),
      asset: tx.asset,
      status: tx.status as Transaction['status'],
      time: new Date(tx.createdAt).toLocaleString('zh-CN')
    }))
  }, [transactionsData])

  // 日变化（暂时固定，后续可接入行情 API）
  const dailyChange = 0
  const isPositiveChange = dailyChange > 0

  // 页面级 Tab 切换：资产 / API / 生态
  const [pageTab, setPageTab] = useState<'wallet' | 'api' | 'ecosystem'>(initialTab)
  const [selectedTab, setSelectedTab] = useState<'assets' | 'transactions'>('assets')
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [showTypeFilter, setShowTypeFilter] = useState(false)
  const [showAssetFilter, setShowAssetFilter] = useState(false)
  const [dateRange, setDateRange] = useState({ start: '2026-01-01', end: '2026-01-29' })
  const [txTypeFilter, setTxTypeFilter] = useState<'all' | 'deposit' | 'withdraw' | 'exchange'>('all')
  const [txAssetFilter, setTxAssetFilter] = useState<'all' | 'USDT' | 'HOOT'>('all')

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

    // 时间过滤
    let matchesDate = true
    if (tx.time && dateRange.start && dateRange.end) {
      // 从时间字符串提取日期部分（支持 "2026-01-15 14:30" 或 "2026/01/15" 等格式）
      const txDateStr = tx.time.split(' ')[0].replace(/\//g, '-')
      const txDate = new Date(txDateStr)
      const startDate = new Date(dateRange.start)
      const endDate = new Date(dateRange.end)
      // 设置结束日期为当天的最后一刻
      endDate.setHours(23, 59, 59, 999)
      matchesDate = txDate >= startDate && txDate <= endDate
    }

    return matchesType && matchesAsset && matchesDate
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
                                sizes="40px"
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
                                        sizes="24px"
                                        className="object-contain"
                                      />
                                    ) : (
                                      <span className="text-[10px] font-bold text-[#06B6D4]">{tx.asset.charAt(0)}</span>
                                    )}
                                  </div>
                                  <span className="font-medium text-[#9090A0]">{getAssetLabel(tx.asset)}</span>
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

        {/* ===== API Tab 内容 - 使用统一的 ApiKeysPage 组件 ===== */}
        {pageTab === 'api' && (
          <ApiKeysPage />
        )}

        {/* ===== 生态 Tab 内容 ===== */}
        {pageTab === 'ecosystem' && (
          <EcosystemPageV3 />
        )}
      </div>
    </div>
  )
}
