import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { PrismaModule } from '../../prisma/prisma.module';

/**
 * 管理员模块
 * 提供管理后台相关功能：
 * - 平台统计
 * - 用户管理
 * - 财务审计
 * - 系统告警
 */
@Module({
  imports: [PrismaModule],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
