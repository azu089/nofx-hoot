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
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminGuard } from './guards/admin.guard';
import { StakingService } from '../staking/staking.service';
import {
  UserListDto,
  UpdateUserStatusDto,
  StrategyListDto,
  CreateStrategyDto,
  UpdateStrategyDto,
  WithdrawListDto,
  WithdrawActionDto,
} from './dto/admin.dto';

@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(
    private adminService: AdminService,
    private stakingService: StakingService,
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

  // ==================== 质押分红管理 ====================

  // 获取全网质押统计
  @Get('staking/stats')
  async getStakingStats() {
    return this.stakingService.getGlobalStats();
  }

  // 创建分红池
  @Post('staking/dividend-pool')
  async createDividendPool(@Body() dto: { totalAmount: number }) {
    return this.stakingService.createDividendPool(dto.totalAmount);
  }

  // 分发分红
  @Post('staking/dividend-pool/:id/distribute')
  async distributeDividends(@Param('id') poolId: string) {
    return this.stakingService.distributeDividends(poolId);
  }
}
