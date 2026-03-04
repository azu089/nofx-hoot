/**
 * Debate Arena 前端常量 (Phase 8.2)
 *
 * 角色配色、模型显示名、行动配色、成本估算
 */

// 投资辩论角色配色
export const PERSONALITY_COLORS: Record<string, string> = {
  bull: '#22C55E',
  bear: '#EF4444',
  analyst: '#3B82F6',
  contrarian: '#F59E0B',
  risk_manager: '#8B5CF6',
};

// 风控辩论角色配色
export const RISK_ROLE_COLORS: Record<string, string> = {
  aggressive: '#EF4444',
  conservative: '#3B82F6',
  neutral: '#94A3B8',
  judge: '#F59E0B',
};

// 模型显示名 (镜像后端 AI_MODELS)
export const MODEL_DISPLAY: Record<string, { name: string; provider: string; color: string; logo: string }> = {
  'deepseek-chat': { name: 'DeepSeek Chat', provider: 'DeepSeek', color: '#3B82F6', logo: '/icons/llm/deepseek.png' },
  'deepseek-reasoner': { name: 'DeepSeek R1', provider: 'DeepSeek', color: '#1D4ED8', logo: '/icons/llm/deepseek.png' },
  'gpt-4o-mini': { name: 'GPT-4o Mini', provider: 'OpenAI', color: '#10B981', logo: '/icons/llm/openai.png' },
  'claude-haiku-4-5-20251001': { name: 'Claude Haiku 4.5', provider: 'Anthropic', color: '#D97706', logo: '/icons/llm/anthropic.png' },
  'gemini-2.5-flash': { name: 'Gemini 2.5 Flash', provider: 'Google', color: '#6366F1', logo: '/icons/llm/google.png' },
  'qwen3.5-plus': { name: 'Qwen 3.5 Plus', provider: 'Alibaba', color: '#EC4899', logo: '/icons/llm/alibaba.png' },
  'grok-4-fast': { name: 'Grok 4 Fast', provider: 'xAI', color: '#F43F5E', logo: '/icons/llm/xai.png' },
  'kimi-k2.5': { name: 'Kimi K2.5', provider: 'Moonshot', color: '#8B5CF6', logo: '/icons/llm/moonshot.png' },
};

// 默认 Debate 模型列表
export const DEFAULT_DEBATE_MODELS = [
  'deepseek-chat',
  'gpt-4o-mini',
  'claude-haiku-4-5-20251001',
];

// 成本估算 (USD/次分析)
export const MODEL_COST_ESTIMATE: Record<string, number> = {
  'deepseek-chat': 0.002,
  'gpt-4o-mini': 0.003,
  'claude-haiku-4-5-20251001': 0.005,
  'gemini-2.5-flash': 0.003,
  'qwen3.5-plus': 0.003,
  'grok-4-fast': 0.001,
  'kimi-k2.5': 0.003,
};

// 角色 Emoji 映射
export const PERSONALITY_EMOJIS: Record<string, string> = {
  bull: '\u{1F402}',
  bear: '\u{1F43B}',
  analyst: '\u{1F4CA}',
  contrarian: '\u{1F504}',
  risk_manager: '\u{1F6E1}\uFE0F',
};

// Action 配色+标签
export const ACTION_CONFIG: Record<string, {
  color: string;
  bg: string;
  icon: string;
  label: string;
}> = {
  open_long:   { color: '#10B981', bg: 'rgba(16,185,129,0.15)',  icon: '\u{1F4C8}', label: '做多'  },
  open_short:  { color: '#F43F5E', bg: 'rgba(244,63,94,0.15)',   icon: '\u{1F4C9}', label: '做空' },
  close_long:  { color: '#EAB308', bg: 'rgba(234,179,8,0.15)',   icon: '\u{1F4B0}', label: '平仓' },
  close_short: { color: '#EAB308', bg: 'rgba(234,179,8,0.15)',   icon: '\u{1F4B0}', label: '平仓' },
  hold:        { color: '#94A3B8', bg: 'rgba(148,163,184,0.15)', icon: '\u23F8\uFE0F', label: '持有'  },
  wait:        { color: '#606070', bg: 'rgba(96,96,112,0.15)',   icon: '\u231B',    label: '等待'  },
};

// 风险等级配色
export const RISK_RATING_COLORS: Record<string, string> = {
  LOW: '#22C55E',
  MEDIUM: '#F59E0B',
  HIGH: '#EF4444',
  EXTREME: '#DC2626',
};

// 估算总成本 (USD) — 2阶段
export function estimateDebateCost(modelCount: number): {
  investDebate: number;
  riskDebate: number;
  consensus: number;
  total: number;
} {
  // 深研模式: 5角色 × 3轮 = 15 次 + 投票 5 次 = 20 次 LLM 调用
  const investDebate = 20 * 0.002;
  const riskDebate = 0; // 无独立风控阶段
  const consensus = 0;  // 无独立共识阶段
  const total = investDebate + riskDebate + consensus;
  return { investDebate, riskDebate, consensus, total };
}
