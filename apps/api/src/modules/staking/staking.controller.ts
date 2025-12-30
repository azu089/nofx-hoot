import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { StakingService } from './staking.service';
import { StakeDto } from './dto/stake.dto';

/**
 * 质押控制器
 *
 * 路由前缀：/api/staking
 * 注意：建议使用 /api/gamefi/* 统一入口
 */
@ApiTags('质押管理')
@Controller('staking')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class StakingController {
  constructor(private readonly stakingService: StakingService) {}

  /**
   * 质押
   * POST /api/staking/stake
   */
  @Post('stake')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '创建质押' })
  async stake(@Request() req: any, @Body() dto: StakeDto) {
    const userId = req.user.userId;

    return {
      code: 0,
      message: '质押成功',
      data: await this.stakingService.stake(userId, dto),
    };
  }

  /**
   * 解押
   * POST /api/staking/unstake/:id
   */
  @Post('unstake/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '解除质押' })
  async unstake(@Request() req: any, @Param('id') id: string) {
    const userId = req.user.userId;

    const result = await this.stakingService.unstake(id, userId);

    return {
      code: 0,
      message: '解押成功',
      data: result,
    };
  }

  /**
   * 领取收益
   * POST /api/staking/claim
   */
  @Post('claim')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '领取质押收益' })
  async claimRewards(@Request() req: any) {
    const userId = req.user.userId;

    return {
      code: 0,
      message: '领取成功',
      data: await this.stakingService.claimRewards(userId),
    };
  }

  /**
   * 查询质押列表
   * GET /api/staking/list
   */
  @Get('list')
  @ApiOperation({ summary: '获取质押列表' })
  async getStakes(@Request() req: any) {
    const userId = req.user.userId;

    return {
      code: 0,
      message: 'success',
      data: await this.stakingService.getStakes(userId),
    };
  }

  /**
   * 获取收益统计
   * GET /api/staking/rewards
   */
  @Get('rewards')
  @ApiOperation({ summary: '获取收益统计' })
  async getRewardStats(@Request() req: any) {
    const userId = req.user.userId;

    return {
      code: 0,
      message: 'success',
      data: await this.stakingService.getRewardStats(userId),
    };
  }
}
