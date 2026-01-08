import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Query,
  BadRequestException,
  HttpException,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { StrategiesService } from './strategies.service';
import { BacktestService } from './backtest.service';
import { AutoReviewService } from './auto-review.service';
import { RevenuePricingService } from './revenue-pricing.service';
import { InstancesService } from '../instances/instances.service';
import { FreqtradeService } from '../freqtrade/freqtrade.service';
import { CreateStrategyConfigDto } from './dto/create-strategy-config.dto';
import { UpdateStrategyConfigDto } from './dto/update-strategy-config.dto';
import { StrategyResponseDto, StrategyDetailResponseDto } from './dto/strategy-response.dto';
import { StrategyConfigResponseDto } from './dto/strategy-config-response.dto';
import { BacktestRequestDto, BacktestResultDto } from './dto/backtest.dto';
import { UploadStrategyDto, UploadStrategyResponseDto } from './dto/upload-strategy.dto';
import {
  StrategyRevenueStatsDto,
  RevenueLogsQueryDto,
  RevenueLogsResponseDto,
  UpgradeProgressDto,
} from './dto/strategy-revenue.dto';
import { WithdrawRevenueDto } from './dto/withdraw-revenue.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';

/**
 * 策略控制器
 * 路由前缀: /api/strategies
 */
@ApiTags('策略管理')
@Controller('strategies')
@UseGuards(JwtAuthGuard) // 默认需要认证
export class StrategiesController {
  private readonly logger = new Logger(StrategiesController.name);

  constructor(
    private readonly strategiesService: StrategiesService,
    private readonly backtestService: BacktestService,
    private readonly autoReviewService: AutoReviewService,
    private readonly pricingService: RevenuePricingService,
    private readonly instancesService: InstancesService,
    private readonly freqtradeService: FreqtradeService,
  ) {}

  /**
   * 获取公开策略列表
   * 不需要认证，任何人都可以查看
   * @param type 策略类型筛选：grid/trend/dca/arbitrage/scalping/swing
   * @param source 来源筛选：all/official/community
   * @param sort 排序方式：recommended/popular/returns/drawdown/newest
   */
  @Public()
  @Get()
  @ApiOperation({ summary: '获取公开策略列表' })
  @ApiResponse({
    status: 200,
    description: '成功获取策略列表',
    type: [StrategyResponseDto],
  })
  async findAll(
    @Query('type') type?: string,
    @Query('source') source?: string,
    @Query('sort') sort?: string,
  ) {
    return {
      code: 0,
      message: 'success',
      data: await this.strategiesService.findAll({ type, source, sort }),
    };
  }

  /**
   * 获取我已订阅的策略列表
   * 需要 JWT 认证
   */
  @Get('my')
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取我已订阅的策略列表' })
  @ApiResponse({
    status: 200,
    description: '成功获取已订阅策略列表',
    type: [StrategyResponseDto],
  })
  async getMyStrategies(@CurrentUser('sub') userId: string) {
    return {
      code: 0,
      message: 'success',
      data: await this.strategiesService.findUserSubscribedStrategies(userId),
    };
  }

  /**
   * 获取我上传的策略列表
   * Phase 16.5 - 必须放在 :id 之前
   */
  @Get('my-uploads')
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取我上传的策略列表' })
  @ApiResponse({ status: 200, description: '成功' })
  async getMyUploadedStrategies(@CurrentUser('sub') userId: string) {
    const strategies = await this.strategiesService.findUserUploadedStrategies(userId);

    return {
      code: 0,
      message: 'success',
      data: strategies,
    };
  }

  /**
   * 获取策略收益统计
   * Phase 16.5 - 必须放在 :id 之前
   */
  @Get('revenue/stats')
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取策略收益统计' })
  @ApiResponse({
    status: 200,
    description: '成功',
    type: StrategyRevenueStatsDto,
  })
  async getRevenueStats(@CurrentUser('sub') userId: string) {
    const stats = await this.strategiesService.calculateUserRevenueStats(
      userId,
    );

    return {
      code: 0,
      message: 'success',
      data: stats,
    };
  }

  /**
   * 获取策略收益明细
   * Phase 16.5 - 必须放在 :id 之前
   */
  @Get('revenue/logs')
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取策略收益明细' })
  @ApiResponse({
    status: 200,
    description: '成功',
    type: RevenueLogsResponseDto,
  })
  async getRevenueLogs(
    @CurrentUser('sub') userId: string,
    @Query() query: RevenueLogsQueryDto,
  ) {
    const logs = await this.strategiesService.findUserRevenueLogs(
      userId,
      query,
    );

    return {
      code: 0,
      message: 'success',
      data: logs,
    };
  }

