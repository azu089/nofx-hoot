'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { X, Loader2, ChevronRight, AlertCircle, CheckCircle } from 'lucide-react'
import { useWallet, formatAddress } from '@/hooks/useWallet'
import { useTranslations } from '@/i18n/provider'

interface WalletOption {
  id: string
  name: string
  icon: string
  description: string
  popular?: boolean
}

interface WalletOptionConfig {
  id: string
  name: string
  icon: string
  descKey: keyof typeof import('@/i18n/messages/zh-CN.json')['modals']
  popular?: boolean
}

const walletOptionsConfig: WalletOptionConfig[] = [
  {
    id: 'metamask',
    name: 'MetaMask',
    icon: '/icons/wallets/metamask.svg',
    descKey: 'metamaskDesc',
    popular: true,
  },
  {
    id: 'walletconnect',
    name: 'WalletConnect',
    icon: '/icons/wallets/walletconnect.svg',
    descKey: 'walletconnectDesc',
    popular: true,
  },
  {
    id: 'coinbase',
    name: 'Coinbase Wallet',
    icon: '/icons/wallets/coinbase.png',
    descKey: 'coinbaseDesc',
  },
  {
    id: 'okx',
    name: 'OKX Wallet',
    icon: '/icons/wallets/okx.png',
    descKey: 'okxDesc',
  },
  {
    id: 'trust',
    name: 'Trust Wallet',
    icon: '/icons/wallets/trust.svg',
    descKey: 'trustDesc',
  },
  {
    id: 'bitget',
    name: 'Bitget Wallet',
    icon: '/icons/wallets/bitget.png',
    descKey: 'bitgetDesc',
  },
]

interface WalletConnectModalProps {
  isOpen: boolean
  onClose: () => void
  onConnect?: (walletId: string) => Promise<void>
  onSuccess?: (address: string) => void
  mode?: 'login' | 'register'
}

export function WalletConnectModal({
  isOpen,
  onClose,
  onConnect,
  onSuccess,
  mode = 'login',
}: WalletConnectModalProps) {
  const t = useTranslations('modals')
  const [connectingWallet, setConnectingWallet] = useState<string | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)
  const { connectWallet, isConnected, address, error: walletError, isConnecting } = useWallet()

  // 创建翻译后的钱包选项
  const walletOptions: WalletOption[] = walletOptionsConfig.map((wallet) => ({
    ...wallet,
    description: t(wallet.descKey as any),
  }))

  // 连接成功后回调
  // eslint-disable-next-line react-hooks/set-state-in-effect -- 钱包连接成功后清理状态是合理的副作用
  useEffect(() => {
    if (isConnected && address && connectingWallet) {
      onSuccess?.(address)
      setConnectingWallet(null)
      onClose()
    }
  }, [isConnected, address, connectingWallet, onSuccess, onClose])

  if (!isOpen) return null

  const error = localError || walletError

  const handleConnect = async (walletId: string) => {
    setConnectingWallet(walletId)
    setLocalError(null)

    try {
      // 如果提供了外部 onConnect，使用它
      if (onConnect) {
        await onConnect(walletId)
        onClose()
      } else {
        // 使用 wagmi 连接
        await connectWallet(walletId)
      }
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : t('connectFailed'))
      setConnectingWallet(null)
    }
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      {/* Modal Container */}
      <div className="relative w-full max-w-md animate-in fade-in zoom-in-95 duration-200">
        {/* Glass Card */}
        <div className="glass-border-glow relative bg-[#12121A]/80 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.02)_inset] overflow-hidden">
          {/* Top gradient highlight line */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/20 to-transparent" />

          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-[#1E1E2E]">
            <div>
              <h2 className="text-xl font-bold text-[#F8F8FC]">
                {mode === 'login' ? t('walletLogin') : t('walletRegister')}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-[#1A1A24] transition-colors"
              title={t('close')}
              aria-label={t('close')}
            >
              <X className="w-5 h-5 text-[#9090A0]" />
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mx-6 mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Wallet List */}
          <div className="p-6 space-y-3 max-h-[400px] overflow-y-auto">
            {/* Popular Wallets */}
            <div className="text-xs text-[#606070] uppercase tracking-wider mb-3">
              {t('popularWallets')}
            </div>
            {walletOptions
              .filter((w) => w.popular)
              .map((wallet) => (
                <WalletButton
                  key={wallet.id}
                  wallet={wallet}
                  isConnecting={connectingWallet === wallet.id}
                  disabled={connectingWallet !== null}
                  onClick={() => handleConnect(wallet.id)}
                />
              ))}

            {/* Other Wallets */}
            <div className="text-xs text-[#606070] uppercase tracking-wider mb-3 mt-6">
              {t('moreWallets')}
            </div>
            {walletOptions
              .filter((w) => !w.popular)
              .map((wallet) => (
                <WalletButton
                  key={wallet.id}
                  wallet={wallet}
                  isConnecting={connectingWallet === wallet.id}
                  disabled={connectingWallet !== null}
                  onClick={() => handleConnect(wallet.id)}
                />
              ))}
          </div>

          {/* Footer */}
          <div className="px-6 pb-6">
            <p className="text-xs text-center text-[#606070]">
              {t('connectTerms')}
              <button type="button" className="text-cyan-400 hover:text-cyan-300 ml-1">
                {t('termsOfService')}
              </button>
              {t('and')}
              <button type="button" className="text-cyan-400 hover:text-cyan-300 ml-1">
                {t('privacyPolicy')}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

interface WalletButtonProps {
  wallet: WalletOption
  isConnecting: boolean
  disabled: boolean
  onClick: () => void
}

function WalletButton({
  wallet,
  isConnecting,
  disabled,
  onClick,
}: WalletButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full p-4 bg-[#1A1A24] hover:bg-[#1E1E2E] border border-cyan-500/[0.08] hover:border-cyan-500/20 rounded-xl transition-all duration-200 flex items-center gap-4 group disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {/* Wallet Icon */}
      <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-[#12121A]">
        <Image
          src={wallet.icon}
          alt={wallet.name}
          width={48}
          height={48}
          className="w-full h-full object-contain"
        />
      </div>

      {/* Wallet Info */}
      <div className="flex-1 text-left">
        <div className="font-semibold text-[#F8F8FC] group-hover:text-cyan-400 transition-colors">
          {wallet.name}
        </div>
        <div className="text-sm text-[#9090A0]">{wallet.description}</div>
      </div>

      {/* Action */}
      <div className="flex-shrink-0">
        {isConnecting ? (
          <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
        ) : (
          <ChevronRight className="w-5 h-5 text-[#606070] group-hover:text-cyan-400 transition-colors" />
        )}
      </div>
    </button>
  )
}
