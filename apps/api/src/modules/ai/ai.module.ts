import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '../../prisma/prisma.module';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { TradingModule } from '../trading/trading.module';
import { GatewaysModule } from '../../gateways/gateways.module';
import { ExchangeAdaptersModule } from '../exchange-adapters/exchange-adapters.module';

// Controller
import { AiController } from './ai.controller';

// === 共享服务（services/ 根目录） ===
import { LLMService } from './services/llm.service';
import { AiMemoryService } from './services/memory.service';
import { EvolutionService } from './services/evolution.service';
import { IndicatorsService } from './services/indicators.service';
import { TradeHistoryService } from './services/trade-history.service';
import { AiPerformanceService } from './services/ai-performance.service';
import { MarketDataService } from './services/market-data.service';
import { SafetyService } from './services/safety.service';
import { AiExecutionService } from './services/ai-execution.service';

// === 产品 A（AI 研究团队）→ services/research/ ===
import { DebateService } from './services/research/debate.service';
import { CryptoAnalystsService } from './services/research/crypto-analysts.service';
import { RiskDebateService } from './services/research/risk-debate.service';
import { ResearchPipelineService } from './services/research/research-pipeline.service';
import { ResearchReflectionService } from './services/research/research-reflection.service';
import { ResearchCycleService } from './services/research/research-cycle.service';

// === 产品 B（AI 自动交易）→ services/trading/ ===
import { QuickAnalysisService } from './services/trading/quick-analysis.service';
import { StrategyEngineService } from './services/trading/strategy-engine.service';
import { CoinScannerService } from './services/trading/coin-scanner.service';
import { ConsensusService } from './services/trading/consensus.service';
import { AutoTraderService } from './services/trading/auto-trader.service';
import { GridTradingService } from './services/trading/grid-trading.service';
import { AutoSchedulerService } from './services/trading/auto-scheduler.service';
import { DebateOrchestratorService } from './services/trading/debate-orchestrator.service';
import { PromptBuilderService } from './services/trading/prompt-builder.service';
import { NofxosRankingService } from './services/nofxos-ranking.service';

// Processors — 从 v2-dev 复制
import { AutoRunProcessor } from './processors/auto-run.processor';
import { DrawdownMonitorProcessor } from './processors/drawdown-monitor.processor';

/**
 * AI 智能交易模块
 *
 * Phase 8.0 双产品系统：
 * - 产品 A（AI 研究团队）：5 阶段多智能体深度研究 → 交易决策
 * - 产品 B（AI 自动交易）：策略配置向导 → Solo/Debate 模式 → 自动循环交易
 *
 * 已注册到 AppModule（Phase 8.0 集成完成）
 */
@Module({
  imports: [
    PrismaModule,
    ApiKeysModule,
    GatewaysModule,
    ExchangeAdaptersModule, // Phase 8.1: DEX 适配器工厂
    forwardRef(() => TradingModule), // 避免循环依赖
    // BullMQ 队列注册
    BullModule.registerQueue(
      { name: 'ai-auto' }, // 自动运行队列
      { name: 'ai-monitor' }, // 回撤监控队列
    ),
  ],
  controllers: [AiController],
  providers: [
    // === v2-dev 复用服务 ===
    LLMService,
    DebateService,
    AiMemoryService,
    EvolutionService,
    IndicatorsService,
    TradeHistoryService,
    AiPerformanceService,
    MarketDataService,
    SafetyService,
    AutoSchedulerService,

    // === 新建服务（产品 A） ===
    AiExecutionService,
    CryptoAnalystsService,
    RiskDebateService,
    ResearchPipelineService,
    ResearchReflectionService,
    ResearchCycleService, // Phase 10: 研究自动循环
    QuickAnalysisService,

    // === 新建服务（产品 B） ===
    StrategyEngineService,
    CoinScannerService,
    ConsensusService,
    AutoTraderService,
    GridTradingService,
    DebateOrchestratorService, // Phase 8.2: 4阶段辩论编排器
    PromptBuilderService, // Phase 9.0: 8-section 结构化 Prompt
    NofxosRankingService, // NofxOS 排名数据（OI/资金流/涨跌幅）

    // === 处理器 ===
    AutoRunProcessor,
    DrawdownMonitorProcessor,

    // AI 编排器已在 Phase 8.0 集成完成
    // AutoTraderService 通过 AutoRunProcessor 处理 strategy-cycle 任务
    // ResearchPipelineService 通过 AiController 直接调用
  ],
  exports: [
    LLMService,
    DebateService,
    AiMemoryService,
    EvolutionService,
    IndicatorsService,
    MarketDataService,
    SafetyService,
    AiExecutionService,
  ],
})
export class AiModule {}
