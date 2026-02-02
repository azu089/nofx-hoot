/**
 * 代理商模块
 * 独立于管理员后台，为代理商提供专属后台功能
 */
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AgentController } from './agent.controller';
import { AgentAuthController } from './agent-auth.controller';
import { AgentService } from './agent.service';
import { AgentAuthService } from './agent-auth.service';
import { AgentGuard } from './guards/agent.guard';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'hoot-agent-secret-key-2026',
      signOptions: { expiresIn: '24h' } as const,
    }),
  ],
  controllers: [AgentController, AgentAuthController],
  providers: [AgentService, AgentAuthService, AgentGuard],
  exports: [AgentService, AgentAuthService, AgentGuard],
})
export class AgentModule {}
