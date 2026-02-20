'use client'

import { MODEL_DISPLAY } from '@/constants/debate'

// 关键字 → 首字母 + 颜色 fallback (当 MODEL_DISPLAY 无精确匹配时)
const PROVIDER_FALLBACK: Record<string, { bg: string; letter: string }> = {
  claude:   { bg: '#D97706', letter: 'C' },
  deepseek: { bg: '#3B82F6', letter: 'D' },
  openai:   { bg: '#10B981', letter: 'O' },
  gpt:      { bg: '#10B981', letter: 'O' },
  gemini:   { bg: '#6366F1', letter: 'G' },
  grok:     { bg: '#F43F5E', letter: 'X' },
  qwen:     { bg: '#EC4899', letter: 'Q' },
  kimi:     { bg: '#8B5CF6', letter: 'K' },
  moonshot: { bg: '#8B5CF6', letter: 'K' },
}

export function AIAvatar({ modelId, size = 24 }: { modelId: string; size?: number }) {
  // 1. 精确匹配 MODEL_DISPLAY
  const display = MODEL_DISPLAY[modelId]
  if (display) {
    return (
      <div
        className="rounded-md flex items-center justify-center font-bold text-white flex-shrink-0"
        style={{ width: size, height: size, fontSize: size * 0.45, backgroundColor: display.color }}
      >
        {display.name[0]}
      </div>
    )
  }
  // 2. 关键字 fallback
  const lower = modelId.toLowerCase()
  const match = Object.entries(PROVIDER_FALLBACK).find(([k]) => lower.includes(k))?.[1]
    || { bg: '#606070', letter: modelId[0]?.toUpperCase() || '?' }
  return (
    <div
      className="rounded-md flex items-center justify-center font-bold text-white flex-shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.45, backgroundColor: match.bg }}
    >
      {match.letter}
    </div>
  )
}
