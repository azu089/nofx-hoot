import { Module } from '@nestjs/common';
import { WalletsController } from './wallets.controller';
import { WalletsService } from './wallets.service';
import { PrismaModule } from '../../prisma/prisma.module';

/**
 * 钱包模块
 * 负责用户资金管理、充值、提现、交易记录等
 */
@Module({
  imports: [PrismaModule],
  controllers: [WalletsController],
  providers: [WalletsService],
  exports: [WalletsService],
})
export class WalletsModule {}
