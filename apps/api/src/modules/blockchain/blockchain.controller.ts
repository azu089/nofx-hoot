import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  UseGuards,
  Param,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { BlockchainService } from './blockchain.service';
import { WithdrawService } from './withdraw.service';
import { SweepService } from './sweep.service';
import { HdWalletService } from './hd-wallet.service';
import { AdminGuard } from '../admin/guards/admin.guard';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';

class ScanBlocksDto {
  fromBlock: number;
  toBlock: number;
  tokenSymbol?: string;
}

class BatchWithdrawDto {
  withdrawRequestIds: string[];
}

class ApproveWithdrawDto {
  reviewedBy: string;
}

class RejectWithdrawDto {
  reviewedBy: string;
  reason?: string;
}

@ApiTags('blockchain')
@Public() // 跳过全局 JwtAuthGuard，由各方法的 AdminGuard 独立鉴权
@Controller('blockchain')
export class BlockchainController {
  constructor(
    private blockchainService: BlockchainService,
    private withdrawService: WithdrawService,
    private sweepService: SweepService,
    private hdWalletService: HdWalletService,
  ) {}

  // ==================== 监听相关 ====================

  /**
   * 获取监听状态（管理员）
   */
  @UseGuards(AdminGuard)
  @Get('status')
  async getStatus() {
    return {
      ...this.blockchainService.getStatus(),
      hdWallet: this.hdWalletService.getIsInitialized(),
    };
  }

  /**
   * 获取当前区块高度（管理员）
   */
  @UseGuards(AdminGuard)
  @Get('block-number')
  async getBlockNumber() {
    const blockNumber = await this.blockchainService.getCurrentBlockNumber();
    return { blockNumber };
  }

  /**
   * 手动扫描历史区块（管理员）
   */
  @UseGuards(AdminGuard)
  @Post('scan')
  async scanBlocks(@Body() dto: ScanBlocksDto) {
    const result = await this.blockchainService.scanHistoricalBlocks(
      dto.fromBlock,
      dto.toBlock,
      dto.tokenSymbol,
    );
    return result;
  }

  /**
   * 启动监听（管理员）
   */
  @UseGuards(AdminGuard)
  @Post('start')
  async startListening() {
    await this.blockchainService.startListening();
    return { message: '监听已启动' };
  }

  /**
   * 停止监听（管理员）
   */
  @UseGuards(AdminGuard)
  @Post('stop')
  async stopListening() {
    await this.blockchainService.stopListening();
    return { message: '监听已停止' };
  }

  // ==================== 提现相关 ====================

  /**
   * 获取提现钱包余额（管理员）
   * 返回所有已配置链的热钱包余额
   */
  @UseGuards(AdminGuard)
  @Get('withdraw-wallet/balance')
  async getWithdrawWalletBalance() {
    const balances = await this.withdrawService.getWithdrawWalletBalance();
    if (!balances || balances.length === 0) {
      return { error: '提现钱包未配置' };
    }
    return { chains: balances };
  }

  /**
   * 获取已配置的链列表（管理员）
   */
  @UseGuards(AdminGuard)
  @Get('chains')
  getConfiguredChains() {
    return {
      chains: this.withdrawService.getConfiguredChains(),
    };
  }

  /**
   * 执行单个提现（管理员）
   */
  @UseGuards(AdminGuard)
  @Post('withdraw/:id/execute')
  async executeWithdraw(@Param('id') id: string) {
    const result = await this.withdrawService.executeWithdraw(id);
    return result;
  }

  /**
   * 审批提现（管理员 / TG Bot 调用）
   * 限流：5次/分钟，防止误操作批量审批
   */
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @UseGuards(AdminGuard)
  @Post('withdraw/:id/approve')
  async approveWithdraw(
    @Param('id') id: string,
    @Body() dto: ApproveWithdrawDto,
  ) {
    return this.withdrawService.approveWithdraw(id, dto.reviewedBy);
  }

  /**
   * 拒绝提现并退款（管理员 / TG Bot 调用）
   */
  @UseGuards(AdminGuard)
  @Post('withdraw/:id/reject')
  async rejectWithdraw(
    @Param('id') id: string,
    @Body() dto: RejectWithdrawDto,
  ) {
    return this.withdrawService.rejectWithdraw(
      id,
      dto.reviewedBy,
      dto.reason,
    );
  }

  /**
   * 批量执行提现（管理员）
   */
  @UseGuards(AdminGuard)
  @Post('withdraw/batch-execute')
  async executeBatchWithdraw(@Body() dto: BatchWithdrawDto) {
    const result = await this.withdrawService.executeBatchWithdraw(
      dto.withdrawRequestIds,
    );
    return result;
  }

  // ==================== 归集相关 ====================

  /**
   * 扫描所有充值地址余额（管理员）
   */
  @UseGuards(AdminGuard)
  @Get('sweep/scan')
  async scanBalances() {
    return this.sweepService.scanBalances();
  }

  /**
   * 执行全量归集（管理员）
   */
  @UseGuards(AdminGuard)
  @Post('sweep/execute')
  async sweepAll() {
    return this.sweepService.sweepAll();
  }

  /**
   * 获取归集地址配置（管理员）
   */
  @UseGuards(AdminGuard)
  @Get('sweep/config')
  async getSweepConfig() {
    return this.sweepService.getSweepConfig();
  }

  /**
   * 查询归集地址 USDT 余额（管理员）
   */
  @UseGuards(AdminGuard)
  @Get('sweep/config/balance')
  async getSweepConfigBalance() {
    return this.sweepService.getSweepConfigBalance();
  }

  /**
   * 更新归集地址配置（管理员）
   */
  @UseGuards(AdminGuard)
  @Put('sweep/config')
  async updateSweepConfig(@Body() body: { evmAddress?: string; tronAddress?: string }) {
    await this.sweepService.updateSweepConfig(body.evmAddress, body.tronAddress);
    return this.sweepService.getSweepConfig();
  }
}
