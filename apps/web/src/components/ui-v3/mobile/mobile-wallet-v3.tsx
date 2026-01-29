'use client'

import { useState } from 'react'
import {
  Wallet,
  ArrowDownToLine,
  ArrowUpFromLine,
  Plus,
  Key,
  CheckCircle,
  Clock,
  XCircle,
  TrendingUp,
  TrendingDown,
  Home,
  BarChart3,
  Layers,
  User,
  Coins
} from 'lucide-react'

interface Asset {
  id: string
  symbol: string
  name: string
  balance: number
  value: number
}

interface Transaction {
  id: string
  type: 'deposit' | 'withdraw' | 'buy' | 'transfer'
  amount: number
  asset: string
  status: 'completed' | 'pending' | 'failed'
  time: string
}

interface Exchange {
  id: string
  name: string
  status: 'active' | 'inactive'
}

interface MobileWalletV3Props {
  totalBalance?: number
  dailyChange?: number
  assets?: Asset[]
  transactions?: Transaction[]
  exchanges?: Exchange[]
  onDeposit?: () => void
  onWithdraw?: () => void
  onBuyHoot?: () => void
  onAddExchange?: () => void
  onNavigate?: (tab: string) => void
}

const defaultAssets: Asset[] = [
  { id: '1', symbol: 'USDT', name: 'Tether USD', balance: 10346.57, value: 10346.57 },
  { id: '2', symbol: 'HOOT', name: 'HOOT Token', balance: 2500.75, value: 612.68 },
  { id: '3', symbol: 'POINTS', name: '积分', balance: 1250, value: 0 },
]

const defaultTransactions: Transaction[] = [
  { id: '1', type: 'deposit', amount: 1000, asset: 'USDT', status: 'completed', time: '今天 14:30' },
  { id: '2', type: 'withdraw', amount: 500, asset: 'USDT', status: 'pending', time: '今天 12:15' },
  { id: '3', type: 'buy', amount: 250, asset: 'HOOT', status: 'completed', time: '昨天 18:20' },
]

const defaultExchanges: Exchange[] = [
  { id: '1', name: 'Binance', status: 'active' },
  { id: '2', name: 'OKX', status: 'active' },
]

