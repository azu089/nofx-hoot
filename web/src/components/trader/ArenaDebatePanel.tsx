'use client'
import { useState, useEffect, useCallback } from 'react'
import {
  RefreshCw,
  Scale,
} from 'lucide-react'
import { api } from '../../lib/api'
import type { ArenaDecisionRecord } from '../../types/strategy'
import { ArenaDecisionCard } from './ArenaDecisionCard'

// ── Types ──────────────────────────────────────────────────────────────────

interface ArenaDebatePanelProps {
  traderId: string
  language: string
}

// ── i18n ───────────────────────────────────────────────────────────────────

const i18n: Record<string, Record<string, string>> = {
  zh: {
    title: 'Arena 辩论决策',
    latest: '最新决策',
    history: '历史决策',
    triggerDebate: '手动触发辩论',
    triggering: '触发中...',
    noSignal: '暂无决策记录',
  },
  en: {
    title: 'Arena Debate Decisions',
    latest: 'Latest Decision',
    history: 'Decision History',
    triggerDebate: 'Trigger Debate',
    triggering: 'Triggering...',
    noSignal: 'No decisions yet',
  },
}

function tx(lang: string, key: string): string {
  return (i18n[lang] ?? i18n.zh)[key] ?? key
}

// ── Main component ─────────────────────────────────────────────────────────

export function ArenaDebatePanel({ traderId, language }: ArenaDebatePanelProps) {
  const lang = language?.startsWith('zh') ? 'zh' : 'en'

  const [records, setRecords] = useState<ArenaDecisionRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [triggering, setTriggering] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const recordsRes = await api.getArenaRecords(traderId, 10)
      setRecords(recordsRes?.records ?? [])
    } catch {
      // 静默失败
    } finally {
      setLoading(false)
    }
  }, [traderId])

  useEffect(() => {
    fetchData()
    const id = setInterval(fetchData, 30_000)
    return () => clearInterval(id)
  }, [fetchData])

  const handleTrigger = async () => {
    if (triggering) return
    setTriggering(true)
    try {
      await api.triggerArenaRun(traderId)
      setTimeout(fetchData, 2000)
    } catch {
      // 静默失败
    }
    setTimeout(() => setTriggering(false), 60_000)
  }

  const latest = records[0]
  const history = records.slice(1)

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: '#12122A', border: '1px solid #2B3139' }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-4"
        style={{ borderBottom: '1px solid #2B3139' }}
      >
        <div className="flex items-center gap-2">
          <Scale className="w-5 h-5" style={{ color: '#6366F1' }} />
          <span className="font-bold text-base" style={{ color: '#EAECEF' }}>
            {tx(lang, 'title')}
          </span>
        </div>
        <button
          type="button"
          onClick={handleTrigger}
          disabled={triggering}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-80 disabled:opacity-50"
          style={{
            background: 'rgba(99, 102, 241,0.15)',
            color: '#6366F1',
            border: '1px solid rgba(99, 102, 241,0.3)',
          }}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${triggering ? 'animate-spin' : ''}`} />
          {triggering ? tx(lang, 'triggering') : tx(lang, 'triggerDebate')}
        </button>
      </div>

      <div className="p-5 space-y-5">
        {loading && records.length === 0 && (
          <div
            className="rounded-lg p-4 animate-pulse"
            style={{ background: '#12122A', height: 200 }}
          />
        )}

        {!loading && records.length === 0 && (
          <div
            className="rounded-lg p-6 text-center text-sm"
            style={{ background: '#12122A', color: '#64748B' }}
          >
            {tx(lang, 'noSignal')}
          </div>
        )}

        {latest && (
          <div>
            <div
              className="text-xs font-semibold mb-3 uppercase tracking-wider"
              style={{ color: '#64748B' }}
            >
              {tx(lang, 'latest')}
            </div>
            <ArenaDecisionCard record={latest} language={language} />
          </div>
        )}

        {history.length > 0 && (
          <div>
            <div
              className="text-xs font-semibold mb-3 uppercase tracking-wider"
              style={{ color: '#64748B' }}
            >
              {tx(lang, 'history')}
            </div>
            <div className="space-y-3">
              {history.map((rec) => (
                <ArenaDecisionCard key={rec.id} record={rec} language={language} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
