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
import { StrategyDeployService } from './strategy-deploy.service';
import { InstancesService } from '../instances/instances.service';
import { InstanceLogService } from '../instances/instance-log.service';
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
import { NetworkWhitelistService } from '../../common/services/network-whitelist.service';

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
    private readonly deployService: StrategyDeployService,
    private readonly instancesService: InstancesService,
    private readonly instanceLogService: InstanceLogService,
    private readonly freqtradeService: FreqtradeService,
    private readonly networkWhitelistService: NetworkWhitelistService,
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

  // ==================== 日志 API（必须放在 :id 之前）====================

  /**
   * 获取交易日志
   * 合并 Freqtrade 交易日志 + 用户操作日志（API Key 绑定、策略部署等）
   *
   * 注意：此接口返回的是交易相关的所有日志，包括：
   * - Freqtrade 日志：策略执行、开单/平仓、信号触发
   * - 操作日志：API Key 绑定/验证、策略部署/启动/停止
   */
  @Get('trading-logs')
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取交易日志' })
  @ApiResponse({ status: 200, description: '成功获取日志' })
  @ApiResponse({ status: 400, description: '无可用 VPS' })
  async getTradingLogs(
    @CurrentUser('sub') userId: string,
    @Query('limit') limit?: string,
  ) {
    const logLimit = Math.min(parseInt(limit || '100', 10), 500);
    const allLogs: Array<{
      id: string;
      timestamp: string;
      level: string;
      message: string;
      source: 'trading' | 'operation';
    }> = [];

    // 1. 获取用户的运行中 VPS 实例
    const instances = await this.instancesService.findAllByUserId(userId);
    const activeInstance = instances.find(
      (i) => i.status === 'running' && i.ip_address,
    );

    // 2. 获取 Freqtrade 日志（如果 VPS 可用）
    if (activeInstance?.ip_address) {
      try {
        const apiToken = this.networkWhitelistService.generateFreqtradeToken(activeInstance.id);
        const result = await this.freqtradeService.getLogs(
          activeInstance.ip_address,
          logLimit,
          apiToken,
        );

        // 转换日志格式（移除 Freqtrade 敏感信息）
        result.logs.forEach((log, index) => {
          // 解析日志时间戳（Freqtrade 格式: "2024-01-15 10:30:45,123 - freqtrade.xxx - INFO - message"）
          const match = log.match(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})/);
          const timestamp = match
            ? new Date(match[1].replace(' ', 'T') + 'Z').toISOString()
            : new Date().toISOString();

          // 提取日志级别
          const levelMatch = log.match(/- (INFO|WARNING|ERROR|DEBUG) -/i);
          const level = levelMatch ? levelMatch[1].toLowerCase() : 'info';

          // 清理日志消息
          const sanitizedLog = log
            .replace(/Freqtrade/gi, '交易机器人')
            .replace(/freqtrade/gi, '交易机器人')
            .replace(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2},\d{3} - [\w.]+ - \w+ - /, '');

          allLogs.push({
            id: `ft-${Date.now()}-${index}`,
            timestamp,
            level: level === 'warning' ? 'warn' : level,
            message: sanitizedLog || log,
            source: 'trading',
          });
        });
      } catch (error: any) {
        this.logger.warn(`获取 Freqtrade 日志失败: ${error.message}`);
      }
    }

    // 3. 获取用户交易相关操作日志（API Key、策略操作等）
    const operationLogs = await this.instanceLogService.getTradingLogs(
      userId,
      logLimit,
      activeInstance?.id,
    );

    // 添加操作日志（带 action 类型）
    operationLogs.logs.forEach((log) => {
      allLogs.push({
        id: log.id,
        timestamp: log.timestamp,
        level: log.level,
        message: log.message,
        source: 'operation',
        action: log.action, // 保留 action 类型供前端识别
      } as any);
    });

    // 4. 按时间排序（最新的在前）
    allLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // 5. 限制返回数量
    const limitedLogs = allLogs.slice(0, logLimit);

    return {
      code: 0,
      message: 'success',
      data: {
        logs: limitedLogs,
        log_count: limitedLogs.length,
        instanceId: activeInstance?.id,
      },
    };
  }

  /**
   * 获取 VPS 系统日志
   * 从数据库读取 VPS 基础设施相关日志
   *
   * 注意：此接口返回的是 VPS 基础设施层面的日志，包括：
   * - VPS 创建/销毁
   * - 心跳状态
   * - 系统消息
   * - 错误日志
   *
   * 交易相关操作（API Key、策略部署等）请使用 /trading-logs 接口
   */
  @Get('vps-logs')
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取 VPS 系统日志' })
  @ApiResponse({ status: 200, description: '成功获取日志' })
  @ApiResponse({ status: 400, description: '无可用 VPS' })
  async getVpsLogs(
    @CurrentUser('sub') userId: string,
    @Query('limit') limit?: string,
  ) {
    // 1. 获取用户的运行中 VPS 实例
    const instances = await this.instancesService.findAllByUserId(userId);
    const activeInstance = instances.find(
      (i) => i.status === 'running' && i.ip_address,
    );

    // 2. 从数据库获取 VPS 系统日志（只获取基础设施相关的）
    const logLimit = Math.min(parseInt(limit || '100', 10), 500);
    const logsResult = await this.instanceLogService.getSystemLogs(
      userId,
      logLimit,
      activeInstance?.id,
    );

    // 3. 如果没有日志且有活跃实例，添加一条状态日志
    if (logsResult.logs.length === 0 && activeInstance) {
      return {
        code: 0,
        message: 'success',
        data: {
          logs: [
            {
              id: 'status-' + Date.now(),
              timestamp: new Date().toISOString(),
              level: 'info',
              action: 'system',
              message: `VPS 实例运行中 (IP: ${activeInstance.ip_address})`,
            },
          ],
          log_count: 1,
          instanceId: activeInstance?.id,
        },
      };
    }

    return {
      code: 0,
      message: 'success',
      data: {
        logs: logsResult.logs,
        log_count: logsResult.log_count,
        instanceId: activeInstance?.id,
      },
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
    let strategyCode: string | null = null;
    if (dto.strategyId) {
      const strategy = await this.strategiesService.findOne(dto.strategyId);
      if (strategy) {
        strategyName = strategy.name;
        strategyCode = strategy.content;
      }
    }

    this.logger.log(
      `用户 ${userId} 发起回测: 策略=${strategyName}, VPS=${activeInstance.ip_address}`,
    );

    // 3. 先上传策略代码到 VPS（如果有策略代码）
    if (strategyCode) {
      try {
        await this.deployService.uploadStrategyOnly(
          activeInstance.ip_address,
          strategyName,
          strategyCode,
          activeInstance.id,
        );
        this.logger.log(`策略 ${strategyName} 已上传到 VPS`);
      } catch (uploadError: any) {
        this.logger.warn(`策略上传失败（可能使用 VPS 已有策略）: ${uploadError.message}`);
        // 上传失败不阻断回测，VPS 上可能已有该策略
      }
    }

    // 4. 调用 Freqtrade 回测
    try {
      const apiToken = this.networkWhitelistService.generateFreqtradeToken(activeInstance.id);
      const result = await this.freqtradeService.runBacktest(
        activeInstance.ip_address,
        strategyName, // 策略名称，Freqtrade 会加载对应的策略文件
        {
          pairs: dto.pairs,
          startDate: dto.startDate,
          endDate: dto.endDate,
          initialCapital: dto.initialCapital,
        },
        apiToken,
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
    const apiToken = this.networkWhitelistService.generateFreqtradeToken(activeInstance.id);
    const backtestResult = await this.freqtradeService.runBacktest(
      activeInstance.ip_address,
      dto.name,
      {
        pairs: dto.backtestPairs,
        startDate: dto.backtestStartDate,
        endDate: dto.backtestEndDate,
        initialCapital: dto.backtestInitialCapital,
      },
      apiToken,
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

  // ==================== 策略部署与控制 API ====================

  /**
   * 部署策略到 VPS
   * 将用户的策略配置和代码部署到 VPS 上的 Freqtrade
   *
   * 前置条件：
   * 1. 用户已创建策略配置
   * 2. 用户已购买 VPS 实例并绑定到配置
   * 3. 用户已绑定交易所 API Key
   */
  @Post('configs/:id/deploy')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '部署策略到 VPS' })
  @ApiResponse({ status: 200, description: '部署成功' })
  @ApiResponse({ status: 400, description: '参数错误或前置条件不满足' })
  @ApiResponse({ status: 404, description: '配置不存在' })
  async deployStrategy(
    @CurrentUser('sub') userId: string,
    @Param('id') configId: string,
  ) {
    this.logger.log(`用户 ${userId} 请求部署策略配置: ${configId}`);

    const result = await this.deployService.deployStrategy(userId, configId);

    return {
      code: 0,
      message: result.message,
      data: {
        success: result.success,
        instanceId: result.instanceId,
        strategy: result.strategy,
      },
    };
  }

  /**
   * 启动 VPS 上的策略
   * 调用 Freqtrade 的 /start API
   */
  @Post('configs/:id/start')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '启动策略' })
  @ApiResponse({ status: 200, description: '启动成功' })
  @ApiResponse({ status: 400, description: 'VPS 实例不可用' })
  @ApiResponse({ status: 404, description: '配置不存在' })
  async startStrategy(
    @CurrentUser('sub') userId: string,
    @Param('id') configId: string,
  ) {
    this.logger.log(`用户 ${userId} 请求启动策略: ${configId}`);

    const result = await this.deployService.startStrategy(userId, configId);

    return {
      code: 0,
      message: result.message,
      data: {
        success: result.success,
      },
    };
  }

  /**
   * 停止 VPS 上的策略
   * 调用 Freqtrade 的 /stop API
   */
  @Post('configs/:id/stop')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '停止策略' })
  @ApiResponse({ status: 200, description: '停止成功' })
  @ApiResponse({ status: 400, description: 'VPS 实例不可用' })
  @ApiResponse({ status: 404, description: '配置不存在' })
  async stopStrategy(
    @CurrentUser('sub') userId: string,
    @Param('id') configId: string,
  ) {
    this.logger.log(`用户 ${userId} 请求停止策略: ${configId}`);

    const result = await this.deployService.stopStrategy(userId, configId);

    return {
      code: 0,
      message: result.message,
      data: {
        success: result.success,
      },
    };
  }

}
