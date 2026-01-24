import { Module } from '@nestjs/common';
import { InstancesController } from './instances.controller';
import { InstancesService } from './instances.service';
import { InstanceLogService } from './instance-log.service';
import { InstanceDiagnosisService } from './instance-diagnosis.service';
import { InstanceRepairService } from './instance-repair.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { DigitalOceanModule } from '../digitalocean/digitalocean.module';
import { FreqtradeModule } from '../freqtrade/freqtrade.module';
import { BillingModule } from '../billing/billing.module';
import { EventsModule } from '../../events/events.module';
import { ZombieDetectionTask } from './tasks/zombie-detection.task';
import { StatusSyncTask } from './tasks/status-sync.task';

/**
 * VPS 实例模块
 * 负责 VPS 生命周期管理、心跳检测、监控、诊断修复等
 */
@Module({
  imports: [
    PrismaModule,
    DigitalOceanModule,
    FreqtradeModule,
    BillingModule,
    EventsModule, // 导入 EventsModule 用于实时推送
  ],
  controllers: [InstancesController],
  providers: [
    InstancesService,
    InstanceLogService,
    InstanceDiagnosisService,
    InstanceRepairService,
    ZombieDetectionTask,
    StatusSyncTask,
  ],
  exports: [InstancesService, InstanceLogService],
})
export class InstancesModule {}
