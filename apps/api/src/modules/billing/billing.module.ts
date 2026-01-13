import { Module, forwardRef } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { PointsModule } from '../points/points.module';
import { ConfigsModule } from '../configs/configs.module';

/**
 * 计费模块
 * 负责订阅计费、Gas 费抽成、代理商返佣等
 *
 * 积分联动：
 * - 订阅扣费时优先使用积分抵扣
 * - 积分抵扣比例：1 积分 = 1 USDT
 */
@Module({
  imports: [PrismaModule, forwardRef(() => PointsModule), ConfigsModule],
  controllers: [BillingController],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}
