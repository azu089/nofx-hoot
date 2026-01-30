'use client'

import { useState } from 'react'
import {
  ArrowUpFromLine,
  AlertCircle,
  ChevronDown,
  Clock,
  ExternalLink,
  Shield,
  Wallet,
  Check,
  Info
} from 'lucide-react'
// Sidebar is handled by parent layout

interface Network {
  id: string
  name: string
  symbol: string
  fee: number
  minWithdraw: number
  maxWithdraw: number
  estimatedTime: string
}

interface WithdrawPageProps {
  balance?: number
  networks?: Network[]
  recentWithdrawals?: {
    id: string
    amount: number
    fee: number
    network: string
    address: string
    status: 'pending' | 'processing' | 'completed' | 'failed'
    txHash?: string
    time: string
  }[]
  onWithdraw?: (data: { amount: number; network: string; address: string }) => void
}

const defaultNetworks: Network[] = [
  { id: 'trc20', name: 'TRC20', symbol: 'TRON', fee: 1, minWithdraw: 10, maxWithdraw: 50000, estimatedTime: '约 1-5 分钟' },
  { id: 'erc20', name: 'ERC20', symbol: 'Ethereum', fee: 15, minWithdraw: 50, maxWithdraw: 50000, estimatedTime: '约 5-30 分钟' },
  { id: 'bep20', name: 'BEP20', symbol: 'BSC', fee: 0.5, minWithdraw: 10, maxWithdraw: 50000, estimatedTime: '约 1-5 分钟' },
  { id: 'polygon', name: 'Polygon', symbol: 'MATIC', fee: 0.1, minWithdraw: 5, maxWithdraw: 50000, estimatedTime: '约 1-5 分钟' },
]

const defaultRecentWithdrawals = [
  { id: '1', amount: 500, fee: 1, network: 'TRC20', address: 'TYDz...AtW6', status: 'completed' as const, txHash: '0x123...abc', time: '2026-01-28 14:30' },
  { id: '2', amount: 1000, fee: 15, network: 'ERC20', address: '0x89...3fE2', status: 'processing' as const, time: '2026-01-29 10:15' },
]

