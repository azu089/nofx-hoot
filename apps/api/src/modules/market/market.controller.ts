import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { MarketService } from './market.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

/**
 * 市场数据控制器
 * 提供交易对搜索等公开 API
 *
 * 路由前缀: /api/market
 */
@Controller('market')
@UseGuards(JwtAuthGuard)
export class MarketController {
  constructor(private readonly marketService: MarketService) {}

  /**
   * 搜索交易对
   * GET /api/market/symbols?search=BTC&limit=50
   *
   * @param search 搜索关键词（可选）
   * @param limit 返回数量限制（默认 50，最大 200）
   * @returns 交易对列表
   */
  @Get('symbols')
  async searchSymbols(
    @Query('search') search?: string,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = Math.min(parseInt(limit || '50', 10) || 50, 200);
    return this.marketService.searchSymbols(search, parsedLimit);
  }

  /**
   * 获取热门交易对
   * GET /api/market/symbols/popular
   *
   * @returns 热门交易对列表
   */
  @Get('symbols/popular')
  async getPopularSymbols() {
    return this.marketService.getPopularSymbols();
  }
}
