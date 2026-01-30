'use client'

import { useState } from 'react'
import Image from 'next/image'
import { ChevronDown, Copy, QrCode, CheckCircle2, ArrowLeft } from 'lucide-react'

type NetworkType = 'TRC20' | 'ERC20' | 'BEP20' | 'Polygon'

interface NetworkInfo {
  name: NetworkType
  fee: string
  time: string
}

const networks: NetworkInfo[] = [
  { name: 'TRC20', fee: '1', time: '~2分钟' },
  { name: 'ERC20', fee: '5', time: '~5分钟' },
  { name: 'BEP20', fee: '0.8', time: '~3分钟' },
  { name: 'Polygon', fee: '0.5', time: '~2分钟' },
]

interface DepositRecord {
  id: string
  amount: string
  network: NetworkType
  time: string
  status: 'completed' | 'pending' | 'failed'
}

const mockRecords: DepositRecord[] = [
  { id: '1', amount: '100.00', network: 'TRC20', time: '01-20', status: 'completed' },
  { id: '2', amount: '50.00', network: 'ERC20', time: '01-19', status: 'completed' },
  { id: '3', amount: '200.00', network: 'BEP20', time: '01-18', status: 'pending' },
]

interface MobileDepositPageProps {
  onBack?: () => void
}

export function MobileDepositPage({ onBack }: MobileDepositPageProps) {
  const [selectedNetwork, setSelectedNetwork] = useState<NetworkType>('TRC20')
  const [showDropdown, setShowDropdown] = useState(false)
  const [showQR, setShowQR] = useState(false)
  const [copied, setCopied] = useState(false)

  const currentNetwork = networks.find(n => n.name === selectedNetwork)!
  const walletAddress = 'TXVzH4t5c2B3kNqZeVnWqYJfG8PmD1aKsT9W'

  const handleCopy = async () => {
    await navigator.clipboard.writeText(walletAddress)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#0A0A0F]/95 backdrop-blur-xl border-b border-[#1E1E2E]">
        <div className="flex items-center justify-between px-4 h-14">
          <button type="button" onClick={onBack} aria-label="返回" className="w-10 h-10 flex items-center justify-center">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="text-base font-medium">充值 USDT</span>
          <div className="w-10" />
        </div>
      </div>

      <div className="p-4 space-y-3">
        {/* 网络选择 - 独立层级避免裁剪 */}
        <div className="relative z-20">
          <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden">
            <button
              type="button"
              onClick={() => setShowDropdown(!showDropdown)}
              className="w-full px-4 py-3 flex items-center justify-between"
            >
            <div className="flex items-center gap-3">
              <span className="text-sm text-[#94A3B8]">网络</span>
              <span className="font-medium">{selectedNetwork}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-[#94A3B8]">
              <span>{currentNetwork.time}</span>
              <ChevronDown className={`w-4 h-4 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
            </div>
            </button>
          </div>

          {showDropdown && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-[#1A1A24] border border-[#1E1E2E] rounded-xl overflow-hidden shadow-xl">
              {networks.map((network) => (
                <button
                  key={network.name}
                  type="button"
                  onClick={() => {
                    setSelectedNetwork(network.name)
                    setShowDropdown(false)
                  }}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-[#12121A] transition-colors"
                >
                  <span className={network.name === selectedNetwork ? 'text-[#06B6D4]' : ''}>{network.name}</span>
                  <div className="flex items-center gap-3 text-xs text-[#94A3B8]">
                    <span>{network.time}</span>
                    {network.name === selectedNetwork && <CheckCircle2 className="w-4 h-4 text-[#06B6D4]" />}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 地址卡片 */}
        <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-[#94A3B8]">充值地址</span>
            <span className="text-xs text-[#06B6D4]">{selectedNetwork}</span>
          </div>

          <div className="bg-[#0A0A0F] rounded-lg p-3 font-mono text-sm text-[#94A3B8] break-all">
            {walletAddress}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="flex-1 bg-[#06B6D4] rounded-lg py-2.5 text-sm font-medium flex items-center justify-center gap-2"
            >
              <Copy className="w-4 h-4" />
              {copied ? '已复制' : '复制'}
            </button>
            <button
              type="button"
              onClick={() => setShowQR(!showQR)}
              aria-label="二维码"
              className={`px-4 rounded-lg border ${showQR ? 'bg-[#06B6D4]/10 border-[#06B6D4]' : 'bg-[#1A1A24] border-[#1E1E2E]'}`}
            >
              <QrCode className="w-5 h-5 text-[#06B6D4]" />
            </button>
          </div>

          {showQR && (
            <div className="pt-3 border-t border-[#1E1E2E]">
              <div className="bg-white rounded-lg p-3 w-40 h-40 mx-auto flex items-center justify-center">
                <QrCode className="w-28 h-28 text-[#0A0A0F]" />
              </div>
            </div>
          )}
        </div>

        {/* 充值记录 */}
        {mockRecords.length > 0 && (
          <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden p-4 space-y-3">
            <span className="text-sm text-[#94A3B8]">最近记录</span>
            <div className="space-y-2">
              {mockRecords.map((record) => (
                <div key={record.id} className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#1E1E2E] flex items-center justify-center overflow-hidden relative">
                      <Image src="/icons/usdt.svg" alt="USDT" fill className="object-contain p-1.5" />
                    </div>
                    <div>
                      <span className="text-sm font-medium text-[#22C55E]">+{record.amount}</span>
                      <p className="text-xs text-[#94A3B8]">{record.network}</p>
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
