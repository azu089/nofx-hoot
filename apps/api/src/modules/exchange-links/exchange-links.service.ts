import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateExchangeLinkDto, UpdateExchangeLinkDto } from './dto';

@Injectable()
export class ExchangeLinksService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 获取所有启用的交易所链接
   */
  async getActiveLinks() {
    return this.prisma.client.exchange_links.findMany({
      where: { is_active: true },
      orderBy: { sort_order: 'asc' },
      select: {
        id: true,
        exchange_id: true,
        name: true,
        logo: true,
        rebate: true,
        link: true,
        description: true,
        features: true,
      },
    });
  }

  /**
   * 获取所有交易所链接（管理员）
   */
  async getAllLinks() {
    return this.prisma.client.exchange_links.findMany({
      orderBy: { sort_order: 'asc' },
    });
  }

  /**
   * 创建交易所链接
   */
  async createLink(dto: CreateExchangeLinkDto) {
    // 检查 exchange_id 是否已存在
    const exists = await this.prisma.client.exchange_links.findUnique({
      where: { exchange_id: dto.exchange_id },
    });

    if (exists) {
      throw new BadRequestException(`交易所 ID "${dto.exchange_id}" 已存在`);
    }

    return this.prisma.client.exchange_links.create({
      data: {
        exchange_id: dto.exchange_id,
        name: dto.name,
        logo: dto.logo,
        rebate: dto.rebate,
        link: dto.link,
        description: dto.description,
        features: dto.features || [],
        is_active: dto.is_active ?? true,
        sort_order: dto.sort_order ?? 0,
      },
    });
  }

  /**
   * 更新交易所链接
   */
  async updateLink(id: string, dto: UpdateExchangeLinkDto) {
    const link = await this.prisma.client.exchange_links.findUnique({
      where: { id },
    });

    if (!link) {
      throw new NotFoundException('交易所链接不存在');
    }

    // 如果修改 exchange_id，检查新 ID 是否冲突
    if (dto.exchange_id && dto.exchange_id !== link.exchange_id) {
      const exists = await this.prisma.client.exchange_links.findUnique({
        where: { exchange_id: dto.exchange_id },
      });

      if (exists) {
        throw new BadRequestException(`交易所 ID "${dto.exchange_id}" 已存在`);
      }
    }

    return this.prisma.client.exchange_links.update({
      where: { id },
      data: {
        ...dto,
        updated_at: new Date(),
      },
    });
  }

  /**
   * 删除交易所链接
   */
  async deleteLink(id: string) {
    const link = await this.prisma.client.exchange_links.findUnique({
      where: { id },
    });

    if (!link) {
      throw new NotFoundException('交易所链接不存在');
    }

    return this.prisma.client.exchange_links.delete({
      where: { id },
    });
  }
}
