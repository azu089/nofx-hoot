/**
 * 条件路由逻辑 - 1:1 对应 Python conditional_logic.py
 * 决定图的流转方向（辩论循环、分析师工具调用等）
 */

import type { AgentState } from '../types/state.js';

export class ConditionalLogic {
  private maxDebateRounds: number;
  private maxRiskDiscussRounds: number;

  constructor(maxDebateRounds = 1, maxRiskDiscussRounds = 1) {
    this.maxDebateRounds = maxDebateRounds;
    this.maxRiskDiscussRounds = maxRiskDiscussRounds;
  }

  /**
   * 投研辩论路由：Bull ↔ Bear 轮替，达到 max rounds 后进入 Research Manager
   */
  shouldContinueDebate(state: AgentState): string {
    const debateState = state.investment_debate_state;
    // 2 agents per round
    if (debateState.count >= 2 * this.maxDebateRounds) {
      return 'Research Manager';
    }
    if (debateState.current_response.startsWith('Bull')) {
      return 'Bear Researcher';
    }
    return 'Bull Researcher';
  }

  /**
   * 风控辩论路由：Aggressive → Conservative → Neutral 轮替
   */
  shouldContinueRiskAnalysis(state: AgentState): string {
    const riskState = state.risk_debate_state;
    // 3 agents per round
    if (riskState.count >= 3 * this.maxRiskDiscussRounds) {
      return 'Portfolio Manager';
    }
    if (riskState.latest_speaker.startsWith('Aggressive')) {
      return 'Conservative Analyst';
    }
    if (riskState.latest_speaker.startsWith('Conservative')) {
      return 'Neutral Analyst';
    }
    return 'Aggressive Analyst';
  }
}