export function WithdrawPage({
  balance = 12847.32,
  networks = defaultNetworks,
  recentWithdrawals = defaultRecentWithdrawals,
  onWithdraw
}: WithdrawPageProps) {
  const [selectedNetwork, setSelectedNetwork] = useState(networks[0])
  const [showNetworkDropdown, setShowNetworkDropdown] = useState(false)
  const [amount, setAmount] = useState('')
  const [address, setAddress] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)

  const numAmount = parseFloat(amount) || 0
  const receiveAmount = Math.max(0, numAmount - selectedNetwork.fee)
  const isValidAmount = numAmount >= selectedNetwork.minWithdraw && numAmount <= Math.min(selectedNetwork.maxWithdraw, balance)
  const isValidAddress = address.length > 10

  const handleSubmit = () => {
    if (isValidAmount && isValidAddress) {
      setShowConfirm(true)
    }
  }

  const handleConfirm = () => {
    onWithdraw?.({
      amount: numAmount,
      network: selectedNetwork.id,
      address
    })
    setShowConfirm(false)
    setAmount('')
    setAddress('')
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-400 bg-green-500/10'
      case 'processing':
        return 'text-blue-400 bg-blue-500/10'
      case 'pending':
        return 'text-yellow-400 bg-yellow-500/10'
      case 'failed':
        return 'text-red-400 bg-red-500/10'
      default:
        return 'text-[#9090A0] bg-[#1E1E2E]'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return '已完成'
      case 'processing':
        return '处理中'
      case 'pending':
        return '待审核'
      case 'failed':
        return '失败'
      default:
        return status
    }
  }

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-[#F8F8FC] font-sans p-6">
          {/* Page Header */}
          <div className="mb-4">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ArrowUpFromLine className="w-6 h-6 text-[#06B6D4]" />
              提现 USDT
            </h1>
          </div>

          <div className="grid grid-cols-3 gap-6">
            {/* Left: Withdraw Form */}
            <div className="col-span-2 space-y-6">
              {/* Network Selector */}
              <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.02)_inset] overflow-hidden">
                <h2 className="text-lg font-semibold mb-4">选择网络</h2>

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowNetworkDropdown(!showNetworkDropdown)}
                    className="w-full px-4 py-4 bg-[#0A0A0F] border border-[#2A2A3A] rounded-xl text-left flex items-center justify-between hover:border-[#06B6D4]/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-[#1E1E2E] rounded-full flex items-center justify-center">
                        <span className="text-[#06B6D4] font-bold text-sm">{selectedNetwork.symbol.charAt(0)}</span>
                      </div>
                      <div>
                        <div className="font-medium">{selectedNetwork.name}</div>
                        <div className="text-sm text-[#606070]">手续费: {selectedNetwork.fee} USDT</div>
                      </div>
                    </div>
                    <ChevronDown className={`w-5 h-5 text-[#606070] transition-transform ${showNetworkDropdown ? 'rotate-180' : ''}`} />
                  </button>

                  {showNetworkDropdown && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-[#12121A] border border-[#2A2A3A] rounded-xl overflow-hidden z-20 shadow-xl">
                      {networks.map((network) => (
                        <button
                          key={network.id}
                          type="button"
                          onClick={() => {
                            setSelectedNetwork(network)
                            setShowNetworkDropdown(false)
                          }}
                          className={`w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-[#1E1E2E] transition-colors ${
                            selectedNetwork.id === network.id ? 'bg-[#1E1E2E]' : ''
                          }`}
                        >
                          <div className="w-8 h-8 bg-[#2A2A3A] rounded-full flex items-center justify-center">
                            <span className="text-[#06B6D4] font-bold text-xs">{network.symbol.charAt(0)}</span>
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

              {/* Withdraw Address */}
              <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.02)_inset] overflow-hidden">
                <h2 className="text-lg font-semibold mb-4">提现地址</h2>

                <input
                  type="text"
                  placeholder={`请输入 ${selectedNetwork.name} 网络的 USDT 地址`}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-4 py-4 bg-[#0A0A0F] border border-[#2A2A3A] rounded-xl text-[#F8F8FC] placeholder-[#606070] focus:outline-none focus:border-[#06B6D4]/50 font-mono text-sm"
                />

                {address && !isValidAddress && (
                  <p className="mt-2 text-sm text-red-400 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    请输入有效的钱包地址
                  </p>
                )}
              </div>

              {/* Amount */}
              <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.02)_inset] overflow-hidden">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">提现金额</h2>
                  <div className="text-sm text-[#9090A0]">
                    可用余额: <span className="text-[#F8F8FC] font-medium">${balance.toLocaleString()}</span>
                  </div>
                </div>

                <div className="relative">
                  <input
                    type="number"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full px-4 py-4 bg-[#0A0A0F] border border-[#2A2A3A] rounded-xl text-[#F8F8FC] placeholder-[#606070] focus:outline-none focus:border-[#06B6D4]/50 text-2xl font-bold pr-24"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    <span className="text-[#606070]">USDT</span>
                    <button
                      type="button"
                      onClick={() => setAmount(Math.floor(balance).toString())}
                      className="px-2 py-1 bg-[#06B6D4]/10 text-[#06B6D4] rounded text-xs font-medium hover:bg-[#06B6D4]/20 transition-colors"
                    >
                      全部
                    </button>
                  </div>
                </div>

                {/* Quick Amount Buttons */}
                <div className="flex gap-2 mt-3">
                  {[100, 500, 1000, 5000].map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setAmount(value.toString())}
                      className="flex-1 py-2 bg-[#1E1E2E] rounded-lg text-sm text-[#9090A0] hover:text-[#F8F8FC] hover:bg-[#2A2A3A] transition-colors"
                    >
                      ${value}
                    </button>
                  ))}
                </div>

                {/* Amount Info */}
                <div className="mt-4 p-4 bg-[#0A0A0F]/50 rounded-xl space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-[#606070]">提现金额</span>
                    <span>{numAmount.toFixed(2)} USDT</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[#606070]">手续费</span>
                    <span className="text-red-400">-{selectedNetwork.fee} USDT</span>
                  </div>
                  <div className="border-t border-[#1E1E2E] pt-2 flex justify-between">
                    <span className="text-[#9090A0]">实际到账</span>
                    <span className="text-lg font-bold text-green-400">{receiveAmount.toFixed(2)} USDT</span>
                  </div>
                </div>

                {/* Limits */}
                <div className="mt-3 flex items-center justify-between text-xs text-[#606070]">
                  <span>最小: {selectedNetwork.minWithdraw} USDT</span>
                  <span>最大: {selectedNetwork.maxWithdraw.toLocaleString()} USDT</span>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!isValidAmount || !isValidAddress}
                className="w-full py-4 bg-[#06B6D4] text-black rounded-2xl font-semibold text-lg hover:bg-[#0891B2] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                提交提现申请
              </button>

              {/* Recent Withdrawals */}
              <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.02)_inset] overflow-hidden">
                <h2 className="text-lg font-semibold mb-4">最近提现</h2>

                {recentWithdrawals.length > 0 ? (
                  <div className="space-y-3">
                    {recentWithdrawals.map((withdrawal) => (
                      <div
                        key={withdrawal.id}
                        className="flex items-center justify-between p-4 bg-[#0A0A0F]/50 rounded-xl"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-red-500/10 rounded-full flex items-center justify-center">
                            <ArrowUpFromLine className="w-5 h-5 text-red-400" />
                          </div>
                          <div>
                            <div className="font-medium">-{withdrawal.amount} USDT</div>
                            <div className="text-sm text-[#606070]">{withdrawal.network} · {withdrawal.address}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <span className={`px-2 py-1 rounded-lg text-xs font-medium ${getStatusColor(withdrawal.status)}`}>
                              {getStatusText(withdrawal.status)}
                            </span>
                            <div className="text-xs text-[#606070] mt-1">{withdrawal.time}</div>
                          </div>
                          {withdrawal.txHash && (
                            <a
                              href={`https://tronscan.org/#/transaction/${withdrawal.txHash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 hover:bg-[#1E1E2E] rounded-lg transition-colors"
                              aria-label="查看交易详情"
                            >
                              <ExternalLink className="w-4 h-4 text-[#606070]" />
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-[#606070]">
                    暂无提现记录
                  </div>
                )}
              </div>
            </div>

            {/* Right: Info Panel */}
            <div className="space-y-6">
              {/* Balance Card */}
              <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.02)_inset] overflow-hidden">
                <div className="flex items-center gap-2 mb-4">
                  <Wallet className="w-5 h-5 text-[#06B6D4]" />
                  <h3 className="font-semibold">可提现余额</h3>
                </div>
                <div className="text-3xl font-bold">${balance.toLocaleString()}</div>
                <div className="text-sm text-[#606070] mt-1">USDT</div>
              </div>

              {/* Processing Time */}
              <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.02)_inset] overflow-hidden">
                <div className="flex items-center gap-2 mb-4">
                  <Clock className="w-5 h-5 text-[#06B6D4]" />
                  <h3 className="font-semibold">处理时间</h3>
                </div>
                <ul className="space-y-2 text-sm text-[#9090A0]">
                  <li>• 小额提现 (≤1000 USDT): 自动处理</li>
                  <li>• 大额提现 (&gt;1000 USDT): 人工审核 (1-24h)</li>
                  <li>• 链上确认: {selectedNetwork.estimatedTime}</li>
                </ul>
              </div>

              {/* Security Tips */}
              <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.02)_inset] overflow-hidden">
                <div className="flex items-center gap-2 mb-4">
                  <Shield className="w-5 h-5 text-[#06B6D4]" />
                  <h3 className="font-semibold">安全提示</h3>
                </div>
                <ul className="space-y-3 text-sm text-[#9090A0]">
                  <li className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                    <span>请务必核对提现地址，错误地址将导致资产丢失且无法找回</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                    <span>请确保选择的网络与目标地址的网络一致</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Info className="w-4 h-4 text-[#06B6D4] flex-shrink-0 mt-0.5" />
                    <span>首次提现到新地址需要邮箱验证</span>
                  </li>
                </ul>
              </div>

              {/* Help */}
              <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.02)_inset] overflow-hidden">
                <h3 className="font-semibold mb-3">需要帮助？</h3>
                <p className="text-sm text-[#9090A0] mb-4">
                  如果您在提现过程中遇到问题，请联系客服。
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

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="backdrop-blur-xl bg-[#12121A] border border-[#1E1E2E] rounded-2xl p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">确认提现</h2>

            <div className="space-y-4 mb-6">
              <div className="flex justify-between">
                <span className="text-[#9090A0]">网络</span>
                <span>{selectedNetwork.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#9090A0]">地址</span>
                <span className="font-mono text-sm">{address.slice(0, 8)}...{address.slice(-6)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#9090A0]">提现金额</span>
                <span>{numAmount} USDT</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#9090A0]">手续费</span>
                <span className="text-red-400">-{selectedNetwork.fee} USDT</span>
              </div>
              <div className="border-t border-[#1E1E2E] pt-4 flex justify-between">
                <span className="font-semibold">实际到账</span>
                <span className="text-xl font-bold text-green-400">{receiveAmount} USDT</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-3 border border-[#2A2A3A] rounded-xl text-[#9090A0] hover:text-[#F8F8FC] hover:border-[#06B6D4]/50 transition-colors"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="flex-1 py-3 bg-[#06B6D4] text-black rounded-xl font-semibold hover:bg-[#0891B2] transition-colors"
              >
                确认提现
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
