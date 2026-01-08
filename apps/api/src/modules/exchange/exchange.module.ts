import { Module } from '@nestjs/common';
import { ExchangeController } from './exchange.controller';
import { ExchangeService } from './exchange.service';
import { PrismaModule } from '../../prisma/prisma.module';

/**
 * 资产兑换模块
 * 提供 USDT、点卡、积分、QFI代币 之间的闪兑功能
 *
 * 支持的兑换方向：
 * - USDT → 点卡 (1:1)
 * - USDT → QFI (市场价)
 * - 积分 → QFI (1000:1)
 * - QFI → USDT (市场价)
 */
@Module({
  imports: [PrismaModule],
  controllers: [ExchangeController],
  providers: [ExchangeService],
  exports: [ExchangeService],
})
export class ExchangeModule {}
