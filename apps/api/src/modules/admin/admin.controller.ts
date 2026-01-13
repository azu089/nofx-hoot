import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AdminGuard } from '../../common/guards/admin.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/dto/jwt-payload.dto';
import { AdminUsersQueryDto } from './dto/admin-users.dto';
import { AdminStatsQueryDto } from './dto/admin-stats.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateVipDto } from './dto/update-vip.dto';
import { CreateAnnouncementDto, UpdateAnnouncementDto } from './dto/announcement.dto';
import { CreateStrategyDto, UpdateStrategyDto } from './dto/strategy.dto';
import {
  SetAgentDto,
  UpdateAgentCommissionDto,
  SettleAgentCommissionDto,
  AgentListQueryDto,
} from './dto/agent.dto';

/**
 * 管理员控制器
 * 路由前缀: /api/admin
 * 所有接口都需要 JWT 认证 + Admin 权限
 */
@ApiTags('Admin')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  private readonly logger = new Logger(AdminController.name);

  constructor(private readonly adminService: AdminService) {}

  /**
   * 获取平台统计数据
   * GET /api/admin/stats
   */
  @Get('stats')
  async getStats(@CurrentUser() user: JwtPayload) {
    this.logger.log(`管理员 ${user.sub} 查询平台统计`);

    const stats = await this.adminService.getStats();

    return {
      code: 0,
      message: 'success',
      data: stats,
    };
  }

  /**
   * 获取最近活动
   * GET /api/admin/activities
   */
  @Get('activities')
  async getActivities(@CurrentUser() user: JwtPayload) {
    this.logger.log(`管理员 ${user.sub} 查询最近活动`);

    const activities = await this.adminService.getRecentActivities();

    return {
      code: 0,
      message: 'success',
      data: activities,
    };
  }

  /**
   * 获取系统告警
   * GET /api/admin/alerts
   */
  @Get('alerts')
  async getAlerts(@CurrentUser() user: JwtPayload) {
    this.logger.log(`管理员 ${user.sub} 查询系统告警`);

    const alerts = await this.adminService.getAlerts();

    return {
      code: 0,
      message: 'success',
      data: alerts,
    };
  }

  /**
   * 获取用户列表
   * GET /api/admin/users
   */
  @Get('users')
  async getUsers(
    @CurrentUser() user: JwtPayload,
    @Query() query: AdminUsersQueryDto,
  ) {
    this.logger.log(`管理员 ${user.sub} 查询用户列表`);

    const result = await this.adminService.getUsers(query);

    return {
      code: 0,
      message: 'success',
      data: result,
    };
  }

  /**
   * 封禁/解禁用户
   * POST /api/admin/users/:id/ban
   */
  @Post('users/:id/ban')
  @HttpCode(HttpStatus.OK)
  async banUser(
    @CurrentUser() admin: JwtPayload,
    @Param('id') userId: string,
  ) {
    this.logger.log(`管理员 ${admin.sub} 操作封禁用户 ${userId}`);

    const result = await this.adminService.banUser(userId, admin.sub);

    return {
      code: 0,
      message: result.newStatus === 'banned' ? '用户已封禁' : '用户已解禁',
      data: result,
    };
  }

  /**
   * 重置用户密码
   * POST /api/admin/users/:id/reset-password
   */
  @Post('users/:id/reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @CurrentUser() admin: JwtPayload,
    @Param('id') userId: string,
  ) {
    this.logger.log(`管理员 ${admin.sub} 重置用户 ${userId} 密码`);

    const result = await this.adminService.resetPassword(userId, admin.sub);

    return {
      code: 0,
      message: '密码已重置',
      data: result,
    };
  }

  // ==================== 用户详情相关 ====================

  /**
   * 获取用户详情
   * GET /api/admin/users/:id
   */
  @Get('users/:id')
  @ApiOperation({ summary: '获取用户详情' })
  async getUserDetail(
    @CurrentUser() admin: JwtPayload,
    @Param('id') userId: string,
  ) {
    this.logger.log(`管理员 ${admin.sub} 查询用户 ${userId} 详情`);

    const user = await this.adminService.getUserDetail(userId);

    return {
      code: 0,
      message: 'success',
      data: user,
    };
  }

  /**
   * 更新用户信息
   * PATCH /api/admin/users/:id
   */
  @Patch('users/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '更新用户信息' })
  async updateUser(
    @CurrentUser() admin: JwtPayload,
    @Param('id') userId: string,
    @Body() dto: UpdateUserDto,
  ) {
    this.logger.log(`管理员 ${admin.sub} 更新用户 ${userId} 信息`);

    const result = await this.adminService.updateUser(userId, dto, admin.sub);

    return {
      code: 0,
      message: '用户信息已更新',
      data: result,
    };
  }

  /**
   * 调整 VIP 等级
   * PATCH /api/admin/users/:id/vip
   */
  @Patch('users/:id/vip')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '调整用户 VIP 等级' })
  async updateVipLevel(
    @CurrentUser() admin: JwtPayload,
    @Param('id') userId: string,
    @Body() dto: UpdateVipDto,
  ) {
    this.logger.log(`管理员 ${admin.sub} 调整用户 ${userId} VIP 等级`);

    const result = await this.adminService.updateVipLevel(userId, dto, admin.sub);

    return {
      code: 0,
      message: 'VIP 等级已更新',
      data: result,
    };
  }

  /**
   * 获取用户交易历史
   * GET /api/admin/users/:id/trades
   */
  @Get('users/:id/trades')
  @ApiOperation({ summary: '获取用户交易历史' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getUserTrades(
    @CurrentUser() admin: JwtPayload,
    @Param('id') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    this.logger.log(`管理员 ${admin.sub} 查询用户 ${userId} 交易历史`);

    const result = await this.adminService.getUserTrades(userId, {
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
    });

    return {
      code: 0,
      message: 'success',
      data: result,
    };
  }

  /**
   * 获取用户 VPS 列表
   * GET /api/admin/users/:id/instances
   */
  @Get('users/:id/instances')
  @ApiOperation({ summary: '获取用户 VPS 列表' })
  async getUserInstances(
    @CurrentUser() admin: JwtPayload,
    @Param('id') userId: string,
  ) {
    this.logger.log(`管理员 ${admin.sub} 查询用户 ${userId} VPS 列表`);

    const instances = await this.adminService.getUserInstances(userId);

    return {
      code: 0,
      message: 'success',
      data: instances,
    };
  }

  /**
   * 获取用户钱包流水
   * GET /api/admin/users/:id/billing
   */
  @Get('users/:id/billing')
  @ApiOperation({ summary: '获取用户钱包流水' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getUserBilling(
    @CurrentUser() admin: JwtPayload,
    @Param('id') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    this.logger.log(`管理员 ${admin.sub} 查询用户 ${userId} 钱包流水`);

    const result = await this.adminService.getUserBilling(userId, {
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
    });

    return {
      code: 0,
      message: 'success',
      data: result,
    };
  }

  /**
   * 获取用户登录日志
   * GET /api/admin/users/:id/login-logs
   */
  @Get('users/:id/login-logs')
  @ApiOperation({ summary: '获取用户登录日志' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getUserLoginLogs(
    @CurrentUser() admin: JwtPayload,
    @Param('id') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    this.logger.log(`管理员 ${admin.sub} 查询用户 ${userId} 登录日志`);

    const result = await this.adminService.getUserLoginLogs(userId, {
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
    });

    return {
      code: 0,
      message: 'success',
      data: result,
    };
  }

  /**
   * 获取财务统计
   * GET /api/admin/finance/stats
   */
  @Get('finance/stats')
  async getFinanceStats(
    @CurrentUser() user: JwtPayload,
    @Query() query: AdminStatsQueryDto,
  ) {
    this.logger.log(`管理员 ${user.sub} 查询财务统计`);

    const stats = await this.adminService.getFinanceStats(query.period);

    return {
      code: 0,
      message: 'success',
      data: stats,
    };
  }

  /**
   * 获取财务交易记录
   * GET /api/admin/finance/transactions
   */
  @Get('finance/transactions')
  @ApiOperation({ summary: '获取财务交易记录' })
  async getFinanceTransactions(
    @CurrentUser() user: JwtPayload,
    @Query('page') page: number = 1,
  ) {
    this.logger.log(`管理员 ${user.sub} 查询财务交易记录`);

    const result = await this.adminService.getFinanceTransactions(page);

    return {
      code: 0,
      message: 'success',
      data: result,
    };
  }

  // ==================== VPS 监控 ====================

  /**
   * 获取 VPS 实例列表
   * GET /api/admin/instances
   */
  @Get('instances')
  @ApiOperation({ summary: '获取 VPS 实例列表' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, type: String })
  async getInstances(
    @CurrentUser() user: JwtPayload,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    this.logger.log(`管理员 ${user.sub} 查询 VPS 实例列表`);

    const result = await this.adminService.getInstances({
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
      status,
    });

    return {
      code: 0,
      message: 'success',
      data: result,
    };
  }

  /**
   * 停止 VPS 实例
   * POST /api/admin/instances/:id/stop
   */
  @Post('instances/:id/stop')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '停止 VPS 实例' })
  @ApiParam({ name: 'id', description: '实例 ID' })
  async stopInstance(
    @CurrentUser() admin: JwtPayload,
    @Param('id') instanceId: string,
  ) {
    this.logger.log(`管理员 ${admin.sub} 停止实例 ${instanceId}`);

    const result = await this.adminService.stopInstance(instanceId, admin.sub);

    return {
      code: 0,
      message: '实例已停止',
      data: result,
    };
  }

  // ==================== 提现审核 ====================

  /**
   * 获取提现列表
   * GET /api/admin/withdrawals
   */
  @Get('withdrawals')
  @ApiOperation({ summary: '获取提现列表' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, type: String })
  async getWithdrawals(
    @CurrentUser() user: JwtPayload,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    this.logger.log(`管理员 ${user.sub} 查询提现列表`);

    const result = await this.adminService.getWithdrawals({
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
      status: status || 'pending',
    });

    return {
      code: 0,
      message: 'success',
      data: result,
    };
  }

  /**
   * 批准提现
   * POST /api/admin/withdrawals/:id/approve
   */
  @Post('withdrawals/:id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '批准提现' })
  @ApiParam({ name: 'id', description: '提现记录 ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        txHash: { type: 'string', description: '链上交易哈希（可选）' },
      },
    },
  })
  async approveWithdrawal(
    @CurrentUser() admin: JwtPayload,
    @Param('id') withdrawalId: string,
    @Body('txHash') txHash?: string,
  ) {
    this.logger.log(`管理员 ${admin.sub} 批准提现 ${withdrawalId}`);

    const result = await this.adminService.approveWithdrawal(
      withdrawalId,
      admin.sub,
      txHash,
    );

    return {
      code: 0,
      message: '提现已批准',
      data: result,
    };
  }

  /**
   * 拒绝提现
   * POST /api/admin/withdrawals/:id/reject
   */
  @Post('withdrawals/:id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '拒绝提现' })
  @ApiParam({ name: 'id', description: '提现记录 ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: '拒绝原因（可选）' },
      },
    },
  })
  async rejectWithdrawal(
    @CurrentUser() admin: JwtPayload,
    @Param('id') withdrawalId: string,
    @Body('reason') reason?: string,
  ) {
    this.logger.log(`管理员 ${admin.sub} 拒绝提现 ${withdrawalId}`);

    const result = await this.adminService.rejectWithdrawal(
      withdrawalId,
      admin.sub,
      reason,
    );

    return {
      code: 0,
      message: '提现已拒绝，余额已退还',
      data: result,
    };
  }

  // ==================== 代理商提现审核 ====================

  /**
   * 获取代理商提现列表
   * GET /api/admin/agents/withdrawals
   */
  @Get('agents/withdrawals')
  @ApiOperation({ summary: '获取代理商提现列表' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, type: String })
  async getAgentWithdrawals(
    @CurrentUser() admin: JwtPayload,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    this.logger.log(`管理员 ${admin.sub} 查询代理商提现列表`);

    const result = await this.adminService.getAgentWithdrawals({
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
      status,
    });

    return {
      code: 0,
      message: 'success',
      data: result,
    };
  }

  /**
   * 批准代理商提现
   * POST /api/admin/agents/withdrawals/:id/approve
   */
  @Post('agents/withdrawals/:id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '批准代理商提现' })
  @ApiParam({ name: 'id', description: '提现记录 ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        txHash: { type: 'string', description: '链上交易哈希（可选）' },
      },
    },
  })
  async approveAgentWithdrawal(
    @CurrentUser() admin: JwtPayload,
    @Param('id') withdrawalId: string,
    @Body('txHash') txHash?: string,
  ) {
    this.logger.log(`管理员 ${admin.sub} 批准代理商提现 ${withdrawalId}`);

    const result = await this.adminService.approveAgentWithdrawal(
      withdrawalId,
      admin.sub,
      txHash,
    );

    return {
      code: 0,
      message: '代理商提现已批准',
      data: result,
    };
  }

  /**
   * 拒绝代理商提现
   * POST /api/admin/agents/withdrawals/:id/reject
   */
  @Post('agents/withdrawals/:id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '拒绝代理商提现' })
  @ApiParam({ name: 'id', description: '提现记录 ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: '拒绝原因（可选）' },
      },
    },
  })
  async rejectAgentWithdrawal(
    @CurrentUser() admin: JwtPayload,
    @Param('id') withdrawalId: string,
    @Body('reason') reason?: string,
  ) {
    this.logger.log(`管理员 ${admin.sub} 拒绝代理商提现 ${withdrawalId}`);

    const result = await this.adminService.rejectAgentWithdrawal(
      withdrawalId,
      admin.sub,
      reason,
    );

    return {
      code: 0,
      message: '代理商提现已拒绝',
      data: result,
    };
  }

  // ==================== 公告管理 ====================

  /**
   * 获取公告列表
   * GET /api/admin/announcements
   */
  @Get('announcements')
  @ApiOperation({ summary: '获取公告列表' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getAnnouncements(
    @CurrentUser() admin: JwtPayload,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    this.logger.log(`管理员 ${admin.sub} 查询公告列表`);

    const result = await this.adminService.getAnnouncements({
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
    });

    return {
      code: 0,
      message: 'success',
      data: result,
    };
  }

  /**
   * 创建公告
   * POST /api/admin/announcements
   */
  @Post('announcements')
  @ApiOperation({ summary: '创建公告' })
  async createAnnouncement(
    @CurrentUser() admin: JwtPayload,
    @Body() dto: CreateAnnouncementDto,
  ) {
    this.logger.log(`管理员 ${admin.sub} 创建公告: ${dto.title}`);

    const announcement = await this.adminService.createAnnouncement(dto, admin.sub);

    return {
      code: 0,
      message: '公告创建成功',
      data: announcement,
    };
  }

  /**
   * 更新公告
   * PATCH /api/admin/announcements/:id
   */
  @Patch('announcements/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '更新公告' })
  async updateAnnouncement(
    @CurrentUser() admin: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateAnnouncementDto,
  ) {
    this.logger.log(`管理员 ${admin.sub} 更新公告 ${id}`);

    const announcement = await this.adminService.updateAnnouncement(id, dto, admin.sub);

    return {
      code: 0,
      message: '公告更新成功',
      data: announcement,
    };
  }

  /**
   * 删除公告
   * DELETE /api/admin/announcements/:id
   */
  @Delete('announcements/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '删除公告' })
  async deleteAnnouncement(
    @CurrentUser() admin: JwtPayload,
    @Param('id') id: string,
  ) {
    this.logger.log(`管理员 ${admin.sub} 删除公告 ${id}`);

    await this.adminService.deleteAnnouncement(id, admin.sub);

    return {
      code: 0,
      message: '公告删除成功',
      data: null,
    };
  }

  // ==================== 策略管理 ====================

  /**
   * 获取策略列表（管理视图）
   * GET /api/admin/strategies
   */
  @Get('strategies')
  @ApiOperation({ summary: '获取策略列表（含订阅数）' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getStrategies(
    @CurrentUser() admin: JwtPayload,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    this.logger.log(`管理员 ${admin.sub} 查询策略列表`);

    const result = await this.adminService.getStrategies({
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
    });

    return {
      code: 0,
      message: 'success',
      data: result,
    };
  }

  /**
   * 创建策略
   * POST /api/admin/strategies
   */
  @Post('strategies')
  @ApiOperation({ summary: '创建策略' })
  async createStrategy(
    @CurrentUser() admin: JwtPayload,
    @Body() dto: CreateStrategyDto,
  ) {
    this.logger.log(`管理员 ${admin.sub} 创建策略: ${dto.name}`);

    const strategy = await this.adminService.createStrategy(dto, admin.sub);

    return {
      code: 0,
      message: '策略创建成功',
      data: strategy,
    };
  }

  // ==================== 策略审核 (Phase 16) ====================

  /**
   * 获取待审核策略列表
   * GET /api/admin/strategies/pending-review
   * 注意：此路由必须在 strategies/:id 之前定义
   */
  @Get('strategies/pending-review')
  @ApiOperation({ summary: '获取待审核策略列表' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getPendingStrategies(
    @CurrentUser() admin: JwtPayload,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    this.logger.log(`管理员 ${admin.sub} 查询待审核策略列表`);

    const result = await this.adminService.getPendingStrategies({
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
    });

    return {
      code: 0,
      message: 'success',
      data: result,
    };
  }

  /**
   * 获取策略详情
   * GET /api/admin/strategies/:id
   */
  @Get('strategies/:id')
  @ApiOperation({ summary: '获取策略详情' })
  async getStrategyDetail(
    @CurrentUser() admin: JwtPayload,
    @Param('id') id: string,
  ) {
    this.logger.log(`管理员 ${admin.sub} 查询策略 ${id} 详情`);

    const strategy = await this.adminService.getStrategyDetail(id);

    return {
      code: 0,
      message: 'success',
      data: strategy,
    };
  }

  /**
   * 更新策略
   * PATCH /api/admin/strategies/:id
   */
  @Patch('strategies/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '更新策略' })
  async updateStrategy(
    @CurrentUser() admin: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateStrategyDto,
  ) {
    this.logger.log(`管理员 ${admin.sub} 更新策略 ${id}`);

    const strategy = await this.adminService.updateStrategy(id, dto, admin.sub);

    return {
      code: 0,
      message: '策略更新成功',
      data: strategy,
    };
  }

  /**
   * 删除策略
   * DELETE /api/admin/strategies/:id
   */
  @Delete('strategies/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '删除策略' })
  async deleteStrategy(
    @CurrentUser() admin: JwtPayload,
    @Param('id') id: string,
  ) {
    this.logger.log(`管理员 ${admin.sub} 删除策略 ${id}`);

    await this.adminService.deleteStrategy(id, admin.sub);

    return {
      code: 0,
      message: '策略删除成功',
      data: null,
    };
  }

  /**
   * 上架/下架策略
   * POST /api/admin/strategies/:id/toggle
   */
  @Post('strategies/:id/toggle')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '上架/下架策略' })
  async toggleStrategy(
    @CurrentUser() admin: JwtPayload,
    @Param('id') id: string,
  ) {
    this.logger.log(`管理员 ${admin.sub} 切换策略 ${id} 状态`);

    const result = await this.adminService.toggleStrategy(id, admin.sub);

    return {
      code: 0,
      message: result.isActive ? '策略已上架' : '策略已下架',
      data: result,
    };
  }

  /**
   * 审核通过策略
   * POST /api/admin/strategies/:id/approve
   */
  @Post('strategies/:id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '审核通过策略' })
  async approveStrategy(
    @CurrentUser() admin: JwtPayload,
    @Param('id') id: string,
  ) {
    this.logger.log(`管理员 ${admin.sub} 审核通过策略 ${id}`);

    const result = await this.adminService.approveStrategy(id, admin.sub);

    return {
      code: 0,
      message: '策略审核通过',
      data: result,
    };
  }

  /**
   * 拒绝策略
   * POST /api/admin/strategies/:id/reject
   */
  @Post('strategies/:id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '拒绝策略' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: '拒绝原因' },
      },
      required: ['reason'],
    },
  })
  async rejectStrategy(
    @CurrentUser() admin: JwtPayload,
    @Param('id') id: string,
    @Body('reason') reason: string,
  ) {
    this.logger.log(`管理员 ${admin.sub} 拒绝策略 ${id}`);

    const result = await this.adminService.rejectStrategy(id, admin.sub, reason);

    return {
      code: 0,
      message: '策略已拒绝',
      data: result,
    };
  }

  // ==================== 审计日志 ====================

  /**
   * 获取审计日志
   * GET /api/admin/audit-logs
   */
  @Get('audit-logs')
  @ApiOperation({ summary: '获取审计日志' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'action', required: false, type: String })
  async getAuditLogs(
    @CurrentUser() admin: JwtPayload,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('action') action?: string,
  ) {
    this.logger.log(`管理员 ${admin.sub} 查询审计日志`);

    const result = await this.adminService.getAuditLogs({
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 50,
      action,
    });

    return {
      code: 0,
      message: 'success',
      data: result,
    };
  }

  // ==================== Kill Switch ====================

  /**
   * 获取 Kill Switch 状态
   * GET /api/admin/kill-switch/status
   */
  @Get('kill-switch/status')
  @ApiOperation({ summary: '获取 Kill Switch 状态' })
  async getKillSwitchStatus() {
    const data = await this.adminService.getKillSwitchStatus();
    return {
      code: 0,
      message: 'success',
      data,
    };
  }

  /**
   * 紧急停机
   * POST /api/admin/kill-switch
   */
  @Post('kill-switch')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '紧急停机 - 停止所有运行中的 VPS' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['reason'],
      properties: {
        reason: { type: 'string', description: '紧急停机原因' },
      },
    },
  })
  async killSwitch(
    @CurrentUser() admin: JwtPayload,
    @Body('reason') reason: string,
  ) {
    if (!reason) {
      return {
        code: 40001,
        message: '必须提供紧急停机原因',
        data: null,
      };
    }

    this.logger.warn(`⚠️ 管理员 ${admin.sub} 触发 Kill Switch: ${reason}`);

    const result = await this.adminService.killSwitch(admin.sub, reason);

    return {
      code: 0,
      message: result.message,
      data: result,
    };
  }

  // ==================== 充值管理 ====================

  /**
   * 获取充值列表
   * GET /api/admin/deposits
   */
  @Get('deposits')
  @ApiOperation({ summary: '获取充值列表' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, enum: ['pending', 'approved', 'rejected'] })
  async getDeposits(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    const data = await this.adminService.getDeposits({
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
      status,
    });

    return {
      code: 0,
      message: 'success',
      data,
    };
  }

  /**
   * 审核通过充值
   * POST /api/admin/deposits/:id/approve
   */
  @Post('deposits/:id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '审核通过充值' })
  async approveDeposit(
    @CurrentUser() admin: JwtPayload,
    @Param('id') depositId: string,
  ) {
    const result = await this.adminService.approveDeposit(depositId, admin.sub);

    return {
      code: 0,
      message: '充值已审核通过',
      data: result,
    };
  }

  /**
   * 拒绝充值
   * POST /api/admin/deposits/:id/reject
   */
  @Post('deposits/:id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '拒绝充值' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: '拒绝原因' },
      },
    },
  })
  async rejectDeposit(
    @CurrentUser() admin: JwtPayload,
    @Param('id') depositId: string,
    @Body('reason') reason?: string,
  ) {
    const result = await this.adminService.rejectDeposit(depositId, admin.sub, reason);

    return {
      code: 0,
      message: '充值已拒绝',
      data: result,
    };
  }

  // ==================== 手动余额调整 ====================

  /**
   * 手动调整用户余额
   * POST /api/admin/users/:id/adjust-balance
   */
  @Post('users/:id/adjust-balance')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '手动调整用户余额' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['type', 'amount', 'reason'],
      properties: {
        type: { type: 'string', enum: ['add', 'deduct'], description: '操作类型' },
        amount: { type: 'string', description: '金额' },
        reason: { type: 'string', description: '调整原因' },
      },
    },
  })
  async adjustBalance(
    @CurrentUser() admin: JwtPayload,
    @Param('id') userId: string,
    @Body() body: { type: 'add' | 'deduct'; amount: string; reason: string },
  ) {
    if (!body.type || !body.amount || !body.reason) {
      return {
        code: 40001,
        message: '缺少必要参数',
        data: null,
      };
    }

    const result = await this.adminService.adjustBalance(admin.sub, userId, body);

    return {
      code: 0,
      message: `余额${body.type === 'add' ? '加款' : '扣款'}成功`,
      data: result,
    };
  }

  /**
   * 获取余额调整记录
   * GET /api/admin/balance-adjustments
   */
  @Get('balance-adjustments')
  @ApiOperation({ summary: '获取余额调整记录' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'userId', required: false, type: String })
  async getBalanceAdjustments(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('userId') userId?: string,
  ) {
    const data = await this.adminService.getBalanceAdjustments({
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
      userId,
    });

    return {
      code: 0,
      message: 'success',
      data,
    };
  }

  // ==================== 代理商管理 ====================

  /**
   * 获取代理商列表
   * GET /api/admin/agents
   */
  @Get('agents')
  @ApiOperation({ summary: '获取代理商列表' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, enum: ['active', 'suspended', 'pending'] })
  async getAgents(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    const data = await this.adminService.getAgents({
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
      search,
      status,
    });

    return {
      code: 0,
      message: 'success',
      data,
    };
  }

  /**
   * 获取代理商详情
   * GET /api/admin/agents/:id
   */
  @Get('agents/:id')
  @ApiOperation({ summary: '获取代理商详情' })
  async getAgentDetail(@Param('id') agentId: string) {
    const data = await this.adminService.getAgentDetail(agentId);

    return {
      code: 0,
      message: 'success',
      data,
    };
  }

  /**
   * 更新代理商配置
   * PATCH /api/admin/agents/:id
   */
  @Patch('agents/:id')
  @ApiOperation({ summary: '更新代理商配置' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        commissionRate: { type: 'string', description: '佣金比例 (0-1)' },
        status: { type: 'string', enum: ['active', 'suspended'], description: '状态' },
        name: { type: 'string', description: '代理商名称' },
      },
    },
  })
  async updateAgent(
    @CurrentUser() admin: JwtPayload,
    @Param('id') agentId: string,
    @Body() body: { commissionRate?: string; status?: string; name?: string },
  ) {
    this.logger.log(`管理员 ${admin.sub} 更新代理商 ${agentId}`);

    const result = await this.adminService.updateAgent(admin.sub, agentId, body);

    return {
      code: 0,
      message: '代理商配置更新成功',
      data: result,
    };
  }

  /**
   * 将用户设置为代理商
   * POST /api/admin/users/:id/promote-to-agent
   */
  @Post('users/:id/promote-to-agent')
  @ApiOperation({ summary: '将用户设置为代理商' })
  @ApiParam({ name: 'id', description: '用户 ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '代理商名称' },
        commissionRate: { type: 'string', description: '佣金比例 (0-1)', example: '0.10' },
      },
      required: ['name'],
    },
  })
  async promoteUserToAgent(
    @CurrentUser() admin: JwtPayload,
    @Param('id') userId: string,
    @Body() body: { name: string; commissionRate?: string },
  ) {
    this.logger.log(`管理员 ${admin.sub} 将用户 ${userId} 设置为代理商`);

    const result = await this.adminService.promoteUserToAgent(admin.sub, userId, body);

    return {
      code: 0,
      message: '用户已成功设置为代理商',
      data: result,
    };
  }

  /**
   * 撤销用户的代理商身份
   * POST /api/admin/users/:id/revoke-agent
   */
  @Post('users/:id/revoke-agent')
  @ApiOperation({ summary: '撤销用户的代理商身份' })
  @ApiParam({ name: 'id', description: '用户 ID' })
  async revokeAgentStatus(
    @CurrentUser() admin: JwtPayload,
    @Param('id') userId: string,
  ) {
    this.logger.log(`管理员 ${admin.sub} 撤销用户 ${userId} 的代理商身份`);

    const result = await this.adminService.revokeAgentStatus(admin.sub, userId);

    return {
      code: 0,
      message: result.message,
      data: result,
    };
  }

  /**
   * 检查用户是否为代理商
   * GET /api/admin/users/:id/agent-status
   */
  @Get('users/:id/agent-status')
  @ApiOperation({ summary: '检查用户是否为代理商' })
  @ApiParam({ name: 'id', description: '用户 ID' })
  async checkUserAgentStatus(@Param('id') userId: string) {
    const result = await this.adminService.checkUserAgentStatus(userId);

    return {
      code: 0,
      message: 'success',
      data: result,
    };
  }

  // ==================== 质押管理 ====================

  /**
   * 获取质押统计
   * GET /api/admin/staking/stats
   */
  @Get('staking/stats')
  @ApiOperation({ summary: '获取质押统计' })
  async getStakingStats() {
    const data = await this.adminService.getStakingStats();
    return {
      code: 0,
      message: 'success',
      data,
    };
  }

  /**
   * 获取质押列表
   * GET /api/admin/staking
   */
  @Get('staking')
  @ApiOperation({ summary: '获取质押列表' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, enum: ['active', 'completed', 'cancelled'] })
  @ApiQuery({ name: 'stakeType', required: false, enum: ['A', 'B'] })
  @ApiQuery({ name: 'userId', required: false, type: String })
  async getStakes(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('stakeType') stakeType?: string,
    @Query('userId') userId?: string,
  ) {
    const data = await this.adminService.getStakes({
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
      status,
      stakeType,
      userId,
    });

    return {
      code: 0,
      message: 'success',
      data,
    };
  }

  // ==================== 报表导出 ====================

  /**
   * 获取交易报表
   * GET /api/admin/reports/trades
   */
  @Get('reports/trades')
  @ApiOperation({ summary: '获取交易报表' })
  @ApiQuery({ name: 'startDate', required: false, type: String, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'endDate', required: false, type: String, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'userId', required: false, type: String })
  async getTradeReport(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('userId') userId?: string,
  ) {
    const data = await this.adminService.getTradeReport({
      startDate,
      endDate,
      userId,
    });

    return {
      code: 0,
      message: 'success',
      data,
    };
  }

  /**
   * 获取收入报表
   * GET /api/admin/reports/revenue
   */
  @Get('reports/revenue')
  @ApiOperation({ summary: '获取收入报表' })
  @ApiQuery({ name: 'startDate', required: false, type: String, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'endDate', required: false, type: String, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'billingType', required: false, type: String })
  async getRevenueReport(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('billingType') billingType?: string,
  ) {
    const data = await this.adminService.getRevenueReport({
      startDate,
      endDate,
      billingType,
    });

    return {
      code: 0,
      message: 'success',
      data,
    };
  }

  // ==================== 用户级代理商管理（is_agent 字段）====================

  /**
   * 获取用户级代理商列表
   * GET /api/admin/user-agents
   */
  @Get('user-agents')
  @ApiOperation({ summary: '获取用户级代理商列表' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: '页码' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: '每页数量' })
  @ApiQuery({ name: 'search', required: false, type: String, description: '搜索关键词' })
  async getUserAgents(@Query() query: AgentListQueryDto) {
    const data = await this.adminService.getUserAgents(query);
    return {
      code: 0,
      message: 'success',
      data,
    };
  }

  /**
   * 设置用户为代理商
   * POST /api/admin/users/:id/set-agent
   */
  @Post('users/:id/set-agent')
  @ApiOperation({ summary: '设置用户为代理商' })
  @ApiParam({ name: 'id', type: String, description: '用户 ID' })
  @ApiBody({ type: SetAgentDto })
  async setUserAgentStatus(
    @CurrentUser() admin: JwtPayload,
    @Param('id') userId: string,
    @Body() dto: SetAgentDto,
  ) {
    await this.adminService.setUserAgentStatus(
      admin.sub,
      userId,
      dto.isAgent,
      dto.commissionRate,
    );
    return {
      code: 0,
      message: dto.isAgent ? '已设置为代理商' : '已取消代理商身份',
    };
  }

  /**
   * 更新代理商佣金比例
   * PATCH /api/admin/user-agents/:id/commission-rate
   */
  @Patch('user-agents/:id/commission-rate')
  @ApiOperation({ summary: '更新代理商佣金比例' })
  @ApiParam({ name: 'id', type: String, description: '代理商用户 ID' })
  @ApiBody({ type: UpdateAgentCommissionDto })
  async updateUserAgentCommissionRate(
    @CurrentUser() admin: JwtPayload,
    @Param('id') agentId: string,
    @Body() dto: UpdateAgentCommissionDto,
  ) {
    await this.adminService.updateUserAgentCommissionRate(
      admin.sub,
      agentId,
      dto.commissionRate,
    );
    return {
      code: 0,
      message: '佣金比例已更新',
    };
  }

  /**
   * 手动结算代理商佣金
   * POST /api/admin/user-agents/:id/settle
   */
  @Post('user-agents/:id/settle')
  @ApiOperation({ summary: '手动结算代理商佣金' })
  @ApiParam({ name: 'id', type: String, description: '代理商用户 ID' })
  @ApiBody({ type: SettleAgentCommissionDto })
  async settleUserAgentCommission(
    @CurrentUser() admin: JwtPayload,
    @Param('id') agentId: string,
    @Body() dto: SettleAgentCommissionDto,
  ) {
    const result = await this.adminService.settleUserAgentCommission(
      admin.sub,
      agentId,
      dto.amount,
      dto.remark,
    );
    return {
      code: 0,
      message: '结算成功',
      data: result,
    };
  }

  /**
   * 获取代理商的下级用户列表
   * GET /api/admin/user-agents/:id/referrals
   */
  @Get('user-agents/:id/referrals')
  @ApiOperation({ summary: '获取代理商下级用户列表' })
  @ApiParam({ name: 'id', type: String, description: '代理商用户 ID' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getAgentReferrals(
    @Param('id') agentId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const data = await this.adminService.getAgentReferrals(agentId, { page, limit });
    return {
      code: 0,
      message: 'success',
      data,
    };
  }
}
