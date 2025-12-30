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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { StrategiesService } from './strategies.service';
import { BacktestService } from './backtest.service';
import { CreateStrategyConfigDto } from './dto/create-strategy-config.dto';
import { UpdateStrategyConfigDto } from './dto/update-strategy-config.dto';
import { StrategyResponseDto, StrategyDetailResponseDto } from './dto/strategy-response.dto';
import { StrategyConfigResponseDto } from './dto/strategy-config-response.dto';
import { BacktestRequestDto, BacktestResultDto } from './dto/backtest.dto';
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
  constructor(
    private readonly strategiesService: StrategiesService,
    private readonly backtestService: BacktestService,
  ) {}

  /**
   * 获取公开策略列表
   * 不需要认证，任何人都可以查看
   */
  @Public()
  @Get()
  @ApiOperation({ summary: '获取公开策略列表' })
  @ApiResponse({
    status: 200,
    description: '成功获取策略列表',
    type: [StrategyResponseDto],
  })
  async findAll() {
    return {
      code: 0,
      message: 'success',
      data: await this.strategiesService.findAll(),
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
   * 获取策略详情
   * 公开策略不需要认证即可查看
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
   * 需要 JWT 认证
   */
  @Post('backtest')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '执行策略回测' })
  @ApiResponse({
    status: 200,
    description: '回测完成',
    type: BacktestResultDto,
  })
  @ApiResponse({ status: 400, description: '参数错误' })
  @ApiResponse({ status: 404, description: '策略不存在' })
  async runBacktest(
    @CurrentUser('sub') userId: string,
    @Body() dto: BacktestRequestDto,
  ) {
    return {
      code: 0,
      message: 'success',
      data: await this.backtestService.runBacktest(userId, dto),
    };
  }
}
