/**
 * 管理后台内容管理 API
 * 公告、跑马灯的增删改查
 */
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AdminGuard } from './guards/admin.guard';
import { Public } from '../auth/decorators/public.decorator';
import { AdminContentService } from './services/admin-content.service';
import type {
  CreateAnnouncementDto,
  UpdateAnnouncementDto,
  CreateMarqueeDto,
  UpdateMarqueeDto,
  CreateFaqDto,
  UpdateFaqDto,
  CreateLegalDocDto,
  UpdateLegalDocDto,
} from './services/admin-content.service';

@Controller('admin/content')
@Public() // 跳过全局 JwtAuthGuard
@UseGuards(AdminGuard)
export class AdminContentController {
  constructor(private contentService: AdminContentService) {}

  // ==================== 公告管理 ====================

  /**
   * 获取公告列表
   * GET /admin/content/announcements?page=1&limit=20&status=published&type=system
   */
  @Get('announcements')
  async getAnnouncements(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('type') type?: string,
  ) {
    const data = await this.contentService.getAnnouncements(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
      status,
      type,
    );
    return { code: 0, message: 'success', data };
  }

  /**
   * 创建公告（自动翻译）
   * POST /admin/content/announcements
   */
  @Post('announcements')
  async createAnnouncement(
    @Body() dto: CreateAnnouncementDto,
    @Req() req: any,
  ) {
    const adminId = req.admin?.id;
    const announcement = await this.contentService.createAnnouncement(
      dto,
      adminId,
    );
    return {
      code: 0,
      message: '公告已创建并自动翻译为多语言',
      data: { announcement },
    };
  }

  /**
   * 更新公告
   * PUT /admin/content/announcements/:id
   */
  @Put('announcements/:id')
  async updateAnnouncement(
    @Param('id') id: string,
    @Body() dto: UpdateAnnouncementDto,
  ) {
    const announcement = await this.contentService.updateAnnouncement(id, dto);
    return {
      code: 0,
      message: '公告已更新',
      data: { announcement },
    };
  }

  /**
   * 删除公告
   * DELETE /admin/content/announcements/:id
   */
  @Delete('announcements/:id')
  async deleteAnnouncement(@Param('id') id: string) {
    await this.contentService.deleteAnnouncement(id);
    return { code: 0, message: '公告已删除', data: null };
  }

  /**
   * 批量更新公告状态
   * POST /admin/content/announcements/batch-status
   */
  @Post('announcements/batch-status')
  async batchUpdateStatus(@Body() dto: { ids: string[]; status: string }) {
    await this.contentService.batchUpdateAnnouncementStatus(
      dto.ids,
      dto.status,
    );
    return {
      code: 0,
      message: `已更新 ${dto.ids.length} 条公告状态`,
      data: null,
    };
  }

  /**
   * 重新翻译公告
   * POST /admin/content/announcements/:id/retranslate
   */
  @Post('announcements/:id/retranslate')
  async retranslateAnnouncement(@Param('id') id: string) {
    const announcement = await this.contentService.retranslateAnnouncement(id);
    return {
      code: 0,
      message: '公告已重新翻译',
      data: { announcement },
    };
  }

  // ==================== 跑马灯管理 ====================

  /**
   * 获取跑马灯列表
   * GET /admin/content/marquees?page=1&limit=50
   */
  @Get('marquees')
  async getMarquees(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const data = await this.contentService.getMarquees(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 50,
    );
    return { code: 0, message: 'success', data };
  }

  /**
   * 获取跑马灯全局配置
   * GET /admin/content/marquees/config
   * 注意：必须在 /marquees/:id 之前定义
   */
  @Get('marquees/config')
  async getMarqueeConfig() {
    const data = await this.contentService.getMarqueeConfig();
    return { code: 0, message: 'success', data };
  }

  /**
   * 更新跑马灯全局配置
   * PUT /admin/content/marquees/config
   * 注意：必须在 /marquees/:id 之前定义
   */
  @Put('marquees/config')
  async updateMarqueeConfig(
    @Body()
    config: {
      scrollSpeed?: number;
      pauseOnHover?: boolean;
      displayDuration?: number;
    },
  ) {
    const updatedConfig = await this.contentService.updateMarqueeConfig(config);
    return {
      code: 0,
      message: '跑马灯配置已保存',
      data: { config: updatedConfig },
    };
  }

