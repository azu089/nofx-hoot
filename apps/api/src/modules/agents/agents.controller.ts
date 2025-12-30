import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Request,
  Query,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AgentsService } from './agents.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterAgentDto } from './dto/register-agent.dto';
import { BindUserDto } from './dto/bind-user.dto';
import { WithdrawCommissionDto } from './dto/withdraw-commission.dto';

/**
 * 代理商控制器
 * 处理代理商相关的 HTTP 请求
 *
 * 路由前缀: /api/agents
 *
 * 认证模式：
 * - 用户通过 JWT 认证后，根据 user.agent_id 获取代理商信息
 * - 如果用户不是代理商（没有关联 agent_id），部分接口会返回错误
 */
@ApiTags('Agents')
@Controller('agents')
export class AgentsController {
  private readonly logger = new Logger(AgentsController.name);

  constructor(
    private readonly agentsService: AgentsService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * 从用户获取代理商 ID
   * 用户必须关联代理商才能使用代理商功能
   */
  private async getAgentIdFromUser(userId: string): Promise<string> {
    const user = await this.prisma.client.users.findUnique({
      where: { id: userId },
      select: { agent_id: true },
    });

    if (!user?.agent_id) {
      throw new BadRequestException('您还不是代理商，请先申请成为代理商');
    }

    return user.agent_id;
  }

  // ==================== 公开接口 ====================

  /**
   * POST /api/agents/register
   * 代理商注册（公开接口）
   */
  @Post('register')
  @ApiOperation({ summary: '代理商注册' })
  async register(@Body() dto: RegisterAgentDto) {
    const agent = await this.agentsService.register(dto);

    return {
      code: 0,
      message: '代理商注册成功',
      data: agent,
    };
  }

  // ==================== 认证接口 ====================

  /**
   * GET /api/agents/overview
   * 代理商概览（需要认证）
   */
  @Get('overview')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取代理商概览' })
  async getOverview(@Request() req: any) {
    const userId = req.user.userId;
    this.logger.log(`用户 ${userId} 获取代理商概览`);

    const agentId = await this.getAgentIdFromUser(userId);
    const stats = await this.agentsService.getStats(agentId);
    const profile = await this.agentsService.getProfile(agentId);

    return {
      code: 0,
      message: 'success',
      data: {
        profile,
        stats,
      },
    };
  }

  /**
   * GET /api/agents/profile
   * 获取代理商信息（需要认证）
   */
  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取代理商信息' })
  async getProfile(@Request() req: any) {
    const userId = req.user.userId;
    const agentId = await this.getAgentIdFromUser(userId);
    const profile = await this.agentsService.getProfile(agentId);

    return {
      code: 0,
      message: '获取成功',
      data: profile,
    };
  }

  /**
   * GET /api/agents/invite-code
   * 获取代理商邀请码（需要认证）
   */
  @Get('invite-code')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取邀请码' })
  async getInviteCode(@Request() req: any) {
    const userId = req.user.userId;
    const agentId = await this.getAgentIdFromUser(userId);
    const code = await this.agentsService.getInviteCode(agentId);

    return {
      code: 0,
      message: '获取成功',
      data: { inviteCode: code },
    };
  }

  /**
   * POST /api/agents/bind
   * 用户绑定邀请码（需要认证）
   */
  @Post('bind')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '绑定邀请码' })
  async bindUser(@Body() dto: BindUserDto, @Request() req: any) {
    const userId = req.user.userId;
    this.logger.log(`用户 ${userId} 绑定邀请码 ${dto.inviteCode}`);

    await this.agentsService.bindUser(userId, dto);

    return {
      code: 0,
      message: '绑定成功',
      data: null,
    };
  }

  /**
   * GET /api/agents/referrals
   * 获取下级用户列表（需要认证）
   */
  @Get('referrals')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取下级用户列表' })
  async getReferrals(@Request() req: any) {
    const userId = req.user.userId;
    const agentId = await this.getAgentIdFromUser(userId);
    const referrals = await this.agentsService.getReferrals(agentId);

    return {
      code: 0,
      message: '获取成功',
      data: referrals,
    };
  }

  /**
   * GET /api/agents/commissions
   * 获取佣金记录列表（需要认证）
   */
  @Get('commissions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取佣金记录' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getCommissions(
    @Request() req: any,
    @Query('limit') limit?: string,
  ) {
    const userId = req.user.userId;
    const agentId = await this.getAgentIdFromUser(userId);
    const commissions = await this.agentsService.getCommissions(
      agentId,
      limit ? parseInt(limit) : 50,
    );

    return {
      code: 0,
      message: '获取成功',
      data: commissions,
    };
  }

  /**
   * GET /api/agents/stats
   * 获取代理商统计数据（需要认证）
   */
  @Get('stats')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取统计数据' })
  async getStats(@Request() req: any) {
    const userId = req.user.userId;
    const agentId = await this.getAgentIdFromUser(userId);
    const stats = await this.agentsService.getStats(agentId);

    return {
      code: 0,
      message: '获取成功',
      data: stats,
    };
  }

  /**
   * POST /api/agents/withdraw
   * 佣金提现申请（需要认证）
   */
  @Post('withdraw')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '佣金提现' })
  async withdraw(@Body() dto: WithdrawCommissionDto, @Request() req: any) {
    const userId = req.user.userId;
    const agentId = await this.getAgentIdFromUser(userId);

    this.logger.log(`代理商 ${agentId} 申请提现 ${dto.amount}`);

    const result = await this.agentsService.withdraw(agentId, dto);

    return {
      code: 0,
      message: '提现申请已提交',
      data: result,
    };
  }

  /**
   * GET /api/agents/withdrawals
   * 获取提现历史（需要认证）
   */
  @Get('withdrawals')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取提现历史' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getWithdrawals(
    @Request() req: any,
    @Query('limit') limit?: string,
  ) {
    const userId = req.user.userId;
    const agentId = await this.getAgentIdFromUser(userId);
    const withdrawals = await this.agentsService.getWithdrawals(
      agentId,
      limit ? parseInt(limit) : 50,
    );

    return {
      code: 0,
      message: '获取成功',
      data: withdrawals,
    };
  }
}
