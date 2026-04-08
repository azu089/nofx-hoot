import React, { useState, useEffect } from 'react'
import type { Exchange } from '../../types'
import { t, type Language } from '../../i18n/translations'
import { api } from '../../lib/api'
import { getExchangeIcon } from '../common/ExchangeIcons'
import {
  TwoStageKeyModal,
  type TwoStageKeyModalResult,
} from '../modals/TwoStageKeyModal'
import {
  WebCryptoEnvironmentCheck,
  type WebCryptoCheckStatus,
} from '../common/WebCryptoEnvironmentCheck'
import {
  BookOpen, Trash2, HelpCircle, ExternalLink, UserPlus,
  Key, Shield, ChevronLeft, Check, Copy, ArrowRight
} from 'lucide-react'
import { toast } from 'sonner'
import { Tooltip } from './Tooltip'
import { getShortName } from './utils'

// Supported exchange templates
const SUPPORTED_EXCHANGE_TEMPLATES = [
  { exchange_type: 'binance', name: 'Binance Futures', type: 'cex' as const },
  { exchange_type: 'bybit', name: 'Bybit Futures', type: 'cex' as const },
  { exchange_type: 'okx', name: 'OKX Futures', type: 'cex' as const },
  { exchange_type: 'bitget', name: 'Bitget Futures', type: 'cex' as const },
  { exchange_type: 'gate', name: 'Gate.io Futures', type: 'cex' as const },
  { exchange_type: 'kucoin', name: 'KuCoin Futures', type: 'cex' as const },
  { exchange_type: 'hyperliquid', name: 'Hyperliquid', type: 'dex' as const },
  { exchange_type: 'aster', name: 'Aster DEX', type: 'dex' as const },
  { exchange_type: 'lighter', name: 'Lighter', type: 'dex' as const },
  { exchange_type: 'indodax', name: 'Indodax', type: 'cex' as const },
]

interface ExchangeConfigModalProps {
  allExchanges: Exchange[]
  editingExchangeId: string | null
  onSave: (
    exchangeId: string | null,
    exchangeType: string,
    accountName: string,
    apiKey: string,
    secretKey?: string,
    passphrase?: string,
    testnet?: boolean,
    hyperliquidWalletAddr?: string,
    asterUser?: string,
    asterSigner?: string,
    asterPrivateKey?: string,
    lighterWalletAddr?: string,
    lighterPrivateKey?: string,
    lighterApiKeyPrivateKey?: string,
    lighterApiKeyIndex?: number
  ) => Promise<void>
  onDelete: (exchangeId: string) => void
  onClose: () => void
  language: Language
}