  /**
   * 获取策略详情
   * 公开策略不需要认证即可查看
   * 注意：此路由必须放在所有具体路由之后，因为 :id 会匹配任何路径
   */
  @Public()
  @Get(':id')
  @ApiOperation({ summary: '获取策略详情' })
  @ApiResponse({
    status: 200,
    description: '成功获取策略详情',
    type: StrategyDetailResponseDto,
  })
  @ApiResponse({ status: 404, description: '策略不存在' })
  async findById(@Param('id') id: string) {
    return {
      code: 0,
      message: 'success',
      data: await this.strategiesService.findById(id),
    };
  }

  /**
   * 获取我的策略配置列表
   * 需要 JWT 认证
   */
  @Get('my-configs/list')
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取我的策略配置列表' })
  @ApiResponse({
    status: 200,
    description: '成功获取配置列表',
    type: [StrategyConfigResponseDto],
  })
  async getMyConfigs(@CurrentUser('sub') userId: string) {
    return {
      code: 0,
      message: 'success',
      data: await this.strategiesService.findUserStrategies(userId),
    };
  }

  /**
   * 创建策略配置
   * 需要 JWT 认证
   */
  @Post('configs')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '创建策略配置' })
  @ApiResponse({
    status: 201,
    description: '策略配置创建成功',
    type: StrategyConfigResponseDto,
  })
  @ApiResponse({ status: 400, description: '参数错误' })
  @ApiResponse({ status: 404, description: '策略不存在' })
  async createConfig(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateStrategyConfigDto,
  ) {
    return {
      code: 0,
      message: '策略配置创建成功',
      data: await this.strategiesService.createUserConfig(userId, dto),
    };
  }

  /**
   * 更新策略配置
   * 需要 JWT 认证
   */
  @Patch('configs/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: '更新策略配置' })
  @ApiResponse({
    status: 200,
    description: '策略配置更新成功',
    type: StrategyConfigResponseDto,
  })
  @ApiResponse({ status: 403, description: '无权限修改该配置' })
  @ApiResponse({ status: 404, description: '配置不存在' })
  async updateConfig(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: UpdateStrategyConfigDto,
  ) {
    return {
      code: 0,
      message: '策略配置更新成功',
      data: await this.strategiesService.updateUserConfig(id, userId, dto),
    };
  }

  /**
   * 删除策略配置
   * 需要 JWT 认证
   */
  @Delete('configs/:id')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '删除策略配置' })
  @ApiResponse({ status: 200, description: '策略配置删除成功' })
  @ApiResponse({ status: 403, description: '无权限删除该配置' })
  @ApiResponse({ status: 404, description: '配置不存在' })
  async deleteConfig(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return {
      code: 0,
      ...(await this.strategiesService.deleteUserConfig(id, userId)),
    };
  }

  /**
   * 生成 Freqtrade 配置文件（内部接口，供 VPS 调用）
   * 需要 JWT 认证
   */
  @Get('configs/:id/freqtrade-config')
  @ApiBearerAuth()
  @ApiOperation({ summary: '生成 Freqtrade 配置文件（内部接口）' })
  @ApiResponse({ status: 200, description: '成功生成配置' })
  @ApiResponse({ status: 404, description: '配置不存在' })
  async getFreqtradeConfig(@Param('id') configId: string) {
    return {
      code: 0,
      message: 'success',
      data: await this.strategiesService.generateFreqtradeConfig(configId),
    };
  }

  /**
   * 执行策略回测
   *
   * 核心逻辑：回测由用户 VPS 上的 Freqtrade 执行
   * - 用户必须先购买 VPS 订阅
   * - Freqtrade 会自动下载所需的 K 线数据
   * - 回测结果直接来自 Freqtrade
   */
  @Post('backtest')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '执行策略回测（Freqtrade）' })
  @ApiResponse({
    status: 200,
    description: '回测完成',
    type: BacktestResultDto,
  })
  @ApiResponse({ status: 400, description: '参数错误或无 VPS' })
  async runBacktest(
    @CurrentUser('sub') userId: string,
    @Body() dto: BacktestRequestDto,
  ) {
    // 1. 检查用户是否有活跃的 VPS 实例
    const instances = await this.instancesService.findAllByUserId(userId);
    const activeInstance = instances.find(
      (i) => i.status === 'running' && i.ip_address,
    );

    if (!activeInstance || !activeInstance.ip_address) {
      throw new HttpException(
        {
          code: 40301,
          message: '您还没有活跃的 VPS 实例，请先购买 VPS 服务后再进行回测',
          data: null,
        },
        HttpStatus.OK,
      );
    }

    // 2. 获取策略信息
    let strategyName = 'SampleStrategy';
    if (dto.strategyId) {
      const strategy = await this.strategiesService.findOne(dto.strategyId);
      if (strategy) {
        strategyName = strategy.name;
      }
    }

    this.logger.log(
      `用户 ${userId} 发起回测: 策略=${strategyName}, VPS=${activeInstance.ip_address}`,
    );

    // 3. 调用 Freqtrade 回测
    try {
      const result = await this.freqtradeService.runBacktest(
        activeInstance.ip_address,
        strategyName, // 策略名称，Freqtrade 会加载对应的策略文件
        {
          pairs: dto.pairs,
          startDate: dto.startDate,
          endDate: dto.endDate,
          initialCapital: dto.initialCapital,
        },
      );

      return {
        code: 0,
        message: 'success',
        data: {
          totalReturn: result.total_return,
          winRate: result.win_rate,
          maxDrawdown: result.max_drawdown,
          sharpeRatio: result.sharpe_ratio,
          totalTrades: result.total_trades,
          avgProfit: result.avg_profit,
          avgLoss: result.avg_loss,
          profitFactor: result.profit_factor,
          strategyName,
          startDate: dto.startDate,
          endDate: dto.endDate,
          initialCapital: dto.initialCapital,
          pairs: dto.pairs,
          // 资金曲线需要从 trades 计算
          curve: this.calculateCurveFromTrades(result.trades, dto.initialCapital),
        },
      };
    } catch (error: any) {
      this.logger.error(`回测失败: ${error.message}`, error.stack);
      throw new HttpException(
        {
          code: 50001,
          message: `回测失败: ${error.message}`,
          data: null,
        },
        HttpStatus.OK,
      );
    }
  }

  /**
   * 从交易记录计算资金曲线
   */
  private calculateCurveFromTrades(
    trades: Array<{ pnl: number; exit_time: string }>,
    initialCapital: number,
  ) {
    if (!trades || trades.length === 0) {
      return [{ date: new Date().toISOString().split('T')[0], value: initialCapital, trades: 0 }];
    }

    // 按时间排序
    const sortedTrades = [...trades].sort(
      (a, b) => new Date(a.exit_time).getTime() - new Date(b.exit_time).getTime(),
    );

    let capital = initialCapital;
    const curve: Array<{ date: string; value: number; trades: number }> = [];
    const dailyPnl = new Map<string, { pnl: number; count: number }>();

    for (const trade of sortedTrades) {
      const date = trade.exit_time.split('T')[0];
      const existing = dailyPnl.get(date) || { pnl: 0, count: 0 };
      dailyPnl.set(date, { pnl: existing.pnl + trade.pnl, count: existing.count + 1 });
    }

    for (const [date, data] of dailyPnl.entries()) {
      capital += data.pnl;
      curve.push({ date, value: Number(capital.toFixed(2)), trades: data.count });
    }

    return curve;
  }

  // ==================== Phase 16: 社区策略市场 API ====================

  /**
   * 上传策略（含自动回测 + 自动审核）
   * Phase 16.5 - 核心接口
   *
   * 注意：上传策略需要先有 VPS，回测由 Freqtrade 执行
   */
  @Post('upload')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '上传策略（含自动回测和审核）' })
  @ApiResponse({
    status: 201,
    description: '策略上传成功',
    type: UploadStrategyResponseDto,
  })
  @ApiResponse({ status: 400, description: '参数错误或审核失败' })
  async uploadStrategy(
    @CurrentUser('sub') userId: string,
    @Body() dto: UploadStrategyDto,
  ) {
    // 1. 检查用户是否有活跃的 VPS 实例
    const instances = await this.instancesService.findAllByUserId(userId);
    const activeInstance = instances.find(
      (i) => i.status === 'running' && i.ip_address,
    );

    if (!activeInstance || !activeInstance.ip_address) {
      throw new HttpException(
        {
          code: 40301,
          message: '您需要先购买 VPS 服务才能上传策略（回测需要 VPS）',
          data: null,
        },
        HttpStatus.OK,
      );
    }

    // 2. 执行回测（验证策略有效性）- 通过 Freqtrade
    const backtestResult = await this.freqtradeService.runBacktest(
      activeInstance.ip_address,
      dto.name,
      {
        pairs: dto.backtestPairs,
        startDate: dto.backtestStartDate,
        endDate: dto.backtestEndDate,
        initialCapital: dto.backtestInitialCapital,
      },
    );

    // 3. 创建策略记录
    const strategy = await this.strategiesService.createUserStrategy({
      userId,
      name: dto.name,
      description: dto.description,
      content: dto.content,
      backtestData: {
        totalReturn: backtestResult.total_return,
        winRate: backtestResult.win_rate,
        maxDrawdown: backtestResult.max_drawdown,
        sharpeRatio: backtestResult.sharpe_ratio,
        totalTrades: backtestResult.total_trades,
      },
    });

    // 4. 执行自动审核
    const autoReview = await this.autoReviewService.performAutoReview(
      strategy.id,
    );

    // 5. 更新审核状态
    const finalStatus = autoReview.passed ? 'approved' : 'flagged';
    await this.strategiesService.updateReviewStatus(strategy.id, {
      review_status: finalStatus,
      auto_check_passed: autoReview.passed,
      auto_check_warnings: autoReview.warnings.concat(autoReview.criticalIssues),
    });

    // 6. 如果通过审核，初始化分成比例
    if (autoReview.passed) {
      await this.pricingService.updateStrategyRevenueTier(strategy.id);
    }

    return {
      code: 0,
      message: autoReview.passed
        ? '策略已通过自动审核并上架'
        : '策略需要人工审核',
      data: {
        strategyId: strategy.id,
        reviewStatus: finalStatus,
        autoCheckPassed: autoReview.passed,
        warnings: autoReview.warnings,
        backtestSummary: {
          totalReturn: backtestResult.total_return,
          winRate: backtestResult.win_rate,
          maxDrawdown: backtestResult.max_drawdown,
          sharpeRatio: backtestResult.sharpe_ratio,
        },
      },
    };
  }

  /**
   * 申请策略上架审核
   * 用户将自己创建的个人策略提交到策略市场
   * 流程：个人策略 -> 前端检测 -> 提交审核 -> 人工审核 -> 上架
   */
  @Post(':id/submit-for-review')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '申请策略上架审核' })
  @ApiResponse({
    status: 200,
    description: '提交成功',
  })
  @ApiResponse({ status: 400, description: '策略不存在或无权操作' })
  @ApiResponse({ status: 409, description: '策略已提交审核' })
  async submitForReview(
    @CurrentUser('sub') userId: string,
    @Param('id') strategyId: string,
    @Body() body?: {
      description?: string;
      autoCheckResult?: {
        backtestReturn: number | null;
        backtestWinRate: number | null;
        backtestDrawdown: number | null;
      };
    },
  ) {
    this.logger.log(`用户 ${userId} 申请策略上架: ${strategyId}`);

    const result = await this.strategiesService.submitStrategyForReview(
      strategyId,
      userId,
      body?.description,
      body?.autoCheckResult,
    );

    return {
      code: 0,
      message: result.message,
      data: {
        strategyId: result.strategyId,
        reviewStatus: result.reviewStatus,
        nextStep: result.nextStep,
      },
    };
  }

  /**
   * 获取策略升级进度
   * Phase 16.5 - 带路径参数的路由，放在 :id 通配之前
   */
  @Get(':id/upgrade-progress')
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取策略升级进度' })
  @ApiResponse({
    status: 200,
    description: '成功',
    type: UpgradeProgressDto,
  })
  @ApiResponse({ status: 404, description: '策略不存在' })
  async getUpgradeProgress(
    @CurrentUser('sub') userId: string,
    @Param('id') strategyId: string,
  ) {
    // 验证策略属于当前用户
    const strategy = await this.strategiesService.findOne(strategyId);
    if (!strategy || strategy.uploader_id !== userId) {
      throw new BadRequestException('策略不存在或无权访问');
    }

    const progress =
      await this.pricingService.getUpgradeProgress(strategyId);

    return {
      code: 0,
      message: 'success',
      data: progress,
    };
  }

  /**
   * 提现策略收益
   * Phase 16.9 - 创作者提现已结算的策略分成收益
   */
  @Post('revenue/withdraw')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '提现策略收益' })
  @ApiResponse({
    status: 200,
    description: '提现申请已提交',
  })
  @ApiResponse({ status: 400, description: '可提现金额不足或参数错误' })
  async withdrawRevenue(
    @CurrentUser('sub') userId: string,
    @Body() dto: WithdrawRevenueDto,
  ) {
    // 1. 检查可提现金额
    const stats = await this.strategiesService.calculateUserRevenueStats(userId);
    const Decimal = (await import('decimal.js')).default;
    const settledRevenue = new Decimal(stats.settledRevenue);
    const requestedAmount = new Decimal(dto.amount);

    if (requestedAmount.gt(settledRevenue)) {
      throw new BadRequestException(
        `可提现金额不足，当前可提现：${stats.settledRevenue} USDT`,
      );
    }

    // 2. 创建策略收益提现申请
    const withdrawal =
      await this.strategiesService.createRevenueWithdrawal(userId, {
        amount: dto.amount,
        chain: dto.chain,
        toAddress: dto.toAddress,
        totpCode: dto.totpCode,
      });

    return {
      code: 0,
      message: '提现申请已提交，预计 1-3 个工作日到账',
      data: {
        withdrawalId: withdrawal.id,
        amount: withdrawal.amount,
        fee: withdrawal.fee,
        chain: withdrawal.chain,
        status: withdrawal.status,
      },
    };
  }
}
