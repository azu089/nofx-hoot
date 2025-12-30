import { Module } from '@nestjs/common';
import { AgentsController } from './agents.controller';
import { AgentsService } from './agents.service';
import { PrismaModule } from '../../prisma/prisma.module';

/**
 * 代理商模块
 * 提供代理商注册、邀请、返佣等功能
 */
@Module({
  imports: [PrismaModule],
  controllers: [AgentsController],
  providers: [AgentsService],
  exports: [AgentsService], // 导出供其他模块使用（如计费模块）
})
export class AgentsModule {}
