import { Module } from '@nestjs/common';
import { StakingController } from './staking.controller';
import { StakingService } from './staking.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { WalletsModule } from '../wallets/wallets.module';

/**
 * 质押模块
 *
 * 功能：
 * - 双轨质押系统（A 类/B 类）
 * - 权重计算
 * - 解押与惩罚
 * - 收益分配（待实现）
 */
@Module({
  imports: [PrismaModule, WalletsModule],
  controllers: [StakingController],
  providers: [StakingService],
  exports: [StakingService],
})
export class StakingModule {}
