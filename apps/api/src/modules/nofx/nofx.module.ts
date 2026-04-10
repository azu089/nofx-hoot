import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { NofxController } from './nofx.controller';
import { NofxClient } from './nofx.client';
import { NofxUserSyncService } from './nofx-user-sync.service';
import { NofxService } from './nofx.service';
import { NofxEventsController } from './nofx-events.controller';
import { NofxEventsService } from './nofx-events.service';
import { InternalTokenGuard } from './internal-token.guard';
import { MembershipGateGuard } from './membership-gate.guard';
import { PrismaModule } from '../../prisma/prisma.module';
import { NOFX_CONFIG, loadNofxConfig } from './nofx.config';

/**
 * NofxModule —— HOOT 商业核心 → nofx 交易核心 的代理出口。
 *
 * P1 阶段仅一条 /api/nofx/health 冒烟接口；
 * P3+ 会在同一 module 下扩展只读 + 写代理路由。
 *
 * 隔离原则：所有出向 nofx 的代码必须落在此 module，
 * 业务模块（trading/ai/wallet）不得直接 import nofx 客户端。
 */
@Module({
  imports: [
    HttpModule.register({
      timeout: 5000,
      maxRedirects: 0,
    }),
    PrismaModule,
  ],
  controllers: [NofxController, NofxEventsController],
  providers: [
    {
      provide: NOFX_CONFIG,
      useFactory: loadNofxConfig,
    },
    NofxClient,
    NofxUserSyncService,
    NofxService,
    NofxEventsService,
    InternalTokenGuard,
    MembershipGateGuard,
  ],
  exports: [NofxClient, NofxUserSyncService, NofxService],
})
export class NofxModule {}
