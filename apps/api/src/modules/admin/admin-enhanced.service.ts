// @ts-nocheck
// TODO: 数据库 schema 需要同步，临时禁用类型检查
import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateBlacklistDto, UpdateBlacklistDto, BlacklistQueryDto } from './dto/blacklist.dto';
import { SessionQueryDto } from './dto/session.dto';
import { CreatePopupDto, UpdatePopupDto, PopupQueryDto } from './dto/popup.dto';
import { UpdateBrandConfigDto, BRAND_CONFIG_KEYS } from './dto/brand.dto';
import { CreateBannerDto, UpdateBannerDto, CreateHelpDocDto, UpdateHelpDocDto, CreateContentDto, UpdateContentDto } from './dto/cms-enhanced.dto';
import { CreateRoleDto, UpdateRoleDto, PERMISSIONS, PRESET_ROLES } from './dto/rbac.dto';

@Injectable()
export class AdminEnhancedService {
  private readonly logger = new Logger(AdminEnhancedService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ==================== 黑名单管理 ====================

  async getBlacklist(query: BlacklistQueryDto) {
    const { type, search, page = 1, limit = 20 } = query;

    const where: any = { is_active: true };
    if (type) where.type = type;
    if (search) where.value = { contains: search, mode: 'insensitive' };

    const [items, total] = await Promise.all([
      this.prisma.client.blacklist.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.client.blacklist.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async addToBlacklist(dto: CreateBlacklistDto, adminId: string) {
    // 检查是否已存在
    const existing = await this.prisma.client.blacklist.findFirst({
      where: { type: dto.type, value: dto.value },
    });

    if (existing) {
      if (existing.is_active) {
        throw new BadRequestException('该记录已在黑名单中');
      }
      // 重新激活
      return this.prisma.client.blacklist.update({
        where: { id: existing.id },
        data: {
          is_active: true,
          reason: dto.reason,
          expires_at: dto.expiresAt ? new Date(dto.expiresAt) : null,
          updated_at: new Date(),
        },
      });
    }

    return this.prisma.client.blacklist.create({
      data: {
        type: dto.type,
        value: dto.value,
        reason: dto.reason,
        expires_at: dto.expiresAt ? new Date(dto.expiresAt) : null,
        created_by: adminId,
      },
    });
  }

  async updateBlacklist(id: string, dto: UpdateBlacklistDto, adminId: string) {
    const record = await this.prisma.client.blacklist.findUnique({ where: { id } });
    if (!record) throw new NotFoundException('黑名单记录不存在');

    return this.prisma.client.blacklist.update({
      where: { id },
      data: {
        reason: dto.reason,
        expires_at: dto.expiresAt ? new Date(dto.expiresAt) : null,
        is_active: dto.isActive,
        updated_at: new Date(),
      },
    });
  }

  async removeFromBlacklist(id: string, adminId: string) {
    const record = await this.prisma.client.blacklist.findUnique({ where: { id } });
    if (!record) throw new NotFoundException('黑名单记录不存在');

    return this.prisma.client.blacklist.update({
      where: { id },
      data: { is_active: false, updated_at: new Date() },
    });
  }

  async checkBlacklist(type: string, value: string): Promise<boolean> {
    const record = await this.prisma.client.blacklist.findFirst({
      where: {
        type,
        value,
        is_active: true,
        OR: [
          { expires_at: null },
          { expires_at: { gt: new Date() } },
        ],
      },
    });
    return !!record;
  }

  // ==================== 会话管理 ====================

  async getUserSessions(userId: string) {
    return this.prisma.client.user_sessions.findMany({
      where: { user_id: userId, is_active: true },
      orderBy: { last_active_at: 'desc' },
    });
  }

  async getAllSessions(query: SessionQueryDto) {
    const { userId, activeOnly = true, page = 1, limit = 20 } = query;

    const where: any = {};
    if (userId) where.user_id = userId;
    if (activeOnly) {
      where.is_active = true;
      where.expires_at = { gt: new Date() };
    }

    const [items, total] = await Promise.all([
      this.prisma.client.user_sessions.findMany({
        where,
        orderBy: { last_active_at: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.client.user_sessions.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async revokeSession(sessionId: string, adminId: string) {
    const session = await this.prisma.client.user_sessions.findUnique({ where: { id: sessionId } });
    if (!session) throw new NotFoundException('会话不存在');

    return this.prisma.client.user_sessions.update({
      where: { id: sessionId },
      data: { is_active: false },
    });
  }

  async revokeAllUserSessions(userId: string, adminId: string, excludeSessionId?: string) {
    const where: any = { user_id: userId, is_active: true };
    if (excludeSessionId) {
      where.id = { not: excludeSessionId };
    }

    const result = await this.prisma.client.user_sessions.updateMany({
      where,
      data: { is_active: false },
    });

    this.logger.log(`管理员 ${adminId} 撤销用户 ${userId} 的 ${result.count} 个会话`);

    return { revokedCount: result.count };
  }

  // ==================== 2FA 重置 ====================

  async reset2FA(userId: string, adminId: string) {
    const user = await this.prisma.client.users.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('用户不存在');

    if (!user.two_factor_enabled) {
      throw new BadRequestException('用户未启用 2FA');
    }

    await this.prisma.client.users.update({
      where: { id: userId },
      data: {
        two_factor_enabled: false,
        two_factor_secret: null,
        updated_at: new Date(),
      },
    });

    // 记录审计日志
    await this.prisma.client.admin_audit_logs.create({
      data: {
        admin_id: adminId,
        action: 'reset_2fa',
        target_type: 'user',
        target_id: userId,
        details: { userId },
      },
    });

    this.logger.log(`管理员 ${adminId} 重置用户 ${userId} 的 2FA`);

    return { success: true, message: '2FA 已重置' };
  }

  // ==================== API Key 监管 ====================

  async getUserApiKeys(userId: string) {
    return this.prisma.client.api_keys.findMany({
      where: { user_id: userId },
      select: {
        id: true,
        exchange: true,
        label: true,
        permissions: true,
        is_active: true,
        last_verified_at: true,
        created_at: true,
        updated_at: true,
        // 不返回敏感字段: encrypted_blob, iv, auth_tag
      },
      orderBy: { created_at: 'desc' },
    });
  }

  async revokeApiKey(apiKeyId: string, adminId: string) {
    const apiKey = await this.prisma.client.api_keys.findUnique({ where: { id: apiKeyId } });
    if (!apiKey) throw new NotFoundException('API Key 不存在');

    await this.prisma.client.api_keys.update({
      where: { id: apiKeyId },
      data: { is_active: false, updated_at: new Date() },
    });

    // 记录审计日志
    await this.prisma.client.admin_audit_logs.create({
      data: {
        admin_id: adminId,
        action: 'revoke_api_key',
        target_type: 'api_key',
        target_id: apiKeyId,
        details: { userId: apiKey.user_id, exchange: apiKey.exchange },
      },
    });

    this.logger.log(`管理员 ${adminId} 撤销 API Key ${apiKeyId}`);

    return { success: true, message: 'API Key 已撤销' };
  }

  // ==================== 弹窗公告 ====================

  async getPopups(query: PopupQueryDto) {
    const { activeOnly, page = 1, limit = 20 } = query;

    const where: any = {};
    if (activeOnly) {
      where.is_active = true;
      where.OR = [
        { start_at: null },
        { start_at: { lte: new Date() } },
      ];
      where.AND = [
        {
          OR: [
            { end_at: null },
            { end_at: { gt: new Date() } },
          ],
        },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.client.popup_announcements.findMany({
        where,
        orderBy: [{ priority: 'desc' }, { created_at: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.client.popup_announcements.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async createPopup(dto: CreatePopupDto, adminId: string) {
    return this.prisma.client.popup_announcements.create({
      data: {
        title: dto.title,
        content: dto.content,
        type: dto.type || 'info',
        image_url: dto.imageUrl,
        action_label: dto.actionLabel,
        action_url: dto.actionUrl,
        target_audience: dto.targetAudience || 'all',
        priority: dto.priority || 0,
        start_at: dto.startAt ? new Date(dto.startAt) : null,
        end_at: dto.endAt ? new Date(dto.endAt) : null,
        show_once: dto.showOnce ?? false,
        created_by: adminId,
      },
    });
  }

  async updatePopup(id: string, dto: UpdatePopupDto, adminId: string) {
    const popup = await this.prisma.client.popup_announcements.findUnique({ where: { id } });
    if (!popup) throw new NotFoundException('弹窗公告不存在');

    return this.prisma.client.popup_announcements.update({
      where: { id },
      data: {
        title: dto.title,
        content: dto.content,
        type: dto.type,
        image_url: dto.imageUrl,
        action_label: dto.actionLabel,
        action_url: dto.actionUrl,
        target_audience: dto.targetAudience,
        priority: dto.priority,
        is_active: dto.isActive,
        show_once: dto.showOnce,
        start_at: dto.startAt ? new Date(dto.startAt) : undefined,
        end_at: dto.endAt ? new Date(dto.endAt) : undefined,
        updated_at: new Date(),
      },
    });
  }

  async deletePopup(id: string, adminId: string) {
    const popup = await this.prisma.client.popup_announcements.findUnique({ where: { id } });
    if (!popup) throw new NotFoundException('弹窗公告不存在');

    await this.prisma.client.popup_announcements.delete({ where: { id } });
    return { success: true };
  }

  // ==================== 品牌配置 ====================

  async getBrandConfigs() {
    return this.prisma.client.brand_configs.findMany({
      orderBy: { config_key: 'asc' },
    });
  }

  async updateBrandConfig(dto: UpdateBrandConfigDto, adminId: string) {
    const existing = await this.prisma.client.brand_configs.findUnique({
      where: { config_key: dto.configKey },
    });

    if (existing) {
      return this.prisma.client.brand_configs.update({
        where: { id: existing.id },
        data: {
          config_value: dto.configValue,
          description: dto.description,
          updated_by: adminId,
          updated_at: new Date(),
        },
      });
    }

    return this.prisma.client.brand_configs.create({
      data: {
        config_key: dto.configKey,
        config_value: dto.configValue,
        description: dto.description,
        updated_by: adminId,
      },
    });
  }

  async updateBrandConfigsBatch(configs: UpdateBrandConfigDto[], adminId: string) {
    const results = [];
    for (const config of configs) {
      const result = await this.updateBrandConfig(config, adminId);
      results.push(result);
    }
    return results;
  }

  // ==================== CMS 增强：Banner 管理 ====================

  async getBanners(position?: string, activeOnly: boolean = false) {
    const where: any = {};
    if (position) where.position = position;
    if (activeOnly) {
      where.is_active = true;
      where.OR = [
        { start_at: null },
        { start_at: { lte: new Date() } },
      ];
      where.AND = [
        {
          OR: [
            { end_at: null },
            { end_at: { gt: new Date() } },
          ],
        },
      ];
    }

    return this.prisma.client.cms_banners.findMany({
      where,
      orderBy: [{ sort_order: 'asc' }, { created_at: 'desc' }],
    });
  }

  async createBanner(dto: CreateBannerDto, adminId: string) {
    return this.prisma.client.cms_banners.create({
      data: {
        position: dto.position,
        title: dto.title,
        subtitle: dto.subtitle,
        image_url: dto.imageUrl,
        link_url: dto.linkUrl,
        link_target: dto.linkTarget || '_self',
        button_text: dto.buttonText,
        sort_order: dto.sortOrder || 0,
        start_at: dto.startAt ? new Date(dto.startAt) : null,
        end_at: dto.endAt ? new Date(dto.endAt) : null,
        updated_by: adminId,
      },
    });
  }

  async updateBanner(id: string, dto: UpdateBannerDto, adminId: string) {
    const banner = await this.prisma.client.cms_banners.findUnique({ where: { id } });
    if (!banner) throw new NotFoundException('Banner 不存在');

    return this.prisma.client.cms_banners.update({
      where: { id },
      data: {
        position: dto.position,
        title: dto.title,
        subtitle: dto.subtitle,
        image_url: dto.imageUrl,
        link_url: dto.linkUrl,
        link_target: dto.linkTarget,
        button_text: dto.buttonText,
        is_active: dto.isActive,
        sort_order: dto.sortOrder,
        start_at: dto.startAt ? new Date(dto.startAt) : undefined,
        end_at: dto.endAt ? new Date(dto.endAt) : undefined,
        updated_by: adminId,
        updated_at: new Date(),
      },
    });
  }

  async deleteBanner(id: string, adminId: string) {
    const banner = await this.prisma.client.cms_banners.findUnique({ where: { id } });
    if (!banner) throw new NotFoundException('Banner 不存在');

    await this.prisma.client.cms_banners.delete({ where: { id } });
    return { success: true };
  }

  // ==================== CMS 增强：帮助文档 ====================

  async getHelpDocs(category?: string, publishedOnly: boolean = false) {
    const where: any = {};
    if (category) where.category = category;
    if (publishedOnly) where.is_published = true;

    return this.prisma.client.cms_help_docs.findMany({
      where,
      orderBy: [{ sort_order: 'asc' }, { created_at: 'desc' }],
    });
  }

  async getHelpDocBySlug(slug: string) {
    const doc = await this.prisma.client.cms_help_docs.findUnique({ where: { slug } });
    if (!doc) throw new NotFoundException('文档不存在');

    // 增加浏览次数
    await this.prisma.client.cms_help_docs.update({
      where: { id: doc.id },
      data: { view_count: { increment: 1 } },
    });

    return doc;
  }

  async createHelpDoc(dto: CreateHelpDocDto, adminId: string) {
    // 检查 slug 唯一性
    const existing = await this.prisma.client.cms_help_docs.findUnique({ where: { slug: dto.slug } });
    if (existing) throw new BadRequestException('Slug 已存在');

    return this.prisma.client.cms_help_docs.create({
      data: {
        category: dto.category,
        title: dto.title,
        slug: dto.slug,
        summary: dto.summary,
        content: dto.content,
        tags: dto.tags || [],
        sort_order: dto.sortOrder || 0,
        is_published: dto.isPublished ?? true,
        updated_by: adminId,
      },
    });
  }

  async updateHelpDoc(id: string, dto: UpdateHelpDocDto, adminId: string) {
    const doc = await this.prisma.client.cms_help_docs.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException('文档不存在');

    // 检查 slug 唯一性
    if (dto.slug && dto.slug !== doc.slug) {
      const existing = await this.prisma.client.cms_help_docs.findUnique({ where: { slug: dto.slug } });
      if (existing) throw new BadRequestException('Slug 已存在');
    }

    return this.prisma.client.cms_help_docs.update({
      where: { id },
      data: {
        category: dto.category,
        title: dto.title,
        slug: dto.slug,
        summary: dto.summary,
        content: dto.content,
        tags: dto.tags,
        sort_order: dto.sortOrder,
        is_published: dto.isPublished,
        updated_by: adminId,
        updated_at: new Date(),
      },
    });
  }

  async deleteHelpDoc(id: string, adminId: string) {
    const doc = await this.prisma.client.cms_help_docs.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException('文档不存在');

    await this.prisma.client.cms_help_docs.delete({ where: { id } });
    return { success: true };
  }

  // ==================== CMS 增强：内容管理 ====================

  async getContents(contentType?: string) {
    const where: any = {};
    if (contentType) where.content_type = contentType;

    return this.prisma.client.cms_contents.findMany({
      where,
      orderBy: [{ sort_order: 'asc' }, { content_key: 'asc' }],
    });
  }

  async getContentByKey(contentKey: string) {
    const content = await this.prisma.client.cms_contents.findUnique({ where: { content_key: contentKey } });
    if (!content) throw new NotFoundException('内容不存在');
    return content;
  }

  async createContent(dto: CreateContentDto, adminId: string) {
    const existing = await this.prisma.client.cms_contents.findUnique({ where: { content_key: dto.contentKey } });
    if (existing) throw new BadRequestException('Content Key 已存在');

    return this.prisma.client.cms_contents.create({
      data: {
        content_key: dto.contentKey,
        content_type: dto.contentType,
        title: dto.title || dto.contentKey,
        content: dto.content,
        locale: dto.locale || 'zh-CN',
        sort_order: dto.sortOrder || 0,
        metadata: dto.metadata,
        updated_by: adminId || undefined,
      },
    });
  }

  async updateContent(id: string, dto: UpdateContentDto, adminId: string) {
    const content = await this.prisma.client.cms_contents.findUnique({ where: { id } });
    if (!content) throw new NotFoundException('内容不存在');

    return this.prisma.client.cms_contents.update({
      where: { id },
      data: {
        content_type: dto.contentType,
        title: dto.title,
        content: dto.content,
        locale: dto.locale,
        is_published: dto.isPublished,
        sort_order: dto.sortOrder,
        metadata: dto.metadata,
        updated_by: adminId,
        updated_at: new Date(),
      },
    });
  }

  async deleteContent(id: string, adminId: string) {
    const content = await this.prisma.client.cms_contents.findUnique({ where: { id } });
    if (!content) throw new NotFoundException('内容不存在');

    await this.prisma.client.cms_contents.delete({ where: { id } });
    return { success: true };
  }

  // ==================== VPS 性能监控 ====================

  async getInstanceMetrics(instanceId: string, hours: number = 24) {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    return this.prisma.client.instance_metrics.findMany({
      where: {
        instance_id: instanceId,
        recorded_at: { gte: since },
      },
      orderBy: { recorded_at: 'asc' },
    });
  }

  async getInstanceMetricsSummary(instanceId: string) {
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const metrics = await this.prisma.client.instance_metrics.findMany({
      where: {
        instance_id: instanceId,
        recorded_at: { gte: last24h },
      },
    });

    if (metrics.length === 0) {
      return null;
    }

    const avgCpu = metrics.reduce((sum, m) => sum + Number(m.cpu_usage), 0) / metrics.length;
    const avgMemory = metrics.reduce((sum, m) => sum + Number(m.memory_usage), 0) / metrics.length;
    const avgDisk = metrics.reduce((sum, m) => sum + Number(m.disk_usage), 0) / metrics.length;
    const maxCpu = Math.max(...metrics.map(m => Number(m.cpu_usage)));
    const maxMemory = Math.max(...metrics.map(m => Number(m.memory_usage)));

    return {
      avgCpu: avgCpu.toFixed(2),
      avgMemory: avgMemory.toFixed(2),
      avgDisk: avgDisk.toFixed(2),
      maxCpu: maxCpu.toFixed(2),
      maxMemory: maxMemory.toFixed(2),
      dataPoints: metrics.length,
    };
  }

  // ==================== 登录异常检测 ====================

  async getLoginAlerts(query: { userId?: string; resolved?: boolean; severity?: string; page?: number; limit?: number }) {
    const { userId, resolved, severity, page = 1, limit = 20 } = query;

    const where: any = {};
    if (userId) where.user_id = userId;
    if (resolved !== undefined) where.is_resolved = resolved;
    if (severity) where.severity = severity;

    const [items, total] = await Promise.all([
      this.prisma.client.login_alerts.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.client.login_alerts.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async resolveLoginAlert(alertId: string, adminId: string) {
    const alert = await this.prisma.client.login_alerts.findUnique({ where: { id: alertId } });
    if (!alert) throw new NotFoundException('告警不存在');

    return this.prisma.client.login_alerts.update({
      where: { id: alertId },
      data: {
        is_resolved: true,
        resolved_by: adminId,
        resolved_at: new Date(),
      },
    });
  }

  // ==================== RBAC 权限管理 ====================

  async getRoles() {
    return this.prisma.client.admin_roles.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async createRole(dto: CreateRoleDto, adminId: string) {
    // 检查名称唯一性
    const existing = await this.prisma.client.admin_roles.findUnique({ where: { name: dto.name } });
    if (existing) throw new BadRequestException('角色名已存在');

    // 验证权限
    const validPermissions = Object.keys(PERMISSIONS);
    const invalidPermissions = dto.permissions.filter(p => !validPermissions.includes(p));
    if (invalidPermissions.length > 0) {
      throw new BadRequestException(`无效的权限: ${invalidPermissions.join(', ')}`);
    }

    return this.prisma.client.admin_roles.create({
      data: {
        name: dto.name,
        display_name: dto.label,
        description: dto.description,
        permissions: dto.permissions,
      },
    });
  }

  async updateRole(id: string, dto: UpdateRoleDto, adminId: string) {
    const role = await this.prisma.client.admin_roles.findUnique({ where: { id } });
    if (!role) throw new NotFoundException('角色不存在');

    // 验证权限
    if (dto.permissions) {
      const validPermissions = Object.keys(PERMISSIONS);
      const invalidPermissions = dto.permissions.filter(p => !validPermissions.includes(p));
      if (invalidPermissions.length > 0) {
        throw new BadRequestException(`无效的权限: ${invalidPermissions.join(', ')}`);
      }
    }

    return this.prisma.client.admin_roles.update({
      where: { id },
      data: {
        display_name: dto.label,
        description: dto.description,
        permissions: dto.permissions,
        updated_at: new Date(),
      },
    });
  }

  async deleteRole(id: string, adminId: string) {
    const role = await this.prisma.client.admin_roles.findUnique({ where: { id } });
    if (!role) throw new NotFoundException('角色不存在');

    // 检查是否有用户使用此角色
    const assignmentCount = await this.prisma.client.admin_role_assignments.count({
      where: { role_id: id },
    });
    if (assignmentCount > 0) {
      throw new BadRequestException(`有 ${assignmentCount} 个用户使用此角色，无法删除`);
    }

    await this.prisma.client.admin_roles.delete({ where: { id } });
    return { success: true };
  }

  async assignRole(userId: string, roleId: string, assignedBy: string) {
    // 检查用户和角色是否存在
    const [user, role] = await Promise.all([
      this.prisma.client.users.findUnique({ where: { id: userId } }),
      this.prisma.client.admin_roles.findUnique({ where: { id: roleId } }),
    ]);

    if (!user) throw new NotFoundException('用户不存在');
    if (!role) throw new NotFoundException('角色不存在');

    // 检查是否已分配
    const existing = await this.prisma.client.admin_role_assignments.findFirst({
      where: { user_id: userId, role_id: roleId },
    });
    if (existing) throw new BadRequestException('角色已分配');

    return this.prisma.client.admin_role_assignments.create({
      data: {
        user_id: userId,
        role_id: roleId,
        assigned_by: assignedBy,
      },
    });
  }

  async removeRole(userId: string, roleId: string, adminId: string) {
    const assignment = await this.prisma.client.admin_role_assignments.findFirst({
      where: { user_id: userId, role_id: roleId },
    });
    if (!assignment) throw new NotFoundException('角色分配不存在');

    await this.prisma.client.admin_role_assignments.delete({
      where: { id: assignment.id },
    });
    return { success: true };
  }

  async getUserRoles(userId: string) {
    const assignments = await this.prisma.client.admin_role_assignments.findMany({
      where: { user_id: userId },
    });

    if (assignments.length === 0) return [];

    const roleIds = assignments.map(a => a.role_id);
    return this.prisma.client.admin_roles.findMany({
      where: { id: { in: roleIds } },
    });
  }

  async getUserPermissions(userId: string): Promise<string[]> {
    const roles = await this.getUserRoles(userId);
    const permissions = new Set<string>();

    for (const role of roles) {
      const rolePermissions = role.permissions as string[];
      rolePermissions.forEach(p => permissions.add(p));
    }

    return Array.from(permissions);
  }

  async checkPermission(userId: string, permission: string): Promise<boolean> {
    const permissions = await this.getUserPermissions(userId);
    return permissions.includes(permission);
  }

  async initPresetRoles() {
    for (const preset of Object.values(PRESET_ROLES)) {
      const existing = await this.prisma.client.admin_roles.findUnique({ where: { name: preset.name } });
      if (!existing) {
        await this.prisma.client.admin_roles.create({
          data: {
            name: preset.name,
            display_name: preset.label,
            description: preset.description,
            permissions: [...preset.permissions],
          },
        });
        this.logger.log(`创建预设角色: ${preset.name}`);
      }
    }
  }

  // ==================== 权限列表 ====================

  getPermissionsList() {
    return Object.entries(PERMISSIONS).map(([key, label]) => ({
      key,
      label,
    }));
  }
}
