import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ExchangeService } from './exchange.service';
import { GetQuoteDto } from './dto/quote.dto';
import { ConvertDto } from './dto/convert.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

// 请求类型定义
interface AuthenticatedRequest {
  user: {
    sub: string;
    email: string;
  };
}

/**
 * 资产兑换控制器
 * 提供资产闪兑功能（USDT、点卡、积分、QFI代币互换）
 */
@Controller('exchange')
@UseGuards(JwtAuthGuard)
export class ExchangeController {
  constructor(private readonly exchangeService: ExchangeService) {}

  /**
   * 获取兑换报价
   * POST /api/exchange/quote
   */
  @Post('quote')
  async getQuote(@Request() req: AuthenticatedRequest, @Body() dto: GetQuoteDto) {
    return this.exchangeService.getQuote(req.user.sub, dto);
  }

  /**
   * 执行兑换
   * POST /api/exchange/convert
   */
  @Post('convert')
  async convert(@Request() req: AuthenticatedRequest, @Body() dto: ConvertDto) {
    return this.exchangeService.convert(req.user.sub, dto);
  }

  /**
   * 获取兑换历史
   * GET /api/exchange/history
   */
  @Get('history')
  async getHistory(
    @Request() req: AuthenticatedRequest,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    return this.exchangeService.getHistory(
      req.user.sub,
      parseInt(page, 10),
      parseInt(limit, 10),
    );
  }

  /**
   * 获取支持的兑换对
   * GET /api/exchange/pairs
   */
  @Get('pairs')
  getSupportedPairs() {
    return this.exchangeService.getSupportedPairs();
  }
}
