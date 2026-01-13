import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { AdminEnhancedService } from './admin-enhanced.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AdminGuard } from '../../common/guards/admin.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/dto/jwt-payload.dto';
import { CreateBlacklistDto, UpdateBlacklistDto, BlacklistQueryDto } from './dto/blacklist.dto';
import { SessionQueryDto } from './dto/session.dto';
import { CreatePopupDto, UpdatePopupDto, PopupQueryDto } from './dto/popup.dto';
import { UpdateBrandConfigDto, BrandConfigBatchDto } from './dto/brand.dto';
import { CreateBannerDto, UpdateBannerDto, CreateHelpDocDto, UpdateHelpDocDto, CreateContentDto, UpdateContentDto } from './dto/cms-enhanced.dto';
import { CreateRoleDto, UpdateRoleDto, AssignRoleDto, RemoveRoleDto } from './dto/rbac.dto';

/**
 * 管理员增强功能控制器
 * 路由前缀: /api/admin
 */
@ApiTags('Admin Enhanced')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminEnhancedController {
  private readonly logger = new Logger(AdminEnhancedController.name);

  constructor(private readonly enhancedService: AdminEnhancedService) {}

  // ==================== 黑名单管理 ====================

  @Get('blacklist')
  @ApiOperation({ summary: '获取黑名单列表' })
  async getBlacklist(@Query() query: BlacklistQueryDto) {
    const data = await this.enhancedService.getBlacklist(query);
    return { code: 0, message: 'success', data };
  }

  @Post('blacklist')
  @ApiOperation({ summary: '添加黑名单' })
  async addToBlacklist(
    @CurrentUser() admin: JwtPayload,
    @Body() dto: CreateBlacklistDto,
  ) {
    this.logger.log(`管理员 ${admin.sub} 添加黑名单: ${dto.type}/${dto.value}`);
    const data = await this.enhancedService.addToBlacklist(dto, admin.sub);
    return { code: 0, message: '已添加到黑名单', data };
  }

  @Patch('blacklist/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '更新黑名单' })
  async updateBlacklist(
    @CurrentUser() admin: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateBlacklistDto,
  ) {
    const data = await this.enhancedService.updateBlacklist(id, dto, admin.sub);
    return { code: 0, message: '黑名单已更新', data };
  }

  @Delete('blacklist/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '移除黑名单' })
  async removeFromBlacklist(
    @CurrentUser() admin: JwtPayload,
    @Param('id') id: string,
  ) {
    this.logger.log(`管理员 ${admin.sub} 移除黑名单 ${id}`);
    const data = await this.enhancedService.removeFromBlacklist(id, admin.sub);
    return { code: 0, message: '已从黑名单移除', data };
  }

  // ==================== 会话管理 ====================

  @Get('sessions')
  @ApiOperation({ summary: '获取会话列表' })
  async getSessions(@Query() query: SessionQueryDto) {
    const data = await this.enhancedService.getAllSessions(query);
    return { code: 0, message: 'success', data };
  }

  @Get('users/:id/sessions')
  @ApiOperation({ summary: '获取用户会话列表' })
  async getUserSessions(@Param('id') userId: string) {
    const data = await this.enhancedService.getUserSessions(userId);
    return { code: 0, message: 'success', data };
  }

  @Post('sessions/:id/revoke')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '撤销单个会话' })
  async revokeSession(
    @CurrentUser() admin: JwtPayload,
    @Param('id') sessionId: string,
  ) {
    this.logger.log(`管理员 ${admin.sub} 撤销会话 ${sessionId}`);
    const data = await this.enhancedService.revokeSession(sessionId, admin.sub);
    return { code: 0, message: '会话已撤销', data };
  }

  @Post('users/:id/sessions/revoke-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '撤销用户所有会话' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        excludeSessionId: { type: 'string', description: '排除的会话ID' },
      },
    },
  })
  async revokeAllUserSessions(
    @CurrentUser() admin: JwtPayload,
    @Param('id') userId: string,
    @Body('excludeSessionId') excludeSessionId?: string,
  ) {
    this.logger.log(`管理员 ${admin.sub} 撤销用户 ${userId} 的所有会话`);
    const data = await this.enhancedService.revokeAllUserSessions(userId, admin.sub, excludeSessionId);
    return { code: 0, message: '已撤销所有会话', data };
  }

  // ==================== 2FA 重置 ====================

  @Post('users/:id/reset-2fa')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '重置用户 2FA' })
  async reset2FA(
    @CurrentUser() admin: JwtPayload,
    @Param('id') userId: string,
  ) {
    this.logger.log(`管理员 ${admin.sub} 重置用户 ${userId} 的 2FA`);
    const data = await this.enhancedService.reset2FA(userId, admin.sub);
    return { code: 0, message: '2FA 已重置', data };
  }

  // ==================== API Key 监管 ====================

  @Get('users/:id/api-keys')
  @ApiOperation({ summary: '获取用户 API Key 列表' })
  async getUserApiKeys(@Param('id') userId: string) {
    const data = await this.enhancedService.getUserApiKeys(userId);
    return { code: 0, message: 'success', data };
  }

  @Post('api-keys/:id/revoke')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '撤销 API Key' })
  async revokeApiKey(
    @CurrentUser() admin: JwtPayload,
    @Param('id') apiKeyId: string,
  ) {
    this.logger.log(`管理员 ${admin.sub} 撤销 API Key ${apiKeyId}`);
    const data = await this.enhancedService.revokeApiKey(apiKeyId, admin.sub);
    return { code: 0, message: 'API Key 已撤销', data };
  }

  // ==================== 弹窗公告 ====================

  @Get('popups')
  @ApiOperation({ summary: '获取弹窗公告列表' })
  async getPopups(@Query() query: PopupQueryDto) {
    const data = await this.enhancedService.getPopups(query);
    return { code: 0, message: 'success', data };
  }

  @Post('popups')
  @ApiOperation({ summary: '创建弹窗公告' })
  async createPopup(
    @CurrentUser() admin: JwtPayload,
    @Body() dto: CreatePopupDto,
  ) {
    this.logger.log(`管理员 ${admin.sub} 创建弹窗公告: ${dto.title}`);
    const data = await this.enhancedService.createPopup(dto, admin.sub);
    return { code: 0, message: '弹窗公告已创建', data };
  }

  @Patch('popups/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '更新弹窗公告' })
  async updatePopup(
    @CurrentUser() admin: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdatePopupDto,
  ) {
    const data = await this.enhancedService.updatePopup(id, dto, admin.sub);
    return { code: 0, message: '弹窗公告已更新', data };
  }

  @Delete('popups/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '删除弹窗公告' })
  async deletePopup(
    @CurrentUser() admin: JwtPayload,
    @Param('id') id: string,
  ) {
    this.logger.log(`管理员 ${admin.sub} 删除弹窗公告 ${id}`);
    await this.enhancedService.deletePopup(id, admin.sub);
    return { code: 0, message: '弹窗公告已删除', data: null };
  }

  // ==================== 品牌配置 ====================

  @Get('brand-configs')
  @ApiOperation({ summary: '获取品牌配置' })
  async getBrandConfigs() {
    const data = await this.enhancedService.getBrandConfigs();
    return { code: 0, message: 'success', data };
  }

  @Post('brand-configs')
  @ApiOperation({ summary: '更新品牌配置' })
  async updateBrandConfig(
    @CurrentUser() admin: JwtPayload,
    @Body() dto: UpdateBrandConfigDto,
  ) {
    this.logger.log(`管理员 ${admin.sub} 更新品牌配置: ${dto.configKey}`);
    const data = await this.enhancedService.updateBrandConfig(dto, admin.sub);
    return { code: 0, message: '品牌配置已更新', data };
  }

  @Post('brand-configs/batch')
  @ApiOperation({ summary: '批量更新品牌配置' })
  async updateBrandConfigsBatch(
    @CurrentUser() admin: JwtPayload,
    @Body() dto: BrandConfigBatchDto,
  ) {
    this.logger.log(`管理员 ${admin.sub} 批量更新品牌配置`);
    const data = await this.enhancedService.updateBrandConfigsBatch(dto.configs, admin.sub);
    return { code: 0, message: '品牌配置已批量更新', data };
  }

  // ==================== CMS 增强：Banner 管理 ====================

  @Get('cms/banners')
  @ApiOperation({ summary: '获取 Banner 列表' })
  @ApiQuery({ name: 'position', required: false, type: String })
  @ApiQuery({ name: 'activeOnly', required: false, type: Boolean })
  async getBanners(
    @Query('position') position?: string,
    @Query('activeOnly') activeOnly?: boolean,
  ) {
    const data = await this.enhancedService.getBanners(position, activeOnly);
    return { code: 0, message: 'success', data };
  }

  @Post('cms/banners')
  @ApiOperation({ summary: '创建 Banner' })
  async createBanner(
    @CurrentUser() admin: JwtPayload,
    @Body() dto: CreateBannerDto,
  ) {
    this.logger.log(`管理员 ${admin.sub} 创建 Banner: ${dto.title}`);
    const data = await this.enhancedService.createBanner(dto, admin.sub);
    return { code: 0, message: 'Banner 已创建', data };
  }

  @Patch('cms/banners/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '更新 Banner' })
  async updateBanner(
    @CurrentUser() admin: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateBannerDto,
  ) {
    const data = await this.enhancedService.updateBanner(id, dto, admin.sub);
    return { code: 0, message: 'Banner 已更新', data };
  }

  @Delete('cms/banners/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '删除 Banner' })
  async deleteBanner(
    @CurrentUser() admin: JwtPayload,
    @Param('id') id: string,
  ) {
    this.logger.log(`管理员 ${admin.sub} 删除 Banner ${id}`);
    await this.enhancedService.deleteBanner(id, admin.sub);
    return { code: 0, message: 'Banner 已删除', data: null };
  }

  // ==================== CMS 增强：帮助文档 ====================

  @Get('cms/help-docs')
  @ApiOperation({ summary: '获取帮助文档列表' })
  @ApiQuery({ name: 'category', required: false, enum: ['faq', 'tutorial', 'guide'] })
  @ApiQuery({ name: 'publishedOnly', required: false, type: Boolean })
  async getHelpDocs(
    @Query('category') category?: string,
    @Query('publishedOnly') publishedOnly?: boolean,
  ) {
    const data = await this.enhancedService.getHelpDocs(category, publishedOnly);
    return { code: 0, message: 'success', data };
  }

  @Post('cms/help-docs')
  @ApiOperation({ summary: '创建帮助文档' })
  async createHelpDoc(
    @CurrentUser() admin: JwtPayload,
    @Body() dto: CreateHelpDocDto,
  ) {
    this.logger.log(`管理员 ${admin.sub} 创建帮助文档: ${dto.title}`);
    const data = await this.enhancedService.createHelpDoc(dto, admin.sub);
    return { code: 0, message: '帮助文档已创建', data };
  }

  @Patch('cms/help-docs/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '更新帮助文档' })
  async updateHelpDoc(
    @CurrentUser() admin: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateHelpDocDto,
  ) {
    const data = await this.enhancedService.updateHelpDoc(id, dto, admin.sub);
    return { code: 0, message: '帮助文档已更新', data };
  }

  @Delete('cms/help-docs/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '删除帮助文档' })
  async deleteHelpDoc(
    @CurrentUser() admin: JwtPayload,
    @Param('id') id: string,
  ) {
    this.logger.log(`管理员 ${admin.sub} 删除帮助文档 ${id}`);
    await this.enhancedService.deleteHelpDoc(id, admin.sub);
    return { code: 0, message: '帮助文档已删除', data: null };
  }

  // ==================== CMS 增强：内容管理 ====================

  @Get('cms/contents')
  @ApiOperation({ summary: '获取内容列表' })
  @ApiQuery({ name: 'contentType', required: false, type: String })
  async getContents(@Query('contentType') contentType?: string) {
    const data = await this.enhancedService.getContents(contentType);
    return { code: 0, message: 'success', data };
  }

  @Post('cms/contents')
  @ApiOperation({ summary: '创建内容' })
  async createContent(
    @CurrentUser() admin: JwtPayload,
    @Body() dto: CreateContentDto,
  ) {
    this.logger.log(`管理员 ${admin.sub} 创建内容: ${dto.contentKey}`);
    const data = await this.enhancedService.createContent(dto, admin.sub);
    return { code: 0, message: '内容已创建', data };
  }

  @Patch('cms/contents/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '更新内容' })
  async updateContent(
    @CurrentUser() admin: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateContentDto,
  ) {
    const data = await this.enhancedService.updateContent(id, dto, admin.sub);
    return { code: 0, message: '内容已更新', data };
  }

  @Delete('cms/contents/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '删除内容' })
  async deleteContent(
    @CurrentUser() admin: JwtPayload,
    @Param('id') id: string,
  ) {
    this.logger.log(`管理员 ${admin.sub} 删除内容 ${id}`);
    await this.enhancedService.deleteContent(id, admin.sub);
    return { code: 0, message: '内容已删除', data: null };
  }

  // ==================== VPS 性能监控 ====================

  @Get('instances/:id/metrics')
  @ApiOperation({ summary: '获取 VPS 性能指标' })
  @ApiQuery({ name: 'hours', required: false, type: Number, description: '查询最近多少小时的数据' })
  async getInstanceMetrics(
    @Param('id') instanceId: string,
    @Query('hours') hours?: number,
  ) {
    const data = await this.enhancedService.getInstanceMetrics(instanceId, hours || 24);
    return { code: 0, message: 'success', data };
  }

  @Get('instances/:id/metrics/summary')
  @ApiOperation({ summary: '获取 VPS 性能摘要' })
  async getInstanceMetricsSummary(@Param('id') instanceId: string) {
    const data = await this.enhancedService.getInstanceMetricsSummary(instanceId);
    return { code: 0, message: 'success', data };
  }

  // ==================== 登录异常检测 ====================

  @Get('login-alerts')
  @ApiOperation({ summary: '获取登录异常告警' })
  @ApiQuery({ name: 'userId', required: false, type: String })
  @ApiQuery({ name: 'resolved', required: false, type: Boolean })
  @ApiQuery({ name: 'severity', required: false, enum: ['low', 'medium', 'high', 'critical'] })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getLoginAlerts(
    @Query('userId') userId?: string,
    @Query('resolved') resolved?: boolean,
    @Query('severity') severity?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const data = await this.enhancedService.getLoginAlerts({
      userId,
      resolved,
      severity,
      page,
      limit,
    });
    return { code: 0, message: 'success', data };
  }

  @Post('login-alerts/:id/resolve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '处理登录告警' })
  async resolveLoginAlert(
    @CurrentUser() admin: JwtPayload,
    @Param('id') alertId: string,
  ) {
    this.logger.log(`管理员 ${admin.sub} 处理登录告警 ${alertId}`);
    const data = await this.enhancedService.resolveLoginAlert(alertId, admin.sub);
    return { code: 0, message: '告警已处理', data };
  }

  // ==================== RBAC 权限管理 ====================

  @Get('rbac/permissions')
  @ApiOperation({ summary: '获取所有权限列表' })
  async getPermissions() {
    const data = this.enhancedService.getPermissionsList();
    return { code: 0, message: 'success', data };
  }

  @Get('rbac/roles')
  @ApiOperation({ summary: '获取角色列表' })
  async getRoles() {
    const data = await this.enhancedService.getRoles();
    return { code: 0, message: 'success', data };
  }

  @Post('rbac/roles')
  @ApiOperation({ summary: '创建角色' })
  async createRole(
    @CurrentUser() admin: JwtPayload,
    @Body() dto: CreateRoleDto,
  ) {
    this.logger.log(`管理员 ${admin.sub} 创建角色: ${dto.name}`);
    const data = await this.enhancedService.createRole(dto, admin.sub);
    return { code: 0, message: '角色已创建', data };
  }

  @Patch('rbac/roles/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '更新角色' })
  async updateRole(
    @CurrentUser() admin: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
  ) {
    const data = await this.enhancedService.updateRole(id, dto, admin.sub);
    return { code: 0, message: '角色已更新', data };
  }

  @Delete('rbac/roles/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '删除角色' })
  async deleteRole(
    @CurrentUser() admin: JwtPayload,
    @Param('id') id: string,
  ) {
    this.logger.log(`管理员 ${admin.sub} 删除角色 ${id}`);
    await this.enhancedService.deleteRole(id, admin.sub);
    return { code: 0, message: '角色已删除', data: null };
  }

  @Post('rbac/assign')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '分配角色给用户' })
  async assignRole(
    @CurrentUser() admin: JwtPayload,
    @Body() dto: AssignRoleDto,
  ) {
    this.logger.log(`管理员 ${admin.sub} 分配角色 ${dto.roleId} 给用户 ${dto.userId}`);
    const data = await this.enhancedService.assignRole(dto.userId, dto.roleId, admin.sub);
    return { code: 0, message: '角色已分配', data };
  }

  @Post('rbac/remove')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '移除用户角色' })
  async removeRole(
    @CurrentUser() admin: JwtPayload,
    @Body() dto: RemoveRoleDto,
  ) {
    this.logger.log(`管理员 ${admin.sub} 移除用户 ${dto.userId} 的角色 ${dto.roleId}`);
    await this.enhancedService.removeRole(dto.userId, dto.roleId, admin.sub);
    return { code: 0, message: '角色已移除', data: null };
  }

  @Get('users/:id/roles')
  @ApiOperation({ summary: '获取用户角色' })
  async getUserRoles(@Param('id') userId: string) {
    const data = await this.enhancedService.getUserRoles(userId);
    return { code: 0, message: 'success', data };
  }

  @Get('users/:id/permissions')
  @ApiOperation({ summary: '获取用户权限' })
  async getUserPermissions(@Param('id') userId: string) {
    const data = await this.enhancedService.getUserPermissions(userId);
    return { code: 0, message: 'success', data };
  }

  @Post('rbac/init-presets')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '初始化预设角色' })
  async initPresetRoles(@CurrentUser() admin: JwtPayload) {
    this.logger.log(`管理员 ${admin.sub} 初始化预设角色`);
    await this.enhancedService.initPresetRoles();
    return { code: 0, message: '预设角色已初始化', data: null };
  }
}