export function MobileWalletV3({
  totalBalance = 12847.32,
  dailyChange = 2.34,
  assets = defaultAssets,
  transactions = defaultTransactions,
  exchanges = defaultExchanges,
  onDeposit,
  onWithdraw,
  onBuyHoot,
  onAddExchange,
  onNavigate
}: MobileWalletV3Props) {
  const [activeTab, setActiveTab] = useState<'assets' | 'transactions' | 'exchanges'>('assets')
  const [navTab, setNavTab] = useState('wallet')
  const isPositiveChange = dailyChange > 0

  const handleNavChange = (tabId: string) => {
    setNavTab(tabId)
    onNavigate?.(tabId)
  }

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

  const getTypeText = (type: string) => {
    const typeMap: Record<string, string> = {
      deposit: '充值',
      withdraw: '提现',
      buy: '购买',
      transfer: '转账'
    }
    return typeMap[type] || type
  }

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-[#F8F8FC] max-w-md mx-auto pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 backdrop-blur-xl bg-[#0A0A0F]/90 border-b border-[#1E1E2E] px-4 py-4">
        <div className="flex items-center gap-2">
          <Wallet className="w-6 h-6 text-[#06B6D4]" />
          <h1 className="text-xl font-bold">钱包</h1>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Balance Card */}
        <div className="backdrop-blur-xl bg-[#12121A]/80 border border-[#1E1E2E] rounded-2xl p-5">
          <p className="text-[#9090A0] text-sm mb-1">总资产 (USDT)</p>
          <div className="flex items-baseline gap-3 mb-4">
            <span className="text-3xl font-bold">${totalBalance.toLocaleString()}</span>
            <div className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium ${
              isPositiveChange ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
            }`}>
              {isPositiveChange ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {isPositiveChange ? '+' : ''}{dailyChange}%
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={onDeposit}
              className="flex flex-col items-center gap-1 py-3 bg-[#06B6D4] rounded-xl"
            >
              <ArrowDownToLine className="w-5 h-5 text-black" />
              <span className="text-xs font-medium text-black">充值</span>
            </button>
            <button
              type="button"
              onClick={onWithdraw}
              className="flex flex-col items-center gap-1 py-3 bg-[#1E1E2E] border border-[#2A2A3A] rounded-xl"
            >
              <ArrowUpFromLine className="w-5 h-5 text-[#F8F8FC]" />
              <span className="text-xs font-medium text-[#F8F8FC]">提现</span>
            </button>
            <button
              type="button"
              onClick={onBuyHoot}
              className="flex flex-col items-center gap-1 py-3 bg-[#1E1E2E] border border-[#2A2A3A] rounded-xl"
            >
              <Coins className="w-5 h-5 text-[#06B6D4]" />
              <span className="text-xs font-medium text-[#F8F8FC]">买HOOT</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2">
          {[
            { id: 'assets', label: '资产' },
            { id: 'transactions', label: '记录' },
            { id: 'exchanges', label: 'API密钥' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-[#06B6D4] text-black'
                  : 'bg-[#12121A]/50 border border-[#1E1E2E] text-[#9090A0]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'assets' && (
          <div className="backdrop-blur-xl bg-[#12121A]/80 border border-[#1E1E2E] rounded-2xl overflow-hidden">
            {assets.map((asset, index) => (
              <div
                key={asset.id}
                className={`flex items-center justify-between p-4 ${
                  index !== assets.length - 1 ? 'border-b border-[#1E1E2E]' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#2A2A3A] rounded-full flex items-center justify-center">
                    <span className="text-sm font-bold text-[#06B6D4]">{asset.symbol.charAt(0)}</span>
                  </div>
                  <div>
                    <p className="font-medium">{asset.symbol}</p>
                    <p className="text-[#606070] text-xs">{asset.name}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{asset.balance.toLocaleString()}</p>
                  <p className="text-[#606070] text-xs">
                    {asset.value > 0 ? `≈ $${asset.value.toLocaleString()}` : '-'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'transactions' && (
          <div className="backdrop-blur-xl bg-[#12121A]/80 border border-[#1E1E2E] rounded-2xl overflow-hidden">
            {transactions.length > 0 ? (
              transactions.map((tx, index) => (
                <div
                  key={tx.id}
                  className={`flex items-center justify-between p-4 ${
                    index !== transactions.length - 1 ? 'border-b border-[#1E1E2E]' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#1E1E2E] rounded-full flex items-center justify-center">
                      {tx.type === 'deposit' ? (
                        <ArrowDownToLine className="w-5 h-5 text-green-400" />
                      ) : tx.type === 'withdraw' ? (
                        <ArrowUpFromLine className="w-5 h-5 text-red-400" />
                      ) : (
                        <Coins className="w-5 h-5 text-[#06B6D4]" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium">{getTypeText(tx.type)}</p>
                      <p className="text-[#606070] text-xs">{tx.time}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-semibold ${
                      tx.type === 'deposit' ? 'text-green-400' :
                      tx.type === 'withdraw' ? 'text-red-400' : 'text-[#F8F8FC]'
                    }`}>
                      {tx.type === 'deposit' ? '+' : tx.type === 'withdraw' ? '-' : ''}
                      {tx.amount} {tx.asset}
                    </p>
                    <div className="flex items-center justify-end gap-1">
                      {getStatusIcon(tx.status)}
                      <span className="text-[#606070] text-xs">
                        {tx.status === 'completed' ? '完成' : tx.status === 'pending' ? '处理中' : '失败'}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-[#606070]">
                暂无交易记录
              </div>
            )}
          </div>
        )}

        {activeTab === 'exchanges' && (
          <div className="space-y-3">
            <div className="backdrop-blur-xl bg-[#12121A]/80 border border-[#1E1E2E] rounded-2xl overflow-hidden">
              {exchanges.map((exchange, index) => (
                <div
                  key={exchange.id}
                  className={`flex items-center justify-between p-4 ${
                    index !== exchanges.length - 1 ? 'border-b border-[#1E1E2E]' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#2A2A3A] rounded-lg flex items-center justify-center">
                      <span className="text-sm font-bold text-[#06B6D4]">{exchange.name.charAt(0)}</span>
                    </div>
                    <div>
                      <p className="font-medium">{exchange.name}</p>
                      <div className="flex items-center gap-1">
                        <div className={`w-2 h-2 rounded-full ${
                          exchange.status === 'active' ? 'bg-green-400' : 'bg-gray-400'
                        }`} />
                        <span className="text-xs text-[#606070]">
                          {exchange.status === 'active' ? '已连接' : '未激活'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Key className="w-4 h-4 text-[#606070]" />
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={onAddExchange}
              className="w-full flex items-center justify-center gap-2 p-4 backdrop-blur-xl bg-[#12121A]/80 border border-[#1E1E2E] border-dashed rounded-2xl text-[#9090A0] hover:text-[#F8F8FC] hover:border-[#06B6D4]/50 transition-colors"
            >
              <Plus className="w-5 h-5" />
              <span>添加交易所 API</span>
            </button>
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-1/2 transform -translate-x-1/2 w-full max-w-md backdrop-blur-xl bg-[#0A0A0F]/95 border-t border-[#1E1E2E]">
        <div className="grid grid-cols-5 py-2">
          {[
            { id: 'home', icon: Home, label: '首页' },
            { id: 'trading', icon: BarChart3, label: '交易' },
            { id: 'strategies', icon: Layers, label: '策略' },
            { id: 'wallet', icon: Wallet, label: '钱包' },
            { id: 'me', icon: User, label: '我的' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleNavChange(tab.id)}
              className={`flex flex-col items-center py-2 px-1 transition-colors ${
                navTab === tab.id ? 'text-[#06B6D4]' : 'text-[#606070]'
              }`}
            >
              <tab.icon className="w-5 h-5 mb-1" />
              <span className="text-xs">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
