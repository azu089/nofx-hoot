import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Param,
} from '@nestjs/common';
import { BlockchainService } from './blockchain.service';
import { WithdrawService } from './withdraw.service';
import { AdminGuard } from '../admin/guards/admin.guard';

class ScanBlocksDto {
  fromBlock: number;
  toBlock: number;
  tokenSymbol?: string;
}

class BatchWithdrawDto {
  withdrawRequestIds: string[];
}

@Controller('blockchain')
export class BlockchainController {
  constructor(
    private blockchainService: BlockchainService,
    private withdrawService: WithdrawService,
  ) {}

  /**
   * 获取监听状态（管理员）
   */
  @UseGuards(AdminGuard)
  @Get('status')
  async getStatus() {
    return this.blockchainService.getStatus();
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
   */
  @UseGuards(AdminGuard)
  @Get('withdraw-wallet/balance')
  async getWithdrawWalletBalance() {
    const balance = await this.withdrawService.getWithdrawWalletBalance();
    if (!balance) {
      return { error: '提现钱包未配置' };
    }
    return balance;
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
}
