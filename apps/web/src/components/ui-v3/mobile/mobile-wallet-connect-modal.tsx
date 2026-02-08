'use client'

import { useState } from 'react'
import Image from 'next/image'
import { X, Loader2, ChevronRight, AlertCircle } from 'lucide-react'
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
  descKey: string
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

interface MobileWalletConnectModalProps {
  isOpen: boolean
  onClose: () => void
  onConnect?: (walletId: string) => Promise<void>
  mode?: 'login' | 'register'
  embedded?: boolean // 是否嵌入在手机框内
}

export function MobileWalletConnectModal({
  isOpen,
  onClose,
  onConnect,
  mode = 'login',
  embedded = false,
}: MobileWalletConnectModalProps) {
  const t = useTranslations('modals')
  const [connectingWallet, setConnectingWallet] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // 创建翻译后的钱包选项
  const walletOptions: WalletOption[] = walletOptionsConfig.map((wallet) => ({
    ...wallet,
    description: t(wallet.descKey),
  }))

  if (!isOpen) return null

  const handleConnect = async (walletId: string) => {
    setConnectingWallet(walletId)
    setError(null)

    try {
      await onConnect?.(walletId)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('connectFailed'))
    } finally {
      setConnectingWallet(null)
    }
  }

  return (
    <div className={`${embedded ? 'absolute' : 'fixed'} inset-0 z-50 flex flex-col bg-black/60 backdrop-blur-sm`}>
      {/* Backdrop - tap to close */}
      <div className="flex-1" onClick={onClose} />

      {/* Bottom Sheet */}
      <div className="animate-in slide-in-from-bottom duration-300">
        <div className="glass-border-glow relative bg-[#12121A]/95 backdrop-blur-[72px] border-t border-cyan-500/[0.08] rounded-t-3xl shadow-[0_-8px_32px_rgba(0,0,0,0.5)] overflow-hidden">
          {/* Top gradient highlight line */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/20 to-transparent" />

          {/* Drag Handle */}
          <div className="flex justify-center pt-3 pb-2">
            <div className="w-10 h-1 bg-[#2A2A3A] rounded-full" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-5 pb-4">
            <div>
              <h2 className="text-lg font-bold text-[#F8F8FC]">
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
            <div className="mx-5 mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Wallet List */}
          <div className="px-5 pb-6 space-y-2.5 max-h-[60vh] overflow-y-auto">
            {/* Popular Wallets */}
            <div className="text-[10px] text-[#606070] uppercase tracking-wider mb-2">
              {t('popularWallets')}
            </div>
            {walletOptions
              .filter((w) => w.popular)
              .map((wallet) => (
                <MobileWalletButton
                  key={wallet.id}
                  wallet={wallet}
                  isConnecting={connectingWallet === wallet.id}
                  disabled={connectingWallet !== null}
                  onClick={() => handleConnect(wallet.id)}
                />
              ))}

            {/* Other Wallets */}
            <div className="text-[10px] text-[#606070] uppercase tracking-wider mb-2 mt-5">
              {t('moreWallets')}
            </div>
            {walletOptions
              .filter((w) => !w.popular)
              .map((wallet) => (
                <MobileWalletButton
                  key={wallet.id}
                  wallet={wallet}
                  isConnecting={connectingWallet === wallet.id}
                  disabled={connectingWallet !== null}
                  onClick={() => handleConnect(wallet.id)}
                />
              ))}
          </div>

          {/* Footer - Safe Area */}
          <div className="px-5 pb-8">
            <p className="text-[10px] text-center text-[#606070]">
              {t('connectTerms')}
              <button type="button" className="text-cyan-400 hover:text-cyan-300 mx-1">
                {t('termsOfService')}
              </button>
              {t('and')}
              <button type="button" className="text-cyan-400 hover:text-cyan-300 mx-1">
                {t('privacyPolicy')}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

interface MobileWalletButtonProps {
  wallet: WalletOption
  isConnecting: boolean
  disabled: boolean
  onClick: () => void
}

function MobileWalletButton({
  wallet,
  isConnecting,
  disabled,
  onClick,
}: MobileWalletButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full p-3.5 bg-[#1A1A24] active:bg-[#1E1E2E] border border-cyan-500/[0.08] rounded-xl transition-all duration-200 flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {/* Wallet Icon */}
      <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 bg-[#12121A]">
        <Image
          src={wallet.icon}
          alt={wallet.name}
          width={40}
          height={40}
          className="w-full h-full object-contain"
        />
      </div>

      {/* Wallet Info */}
      <div className="flex-1 text-left">
        <div className="font-semibold text-sm text-[#F8F8FC]">
          {wallet.name}
        </div>
        <div className="text-xs text-[#9090A0]">{wallet.description}</div>
      </div>

      {/* Action */}
      <div className="flex-shrink-0">
        {isConnecting ? (
          <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
        ) : (
          <ChevronRight className="w-5 h-5 text-[#606070]" />
        )}
      </div>
    </button>
  )
}
