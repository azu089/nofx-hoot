import { Controller, Get, Query } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { MarketService } from './market.service';

@Controller('market')
export class MarketController {
  constructor(private marketService: MarketService) {}

  /**
   * 获取市场行情（公开接口）
   * GET /market/prices
   */
  @Public()
  @Get('prices')
  async getPrices() {
    const prices = await this.marketService.getPrices();
    return {
      code: 0,
      message: 'success',
      data: prices,
      updatedAt: new Date(),
    };
  }

  /**
   * 获取行业新闻（公开接口）
   * GET /market/news?limit=10
   */
  @Public()
  @Get('news')
  async getNews(@Query('limit') limit?: string) {
    const newsLimit = limit ? parseInt(limit, 10) : 10;
    const news = await this.marketService.getNews(newsLimit);
    return {
      code: 0,
      message: 'success',
      data: news,
    };
  }

  /**
   * 获取平台公告（公开接口）
   * GET /market/announcements
   */
  @Public()
  @Get('announcements')
  async getAnnouncements() {
    const announcements = await this.marketService.getAnnouncements();
    return {
      code: 0,
      message: 'success',
      data: announcements,
    };
  }

  /**
   * 获取首页数据（聚合接口）
   * GET /market/homepage
   */
  @Public()
  @Get('homepage')
  async getHomepageData() {
    const [prices, news, announcements] = await Promise.all([
      this.marketService.getPrices(),
      this.marketService.getNews(5),
      this.marketService.getAnnouncements(),
    ]);

    return {
      code: 0,
      message: 'success',
      data: {
        prices,
        news,
        announcements,
      },
    };
  }
}
