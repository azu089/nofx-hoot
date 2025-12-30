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
}
