import { Module, OnModuleInit } from '@nestjs/common';
import { MembershipController } from './membership.controller';
import { MembershipService } from './membership.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [MembershipController],
  providers: [MembershipService],
  exports: [MembershipService],
})
export class MembershipModule implements OnModuleInit {
  constructor(private membershipService: MembershipService) {}

  async onModuleInit() {
    // 初始化会员套餐数据
    await this.membershipService.initializePlans();
  }
}
