/**
 * 代理商后台控制器
 * 提供业绩、用户、佣金、提现等接口
 */
import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { IsString, IsOptional } from 'class-validator';
import { AgentService } from './agent.service';
import { AgentGuard } from './guards/agent.guard';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';

interface AgentRequest extends Request {
  agent: {
    id: string;
    email: string;
    name: string;
    status: string;
    isActive: boolean;
    level: string;
    commissionRate: unknown;
  };
}

// DTOs
class WithdrawalDto {
  @IsString()
  amount: string;

  @IsString()
  settlementMethod: string;

  @IsString()
  @IsOptional()
  settlementAccount?: string;
}

@ApiTags('agent')
@Controller('agent')
@Public() // 跳过全局 JwtAuthGuard
@UseGuards(AgentGuard) // 使用 AgentGuard 进行认证
export class AgentController {
  constructor(private agentService: AgentService) {}

  // 获取业绩概览（首页）
  @Get('dashboard')
  async getDashboard(@Req() req: AgentRequest) {
    return this.agentService.getDashboard(req.agent.id);
  }

  // 获取名下用户列表
  @Get('users')
  async getUsers(
    @Req() req: AgentRequest,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('search') search?: string,
  ) {
    return this.agentService.getUsers(
      req.agent.id,
      parseInt(page, 10) || 1,
      Math.min(parseInt(limit, 10) || 20, 100),
      search,
    );
  }

  // 获取佣金记录
  @Get('commissions')
  async getCommissions(
    @Req() req: AgentRequest,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '50',
    @Query('status') status?: string,
    @Query('type') type?: string,
  ) {
    return this.agentService.getCommissions(
      req.agent.id,
      parseInt(page, 10) || 1,
      Math.min(parseInt(limit, 10) || 20, 100),
      status,
      type,
    );
  }

  // 获取结算记录
  @Get('settlements')
  async getSettlements(
    @Req() req: AgentRequest,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    return this.agentService.getSettlements(
      req.agent.id,
      parseInt(page, 10) || 1,
      Math.min(parseInt(limit, 10) || 20, 100),
    );
  }

  // 发起提现申请
  @Post('withdrawal')
  async requestWithdrawal(@Req() req: AgentRequest, @Body() dto: WithdrawalDto) {
    return this.agentService.requestWithdrawal(req.agent.id, dto);
  }

  // 获取统计趋势
  @Get('stats/trend')
  async getStatsTrend(@Req() req: AgentRequest) {
    return this.agentService.getStatsTrend(req.agent.id);
  }

  // ========== 代币收益相关 ==========

  // 获取代币资产概览
  @Get('token/assets')
  async getTokenAssets(@Req() req: AgentRequest) {
    return this.agentService.getTokenAssets(req.agent.id);
  }

  // 获取私募配额列表
  @Get('token/quotas')
  async getTokenQuotas(@Req() req: AgentRequest) {
    return this.agentService.getTokenQuotas(req.agent.id);
  }

  // 获取分红记录
  @Get('token/dividends')
  async getDividendRecords(
    @Req() req: AgentRequest,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    return this.agentService.getDividendRecords(
      req.agent.id,
      parseInt(page, 10) || 1,
      Math.min(parseInt(limit, 10) || 20, 100),
    );
  }
}
