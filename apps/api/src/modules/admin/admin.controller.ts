import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminGuard } from './guards/admin.guard';
import { StakingService } from '../staking/staking.service';
import { TradingConfigService } from '../trading/config/config.service';
import { MarketStatusService } from '../trading/config/market-status.service';
import { CircuitBreakerService } from '../trading/config/circuit-breaker.service';
import { Public } from '../auth/decorators/public.decorator';
import {
  UserListDto,
  UpdateUserStatusDto,
  StrategyListDto,
  CreateStrategyDto,
  UpdateStrategyDto,
  WithdrawListDto,
  WithdrawActionDto,
  UpdatePlatformConfigDto,
  SuspendTradingDto,
  ResumeTradingDto,
} from './dto/admin.dto';

// 新增服务
import { AdminFinanceService } from './services/admin-finance.service';
import { AdminStatsService } from './services/admin-stats.service';
import { AdminAgentService } from './services/admin-agent.service';
import { AdminStakingService } from './services/admin-staking.service';
import { AdminTokenService } from './services/admin-token.service';
import { AdminReferralService } from './services/admin-referral.service';

@Controller('admin')
@Public() // 跳过全局 JwtAuthGuard，使用 AdminGuard 验证
@UseGuards(AdminGuard)
export class AdminController {
  constructor(
    private adminService: AdminService,
    private stakingService: StakingService,
    private tradingConfigService: TradingConfigService,
    private marketStatusService: MarketStatusService,
    private circuitBreakerService: CircuitBreakerService,
    // 新增服务
    private financeService: AdminFinanceService,
    private statsService: AdminStatsService,
    private agentService: AdminAgentService,
    private adminStakingService: AdminStakingService,
    private tokenService: AdminTokenService,
    private referralService: AdminReferralService,
  ) {}

  // ==================== 仪表盘 ====================

  // 获取仪表盘统计
  @Get('dashboard')
  async getDashboard() {
    return this.adminService.getDashboardStats();
  }

  // ==================== 用户管理 ====================

  // 获取用户列表
  @Get('users')
  async getUsers(@Query() dto: UserListDto) {
    return this.adminService.getUsers(dto);
  }

  // 获取用户详情
  @Get('users/:id')
  async getUserDetail(@Param('id') id: string) {
    return this.adminService.getUserDetail(id);
  }

  // 更新用户状态
  @Put('users/:id/status')
  async updateUserStatus(
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
  ) {
    return this.adminService.updateUserStatus(id, dto);
  }

  // ==================== 策略管理 ====================

  // 获取策略列表
  @Get('strategies')
  async getStrategies(@Query() dto: StrategyListDto) {
    return this.adminService.getStrategies(dto);
  }

  // 创建策略
  @Post('strategies')
  async createStrategy(@Body() dto: CreateStrategyDto) {
    return this.adminService.createStrategy(dto);
  }

  // 更新策略
  @Put('strategies/:id')
  async updateStrategy(
    @Param('id') id: string,
    @Body() dto: UpdateStrategyDto,
  ) {
    return this.adminService.updateStrategy(id, dto);
  }

  // 删除策略
  @Delete('strategies/:id')
  async deleteStrategy(@Param('id') id: string) {
    return this.adminService.deleteStrategy(id);
  }

  // ==================== 提现审核 ====================

  // 获取提现列表
  @Get('withdraws')
  async getWithdrawRequests(@Query() dto: WithdrawListDto) {
    return this.adminService.getWithdrawRequests(dto);
  }

  // 审核提现
  @Post('withdraws/:id/process')
  async processWithdraw(
    @Param('id') id: string,
    @Body() dto: WithdrawActionDto,
  ) {
    return this.adminService.processWithdraw(id, dto);
  }

  // ==================== 交易配置管理 ====================

  // 获取平台配置
  @Get('trading/config')
  async getPlatformConfig() {
    return this.tradingConfigService.getPlatformConfig();
  }

  // 更新平台配置
  @Put('trading/config')
  async updatePlatformConfig(@Body() dto: UpdatePlatformConfigDto) {
    return this.tradingConfigService.updatePlatformConfig(dto, 'admin');
  }

  // 获取所有异常市场状态
  @Get('trading/market-status')
  async getAbnormalMarkets() {
    return this.marketStatusService.getAbnormalMarkets();
  }

  // 手动暂停交易对
  @Post('trading/market-status/suspend')
  async suspendTrading(@Body() dto: SuspendTradingDto) {
    await this.marketStatusService.suspendTrading(
      dto.symbol,
      dto.exchange,
      dto.reason,
    );
    return { message: `已暂停 ${dto.exchange}:${dto.symbol} 交易` };
  }

