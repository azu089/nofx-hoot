import { Controller, Get, Query, Headers, BadRequestException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { MarketService } from './market.service';
import { DEFAULT_LOCALE } from '../../common/utils/i18n.util';

@ApiTags('market')
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
   * 获取单个合约币种最新价格（公开接口，避免前端直连 Binance 触发 CSP 问题）
   * GET /market/price?symbol=SOLUSDT
   */
  @Public()
  @Get('price')
  async getSymbolPrice(@Query('symbol') symbol?: string) {
    if (!symbol) throw new BadRequestException('symbol is required');
    const price = await this.marketService.getSymbolPrice(symbol);
    return { code: 0, message: 'success', data: { symbol, price } };
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
   * 获取平台公告（公开接口，支持多语言）
   * GET /market/announcements?locale=en&position=home
   * 也可通过 Accept-Language header 传递语言
   */
  @Public()
  @Get('announcements')
  async getAnnouncements(
    @Query('locale') queryLocale?: string,
    @Query('position') position?: string,
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    // 优先使用 query 参数，其次 header，最后默认值
    const locale =
      queryLocale || this.parseAcceptLanguage(acceptLanguage) || DEFAULT_LOCALE;
    const announcements = await this.marketService.getAnnouncements(
      locale,
      position,
    );
    return {
      code: 0,
      message: 'success',
      data: announcements,
    };
  }

  /**
   * 获取跑马灯（公开接口，支持多语言）
   * GET /market/marquees?locale=en
   */
  @Public()
  @Get('marquees')
  async getMarquees(
    @Query('locale') queryLocale?: string,
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    const locale =
      queryLocale || this.parseAcceptLanguage(acceptLanguage) || DEFAULT_LOCALE;
    const marquees = await this.marketService.getMarquees(locale);
    return {
      code: 0,
      message: 'success',
      data: marquees,
    };
  }

  /**
   * 获取跑马灯配置（公开接口）
   * GET /market/marquees/config
   */
  @Public()
  @Get('marquees/config')
  async getMarqueeConfig() {
    const config = await this.marketService.getMarqueeConfig();
    return {
      code: 0,
      message: 'success',
      data: config,
    };
  }

  /**
   * 获取首页数据（聚合接口，支持多语言）
   * GET /market/homepage?locale=en
   */
  @Public()
  @Get('homepage')
  async getHomepageData(
    @Query('locale') queryLocale?: string,
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    const locale =
      queryLocale || this.parseAcceptLanguage(acceptLanguage) || DEFAULT_LOCALE;
    const [prices, news, announcements, marquees, marqueeConfig] =
      await Promise.all([
        this.marketService.getPrices(),
        this.marketService.getNews(15),
        this.marketService.getAnnouncements(locale),
        this.marketService.getMarquees(locale),
        this.marketService.getMarqueeConfig(),
      ]);

    return {
      code: 0,
      message: 'success',
      data: {
        prices,
        news,
        announcements,
        marquees,
        marqueeConfig,
      },
    };
  }

  /**
   * 解析 Accept-Language header，提取首选语言
   * 示例: "zh-CN,zh;q=0.9,en;q=0.8" -> "zh-CN"
   */
  private parseAcceptLanguage(header?: string): string | null {
    if (!header) return null;
    // 取第一个语言（最高优先级）
    const firstLang = header.split(',')[0]?.split(';')[0]?.trim();
    return firstLang || null;
  }
}
