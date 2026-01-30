'use client'

import { useState } from 'react'
import Image from 'next/image'
import {
  ArrowDownUp,
  ChevronDown,
  Info,
  Loader2,
  CheckCircle,
  Clock,
  AlertCircle
} from 'lucide-react'
// Sidebar is handled by parent layout

interface Asset {
  id: string
  name: string
  symbol: string
  balance: number
  icon: string
  rate?: number
}

interface ExchangeRecord {
  id: string
  fromAsset: string
  toAsset: string
  fromAmount: number
  toAmount: number
  status: 'completed' | 'pending' | 'failed'
  time: string
}

interface ExchangePageProps {
  onExchange?: (from: string, to: string, amount: number) => void
}

// 所有资产
const assets: Asset[] = [
  { id: 'usdt', name: 'USDT', symbol: 'USDT', balance: 10346.57, icon: '/icons/usdt.svg', rate: 1 },
  { id: 'gas', name: '点卡', symbol: 'GAS', balance: 1250, icon: '/icons/gas-card.svg', rate: 1 },
  { id: 'hoot', name: 'HOOT', symbol: 'HOOT', balance: 2500.75, icon: '/icons/hoot/token.png', rate: 0.85 },
]

// 可作为支付的资产（点卡不可作为支付）
const payableAssets: Asset[] = assets.filter(a => a.id !== 'gas')

const exchangeRecords: ExchangeRecord[] = [
  { id: '1', fromAsset: 'USDT', toAsset: 'GAS', fromAmount: 100, toAmount: 100, status: 'completed', time: '2026-01-29 14:30' },
  { id: '2', fromAsset: 'USDT', toAsset: 'HOOT', fromAmount: 500, toAmount: 588.24, status: 'completed', time: '2026-01-28 10:15' },
  { id: '3', fromAsset: 'HOOT', toAsset: 'USDT', fromAmount: 200, toAmount: 170, status: 'pending', time: '2026-01-28 09:00' },
]

