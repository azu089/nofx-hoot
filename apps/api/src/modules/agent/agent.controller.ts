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
  Request,
} from '@nestjs/common';
import { IsString, IsOptional } from 'class-validator';
import { AgentService } from './agent.service';
import { AgentGuard } from './guards/agent.guard';
import { Public } from '../auth/decorators/public.decorator';

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

@Controller('agent')
@Public() // 跳过全局 JwtAuthGuard
@UseGuards(AgentGuard) // 使用 AgentGuard 进行认证
export class AgentController {
  constructor(private agentService: AgentService) {}

  // 获取业绩概览（首页）
  @Get('dashboard')
  async getDashboard(@Request() req: any) {
    return this.agentService.getDashboard(req.agent.id);
  }

  // 获取名下用户列表
  @Get('users')
  async getUsers(
    @Request() req: any,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('search') search?: string,
  ) {
    return this.agentService.getUsers(
      req.agent.id,
      parseInt(page),
      parseInt(limit),
      search,
    );
  }

  // 获取佣金记录
  @Get('commissions')
  async getCommissions(
    @Request() req: any,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '50',
    @Query('status') status?: string,
    @Query('type') type?: string,
  ) {
    return this.agentService.getCommissions(
      req.agent.id,
      parseInt(page),
      parseInt(limit),
      status,
      type,
    );
  }

  // 获取结算记录
  @Get('settlements')
  async getSettlements(
    @Request() req: any,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    return this.agentService.getSettlements(
      req.agent.id,
      parseInt(page),
      parseInt(limit),
    );
  }

  // 发起提现申请
  @Post('withdrawal')
  async requestWithdrawal(@Request() req: any, @Body() dto: WithdrawalDto) {
    return this.agentService.requestWithdrawal(req.agent.id, dto);
  }

  // 获取统计趋势
  @Get('stats/trend')
  async getStatsTrend(@Request() req: any) {
    return this.agentService.getStatsTrend(req.agent.id);
  }

  // ========== 代币收益相关 ==========

  // 获取代币资产概览
  @Get('token/assets')
  async getTokenAssets(@Request() req: any) {
    return this.agentService.getTokenAssets(req.agent.id);
  }

  // 获取私募配额列表
  @Get('token/quotas')
  async getTokenQuotas(@Request() req: any) {
    return this.agentService.getTokenQuotas(req.agent.id);
  }

  // 获取分红记录
  @Get('token/dividends')
  async getDividendRecords(
    @Request() req: any,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    return this.agentService.getDividendRecords(
      req.agent.id,
      parseInt(page),
      parseInt(limit),
    );
  }
}