// Step indicator component
function StepIndicator({ currentStep, labels }: { currentStep: number; labels: string[] }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {labels.map((label, index) => {
        const isDone = index < currentStep
        const isActive = index === currentStep
        return (
          <React.Fragment key={index}>
            <div className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
                  isDone || isActive
                    ? 'bg-emerald-400 text-black shadow-[0_0_16px_rgba(43,232,158,0.4)]'
                    : 'bg-white/5 text-zinc-500 border border-white/10'
                }`}
              >
                {isDone ? <Check className="w-4 h-4" strokeWidth={3} /> : index + 1}
              </div>
              <span
                className={`text-xs font-medium hidden sm:block ${isActive ? 'text-white' : 'text-zinc-500'}`}
              >
                {label}
              </span>
            </div>
            {index < labels.length - 1 && (
              <div className={`w-8 h-0.5 mx-1 ${isDone ? 'bg-emerald-400' : 'bg-white/10'}`} />
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}

// Exchange card component
function ExchangeCard({
  template,
  selected,
  onClick,
  disabled,
}: {
  template: typeof SUPPORTED_EXCHANGE_TEMPLATES[0]
  selected: boolean
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="group flex flex-col items-center gap-2 p-2 rounded-xl transition-all hover:bg-white/[0.04] disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <div className="relative">
        <div
          className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
            selected
              ? 'ring-2 ring-emerald-400 shadow-[0_0_20px_rgba(43,232,158,0.4)]'
              : 'ring-1 ring-white/10 group-hover:ring-white/20'
          }`}
          style={{ background: 'rgba(0, 0, 0, 0.3)' }}
        >
          {getExchangeIcon(template.exchange_type, { width: 32, height: 32 })}
        </div>
        {selected && (
          <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center bg-emerald-400 shadow-[0_0_10px_rgba(43,232,158,0.6)]">
            <Check className="w-3 h-3 text-black" strokeWidth={3} />
          </div>
        )}
      </div>
      <span className={`text-xs font-medium text-center leading-tight ${selected ? 'text-white' : 'text-zinc-300'}`}>
        {getShortName(template.name)}
      </span>
    </button>
  )
}

export function ExchangeConfigModal({
  allExchanges,
  editingExchangeId,
  onSave,
  onDelete,
  onClose,
  language,
}: ExchangeConfigModalProps) {
  // Step: 0 = select exchange, 1 = configure
  const [currentStep, setCurrentStep] = useState(editingExchangeId ? 1 : 0)
  const [selectedExchangeType, setSelectedExchangeType] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [secretKey, setSecretKey] = useState('')
  const [passphrase, setPassphrase] = useState('')
  const [testnet, setTestnet] = useState(false)
  const [showGuide, setShowGuide] = useState(false)
  const [serverIP, setServerIP] = useState<{ public_ip: string; message: string } | null>(null)
  const [loadingIP, setLoadingIP] = useState(false)
  const [copiedIP, setCopiedIP] = useState(false)
  const [webCryptoStatus, setWebCryptoStatus] = useState<WebCryptoCheckStatus>('idle')
  const [showBinanceGuide, setShowBinanceGuide] = useState(false)

  // Aster fields
  const [asterUser, setAsterUser] = useState('')
  const [asterSigner, setAsterSigner] = useState('')
  const [asterPrivateKey, setAsterPrivateKey] = useState('')

  // Hyperliquid fields
  const [hyperliquidWalletAddr, setHyperliquidWalletAddr] = useState('')

  // Lighter fields
  const [lighterWalletAddr, setLighterWalletAddr] = useState('')
  const [lighterApiKeyPrivateKey, setLighterApiKeyPrivateKey] = useState('')
  const [lighterApiKeyIndex, setLighterApiKeyIndex] = useState(0)

  // Other state
  const [secureInputTarget, setSecureInputTarget] = useState<null | 'hyperliquid' | 'aster' | 'lighter'>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [accountName, setAccountName] = useState('')

  const selectedExchange = editingExchangeId
    ? allExchanges?.find((e) => e.id === editingExchangeId)
    : null

  const selectedTemplate = editingExchangeId
    ? SUPPORTED_EXCHANGE_TEMPLATES.find((t) => t.exchange_type === selectedExchange?.exchange_type)
    : SUPPORTED_EXCHANGE_TEMPLATES.find((t) => t.exchange_type === selectedExchangeType)

  const currentExchangeType = editingExchangeId
    ? selectedExchange?.exchange_type
    : selectedExchangeType

  const exchangeRegistrationLinks: Record<string, { url: string; hasReferral?: boolean }> = {
    binance: { url: 'https://www.binance.com/join?ref=NOFXENG', hasReferral: true },
    okx: { url: 'https://www.okx.com/join/1865360', hasReferral: true },
    bybit: { url: 'https://partner.bybit.com/b/83856', hasReferral: true },
    bitget: { url: 'https://www.bitget.com/referral/register?from=referral&clacCode=c8a43172', hasReferral: true },
    gate: { url: 'https://www.gatenode.xyz/share/VQBGUAxY', hasReferral: true },
    kucoin: { url: 'https://www.kucoin.com/r/broker/CXEV7XKK', hasReferral: true },
    hyperliquid: { url: 'https://app.hyperliquid.xyz/join/AITRADING', hasReferral: true },
    aster: { url: 'https://www.asterdex.com/en/referral/fdfc0e', hasReferral: true },
    lighter: { url: 'https://app.lighter.xyz/?referral=68151432', hasReferral: true },
    indodax: { url: 'https://indodax.com/ref/Saep23/1', hasReferral: true },
  }

  // Initialize form when editing
  useEffect(() => {
    if (editingExchangeId && selectedExchange) {
      setAccountName(selectedExchange.account_name || '')
      setApiKey(selectedExchange.apiKey || '')
      setSecretKey(selectedExchange.secretKey || '')
      setPassphrase('')
      setTestnet(selectedExchange.testnet || false)
      setAsterUser(selectedExchange.asterUser || '')
      setAsterSigner(selectedExchange.asterSigner || '')
      setAsterPrivateKey('')
      setHyperliquidWalletAddr(selectedExchange.hyperliquidWalletAddr || '')
      setLighterWalletAddr(selectedExchange.lighterWalletAddr || '')
      setLighterApiKeyPrivateKey('')
      setLighterApiKeyIndex(selectedExchange.lighterApiKeyIndex || 0)
    }
  }, [editingExchangeId, selectedExchange])

  // Load server IP for Binance
  useEffect(() => {
    if (currentExchangeType === 'binance' && !serverIP) {
      setLoadingIP(true)
      api.getServerIP()
        .then((data) => setServerIP(data))
        .catch((err) => console.error('Failed to load server IP:', err))
        .finally(() => setLoadingIP(false))
    }
  }, [currentExchangeType, serverIP])

  const handleCopyIP = async (ip: string) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(ip)
        setCopiedIP(true)
        setTimeout(() => setCopiedIP(false), 2000)
        toast.success(t('ipCopied', language))
      } else {
        const textArea = document.createElement('textarea')
        textArea.value = ip
        textArea.style.position = 'fixed'
        textArea.style.left = '-999999px'
        document.body.appendChild(textArea)
        textArea.select()
        document.execCommand('copy')
        document.body.removeChild(textArea)
        setCopiedIP(true)
        setTimeout(() => setCopiedIP(false), 2000)
        toast.success(t('ipCopied', language))
      }
    } catch {
      toast.error(t('copyIPFailed', language) || `复制失败: ${ip}`)
    }
  }

  const secureInputContextLabel =
    secureInputTarget === 'aster' ? t('asterExchangeName', language)
      : secureInputTarget === 'hyperliquid' ? t('hyperliquidExchangeName', language)
        : undefined

  const handleSecureInputComplete = ({ value }: TwoStageKeyModalResult) => {
    const trimmed = value.trim()
    if (secureInputTarget === 'hyperliquid') setApiKey(trimmed)
    if (secureInputTarget === 'aster') setAsterPrivateKey(trimmed)
    if (secureInputTarget === 'lighter') {
      setLighterApiKeyPrivateKey(trimmed)
      toast.success(t('lighterApiKeyImported', language))
    }
    setSecureInputTarget(null)
  }

  const maskSecret = (secret: string) => {
    if (!secret || secret.length === 0) return ''
    if (secret.length <= 8) return '*'.repeat(secret.length)
    return secret.slice(0, 4) + '*'.repeat(Math.max(secret.length - 8, 4)) + secret.slice(-4)
  }

  const handleSelectExchange = (exchangeType: string) => {
    setSelectedExchangeType(exchangeType)
    setCurrentStep(1)
  }

  const handleBack = () => {
    if (editingExchangeId) {
      onClose()
    } else {
      setCurrentStep(0)
      setSelectedExchangeType('')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSaving) return
    if (!editingExchangeId && !selectedExchangeType) return

    const trimmedAccountName = accountName.trim()
    if (!trimmedAccountName) {
      toast.error(language === 'zh' ? '请输入账户名称' : 'Please enter account name')
      return
    }

    const exchangeId = editingExchangeId || null
    const exchangeType = currentExchangeType || ''

    setIsSaving(true)
    try {
      if (currentExchangeType === 'binance' || currentExchangeType === 'bybit' || currentExchangeType === 'indodax') {
        if (!apiKey.trim() || !secretKey.trim()) return
        await onSave(exchangeId, exchangeType, trimmedAccountName, apiKey.trim(), secretKey.trim(), '', testnet)
      } else if (currentExchangeType === 'okx' || currentExchangeType === 'bitget' || currentExchangeType === 'kucoin') {
        if (!apiKey.trim() || !secretKey.trim() || !passphrase.trim()) return
        await onSave(exchangeId, exchangeType, trimmedAccountName, apiKey.trim(), secretKey.trim(), passphrase.trim(), testnet)
      } else if (currentExchangeType === 'hyperliquid') {
        if (!apiKey.trim() || !hyperliquidWalletAddr.trim()) return
        await onSave(exchangeId, exchangeType, trimmedAccountName, apiKey.trim(), '', '', testnet, hyperliquidWalletAddr.trim())
      } else if (currentExchangeType === 'aster') {
        if (!asterUser.trim() || !asterSigner.trim() || !asterPrivateKey.trim()) return
        await onSave(exchangeId, exchangeType, trimmedAccountName, '', '', '', testnet, undefined, asterUser.trim(), asterSigner.trim(), asterPrivateKey.trim())
      } else if (currentExchangeType === 'lighter') {
        if (!lighterWalletAddr.trim() || !lighterApiKeyPrivateKey.trim()) return
        await onSave(exchangeId, exchangeType, trimmedAccountName, '', '', '', testnet, undefined, undefined, undefined, undefined, lighterWalletAddr.trim(), '', lighterApiKeyPrivateKey.trim(), lighterApiKeyIndex)
      } else {
        if (!apiKey.trim() || !secretKey.trim()) return
        await onSave(exchangeId, exchangeType, trimmedAccountName, apiKey.trim(), secretKey.trim(), '', testnet)
      }
    } finally {
      setIsSaving(false)
    }
  }

  const stepLabels = language === 'zh' ? ['选择交易所', '配置账户'] : ['Select Exchange', 'Configure']
  const cexExchanges = SUPPORTED_EXCHANGE_TEMPLATES.filter(t => t.type === 'cex')
  const dexExchanges = SUPPORTED_EXCHANGE_TEMPLATES.filter(t => t.type === 'dex')

  return (
    <div className="nexora-modal-backdrop">
      <div
        className="bubble-card w-full max-w-2xl relative my-8 overflow-hidden"
        style={{ maxHeight: 'calc(100vh - 4rem)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <div className="flex items-center gap-3">
            {currentStep > 0 && !editingExchangeId && (
              <button type="button" onClick={handleBack} className="p-1.5 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition-colors">
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            <h3 className="text-lg font-medium text-white">
              {editingExchangeId ? t('editExchange', language) : t('addExchange', language)}
            </h3>
          </div>
          <div className="flex items-center gap-1.5">
            {currentExchangeType === 'binance' && currentStep === 1 && (
              <button
                type="button"
                onClick={() => setShowGuide(true)}
                className="px-3 py-1.5 rounded-full text-xs font-medium transition-all bg-emerald-400/10 text-emerald-300 border border-emerald-400/20 hover:bg-emerald-400/15 flex items-center gap-1.5"
              >
                <BookOpen className="w-3.5 h-3.5" />
                {t('viewGuide', language)}
              </button>
            )}
            {editingExchangeId && (
              <button
                type="button"
                onClick={() => onDelete(editingExchangeId)}
                className="p-1.5 rounded-full hover:bg-red-500/15 text-red-400 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button type="button" onClick={onClose} className="p-1.5 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition-colors">
              ✕
            </button>
          </div>
        </div>

        {/* Step Indicator */}
        {!editingExchangeId && (
          <div className="px-6">
            <StepIndicator currentStep={currentStep} labels={stepLabels} />
          </div>
        )}

        {/* Content */}
        <div className="px-6 pb-6 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 16rem)' }}>
          {/* Step 0: Select Exchange */}
          {currentStep === 0 && !editingExchangeId && (
            <div className="space-y-6">
              {/* WebCrypto Check */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide" style={{ color: '#848E9C' }}>
                  <Shield className="w-4 h-4" />
                  {t('environmentSteps.checkTitle', language)}
                </div>
                <WebCryptoEnvironmentCheck language={language} variant="card" onStatusChange={setWebCryptoStatus} />
              </div>

              {/* Exchange Grid */}
              <div className="space-y-5">
                <div className="text-sm font-medium text-white">
                  {language === 'zh' ? '选择您的交易所' : 'Choose Your Exchange'}
                </div>

                {/* CEX */}
                <div className="space-y-3">
                  <div className="text-xs font-medium text-zinc-500">
                    {language === 'zh' ? '中心化交易所 (CEX)' : 'Centralized Exchanges (CEX)'}
                  </div>
                  <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                    {cexExchanges.map((template) => (
                      <ExchangeCard
                        key={template.exchange_type}
                        template={template}
                        selected={selectedExchangeType === template.exchange_type}
                        onClick={() => handleSelectExchange(template.exchange_type)}
                        disabled={webCryptoStatus !== 'secure' && webCryptoStatus !== 'disabled'}
                      />
                    ))}
                  </div>
                </div>

                {/* DEX */}
                <div className="space-y-3">
                  <div className="text-xs font-medium text-zinc-500">
                    {language === 'zh' ? '去中心化交易所 (DEX)' : 'Decentralized Exchanges (DEX)'}
                  </div>
                  <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                    {dexExchanges.map((template) => (
                      <ExchangeCard
                        key={template.exchange_type}
                        template={template}
                        selected={selectedExchangeType === template.exchange_type}
                        onClick={() => handleSelectExchange(template.exchange_type)}
                        disabled={webCryptoStatus !== 'secure' && webCryptoStatus !== 'disabled'}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 1: Configure */}
          {(currentStep === 1 || editingExchangeId) && selectedTemplate && (
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Selected Exchange Header */}
              <div className="bubble-card p-4 flex items-center gap-4">
                <div className="w-12 h-12 rounded-full flex items-center justify-center bg-black/40 ring-1 ring-white/10 flex-shrink-0">
                  {getExchangeIcon(selectedTemplate.exchange_type, { width: 32, height: 32 })}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-base font-medium text-white">
                    {getShortName(selectedTemplate.name)}
                  </div>
                  <div className="text-[10px] text-zinc-500">
                    {selectedTemplate.type.toUpperCase()} · {selectedTemplate.exchange_type}
                  </div>
                </div>
                <a
                  href={exchangeRegistrationLinks[currentExchangeType || '']?.url || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-all bg-emerald-400/10 border border-emerald-400/30 text-emerald-300 hover:bg-emerald-400/15 flex-shrink-0"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span className="font-medium">
                    {language === 'zh' ? '注册' : 'Register'}
                  </span>
                  {exchangeRegistrationLinks[currentExchangeType || '']?.hasReferral && (
                    <span className="text-[9px] px-1 py-0.5 rounded bg-emerald-400/20 text-emerald-200">
                      {language === 'zh' ? '优惠' : 'Bonus'}
                    </span>
                  )}
                </a>
              </div>

              {/* Account Name */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs font-medium text-zinc-300">
                  <Key className="w-3.5 h-3.5 text-zinc-500" />
                  {language === 'zh' ? '账户名称' : 'Account Name'} <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  placeholder={language === 'zh' ? '例如:主账户、套利账户' : 'e.g., Main Account'}
                  className="nexora-input"
                  required
                />
              </div>

              {/* CEX Fields */}
              {(currentExchangeType === 'binance' || currentExchangeType === 'bybit' || currentExchangeType === 'okx' || currentExchangeType === 'bitget' || currentExchangeType === 'gate' || currentExchangeType === 'kucoin' || currentExchangeType === 'indodax') && (
                <>
                  {currentExchangeType === 'binance' && (
                    <div
                      className="bubble-card p-3 cursor-pointer"
                      onClick={() => setShowBinanceGuide(!showBinanceGuide)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-zinc-400 text-sm">ℹ</span>
                          <span className="text-xs font-medium text-white truncate">
                            {language === 'zh' ? '币安用户必读：使用「现货与合约交易」API' : 'Use "Spot & Futures Trading" API'}
                          </span>
                        </div>
                        <span className="text-zinc-500 text-xs flex-shrink-0">{showBinanceGuide ? '▲' : '▼'}</span>
                      </div>
                      {showBinanceGuide && (
                        <div className="mt-2 pt-2 text-xs border-t border-white/5">
                          <a
                            href="https://www.binance.com/zh-CN/support/faq/how-to-create-api-keys-on-binance-360002502072"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 hover:underline text-zinc-400 hover:text-emerald-300"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {language === 'zh' ? '查看官方教程' : 'View Tutorial'} <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-xs font-medium text-zinc-300">
                      <Key className="w-3.5 h-3.5 text-zinc-500" />
                      {t('apiKey', language)}
                    </label>
                    <input
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder={t('enterAPIKey', language)}
                      className="nexora-input"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-xs font-medium text-zinc-300">
                      <Shield className="w-3.5 h-3.5 text-zinc-500" />
                      {t('secretKey', language)}
                    </label>
                    <input
                      type="password"
                      value={secretKey}
                      onChange={(e) => setSecretKey(e.target.value)}
                      placeholder={t('enterSecretKey', language)}
                      className="nexora-input"
                      required
                    />
                  </div>

                  {(currentExchangeType === 'okx' || currentExchangeType === 'bitget' || currentExchangeType === 'kucoin') && (
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-sm font-medium" style={{ color: '#EAECEF' }}>
                        <Key className="w-4 h-4" style={{ color: '#F0B90B' }} />
                        {t('passphrase', language)}
                      </label>
                      <input
                        type="password"
                        value={passphrase}
                        onChange={(e) => setPassphrase(e.target.value)}
                        placeholder={t('enterPassphrase', language)}
                        className="nexora-input"
                        required
                      />
                    </div>
                  )}

                  {currentExchangeType === 'binance' && (
                    <div className="bubble-card p-4">
                      <div className="text-xs font-medium mb-1.5 text-white">
                        {t('whitelistIP', language)}
                      </div>
                      <div className="text-[10px] mb-3 text-zinc-500">
                        {t('whitelistIPDesc', language)}
                      </div>
                      {loadingIP ? (
                        <div className="text-xs text-zinc-500">{t('loadingServerIP', language)}</div>
                      ) : serverIP?.public_ip ? (
                        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-black/40">
                          <code className="flex-1 text-sm font-mono text-white">{serverIP.public_ip}</code>
                          <button
                            type="button"
                            onClick={() => handleCopyIP(serverIP.public_ip)}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all bg-emerald-400/15 text-emerald-300 hover:bg-emerald-400/20"
                          >
                            <Copy className="w-3 h-3" />
                            {copiedIP ? t('ipCopied', language) : t('copyIP', language)}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  )}
                </>
              )}

              {/* Aster Fields */}
              {currentExchangeType === 'aster' && (
                <>
                  <div className="p-4 rounded-xl" style={{ background: 'rgba(139, 92, 246, 0.1)', border: '1px solid rgba(139, 92, 246, 0.3)' }}>
                    <div className="flex items-start gap-2">
                      <span style={{ fontSize: '16px' }}>🔐</span>
                      <div>
                        <div className="text-sm font-medium mb-1" style={{ color: '#A78BFA' }}>{t('asterApiProTitle', language)}</div>
                        <div className="text-xs" style={{ color: '#848E9C' }}>{t('asterApiProDesc', language)}</div>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm font-medium" style={{ color: '#EAECEF' }}>
                      {t('asterUserLabel', language)}
                      <Tooltip content={t('asterUserDesc', language)}>
                        <HelpCircle className="w-4 h-4 cursor-help" style={{ color: '#A78BFA' }} />
                      </Tooltip>
                    </label>
                    <input type="text" value={asterUser} onChange={(e) => setAsterUser(e.target.value)} placeholder={t('enterAsterUser', language)} className="nexora-input" required />
                  </div>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm font-medium" style={{ color: '#EAECEF' }}>
                      {t('asterSignerLabel', language)}
                      <Tooltip content={t('asterSignerDesc', language)}>
                        <HelpCircle className="w-4 h-4 cursor-help" style={{ color: '#A78BFA' }} />
                      </Tooltip>
                    </label>
                    <input type="text" value={asterSigner} onChange={(e) => setAsterSigner(e.target.value)} placeholder={t('enterAsterSigner', language)} className="nexora-input" required />
                  </div>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm font-medium" style={{ color: '#EAECEF' }}>
                      {t('asterPrivateKeyLabel', language)}
                      <Tooltip content={t('asterPrivateKeyDesc', language)}>
                        <HelpCircle className="w-4 h-4 cursor-help" style={{ color: '#A78BFA' }} />
                      </Tooltip>
                    </label>
                    <input type="password" value={asterPrivateKey} onChange={(e) => setAsterPrivateKey(e.target.value)} placeholder={t('enterAsterPrivateKey', language)} className="nexora-input" required />
                  </div>
                </>
              )}

              {/* Hyperliquid Fields */}
              {currentExchangeType === 'hyperliquid' && (
                <>
                  <div className="p-4 rounded-xl" style={{ background: 'rgba(127, 231, 204, 0.1)', border: '1px solid rgba(127, 231, 204, 0.3)' }}>
                    <div className="flex items-start gap-2">
                      <span style={{ fontSize: '16px' }}>🔐</span>
                      <div>
                        <div className="text-sm font-medium mb-1" style={{ color: '#7FE7CC' }}>{t('hyperliquidAgentWalletTitle', language)}</div>
                        <div className="text-xs" style={{ color: '#848E9C' }}>{t('hyperliquidAgentWalletDesc', language)}</div>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium" style={{ color: '#EAECEF' }}>{t('hyperliquidAgentPrivateKey', language)}</label>
                    <div className="flex gap-2">
                      <input type="text" value={maskSecret(apiKey)} readOnly placeholder={t('enterHyperliquidAgentPrivateKey', language)} className="nexora-input flex-1" />
                      <button type="button" onClick={() => setSecureInputTarget('hyperliquid')} className="px-4 py-3 rounded-xl text-sm font-medium transition-all hover:scale-105" style={{ background: '#7FE7CC', color: '#000' }}>
                        {apiKey ? t('secureInputReenter', language) : t('secureInputButton', language)}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium" style={{ color: '#EAECEF' }}>{t('hyperliquidMainWalletAddress', language)}</label>
                    <input type="text" value={hyperliquidWalletAddr} onChange={(e) => setHyperliquidWalletAddr(e.target.value)} placeholder={t('enterHyperliquidMainWalletAddress', language)} className="nexora-input" required />
                  </div>
                </>
              )}

              {/* Lighter Fields */}
              {currentExchangeType === 'lighter' && (
                <>
                  <div className="p-4 rounded-xl" style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                    <div className="flex items-start gap-2">
                      <span style={{ fontSize: '16px' }}>🔐</span>
                      <div>
                        <div className="text-sm font-medium mb-1" style={{ color: '#3B82F6' }}>
                          {language === 'zh' ? 'Lighter API Key 配置' : 'Lighter API Key Setup'}
                        </div>
                        <div className="text-xs" style={{ color: '#848E9C' }}>
                          {language === 'zh' ? '请在 Lighter 网站生成 API Key' : 'Generate an API Key on Lighter website'}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium" style={{ color: '#EAECEF' }}>{t('lighterWalletAddress', language)} *</label>
                    <input type="text" value={lighterWalletAddr} onChange={(e) => setLighterWalletAddr(e.target.value)} placeholder={t('enterLighterWalletAddress', language)} className="nexora-input" required />
                  </div>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm font-medium" style={{ color: '#EAECEF' }}>
                      {t('lighterApiKeyPrivateKey', language)} *
                      <button type="button" onClick={() => setSecureInputTarget('lighter')} className="text-xs underline" style={{ color: '#3B82F6' }}>{t('secureInputButton', language)}</button>
                    </label>
                    <input type="password" value={lighterApiKeyPrivateKey} onChange={(e) => setLighterApiKeyPrivateKey(e.target.value)} placeholder={t('enterLighterApiKeyPrivateKey', language)} className="nexora-input font-mono" required />
                  </div>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm font-medium" style={{ color: '#EAECEF' }}>
                      {language === 'zh' ? 'API Key 索引' : 'API Key Index'}
                      <Tooltip content={language === 'zh' ? 'API Key 索引从0开始' : 'API Key index starts from 0'}>
                        <HelpCircle className="w-4 h-4 cursor-help" style={{ color: '#3B82F6' }} />
                      </Tooltip>
                    </label>
                    <input type="number" min={0} max={255} value={lighterApiKeyIndex} onChange={(e) => setLighterApiKeyIndex(parseInt(e.target.value) || 0)} className="nexora-input" />
                  </div>
                </>
              )}

              {/* Buttons */}
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={handleBack} className="flex-1 py-3 rounded-full text-sm font-medium bg-white/5 text-zinc-300 border border-white/10 hover:bg-white/10 transition-all">
                  {editingExchangeId ? t('cancel', language) : (language === 'zh' ? '返回' : 'Back')}
                </button>
                <button
                  type="submit"
                  disabled={isSaving || !accountName.trim()}
                  className="btn-emerald flex-1 flex items-center justify-center gap-2 py-3 rounded-full text-sm"
                >
                  {isSaving ? (t('saving', language) || '保存中...') : (
                    <>{t('saveConfig', language)} <ArrowRight className="w-4 h-4" /></>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Binance Guide Modal */}
      {showGuide && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4" onClick={() => setShowGuide(false)}>
          <div className="rounded-2xl p-6 w-full max-w-4xl" style={{ background: '#1E2329' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-medium flex items-center gap-2" style={{ color: '#EAECEF' }}>
                <BookOpen className="w-6 h-6" style={{ color: '#F0B90B' }} />
                {t('binanceSetupGuide', language)}
              </h3>
              <button onClick={() => setShowGuide(false)} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: '#2B3139', color: '#848E9C' }}>
                {t('closeGuide', language)}
              </button>
            </div>
            <div className="overflow-y-auto max-h-[80vh]">
              <img src="/images/guide.png" alt={t('binanceSetupGuide', language)} className="w-full h-auto rounded-lg" />
            </div>
          </div>
        </div>
      )}

      {/* Secure Input Modal */}
      <TwoStageKeyModal
        isOpen={secureInputTarget !== null}
        language={language}
        contextLabel={secureInputContextLabel}
        expectedLength={64}
        onCancel={() => setSecureInputTarget(null)}
        onComplete={handleSecureInputComplete}
      />
    </div>
  )
}

