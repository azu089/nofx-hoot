/**
 * 管理后台内容管理服务
 * 支持公告、跑马灯的 CRUD 和自动翻译
 */
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { TranslateService } from '../../../common/services/translate.service';
import Redis from 'ioredis';

// ==================== DTOs ====================

export interface CreateAnnouncementDto {
  content: string; // 中文内容（自动翻译为多语言）
  title?: string; // 中文标题
  type?: string;
  position?: string;
  link?: string;
  coverImage?: string;
  priority?: number;
  publishedAt?: Date;
  expiredAt?: Date;
  pushNotification?: boolean;
}

export interface UpdateAnnouncementDto extends Partial<CreateAnnouncementDto> {
  status?: string;
}

export interface CreateMarqueeDto {
  content: string; // 中文内容
  link?: string;
  bgColor?: string;
  textColor?: string;
  sortOrder?: number;
}

export interface UpdateMarqueeDto extends Partial<CreateMarqueeDto> {
  isActive?: boolean;
  enabled?: boolean; // 前端字段，映射到 isActive
}

// ==================== FAQ DTOs ====================

export interface CreateFaqDto {
  question: string; // 中文问题（自动翻译为多语言）
  answer: string; // 中文回答
  category?: string;
  sortOrder?: number;
}

export interface UpdateFaqDto extends Partial<CreateFaqDto> {
  isActive?: boolean;
}

// ==================== 法律文档 DTOs ====================

export interface CreateLegalDocDto {
  slug: string; // URL 标识符：terms, privacy, risk
  title: string; // 中文标题
  content: string; // 中文内容
  version?: string;
  effectiveAt?: Date;
}

export interface UpdateLegalDocDto extends Partial<
  Omit<CreateLegalDocDto, 'slug'>
> {
  isActive?: boolean;
}

// 跑马灯全局配置
export interface MarqueeConfig {
  scrollSpeed: number; // 滚动速度（像素/秒），范围 20-200
  pauseOnHover: boolean; // 鼠标悬停时暂停
  displayDuration: number; // 每条消息显示时长（秒）
}

const DEFAULT_MARQUEE_CONFIG: MarqueeConfig = {
  scrollSpeed: 50,
  pauseOnHover: true,
  displayDuration: 5,
};

const MARQUEE_CONFIG_KEY = 'hoot:marquee:config';
const TRANSLATE_ENABLED_KEY = 'hoot:translate:enabled';

@Injectable()
export class AdminContentService {
  private readonly logger = new Logger(AdminContentService.name);
  private redis: Redis;

