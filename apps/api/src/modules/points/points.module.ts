import { Module } from '@nestjs/common';
import { PointsController } from './points.controller';
import { PointsService } from './points.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { ConfigsModule } from '../configs/configs.module';

/**
 * 积分模块
 * 负责积分获取、抵扣、查询等功能
 *
 * 功能：
 * - 交易挖矿（每 100 USDT = 1 积分，VIP 加成）
 * - 积分抵扣订阅费
 * - 积分余额查询
 * - 积分流水查询
 */
@Module({
  imports: [PrismaModule, ConfigsModule],
  controllers: [PointsController],
  providers: [PointsService],
  exports: [PointsService], // 导出服务，供其他模块使用
})
export class PointsModule {}
