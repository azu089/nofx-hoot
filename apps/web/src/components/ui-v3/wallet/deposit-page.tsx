'use client'

import { useState } from 'react'
import Image from 'next/image'
import {
  ArrowDownToLine,
  Copy,
  Check,
  AlertCircle,
  QrCode,
  ChevronDown,
  ExternalLink,
  Shield,
  Wallet
} from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
// Sidebar is handled by parent layout

interface Network {
  id: string
  name: string
  symbol: string
  icon: string
  confirmations: number
  estimatedTime: string
  minDeposit: number
  fee: number
}

interface DepositPageProps {
  walletAddress?: string
  networks?: Network[]
  selectedNetworkName?: string  // 外部控制当前选中网络（如 'BEP20'）
  recentDeposits?: {
    id: string
    amount: number
    network: string
    status: 'pending' | 'confirmed' | 'completed'
    txHash: string
    time: string
  }[]
  balance?: number  // 账户余额
  onCopyAddress?: () => void
  onNetworkChange?: (networkName: string) => void
}

const defaultNetworks: Network[] = [
  { id: 'trc20', name: 'TRC20', symbol: 'TRON', icon: '/icons/networks/tron.png', confirmations: 20, estimatedTime: '约 1 分钟', minDeposit: 1, fee: 0 },
  { id: 'erc20', name: 'ERC20', symbol: 'Ethereum', icon: '/icons/networks/ethereum.png', confirmations: 12, estimatedTime: '约 5 分钟', minDeposit: 10, fee: 0 },
  { id: 'bep20', name: 'BEP20', symbol: 'BSC', icon: '/icons/networks/bsc.png', confirmations: 15, estimatedTime: '约 1 分钟', minDeposit: 1, fee: 0 },
  { id: 'polygon', name: 'Polygon', symbol: 'MATIC', icon: '/icons/networks/polygon.png', confirmations: 128, estimatedTime: '约 3 分钟', minDeposit: 1, fee: 0 },
]

const defaultRecentDeposits: NonNullable<DepositPageProps['recentDeposits']> = []

const EXPLORER_MAP: Record<string, string> = {
  TRC20: 'https://tronscan.org/#/transaction/',
  ERC20: 'https://etherscan.io/tx/',
  BEP20: 'https://bscscan.com/tx/',
  Polygon: 'https://polygonscan.com/tx/',
}

