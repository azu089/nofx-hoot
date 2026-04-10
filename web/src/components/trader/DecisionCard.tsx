import { useState } from 'react'
import { Copy, Download, ChevronDown, ChevronRight } from 'lucide-react'
import type { DecisionRecord, DecisionAction } from '../../types'
import { t, type Language } from '../../i18n/translations'

interface DecisionCardProps {
  decision: DecisionRecord
  language: Language
  onSymbolClick?: (symbol: string) => void
}

// Action type configuration
const ACTION_CONFIG: Record<string, { color: string; icon: string; label: string }> = {
  open_long: { color: '#0ECB81', icon: '📈', label: 'LONG' },
  open_short: { color: '#F6465D', icon: '📉', label: 'SHORT' },
  close_long: { color: '#10B981', icon: '💰', label: 'CLOSE' },
  close_short: { color: '#10B981', icon: '💰', label: 'CLOSE' },
  hold: { color: '#848E9C', icon: '⏸️', label: 'HOLD' },
  wait: { color: '#848E9C', icon: '⏳', label: 'WAIT' },
}

function formatPrice(price: number | undefined): string {
  if (!price || price === 0) return '-'
  if (price >= 1000) return price.toFixed(2)
  if (price >= 1) return price.toFixed(4)
  return price.toFixed(6)
}

function calcPctChange(entry: number | undefined, target: number | undefined, isLong: boolean): string {
  if (!entry || !target || entry === 0) return '-'
  const pct = ((target - entry) / entry) * 100
  const adjustedPct = isLong ? pct : -pct
  return `${adjustedPct >= 0 ? '+' : ''}${adjustedPct.toFixed(2)}%`
}

function getConfidenceColor(confidence: number | undefined): string {
  if (!confidence) return '#848E9C'
  if (confidence >= 80) return '#0ECB81'
  if (confidence >= 60) return '#10B981'
  return '#F6465D'
}

// 思维/理由展开块 — 悬空
function ReasoningBlock({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false)
  const isLong = text.length > 100
  return (
    <div
      className="mt-3 pt-3"
      style={{ cursor: isLong ? 'pointer' : 'default' }}
      onClick={() => isLong && setExpanded(!expanded)}
    >
      <div className={`text-xs text-nofx-text-muted ${expanded ? '' : 'line-clamp-2'}`}>
        💡 {text}
      </div>
      {isLong && (
        <div className="text-xs mt-1 text-emerald-400">
          {expanded ? '▲ 收起' : '▼ 展开全部'}
        </div>
      )}
    </div>
  )
}

