import { Module, forwardRef, OnModuleInit } from '@nestjs/common';
import { BullModule, InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Logger } from '@nestjs/common';

// 控制器
import { AiController } from './ai.controller';

// 主服务
import { AiService } from './ai.service';

// 核心服务
import { LLMService } from './services/llm.service';
import { MarketDataService } from './services/market-data.service';
import { IndicatorsService } from './services/indicators.service';
import { DebateService } from './services/debate.service';
import { SafetyService } from './services/safety.service';
import { TradeHistoryService } from './services/trade-history.service';
import { AiPerformanceService } from './services/ai-performance.service';
import { AiMemoryService } from './services/memory.service';

// v6 新增服务
import { EvolutionService } from './services/evolution.service';
import { QuickAnalysisService } from './services/quick-analysis.service';
import { AutoSchedulerService } from './services/auto-scheduler.service';

// 处理器
import { AiTradeProcessor } from './processors/ai-trade.processor';
import { DrawdownMonitorProcessor } from './processors/drawdown-monitor.processor';
import { AutoRunProcessor } from './processors/auto-run.processor';

// 依赖模块
import { TradingModule } from '../trading/trading.module';

@Module({
  imports: [
    // 使用独立的 AI 交易队列，避免与策略交易共享队列导致延迟
    BullModule.registerQueue({ name: 'trade-ai' }),
    // AI 持仓监控队列（回撤保护）
    BullModule.registerQueue({ name: 'ai-monitor' }),
    // v6: AI 自动运行队列（per-user 定时循环）
    BullModule.registerQueue({ name: 'ai-auto' }),
    forwardRef(() => TradingModule),
  ],
  controllers: [AiController],
  providers: [
    AiService,
    LLMService,
    MarketDataService,
    IndicatorsService,
    DebateService,
    SafetyService,
    TradeHistoryService,
    AiPerformanceService,
    AiMemoryService,
    // v6 新增
    EvolutionService,
    QuickAnalysisService,
    AutoSchedulerService,
    // 处理器
    AiTradeProcessor,
    DrawdownMonitorProcessor,
    AutoRunProcessor,
  ],
  exports: [AiService, AiPerformanceService, AiMemoryService, AutoSchedulerService],
})
export class AiModule implements OnModuleInit {
  private readonly logger = new Logger(AiModule.name);

  constructor(
    @InjectQueue('ai-monitor')
    private readonly aiMonitorQueue: Queue,
    private readonly autoScheduler: AutoSchedulerService,
  ) {}

  async onModuleInit() {
    // 注册 AI 持仓回撤监控定时任务（每 30 秒执行一次）
    try {
      // 先清除旧的重复任务，避免重复注册
      const existingJobs = await this.aiMonitorQueue.getRepeatableJobs();
      for (const job of existingJobs) {
        await this.aiMonitorQueue.removeRepeatableByKey(job.key);
      }

      await this.aiMonitorQueue.add(
        'drawdown-check',
        {},
        {
          repeat: { every: 30000 }, // 每 30 秒
          removeOnComplete: 100,
          removeOnFail: 50,
        },
      );
      this.logger.log('AI 持仓回撤监控已启动（每 30 秒）');
    } catch (error) {
      this.logger.warn(`AI 监控定时任务注册失败: ${error.message}`);
    }

    // v6: 恢复所有自动运行中的用户调度任务
    try {
      await this.autoScheduler.restoreAutoRuns();
    } catch (error) {
      this.logger.warn(`自动运行恢复失败: ${error.message}`);
    }
  }
}
