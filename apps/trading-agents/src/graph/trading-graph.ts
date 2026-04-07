/**
 * TradingAgentsGraph - 主编排器
 * 1:1 对应 Python trading_graph.py
 *
 * 简化实现：不使用 LangGraph 状态机，改用顺序调用。
 * 功能完全对等：4 分析师 → Bull/Bear 辩论 → Research Manager → Trader → Risk 辩论 → Portfolio Manager
 */

import fs from 'fs';
import path from 'path';

import type { TradingAgentsConfig } from '../types/config.js';
import type { AgentState, AnalystType } from '../types/state.js';
import { DEFAULT_CONFIG } from '../default-config.js';
import { LlmClient } from '../llm/llm-client.js';
import { FinancialSituationMemory } from '../agents/memory.js';
import { setConfig } from '../dataflows/config.js';

// Agent factories
import { createMarketAnalyst } from '../agents/analysts/market-analyst.js';
import { createNewsAnalyst } from '../agents/analysts/news-analyst.js';
import { createSocialMediaAnalyst } from '../agents/analysts/social-media-analyst.js';
import { createFundamentalsAnalyst } from '../agents/analysts/fundamentals-analyst.js';
import { createBullResearcher } from '../agents/researchers/bull-researcher.js';
import { createBearResearcher } from '../agents/researchers/bear-researcher.js';
import { createResearchManager } from '../agents/managers/research-manager.js';
import { createPortfolioManager } from '../agents/managers/portfolio-manager.js';
import { createTrader } from '../agents/trader/trader.js';
import { createAggressiveDebater } from '../agents/risk/aggressive-debater.js';
import { createConservativeDebater } from '../agents/risk/conservative-debater.js';
import { createNeutralDebater } from '../agents/risk/neutral-debater.js';

// Graph components
import { ConditionalLogic } from './conditional-logic.js';
import { Propagator } from './propagation.js';
import { Reflector } from './reflection.js';
import { SignalProcessor } from './signal-processing.js';

type AgentNodeFn = (state: AgentState) => Promise<Partial<AgentState>>;

export interface PropagateResult {
  state: AgentState;
  signal: string;
}

export class TradingAgentsGraph {
  private config: TradingAgentsConfig;
  private debug: boolean;
  private selectedAnalysts: AnalystType[];

  // LLM
  private llmClient: LlmClient;
  private deepModelId: string;
  private quickModelId: string;

  // Memory
  private bullMemory: FinancialSituationMemory;
  private bearMemory: FinancialSituationMemory;
  private traderMemory: FinancialSituationMemory;
  private investJudgeMemory: FinancialSituationMemory;
  private portfolioManagerMemory: FinancialSituationMemory;

  // Components
  private conditionalLogic: ConditionalLogic;
  private propagator: Propagator;
  private reflector: Reflector;
  private signalProcessor: SignalProcessor;

  // Agent nodes
  private analystNodes: Map<AnalystType, AgentNodeFn> = new Map();
  private bullResearcherNode!: AgentNodeFn;
  private bearResearcherNode!: AgentNodeFn;
  private researchManagerNode!: AgentNodeFn;
  private traderNode!: AgentNodeFn;
  private aggressiveNode!: AgentNodeFn;
  private conservativeNode!: AgentNodeFn;
  private neutralNode!: AgentNodeFn;
  private portfolioManagerNode!: AgentNodeFn;

  // State tracking
  private currState: AgentState | null = null;
  private ticker: string = '';

  constructor(options?: {
    selectedAnalysts?: AnalystType[];
    debug?: boolean;
    config?: Partial<TradingAgentsConfig>;
  }) {
    this.selectedAnalysts = options?.selectedAnalysts || ['market', 'social', 'news', 'fundamentals'];
    this.debug = options?.debug || false;
    this.config = { ...DEFAULT_CONFIG, ...options?.config };

    // Update global config
    setConfig(this.config);

    // Create cache directory
    const cacheDir = this.config.data_cache_dir;
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }

    // Initialize LLM client (不传 backend_url，让 LlmClient 根据 provider 自动选择)
    const customUrl = this.config.backend_url !== DEFAULT_CONFIG.backend_url ? this.config.backend_url : undefined;
    this.llmClient = new LlmClient(this.config.llm_provider, customUrl);
    this.deepModelId = this.config.deep_think_llm;
    this.quickModelId = this.config.quick_think_llm;

