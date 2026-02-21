/**
 * Debate Arena 前端常量 (Phase 8.2)
 *
 * 角色配色、模型显示名、阵营配色、成本估算
 */

// 投资辩论角色配色
export const PERSONALITY_COLORS: Record<string, string> = {
  bull: '#22C55E',
  bear: '#EF4444',
  analyst: '#3B82F6',
  contrarian: '#F59E0B',
  risk_manager: '#8B5CF6',
};

// 投资辩论角色标签
export const PERSONALITY_LABELS: Record<string, string> = {
  bull: '多头派',
  bear: '空头派',
  analyst: '分析师',
  contrarian: '逆向派',
  risk_manager: '风控官',
};

// 风控辩论角色配色
export const RISK_ROLE_COLORS: Record<string, string> = {
  aggressive: '#EF4444',
  conservative: '#3B82F6',
  neutral: '#94A3B8',
  judge: '#F59E0B',
};

// 风控辩论角色标签
export const RISK_ROLE_LABELS: Record<string, string> = {
  aggressive: '激进派',
  conservative: '保守派',
  neutral: '中立派',
  judge: '风控法官',
};

// 模型显示名 (镜像后端 AI_MODELS)
export const MODEL_DISPLAY: Record<string, { name: string; provider: string; color: string; logo: string }> = {
  'deepseek-chat': { name: 'DeepSeek Chat', provider: 'DeepSeek', color: '#3B82F6', logo: '/icons/llm/deepseek.png' },
  'gpt-4o-mini': { name: 'GPT-4o Mini', provider: 'OpenAI', color: '#10B981', logo: '/icons/llm/openai.png' },
  'claude-3-5-haiku-20241022': { name: 'Claude 3.5 Haiku', provider: 'Anthropic', color: '#D97706', logo: '/icons/llm/anthropic.png' },
  'gemini-2.0-flash': { name: 'Gemini 2.0 Flash', provider: 'Google', color: '#6366F1', logo: '/icons/llm/google.png' },
  'qwen-plus': { name: 'Qwen Plus', provider: 'Alibaba', color: '#EC4899', logo: '/icons/llm/alibaba.png' },
  'grok-3': { name: 'Grok 3', provider: 'xAI', color: '#F43F5E', logo: '/icons/llm/xai.png' },
  'moonshot-v1-8k': { name: 'Kimi', provider: 'Moonshot', color: '#8B5CF6', logo: '/icons/llm/moonshot.png' },
};

// 阵营配色 (BULLISH/BEARISH/NEUTRAL)
export const CAMP_COLORS: Record<string, string> = {
  BULLISH: '#22C55E',
  BEARISH: '#EF4444',
  NEUTRAL: '#94A3B8',
};

// 阵营标签
export const CAMP_LABELS: Record<string, string> = {
  BULLISH: '看涨',
  BEARISH: '看跌',
  NEUTRAL: '中性',
};

// 默认 Debate 模型列表
export const DEFAULT_DEBATE_MODELS = [
  'deepseek-chat',
  'gpt-4o-mini',
  'claude-3-5-haiku-20241022',
];

// 成本估算 (USD/次分析)
export const MODEL_COST_ESTIMATE: Record<string, number> = {
  'deepseek-chat': 0.002,
  'gpt-4o-mini': 0.003,
  'claude-3-5-haiku-20241022': 0.005,
  'gemini-2.0-flash': 0.002,
  'qwen-plus': 0.002,
  'grok-3': 0.005,
  'moonshot-v1-8k': 0.002,
};

// 角色 Emoji 映射 (对齐 NoFx PERS)
export const PERSONALITY_EMOJIS: Record<string, string> = {
  bull: '\u{1F402}',
  bear: '\u{1F43B}',
  analyst: '\u{1F4CA}',
  contrarian: '\u{1F504}',
  risk_manager: '\u{1F6E1}\uFE0F',
};

// Action 配色+标签 (对齐 NoFx ACT + DecisionCard ACTION_CONFIG)
export const ACTION_CONFIG: Record<string, {
  color: string;
  bg: string;
  icon: string;
  label: string;
  labelZh: string;
}> = {
  open_long:   { color: '#10B981', bg: 'rgba(16,185,129,0.15)',  icon: '\u{1F4C8}', label: 'LONG',  labelZh: '开多' },
  open_short:  { color: '#F43F5E', bg: 'rgba(244,63,94,0.15)',   icon: '\u{1F4C9}', label: 'SHORT', labelZh: '开空' },
  close_long:  { color: '#EAB308', bg: 'rgba(234,179,8,0.15)',   icon: '\u{1F4B0}', label: 'CLOSE', labelZh: '平多' },
  close_short: { color: '#EAB308', bg: 'rgba(234,179,8,0.15)',   icon: '\u{1F4B0}', label: 'CLOSE', labelZh: '平空' },
  hold:        { color: '#94A3B8', bg: 'rgba(148,163,184,0.15)', icon: '\u23F8\uFE0F', label: 'HOLD',  labelZh: '持有' },
  wait:        { color: '#606070', bg: 'rgba(96,96,112,0.15)',   icon: '\u231B',    label: 'WAIT',  labelZh: '等待' },
};

// 风险等级配色
export const RISK_RATING_COLORS: Record<string, string> = {
  LOW: '#22C55E',
  MEDIUM: '#F59E0B',
  HIGH: '#EF4444',
  EXTREME: '#DC2626',
};

// 辩论流水线阶段标签 (Product A: 4阶段 TradingAgents)
export const DEBATE_STAGE_LABELS: Record<string, string> = {
  invest_debate: '投资辩论',
  risk_debate: '风控辩论',
  consensus_vote: '共识投票',
};

// 辩论流水线阶段标签 (Product B: 2阶段 NoFx-aligned)
export const DEBATE_STAGE_LABELS_V2: Record<string, string> = {
  invest_debate: '辩论',
  voting: '投票共识',
};

// 估算总成本 (USD) — NoFx-aligned 2阶段
export function estimateDebateCost(modelCount: number): {
  investDebate: number;
  riskDebate: number;
  consensus: number;
  total: number;
} {
  // NoFx-aligned: 5角色 × 3轮 = 15 次 + 投票 5 次 = 20 次 LLM 调用
  const investDebate = 20 * 0.002;
  const riskDebate = 0; // 无独立风控阶段
  const consensus = 0;  // 无独立共识阶段
  const total = investDebate + riskDebate + consensus;
  return { investDebate, riskDebate, consensus, total };
}
