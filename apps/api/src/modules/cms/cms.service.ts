import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateContentDto,
  UpdateContentDto,
  CreateBannerDto,
  UpdateBannerDto,
  CreateHelpDocDto,
  UpdateHelpDocDto,
} from './dto/cms.dto';

@Injectable()
export class CmsService {
  constructor(private prisma: PrismaService) {}

  // ==================== 内容管理 ====================

  /**
   * 获取公开内容（前端使用）
   */
  async getPublicContents(locale = 'zh-CN') {
    const now = new Date();
    return this.prisma.client.cms_contents.findMany({
      where: {
        is_published: true,
        locale,
        OR: [{ publish_at: null }, { publish_at: { lte: now } }],
        AND: [{ OR: [{ expire_at: null }, { expire_at: { gt: now } }] }],
      },
      orderBy: { sort_order: 'asc' },
      select: {
        content_key: true,
        content_type: true,
        title: true,
        content: true,
        metadata: true,
      },
    });
  }

  /**
   * 根据 key 获取内容
   */
  async getContentByKey(key: string, locale = 'zh-CN') {
    const now = new Date();
    const content = await this.prisma.client.cms_contents.findFirst({
      where: {
        content_key: key,
        is_published: true,
        locale,
        OR: [{ publish_at: null }, { publish_at: { lte: now } }],
        AND: [{ OR: [{ expire_at: null }, { expire_at: { gt: now } }] }],
      },
    });

    if (!content) {
      throw new NotFoundException(`内容 ${key} 不存在或未发布`);
    }

    return content;
  }

