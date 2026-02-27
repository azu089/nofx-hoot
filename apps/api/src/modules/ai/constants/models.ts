/**
 * AI 共享常量 — 角色、动作、模型配置、输出格式
 *
 * 产品A (Research) 和产品B (Trading) 都使用这些基础定义。
 */

import { getLanguageName } from './locale-instructions';

// ==================== 角色定义 ====================

export const AI_ROLES = {
  BULL: 'bull',
  BEAR: 'bear',
  ANALYST: 'analyst',
  CONTRARIAN: 'contrarian',
  RISK_MANAGER: 'risk_manager',
} as const;

export type AIRole = (typeof AI_ROLES)[keyof typeof AI_ROLES];

// ==================== 6-Action 类型 ====================

export const AI_ACTIONS = {
  OPEN_LONG: 'open_long',
  OPEN_SHORT: 'open_short',
  CLOSE_LONG: 'close_long',
  CLOSE_SHORT: 'close_short',
  HOLD: 'hold',
  WAIT: 'wait',
} as const;

export type AIAction = (typeof AI_ACTIONS)[keyof typeof AI_ACTIONS];

// ==================== 模型配置 ====================

export interface AIModelConfig {
  name: string;
  baseUrl: string;
  displayName: string;
  provider: string;
  contextWindow?: number;
}

export const AI_MODELS: Record<string, AIModelConfig> = {
  DEEPSEEK: {
    name: 'deepseek-chat',
    baseUrl: 'https://api.deepseek.com/v1',
    displayName: 'DeepSeek Chat',
    provider: 'DeepSeek',
    contextWindow: 64000,
  },
  GPT4O_MINI: {
    name: 'gpt-4o-mini',
    baseUrl: 'https://api.openai.com/v1',
    displayName: 'GPT-4o Mini',
    provider: 'OpenAI',
    contextWindow: 128000,
  },
  CLAUDE_HAIKU: {
    name: 'claude-haiku-4-5-20251001',
    baseUrl: 'https://openrouter.ai/api/v1',
    displayName: 'Claude Haiku 4.5',
    provider: 'Anthropic',
    contextWindow: 200000,
  },
  GEMINI_FLASH: {
    name: 'gemini-3-flash-preview',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    displayName: 'Gemini 3 Flash',
    provider: 'Google',
    contextWindow: 1000000,
  },
  QWEN_PLUS: {
    name: 'qwen3.5-plus',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    displayName: 'Qwen 3.5 Plus',
    provider: 'Alibaba',
    contextWindow: 131072,
  },
  GROK_3: {
    name: 'grok-4-fast',
    baseUrl: 'https://api.x.ai/v1',
    displayName: 'Grok 4 Fast',
    provider: 'xAI',
    contextWindow: 2000000,
  },
  KIMI_V1: {
    name: 'kimi-k2.5',
    baseUrl: 'https://api.moonshot.ai/v1',
    displayName: 'Kimi K2.5',
    provider: 'Moonshot',
    contextWindow: 131072,
  },
};

// ==================== 结构化输出格式 (6-Action) ====================

/**
 * 构建结构化输出格式提示（支持动态语言）
 * @param locale 用户 locale，默认 'zh-CN'
 */
export function buildAnalysisOutputFormat(locale?: string): string {
  // 动态语言提示
  const langHint = locale === 'en' ? '' : (() => {
    const lang = getLanguageName(locale || 'zh-CN');
    return ` (in ${lang.english}/${lang.native})`;
  })();

  return `
You MUST respond ONLY with a valid JSON object following this exact schema:

{
  "action": "open_long" | "open_short" | "close_long" | "close_short" | "hold" | "wait",
  "confidence": 0-100 (integer),
  "reasoning": "Your detailed analysis (150-400 words)",
  "keyPoints": [
    "Key point 1",
    "Key point 2",
    "Key point 3"
  ],
  "entryPrice": number | null,
  "targetPrice": number | null,
  "stopLoss": number | null,
  "timeframe": "1h" | "4h" | "1d" | "1w",
  "vote": "open_long" | "open_short" | "close_long" | "close_short" | "hold" | "wait"
}

Action definitions:
- open_long:  Open a new LONG position (buy to go long)
- open_short: Open a new SHORT position (sell to go short)
- close_long: Close an existing LONG position (take profit or stop loss on longs)
- close_short: Close an existing SHORT position (take profit or stop loss on shorts)
- hold: Keep current positions unchanged, no new action needed
- wait: Not enough data or clarity to make a decision, wait for better setup

Rules:
- action: Your recommended action from the 6 options above
- confidence: How confident you are in this action (0-100)
- reasoning: Detailed explanation${langHint} (150-400 words), referencing specific indicators and price levels
- keyPoints: 3-5 bullet points summarizing your analysis${langHint}
- entryPrice: Recommended entry price for open actions, null for close/hold/wait
- targetPrice: Price target for open actions, null for close/hold/wait
- stopLoss: Stop loss level for open actions, null for close/hold/wait
- timeframe: Recommended timeframe for this trade
- vote: Your final vote (must match action)

DO NOT include any text outside the JSON object.
`;
}

/** 默认输出格式（向后兼容，使用 zh-CN） */
export const ANALYSIS_OUTPUT_FORMAT = buildAnalysisOutputFormat('zh-CN');
