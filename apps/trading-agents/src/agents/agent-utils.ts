/**
 * Agent 共享工具函数
 * 对应 Python TradingAgents 中的辅助逻辑
 */

import { getConfig } from '../dataflows/config.js';

/**
 * 获取输出语言指令
 * 若语言为 English，返回空字符串（不需要额外指令）
 * 否则返回要求以该语言输出的指令
 */
export function getLanguageInstruction(): string {
  const lang = getConfig().output_language || 'English';
  if (lang.toLowerCase() === 'english') return '';
  return ` Write your entire response in ${lang}.`;
}

/**
 * 构建交易标的上下文说明
 * 提醒 LLM 在所有工具调用和报告中使用完整 ticker，包含交易所后缀
 */
export function buildInstrumentContext(ticker: string): string {
  return `The instrument to analyze is \`${ticker}\`. Use this exact ticker in every tool call, report, and recommendation, preserving any exchange suffix (e.g. \`.TO\`, \`.L\`, \`.HK\`, \`.T\`).`;
}
