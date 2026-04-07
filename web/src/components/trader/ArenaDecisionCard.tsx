'use client'
import { useState } from 'react'
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Scale,
  Copy,
  Download,
} from 'lucide-react'
import type { ArenaDecisionRecord } from '../../types/strategy'
import { t, type Language } from '../../i18n/translations'

// ── i18n (Arena 独有 key，DecisionCard 公共 key 直接用 t()) ─────────────────

const ARENA_I18N: Record<string, Record<string, string>> = {
  zh: {
    entry: '入场价',
    stopLoss: '止损',
    takeProfit: '止盈',
    leverage: '杠杆',
    riskReward: '风险回报比',
    finalDecision: '最终决策',
    cotTitle: 'AI 思维链分析',
    rejected: '未执行',
    executed: '已执行',
    agentRoles: JSON.stringify({
      MarketAnalyst: '📊 市场分析师',
      SocialAnalyst: '💬 社交情绪分析师',
      NewsAnalyst: '📰 新闻分析师',
      FundamentalsAnalyst: '📈 基本面分析师',
      BullResearcher: '🐂 多方研究员',
      BearResearcher: '🐻 空方研究员',
      ResearchManager: '⚖️ 研究经理',
      Trader: '🎯 交易员',
      AggressiveDebater: '🔥 激进风控',
      ConservativeDebater: '🛡 保守风控',
      NeutralDebater: '⚪ 中立风控',
      PortfolioManager: '👔 投资组合经理',
      SignalExtractor: '🏷 信号提取器',
    }),
  },
  en: {
    entry: 'Entry',
    stopLoss: 'Stop Loss',
    takeProfit: 'Take Profit',
    leverage: 'Leverage',
    riskReward: 'Risk/Reward',
    finalDecision: 'Final Decision',
    cotTitle: 'AI Chain of Thought',
    rejected: 'Not executed',
    executed: 'Executed',
    agentRoles: JSON.stringify({
      MarketAnalyst: '📊 Market Analyst',
      SocialAnalyst: '💬 Social Analyst',
      NewsAnalyst: '📰 News Analyst',
      FundamentalsAnalyst: '📈 Fundamentals Analyst',
      BullResearcher: '🐂 Bull Researcher',
      BearResearcher: '🐻 Bear Researcher',
      ResearchManager: '⚖️ Research Manager',
      Trader: '🎯 Trader',
      AggressiveDebater: '🔥 Aggressive Debater',
      ConservativeDebater: '🛡 Conservative Debater',
      NeutralDebater: '⚪ Neutral Debater',
      PortfolioManager: '👔 Portfolio Manager',
      SignalExtractor: '🏷 Signal Extractor',
    }),
  },
}

function ax(lang: string, key: string): string {
  return (ARENA_I18N[lang] ?? ARENA_I18N.zh)[key] ?? key
}

// 固定角色顺序
const AGENT_ORDER = [
  'MarketAnalyst',
  'SocialAnalyst',
  'NewsAnalyst',
  'FundamentalsAnalyst',
  'BullResearcher',
  'BearResearcher',
  'ResearchManager',
  'Trader',
  'AggressiveDebater',
  'ConservativeDebater',
  'NeutralDebater',
  'PortfolioManager',
  'SignalExtractor',
]

// ── helpers ────────────────────────────────────────────────────────────────

export const SIGNAL_CONFIG: Record<
  string,
  { color: string; bg: string; border: string; icon: React.ReactNode }
> = {
  BUY: {
    color: '#22C55E',
    bg: 'rgba(34, 197, 94,0.15)',
    border: 'rgba(34, 197, 94,0.4)',
    icon: <TrendingUp className="w-3 h-3" />,
  },
  OVERWEIGHT: {
    color: '#22C55E',
    bg: 'rgba(34, 197, 94,0.12)',
    border: 'rgba(34, 197, 94,0.35)',
    icon: <TrendingUp className="w-3 h-3" />,
  },
  HOLD: {
    color: '#848E9C',
    bg: 'rgba(132,142,156,0.15)',
    border: 'rgba(132,142,156,0.4)',
    icon: <Minus className="w-3 h-3" />,
  },
  UNDERWEIGHT: {
    color: '#6366F1',
    bg: 'rgba(99, 102, 241,0.12)',
    border: 'rgba(99, 102, 241,0.35)',
    icon: <TrendingDown className="w-3 h-3" />,
  },
  SELL: {
    color: '#EF4444',
    bg: 'rgba(239, 68, 68,0.15)',
    border: 'rgba(239, 68, 68,0.4)',
    icon: <TrendingDown className="w-3 h-3" />,
  },
}

