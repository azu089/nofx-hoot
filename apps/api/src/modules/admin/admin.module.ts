import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminEnhancedController } from './admin-enhanced.controller';
import { AdminEnhancedService } from './admin-enhanced.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { StakingModule } from '../staking/staking.module';

/**
 * 管理员模块
 * 提供管理后台相关功能：
 * - 平台统计
 * - 用户管理
 * - 财务审计
 * - 系统告警
 * - 黑名单管理
 * - 会话管理
 * - 弹窗公告
 * - 品牌配置
 * - CMS 内容管理
 * - VPS 监控
 * - 登录告警
 * - RBAC 权限
 * - 分红管理（周分红手动触发）
 */
@Module({
  imports: [PrismaModule, StakingModule],
  controllers: [AdminController, AdminEnhancedController],
  providers: [AdminService, AdminEnhancedService],
  exports: [AdminService, AdminEnhancedService],
})
export class AdminModule {}