export function DepositPage({
  walletAddress = '',
  networks = defaultNetworks,
  selectedNetworkName,
  recentDeposits = defaultRecentDeposits,
  balance = 0,
  onCopyAddress,
  onNetworkChange
}: DepositPageProps) {
  // 如果外部传入 selectedNetworkName，同步内部状态
  const initialNetwork = selectedNetworkName
    ? networks.find(n => n.name === selectedNetworkName) || networks[0]
    : networks[0]
  const [selectedNetwork, setSelectedNetwork] = useState(initialNetwork)
  const [showNetworkDropdown, setShowNetworkDropdown] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showQR, setShowQR] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(walletAddress)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      onCopyAddress?.()
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Failed to copy:', err)
      }
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-400 bg-green-500/10'
      case 'pending':
        return 'text-yellow-400 bg-yellow-500/10'
      default:
        return 'text-[#9090A0] bg-[#1E1E2E]'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return '已完成'
      case 'pending':
        return '确认中'
      case 'confirmed':
        return '已确认'
      default:
        return status
    }
  }

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-[#F8F8FC] font-sans p-6">
          {/* Page Header */}
          <div className="mb-4">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ArrowDownToLine className="w-6 h-6 text-[#06B6D4]" />
              充值 USDT
            </h1>
          </div>

          <div className="grid grid-cols-3 gap-6">
            {/* Left: Deposit Form */}
            <div className="col-span-2 space-y-6">
              {/* Network Selector */}
              <div className="glass-border-glow relative bg-[#12121A] border border-cyan-500/[0.08] rounded-2xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.02)_inset] z-30">
                <h2 className="text-lg font-semibold mb-4">选择网络</h2>

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowNetworkDropdown(!showNetworkDropdown)}
                    className="w-full px-4 py-4 bg-[#0A0A0F] border border-[#2A2A3A] rounded-xl text-left flex items-center justify-between hover:border-[#06B6D4]/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center overflow-hidden">
                        <Image src={selectedNetwork.icon} alt={selectedNetwork.name} width={40} height={40} className="object-contain" />
                      </div>
                      <div>
                        <div className="font-medium">{selectedNetwork.name}</div>
                        <div className="text-sm text-[#606070]">手续费: {selectedNetwork.fee} USDT</div>
                      </div>
                    </div>
                    <ChevronDown className={`w-5 h-5 text-[#606070] transition-transform ${showNetworkDropdown ? 'rotate-180' : ''}`} />
                  </button>

                  {showNetworkDropdown && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-[#0F0F14] border border-[#2A2A3A] rounded-xl overflow-hidden z-[100] shadow-[0_12px_48px_rgba(0,0,0,1)]">
                      {networks.map((network) => (
                        <button
                          key={network.id}
                          type="button"
                          onClick={() => {
                            setSelectedNetwork(network)
                            setShowNetworkDropdown(false)
                            onNetworkChange?.(network.name)
                          }}
                          className={`w-full px-4 py-3.5 text-left flex items-center gap-3 hover:bg-[#252530] transition-colors ${
                            selectedNetwork.id === network.id ? 'bg-[#252530]' : ''
                          }`}
                        >
                          <div className="w-10 h-10 rounded-full flex items-center justify-center overflow-hidden">
                            <Image src={network.icon} alt={network.name} width={40} height={40} className="object-contain" />
                          </div>
                          <div className="flex-1">
                            <div className="font-medium">{network.name}</div>
                            <div className="text-xs text-[#606070]">手续费: {network.fee} USDT · {network.estimatedTime}</div>
                          </div>
                          {selectedNetwork.id === network.id && (
                            <Check className="w-4 h-4 text-[#06B6D4]" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Deposit Address */}
              <div className="glass-border-glow relative z-10 bg-[#12121A]/80 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.02)_inset] overflow-hidden">
                <h2 className="text-lg font-semibold mb-4">充值地址</h2>

                <div className="flex items-center gap-3 p-4 bg-[#0A0A0F] border border-[#2A2A3A] rounded-xl">
                  <div className="flex-1">
                    <div className="font-mono text-sm break-all">{walletAddress}</div>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="flex items-center gap-2 px-4 py-2 bg-[#06B6D4] text-black rounded-lg font-medium hover:bg-[#0891B2] transition-colors"
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copied ? '已复制' : '复制'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowQR(!showQR)}
                    className="p-2 bg-[#1E1E2E] rounded-lg hover:bg-[#2A2A3A] transition-colors"
                    aria-label="显示二维码"
                  >
                    <QrCode className="w-5 h-5 text-[#9090A0]" />
                  </button>
                </div>

                {showQR && walletAddress && (
                  <div className="mt-4 flex justify-center p-6 bg-white rounded-xl">
                    <QRCodeSVG
                      value={walletAddress}
                      size={192}
                      bgColor="#ffffff"
                      fgColor="#000000"
                      level="M"
                    />
                  </div>
                )}

                {/* Warning */}
                <div className="mt-4 flex items-start gap-3 p-4 bg-yellow-500/5 border border-yellow-500/20 rounded-xl">
                  <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="text-yellow-400 font-medium">请注意</p>
                    <ul className="mt-1 text-[#9090A0] space-y-1">
                      <li>• 请确保选择的网络与您发送 USDT 的网络一致</li>
                      <li>• 最小充值金额为 {selectedNetwork.minDeposit} USDT，低于此金额将无法到账</li>
                      <li>• 充值完成后，资金将在 {selectedNetwork.confirmations} 个区块确认后到账</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Recent Deposits */}
              <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.02)_inset] overflow-hidden">
                <h2 className="text-lg font-semibold mb-4">最近充值</h2>

                {recentDeposits.length > 0 ? (
                  <div className="space-y-3">
                    {recentDeposits.map((deposit) => (
                      <div
                        key={deposit.id}
                        className="flex items-center justify-between p-4 bg-[#0A0A0F]/50 rounded-xl"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-green-500/10 rounded-full flex items-center justify-center">
                            <ArrowDownToLine className="w-5 h-5 text-green-400" />
                          </div>
                          <div>
                            <div className="font-medium">+{deposit.amount} USDT</div>
                            <div className="text-sm text-[#606070]">{deposit.network} · {deposit.time}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`px-2 py-1 rounded-lg text-xs font-medium ${getStatusColor(deposit.status)}`}>
                            {getStatusText(deposit.status)}
                          </span>
                          <a
                            href={`${EXPLORER_MAP[deposit.network] || 'https://tronscan.org/#/transaction/'}${deposit.txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="查看交易详情"
                            className="p-2 hover:bg-[#1E1E2E] rounded-lg transition-colors"
                          >
                            <ExternalLink className="w-4 h-4 text-[#606070]" />
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-[#606070]">
                    暂无充值记录
                  </div>
                )}
              </div>
            </div>

            {/* Right: Info Panel */}
            <div className="space-y-6">
              {/* Security Tips */}
              <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.02)_inset] overflow-hidden">
                <div className="flex items-center gap-2 mb-4">
                  <Shield className="w-5 h-5 text-[#06B6D4]" />
                  <h3 className="font-semibold">安全提示</h3>
                </div>
                <ul className="space-y-3 text-sm text-[#9090A0]">
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                    <span>仅支持 USDT 充值，请勿充值其他代币</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                    <span>请仔细核对网络类型，充错网络可能导致资产丢失</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                    <span>充值地址由智能合约生成，安全可靠</span>
                  </li>
                </ul>
              </div>

              {/* Quick Stats */}
              <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.02)_inset] overflow-hidden">
                <div className="flex items-center gap-2 mb-4">
                  <Wallet className="w-5 h-5 text-[#06B6D4]" />
                  <h3 className="font-semibold">账户余额</h3>
                </div>
                <div className="text-3xl font-bold">${balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                <div className="text-sm text-[#606070] mt-1">USDT 余额</div>
              </div>

              {/* Help */}
              <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.02)_inset] overflow-hidden">
                <h3 className="font-semibold mb-3">需要帮助？</h3>
                <p className="text-sm text-[#9090A0] mb-4">
                  如果您在充值过程中遇到问题，请联系客服。
                </p>
                <button
                  type="button"
                  className="w-full py-2 border border-[#2A2A3A] rounded-xl text-sm text-[#9090A0] hover:text-[#F8F8FC] hover:border-[#06B6D4]/50 transition-colors"
                >
                  联系客服
                </button>
              </div>
            </div>
          </div>
    </div>
  )
}
