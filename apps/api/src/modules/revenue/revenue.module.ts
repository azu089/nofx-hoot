import { Module } from '@nestjs/common';
import { RevenueController } from './revenue.controller';
import { RevenueService } from './revenue.service';

/**
 * 收入分配模块
 *
 * 功能：
 * - 计算周期收入
 * - 执行 40/40/20 分配
 * - 模拟回购（沙盒）
 * - 分配历史查询
 * - 统计数据
 */
@Module({
  controllers: [RevenueController],
  providers: [RevenueService],
  exports: [RevenueService], // 导出供其他模块使用
})
export class RevenueModule {}