  constructor(
    private prisma: PrismaService,
    private translateService: TranslateService,
  ) {
    // 初始化 Redis 连接
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD || undefined,
      lazyConnect: true,
    });
  }

  // ==================== 公告管理 ====================

  /**
   * 获取公告列表
   */
  async getAnnouncements(page = 1, limit = 20, status?: string, type?: string) {
    const where: any = {};
    if (status) where.status = status;
    if (type) where.type = type;

    const [total, announcements] = await Promise.all([
      this.prisma.announcement.count({ where }),
      this.prisma.announcement.findMany({
        where,
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      items: announcements.map((a) => ({
        ...a,
        // 提取中文内容供管理后台显示
        titleZh: (a.titleI18n as any)?.['zh-CN'] || a.title,
        contentZh: (a.contentI18n as any)?.['zh-CN'] || a.content,
        titleEn: (a.titleI18n as any)?.['en'] || '',
        contentEn: (a.contentI18n as any)?.['en'] || '',
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * 创建公告（根据开关状态自动翻译）
   */
  async createAnnouncement(dto: CreateAnnouncementDto, createdBy?: string) {
    this.logger.log(`创建公告: ${dto.title || dto.content.slice(0, 20)}...`);

    // 根据开关状态决定是否翻译
    const [titleI18n, contentI18n] = await Promise.all([
      dto.title ? this.translateIfEnabled(dto.title) : Promise.resolve({}),
      this.translateIfEnabled(dto.content),
    ]);

    const announcement = await this.prisma.announcement.create({
      data: {
        title: dto.title || '',
        content: dto.content,
        titleI18n,
        contentI18n,
        type: dto.type || 'system',
        position: dto.position || 'all',
        link: dto.link,
        coverImage: dto.coverImage,
        priority: dto.priority || 0,
        status: 'published',
        publishedAt: dto.publishedAt || new Date(),
        expiredAt: dto.expiredAt,
        pushNotification: dto.pushNotification || false,
        createdBy,
      },
    });

    this.logger.log(`公告创建成功: ${announcement.id}`);
    return announcement;
  }

  /**
   * 更新公告（内容变更时自动重新翻译）
   */
  async updateAnnouncement(id: string, dto: UpdateAnnouncementDto) {
    const existing = await this.prisma.announcement.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('公告不存在');
    }

    const updateData: any = { ...dto };

    // 如果内容有变化，根据开关状态翻译
    if (dto.content && dto.content !== existing.content) {
      updateData.contentI18n = await this.translateIfEnabled(dto.content);
    }

    // 如果标题有变化，根据开关状态翻译
    if (dto.title && dto.title !== existing.title) {
      updateData.titleI18n = await this.translateIfEnabled(dto.title);
    }

    return this.prisma.announcement.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * 删除公告
   */
  async deleteAnnouncement(id: string) {
    return this.prisma.announcement.delete({ where: { id } });
  }

  /**
   * 批量发布/下线公告
   */
  async batchUpdateAnnouncementStatus(ids: string[], status: string) {
    return this.prisma.announcement.updateMany({
      where: { id: { in: ids } },
      data: { status },
    });
  }

  // ==================== 跑马灯管理 ====================

  /**
   * 获取跑马灯列表
   */
  async getMarquees(page = 1, limit = 50) {
    const [total, marquees] = await Promise.all([
      this.prisma.marquee.count(),
      this.prisma.marquee.findMany({
        orderBy: { sortOrder: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    // 转换为前端期望的格式
    return {
      marquees: marquees.map((m) => ({
        id: m.id,
        content: m.content,
        contentZh: (m.contentI18n as any)?.['zh-CN'] || m.content,
        contentEn: (m.contentI18n as any)?.['en'] || '',
        link: m.link || '',
        order: m.sortOrder,
        enabled: m.isActive,
        bgColor: m.bgColor || '#06B6D4',
        textColor: m.textColor || '#FFFFFF',
      })),
      total,
      page,
      limit,
    };
  }

  /**
   * 创建跑马灯（根据开关状态自动翻译）
   */
  async createMarquee(dto: CreateMarqueeDto) {
    this.logger.log(`创建跑马灯: ${dto.content.slice(0, 20)}...`);

    // 根据开关状态决定是否翻译
    const contentI18n = await this.translateIfEnabled(dto.content);
    this.logger.log(`翻译完成: ${JSON.stringify(contentI18n)}`);

    // 获取当前最大排序号
    const maxOrder = await this.prisma.marquee.aggregate({
      _max: { sortOrder: true },
    });

    const marquee = await this.prisma.marquee.create({
      data: {
        content: dto.content,
        contentI18n,
        link: dto.link,
        bgColor: dto.bgColor || '#06B6D4',
        textColor: dto.textColor || '#FFFFFF',
        sortOrder: dto.sortOrder ?? (maxOrder._max.sortOrder || 0) + 1,
        isActive: true,
      },
    });

    this.logger.log(`跑马灯创建成功: ${marquee.id}`);

    // 返回前端期望的格式
    return {
      id: marquee.id,
      content: marquee.content,
      contentZh: (contentI18n as any)?.['zh-CN'] || marquee.content,
      contentEn: (contentI18n as any)?.['en'] || '',
      link: marquee.link || '',
      order: marquee.sortOrder,
      enabled: marquee.isActive,
      bgColor: marquee.bgColor,
      textColor: marquee.textColor,
    };
  }

  /**
   * 更新跑马灯（内容变更时自动重新翻译）
   */
  async updateMarquee(id: string, dto: UpdateMarqueeDto) {
    const existing = await this.prisma.marquee.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('跑马灯不存在');
    }

    const updateData: any = {};

    // 映射前端字段到数据库字段
    if (dto.content !== undefined) updateData.content = dto.content;
    if (dto.link !== undefined) updateData.link = dto.link;
    if (dto.bgColor !== undefined) updateData.bgColor = dto.bgColor;
    if (dto.textColor !== undefined) updateData.textColor = dto.textColor;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;
    if (dto.enabled !== undefined) updateData.isActive = dto.enabled; // 前端 enabled 映射到 isActive
    if (dto.sortOrder !== undefined) updateData.sortOrder = dto.sortOrder;

    // 如果内容有变化，根据开关状态翻译
    let contentI18n = existing.contentI18n as any;
    if (dto.content && dto.content !== existing.content) {
      contentI18n = await this.translateIfEnabled(dto.content);
      updateData.contentI18n = contentI18n;
      this.logger.log(`跑马灯重新翻译: ${JSON.stringify(contentI18n)}`);
    }

    const marquee = await this.prisma.marquee.update({
      where: { id },
      data: updateData,
    });

    // 返回前端期望的格式
    return {
      id: marquee.id,
      content: marquee.content,
      contentZh: (marquee.contentI18n as any)?.['zh-CN'] || marquee.content,
      contentEn: (marquee.contentI18n as any)?.['en'] || '',
      link: marquee.link || '',
      order: marquee.sortOrder,
      enabled: marquee.isActive,
      bgColor: marquee.bgColor,
      textColor: marquee.textColor,
    };
  }

  /**
   * 删除跑马灯
   */
  async deleteMarquee(id: string) {
    return this.prisma.marquee.delete({ where: { id } });
  }

  /**
   * 切换跑马灯状态
   */
  async toggleMarqueeStatus(id: string) {
    const marquee = await this.prisma.marquee.findUnique({ where: { id } });
    if (!marquee) {
      throw new NotFoundException('跑马灯不存在');
    }

    return this.prisma.marquee.update({
      where: { id },
      data: { isActive: !marquee.isActive },
    });
  }

  /**
   * 更新跑马灯排序
   */
  async updateMarqueeOrder(items: { id: string; sortOrder: number }[]) {
    await Promise.all(
      items.map((item) =>
        this.prisma.marquee.update({
          where: { id: item.id },
          data: { sortOrder: item.sortOrder },
        }),
      ),
    );
    return { success: true };
  }

  // ==================== 翻译服务状态 ====================

  /**
   * 获取翻译服务状态
   */
  async getTranslateStatus() {
    const isAvailable = this.translateService.isAvailable();
    let usage: { character_count: number; character_limit: number } | null =
      null;

    if (isAvailable) {
      usage = await this.translateService.getUsage();
    }

    return {
      available: isAvailable,
      usage,
    };
  }

  /**
   * 手动触发重新翻译（用于修复或更新翻译）
   */
  async retranslateAnnouncement(id: string) {
    const announcement = await this.prisma.announcement.findUnique({
      where: { id },
    });
    if (!announcement) {
      throw new NotFoundException('公告不存在');
    }

    const [titleI18n, contentI18n] = await Promise.all([
      announcement.title
        ? this.translateService.translateToAll(announcement.title)
        : Promise.resolve({}),
      this.translateService.translateToAll(announcement.content),
    ]);

    return this.prisma.announcement.update({
      where: { id },
      data: { titleI18n, contentI18n },
    });
  }

  async retranslateMarquee(id: string) {
    const marquee = await this.prisma.marquee.findUnique({ where: { id } });
    if (!marquee) {
      throw new NotFoundException('跑马灯不存在');
    }

    const contentI18n = await this.translateService.translateToAll(
      marquee.content,
    );

    return this.prisma.marquee.update({
      where: { id },
      data: { contentI18n },
    });
  }

  // ==================== 跑马灯配置管理 ====================

  /**
   * 获取跑马灯全局配置
   */
  async getMarqueeConfig(): Promise<MarqueeConfig> {
    try {
      const configStr = await this.redis.get(MARQUEE_CONFIG_KEY);
      if (configStr) {
        return JSON.parse(configStr);
      }
    } catch (error) {
      this.logger.warn(`获取跑马灯配置失败: ${(error as Error).message}`);
    }
    return DEFAULT_MARQUEE_CONFIG;
  }

  /**
   * 更新跑马灯全局配置
   */
  async updateMarqueeConfig(
    config: Partial<MarqueeConfig>,
  ): Promise<MarqueeConfig> {
    const currentConfig = await this.getMarqueeConfig();
    const newConfig: MarqueeConfig = {
      ...currentConfig,
      ...config,
    };

    // 验证配置范围
    newConfig.scrollSpeed = Math.max(20, Math.min(200, newConfig.scrollSpeed));
    newConfig.displayDuration = Math.max(
      1,
      Math.min(30, newConfig.displayDuration),
    );

    try {
      await this.redis.set(MARQUEE_CONFIG_KEY, JSON.stringify(newConfig));
      this.logger.log(`跑马灯配置已更新: ${JSON.stringify(newConfig)}`);
    } catch (error) {
      this.logger.error(`保存跑马灯配置失败: ${(error as Error).message}`);
      throw error;
    }

    return newConfig;
  }

  // ==================== 翻译开关管理 ====================

  /**
   * 获取翻译开关状态
   */
  async getTranslateEnabled(): Promise<boolean> {
    try {
      const value = await this.redis.get(TRANSLATE_ENABLED_KEY);
      // 默认开启翻译
      return value === null ? true : value === 'true';
    } catch (error) {
      this.logger.warn(`获取翻译开关状态失败: ${(error as Error).message}`);
      return true; // 默认开启
    }
  }

  /**
   * 设置翻译开关状态
   */
  async setTranslateEnabled(enabled: boolean): Promise<boolean> {
    try {
      await this.redis.set(TRANSLATE_ENABLED_KEY, enabled ? 'true' : 'false');
      this.logger.log(`翻译开关已${enabled ? '开启' : '关闭'}`);
      return enabled;
    } catch (error) {
      this.logger.error(`设置翻译开关失败: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * 条件翻译 - 只在开关开启时翻译
   */
  private async translateIfEnabled(
    text: string,
  ): Promise<Record<string, string>> {
    const enabled = await this.getTranslateEnabled();
    if (!enabled) {
      // 翻译关闭时，只返回中文
      return { 'zh-CN': text };
    }
    return this.translateService.translateToAll(text);
  }

  /**
   * 预览翻译结果（不保存到数据库）
   * 用于在保存前让用户预览翻译效果
   */
  async previewTranslation(
    title?: string,
    content?: string,
  ): Promise<{
    titleI18n?: Record<string, string>;
    contentI18n?: Record<string, string>;
    available: boolean;
  }> {
    const enabled = await this.getTranslateEnabled();
    const available = this.translateService.isAvailable() && enabled;

    if (!available) {
      return {
        titleI18n: title ? { 'zh-CN': title } : undefined,
        contentI18n: content ? { 'zh-CN': content } : undefined,
        available: false,
      };
    }

    const result: {
      titleI18n?: Record<string, string>;
      contentI18n?: Record<string, string>;
      available: boolean;
    } = { available: true };

    // 并发翻译标题和内容
    const [titleI18n, contentI18n] = await Promise.all([
      title ? this.translateService.translateToAll(title) : undefined,
      content ? this.translateService.translateToAll(content) : undefined,
    ]);

    if (titleI18n) result.titleI18n = titleI18n;
    if (contentI18n) result.contentI18n = contentI18n;

    return result;
  }

  // ==================== FAQ 管理 ====================

  /**
   * 获取 FAQ 列表
   */
  async getFaqItems(page = 1, limit = 50, category?: string) {
    const where: any = {};
    if (category) where.category = category;

    const [total, items] = await Promise.all([
      this.prisma.faqItem.count({ where }),
      this.prisma.faqItem.findMany({
        where,
        orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      items: items.map((item) => ({
        ...item,
        questionZh: (item.questionI18n as any)?.['zh-CN'] || item.questionZh,
        questionEn: (item.questionI18n as any)?.['en'] || item.questionEn,
        answerZh: (item.answerI18n as any)?.['zh-CN'] || item.answerZh,
        answerEn: (item.answerI18n as any)?.['en'] || item.answerEn,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * 获取单个 FAQ
   */
  async getFaqItem(id: string) {
    const item = await this.prisma.faqItem.findUnique({ where: { id } });
    if (!item) {
      throw new NotFoundException('FAQ 不存在');
    }
    return {
      ...item,
      questionZh: (item.questionI18n as any)?.['zh-CN'] || item.questionZh,
      questionEn: (item.questionI18n as any)?.['en'] || item.questionEn,
      answerZh: (item.answerI18n as any)?.['zh-CN'] || item.answerZh,
      answerEn: (item.answerI18n as any)?.['en'] || item.answerEn,
    };
  }

  /**
   * 创建 FAQ（根据开关状态自动翻译）
   */
  async createFaqItem(dto: CreateFaqDto) {
    this.logger.log(`创建 FAQ: ${dto.question.slice(0, 20)}...`);

    // 根据开关状态决定是否翻译
    const [questionI18n, answerI18n] = await Promise.all([
      this.translateIfEnabled(dto.question),
      this.translateIfEnabled(dto.answer),
    ]);

    // 获取当前最大排序号
    const maxOrder = await this.prisma.faqItem.aggregate({
      _max: { sortOrder: true },
      where: { category: dto.category || 'general' },
    });

    const item = await this.prisma.faqItem.create({
      data: {
        questionI18n,
        answerI18n,
        questionZh: dto.question,
        answerZh: dto.answer,
        questionEn: (questionI18n as any)?.['en'] || '',
        answerEn: (answerI18n as any)?.['en'] || '',
        category: dto.category || 'general',
        sortOrder: dto.sortOrder ?? (maxOrder._max.sortOrder || 0) + 1,
        isActive: true,
      },
    });

    this.logger.log(`FAQ 创建成功: ${item.id}`);
    return item;
  }

  /**
   * 更新 FAQ（内容变更时自动重新翻译）
   */
  async updateFaqItem(id: string, dto: UpdateFaqDto) {
    const existing = await this.prisma.faqItem.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('FAQ 不存在');
    }

    const updateData: any = {};

    // 映射字段
    if (dto.category !== undefined) updateData.category = dto.category;
    if (dto.sortOrder !== undefined) updateData.sortOrder = dto.sortOrder;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

    // 如果问题有变化，翻译
    if (dto.question && dto.question !== existing.questionZh) {
      const questionI18n = await this.translateIfEnabled(dto.question);
      updateData.questionI18n = questionI18n;
      updateData.questionZh = dto.question;
      updateData.questionEn = (questionI18n as any)?.['en'] || '';
    }

    // 如果回答有变化，翻译
    if (dto.answer && dto.answer !== existing.answerZh) {
      const answerI18n = await this.translateIfEnabled(dto.answer);
      updateData.answerI18n = answerI18n;
      updateData.answerZh = dto.answer;
      updateData.answerEn = (answerI18n as any)?.['en'] || '';
    }

    return this.prisma.faqItem.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * 删除 FAQ
   */
  async deleteFaqItem(id: string) {
    return this.prisma.faqItem.delete({ where: { id } });
  }

  /**
   * 批量更新 FAQ 排序
   */
  async updateFaqOrder(items: { id: string; sortOrder: number }[]) {
    await Promise.all(
      items.map((item) =>
        this.prisma.faqItem.update({
          where: { id: item.id },
          data: { sortOrder: item.sortOrder },
        }),
      ),
    );
    return { success: true };
  }

  /**
   * 重新翻译 FAQ
   */
  async retranslateFaqItem(id: string) {
    const item = await this.prisma.faqItem.findUnique({ where: { id } });
    if (!item) {
      throw new NotFoundException('FAQ 不存在');
    }

    const [questionI18n, answerI18n] = await Promise.all([
      this.translateService.translateToAll(item.questionZh),
      this.translateService.translateToAll(item.answerZh),
    ]);

    return this.prisma.faqItem.update({
      where: { id },
      data: {
        questionI18n,
        answerI18n,
        questionEn: (questionI18n as any)?.['en'] || '',
        answerEn: (answerI18n as any)?.['en'] || '',
      },
    });
  }

  // ==================== 法律文档管理 ====================

  /**
   * 获取法律文档列表
   */
  async getLegalDocuments(page = 1, limit = 20) {
    const [total, documents] = await Promise.all([
      this.prisma.legalDocument.count(),
      this.prisma.legalDocument.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      items: documents.map((doc) => ({
        ...doc,
        titleZh: (doc.titleI18n as any)?.['zh-CN'] || doc.titleZh,
        titleEn: (doc.titleI18n as any)?.['en'] || doc.titleEn,
        // 内容太长，列表不返回全部内容
        contentPreview: doc.contentZh?.slice(0, 200) || '',
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * 获取单个法律文档
   */
  async getLegalDocument(id: string) {
    const doc = await this.prisma.legalDocument.findUnique({ where: { id } });
    if (!doc) {
      throw new NotFoundException('法律文档不存在');
    }
    return {
      ...doc,
      titleZh: (doc.titleI18n as any)?.['zh-CN'] || doc.titleZh,
      titleEn: (doc.titleI18n as any)?.['en'] || doc.titleEn,
      contentZh: (doc.contentI18n as any)?.['zh-CN'] || doc.contentZh,
      contentEn: (doc.contentI18n as any)?.['en'] || doc.contentEn,
    };
  }

  /**
   * 通过 slug 获取法律文档
   */
  async getLegalDocumentBySlug(slug: string) {
    const doc = await this.prisma.legalDocument.findUnique({ where: { slug } });
    if (!doc) {
      throw new NotFoundException('法律文档不存在');
    }
    return {
      ...doc,
      titleZh: (doc.titleI18n as any)?.['zh-CN'] || doc.titleZh,
      titleEn: (doc.titleI18n as any)?.['en'] || doc.titleEn,
      contentZh: (doc.contentI18n as any)?.['zh-CN'] || doc.contentZh,
      contentEn: (doc.contentI18n as any)?.['en'] || doc.contentEn,
    };
  }

  /**
   * 创建法律文档（根据开关状态自动翻译）
   */
  async createLegalDocument(dto: CreateLegalDocDto, createdBy?: string) {
    this.logger.log(`创建法律文档: ${dto.slug} - ${dto.title}`);

    // 检查 slug 是否已存在
    const existing = await this.prisma.legalDocument.findUnique({
      where: { slug: dto.slug },
    });
    if (existing) {
      throw new Error('文档标识符已存在');
    }

    // 根据开关状态决定是否翻译
    const [titleI18n, contentI18n] = await Promise.all([
      this.translateIfEnabled(dto.title),
      this.translateIfEnabled(dto.content),
    ]);

    const doc = await this.prisma.legalDocument.create({
      data: {
        slug: dto.slug,
        titleI18n,
        contentI18n,
        titleZh: dto.title,
        contentZh: dto.content,
        titleEn: (titleI18n as any)?.['en'] || '',
        contentEn: (contentI18n as any)?.['en'] || '',
        version: dto.version || '1.0',
        effectiveAt: dto.effectiveAt || new Date(),
        isActive: true,
        createdBy,
      },
    });

    this.logger.log(`法律文档创建成功: ${doc.id}`);
    return doc;
  }

  /**
   * 更新法律文档（内容变更时自动重新翻译）
   */
  async updateLegalDocument(
    id: string,
    dto: UpdateLegalDocDto,
    updatedBy?: string,
  ) {
    const existing = await this.prisma.legalDocument.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('法律文档不存在');
    }

    const updateData: any = { updatedBy };

    // 映射字段
    if (dto.version !== undefined) updateData.version = dto.version;
    if (dto.effectiveAt !== undefined) updateData.effectiveAt = dto.effectiveAt;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

    // 如果标题有变化，翻译
    if (dto.title && dto.title !== existing.titleZh) {
      const titleI18n = await this.translateIfEnabled(dto.title);
      updateData.titleI18n = titleI18n;
      updateData.titleZh = dto.title;
      updateData.titleEn = (titleI18n as any)?.['en'] || '';
    }

    // 如果内容有变化，翻译
    if (dto.content && dto.content !== existing.contentZh) {
      const contentI18n = await this.translateIfEnabled(dto.content);
      updateData.contentI18n = contentI18n;
      updateData.contentZh = dto.content;
      updateData.contentEn = (contentI18n as any)?.['en'] || '';
    }

    return this.prisma.legalDocument.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * 删除法律文档
   */
  async deleteLegalDocument(id: string) {
    return this.prisma.legalDocument.delete({ where: { id } });
  }

  /**
   * 重新翻译法律文档
   */
  async retranslateLegalDocument(id: string) {
    const doc = await this.prisma.legalDocument.findUnique({ where: { id } });
    if (!doc) {
      throw new NotFoundException('法律文档不存在');
    }

    const [titleI18n, contentI18n] = await Promise.all([
      this.translateService.translateToAll(doc.titleZh),
      this.translateService.translateToAll(doc.contentZh),
    ]);

    return this.prisma.legalDocument.update({
      where: { id },
      data: {
        titleI18n,
        contentI18n,
        titleEn: (titleI18n as any)?.['en'] || '',
        contentEn: (contentI18n as any)?.['en'] || '',
      },
    });
  }
}
