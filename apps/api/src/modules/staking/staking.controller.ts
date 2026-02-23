import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { StakingService } from './staking.service';
import { CreateStakingDto } from './dto/staking.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('staking')
@Controller('staking')
export class StakingController {
  constructor(private stakingService: StakingService) {}

  // 创建质押
  @Post()
  async stake(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateStakingDto,
  ) {
    return this.stakingService.stake(user.id, dto);
  }

  // 解除质押
  @Post(':id/unstake')
  async unstake(
    @CurrentUser() user: { id: string },
    @Param('id') stakingId: string,
  ) {
    return this.stakingService.unstake(user.id, stakingId);
  }

  // 获取我的质押列表
  @Get('my')
  async getMyStakings(@CurrentUser() user: { id: string }) {
    return this.stakingService.getMyStakings(user.id);
  }

  // 获取我的质押统计
  @Get('my/stats')
  async getMyStats(@CurrentUser() user: { id: string }) {
    return this.stakingService.getMyStats(user.id);
  }

  // 获取我的分红历史
  @Get('my/dividends')
  async getMyDividends(@CurrentUser() user: { id: string }) {
    return this.stakingService.getMyDividends(user.id);
  }

  // 获取全网质押统计（公开）
  @Public()
  @Get('global-stats')
  async getGlobalStats() {
    return this.stakingService.getGlobalStats();
  }

  // 获取质押排行榜（公开）
  @Public()
  @Get('leaderboard')
  async getLeaderboard() {
    return this.stakingService.getLeaderboard();
  }

  // 领取奖励（检查是否有可领取的分红）
  @Post('claim')
  async claimRewards(@CurrentUser() user: { id: string }) {
    return this.stakingService.claimRewards(user.id);
  }
}
