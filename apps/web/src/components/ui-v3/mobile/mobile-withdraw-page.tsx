'use client'

import { useState } from 'react'
import Image from 'next/image'
import { ArrowLeft, ChevronDown, AlertCircle, CheckCircle2 } from 'lucide-react'

interface NetworkInfo {
  name: string
  icon: string
  fee: string
  time: string
}

const networks: NetworkInfo[] = [
  { name: 'TRC20', icon: '/icons/networks/tron.svg', fee: '1', time: '~2分钟' },
  { name: 'ERC20', icon: '/icons/networks/ethereum.svg', fee: '5', time: '~5分钟' },
  { name: 'BEP20', icon: '/icons/networks/bsc.svg', fee: '0.8', time: '~3分钟' },
  { name: 'Polygon', icon: '/icons/networks/polygon.svg', fee: '0.5', time: '~2分钟' },
]

interface WithdrawRecord {
  id: string
  network: string
  address: string
  amount: number
  fee?: number
  status: 'completed' | 'pending' | 'processing' | 'failed'
  time: string
  txHash?: string
}

interface MobileWithdrawPageProps {
  balance?: number
  recentWithdrawals?: WithdrawRecord[]
  onBack?: () => void
  onWithdraw?: (data: { amount: number; network: string; address: string }) => void
}

