import { Controller, Get, Post, Body } from '@nestjs/common';
import { MembershipService } from './membership.service';
import { PurchaseMembershipDto } from './dto/membership.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';

@Controller('membership')
export class MembershipController {
  constructor(private membershipService: MembershipService) {}

  /**
   * 获取所有会员套餐（公开接口）
   */
  @Public()
  @Get('plans')
  async getPlans() {
    return this.membershipService.getPlans();
  }

  /**
   * 获取当前用户会员状态
   */
  @Get('status')
  async getStatus(@CurrentUser() user: { id: string }) {
    return this.membershipService.getMembershipStatus(user.id);
  }

  /**
   * 购买会员
   */
  @Post('purchase')
  async purchase(
    @CurrentUser() user: { id: string },
    @Body() dto: PurchaseMembershipDto,
  ) {
    return this.membershipService.purchaseMembership(user.id, dto);
  }

  /**
   * 获取订阅历史
   */
  @Get('history')
  async getHistory(@CurrentUser() user: { id: string }) {
    return this.membershipService.getSubscriptionHistory(user.id);
  }
}
