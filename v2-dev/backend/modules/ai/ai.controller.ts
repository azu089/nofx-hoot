import {
  Controller,
  Post,
  Get,
  Put,
  Body,
  Query,
  Param,
} from '@nestjs/common';
import { AiService } from './ai.service';
import { AiPerformanceService } from './services/ai-performance.service';
import { TradeHistoryService } from './services/trade-history.service';
import { AutoSchedulerService } from './services/auto-scheduler.service';
import { EvolutionService } from './services/evolution.service';
import { TriggerAnalysisDto, ListAnalysesDto } from './dto/trigger-analysis.dto';
import { UpdateAiConfigDto } from './dto/ai-config.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

/**
 * AI 交易控制器
 *
 * 路由前缀: /ai
 * 所有接口需要 JWT 认证（全局 Guard 已启用）
 */
@Controller('ai')
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly performanceService: AiPerformanceService,
    private readonly tradeHistoryService: TradeHistoryService,
    private readonly autoScheduler: AutoSchedulerService,
    private readonly evolutionService: EvolutionService,
  ) {}

  // ==================== 分析 ====================

  /**
   * 触发 AI 分析
   * POST /ai/analyze
   */
  @Post('analyze')
  async triggerAnalysis(
    @CurrentUser() user: { id: string },
    @Body() dto: TriggerAnalysisDto,
  ) {
    return this.aiService.triggerAnalysis(user.id, dto);
  }

  /**
   * 获取分析列表
   * GET /ai/analyses
   */
  @Get('analyses')
  async listAnalyses(
    @CurrentUser() user: { id: string },
    @Query() query: ListAnalysesDto,
  ) {
    return this.aiService.getAnalyses(
      user.id,
      query.page,
      query.limit,
      query.symbol,
      query.status,
    );
  }

  /**
   * 获取分析详情（含辩论记录）
   * GET /ai/analyses/:id
   */
  @Get('analyses/:id')
  async getAnalysisDetail(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ) {
    return this.aiService.getAnalysisDetail(user.id, id);
  }

  // ==================== 配置 ====================

  /**
   * 获取 AI 配置
   * GET /ai/config
   */
  @Get('config')
  async getConfig(@CurrentUser() user: { id: string }) {
    return this.aiService.getConfig(user.id);
  }

  /**
   * 更新 AI 配置
   * PUT /ai/config
   */
  @Put('config')
  async updateConfig(
    @CurrentUser() user: { id: string },
    @Body() dto: UpdateAiConfigDto,
  ) {
    return this.aiService.updateConfig(user.id, dto);
  }

  // ==================== 统计 ====================

  /**
   * 获取 AI 交易统计
   * GET /ai/stats
   */
  @Get('stats')
  async getStats(@CurrentUser() user: { id: string }) {
    return this.aiService.getStats(user.id);
  }

  // ==================== 性能追踪 (P7) ====================

  /**
   * 获取模型排名
   * GET /ai/performance/models
   */
  @Get('performance/models')
  async getModelRanking(@CurrentUser() user: { id: string }) {
    return this.performanceService.getModelRanking(user.id);
  }

  /**
   * 获取角色准确度
   * GET /ai/performance/roles
   */
  @Get('performance/roles')
  async getRoleAccuracy(@CurrentUser() user: { id: string }) {
    return this.performanceService.getRoleAccuracy(user.id);
  }

  /**
   * 获取完整性能摘要
   * GET /ai/performance/summary
   */
  @Get('performance/summary')
  async getPerformanceSummary(@CurrentUser() user: { id: string }) {
    return this.performanceService.getPerformanceSummary(user.id);
  }

  // ==================== 自动运行 (v6) ====================

  /**
   * 启动自动运行
   * POST /ai/auto/start
   */
  @Post('auto/start')
  async startAutoRun(@CurrentUser() user: { id: string }) {
    return this.autoScheduler.startAutoRun(user.id);
  }

  /**
   * 停止自动运行
   * POST /ai/auto/stop
   */
  @Post('auto/stop')
  async stopAutoRun(
    @CurrentUser() user: { id: string },
    @Body() body: { reason?: string },
  ) {
    return this.autoScheduler.stopAutoRun(user.id, body?.reason);
  }

  /**
   * 获取自动运行状态
   * GET /ai/auto/status
   */
  @Get('auto/status')
  async getAutoRunStatus(@CurrentUser() user: { id: string }) {
    return this.autoScheduler.getAutoRunStatus(user.id);
  }

  // ==================== 进化状态 (v6) ====================

  /**
   * 获取进化状态
   * GET /ai/evolution
   */
  @Get('evolution')
  async getEvolution(@CurrentUser() user: { id: string }) {
    return this.evolutionService.getEvolutionState(user.id);
  }

  // ==================== 交易历史 (P3) ====================

  /**
   * 获取 AI 交易历史
   * GET /ai/trade-history
   */
  @Get('trade-history')
  async getTradeHistory(@CurrentUser() user: { id: string }) {
    const [trades, stats, hints] = await Promise.all([
      this.tradeHistoryService.getRecentTrades(user.id),
      this.tradeHistoryService.getFullStats(user.id),
      this.tradeHistoryService.getPerformanceHints(user.id),
    ]);
    return { trades, stats, hints };
  }
}
