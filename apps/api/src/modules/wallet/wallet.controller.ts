import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { WalletService } from './wallet.service';
import {
  CreateWithdrawDto,
  TransactionQueryDto,
  ExchangeDto,
} from './dto/wallet.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('wallet')
export class WalletController {
  constructor(private walletService: WalletService) {}

  // 获取余额
  @Get('balance')
  async getBalance(@CurrentUser() user: { id: string }) {
    return this.walletService.getBalance(user.id);
  }

  // 获取交易记录
  @Get('transactions')
  async getTransactions(
    @CurrentUser() user: { id: string },
    @Query() query: TransactionQueryDto,
  ) {
    return this.walletService.getTransactions(user.id, query);
  }

  // 获取充值地址
  @Get('deposit-address')
  async getDepositAddress(
    @CurrentUser() user: { id: string },
    @Query('chain') chain: string,
    @Query('asset') asset: string,
  ) {
    return this.walletService.getDepositAddress(user.id, chain, asset);
  }

  // 创建提现申请
  @Post('withdraw')
  async createWithdrawRequest(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateWithdrawDto,
  ) {
    return this.walletService.createWithdrawRequest(user.id, dto);
  }

  // 获取提现记录
  @Get('withdraw-requests')
  async getWithdrawRequests(@CurrentUser() user: { id: string }) {
    return this.walletService.getWithdrawRequests(user.id);
  }

  // 兑换
  @Post('exchange')
  async exchange(
    @CurrentUser() user: { id: string },
    @Body() dto: ExchangeDto,
  ) {
    return this.walletService.exchange(
      user.id,
      dto.fromAsset,
      dto.toAsset,
      dto.amount,
    );
  }
}
