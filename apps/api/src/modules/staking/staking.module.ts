import { Module, forwardRef } from '@nestjs/common';
import { StakingController } from './staking.controller';
import { StakingService } from './staking.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { WalletsModule } from '../wallets/wallets.module';
import { TokensModule } from '../tokens/tokens.module';
import { ConfigsModule } from '../configs/configs.module';

/**
 * 质押模块
 *
 * 功能：
 * - 双轨质押系统（A 类/B 类）
 * - 权重归一化计算（1000积分 = 1 QFI 权重）
 * - 解押与惩罚
 * - 周分红分配
 */
@Module({
  imports: [
    PrismaModule,
    WalletsModule,
    forwardRef(() => TokensModule),
    ConfigsModule,
  ],
  controllers: [StakingController],
  providers: [StakingService],
  exports: [StakingService],
})
export class StakingModule {}
