import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { GamefiService } from './gamefi.service';
import { PointsService } from '../points/points.service';
import { StakingService } from '../staking/staking.service';
import { TokensService } from '../tokens/tokens.service';
import { StakeDto } from '../staking/dto/stake.dto';
import { ExchangeTokenDto } from '../tokens/dto/exchange-token.dto';

/**
 * GameFi 统一控制器
 * 整合积分、质押、代币功能，提供统一的 /api/gamefi/* 路由
 *
 * 路由设计：
 * - GET  /api/gamefi/overview - 概览数据
 * - GET  /api/gamefi/points - 积分余额
 * - GET  /api/gamefi/points/history - 积分流水
 * - GET  /api/gamefi/stakes - 质押列表
 * - POST /api/gamefi/stake - 创建质押
 * - POST /api/gamefi/unstake/:id - 解除质押
 * - POST /api/gamefi/claim - 领取收益
 * - GET  /api/gamefi/tokens/balance - 代币余额
 * - POST /api/gamefi/tokens/exchange - 积分兑换代币
 * - GET  /api/gamefi/tokens/vesting - 释放进度
 * - GET  /api/gamefi/leaderboard - 排行榜
 */
@ApiTags('GameFi')
@Controller('gamefi')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class GamefiController {
  private readonly logger = new Logger(GamefiController.name);

  constructor(
    private readonly gamefiService: GamefiService,
    private readonly pointsService: PointsService,
    private readonly stakingService: StakingService,
    private readonly tokensService: TokensService,
  ) {}

  // ==================== 概览 ====================

  /**
   * 获取 GameFi 概览数据
   * GET /api/gamefi/overview
   */
  @Get('overview')
  @ApiOperation({ summary: '获取 GameFi 概览数据' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getOverview(@Request() req: any) {
    const userId = req.user.userId;
    this.logger.log(`用户 ${userId} 获取 GameFi 概览`);

    const overview = await this.gamefiService.getOverview(userId);

    return {
      code: 0,
      message: 'success',
      data: overview,
    };
  }

  // ==================== 积分 ====================

  /**
   * 获取积分余额
   * GET /api/gamefi/points
   */
  @Get('points')
  @ApiOperation({ summary: '获取积分余额' })
  async getPointsBalance(@Request() req: any) {
    const userId = req.user.userId;
    const balance = await this.pointsService.getBalance(userId);

    return {
      code: 0,
      message: 'success',
      data: balance,
    };
  }

  /**
   * 获取积分流水
   * GET /api/gamefi/points/history
   */
  @Get('points/history')
  @ApiOperation({ summary: '获取积分流水' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getPointsHistory(
    @Request() req: any,
    @Query('limit') limit: string = '50',
  ) {
    const userId = req.user.userId;
    const limitNum = parseInt(limit, 10) || 50;

    const history = await this.pointsService.getHistory(userId, limitNum);

    return {
      code: 0,
      message: 'success',
      data: {
        history,
        total: history.length,
      },
    };
  }

  /**
   * 获取最近积分获取记录
   * GET /api/gamefi/points/recent
   */
  @Get('points/recent')
  @ApiOperation({ summary: '获取最近积分获取记录' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getRecentPointsEarnings(
    @Request() req: any,
    @Query('limit') limit: string = '10',
  ) {
    const userId = req.user.userId;
    const limitNum = parseInt(limit, 10) || 10;

    const earnings = await this.gamefiService.getRecentPointsEarnings(userId, limitNum);

    return {
      code: 0,
      message: 'success',
      data: earnings,
    };
  }

  // ==================== 质押 ====================

  /**
   * 获取质押列表
   * GET /api/gamefi/stakes
   */
  @Get('stakes')
  @ApiOperation({ summary: '获取质押列表' })
  async getStakes(@Request() req: any) {
    const userId = req.user.userId;
    const stakes = await this.stakingService.getStakes(userId);

    return {
      code: 0,
      message: 'success',
      data: stakes,
    };
  }

  /**
   * 获取质押统计
   * GET /api/gamefi/stakes/stats
   */
  @Get('stakes/stats')
  @ApiOperation({ summary: '获取质押统计' })
  async getStakeStats(@Request() req: any) {
    const userId = req.user.userId;
    const stats = await this.stakingService.getRewardStats(userId);

    return {
      code: 0,
      message: 'success',
      data: stats,
    };
  }

  /**
   * 创建质押
   * POST /api/gamefi/stake
   */
  @Post('stake')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '创建质押' })
  async stake(@Request() req: any, @Body() dto: StakeDto) {
    const userId = req.user.userId;
    this.logger.log(`用户 ${userId} 创建质押：${dto.stake_type} 类，金额 ${dto.amount}`);

    const stake = await this.stakingService.stake(userId, dto);

    return {
      code: 0,
      message: '质押成功',
      data: stake,
    };
  }

  /**
   * 解除质押
   * POST /api/gamefi/unstake/:id
   */
  @Post('unstake/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '解除质押' })
  async unstake(@Request() req: any, @Param('id') stakeId: string) {
    const userId = req.user.userId;
    this.logger.log(`用户 ${userId} 解除质押 ${stakeId}`);

    const result = await this.stakingService.unstake(stakeId, userId);

    return {
      code: 0,
      message: '解押成功',
      data: result,
    };
  }

  /**
   * 领取质押收益
   * POST /api/gamefi/claim
   */
  @Post('claim')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '领取质押收益' })
  async claimRewards(@Request() req: any) {
    const userId = req.user.userId;
    this.logger.log(`用户 ${userId} 领取质押收益`);

    const result = await this.stakingService.claimRewards(userId);

    return {
      code: 0,
      message: '领取成功',
      data: result,
    };
  }

  // ==================== 代币 ====================

  /**
   * 获取代币余额
   * GET /api/gamefi/tokens/balance
   */
  @Get('tokens/balance')
  @ApiOperation({ summary: '获取代币余额' })
  async getTokenBalance(@Request() req: any) {
    const userId = req.user.userId;
    const balance = await this.tokensService.getBalance(userId);

    return {
      code: 0,
      message: 'success',
      data: balance,
    };
  }

  /**
   * 积分兑换代币
   * POST /api/gamefi/tokens/exchange
   */
  @Post('tokens/exchange')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '积分兑换代币' })
  async exchangeTokens(@Request() req: any, @Body() dto: ExchangeTokenDto) {
    const userId = req.user.userId;
    this.logger.log(`用户 ${userId} 兑换代币：${dto.points} 积分，模式 ${dto.mode}`);

    const result = await this.tokensService.exchange(userId, dto.points, dto.mode);

    return {
      code: 0,
      message: 'success',
      data: result,
    };
  }

  /**
   * 获取代币释放进度
   * GET /api/gamefi/tokens/vesting
   */
  @Get('tokens/vesting')
  @ApiOperation({ summary: '获取代币释放进度' })
  async getVestingProgress(@Request() req: any) {
    const userId = req.user.userId;
    const progress = await this.tokensService.getVestingProgress(userId);

    return {
      code: 0,
      message: 'success',
      data: progress,
    };
  }

  /**
   * 获取兑换订单列表
   * GET /api/gamefi/tokens/orders
   */
  @Get('tokens/orders')
  @ApiOperation({ summary: '获取兑换订单列表' })
  async getTokenOrders(@Request() req: any) {
    const userId = req.user.userId;
    const orders = await this.tokensService.getOrders(userId);

    return {
      code: 0,
      message: 'success',
      data: orders,
    };
  }

  // ==================== 排行榜 ====================

  /**
   * 获取积分排行榜
   * GET /api/gamefi/leaderboard
   */
  @Get('leaderboard')
  @ApiOperation({ summary: '获取积分排行榜' })
  @ApiQuery({ name: 'period', required: false, enum: ['day', 'week', 'month', 'all'] })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  async getLeaderboard(
    @Request() req: any,
    @Query('period') period: 'day' | 'week' | 'month' | 'all' = 'all',
    @Query('limit') limit: string = '100',
    @Query('offset') offset: string = '0',
  ) {
    const userId = req.user.userId;
    const limitNum = Math.min(parseInt(limit, 10) || 100, 100); // 最多 100 条
    const offsetNum = parseInt(offset, 10) || 0;

    this.logger.log(`用户 ${userId} 查看排行榜：period=${period}, limit=${limitNum}, offset=${offsetNum}`);

    const leaderboard = await this.gamefiService.getLeaderboard(
      userId,
      period,
      limitNum,
      offsetNum,
    );

    return {
      code: 0,
      message: 'success',
      data: leaderboard,
    };
  }
}
