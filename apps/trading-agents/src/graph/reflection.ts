/**
 * 事后复盘 - 1:1 对应 Python reflection.py
 * 根据实际收益评估决策，更新 5 个 BM25 记忆存储
 */

import type { LlmClient } from '../llm/llm-client.js';
import type { AgentState } from '../types/state.js';
import type { FinancialSituationMemory } from '../agents/memory.js';
import { REFLECTION_SYSTEM_PROMPT } from '../prompts/trader-prompts.js';

export class Reflector {
  private llmClient: LlmClient;
  private modelId: string;

  constructor(llmClient: LlmClient, modelId: string) {
    this.llmClient = llmClient;
    this.modelId = modelId;
  }

  private extractCurrentSituation(state: AgentState): string {
    return `${state.market_report}\n\n${state.sentiment_report}\n\n${state.news_report}\n\n${state.fundamentals_report}`;
  }

  private async reflectOnComponent(
    _componentType: string,
    report: string,
    situation: string,
    returnsLosses: string,
  ): Promise<string> {
    const response = await this.llmClient.chat(
      this.modelId,
      REFLECTION_SYSTEM_PROMPT,
      `Returns: ${returnsLosses}\n\nAnalysis/Decision: ${report}\n\nObjective Market Reports for Reference: ${situation}`,
    );
    return response.content;
  }

  async reflectBullResearcher(state: AgentState, returnsLosses: string, memory: FinancialSituationMemory): Promise<void> {
    const situation = this.extractCurrentSituation(state);
    const result = await this.reflectOnComponent('BULL', state.investment_debate_state.bull_history, situation, returnsLosses);
    memory.addSituations([[situation, result]]);
  }

  async reflectBearResearcher(state: AgentState, returnsLosses: string, memory: FinancialSituationMemory): Promise<void> {
    const situation = this.extractCurrentSituation(state);
    const result = await this.reflectOnComponent('BEAR', state.investment_debate_state.bear_history, situation, returnsLosses);
    memory.addSituations([[situation, result]]);
  }

  async reflectTrader(state: AgentState, returnsLosses: string, memory: FinancialSituationMemory): Promise<void> {
    const situation = this.extractCurrentSituation(state);
    const result = await this.reflectOnComponent('TRADER', state.trader_investment_plan, situation, returnsLosses);
    memory.addSituations([[situation, result]]);
  }

  async reflectInvestJudge(state: AgentState, returnsLosses: string, memory: FinancialSituationMemory): Promise<void> {
    const situation = this.extractCurrentSituation(state);
    const result = await this.reflectOnComponent('INVEST JUDGE', state.investment_debate_state.judge_decision, situation, returnsLosses);
    memory.addSituations([[situation, result]]);
  }

  async reflectPortfolioManager(state: AgentState, returnsLosses: string, memory: FinancialSituationMemory): Promise<void> {
    const situation = this.extractCurrentSituation(state);
    const result = await this.reflectOnComponent('PORTFOLIO MANAGER', state.risk_debate_state.judge_decision, situation, returnsLosses);
    memory.addSituations([[situation, result]]);
  }
}