export function getSignalCfg(signal: string) {
  return SIGNAL_CONFIG[signal?.toUpperCase()] ?? SIGNAL_CONFIG.HOLD
}

export function formatPrice(price: number | undefined): string {
  if (!price || price === 0) return '-'
  if (price >= 1000) return price.toFixed(2)
  if (price >= 1) return price.toFixed(4)
  return price.toFixed(6)
}

export function calcPctChange(
  entry: number | undefined,
  target: number | undefined,
  isLong: boolean,
): string {
  if (!entry || !target || entry === 0) return '-'
  const pct = ((target - entry) / entry) * 100
  const adjustedPct = isLong ? pct : -pct
  return `${adjustedPct >= 0 ? '+' : ''}${adjustedPct.toFixed(2)}%`
}

export function getConfidenceColor(confidence: number | undefined): string {
  if (!confidence) return '#848E9C'
  if (confidence >= 80) return '#22C55E'
  if (confidence >= 60) return '#6366F1'
  return '#EF4444'
}

export function isOpenSignal(signal: string): boolean {
  const s = signal?.toUpperCase()
  return s === 'BUY' || s === 'OVERWEIGHT' || s === 'SELL' || s === 'UNDERWEIGHT'
}

export function isLongSignal(signal: string): boolean {
  const s = signal?.toUpperCase()
  return s === 'BUY' || s === 'OVERWEIGHT'
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text)
  } catch (err) {
    console.error('copy failed', err)
  }
}