  /**
   * 获取所有内容（管理后台）
   */
  async getAllContents(page = 1, limit = 20, locale?: string) {
    const where = locale ? { locale } : {};
    const [items, total] = await Promise.all([
      this.prisma.client.cms_contents.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ sort_order: 'asc' }, { created_at: 'desc' }],
        include: {
          users: {
            select: { id: true, email: true },
          },
        },
      }),
      this.prisma.client.cms_contents.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * 创建内容
   */
  async createContent(dto: CreateContentDto, userId: string) {
    // 检查 key 是否已存在
    const existing = await this.prisma.client.cms_contents.findUnique({
      where: { content_key: dto.contentKey },
    });
    if (existing) {
      throw new ConflictException(`内容键 ${dto.contentKey} 已存在`);
    }

    return this.prisma.client.cms_contents.create({
      data: {
        content_key: dto.contentKey,
        content_type: dto.contentType,
        title: dto.title,
        content: dto.content,
        locale: dto.locale || 'zh-CN',
        is_published: dto.isPublished ?? true,
        publish_at: dto.publishAt ? new Date(dto.publishAt) : null,
        expire_at: dto.expireAt ? new Date(dto.expireAt) : null,
        sort_order: dto.sortOrder ?? 0,
        metadata: dto.metadata,
        updated_by: userId,
      },
    });
  }

  /**
   * 更新内容
   */
  async updateContent(id: string, dto: UpdateContentDto, userId: string) {
    const content = await this.prisma.client.cms_contents.findUnique({
      where: { id },
    });
    if (!content) {
      throw new NotFoundException('内容不存在');
    }

    return this.prisma.client.cms_contents.update({
      where: { id },
      data: {
        title: dto.title,
        content: dto.content,
        is_published: dto.isPublished,
        publish_at: dto.publishAt ? new Date(dto.publishAt) : undefined,
        expire_at: dto.expireAt ? new Date(dto.expireAt) : undefined,
        sort_order: dto.sortOrder,
        metadata: dto.metadata,
        updated_by: userId,
        updated_at: new Date(),
      },
    });
  }

  /**
   * 删除内容
   */
  async deleteContent(id: string) {
    const content = await this.prisma.client.cms_contents.findUnique({
      where: { id },
    });
    if (!content) {
      throw new NotFoundException('内容不存在');
    }

    await this.prisma.client.cms_contents.delete({ where: { id } });
    return { message: '删除成功' };
  }

  // ==================== Banner 管理 ====================

  /**
   * 获取活跃 Banner（前端使用）
   */
  async getActiveBanners(position?: string) {
    const now = new Date();
    const where: any = {
      is_active: true,
      OR: [{ start_at: null }, { start_at: { lte: now } }],
      AND: [{ OR: [{ end_at: null }, { end_at: { gt: now } }] }],
    };

    if (position) {
      where.position = position;
    }

    return this.prisma.client.cms_banners.findMany({
      where,
      orderBy: { sort_order: 'asc' },
      select: {
        id: true,
        position: true,
        title: true,
        subtitle: true,
        image_url: true,
        link_url: true,
        link_target: true,
        button_text: true,
      },
    });
  }

  /**
   * 获取所有 Banner（管理后台）
   */
  async getAllBanners(page = 1, limit = 20, position?: string) {
    const where = position ? { position } : {};
    const [items, total] = await Promise.all([
      this.prisma.client.cms_banners.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ sort_order: 'asc' }, { created_at: 'desc' }],
        include: {
          users: {
            select: { id: true, email: true },
          },
        },
      }),
      this.prisma.client.cms_banners.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * 创建 Banner
   */
  async createBanner(dto: CreateBannerDto, userId: string) {
    return this.prisma.client.cms_banners.create({
      data: {
        position: dto.position,
        title: dto.title,
        subtitle: dto.subtitle,
        image_url: dto.imageUrl,
        link_url: dto.linkUrl,
        link_target: dto.linkTarget || '_self',
        button_text: dto.buttonText,
        is_active: dto.isActive ?? true,
        start_at: dto.startAt ? new Date(dto.startAt) : null,
        end_at: dto.endAt ? new Date(dto.endAt) : null,
        sort_order: dto.sortOrder ?? 0,
        updated_by: userId,
      },
    });
  }

  /**
   * 更新 Banner
   */
  async updateBanner(id: string, dto: UpdateBannerDto, userId: string) {
    const banner = await this.prisma.client.cms_banners.findUnique({
      where: { id },
    });
    if (!banner) {
      throw new NotFoundException('Banner 不存在');
    }

    return this.prisma.client.cms_banners.update({
      where: { id },
      data: {
        title: dto.title,
        subtitle: dto.subtitle,
        image_url: dto.imageUrl,
        link_url: dto.linkUrl,
        link_target: dto.linkTarget,
        button_text: dto.buttonText,
        is_active: dto.isActive,
        start_at: dto.startAt ? new Date(dto.startAt) : undefined,
        end_at: dto.endAt ? new Date(dto.endAt) : undefined,
        sort_order: dto.sortOrder,
        updated_by: userId,
        updated_at: new Date(),
      },
    });
  }

  /**
   * 删除 Banner
   */
  async deleteBanner(id: string) {
    const banner = await this.prisma.client.cms_banners.findUnique({
      where: { id },
    });
    if (!banner) {
      throw new NotFoundException('Banner 不存在');
    }

    await this.prisma.client.cms_banners.delete({ where: { id } });
    return { message: '删除成功' };
  }

  // ==================== 帮助文档管理 ====================

  /**
   * 获取发布的帮助文档（前端使用）
   */
  async getPublishedHelpDocs(category?: string) {
    const where: any = { is_published: true };
    if (category) {
      where.category = category;
    }

    return this.prisma.client.cms_help_docs.findMany({
      where,
      orderBy: { sort_order: 'asc' },
      select: {
        id: true,
        category: true,
        title: true,
        slug: true,
        summary: true,
        tags: true,
      },
    });
  }

  /**
   * 根据 slug 获取帮助文档详情
   */
  async getHelpDocBySlug(slug: string) {
    const doc = await this.prisma.client.cms_help_docs.findUnique({
      where: { slug },
    });
    if (!doc || !doc.is_published) {
      throw new NotFoundException('文档不存在');
    }

    // 更新浏览量
    await this.prisma.client.cms_help_docs.update({
      where: { id: doc.id },
      data: { view_count: { increment: 1 } },
    });

    return doc;
  }

  /**
   * 获取所有帮助文档（管理后台）
   */
  async getAllHelpDocs(page = 1, limit = 20, category?: string) {
    const where = category ? { category } : {};
    const [items, total] = await Promise.all([
      this.prisma.client.cms_help_docs.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ sort_order: 'asc' }, { created_at: 'desc' }],
        include: {
          users: {
            select: { id: true, email: true },
          },
        },
      }),
      this.prisma.client.cms_help_docs.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * 创建帮助文档
   */
  async createHelpDoc(dto: CreateHelpDocDto, userId: string) {
    // 检查 slug 是否已存在
    const existing = await this.prisma.client.cms_help_docs.findUnique({
      where: { slug: dto.slug },
    });
    if (existing) {
      throw new ConflictException(`文档 slug ${dto.slug} 已存在`);
    }

    return this.prisma.client.cms_help_docs.create({
      data: {
        category: dto.category,
        title: dto.title,
        slug: dto.slug,
        summary: dto.summary,
        content: dto.content,
        tags: dto.tags || [],
        is_published: dto.isPublished ?? true,
        sort_order: dto.sortOrder ?? 0,
        updated_by: userId,
      },
    });
  }

  /**
   * 更新帮助文档
   */
  async updateHelpDoc(id: string, dto: UpdateHelpDocDto, userId: string) {
    const doc = await this.prisma.client.cms_help_docs.findUnique({
      where: { id },
    });
    if (!doc) {
      throw new NotFoundException('文档不存在');
    }

    return this.prisma.client.cms_help_docs.update({
      where: { id },
      data: {
        category: dto.category,
        title: dto.title,
        summary: dto.summary,
        content: dto.content,
        tags: dto.tags,
        is_published: dto.isPublished,
        sort_order: dto.sortOrder,
        updated_by: userId,
        updated_at: new Date(),
      },
    });
  }

  /**
   * 删除帮助文档
   */
  async deleteHelpDoc(id: string) {
    const doc = await this.prisma.client.cms_help_docs.findUnique({
      where: { id },
    });
    if (!doc) {
      throw new NotFoundException('文档不存在');
    }

    await this.prisma.client.cms_help_docs.delete({ where: { id } });
    return { message: '删除成功' };
  }
}
