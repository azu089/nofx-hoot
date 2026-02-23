import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { PrismaService } from '../../prisma/prisma.service';

@ApiTags('exchanges')
@Controller('exchanges')
export class ExchangesController {
  constructor(private prisma: PrismaService) {}

  /**
   * 获取活跃交易所列表（公开接口，无需登录）
   * GET /exchanges
   */
  @Public()
  @Get()
  async getActiveExchanges() {
    const exchanges = await this.prisma.exchange.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        slug: true,
        name: true,
        logo: true,
        description: true,
        features: true,
        affiliateUrl: true,
        status: true,
      },
    });
    return exchanges;
  }
}
