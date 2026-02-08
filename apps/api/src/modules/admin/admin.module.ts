import { Module, OnModuleInit, Global } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AdminController } from './admin.controller';
import { AdminAuthController } from './admin-auth.controller';
import { AdminContentController } from './admin-content.controller';
import { AdminService } from './admin.service';
import { AdminAuthService } from './admin-auth.service';
import { AdminGuard } from './guards/admin.guard';
import { PrismaModule } from '../../prisma/prisma.module';
import { StakingModule } from '../staking/staking.module';
import { TradingModule } from '../trading/trading.module';

// 新增的管理服务
import { AdminFinanceService } from './services/admin-finance.service';
import { AdminStatsService } from './services/admin-stats.service';
import { AdminAgentService } from './services/admin-agent.service';
import { AdminStakingService } from './services/admin-staking.service';
import { AdminTokenService } from './services/admin-token.service';
import { AdminReferralService } from './services/admin-referral.service';
import { AdminContentService } from './services/admin-content.service';
import { AdminSignalService } from './services/admin-signal.service';
import { AdminExchangeService } from './services/admin-exchange.service';
import { AdminConfigService } from './services/admin-config.service';
import { TranslateService } from '../../common/services/translate.service';

@Global() // 设置为全局模块，其他模块可以直接使用 AdminGuard
@Module({
  imports: [
    PrismaModule,
    StakingModule,
    TradingModule,
    JwtModule.register({
      secret: (() => {
        const secret = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET;
        if (!secret && process.env.NODE_ENV === 'production') {
          throw new Error('ADMIN_JWT_SECRET 环境变量未设置');
        }
        return secret || 'dev-only-admin-jwt-secret-do-not-use-in-production';
      })(),
      signOptions: { expiresIn: '24h' } as const,
    }),
  ],
  controllers: [AdminController, AdminAuthController, AdminContentController],
  providers: [
    AdminService,
    AdminAuthService,
    AdminGuard,
    // 新增服务
    AdminFinanceService,
    AdminStatsService,
    AdminAgentService,
    AdminStakingService,
    AdminTokenService,
    AdminReferralService,
    AdminContentService,
    AdminSignalService,
    AdminExchangeService,
    AdminConfigService,
    TranslateService,
  ],
  exports: [
    AdminService,
    AdminAuthService,
    AdminGuard,
    JwtModule,
    // 导出新服务
    AdminFinanceService,
    AdminStatsService,
    AdminAgentService,
    AdminStakingService,
    AdminTokenService,
    AdminReferralService,
  ],
})
export class AdminModule implements OnModuleInit {
  constructor(private adminAuthService: AdminAuthService) {}

  async onModuleInit() {
    // 启动时初始化默认管理员
    await this.adminAuthService.initDefaultAdmin();
  }
}