function downloadAsFile(text: string, filename: string) {
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

/**
 * 把 cot_trace 字符串按 "=== <AgentName> ===" 分隔切分为角色片段数组
 * 保持 AGENT_ORDER 顺序，跳过没有内容的角色
 */
export function parseCoTTrace(
  cotTrace: string,
): Array<{ agent: string; content: string }> {
  if (!cotTrace) return []

  // 切分：每个 === <Name> === 段
  const segments: Record<string, string> = {}
  const pattern = /===\s*([^\n=]+?)\s*===\n?([\s\S]*?)(?====\s*[^\n=]+?\s*===|$)/g
  let match: RegExpExecArray | null
  while ((match = pattern.exec(cotTrace)) !== null) {
    const agentName = match[1].trim()
    const content = match[2].trim()
    if (content) segments[agentName] = content
  }

  // 按固定顺序输出
  const result: Array<{ agent: string; content: string }> = []
  for (const agent of AGENT_ORDER) {
    if (segments[agent]) {
      result.push({ agent, content: segments[agent] })
    }
  }

  // 收录未在固定列表中但存在于 trace 的角色（兜底）
  for (const [agent, content] of Object.entries(segments)) {
    if (!AGENT_ORDER.includes(agent)) {
      result.push({ agent, content })
    }
  }

  return result
}

// ── Sub-components ─────────────────────────────────────────────────────────

export function SignalBadge({ signal }: { signal: string }) {
  const cfg = getSignalCfg(signal)
  return (
    <span
      className="inline-flex items-center gap-1 font-bold uppercase tracking-wider rounded-full px-3 py-1 text-xs"
      style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}` }}
    >
      {cfg.icon}
      {signal}
    </span>
  )
}

export function ConfidencePill({ value }: { value: number }) {
  const color = getConfidenceColor(value)
  return (
    <div
      className="px-2 py-1 rounded text-xs font-semibold"
      style={{ background: `${color}22`, color }}
    >
      {value.toFixed(0)}%
    </div>
  )
}

/** 与 nofx DecisionCard 折叠行完全一致的样式 — 含左侧图标+标题、右侧复制/下载/展开三按钮 */
function PromptRow({
  icon,
  title,
  color,
  content,
  filename,
  cycleNumber,
}: {
  icon: string
  title: string
  color: string
  content: string
  filename: string
  cycleNumber?: number
}) {
  const [open, setOpen] = useState(false)

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 text-sm transition-colors w-full justify-between p-2 rounded hover:bg-white/5"
      >
        <div className="flex items-center gap-2">
          <span className="text-base">{icon}</span>
          <span className="font-semibold" style={{ color }}>
            {title}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              copyToClipboard(content)
            }}
            className="text-xs px-2.5 py-1 rounded hover:opacity-80 transition-opacity flex items-center gap-1"
            style={{
              background: `${color}33`,
              color,
              border: `1px solid ${color}55`,
            }}
            title="Copy to clipboard"
          >
            <Copy className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              downloadAsFile(
                content,
                filename.includes('{cycle}')
                  ? filename.replace('{cycle}', String(cycleNumber ?? 0))
                  : filename,
              )
            }}
            className="text-xs px-2.5 py-1 rounded hover:opacity-80 transition-opacity flex items-center gap-1"
            style={{
              background: `${color}33`,
              color,
              border: `1px solid ${color}55`,
            }}
            title="Download as file"
          >
            <Download className="w-3 h-3" />
          </button>
          <span
            className="text-xs px-2 py-0.5 rounded"
            style={{ background: `${color}26`, color }}
          >
            {open ? '▼ 收起' : '▶ 展开'}
          </span>
        </div>
      </button>
      {open && (
        <div
          className="mt-2 rounded-lg p-4 text-sm font-mono whitespace-pre-wrap max-h-96 overflow-y-auto"
          style={{
            background: '#0A0A1A',
            border: '1px solid #2B3139',
            color: '#EAECEF',
          }}
        >
          {content}
        </div>
      )}
    </div>
  )
}

/** 单个 Agent 折叠行（用于 CoT 展开后每个角色的子折叠） */
function AgentRow({ displayName, content }: { displayName: string; content: string }) {
  const [open, setOpen] = useState(false)

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 text-xs transition-colors w-full justify-between p-2 rounded hover:bg-white/5"
      >
        <span className="font-semibold" style={{ color: '#94A3B8' }}>
          {displayName}
        </span>
        <span
          className="text-xs px-2 py-0.5 rounded"
          style={{ background: 'rgba(99, 102, 241,0.15)', color: '#6366F1' }}
        >
          {open ? '▼ 收起' : '▶ 展开'}
        </span>
      </button>
      {open && (
        <div
          className="mt-1 rounded-lg p-3 text-xs font-mono whitespace-pre-wrap max-h-60 overflow-y-auto ml-2"
          style={{
            background: '#0A0A1A',
            border: '1px solid #2B3139',
            color: '#EAECEF',
          }}
        >
          {content}
        </div>
      )}
    </div>
  )
}

/** CoT 总折叠行 — 标题含角色数，展开后列出所有子角色折叠 */
function CoTSection({
  lang,
  cotTrace,
  agentRoles,
}: {
  lang: string
  cotTrace: string
  agentRoles: Record<string, string>
}) {
  const [open, setOpen] = useState(false)
  const agents = parseCoTTrace(cotTrace)
  const count = agents.length
  const title = `${ax(lang, 'cotTitle')} (${count} 角色)`

  return (
    <div>
      {/* 外层折叠 header — 样式对齐 DecisionCard aiThinking 行 */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 text-sm transition-colors w-full justify-between p-2 rounded hover:bg-white/5"
      >
        <div className="flex items-center gap-2">
          <span className="text-base">🧠</span>
          <span className="font-semibold" style={{ color: '#6366F1' }}>
            {title}
          </span>
        </div>
        <span
          className="text-xs px-2 py-0.5 rounded"
          style={{ background: 'rgba(99, 102, 241,0.15)', color: '#6366F1' }}
        >
          {open ? '▼ 收起' : '▶ 展开'}
        </span>
      </button>

      {open && (
        <div
          className="mt-2 rounded-lg p-3 space-y-1"
          style={{
            background: '#0A0A1A',
            border: '1px solid #2B3139',
          }}
        >
          {agents.map(({ agent, content }) => {
            const displayName = agentRoles[agent] ?? agent
            return (
              <AgentRow key={agent} displayName={displayName} content={content} />
            )
          })}
          {count === 0 && (
            <div className="text-xs font-mono whitespace-pre-wrap" style={{ color: '#EAECEF' }}>
              {cotTrace}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── ArenaDecisionCard ──────────────────────────────────────────────────────

export function ArenaDecisionCard({
  record,
  language,
}: {
  record: ArenaDecisionRecord
  language: string
}) {
  const lang = language?.startsWith('zh') ? 'zh' : 'en'
  // language prop 可能是 'zh-CN', 'en' 等格式，t() 需要 Language 类型
  const tLang = (lang === 'zh' ? 'zh' : 'en') as Language

  const isOpen = isOpenSignal(record.signal)
  const isLong = isLongSignal(record.signal)
  const hasEntry = isOpen && (record.entry_price ?? 0) > 0
  const rrr = record.risk_reward_ratio ?? 0

  // 解析角色显示名
  const agentRoles: Record<string, string> = JSON.parse(ax(lang, 'agentRoles'))

  return (
    <div
      className="rounded-xl p-5 transition-all duration-300 hover:translate-y-[-2px]"
      style={{
        border: '1px solid #2B3139',
        background: 'linear-gradient(180deg, #12122A 0%, #12122A 100%)',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
      }}
    >
      {/* ── 头部：完全对齐 DecisionCard ── */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ background: 'rgba(99, 102, 241, 0.15)' }}
          >
            <span className="text-xl">🤖</span>
          </div>
          <div>
            <div className="font-bold" style={{ color: '#EAECEF' }}>
              {t('cycle', tLang)} #{record.cycle_number ?? '-'}
            </div>
            <div className="text-xs" style={{ color: '#848E9C' }}>
              {new Date(record.created_at).toLocaleString()}
            </div>
          </div>
        </div>
        {/* 成功/失败 徽章 — 对齐 DecisionCard */}
        <div
          className="px-4 py-1.5 rounded-full text-xs font-bold tracking-wider"
          style={
            record.action_executed
              ? {
                  background: 'rgba(34, 197, 94, 0.15)',
                  color: '#22C55E',
                  border: '1px solid rgba(34, 197, 94, 0.3)',
                }
              : {
                  background: 'rgba(239, 68, 68, 0.15)',
                  color: '#EF4444',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                }
          }
        >
          {t(record.action_executed ? 'success' : 'failed', tLang)}
        </div>
      </div>

      {/* ── Arena 独有内容区 ── */}

      {/* 信号徽章 + 信心 + 币种 */}
      <div
        className="flex items-center gap-2 flex-wrap mb-3 pb-3"
        style={{ borderTop: '1px solid #2B3139', paddingTop: '12px' }}
      >
        <span className="font-mono font-bold text-base" style={{ color: '#EAECEF' }}>
          {record.symbol.replace('USDT', '')}
        </span>
        <SignalBadge signal={record.signal} />
        <ConfidencePill value={record.confidence ?? 0} />
      </div>

      {/* 4 列交易细节 */}
      {hasEntry && (
        <div
          className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3 pb-3"
          style={{ borderBottom: '1px solid #2B3139' }}
        >
          <div className="text-center">
            <div className="text-xs mb-1" style={{ color: '#94A3B8' }}>
              {ax(lang, 'entry')}
            </div>
            <div className="font-mono font-semibold text-xs" style={{ color: '#EAECEF' }}>
              {formatPrice(record.entry_price)}
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs mb-1" style={{ color: '#EF4444' }}>
              {ax(lang, 'stopLoss')}
            </div>
            <div className="font-mono font-semibold text-xs" style={{ color: '#EF4444' }}>
              {formatPrice(record.stop_loss)}
            </div>
            {record.stop_loss && record.entry_price && (
              <div className="text-xs mt-0.5" style={{ color: '#64748B' }}>
                {calcPctChange(record.entry_price, record.stop_loss, isLong)}
              </div>
            )}
          </div>
          <div className="text-center">
            <div className="text-xs mb-1" style={{ color: '#22C55E' }}>
              {ax(lang, 'takeProfit')}
            </div>
            <div className="font-mono font-semibold text-xs" style={{ color: '#22C55E' }}>
              {formatPrice(record.take_profit)}
            </div>
            {record.take_profit && record.entry_price && (
              <div className="text-xs mt-0.5" style={{ color: '#64748B' }}>
                {calcPctChange(record.entry_price, record.take_profit, isLong)}
              </div>
            )}
          </div>
          <div className="text-center">
            <div className="text-xs mb-1" style={{ color: '#94A3B8' }}>
              {ax(lang, 'leverage')}
            </div>
            <div className="font-mono font-semibold text-xs" style={{ color: '#6366F1' }}>
              {record.leverage ?? 0}x
            </div>
          </div>
        </div>
      )}

      {/* 风险回报比 */}
      {rrr > 0 && (
        <div
          className="flex items-center justify-between mb-3 pb-3"
          style={{ borderBottom: '1px solid #2B3139' }}
        >
          <span className="text-xs flex items-center gap-1" style={{ color: '#94A3B8' }}>
            <Scale className="w-3 h-3" />
            {ax(lang, 'riskReward')}
          </span>
          <div className="flex items-center gap-2">
            <div className="flex gap-1 text-xs">
              <span style={{ color: '#EF4444' }}>1</span>
              <span style={{ color: '#94A3B8' }}>:</span>
              <span style={{ color: '#22C55E' }}>{rrr.toFixed(2)}</span>
            </div>
            <div className="h-1.5 rounded-full" style={{ width: '50px', background: '#2B3139' }}>
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.min((rrr / 5) * 100, 100)}%`,
                  background: rrr >= 3 ? '#22C55E' : rrr >= 2 ? '#6366F1' : '#EF4444',
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── 折叠行区（System Prompt / User Prompt / CoT）— 对齐 DecisionCard ── */}
      <div className="space-y-2 mb-4">
        {record.system_prompt && (
          <PromptRow
            icon="⚙️"
            title="System Prompt"
            color="#a78bfa"
            content={record.system_prompt}
            filename={`arena-system-prompt-cycle-{cycle}.txt`}
            cycleNumber={record.cycle_number}
          />
        )}
        {record.user_prompt && (
          <PromptRow
            icon="📥"
            title="User Prompt"
            color="#60a5fa"
            content={record.user_prompt}
            filename={`arena-user-prompt-cycle-{cycle}.txt`}
            cycleNumber={record.cycle_number}
          />
        )}
        {record.cot_trace && (
          <CoTSection lang={lang} cotTrace={record.cot_trace} agentRoles={agentRoles} />
        )}
      </div>

      {/* ── 底部统一黑框：AI call duration + reject/error 信息 — 对齐 DecisionCard execution_log 样式 ── */}
      {((record.ai_call_duration_ms ?? 0) > 0 ||
        (!record.action_executed && record.reject_reason) ||
        record.error_message) && (
        <div
          className="rounded-lg p-3 mt-4 text-xs font-mono space-y-1"
          style={{ background: '#0A0A1A', border: '1px solid #2B3139', color: '#EAECEF' }}
        >
          {(record.ai_call_duration_ms ?? 0) > 0 && (
            <div>AI call duration: {record.ai_call_duration_ms} ms</div>
          )}
          {!record.action_executed && record.reject_reason && (
            <div style={{ color: '#EF4444' }}>
              ✗ {record.symbol} {record.signal} rejected: {record.reject_reason}
            </div>
          )}
          {record.action_executed && (
            <div style={{ color: '#22C55E' }}>
              ✓ {record.symbol} {record.signal} succeeded
            </div>
          )}
          {record.error_message && (
            <div style={{ color: '#EF4444' }}>✗ {record.error_message}</div>
          )}
        </div>
      )}
    </div>
  )
}
