import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AdminGuard } from '../../common/guards/admin.guard';
import { CmsService } from './cms.service';
import {
  CreateContentDto,
  UpdateContentDto,
  CreateBannerDto,
  UpdateBannerDto,
  CreateHelpDocDto,
  UpdateHelpDocDto,
} from './dto/cms.dto';

// ==================== 公开接口 ====================

@ApiTags('CMS - 公开')
@Controller('cms')
export class CmsController {
  constructor(private readonly cmsService: CmsService) {}

  @Get('contents')
  @ApiOperation({ summary: '获取公开内容' })
  @ApiQuery({ name: 'locale', required: false, description: '语言，默认 zh-CN' })
  async getPublicContents(@Query('locale') locale?: string) {
    return this.cmsService.getPublicContents(locale);
  }

  @Get('contents/:key')
  @ApiOperation({ summary: '根据 key 获取内容' })
  @ApiQuery({ name: 'locale', required: false })
  async getContentByKey(
    @Param('key') key: string,
    @Query('locale') locale?: string,
  ) {
    return this.cmsService.getContentByKey(key, locale);
  }

  @Get('banners')
  @ApiOperation({ summary: '获取活跃 Banner' })
  @ApiQuery({ name: 'position', required: false, description: 'Banner 位置' })
  async getActiveBanners(@Query('position') position?: string) {
    return this.cmsService.getActiveBanners(position);
  }

  @Get('help-docs')
  @ApiOperation({ summary: '获取帮助文档列表' })
  @ApiQuery({ name: 'category', required: false, description: '分类: faq, tutorial, guide' })
  async getHelpDocs(@Query('category') category?: string) {
    return this.cmsService.getPublishedHelpDocs(category);
  }

  @Get('help-docs/:slug')
  @ApiOperation({ summary: '获取帮助文档详情' })
  async getHelpDocBySlug(@Param('slug') slug: string) {
    return this.cmsService.getHelpDocBySlug(slug);
  }
}

// ==================== 管理后台接口 ====================

@ApiTags('CMS - 管理后台')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin/cms')
export class AdminCmsController {
  constructor(private readonly cmsService: CmsService) {}

  // ========== 内容管理 ==========

  @Get('contents')
  @ApiOperation({ summary: '获取所有内容' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'locale', required: false })
  async getAllContents(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('locale') locale?: string,
  ) {
    return this.cmsService.getAllContents(
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
      locale,
    );
  }

  @Post('contents')
  @ApiOperation({ summary: '创建内容' })
  async createContent(@Body() dto: CreateContentDto, @Request() req: any) {
    return this.cmsService.createContent(dto, req.user.sub);
  }

  @Put('contents/:id')
  @ApiOperation({ summary: '更新内容' })
  async updateContent(
    @Param('id') id: string,
    @Body() dto: UpdateContentDto,
    @Request() req: any,
  ) {
    return this.cmsService.updateContent(id, dto, req.user.sub);
  }

  @Delete('contents/:id')
  @ApiOperation({ summary: '删除内容' })
  async deleteContent(@Param('id') id: string) {
    return this.cmsService.deleteContent(id);
  }

  // ========== Banner 管理 ==========

  @Get('banners')
  @ApiOperation({ summary: '获取所有 Banner' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'position', required: false })
  async getAllBanners(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('position') position?: string,
  ) {
    return this.cmsService.getAllBanners(
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
      position,
    );
  }

  @Post('banners')
  @ApiOperation({ summary: '创建 Banner' })
  async createBanner(@Body() dto: CreateBannerDto, @Request() req: any) {
    return this.cmsService.createBanner(dto, req.user.sub);
  }

  @Put('banners/:id')
  @ApiOperation({ summary: '更新 Banner' })
  async updateBanner(
    @Param('id') id: string,
    @Body() dto: UpdateBannerDto,
    @Request() req: any,
  ) {
    return this.cmsService.updateBanner(id, dto, req.user.sub);
  }

  @Delete('banners/:id')
  @ApiOperation({ summary: '删除 Banner' })
  async deleteBanner(@Param('id') id: string) {
    return this.cmsService.deleteBanner(id);
  }

  // ========== 帮助文档管理 ==========

  @Get('help-docs')
  @ApiOperation({ summary: '获取所有帮助文档' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'category', required: false })
  async getAllHelpDocs(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('category') category?: string,
  ) {
    return this.cmsService.getAllHelpDocs(
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
      category,
    );
  }

  @Post('help-docs')
  @ApiOperation({ summary: '创建帮助文档' })
  async createHelpDoc(@Body() dto: CreateHelpDocDto, @Request() req: any) {
    return this.cmsService.createHelpDoc(dto, req.user.sub);
  }

  @Put('help-docs/:id')
  @ApiOperation({ summary: '更新帮助文档' })
  async updateHelpDoc(
    @Param('id') id: string,
    @Body() dto: UpdateHelpDocDto,
    @Request() req: any,
  ) {
    return this.cmsService.updateHelpDoc(id, dto, req.user.sub);
  }

  @Delete('help-docs/:id')
  @ApiOperation({ summary: '删除帮助文档' })
  async deleteHelpDoc(@Param('id') id: string) {
    return this.cmsService.deleteHelpDoc(id);
  }
}