export function MobileWithdrawPage({
  balance = 0,
  recentWithdrawals = [],
  onBack,
  onWithdraw
}: MobileWithdrawPageProps) {
  const [selectedNetwork, setSelectedNetwork] = useState(networks[0])
  const [showDropdown, setShowDropdown] = useState(false)
  const [address, setAddress] = useState('')
  const [amount, setAmount] = useState('')
  const [isAddressValid, setIsAddressValid] = useState<boolean | null>(null)

  const availableBalance = balance

  const handleAddressChange = (value: string) => {
    setAddress(value)
    if (value.length === 0) {
      setIsAddressValid(null)
      return
    }
    if (selectedNetwork.name === 'TRC20') {
      setIsAddressValid(value.startsWith('T') && value.length === 34)
    } else {
      setIsAddressValid(value.startsWith('0x') && value.length === 42)
    }
  }

  const handleAmountChange = (value: string) => {
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setAmount(value)
    }
  }

  const withdrawAmount = parseFloat(amount) || 0
  const feeAmount = parseFloat(selectedNetwork.fee)
  const actualAmount = withdrawAmount - feeAmount

  const canSubmit = address.length > 0 && isAddressValid && withdrawAmount > 0 && withdrawAmount <= availableBalance

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white pb-20">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-[#0A0A0F]/95 backdrop-blur-lg border-b border-[#1E1E2E]">
        <div className="flex items-center justify-between px-4 h-14">
          <button type="button" onClick={onBack} aria-label="返回" className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-[#12121A] transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-base font-semibold text-white">提现 USDT</h1>
          <div className="w-10" />
        </div>
      </div>

      <div className="p-4 space-y-3">
        {/* 网络选择 - 独立层级避免裁剪 */}
        <div className="relative z-30">
          <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
            <button
              type="button"
              onClick={() => setShowDropdown(!showDropdown)}
              className="w-full px-4 py-3 flex items-center justify-between"
            >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center">
                <Image src={selectedNetwork.icon} alt={selectedNetwork.name} width={32} height={32} className="object-contain" />
              </div>
              <span className="font-medium">{selectedNetwork.name}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-[#94A3B8]">
              <span>手续费 {selectedNetwork.fee} USDT</span>
              <ChevronDown className={`w-4 h-4 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
            </div>
            </button>
          </div>

          {showDropdown && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-[#0F0F14] border border-[#2A2A3A] rounded-xl overflow-hidden z-[100] shadow-[0_12px_48px_rgba(0,0,0,1)]">
              {networks.map((network) => (
                <button
                  key={network.name}
                  type="button"
                  onClick={() => {
                    setSelectedNetwork(network)
                    setShowDropdown(false)
                    setIsAddressValid(null)
                    setAddress('')
                  }}
                  className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-[#252530] transition-colors border-b border-[#2A2A3A] last:border-b-0"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center">
                      <Image src={network.icon} alt={network.name} width={32} height={32} className="object-contain" />
                    </div>
                    <span className={`font-medium ${network.name === selectedNetwork.name ? 'text-[#06B6D4]' : 'text-white'}`}>{network.name}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-[#94A3B8]">
                    <span>{network.fee} USDT · {network.time}</span>
                    {network.name === selectedNetwork.name && <CheckCircle2 className="w-4 h-4 text-[#06B6D4]" />}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 提现表单卡片 */}
        <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden p-4 space-y-3">
          {/* 提现地址 */}
          <div className="space-y-2">
            <span className="text-sm text-[#94A3B8]">提现地址</span>
            <input
              type="text"
              value={address}
              onChange={(e) => handleAddressChange(e.target.value)}
              placeholder={selectedNetwork.name === 'TRC20' ? '输入 T 开头地址' : '输入 0x 地址'}
              className="w-full bg-[#0A0A0F] border border-[#1E1E2E] rounded-lg px-3 py-2.5 text-sm font-mono placeholder:text-[#94A3B8] focus:outline-none focus:border-[#06B6D4]"
            />
            {isAddressValid === false && (
              <p className="text-xs text-[#EF4444] flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                地址格式错误
              </p>
            )}
          </div>

          {/* 提现金额 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-[#94A3B8]">金额</span>
              <span className="text-xs text-[#94A3B8]">可用 <span className="text-white">{availableBalance.toLocaleString()}</span></span>
            </div>
            <div className="relative">
              <input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => handleAmountChange(e.target.value)}
                placeholder="0.00"
                className="w-full bg-[#0A0A0F] border border-[#1E1E2E] rounded-lg px-3 py-2.5 pr-14 text-lg font-semibold placeholder:text-[#94A3B8] focus:outline-none focus:border-[#06B6D4]"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[#94A3B8]">USDT</span>
            </div>

            {/* 快捷金额 */}
            <div className="flex gap-2">
              {[100, 500, 1000].map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setAmount(q.toString())}
                  className="flex-1 py-2 text-xs bg-[#1A1A24] rounded-lg text-[#94A3B8] hover:text-white hover:bg-[#2A2A3A] transition-colors"
                >
                  {q}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setAmount(availableBalance.toString())}
                className="flex-1 py-2 text-xs bg-[#1A1A24] rounded-lg text-[#94A3B8] hover:text-white hover:bg-[#2A2A3A] transition-colors"
              >
                全部
              </button>
            </div>
          </div>

          {/* 到账金额 */}
          {withdrawAmount > 0 && (
            <div className="flex items-center justify-between pt-2 border-t border-[#1E1E2E]">
              <span className="text-xs text-[#94A3B8]">到账金额</span>
              <span className="text-[#06B6D4] font-semibold">
                {actualAmount > 0 ? actualAmount.toLocaleString() : '0'} USDT
              </span>
            </div>
          )}
        </div>

        {/* 提交按钮 */}
        <button
          type="button"
          disabled={!canSubmit}
          className={`w-full py-3.5 rounded-xl font-medium transition-all ${
            canSubmit
              ? 'bg-[#06B6D4] hover:bg-[#0891B2] text-white'
              : 'bg-[#1A1A24] text-[#94A3B8] cursor-not-allowed'
          }`}
        >
          确认提现
        </button>

        {/* 提现记录 */}
        {recentWithdrawals.length > 0 && (
          <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden p-4 space-y-3">
            <span className="text-sm text-[#94A3B8]">最近记录</span>
            <div className="space-y-2">
              {recentWithdrawals.map((record) => (
                <div key={record.id} className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#1E1E2E] flex items-center justify-center overflow-hidden relative">
                      <Image src="/icons/usdt.svg" alt="USDT" fill className="object-contain p-1.5" />
                    </div>
                    <div>
                      <span className="text-sm font-medium text-[#EF4444]">-{record.amount}</span>
                      <p className="text-xs text-[#94A3B8]">{record.network} · {record.address}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      record.status === 'completed' ? 'bg-[#22C55E]/10 text-[#22C55E]' :
                      record.status === 'pending' || record.status === 'processing' ? 'bg-[#F59E0B]/10 text-[#F59E0B]' :
                      'bg-[#EF4444]/10 text-[#EF4444]'
                    }`}>
                      {record.status === 'completed' ? '完成' : (record.status === 'pending' || record.status === 'processing') ? '处理中' : '失败'}
                    </span>
                    <p className="text-xs text-[#94A3B8] mt-1">{record.time}</p>
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
