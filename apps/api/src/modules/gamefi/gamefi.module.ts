import { Module } from '@nestjs/common';
import { GamefiController } from './gamefi.controller';
import { GamefiService } from './gamefi.service';
import { PointsModule } from '../points/points.module';
import { StakingModule } from '../staking/staking.module';
import { TokensModule } from '../tokens/tokens.module';
import { PrismaModule } from '../../prisma/prisma.module';

/**
 * GameFi 模块
 * 整合积分、质押、代币功能，提供统一的 API 入口
 */
@Module({
  imports: [
    PrismaModule,
    PointsModule,
    StakingModule,
    TokensModule,
  ],
  controllers: [GamefiController],
  providers: [GamefiService],
  exports: [GamefiService],
})
export class GamefiModule {}
