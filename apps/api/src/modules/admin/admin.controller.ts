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
  UpdateUserInfoDto,
  AdjustBalanceDto,
  ResetPasswordDto,
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
import { AdminSignalService } from './services/admin-signal.service';
import { AdminExchangeService } from './services/admin-exchange.service';
import { AdminConfigService } from './services/admin-config.service';
import { AdminAiService } from './services/admin-ai.service';
import { CreateExchangeDto, UpdateExchangeDto } from './dto/exchange.dto';

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
    private signalService: AdminSignalService,
    private exchangeService: AdminExchangeService,
    private configService: AdminConfigService,
    private adminAiService: AdminAiService,
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

  // 更新用户信息
  @Put('users/:id')
  async updateUserInfo(
    @Param('id') id: string,
    @Body() dto: UpdateUserInfoDto,
  ) {
    return this.adminService.updateUserInfo(id, dto);
  }

  // 调整用户资产
  @Post('users/:id/adjust-balance')
  async adjustUserBalance(
    @Param('id') id: string,
    @Body() dto: AdjustBalanceDto,
    @Req() req: any,
  ) {
    const adminId = req.admin?.id || 'system';
    return this.adminService.adjustUserBalance(id, dto, adminId);
  }

  // 重置用户密码
  @Post('users/:id/reset-password')
  async resetUserPassword(
    @Param('id') id: string,
    @Body() dto: ResetPasswordDto,
  ) {
    return this.adminService.resetUserPassword(id, dto);
  }

  // 解绑用户 Telegram
  @Delete('users/:id/unbind-telegram')
  async unbindUserTelegram(@Param('id') id: string) {
    return this.adminService.unbindUserTelegram(id);
  }

  // 解绑用户钱包
  @Delete('users/:id/unbind-wallet')
  async unbindUserWallet(@Param('id') id: string) {
    return this.adminService.unbindUserWallet(id);
  }

  // ==================== 策略管理 ====================

  // 获取策略列表
  @Get('strategies')
  async getStrategies(@Query() dto: StrategyListDto) {
    return this.adminService.getStrategies(dto);
  }

  // 获取单个策略详情
  @Get('strategies/:id')
  async getStrategy(@Param('id') id: string) {
    return this.adminService.getStrategyById(id);
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

  // 获取质押配置
  @Get('ecosystem/staking/config')
  async getStakingConfig() {
    const config = await this.adminStakingService.getStakingConfig();
    return { code: 0, message: 'success', data: config };
  }

  // 更新质押配置
  @Put('ecosystem/staking/config')
  async updateStakingConfig(@Body() dto: any, @Req() req: any) {
    const adminId = req.admin?.id || 'system';
    const config = await this.adminStakingService.updateStakingConfig(
      dto,
      adminId,
    );
    return { code: 0, message: '质押配置已保存', data: config };
  }

  // 获取生态配置统计数据
  @Get('ecosystem/stats')
  async getEcosystemStats() {
    const stats = await this.adminStakingService.getEcosystemStats();
    return { code: 0, message: 'success', data: stats };
  }

  // 获取配置变更历史
  @Get('ecosystem/config-history')
  async getConfigHistory(
    @Query('type') type?: string,
    @Query('limit') limit?: string,
  ) {
    const history = await this.adminStakingService.getConfigChangeHistory(
      type,
      limit ? parseInt(limit, 10) : 20,
    );
    return { code: 0, message: 'success', data: history };
  }

  // 获取分红概览（分红管理页面使用）
  @Get('ecosystem/dividend/overview')
  async getDividendOverview() {
    return this.adminStakingService.getDividendOverview();
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
    return this.tokenService.getCirculationTrend(
      days ? parseInt(days, 10) : 30,
    );
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

  // ==================== 代理商代币管理 ====================

  // 获取代币统计
  @Get('agents/token/stats')
  async getAgentTokenStats() {
    return this.agentService.getTokenStats();
  }

  // 获取代币配额列表
  @Get('agents/token/quotas')
  async getTokenQuotas(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('agentId') agentId?: string,
    @Query('status') status?: string,
  ) {
    return this.agentService.getTokenQuotas({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      agentId,
      status,
    });
  }

  // 创建代币配额
  @Post('agents/token/quotas')
  async createTokenQuota(@Body() dto: { agentId: string; level: string }) {
    return this.agentService.createTokenQuota(dto);
  }

  // 审核代币配额
  @Post('agents/token/quotas/:id/review')
  async reviewTokenQuota(
    @Param('id') id: string,
    @Body() dto: { action: 'approve' | 'reject' },
    @Req() req: any,
  ) {
    const adminId = req.admin?.id || 'system';
    return this.agentService.reviewTokenQuota(id, dto.action, adminId);
  }

  // 获取代理商分红池列表
  @Get('agents/token/dividend-pools')
  async getAgentDividendPools(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    return this.agentService.getDividendPools({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      status,
    });
  }

  // 创建代理商分红池
  @Post('agents/token/dividend-pools')
  async createAgentDividendPool(
    @Body() dto: { monthNumber: string; poolRate?: number },
  ) {
    return this.agentService.createDividendPool(dto);
  }

  // 分配分红池
  @Post('agents/token/dividend-pools/:id/distribute')
  async distributeDividendPool(
    @Param('id') id: string,
    @Body() dto: { hootPrice: string },
  ) {
    return this.agentService.distributeDividendPool(id, dto.hootPrice);
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

  // ==================== 信号急停开关 ====================

  // 获取急停开关概览
  @Get('signals/kill-switch')
  async getKillSwitchOverview() {
    const data = await this.signalService.getKillSwitchOverview();
    return { code: 0, message: 'success', data };
  }

  // 设置全局信号开关
  @Post('signals/kill-switch/global')
  async setGlobalSignalSwitch(
    @Body() dto: { enabled: boolean; reason: string },
    @Req() req: any,
  ) {
    const adminId = req.admin?.id || 'system';
    const data = await this.signalService.setGlobalSignalSwitch(
      dto.enabled,
      adminId,
      dto.reason,
    );
    return {
      code: 0,
      message: dto.enabled ? '全局信号已开启' : '全局信号已关闭',
      data,
    };
  }

  // 设置策略信号开关
  @Post('signals/kill-switch/strategy/:id')
  async setStrategySignalSwitch(
    @Param('id') strategyId: string,
    @Body() dto: { enabled: boolean; reason: string },
    @Req() req: any,
  ) {
    const adminId = req.admin?.id || 'system';
    const data = await this.signalService.setStrategySignalStatus(
      strategyId,
      dto.enabled,
      adminId,
      dto.reason,
    );
    return {
      code: 0,
      message: dto.enabled ? '策略信号已恢复' : '策略信号已停止',
      data,
    };
  }

  // 批量设置策略信号开关
  @Post('signals/kill-switch/strategies/batch')
  async batchSetStrategySignalSwitch(
    @Body() dto: { enabled: boolean; reason: string },
    @Req() req: any,
  ) {
    const adminId = req.admin?.id || 'system';
    const data = await this.signalService.batchSetStrategySignalStatus(
      dto.enabled,
      adminId,
      dto.reason,
    );
    return { code: 0, message: data.message, data };
  }

  // 设置用户信号开关
  @Post('signals/kill-switch/user/:id')
  async setUserSignalSwitch(
    @Param('id') userId: string,
    @Body() dto: { enabled: boolean; reason: string },
    @Req() req: any,
  ) {
    const adminId = req.admin?.id || 'system';
    const data = await this.signalService.setUserSignalStatus(
      userId,
      dto.enabled,
      adminId,
      dto.reason,
    );
    return {
      code: 0,
      message: dto.enabled ? '用户信号已恢复' : '用户信号已停止',
      data,
    };
  }

  // 搜索用户（用于用户级控制）
  @Get('signals/kill-switch/users/search')
  async searchUsersForKillSwitch(@Query('keyword') keyword: string) {
    const data = await this.signalService.searchUsers(keyword);
    return { code: 0, message: 'success', data };
  }

  // 获取急停开关操作日志
  @Get('signals/kill-switch/logs')
  async getKillSwitchLogs(@Query('limit') limit?: string) {
    const data = await this.signalService.getKillSwitchLogs(
      limit ? parseInt(limit, 10) : 50,
    );
    return { code: 0, message: 'success', data };
  }

  // ==================== 交易记录管理 ====================

  /**
   * 获取交易记录列表（充值/提现）
   * GET /admin/transactions?page=1&limit=20&type=deposit&status=completed
   */
  @Get('transactions')
  async getTransactions(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('userId') userId?: string,
    @Query('search') search?: string,
  ) {
    const data = await this.adminService.getTransactions({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      type,
      status,
      userId,
      search,
    });
    return { code: 0, message: 'success', data };
  }

  /**
   * 获取交易记录统计
   * GET /admin/transactions/stats
   */
  @Get('transactions/stats')
  async getTransactionStats() {
    const data = await this.adminService.getTransactionStats();
    return { code: 0, message: 'success', data };
  }

  // ==================== 持仓管理 ====================

  /**
   * 获取持仓列表
   * GET /admin/positions?page=1&limit=20&status=open
   */
  @Get('positions')
  async getPositions(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('userId') userId?: string,
    @Query('exchange') exchange?: string,
    @Query('symbol') symbol?: string,
  ) {
    const data = await this.adminService.getPositions({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      status,
      userId,
      exchange,
      symbol,
    });
    return { code: 0, message: 'success', data };
  }

  /**
   * 获取持仓统计
   * GET /admin/positions/stats
   */
  @Get('positions/stats')
  async getPositionStats() {
    const data = await this.adminService.getPositionStats();
    return { code: 0, message: 'success', data };
  }

  // ==================== 订单管理 ====================

  /**
   * 获取订单列表（信号执行记录）
   * GET /admin/orders?page=1&limit=20&status=success
   */
  @Get('orders')
  async getOrders(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('userId') userId?: string,
    @Query('exchange') exchange?: string,
    @Query('search') search?: string,
  ) {
    const data = await this.adminService.getOrders({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      status,
      userId,
      exchange,
      search,
    });
    return { code: 0, message: 'success', data };
  }

  /**
   * 获取订单统计
   * GET /admin/orders/stats
   */
  @Get('orders/stats')
  async getOrderStats() {
    const data = await this.adminService.getOrderStats();
    return { code: 0, message: 'success', data };
  }

  // ==================== 信号监控 ====================

  /**
   * 获取信号列表
   * GET /admin/signals?page=1&limit=20&strategyId=xxx
   */
  @Get('signals')
  async getSignals(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('strategyId') strategyId?: string,
    @Query('status') status?: string,
  ) {
    const data = await this.adminService.getSignals({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      strategyId,
      status,
    });
    return { code: 0, message: 'success', data };
  }

  /**
   * 获取信号监控统计
   * GET /admin/signals/stats
   */
  @Get('signals/stats')
  async getSignalStats() {
    const data = await this.adminService.getSignalStats();
    return { code: 0, message: 'success', data };
  }

  /**
   * 获取策略运行状态
   * GET /admin/signals/strategy-status
   */
  @Get('signals/strategy-status')
  async getStrategyRunStatus() {
    const data = await this.adminService.getStrategyRunStatus();
    return { code: 0, message: 'success', data };
  }

  // ==================== 风控管理 ====================

  /**
   * 获取风控概览
   * GET /admin/risk/overview
   */
  @Get('risk/overview')
  async getRiskOverview() {
    const data = await this.adminService.getRiskOverview();
    return { code: 0, message: 'success', data };
  }

  /**
   * 获取风控事件列表
   * GET /admin/risk/events?page=1&limit=20
   */
  @Get('risk/events')
  async getRiskEvents(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const data = await this.adminService.getRiskEvents({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
    return { code: 0, message: 'success', data };
  }

  // ==================== 账单管理 ====================

  /**
   * 获取账单列表
   * GET /admin/billing?page=1&limit=20&type=subscription
   */
  @Get('billing')
  async getBillingLogs(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('type') type?: string,
    @Query('userId') userId?: string,
  ) {
    const data = await this.adminService.getBillingLogs({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      type,
      userId,
    });
    return { code: 0, message: 'success', data };
  }

  /**
   * 获取账单统计
   * GET /admin/billing/stats
   */
  @Get('billing/stats')
  async getBillingStats() {
    const data = await this.adminService.getBillingStats();
    return { code: 0, message: 'success', data };
  }

  // ==================== 权重配置 ====================

  /**
   * 获取生态权重配置
   * GET /admin/ecosystem/weights
   */
  @Get('ecosystem/weights')
  async getEcosystemWeights() {
    const data = await this.adminService.getEcosystemWeights();
    return { code: 0, message: 'success', data };
  }

  /**
   * 更新生态权重配置
   * PUT /admin/ecosystem/weights
   */
  @Put('ecosystem/weights')
  async updateEcosystemWeights(@Body() weights: any) {
    const data = await this.adminService.updateEcosystemWeights(weights);
    return { code: 0, message: '权重配置已更新', data };
  }

  // ==================== 管理员管理 ====================

  /**
   * 获取管理员列表
   * GET /admin/admins?page=1&limit=20
   */
  @Get('admins')
  async getAdminList(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const data = await this.adminService.getAdminList({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
    return { code: 0, message: 'success', data };
  }

  // ==================== 系统监控 ====================

  /**
   * 获取系统监控数据
   * GET /admin/monitor
   */
  @Get('monitor')
  async getSystemMonitor() {
    const data = await this.adminService.getSystemMonitor();
    return { code: 0, message: 'success', data };
  }

  // ==================== 交易所推荐管理 ====================

  /**
   * 获取交易所列表
   * GET /admin/exchanges
   */
  @Get('exchanges')
  async getExchanges(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    const data = await this.exchangeService.getExchanges({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      search: search || undefined,
    });
    return { code: 0, message: 'success', data };
  }

  /**
   * 获取交易所统计
   * GET /admin/exchanges/stats
   */
  @Get('exchanges/stats')
  async getExchangeStats() {
    const data = await this.exchangeService.getExchangeStats();
    return { code: 0, message: 'success', data };
  }

  /**
   * 获取单个交易所
   * GET /admin/exchanges/:id
   */
  @Get('exchanges/:id')
  async getExchange(@Param('id') id: string) {
    const data = await this.exchangeService.getExchangeById(id);
    return { code: 0, message: 'success', data };
  }

  /**
   * 创建交易所
   * POST /admin/exchanges
   */
  @Post('exchanges')
  async createExchange(@Body() dto: CreateExchangeDto) {
    const data = await this.exchangeService.createExchange(dto);
    return { code: 0, message: 'success', data };
  }

  /**
   * 更新交易所
   * PUT /admin/exchanges/:id
   */
  @Put('exchanges/:id')
  async updateExchange(
    @Param('id') id: string,
    @Body() dto: UpdateExchangeDto,
  ) {
    const data = await this.exchangeService.updateExchange(id, dto);
    return { code: 0, message: 'success', data };
  }

  /**
   * 删除交易所
   * DELETE /admin/exchanges/:id
   */
  @Delete('exchanges/:id')
  async deleteExchange(@Param('id') id: string) {
    const data = await this.exchangeService.deleteExchange(id);
    return { code: 0, message: 'success', data };
  }

  // ==================== 系统配置管理 ====================

  /**
   * 获取配置变更历史
   * GET /admin/config-history
   * 注意：此路由必须在 /admin/config/:key 之前定义
   */
  @Get('config-history')
  async getSystemConfigHistory(@Query('limit') limit?: string) {
    const data = await this.configService.getConfigHistory(
      limit ? parseInt(limit, 10) : 20,
    );
    return { code: 0, message: 'success', data };
  }

  /**
   * 获取配置
   * GET /admin/config/:key
   */
  @Get('config/:key')
  async getConfig(@Param('key') key: string) {
    const data = await this.configService.getConfig(key);
    return { code: 0, message: 'success', data };
  }

  /**
   * 更新配置
   * PUT /admin/config/:key
   */
  @Put('config/:key')
  async updateConfig(
    @Param('key') key: string,
    @Body() body: { value: unknown },
    @Req() req: any,
  ) {
    const adminId = req.admin?.id || 'system';
    const data = await this.configService.updateConfig(key, body.value, adminId);
    return { code: 0, message: 'success', data };
  }

  // ==================== AI 智能交易管理 ====================

  /**
   * AI 总览统计
   * GET /admin/ai/overview
   */
  @Get('ai/overview')
  async getAiOverview() {
    const data = await this.adminAiService.getAiOverview();
    return { code: 0, message: 'success', data };
  }

  /**
   * 全平台策略列表
   * GET /admin/ai/strategies
   */
  @Get('ai/strategies')
  async getAiStrategies(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('userId') userId?: string,
    @Query('status') status?: string,
    @Query('tradingMode') tradingMode?: string,
    @Query('keyword') keyword?: string,
  ) {
    const data = await this.adminAiService.getStrategies({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      userId,
      status,
      tradingMode,
      keyword,
    });
    return { code: 0, message: 'success', data };
  }

  /**
   * 策略详情
   * GET /admin/ai/strategies/:id
   */
  @Get('ai/strategies/:id')
  async getAiStrategyDetail(@Param('id') id: string) {
    const data = await this.adminAiService.getStrategyDetail(id);
    return { code: 0, message: 'success', data };
  }

  /**
   * 紧急停止策略
   * POST /admin/ai/strategies/:id/force-stop
   */
  @Post('ai/strategies/:id/force-stop')
  async forceStopAiStrategy(
    @Param('id') id: string,
    @Body() body: { reason: string },
  ) {
    const data = await this.adminAiService.forceStopStrategy(id, body.reason || '管理员操作');
    return { code: 0, message: 'success', data };
  }

  /**
   * 全平台研究会话列表
   * GET /admin/ai/research
   */
  @Get('ai/research')
  async getAiResearch(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('userId') userId?: string,
    @Query('status') status?: string,
    @Query('symbol') symbol?: string,
  ) {
    const data = await this.adminAiService.getResearchSessions({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      userId,
      status,
      symbol,
    });
    return { code: 0, message: 'success', data };
  }

  /**
   * Token 成本统计
   * GET /admin/ai/cost
   */
  @Get('ai/cost')
  async getAiCost(
    @Query('period') period?: 'today' | 'week' | 'month',
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('keyword') keyword?: string,
  ) {
    const data = await this.adminAiService.getCostStats({
      period: period || 'month',
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      keyword,
    });
    return { code: 0, message: 'success', data };
  }

  /**
   * 用户 AI 配置列表
   * GET /admin/ai/configs
   */
  @Get('ai/configs')
  async getAiConfigs(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('userId') userId?: string,
    @Query('isEnabled') isEnabled?: string,
    @Query('keyword') keyword?: string,
  ) {
    const data = await this.adminAiService.getUserAiConfigs({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      userId,
      isEnabled: isEnabled !== undefined ? isEnabled === 'true' : undefined,
      keyword,
    });
    return { code: 0, message: 'success', data };
  }

  /**
   * 清空用户 LLM API Keys
   * POST /admin/ai/configs/:userId/reset-keys
   */
  @Post('ai/configs/:userId/reset-keys')
  async resetUserAiKeys(@Param('userId') userId: string) {
    const data = await this.adminAiService.resetUserApiKeys(userId);
    return { code: 0, message: 'success', data };
  }

  /**
   * 停用用户 AI
   * POST /admin/ai/configs/:userId/disable
   */
  @Post('ai/configs/:userId/disable')
  async disableUserAi(
    @Param('userId') userId: string,
    @Body() body: { reason: string },
  ) {
    const data = await this.adminAiService.disableUserAi(userId, body.reason || '管理员操作');
    return { code: 0, message: 'success', data };
  }

  /**
   * AI 决策日志（安全审计）
   * GET /admin/ai/logs
   */
  @Get('ai/logs')
  async getAiLogs(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('strategyId') strategyId?: string,
    @Query('userId') userId?: string,
    @Query('action') action?: string,
    @Query('executed') executed?: string,
  ) {
    const data = await this.adminAiService.getDecisionLogs({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      strategyId,
      userId,
      action,
      executed: executed !== undefined ? executed === 'true' : undefined,
    });
    return { code: 0, message: 'success', data };
  }
}
