import { Controller, Get, Post, Body } from '@nestjs/common';
import { ReferralService } from './referral.service';
import { BindInviteCodeDto } from './dto/referral.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('referral')
export class ReferralController {
  constructor(private referralService: ReferralService) {}

  // 获取邀请统计
  @Get('stats')
  async getStats(@CurrentUser() user: { id: string }) {
    return this.referralService.getStats(user.id);
  }

  // 获取邀请码
  @Get('invite-code')
  async getInviteCode(@CurrentUser() user: { id: string }) {
    const inviteCode = await this.referralService.getOrCreateInviteCode(
      user.id,
    );
    return { inviteCode };
  }

  // 绑定邀请码
  @Post('bind')
  async bindInviteCode(
    @CurrentUser() user: { id: string },
    @Body() dto: BindInviteCodeDto,
  ) {
    await this.referralService.bindInviteCode(user.id, dto.inviteCode);
    return { message: '绑定成功' };
  }

  // 获取被邀请人列表
  @Get('invitees')
  async getInvitees(@CurrentUser() user: { id: string }) {
    return this.referralService.getInvitees(user.id);
  }

  // 获取返佣记录
  @Get('rewards')
  async getRewardRecords(@CurrentUser() user: { id: string }) {
    return this.referralService.getRewardRecords(user.id);
  }

  // 获取邀请综合信息（TG Bot 用）
  @Get('info')
  async getInviteInfo(@CurrentUser() user: { id: string }) {
    const [inviteCode, stats] = await Promise.all([
      this.referralService.getOrCreateInviteCode(user.id),
      this.referralService.getStats(user.id),
    ]);

    const webUrl = process.env.WEB_URL || 'https://hoot.cool';

    return {
      inviteCode,
      inviteLink: `${webUrl}/register?ref=${inviteCode}`,
      inviteeCount: stats.totalInvites,
      totalReward: stats.totalRewards,
    };
  }
}
