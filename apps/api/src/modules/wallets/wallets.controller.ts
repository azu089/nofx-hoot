import { Controller, Get, UseGuards } from '@nestjs/common';
import { WalletsService } from './wallets.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/dto/jwt-payload.dto';

/**
 * 钱包控制器
 * 路由前缀: /api/wallets
 */
@Controller('wallets')
@UseGuards(JwtAuthGuard) // 所有接口都需要认证
export class WalletsController {
  constructor(private readonly walletsService: WalletsService) {}

  /**
   * 获取当前用户钱包信息
   * GET /api/wallets/me
   */
  @Get('me')
  async getMyWallet(@CurrentUser() user: JwtPayload) {
    return this.walletsService.findByUserId(user.sub);
  }

  /**
   * 获取当前用户余额概览
   * GET /api/wallets/balance
   */
  @Get('balance')
  async getBalance(@CurrentUser() user: JwtPayload) {
    return this.walletsService.getBalance(user.sub);
  }

  // TODO: 实现充值接口 POST /api/wallets/deposit
  // TODO: 实现提现接口 POST /api/wallets/withdraw
  // TODO: 实现获取交易记录接口 GET /api/wallets/transactions
}
