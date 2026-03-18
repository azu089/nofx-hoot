'use client'

import { useState, useMemo, useEffect } from 'react'
import Image from 'next/image'
import {
  ArrowDownUp,
  ChevronDown,
  Info,
  Loader2
} from 'lucide-react'

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
  balance?: {
    usdt: number
    hoot: number
    point: number
  }
  exchangeRecords?: ExchangeRecord[]
  onExchange?: (from: string, to: string, amount: number) => void
  isLoading?: boolean
}

export function ExchangePage({ balance, exchangeRecords = [], onExchange, isLoading: externalLoading }: ExchangePageProps) {
  // 根据真实余额构建资产列表
  const assets: Asset[] = useMemo(() => [
    { id: 'usdt', name: 'USDT', symbol: 'USDT', balance: balance?.usdt ?? 0, icon: '/icons/usdt.svg', rate: 1 },
    { id: 'gas', name: 'GAS', symbol: 'GAS', balance: balance?.point ?? 0, icon: '/icons/gas-card.svg', rate: 1 },
    { id: 'hoot', name: 'HOOT', symbol: 'HOOT', balance: balance?.hoot ?? 0, icon: '/icons/hoot/token.png', rate: 0.85 },
  ], [balance])

  // 可作为支付的资产（GAS 不可作为支付）
  const payableAssets = useMemo(() => assets.filter(a => a.id !== 'gas'), [assets])

  const [fromAssetId, setFromAssetId] = useState('usdt')
  const [toAssetId, setToAssetId] = useState('gas')
  const [amount, setAmount] = useState('')
  const [showFromDropdown, setShowFromDropdown] = useState(false)
  const [showToDropdown, setShowToDropdown] = useState(false)
  const [isExchanging, setIsExchanging] = useState(false)

  // 从 assets 中查找当前选中的资产（余额会随 balance prop 实时更新）
  const fromAsset = useMemo(() => assets.find(a => a.id === fromAssetId) || assets[0], [assets, fromAssetId])
  const toAsset = useMemo(() => assets.find(a => a.id === toAssetId) || assets[1], [assets, toAssetId])

  // 外部 loading 同步
  useEffect(() => {
    if (!externalLoading && isExchanging) {
      queueMicrotask(() => {
        setIsExchanging(false)
        setAmount('')
      })
    }
  }, [externalLoading, isExchanging])

  const calculateReceive = () => {
    if (!amount || isNaN(parseFloat(amount))) return '0.00'
    const fromRate = fromAsset.rate || 1
    const toRate = toAsset.rate || 1
    return ((parseFloat(amount) * fromRate) / toRate).toFixed(2)
  }

  const handleSwap = () => {
    if (toAsset.id === 'gas') return
    setFromAssetId(toAssetId)
    setToAssetId(fromAssetId)
    setAmount('')
  }

  const canSwap = toAsset.id !== 'gas'

  const handleExchange = async () => {
    if (!amount || parseFloat(amount) <= 0) return
    setIsExchanging(true)
    onExchange?.(fromAsset.symbol, toAsset.symbol, parseFloat(amount))
  }

  const getReceivableAssets = (excludeId: string) => assets.filter(a => a.id !== excludeId)

  const handleFromAssetSelect = (asset: Asset) => {
    if (asset.id === toAssetId) {
      const newToAsset = assets.find(a => a.id === 'gas') || assets.find(a => a.id !== asset.id)
      if (newToAsset) setToAssetId(newToAsset.id)
    }
    setFromAssetId(asset.id)
    setShowFromDropdown(false)
  }

  const handleToAssetSelect = (asset: Asset) => {
    if (asset.id === fromAssetId) {
      const newFromAsset = payableAssets.find(a => a.id !== asset.id)
      if (newFromAsset) setFromAssetId(newFromAsset.id)
    }
    setToAssetId(asset.id)
    setShowToDropdown(false)
  }

  const getIcon = (symbol: string) =>
    symbol === 'USDT' ? '/icons/usdt.svg' :
    symbol === 'HOOT' ? '/icons/hoot/token.png' : '/icons/gas-card.svg'

  const isProcessing = isExchanging || externalLoading

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
                  onClick={() => { setShowFromDropdown(!showFromDropdown); setShowToDropdown(false) }}
                  className="flex items-center gap-2 bg-[#1A1A24] rounded-lg px-3 py-2"
                >
                  <div className="w-6 h-6 rounded-full overflow-hidden">
                    <Image src={fromAsset.icon} alt={fromAsset.symbol} width={24} height={24} className="object-contain" />
                  </div>
                  <span className="font-medium">{fromAsset.symbol}</span>
                  <ChevronDown className="w-4 h-4 text-[#94A3B8]" />
                </button>
                {showFromDropdown && (
                  <div className="absolute top-full left-0 mt-1 bg-[#1A1A24] border border-[#1E1E2E] rounded-xl overflow-hidden shadow-xl z-[100] min-w-[160px]">
                    {payableAssets.map(asset => (
                      <button
                        key={asset.id}
                        type="button"
                        onClick={() => handleFromAssetSelect(asset)}
                        className={`flex items-center gap-3 w-full px-4 py-3 hover:bg-[#12121A] ${fromAsset.id === asset.id ? 'bg-[#12121A]' : ''}`}
                      >
                        <div className="w-6 h-6 rounded-full overflow-hidden">
                          <Image src={asset.icon} alt={asset.symbol} width={24} height={24} className="object-contain" />
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
                  onClick={() => { setShowToDropdown(!showToDropdown); setShowFromDropdown(false) }}
                  className="flex items-center gap-2 bg-[#1A1A24] rounded-lg px-3 py-2"
                >
                  <div className="w-6 h-6 rounded-full overflow-hidden">
                    <Image src={toAsset.icon} alt={toAsset.symbol} width={24} height={24} className="object-contain" />
                  </div>
                  <span className="font-medium">{toAsset.symbol}</span>
                  <ChevronDown className="w-4 h-4 text-[#94A3B8]" />
                </button>
                {showToDropdown && (
                  <div className="absolute top-full left-0 mt-1 bg-[#1A1A24] border border-[#1E1E2E] rounded-xl overflow-hidden shadow-xl z-[100] min-w-[160px]">
                    {getReceivableAssets(fromAsset.id).map(asset => (
                      <button
                        key={asset.id}
                        type="button"
                        onClick={() => handleToAssetSelect(asset)}
                        className={`flex items-center gap-3 w-full px-4 py-3 hover:bg-[#12121A] ${toAsset.id === asset.id ? 'bg-[#12121A]' : ''}`}
                      >
                        <div className="w-6 h-6 rounded-full overflow-hidden">
                          <Image src={asset.icon} alt={asset.symbol} width={24} height={24} className="object-contain" />
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
          disabled={!amount || parseFloat(amount) <= 0 || parseFloat(amount) > fromAsset.balance || isProcessing}
          className={`w-full py-4 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${
            amount && parseFloat(amount) > 0 && parseFloat(amount) <= fromAsset.balance && !isProcessing
              ? 'bg-[#06B6D4] hover:bg-[#0891B2] text-white'
              : 'bg-[#1A1A24] text-[#64748B] cursor-not-allowed'
          }`}
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              兑换中...
            </>
          ) : (
            '确认兑换'
          )}
        </button>

        {/* 兑换记录 */}
        <div className="bg-[#12121A] rounded-xl p-5 space-y-3">
          <span className="text-sm text-[#94A3B8]">最近记录</span>
          {exchangeRecords.length > 0 ? (
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
          ) : (
            <div className="text-center py-6 text-[#64748B] text-sm">
              暂无兑换记录
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