  /**
   * 更新跑马灯排序
   * PUT /admin/content/marquees/order
   * 注意：必须在 /marquees/:id 之前定义
   */
  @Put('marquees/order')
  async updateOrder(
    @Body()
    dto: {
      orders?: { id: string; order: number }[];
      items?: { id: string; sortOrder: number }[];
    },
  ) {
    // 支持两种格式：orders (前端) 和 items (旧格式)
    const items = dto.orders
      ? dto.orders.map((o) => ({ id: o.id, sortOrder: o.order }))
      : dto.items || [];
    await this.contentService.updateMarqueeOrder(items);
    return { code: 0, message: '排序已更新', data: null };
  }

  /**
   * 创建跑马灯（自动翻译）
   * POST /admin/content/marquees
   */
  @Post('marquees')
  async createMarquee(@Body() dto: CreateMarqueeDto) {
    const marquee = await this.contentService.createMarquee(dto);
    return {
      code: 0,
      message: '跑马灯已创建并自动翻译为多语言',
      data: { marquee },
    };
  }

  /**
   * 更新跑马灯
   * PUT /admin/content/marquees/:id
   */
  @Put('marquees/:id')
  async updateMarquee(@Param('id') id: string, @Body() dto: UpdateMarqueeDto) {
    const marquee = await this.contentService.updateMarquee(id, dto);
    return {
      code: 0,
      message: '跑马灯已更新',
      data: { marquee },
    };
  }

  /**
   * 删除跑马灯
   * DELETE /admin/content/marquees/:id
   */
  @Delete('marquees/:id')
  async deleteMarquee(@Param('id') id: string) {
    await this.contentService.deleteMarquee(id);
    return { code: 0, message: '跑马灯已删除', data: null };
  }

  /**
   * 切换跑马灯启用状态
   * POST /admin/content/marquees/:id/toggle
   */
  @Post('marquees/:id/toggle')
  async toggleMarquee(@Param('id') id: string) {
    const marquee = await this.contentService.toggleMarqueeStatus(id);
    return {
      code: 0,
      message: marquee.isActive ? '跑马灯已启用' : '跑马灯已禁用',
      data: { marquee },
    };
  }

  /**
   * 重新翻译跑马灯
   * POST /admin/content/marquees/:id/retranslate
   */
  @Post('marquees/:id/retranslate')
  async retranslateMarquee(@Param('id') id: string) {
    const marquee = await this.contentService.retranslateMarquee(id);
    return {
      code: 0,
      message: '跑马灯已重新翻译',
      data: { marquee },
    };
  }

  // ==================== 翻译服务状态 ====================

  /**
   * 预览翻译结果（不保存）
   * POST /admin/content/translate-preview
   * 用于在保存前预览翻译效果
   */
  @Post('translate-preview')
  async previewTranslation(@Body() dto: { title?: string; content?: string }) {
    const result = await this.contentService.previewTranslation(
      dto.title,
      dto.content,
    );
    return {
      code: 0,
      message: '翻译预览完成',
      data: result,
    };
  }

  /**
   * 获取翻译服务状态
   * GET /admin/content/translate-status
   */
  @Get('translate-status')
  async getTranslateStatus() {
    const data = await this.contentService.getTranslateStatus();
    const enabled = await this.contentService.getTranslateEnabled();
    return { code: 0, message: 'success', data: { ...data, enabled } };
  }

  /**
   * 获取翻译开关状态
   * GET /admin/content/translate-enabled
   */
  @Get('translate-enabled')
  async getTranslateEnabled() {
    const enabled = await this.contentService.getTranslateEnabled();
    return { code: 0, message: 'success', data: { enabled } };
  }

  /**
   * 设置翻译开关状态
   * PUT /admin/content/translate-enabled
   */
  @Put('translate-enabled')
  async setTranslateEnabled(@Body() dto: { enabled: boolean }) {
    const enabled = await this.contentService.setTranslateEnabled(dto.enabled);
    return {
      code: 0,
      message: enabled ? '翻译功能已开启' : '翻译功能已关闭',
      data: { enabled },
    };
  }

  // ==================== FAQ 管理 ====================

  /**
   * 获取 FAQ 列表
   * GET /admin/content/faq?page=1&limit=50&category=general
   */
  @Get('faq')
  async getFaqItems(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('category') category?: string,
  ) {
    const data = await this.contentService.getFaqItems(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 50,
      category,
    );
    return { code: 0, message: 'success', data };
  }

