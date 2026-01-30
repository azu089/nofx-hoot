'use client'

import { useState } from 'react'
import Image from 'next/image'
import {
  ArrowDownUp,
  ChevronDown,
  Info,
  Loader2
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

  const getIcon = (symbol: string) =>
    symbol === 'USDT' ? '/icons/usdt.svg' :
    symbol === 'HOOT' ? '/icons/hoot/token.png' : '/icons/gas-card.svg'

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white p-6">
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Header */}
        <h1 className="text-xl font-bold">资产兑换</h1>

        {/* 兑换卡片 */}
        <div className="bg-[#12121A] rounded-xl p-5 space-y-4">
          {/* 支付 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-[#94A3B8]">支付</span>
              <span className="text-xs text-[#94A3B8]">可用 <span className="text-white">{fromAsset.balance.toLocaleString()}</span></span>
            </div>
            <div className="flex items-center gap-3 bg-[#0A0A0F] border border-[#1E1E2E] rounded-lg p-3">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowFromDropdown(!showFromDropdown)}
                  className="flex items-center gap-2 bg-[#1A1A24] rounded-lg px-3 py-2"
                >
                  <div className="w-6 h-6 rounded-full overflow-hidden">
                    <Image src={fromAsset.icon} alt={fromAsset.symbol} width={24} height={24} />
                  </div>
                  <span className="font-medium">{fromAsset.symbol}</span>
                  <ChevronDown className="w-4 h-4 text-[#94A3B8]" />
                </button>
                {showFromDropdown && (
                  <div className="absolute top-full left-0 mt-1 bg-[#1A1A24] border border-[#1E1E2E] rounded-xl overflow-hidden shadow-xl z-20 min-w-[160px]">
                    {getPayableAssets().map(asset => (
                      <button
                        key={asset.id}
                        type="button"
                        onClick={() => handleFromAssetSelect(asset)}
                        className={`flex items-center gap-3 w-full px-4 py-3 hover:bg-[#12121A] ${fromAsset.id === asset.id ? 'bg-[#12121A]' : ''}`}
                      >
                        <div className="w-6 h-6 rounded-full overflow-hidden">
                          <Image src={asset.icon} alt={asset.symbol} width={24} height={24} />
                        </div>
                        <span className="text-sm">{asset.symbol}</span>
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
                className="flex-1 bg-transparent text-xl font-semibold outline-none text-right placeholder:text-[#64748B]"
              />
            </div>
            <div className="flex gap-2">
              {[25, 50, 75, 100].map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setAmount((fromAsset.balance * p / 100).toFixed(2))}
                  className="flex-1 py-2 text-xs bg-[#1A1A24] rounded-lg text-[#94A3B8] hover:text-white hover:bg-[#2A2A3A]"
                >
                  {p}%
                </button>
              ))}
            </div>
          </div>

          {/* 交换按钮 */}
          <div className="flex justify-center">
            <button
              type="button"
              onClick={handleSwap}
              disabled={!canSwap}
              className={`w-10 h-10 rounded-full bg-[#1A1A24] border border-[#1E1E2E] flex items-center justify-center ${canSwap ? 'hover:border-[#06B6D4]' : 'opacity-50'}`}
              aria-label="交换"
            >
              <ArrowDownUp className={`w-5 h-5 ${canSwap ? 'text-[#06B6D4]' : 'text-[#64748B]'}`} />
            </button>
          </div>

          {/* 获得 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-[#94A3B8]">获得</span>
              <span className="text-xs text-[#94A3B8]">余额 <span className="text-white">{toAsset.balance.toLocaleString()}</span></span>
            </div>
            <div className="flex items-center gap-3 bg-[#0A0A0F] border border-[#1E1E2E] rounded-lg p-3">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowToDropdown(!showToDropdown)}
                  className="flex items-center gap-2 bg-[#1A1A24] rounded-lg px-3 py-2"
                >
                  <div className="w-6 h-6 rounded-full overflow-hidden">
                    <Image src={toAsset.icon} alt={toAsset.symbol} width={24} height={24} />
                  </div>
                  <span className="font-medium">{toAsset.symbol}</span>
                  <ChevronDown className="w-4 h-4 text-[#94A3B8]" />
                </button>
                {showToDropdown && (
                  <div className="absolute top-full left-0 mt-1 bg-[#1A1A24] border border-[#1E1E2E] rounded-xl overflow-hidden shadow-xl z-20 min-w-[160px]">
                    {getReceivableAssets(fromAsset.id).map(asset => (
                      <button
                        key={asset.id}
                        type="button"
                        onClick={() => handleToAssetSelect(asset)}
                        className={`flex items-center gap-3 w-full px-4 py-3 hover:bg-[#12121A] ${toAsset.id === asset.id ? 'bg-[#12121A]' : ''}`}
                      >
                        <div className="w-6 h-6 rounded-full overflow-hidden">
                          <Image src={asset.icon} alt={asset.symbol} width={24} height={24} />
                        </div>
                        <span className="text-sm">{asset.symbol}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex-1 text-xl font-semibold text-right text-[#06B6D4]">
                {calculateReceive()}
              </div>
            </div>
          </div>

          {/* 汇率 */}
          <div className="flex items-center justify-center text-sm text-[#94A3B8] gap-1 pt-2">
            <Info className="w-4 h-4" />
            <span>1 {fromAsset.symbol} = {((fromAsset.rate || 1) / (toAsset.rate || 1)).toFixed(4)} {toAsset.symbol}</span>
          </div>
        </div>

        {/* 确认按钮 */}
        <button
          type="button"
          onClick={handleExchange}
          disabled={!amount || parseFloat(amount) <= 0 || parseFloat(amount) > fromAsset.balance || isExchanging}
          className={`w-full py-4 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${
            amount && parseFloat(amount) > 0 && parseFloat(amount) <= fromAsset.balance && !isExchanging
              ? 'bg-[#06B6D4] hover:bg-[#0891B2] text-white'
              : 'bg-[#1A1A24] text-[#64748B] cursor-not-allowed'
          }`}
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

        {/* 兑换记录 */}
        {exchangeRecords.length > 0 && (
          <div className="bg-[#12121A] rounded-xl p-5 space-y-3">
            <span className="text-sm text-[#94A3B8]">最近记录</span>
            <div className="space-y-2">
              {exchangeRecords.map(record => (
                <div key={record.id} className="flex items-center justify-between py-3 border-b border-[#1E1E2E] last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center">
                      <div className="w-6 h-6 rounded-full bg-[#1E1E2E] flex items-center justify-center overflow-hidden relative">
                        <Image src={getIcon(record.fromAsset)} alt={record.fromAsset} fill className="object-contain p-1" />
                      </div>
                      <span className="text-xs text-[#64748B] mx-1">→</span>
                      <div className="w-6 h-6 rounded-full bg-[#1E1E2E] flex items-center justify-center overflow-hidden relative">
                        <Image src={getIcon(record.toAsset)} alt={record.toAsset} fill className="object-contain p-1" />
                      </div>
                    </div>
                    <div>
                      <span className="text-sm font-medium">{record.fromAmount} → {record.toAmount}</span>
                      <p className="text-xs text-[#94A3B8]">{record.fromAsset} → {record.toAsset}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      record.status === 'completed' ? 'bg-[#22C55E]/10 text-[#22C55E]' :
                      record.status === 'pending' ? 'bg-[#F59E0B]/10 text-[#F59E0B]' :
                      'bg-[#EF4444]/10 text-[#EF4444]'
                    }`}>
                      {record.status === 'completed' ? '完成' : record.status === 'pending' ? '处理中' : '失败'}
                    </span>
                    <p className="text-xs text-[#94A3B8] mt-1">{record.time.split(' ')[0]}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