  // 恢复交易对
  @Post('trading/market-status/resume')
  async resumeTrading(@Body() dto: ResumeTradingDto) {
    await this.marketStatusService.resumeTrading(dto.symbol, dto.exchange);
    return { message: `已恢复 ${dto.exchange}:${dto.symbol} 交易` };
  }

  // 获取熔断器状态
  @Get('trading/circuit-breaker')
  async getCircuitBreakerStatus() {
    // 获取所有熔断器状态
    return this.circuitBreakerService.getAllCircuits();
  }

  // 重置熔断器
  @Post('trading/circuit-breaker/:name/reset')
  async resetCircuitBreaker(@Param('name') name: string) {
    await this.circuitBreakerService.reset(name);
    return { message: `熔断器 ${name} 已重置` };
  }

  // 强制开启熔断器
  @Post('trading/circuit-breaker/:name/force-open')
  async forceOpenCircuitBreaker(
    @Param('name') name: string,
    @Body() dto: { durationSeconds: number },
  ) {
    await this.circuitBreakerService.forceOpen(name, dto.durationSeconds);
    return { message: `熔断器 ${name} 已强制开启 ${dto.durationSeconds} 秒` };
  }

  // 清除配置缓存
  @Post('trading/config/clear-cache')
  async clearConfigCache() {
    this.tradingConfigService.clearAllCache();
    return { message: '配置缓存已清除' };
  }

  // ==================== 财务中心 ====================

