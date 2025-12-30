import { Module } from '@nestjs/common';
import { ConfigsController, AdminConfigsController } from './configs.controller';
import { ConfigsService } from './configs.service';
import { PrismaModule } from '../../prisma/prisma.module';

/**
 * 配置中心模块
 * 提供系统配置的增删改查功能
 */
@Module({
  imports: [PrismaModule],
  controllers: [ConfigsController, AdminConfigsController],
  providers: [ConfigsService],
  exports: [ConfigsService],
})
export class ConfigsModule {}