  /**
   * 获取单个 FAQ
   * GET /admin/content/faq/:id
   */
  @Get('faq/:id')
  async getFaqItem(@Param('id') id: string) {
    const item = await this.contentService.getFaqItem(id);
    return { code: 0, message: 'success', data: { item } };
  }

  /**
   * 创建 FAQ（自动翻译）
   * POST /admin/content/faq
   */
  @Post('faq')
  async createFaqItem(@Body() dto: CreateFaqDto) {
    const item = await this.contentService.createFaqItem(dto);
    return {
      code: 0,
      message: 'FAQ 已创建并自动翻译为多语言',
      data: { item },
    };
  }

  /**
   * 更新 FAQ
   * PUT /admin/content/faq/:id
   */
  @Put('faq/:id')
  async updateFaqItem(@Param('id') id: string, @Body() dto: UpdateFaqDto) {
    const item = await this.contentService.updateFaqItem(id, dto);
    return {
      code: 0,
      message: 'FAQ 已更新',
      data: { item },
    };
  }

  /**
   * 删除 FAQ
   * DELETE /admin/content/faq/:id
   */
  @Delete('faq/:id')
  async deleteFaqItem(@Param('id') id: string) {
    await this.contentService.deleteFaqItem(id);
    return { code: 0, message: 'FAQ 已删除', data: null };
  }

  /**
   * 更新 FAQ 排序
   * PUT /admin/content/faq/order
   */
  @Put('faq-order')
  async updateFaqOrder(
    @Body() dto: { items: { id: string; sortOrder: number }[] },
  ) {
    await this.contentService.updateFaqOrder(dto.items);
    return { code: 0, message: '排序已更新', data: null };
  }

  /**
   * 重新翻译 FAQ
   * POST /admin/content/faq/:id/retranslate
   */
  @Post('faq/:id/retranslate')
  async retranslateFaqItem(@Param('id') id: string) {
    const item = await this.contentService.retranslateFaqItem(id);
    return {
      code: 0,
      message: 'FAQ 已重新翻译',
      data: { item },
    };
  }

  // ==================== 法律文档管理 ====================

  /**
   * 获取法律文档列表
   * GET /admin/content/legal?page=1&limit=20
   */
  @Get('legal')
  async getLegalDocuments(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const data = await this.contentService.getLegalDocuments(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
    return { code: 0, message: 'success', data };
  }

  /**
   * 获取单个法律文档
   * GET /admin/content/legal/:id
   */
  @Get('legal/:id')
  async getLegalDocument(@Param('id') id: string) {
    const document = await this.contentService.getLegalDocument(id);
    return { code: 0, message: 'success', data: { document } };
  }

  /**
   * 创建法律文档（自动翻译）
   * POST /admin/content/legal
   */
  @Post('legal')
  async createLegalDocument(@Body() dto: CreateLegalDocDto, @Req() req: any) {
    const adminId = req.admin?.id;
    const document = await this.contentService.createLegalDocument(
      dto,
      adminId,
    );
    return {
      code: 0,
      message: '法律文档已创建并自动翻译为多语言',
      data: { document },
    };
  }

  /**
   * 更新法律文档
   * PUT /admin/content/legal/:id
   */
  @Put('legal/:id')
  async updateLegalDocument(
    @Param('id') id: string,
    @Body() dto: UpdateLegalDocDto,
    @Req() req: any,
  ) {
    const adminId = req.admin?.id;
    const document = await this.contentService.updateLegalDocument(
      id,
      dto,
      adminId,
    );
    return {
      code: 0,
      message: '法律文档已更新',
      data: { document },
    };
  }

  /**
   * 删除法律文档
   * DELETE /admin/content/legal/:id
   */
  @Delete('legal/:id')
  async deleteLegalDocument(@Param('id') id: string) {
    await this.contentService.deleteLegalDocument(id);
    return { code: 0, message: '法律文档已删除', data: null };
  }

  /**
   * 重新翻译法律文档
   * POST /admin/content/legal/:id/retranslate
   */
  @Post('legal/:id/retranslate')
  async retranslateLegalDocument(@Param('id') id: string) {
    const document = await this.contentService.retranslateLegalDocument(id);
    return {
      code: 0,
      message: '法律文档已重新翻译',
      data: { document },
    };
  }
}