// 单个交易动作 — 悬空展示
function ActionCard({ action, language, onSymbolClick }: { action: DecisionAction; language: Language; onSymbolClick?: (symbol: string) => void }) {
  const config = ACTION_CONFIG[action.action] || ACTION_CONFIG.wait
  const isLong = action.action.includes('long')
  const isOpen = action.action.includes('open')

  return (
    <div className="py-3">
      {/* Header Row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">{config.icon}</span>
          <span
            className="font-mono font-medium text-sm cursor-pointer hover:text-emerald-400 transition-colors"
            style={{ color: '#EAECEF' }}
            onClick={() => onSymbolClick?.(action.symbol)}
            title="Click to view chart"
          >
            {action.symbol.replace('USDT', '')}
          </span>
          <span
            className="px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider"
            style={{ color: config.color, border: `1px solid ${config.color}55` }}
          >
            {config.label}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {action.confidence !== undefined && action.confidence > 0 && (
            <span
              className="text-xs font-mono"
              style={{ color: getConfidenceColor(action.confidence) }}
            >
              {action.confidence.toFixed(0)}%
            </span>
          )}
          <div
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: action.success ? '#10B981' : '#F6465D' }}
          />
        </div>
      </div>

      {/* Trading Details */}
      {isOpen && (
        <div className="grid grid-cols-4 gap-3 mt-3 text-xs">
          <div>
            <div className="text-nofx-text-muted mb-0.5">{t('entryPrice', language)}</div>
            <div className="font-mono text-nofx-text-main">{formatPrice(action.price)}</div>
          </div>
          <div>
            <div className="text-red-400/70 mb-0.5">{t('stopLoss', language)}</div>
            <div className="font-mono text-red-400">{formatPrice(action.stop_loss)}</div>
            {action.stop_loss && action.price && (
              <div className="text-[10px] mt-0.5 text-nofx-text-muted">
                {calcPctChange(action.price, action.stop_loss, isLong)}
              </div>
            )}
          </div>
          <div>
            <div className="text-emerald-400/70 mb-0.5">{t('takeProfit', language)}</div>
            <div className="font-mono text-emerald-400">{formatPrice(action.take_profit)}</div>
            {action.take_profit && action.price && (
              <div className="text-[10px] mt-0.5 text-nofx-text-muted">
                {calcPctChange(action.price, action.take_profit, isLong)}
              </div>
            )}
          </div>
          <div>
            <div className="text-nofx-text-muted mb-0.5">{t('leverage', language)}</div>
            <div className="font-mono text-emerald-400">{action.leverage}x</div>
          </div>
        </div>
      )}

      {/* Risk/Reward */}
      {isOpen && action.stop_loss && action.take_profit && action.price && (
        <div className="mt-2 flex items-center justify-between text-xs">
          <span className="text-nofx-text-muted">{t('riskReward', language)}</span>
          {(() => {
            const slDist = Math.abs(action.price - action.stop_loss)
            const tpDist = Math.abs(action.take_profit - action.price)
            const ratio = slDist > 0 ? (tpDist / slDist) : 0
            const ratioColor = ratio >= 3 ? '#10B981' : ratio >= 2 ? '#F0B90B' : '#F6465D'
            return (
              <div className="flex items-center gap-2">
                <span className="font-mono">
                  <span className="text-red-400">1</span>
                  <span className="text-nofx-text-muted">:</span>
                  <span className="text-emerald-400">{ratio.toFixed(1)}</span>
                </span>
                <div className="h-1 rounded-full w-12 bg-white/10">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min(ratio / 5 * 100, 100)}%`,
                      background: ratioColor,
                    }}
                  />
                </div>
              </div>
            )
          })()}
        </div>
      )}

      {action.reasoning && <ReasoningBlock text={action.reasoning} />}

      {action.error && (
        <div className="mt-2 text-xs text-red-400">
          ❌ {action.error}
        </div>
      )}
    </div>
  )
}

// 折叠块按钮 — 透明 emerald 边框风格
function CollapseButton({
  icon,
  label,
  expanded,
  onToggle,
  onCopy,
  onDownload,
}: {
  icon: string
  label: string
  expanded: boolean
  onToggle: () => void
  onCopy?: () => void
  onDownload?: () => void
}) {
  return (
    <button
      onClick={onToggle}
      className="flex items-center justify-between w-full py-2 bg-transparent hover:bg-white/5 transition-colors text-left rounded"
    >
      <div className="flex items-center gap-2">
        {expanded ? (
          <ChevronDown className="w-3.5 h-3.5 text-nofx-text-muted" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-nofx-text-muted" />
        )}
        <span className="text-base">{icon}</span>
        <span className="text-sm font-medium text-nofx-text">{label}</span>
      </div>
      <div className="flex items-center gap-1">
        {onCopy && (
          <span
            role="button"
            onClick={(e) => {
              e.stopPropagation()
              onCopy()
            }}
            className="p-1 rounded hover:bg-white/10 text-nofx-text-muted hover:text-emerald-400 transition-colors"
            title="Copy"
          >
            <Copy className="w-3 h-3" />
          </span>
        )}
        {onDownload && (
          <span
            role="button"
            onClick={(e) => {
              e.stopPropagation()
              onDownload()
            }}
            className="p-1 rounded hover:bg-white/10 text-nofx-text-muted hover:text-emerald-400 transition-colors"
            title="Download"
          >
            <Download className="w-3 h-3" />
          </span>
        )}
      </div>
    </button>
  )
}

export function DecisionCard({ decision, language, onSymbolClick }: DecisionCardProps) {
  const [showSystemPrompt, setShowSystemPrompt] = useState(false)
  const [showInputPrompt, setShowInputPrompt] = useState(false)
  const [showCoT, setShowCoT] = useState(false)

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const downloadAsFile = (text: string, filename: string) => {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const preCls =
    'mt-2 text-xs font-mono whitespace-pre-wrap max-h-96 overflow-y-auto bg-transparent text-nofx-text-main'

  return (
    <div className="py-4 fade-divider-b">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-base">🤖</span>
          <div>
            <div className="text-sm font-medium text-nofx-text-main">
              {t('cycle', language)} #{decision.cycle_number}
            </div>
            <div className="text-[10px] text-nofx-text-muted">
              {new Date(decision.timestamp).toLocaleString()}
            </div>
          </div>
        </div>
        <span
          className="px-2 py-0.5 rounded-full text-[10px] font-medium tracking-wider"
          style={
            decision.success
              ? { color: '#10B981', border: '1px solid rgba(16, 185, 129, 0.4)' }
              : { color: '#F6465D', border: '1px solid rgba(246, 70, 93, 0.4)' }
          }
        >
          {t(decision.success ? 'success' : 'failed', language)}
        </span>
      </div>

      {/* Decision Actions */}
      {decision.decisions && decision.decisions.length > 0 && (
        <div className="divide-y divide-white/5">
          {decision.decisions.map((action, index) => (
            <ActionCard
              key={`${action.symbol}-${index}`}
              action={action}
              language={language}
              onSymbolClick={onSymbolClick}
            />
          ))}
        </div>
      )}

      {/* Collapsible Sections */}
      <div className="mt-2">
        {decision.system_prompt && (
          <div>
            <CollapseButton
              icon="⚙️"
              label="System Prompt"
              expanded={showSystemPrompt}
              onToggle={() => setShowSystemPrompt(!showSystemPrompt)}
              onCopy={() => copyToClipboard(decision.system_prompt)}
              onDownload={() =>
                downloadAsFile(decision.system_prompt, `system-prompt-cycle-${decision.cycle_number}.txt`)
              }
            />
            {showSystemPrompt && <pre className={preCls}>{decision.system_prompt}</pre>}
          </div>
        )}

        {decision.input_prompt && (
          <div>
            <CollapseButton
              icon="📥"
              label="User Prompt"
              expanded={showInputPrompt}
              onToggle={() => setShowInputPrompt(!showInputPrompt)}
              onCopy={() => copyToClipboard(decision.input_prompt)}
              onDownload={() =>
                downloadAsFile(decision.input_prompt, `user-prompt-cycle-${decision.cycle_number}.txt`)
              }
            />
            {showInputPrompt && <pre className={preCls}>{decision.input_prompt}</pre>}
          </div>
        )}

        {decision.cot_trace && (
          <div>
            <CollapseButton
              icon="🧠"
              label={t('aiThinking', language)}
              expanded={showCoT}
              onToggle={() => setShowCoT(!showCoT)}
            />
            {showCoT && <pre className={preCls}>{decision.cot_trace}</pre>}
          </div>
        )}
      </div>

      {/* Execution Log */}
      {decision.execution_log && decision.execution_log.length > 0 && (
        <div className="mt-3 text-[11px] font-mono space-y-0.5 text-nofx-text-muted">
          {decision.execution_log.map((log, index) => (
            <div key={`${log}-${index}`}>{log}</div>
          ))}
        </div>
      )}

      {/* Error Message */}
      {decision.error_message && (
        <div className="mt-3 text-xs text-red-400">❌ {decision.error_message}</div>
      )}
    </div>
  )
}
