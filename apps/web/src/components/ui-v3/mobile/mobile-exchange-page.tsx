'use client'

import { useState, useMemo, useEffect } from 'react'
import { ArrowDownUp, ChevronDown, ArrowLeft, Info, Loader2 } from 'lucide-react'
import Image from 'next/image'

interface Asset {
  id: string
  name: string
  symbol: string
  balance: number
  icon: string
  rate: number
  canBePay: boolean
}

interface ExchangeRecord {
  id: string
  fromAsset: string
  fromAmount: number
  toAsset: string
  toAmount: number
  status: 'completed' | 'processing' | 'failed'
  time: string
}

interface MobileExchangePageProps {
  balance?: {
    usdt: number
    hoot: number
    point: number
  }
  exchangeRecords?: ExchangeRecord[]
  onBack?: () => void
  onExchange?: (from: string, to: string, amount: number) => void
  isLoading?: boolean
}

export function MobileExchangePage({ balance, exchangeRecords = [], onBack, onExchange, isLoading: externalLoading }: MobileExchangePageProps) {
  // 根据真实余额构建资产列表
  const assets: Asset[] = useMemo(() => [
    { id: 'usdt', name: 'USDT', symbol: 'USDT', balance: balance?.usdt ?? 0, icon: '/icons/usdt.svg', rate: 1, canBePay: true },
    { id: 'gas', name: 'GAS', symbol: 'GAS', balance: balance?.point ?? 0, icon: '/icons/gas-card.svg', rate: 1, canBePay: false },
    { id: 'hoot', name: 'HOOT', symbol: 'HOOT', balance: balance?.hoot ?? 0, icon: '/icons/hoot/token.png', rate: 0.85, canBePay: true },
  ], [balance])

  const payableAssets = useMemo(() => assets.filter(a => a.canBePay), [assets])

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
    return ((parseFloat(amount) * fromAsset.rate) / toAsset.rate).toFixed(2)
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
    <div className="min-h-screen bg-[#0A0A0F] text-white pb-20">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-[#0A0A0F] [transform:translateZ(0)] border-b border-[#1E1E2E]">
        <div className="flex items-center justify-between px-4 h-14">
          <button type="button" onClick={onBack} aria-label="返回" className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-[#12121A] transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-base font-semibold text-white">资产兑换</h1>
          <div className="w-10" />
        </div>
      </div>

      <div className="p-4 space-y-3">
        {/* 兑换卡片 - 移除 overflow-hidden 以允许下拉菜单溢出 */}
        <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] p-4 space-y-3">
          {/* 支付 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-[#94A3B8]">支付</span>
              <span className="text-xs text-[#94A3B8]">可用 <span className="text-white">{fromAsset.balance.toLocaleString()}</span></span>
            </div>
            <div className="flex items-center gap-3 bg-[#0A0A0F] border border-[#1E1E2E] rounded-lg p-3">
              <div className="relative flex-shrink-0">
                <button
                  type="button"
                  onClick={() => { setShowFromDropdown(!showFromDropdown); setShowToDropdown(false) }}
                  className="flex items-center gap-2 bg-[#1A1A24] rounded-lg px-2.5 py-1.5"
                >
                  <div className="w-5 h-5 rounded-full overflow-hidden">
                    <Image src={fromAsset.icon} alt={fromAsset.symbol} width={20} height={20} className="object-contain" />
                  </div>
                  <span className="text-sm font-medium">{fromAsset.symbol}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-[#94A3B8]" />
                </button>
                {showFromDropdown && (
                  <div className="absolute top-full left-0 mt-1 bg-[#1A1A24] border border-[#1E1E2E] rounded-xl shadow-xl z-[100] min-w-[140px]">
                    {payableAssets.map((asset) => (
                      <button
                        key={asset.id}
                        type="button"
                        onClick={() => handleFromAssetSelect(asset)}
                        className={`flex items-center gap-2 w-full px-3 py-2.5 hover:bg-[#12121A] ${fromAsset.id === asset.id ? 'bg-[#12121A]' : ''}`}
                      >
                        <div className="w-5 h-5 rounded-full overflow-hidden">
                          <Image src={asset.icon} alt={asset.symbol} width={20} height={20} className="object-contain" />
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
                className="flex-1 min-w-0 bg-transparent text-lg font-semibold outline-none text-right placeholder:text-[#94A3B8]"
              />
            </div>
            <div className="flex gap-2">
              {[25, 50, 75, 100].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setAmount((fromAsset.balance * p / 100).toFixed(2))}
                  className="flex-1 py-1.5 text-xs bg-[#1A1A24] rounded-lg text-[#94A3B8] hover:text-white hover:bg-[#2A2A3A]"
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
              className={`w-9 h-9 rounded-full bg-[#1A1A24] border border-[#1E1E2E] flex items-center justify-center ${canSwap ? 'hover:border-[#06B6D4]' : 'opacity-50'}`}
              aria-label="交换"
            >
              <ArrowDownUp className={`w-4 h-4 ${canSwap ? 'text-[#06B6D4]' : 'text-[#94A3B8]'}`} />
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
                  className="flex items-center gap-2 bg-[#1A1A24] rounded-lg px-2.5 py-1.5"
                >
                  <div className="w-5 h-5 rounded-full overflow-hidden">
                    <Image src={toAsset.icon} alt={toAsset.symbol} width={20} height={20} className="object-contain" />
                  </div>
                  <span className="text-sm font-medium">{toAsset.symbol}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-[#94A3B8]" />
                </button>
                {showToDropdown && (
                  <div className="absolute top-full left-0 mt-1 bg-[#1A1A24] border border-[#1E1E2E] rounded-xl shadow-xl z-[100] min-w-[140px]">
                    {getReceivableAssets(fromAsset.id).map((asset) => (
                      <button
                        key={asset.id}
                        type="button"
                        onClick={() => handleToAssetSelect(asset)}
                        className={`flex items-center gap-2 w-full px-3 py-2.5 hover:bg-[#12121A] ${toAsset.id === asset.id ? 'bg-[#12121A]' : ''}`}
                      >
                        <div className="w-5 h-5 rounded-full overflow-hidden">
                          <Image src={asset.icon} alt={asset.symbol} width={20} height={20} className="object-contain" />
                        </div>
                        <span className="text-sm">{asset.symbol}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex-1 text-lg font-semibold text-right text-[#06B6D4]">
                {calculateReceive()}
              </div>
            </div>
          </div>

          {/* 汇率 */}
          <div className="flex items-center justify-center text-xs text-[#94A3B8] gap-1 pt-1">
            <Info className="w-3.5 h-3.5" />
            <span>1 {fromAsset.symbol} = {(fromAsset.rate / toAsset.rate).toFixed(4)} {toAsset.symbol}</span>
          </div>
        </div>

        {/* 确认按钮 */}
        <button
          type="button"
          onClick={handleExchange}
          disabled={!amount || parseFloat(amount) <= 0 || parseFloat(amount) > fromAsset.balance || isProcessing}
          className={`w-full py-3.5 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${
            amount && parseFloat(amount) > 0 && parseFloat(amount) <= fromAsset.balance && !isProcessing
              ? 'bg-[#06B6D4] hover:bg-[#0891B2] text-white'
              : 'bg-[#1A1A24] text-[#94A3B8] cursor-not-allowed'
          }`}
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              兑换中...
            </>
          ) : (
            '确认兑换'
          )}
        </button>

        {/* 兑换记录 */}
        <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden p-4 space-y-3">
          <span className="text-sm text-[#94A3B8]">最近记录</span>
          {exchangeRecords.length > 0 ? (
            <div className="space-y-2">
              {exchangeRecords.map((record) => (
                <div key={record.id} className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center">
                      <div className="w-6 h-6 rounded-full bg-[#1E1E2E] flex items-center justify-center overflow-hidden relative">
                        <Image src={getIcon(record.fromAsset)} alt={record.fromAsset} fill className="object-contain p-1" />
                      </div>
                      <span className="text-[10px] text-[#94A3B8] mx-0.5">→</span>
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
                      record.status === 'failed' ? 'bg-[#EF4444]/10 text-[#EF4444]' :
                      'bg-[#F59E0B]/10 text-[#F59E0B]'
                    }`}>
                      {record.status === 'completed' ? '完成' : record.status === 'failed' ? '失败' : '处理中'}
                    </span>
                    <p className="text-xs text-[#94A3B8] mt-1">{record.time}</p>
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