  // 获取财务概览
  @Get('finance/overview')
  async getFinanceOverview(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.financeService.getFinanceOverview(
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  // 获取订阅收入详情
  @Get('finance/subscription')
  async getSubscriptionRevenue(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const dateFilter = {};
    if (startDate) (dateFilter as any).createdAt = { gte: new Date(startDate) };
    if (endDate) {
      (dateFilter as any).createdAt = {
        ...(dateFilter as any).createdAt,
        lte: new Date(endDate),
      };
    }
    return this.financeService.getSubscriptionRevenue(dateFilter);
  }

  // 获取点卡收入详情
  @Get('finance/point-card')
  async getPointCardRevenue(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const dateFilter = {};
    if (startDate) (dateFilter as any).createdAt = { gte: new Date(startDate) };
    if (endDate) {
      (dateFilter as any).createdAt = {
        ...(dateFilter as any).createdAt,
        lte: new Date(endDate),
      };
    }
    return this.financeService.getPointCardRevenue(dateFilter);
  }

  // 获取燃油费收入详情
  @Get('finance/gas-fee')
  async getGasFeeRevenue(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const dateFilter = {};
    if (startDate) (dateFilter as any).createdAt = { gte: new Date(startDate) };
    if (endDate) {
      (dateFilter as any).createdAt = {
        ...(dateFilter as any).createdAt,
        lte: new Date(endDate),
      };
    }
    return this.financeService.getGasFeeRevenue(dateFilter);
  }

  // 获取收入趋势
  @Get('finance/trend')
  async getRevenueTrend(@Query('days') days?: string) {
    return this.financeService.getRevenueTrend(days ? parseInt(days, 10) : 30);
  }

  // ==================== 用户数据看板 ====================

  // 获取用户看板
  @Get('stats/users')
  async getUserDashboard() {
    return this.statsService.getUserDashboard();
  }

  // 获取用户增长趋势
  @Get('stats/users/trend')
  async getUserGrowthTrend(@Query('days') days?: string) {
    return this.statsService.getUserGrowthTrend(days ? parseInt(days, 10) : 30);
  }

  // 获取用户资产分布
  @Get('stats/users/assets')
  async getUserAssetDistribution() {
    return this.statsService.getUserAssetDistribution();
  }

  // 获取用户来源统计
  @Get('stats/users/source')
  async getUserSourceStats() {
    return this.statsService.getUserSourceStats();
  }

  // ==================== 质押分红管理（增强版） ====================

  // 获取质押概览
  @Get('ecosystem/staking/overview')
  async getStakingOverview() {
    return this.adminStakingService.getStakingOverview();
  }

  // 获取分红池列表
  @Get('ecosystem/dividend-pools')
  async getDividendPools(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminStakingService.getDividendPools(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  // 创建分红池
  @Post('ecosystem/dividend-pools')
  async createDividendPool(@Body() dto: { dividendRate?: number }) {
    return this.adminStakingService.createDividendPool(dto.dividendRate);
  }

  // 分发分红
  @Post('ecosystem/dividend-pools/:id/distribute')
  async distributeDividendsV2(@Param('id') poolId: string) {
    return this.adminStakingService.distributeDividends(poolId);
  }

  // 获取质押排行榜
  @Get('ecosystem/staking/leaderboard')
  async getStakingLeaderboard(@Query('limit') limit?: string) {
    return this.adminStakingService.getStakingLeaderboard(
      limit ? parseInt(limit, 10) : 20,
    );
  }

  // 获取质押记录列表
  @Get('ecosystem/staking/records')
  async getStakingRecords(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    return this.adminStakingService.getStakingRecords(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
      status,
    );
  }

  // ==================== 代币流通 ====================

  // 获取代币概览
  @Get('ecosystem/token/overview')
  async getTokenOverview() {
    return this.tokenService.getTokenOverview();
  }

  // 获取代币流通记录
  @Get('ecosystem/token/circulation')
  async getCirculationRecords(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('type') type?: string,
    @Query('direction') direction?: string,
  ) {
    return this.tokenService.getCirculationRecords(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 50,
      type,
      direction,
    );
  }

  // 获取空投记录
  @Get('ecosystem/token/airdrops')
  async getAirdropRecords(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    return this.tokenService.getAirdropRecords(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 50,
      status,
    );
  }

  // 获取流通趋势
  @Get('ecosystem/token/trend')
  async getCirculationTrend(@Query('days') days?: string) {
    return this.tokenService.getCirculationTrend(days ? parseInt(days, 10) : 30);
  }

  // 获取 HOOT 持有者排行
  @Get('ecosystem/token/holders')
  async getHootHolders(@Query('limit') limit?: string) {
    return this.tokenService.getHootHolders(limit ? parseInt(limit, 10) : 50);
  }

  // ==================== 代理商管理 ====================

  // 获取代理商统计
  @Get('agents/stats')
  async getAgentStats() {
    return this.agentService.getAgentStats();
  }

  // 获取代理商列表
  @Get('agents')
  async getAgents(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('level') level?: string,
  ) {
    return this.agentService.getAgents({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      search,
      status,
      level,
    });
  }

  // 获取代理商详情
  @Get('agents/:id')
  async getAgentDetail(@Param('id') id: string) {
    return this.agentService.getAgentDetail(id);
  }

  // 创建代理商
  @Post('agents')
  async createAgent(@Body() dto: any) {
    return this.agentService.createAgent(dto);
  }

  // 更新代理商
  @Put('agents/:id')
  async updateAgent(@Param('id') id: string, @Body() dto: any) {
    return this.agentService.updateAgent(id, dto);
  }

  // 审核代理商
  @Post('agents/:id/review')
  async reviewAgent(
    @Param('id') id: string,
    @Body() dto: { action: 'approve' | 'reject'; reason?: string },
  ) {
    return this.agentService.reviewAgent(id, dto.action, dto.reason);
  }

  // 结算代理商佣金
  @Post('agents/:id/settle')
  async settleAgentCommission(@Param('id') id: string) {
    return this.agentService.settleAgentCommission(id);
  }

  // 获取代理商佣金记录
  @Get('agents/:id/commissions')
  async getAgentCommissions(
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.agentService.getAgentCommissions(
      id,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  // ==================== 返佣邀请系统 ====================

  // 获取返佣概览
  @Get('referral/overview')
  async getReferralOverview() {
    return this.referralService.getReferralOverview();
  }

  // 获取返佣配置
  @Get('referral/config')
  async getReferralConfig() {
    return this.referralService.getReferralConfig();
  }

  // 更新返佣配置
  @Put('referral/config')
  async updateReferralConfig(@Body() dto: any, @Req() req: any) {
    const adminId = req.admin?.id || 'system';
    return this.referralService.updateReferralConfig(dto, adminId);
  }

  // 获取邀请关系列表
  @Get('referral/relations')
  async getReferralRelations(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.referralService.getReferralRelations(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
      search,
    );
  }

  // 获取用户的被邀请人
  @Get('referral/users/:id/invitees')
  async getUserInvitees(
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.referralService.getUserInvitees(
      id,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  // 获取返佣记录
  @Get('referral/rewards')
  async getReferralRewards(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('userId') userId?: string,
    @Query('status') status?: string,
  ) {
    return this.referralService.getReferralRewards(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 50,
      userId,
      status,
    );
  }

  // 获取返佣排行榜
  @Get('referral/leaderboard')
  async getReferralLeaderboard(@Query('limit') limit?: string) {
    return this.referralService.getReferralLeaderboard(
      limit ? parseInt(limit, 10) : 20,
    );
  }

  // 批量发放待处理返佣
  @Post('referral/process-pending')
  async processPendingRewards() {
    return this.referralService.processPendingRewards();
  }
}
