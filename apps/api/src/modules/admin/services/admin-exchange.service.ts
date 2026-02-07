/**
 * 管理后台 - 交易所推荐管理服务
 * 交易所 CRUD、排序、启停
 */
import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  CreateExchangeDto,
  UpdateExchangeDto,
} from '../dto/exchange.dto';

@Injectable()
export class AdminExchangeService {
  private readonly logger = new Logger(AdminExchangeService.name);

  constructor(private prisma: PrismaService) {}

  // 获取交易所列表（含 inactive）
  async getExchanges(params: {
    page: number;
    limit: number;
    search?: string;
  }) {
    const { page, limit, search } = params;
    const skip = (page - 1) * limit;

    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { slug: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [items, total] = await Promise.all([
      this.prisma.exchange.findMany({
        where,
        orderBy: { sortOrder: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.exchange.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  // 获取单个交易所
  async getExchangeById(id: string) {
    const exchange = await this.prisma.exchange.findUnique({
      where: { id },
    });
    if (!exchange) {
      throw new NotFoundException('交易所不存在');
    }
    return exchange;
  }

  // 创建交易所
  async createExchange(dto: CreateExchangeDto) {
    // 检查 slug 唯一性
    const existing = await this.prisma.exchange.findUnique({
      where: { slug: dto.slug },
    });
    if (existing) {
      throw new BadRequestException(`交易所标识 "${dto.slug}" 已存在`);
    }

    return this.prisma.exchange.create({
      data: {
        slug: dto.slug,
        name: dto.name,
        logo: dto.logo,
        description: dto.description || '',
        features: dto.features || [],
        affiliateUrl: dto.affiliateUrl || '',
        status: dto.status || 'supported',
        sortOrder: dto.sortOrder || 0,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
      },
    });
  }

  // 更新交易所
  async updateExchange(id: string, dto: UpdateExchangeDto) {
    const exchange = await this.prisma.exchange.findUnique({
      where: { id },
    });
    if (!exchange) {
      throw new NotFoundException('交易所不存在');
    }

    // 如果修改 slug，检查唯一性
    if (dto.slug && dto.slug !== exchange.slug) {
      const existing = await this.prisma.exchange.findUnique({
        where: { slug: dto.slug },
      });
      if (existing) {
        throw new BadRequestException(`交易所标识 "${dto.slug}" 已存在`);
      }
    }

    return this.prisma.exchange.update({
      where: { id },
      data: dto,
    });
  }

  // 删除交易所
  async deleteExchange(id: string) {
    const exchange = await this.prisma.exchange.findUnique({
      where: { id },
    });
    if (!exchange) {
      throw new NotFoundException('交易所不存在');
    }

    await this.prisma.exchange.delete({ where: { id } });
    return { success: true };
  }

  // 获取统计数据
  async getExchangeStats() {
    const [total, active, supported, comingSoon] = await Promise.all([
      this.prisma.exchange.count(),
      this.prisma.exchange.count({ where: { isActive: true } }),
      this.prisma.exchange.count({ where: { isActive: true, status: 'supported' } }),
      this.prisma.exchange.count({ where: { isActive: true, status: 'coming_soon' } }),
    ]);

    return { total, active, supported, comingSoon };
  }
}