export function ExchangePage({ onExchange }: ExchangePageProps) {
  // 默认支付用 USDT，获得用 GAS（点卡）
  const [fromAsset, setFromAsset] = useState(payableAssets[0])  // USDT
  const [toAsset, setToAsset] = useState(assets[1])  // GAS 点卡
  const [amount, setAmount] = useState('')
  const [showFromDropdown, setShowFromDropdown] = useState(false)
  const [showToDropdown, setShowToDropdown] = useState(false)
  const [isExchanging, setIsExchanging] = useState(false)

  const calculateReceive = () => {
    if (!amount || isNaN(parseFloat(amount))) return '0.00'
    const fromRate = fromAsset.rate || 1
    const toRate = toAsset.rate || 1
    return ((parseFloat(amount) * fromRate) / toRate).toFixed(2)
  }

  const handleSwap = () => {
    // 如果获得的是点卡，交换后点卡会变成支付，不允许
    if (toAsset.id === 'gas') {
      return
    }
    const temp = fromAsset
    setFromAsset(toAsset)
    setToAsset(temp)
  }

  // 判断是否可以交换
  const canSwap = toAsset.id !== 'gas'

  const handleExchange = async () => {
    if (!amount || parseFloat(amount) <= 0) return
    setIsExchanging(true)
    await new Promise(resolve => setTimeout(resolve, 1500))
    onExchange?.(fromAsset.symbol, toAsset.symbol, parseFloat(amount))
    setIsExchanging(false)
    setAmount('')
  }

  // 获取可支付的资产列表（排除点卡，始终显示所有可支付资产）
  const getPayableAssets = () => payableAssets

  // 获取可获得的资产列表（排除当前支付的资产）
  const getReceivableAssets = (excludeId: string) => assets.filter(a => a.id !== excludeId)

  // 处理支付资产选择，如果选择的支付资产与当前获得资产相同，自动切换获得资产
  const handleFromAssetSelect = (asset: Asset) => {
    if (asset.id === toAsset.id) {
      // 自动切换获得资产为其他可用资产（优先选点卡，因为点卡不能作为支付）
      const newToAsset = assets.find(a => a.id === 'gas') || assets.find(a => a.id !== asset.id)
      if (newToAsset) {
        setToAsset(newToAsset)
      }
    }
    setFromAsset(asset)
    setShowFromDropdown(false)
  }

  // 处理获得资产选择，如果选择的获得资产与当前支付资产相同，自动切换支付资产
  const handleToAssetSelect = (asset: Asset) => {
    if (asset.id === fromAsset.id) {
      // 自动切换支付资产为其他可支付资产
      const newFromAsset = payableAssets.find(a => a.id !== asset.id)
      if (newFromAsset) {
        setFromAsset(newFromAsset)
      }
    }
    setToAsset(asset)
    setShowToDropdown(false)
  }

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-[#F8F8FC] font-sans p-6">
          <div className="max-w-2xl mx-auto">
            {/* Header */}
            <div className="mb-4">
              <h1 className="text-2xl font-bold text-[#F8F8FC]">资产兑换</h1>
            </div>

            {/* Exchange Card */}
            <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl p-6 mb-6 shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.02)_inset] overflow-hidden">
              {/* From */}
              <div className="mb-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-[#9090A0]">支付</span>
                  <span className="text-sm text-[#9090A0]">
                    可用: <span className="text-[#F8F8FC]">{fromAsset.balance.toLocaleString()} {fromAsset.symbol}</span>
                  </span>
                </div>
                <div className="flex items-center gap-3 bg-[#0A0A0F] border border-[#1E1E2E] rounded-xl p-4">
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowFromDropdown(!showFromDropdown)}
                      className="flex items-center gap-2 px-3 py-2 bg-[#1E1E2E] rounded-lg hover:bg-[#2A2A3A] transition-colors"
                    >
                      <div className="w-6 h-6 rounded-full bg-[#2A2A3A] flex items-center justify-center overflow-hidden">
                        <Image src={fromAsset.icon} alt={fromAsset.symbol} width={20} height={20} />
                      </div>
                      <span className="font-medium">{fromAsset.symbol}</span>
                      <ChevronDown className="w-4 h-4 text-[#9090A0]" />
                    </button>
                    {showFromDropdown && (
                      <div className="absolute top-full left-0 mt-2 w-48 bg-[#12121A] border border-[#1E1E2E] rounded-lg shadow-xl z-10 overflow-hidden">
                        {getPayableAssets().map(asset => (
                          <button
                            key={asset.id}
                            type="button"
                            onClick={() => handleFromAssetSelect(asset)}
                            className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-[#1E1E2E] transition-colors ${
                              fromAsset.id === asset.id ? 'bg-[#1E1E2E]' : ''
                            }`}
                          >
                            <div className="w-6 h-6 rounded-full bg-[#2A2A3A] flex items-center justify-center overflow-hidden">
                              <Image src={asset.icon} alt={asset.symbol} width={20} height={20} />
                            </div>
                            <div className="text-left">
                              <div className="text-sm font-medium text-[#F8F8FC]">{asset.symbol}</div>
                              <div className="text-xs text-[#9090A0]">{asset.name}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="flex-1 bg-transparent text-right text-2xl font-semibold text-[#F8F8FC] outline-none placeholder:text-[#404050]"
                  />
                </div>
                <div className="flex gap-2 mt-2">
                  {[25, 50, 75, 100].map(percent => (
                    <button
                      key={percent}
                      type="button"
                      onClick={() => setAmount((fromAsset.balance * percent / 100).toFixed(2))}
                      className="px-3 py-1 text-xs bg-[#1E1E2E] rounded-lg text-[#9090A0] hover:text-[#F8F8FC] hover:bg-[#2A2A3A] transition-colors"
                    >
                      {percent}%
                    </button>
                  ))}
                </div>
              </div>

              {/* Swap Button */}
              <div className="flex justify-center my-4">
                <button
                  type="button"
                  onClick={handleSwap}
                  disabled={!canSwap}
                  title={canSwap ? "交换兑换方向" : "点卡不可作为支付方式"}
                  className={`w-10 h-10 rounded-full bg-[#1E1E2E] border border-[#2A2A3A] flex items-center justify-center transition-all ${
                    canSwap
                      ? "hover:bg-[#2A2A3A] hover:border-cyan-500/50 cursor-pointer"
                      : "opacity-50 cursor-not-allowed"
                  }`}
                >
                  <ArrowDownUp className={`w-5 h-5 ${canSwap ? "text-cyan-400" : "text-[#606070]"}`} />
                </button>
              </div>

              {/* To */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-[#9090A0]">获得</span>
                  <span className="text-sm text-[#9090A0]">
                    余额: <span className="text-[#F8F8FC]">{toAsset.balance.toLocaleString()} {toAsset.symbol}</span>
                  </span>
                </div>
                <div className="flex items-center gap-3 bg-[#0A0A0F] border border-[#1E1E2E] rounded-xl p-4">
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowToDropdown(!showToDropdown)}
                      className="flex items-center gap-2 px-3 py-2 bg-[#1E1E2E] rounded-lg hover:bg-[#2A2A3A] transition-colors"
                    >
                      <div className="w-6 h-6 rounded-full bg-[#2A2A3A] flex items-center justify-center overflow-hidden">
                        <Image src={toAsset.icon} alt={toAsset.symbol} width={20} height={20} />
                      </div>
                      <span className="font-medium">{toAsset.symbol}</span>
                      <ChevronDown className="w-4 h-4 text-[#9090A0]" />
                    </button>
                    {showToDropdown && (
                      <div className="absolute top-full left-0 mt-2 w-48 bg-[#12121A] border border-[#1E1E2E] rounded-lg shadow-xl z-10 overflow-hidden">
                        {getReceivableAssets(fromAsset.id).map(asset => (
                          <button
                            key={asset.id}
                            type="button"
                            onClick={() => handleToAssetSelect(asset)}
                            className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-[#1E1E2E] transition-colors ${
                              toAsset.id === asset.id ? 'bg-[#1E1E2E]' : ''
                            }`}
                          >
                            <div className="w-6 h-6 rounded-full bg-[#2A2A3A] flex items-center justify-center overflow-hidden">
                              <Image src={asset.icon} alt={asset.symbol} width={20} height={20} />
                            </div>
                            <div className="text-left">
                              <div className="text-sm font-medium text-[#F8F8FC]">{asset.symbol}</div>
                              <div className="text-xs text-[#9090A0]">{asset.name}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 text-right text-2xl font-semibold text-[#F8F8FC]">
                    {calculateReceive()}
                  </div>
                </div>
              </div>

              {/* Rate Info */}
              <div className="flex items-center justify-between text-sm text-[#9090A0] mb-6 px-2">
                <div className="flex items-center gap-1">
                  <Info className="w-4 h-4" />
                  <span>兑换汇率</span>
                </div>
                <span>1 {fromAsset.symbol} = {((fromAsset.rate || 1) / (toAsset.rate || 1)).toFixed(4)} {toAsset.symbol}</span>
              </div>

              {/* Exchange Button */}
              <button
                type="button"
                onClick={handleExchange}
                disabled={!amount || parseFloat(amount) <= 0 || parseFloat(amount) > fromAsset.balance || isExchanging}
                className="w-full py-4 bg-gradient-to-r from-cyan-500 to-cyan-400 text-black font-semibold rounded-xl hover:shadow-[0_0_30px_rgba(6,182,212,0.3)] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isExchanging ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    兑换中...
                  </>
                ) : (
                  '确认兑换'
                )}
              </button>
            </div>

            {/* Exchange Records */}
            <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.02)_inset] overflow-hidden">
              <h3 className="text-lg font-semibold text-[#F8F8FC] mb-4">兑换记录</h3>
              <div className="space-y-3">
                {exchangeRecords.map(record => (
                  <div key={record.id} className="flex items-center justify-between p-4 bg-[#0A0A0F] rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center">
                        <span className="text-[#F8F8FC] font-medium">{record.fromAmount} {record.fromAsset}</span>
                        <span className="mx-2 text-[#606070]">→</span>
                        <span className="text-cyan-400 font-medium">{record.toAmount} {record.toAsset}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-xs text-[#606070]">{record.time}</span>
                      <div className="flex items-center gap-1">
                        {record.status === 'completed' && (
                          <>
                            <CheckCircle className="w-4 h-4 text-green-400" />
                            <span className="text-xs text-green-400">已完成</span>
                          </>
                        )}
                        {record.status === 'pending' && (
                          <>
                            <Clock className="w-4 h-4 text-yellow-400" />
                            <span className="text-xs text-yellow-400">处理中</span>
                          </>
                        )}
                        {record.status === 'failed' && (
                          <>
                            <AlertCircle className="w-4 h-4 text-red-400" />
                            <span className="text-xs text-red-400">失败</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
    </div>
  )
}
