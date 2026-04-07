/**
 * 状态初始化 - 1:1 对应 Python propagation.py
 */

import type { AgentState, InvestDebateState, RiskDebateState } from '../types/state.js';

export class Propagator {
  private maxRecurLimit: number;

  constructor(maxRecurLimit = 100) {
    this.maxRecurLimit = maxRecurLimit;
  }

  /**
   * 创建初始 AgentState
   */
  createInitialState(companyName: string, tradeDate: string): AgentState {
    const investDebateState: InvestDebateState = {
      bull_history: '',
      bear_history: '',
      history: '',
      current_response: '',
      judge_decision: '',
      count: 0,
    };

    const riskDebateState: RiskDebateState = {
      aggressive_history: '',
      conservative_history: '',
      neutral_history: '',
      history: '',
      latest_speaker: '',
      current_aggressive_response: '',
      current_conservative_response: '',
      current_neutral_response: '',
      judge_decision: '',
      count: 0,
    };

    return {
      messages: [{ role: 'human', content: companyName }],
      company_of_interest: companyName,
      trade_date: String(tradeDate),
      sender: '',
      market_report: '',
      sentiment_report: '',
      news_report: '',
      fundamentals_report: '',
      investment_debate_state: investDebateState,
      investment_plan: '',
      trader_investment_plan: '',
      risk_debate_state: riskDebateState,
      final_trade_decision: '',
    };
  }

  getGraphConfig(): { recursion_limit: number } {
    return { recursion_limit: this.maxRecurLimit };
  }
}
