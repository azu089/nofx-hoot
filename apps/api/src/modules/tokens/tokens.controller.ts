import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AdminGuard } from '../../common/guards/admin.guard';
import { TokensService } from './tokens.service';
import { ExchangeTokenDto } from './dto/exchange-token.dto';

/**
 * 代币控制器
 * 处理积分兑换代币、释放进度查询等接口
 * 注意：建议使用 /api/gamefi/* 统一入口
 */
@ApiTags('代币管理')
@Controller('tokens')
@ApiBearerAuth()
export class TokensController {
  constructor(private readonly tokensService: TokensService) {}

  /**
   * POST /api/tokens/exchange
   * 积分兑换代币
   */
  @Post('exchange')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '积分兑换代币' })
  async exchange(@Request() req: any, @Body() dto: ExchangeTokenDto) {
    const userId = req.user.userId;

    const result = await this.tokensService.exchange(
      userId,
      dto.points,
      dto.mode,
    );

    return {
      code: 0,
      message: 'success',
      data: result,
    };
  }

  /**
   * GET /api/tokens/balance
   * 查询代币余额（包含可用、锁定、待释放）
   */
  @Get('balance')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '查询代币余额' })
  async getBalance(@Request() req: any) {
    const userId = req.user.userId;

    const balance = await this.tokensService.getBalance(userId);

    return {
      code: 0,
      message: 'success',
      data: balance,
    };
  }

  /**
   * GET /api/tokens/vesting
   * 查询释放进度
   */
  @Get('vesting')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '查询释放进度' })
  async getVestingProgress(@Request() req: any) {
    const userId = req.user.userId;

    const progress = await this.tokensService.getVestingProgress(userId);

    return {
      code: 0,
      message: 'success',
      data: progress,
    };
  }

  /**
   * GET /api/tokens/orders
   * 查询兑换订单列表
   */
  @Get('orders')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '查询兑换订单列表' })
  async getOrders(@Request() req: any) {
    const userId = req.user.userId;

    const orders = await this.tokensService.getOrders(userId);

    return {
      code: 0,
      message: 'success',
      data: orders,
    };
  }

  // ===================== 链上功能 =====================

  /**
   * POST /api/tokens/withdraw-onchain
   * 链上提现
   */
  @Post('withdraw-onchain')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '链上提现', description: '将 $QFI 提现到 BSC 链上钱包' })
  async withdrawOnchain(
    @Request() req: any,
    @Body() dto: { amount: string; toAddress: string },
  ) {
    const userId = req.user.userId || req.user.sub;
    const result = await this.tokensService.withdrawOnchain(userId, dto.amount, dto.toAddress);
    return {
      code: 0,
      message: '提现申请已提交，预计 24 小时内处理',
      data: result,
    };
  }

  /**
   * GET /api/tokens/withdrawals
   * 获取提现记录
   */
  @Get('withdrawals')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '获取提现记录' })
  async getWithdrawals(@Request() req: any, @Query('limit') limit?: number) {
    const userId = req.user.userId || req.user.sub;
    const withdrawals = await this.tokensService.getWithdrawals(userId, limit);
    return {
      code: 0,
      message: 'success',
      data: withdrawals,
    };
  }

  /**
   * GET /api/tokens/stats
   * 获取代币统计（公开接口，无需认证）
   */
  @Get('stats')
  @ApiOperation({ summary: '获取代币统计', description: '获取 $QFI 代币统计数据（公开）' })
  async getTokenStats() {
    const stats = await this.tokensService.getTokenStats();
    return {
      code: 0,
      message: 'success',
      data: stats,
    };
  }

  /**
   * GET /api/tokens/buyback-history
   * 获取回购历史（公开接口）
   */
  @Get('buyback-history')
  @ApiOperation({ summary: '获取回购历史', description: '获取平台回购销毁记录（公开）' })
  async getBuybackHistory(@Query('limit') limit?: number) {
    const history = await this.tokensService.getBuybackHistory(limit);
    return {
      code: 0,
      message: 'success',
      data: history,
    };
  }

  /**
   * POST /api/tokens/admin/buyback
   * 记录回购销毁（仅管理员）
   */
  @Post('admin/buyback')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiOperation({ summary: '记录回购销毁', description: '管理员记录回购销毁交易' })
  async recordBuyback(@Body() dto: { usdtSpent: string; qfiBought: string; price: string; txHash: string }) {
    const result = await this.tokensService.recordBuyback(dto.usdtSpent, dto.qfiBought, dto.price, dto.txHash);
    return {
      code: 0,
      message: '回购记录已保存',
      data: result,
    };
  }

  /**
   * POST /api/tokens/admin/process-withdrawal/:id
   * 处理提现（仅管理员）
   */
  @Post('admin/process-withdrawal/:id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiOperation({ summary: '处理提现', description: '管理员处理提现请求' })
  async processWithdrawal(@Param('id') id: string, @Body('txHash') txHash: string) {
    const result = await this.tokensService.processWithdrawal(id, txHash);
    return {
      code: 0,
      message: '提现已处理',
      data: result,
    };
  }

  /**
   * GET /api/tokens/admin/pending-withdrawals
   * 获取待处理提现（仅管理员）
   */
  @Get('admin/pending-withdrawals')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiOperation({ summary: '获取待处理提现', description: '管理员获取待处理提现列表' })
  async getPendingWithdrawals() {
    const withdrawals = await this.tokensService.getPendingWithdrawals();
    return {
      code: 0,
      message: 'success',
      data: withdrawals,
    };
  }
}
