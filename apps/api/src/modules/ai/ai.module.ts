import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '../../prisma/prisma.module';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { TradingModule } from '../trading/trading.module';
import { GatewaysModule } from '../../gateways/gateways.module';
import { ExchangeAdaptersModule } from '../exchange-adapters/exchange-adapters.module';

// Controller
import { AiController } from './ai.controller';

// Services — 从 v2-dev 复制（Phase 8.0-A 任务 1）
import { LLMService } from './services/llm.service';
import { DebateService } from './services/debate.service';
import { AiMemoryService } from './services/memory.service';
import { EvolutionService } from './services/evolution.service';
import { IndicatorsService } from './services/indicators.service';
import { TradeHistoryService } from './services/trade-history.service';
import { AiPerformanceService } from './services/ai-performance.service';
import { MarketDataService } from './services/market-data.service';
import { SafetyService } from './services/safety.service';
import { AutoSchedulerService } from './services/auto-scheduler.service';

// Services — 新建（Phase 8.0-A 任务 4）
import { AiExecutionService } from './services/ai-execution.service';

// Services — 新建（Phase 8.0-B 产品 A）
import { CryptoAnalystsService } from './services/crypto-analysts.service';
import { RiskDebateService } from './services/risk-debate.service';
import { ResearchPipelineService } from './services/research-pipeline.service';
import { ResearchReflectionService } from './services/research-reflection.service';
import { QuickAnalysisService } from './services/quick-analysis.service';

// Services — 新建（Phase 8.0-C 产品 B）
import { StrategyEngineService } from './services/strategy-engine.service';
import { CoinScannerService } from './services/coin-scanner.service';
import { ConsensusService } from './services/consensus.service';
import { AutoTraderService } from './services/auto-trader.service';
import { GridTradingService } from './services/grid-trading.service';

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
    QuickAnalysisService,

    // === 新建服务（产品 B） ===
    StrategyEngineService,
    CoinScannerService,
    ConsensusService,
    AutoTraderService,
    GridTradingService,

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