    // Initialize memories
    const memoryConfig = { results_dir: this.config.results_dir };
    this.bullMemory = new FinancialSituationMemory('bull_memory', memoryConfig);
    this.bearMemory = new FinancialSituationMemory('bear_memory', memoryConfig);
    this.traderMemory = new FinancialSituationMemory('trader_memory', memoryConfig);
    this.investJudgeMemory = new FinancialSituationMemory('invest_judge_memory', memoryConfig);
    this.portfolioManagerMemory = new FinancialSituationMemory('portfolio_manager_memory', memoryConfig);

    // Initialize components
    this.conditionalLogic = new ConditionalLogic(
      this.config.max_debate_rounds,
      this.config.max_risk_discuss_rounds,
    );
    this.propagator = new Propagator(this.config.max_recur_limit);
    this.reflector = new Reflector(this.llmClient, this.quickModelId);
    this.signalProcessor = new SignalProcessor(this.llmClient, this.quickModelId);

    // Create agent nodes
    this.initializeAgentNodes();
  }

  private initializeAgentNodes(): void {
    // Analysts（Tool Loop 模式，不再传 routeToVendor，工具调用由 LLM 自主决定）
    if (this.selectedAnalysts.includes('market')) {
      this.analystNodes.set('market', createMarketAnalyst(this.llmClient, this.quickModelId));
    }
    if (this.selectedAnalysts.includes('social')) {
      this.analystNodes.set('social', createSocialMediaAnalyst(this.llmClient, this.quickModelId));
    }
    if (this.selectedAnalysts.includes('news')) {
      this.analystNodes.set('news', createNewsAnalyst(this.llmClient, this.quickModelId));
    }
    if (this.selectedAnalysts.includes('fundamentals')) {
      this.analystNodes.set('fundamentals', createFundamentalsAnalyst(this.llmClient, this.quickModelId));
    }

    // Researchers
    this.bullResearcherNode = createBullResearcher(this.llmClient, this.quickModelId, this.bullMemory);
    this.bearResearcherNode = createBearResearcher(this.llmClient, this.quickModelId, this.bearMemory);

    // Managers
    this.researchManagerNode = createResearchManager(this.llmClient, this.deepModelId, this.investJudgeMemory);
    this.portfolioManagerNode = createPortfolioManager(this.llmClient, this.deepModelId, this.portfolioManagerMemory);

    // Trader
    this.traderNode = createTrader(this.llmClient, this.quickModelId, this.traderMemory);

    // Risk debaters
    this.aggressiveNode = createAggressiveDebater(this.llmClient, this.quickModelId);
    this.conservativeNode = createConservativeDebater(this.llmClient, this.quickModelId);
    this.neutralNode = createNeutralDebater(this.llmClient, this.quickModelId);
  }

  private mergeState(state: AgentState, partial: Partial<AgentState>): AgentState {
    return { ...state, ...partial };
  }

  private log(msg: string): void {
    if (this.debug) console.log(`[Arena] ${msg}`);
  }

  /**
   * 运行完整分析流水线
   */
  async propagate(companyName: string, tradeDate: string, tradingContext?: import('../types/state.js').TradingContextForArena): Promise<PropagateResult> {
    this.ticker = companyName;
    let state = this.propagator.createInitialState(companyName, tradeDate);
    if (tradingContext) {
      state.trading_context = tradingContext;
    }

    // ========== Phase 1: Analysts ==========
    this.log('Phase 1: Running analysts...');
    for (const analystType of this.selectedAnalysts) {
      const node = this.analystNodes.get(analystType);
      if (!node) continue;

      this.log(`  Running ${analystType} analyst...`);
      const partial = await node(state);
      state = this.mergeState(state, partial);
      this.log(`  ${analystType} analyst done.`);
    }

    // ========== Phase 2: Investment Debate (Bull vs Bear) ==========
    if (this.config.max_debate_rounds > 0) {
      this.log('Phase 2: Investment debate...');
      let debateRoute = 'Bull Researcher';
      while (debateRoute !== 'Research Manager') {
        if (debateRoute === 'Bull Researcher') {
          this.log('  Bull Researcher arguing...');
          const partial = await this.bullResearcherNode(state);
          state = this.mergeState(state, partial);
        } else {
          this.log('  Bear Researcher arguing...');
          const partial = await this.bearResearcherNode(state);
          state = this.mergeState(state, partial);
        }
        debateRoute = this.conditionalLogic.shouldContinueDebate(state);
      }
    } else {
      this.log('Phase 2: Skipped (max_debate_rounds = 0)');
    }

    // ========== Phase 3: Research Manager (Judge) ==========
    this.log('Phase 3: Research Manager judging...');
    const rmPartial = await this.researchManagerNode(state);
    state = this.mergeState(state, rmPartial);

    // ========== Phase 4: Trader ==========
    this.log('Phase 4: Trader planning...');
    const traderPartial = await this.traderNode(state);
    state = this.mergeState(state, traderPartial);

    // ========== Phase 5: Risk Debate (Aggressive → Conservative → Neutral) ==========
    if (this.config.max_risk_discuss_rounds > 0) {
      this.log('Phase 5: Risk debate...');
      let riskRoute = 'Aggressive Analyst';
      while (riskRoute !== 'Portfolio Manager') {
        if (riskRoute === 'Aggressive Analyst') {
          this.log('  Aggressive Analyst arguing...');
          const partial = await this.aggressiveNode(state);
          state = this.mergeState(state, partial);
        } else if (riskRoute === 'Conservative Analyst') {
          this.log('  Conservative Analyst arguing...');
          const partial = await this.conservativeNode(state);
          state = this.mergeState(state, partial);
        } else {
          this.log('  Neutral Analyst arguing...');
          const partial = await this.neutralNode(state);
          state = this.mergeState(state, partial);
        }
        riskRoute = this.conditionalLogic.shouldContinueRiskAnalysis(state);
      }
    } else {
      this.log('Phase 5: Skipped (max_risk_discuss_rounds = 0)');
    }

    // ========== Phase 6: Portfolio Manager (Final Decision) ==========
    this.log('Phase 6: Portfolio Manager deciding...');
    const pmPartial = await this.portfolioManagerNode(state);
    state = this.mergeState(state, pmPartial);

    // Store state
    this.currState = state;

    // Log state to file
    this.logState(tradeDate, state);

    // Process signal
    this.log('Processing signal...');
    const signal = await this.signalProcessor.processSignal(state.final_trade_decision);
    this.log(`Final signal: ${signal}`);

    return { state, signal };
  }

  /**
   * 事后复盘 + 记忆更新
   */
  async reflectAndRemember(returnsLosses: string): Promise<void> {
    if (!this.currState) throw new Error('No state to reflect on. Run propagate() first.');

    await this.reflector.reflectBullResearcher(this.currState, returnsLosses, this.bullMemory);
    await this.reflector.reflectBearResearcher(this.currState, returnsLosses, this.bearMemory);
    await this.reflector.reflectTrader(this.currState, returnsLosses, this.traderMemory);
    await this.reflector.reflectInvestJudge(this.currState, returnsLosses, this.investJudgeMemory);
    await this.reflector.reflectPortfolioManager(this.currState, returnsLosses, this.portfolioManagerMemory);
  }

  /**
   * 日志输出
   */
  private logState(tradeDate: string, state: AgentState): void {
    const logData = {
      [String(tradeDate)]: {
        company_of_interest: state.company_of_interest,
        trade_date: state.trade_date,
        market_report: state.market_report,
        sentiment_report: state.sentiment_report,
        news_report: state.news_report,
        fundamentals_report: state.fundamentals_report,
        investment_debate_state: {
          bull_history: state.investment_debate_state.bull_history,
          bear_history: state.investment_debate_state.bear_history,
          history: state.investment_debate_state.history,
          current_response: state.investment_debate_state.current_response,
          judge_decision: state.investment_debate_state.judge_decision,
        },
        trader_investment_decision: state.trader_investment_plan,
        risk_debate_state: {
          aggressive_history: state.risk_debate_state.aggressive_history,
          conservative_history: state.risk_debate_state.conservative_history,
          neutral_history: state.risk_debate_state.neutral_history,
          history: state.risk_debate_state.history,
          judge_decision: state.risk_debate_state.judge_decision,
        },
        investment_plan: state.investment_plan,
        final_trade_decision: state.final_trade_decision,
      },
    };

    const dir = path.join(this.config.results_dir, this.ticker, 'ArenaStrategy_logs');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    fs.writeFileSync(
      path.join(dir, `full_states_log_${tradeDate}.json`),
      JSON.stringify(logData, null, 2),
      'utf-8',
    );
  }
}
