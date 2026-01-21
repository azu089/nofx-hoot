import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcrypt';

/**
 * 用户服务
 * 负责用户信息管理、查询、更新等
 */
@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 根据 ID 查找用户
   * @param id 用户 ID
   * @returns 用户信息（含敏感字段，内部使用）
   * @throws NotFoundException 用户不存在
   */
  async findById(id: string) {
    const user = await this.prisma.client.users.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    return user;
  }

  /**
   * 根据邮箱查找用户
   * @param email 用户邮箱
   * @returns 用户信息（含敏感字段，内部使用）
   * @throws NotFoundException 用户不存在
   */
  async findByEmail(email: string) {
    const user = await this.prisma.client.users.findUnique({
      where: { email },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    return user;
  }

  /**
   * 更新用户信息
   * @param id 用户 ID
   * @param dto 更新数据
   * @returns 更新后的用户信息
   */
  async updateProfile(id: string, dto: UpdateUserDto) {
    // 确保用户存在
    await this.findById(id);

    const updateData: any = {
      updated_at: new Date(),
    };

    // 如果需要更新密码，先进行哈希
    if (dto.password) {
      const salt = await bcrypt.genSalt(10);
      updateData.password_hash = await bcrypt.hash(dto.password, salt);
      this.logger.log(`用户 ${id} 更新密码`);
    }

    const updatedUser = await this.prisma.client.users.update({
      where: { id },
      data: updateData,
    });

    return updatedUser;
  }

  /**
   * 启用 2FA
   * 注意：暂时只做数据库标记，不实现完整 TOTP
   * @param id 用户 ID
   * @returns 更新后的用户信息
   */
  async enable2FA(id: string) {
    // 确保用户存在
    await this.findById(id);

    // 检查是否已启用
    const user = await this.prisma.client.users.findUnique({
      where: { id },
      select: { two_factor_enabled: true },
    });

    if (user?.two_factor_enabled) {
      throw new ConflictException('2FA 已启用');
    }

    // 暂时只标记为已启用，不生成 secret
    // 完整实现需要：生成 secret、返回 QR code、验证 TOTP token
    const updatedUser = await this.prisma.client.users.update({
      where: { id },
      data: {
        two_factor_enabled: true,
        updated_at: new Date(),
      },
    });

    this.logger.log(`用户 ${id} 启用 2FA`);
    return updatedUser;
  }

  /**
   * 禁用 2FA
   * @param id 用户 ID
   * @returns 更新后的用户信息
   */
  async disable2FA(id: string) {
    // 确保用户存在
    await this.findById(id);

    // 检查是否已禁用
    const user = await this.prisma.client.users.findUnique({
      where: { id },
      select: { two_factor_enabled: true },
    });

    if (!user?.two_factor_enabled) {
      throw new ConflictException('2FA 未启用');
    }

    const updatedUser = await this.prisma.client.users.update({
      where: { id },
      data: {
        two_factor_enabled: false,
        two_factor_secret: null, // 清除 secret
        updated_at: new Date(),
      },
    });

    this.logger.log(`用户 ${id} 禁用 2FA`);
    return updatedUser;
  }

  /**
   * 获取用户邀请信息
   * @param id 用户 ID
   * @returns 邀请码和邀请链接
   */
  async getInviteInfo(id: string) {
    const user = await this.findById(id);

    // 如果用户没有邀请码，生成一个
    let inviteCode = user.invite_code;
    if (!inviteCode) {
      inviteCode = await this.generateInviteCode();
      await this.prisma.client.users.update({
        where: { id },
        data: { invite_code: inviteCode },
      });
    }

    const webAppUrl = process.env.WEB_APP_URL || 'https://quantfi.io';
    const inviteLink = `${webAppUrl}/register?ref=${inviteCode}`;

    return {
      inviteCode,
      inviteLink,
    };
  }

  /**
   * 生成唯一邀请码
   * 格式: 8位大写字母+数字
   */
  private async generateInviteCode(): Promise<string> {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code: string;
    let exists = true;

    while (exists) {
      code = '';
      for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }

      const existingUser = await this.prisma.client.users.findUnique({
        where: { invite_code: code },
      });
      exists = !!existingUser;
    }

    return code!;
  }

  /**
   * 获取用户邀请统计
   * 普通用户邀请功能，与代理商系统（/agents/*）完全独立
   *
   * @param id 用户 ID
   * @returns 邀请统计数据
   */
  async getInviteStats(id: string) {
    const user = await this.findById(id);

    // 如果用户没有邀请码，先生成一个
    if (!user.invite_code) {
      const inviteCode = await this.generateInviteCode();
      await this.prisma.client.users.update({
        where: { id },
        data: { invite_code: inviteCode },
      });
    }

    // 查询被该用户邀请的所有用户（一级）
    const invitedUsers = await this.prisma.client.users.findMany({
      where: { referred_by_user_id: id },
      select: {
        id: true,
        email: true,
        status: true,
        created_at: true,
      },
      orderBy: { created_at: 'desc' },
    });

    const totalInvites = invitedUsers.length;
    const activeUsers = invitedUsers.filter((u) => u.status === 'active').length;

    // 查询该用户的所有返佣记录
    const allCommissions = await this.prisma.client.user_commissions.findMany({
      where: { referrer_id: id },
      select: {
        commission_amount: true,
        status: true,
        invitee_id: true,
      },
    });

    // 手动计算总返佣
    const totalCommission = allCommissions.reduce(
      (sum, c) => sum + Number(c.commission_amount || 0),
      0,
    );

    // 手动计算待结算返佣
    const pendingCommission = allCommissions
      .filter((c) => c.status === 'pending')
      .reduce((sum, c) => sum + Number(c.commission_amount || 0), 0);

    // 获取每个被邀请用户的返佣贡献
    const recentInvites = invitedUsers.slice(0, 10).map((invitee) => {
      // 计算该被邀请人产生的返佣
      const inviteeCommission = allCommissions
        .filter((c) => c.invitee_id === invitee.id)
        .reduce((sum, c) => sum + Number(c.commission_amount || 0), 0);

      return {
        id: invitee.id,
        email: invitee.email,
        createdAt: invitee.created_at.toISOString(),
        status: invitee.status,
        commission: inviteeCommission.toFixed(8),
      };
    });

    return {
      totalInvites,
      activeUsers,
      totalCommission: totalCommission.toFixed(8),
      pendingCommission: pendingCommission.toFixed(8),
      recentInvites,
    };
  }

  /**
   * 获取被当前用户邀请的用户列表
   * 普通用户邀请功能，与代理商系统完全独立
   *
   * @param id 用户 ID
   * @param limit 限制数量
   * @returns 被邀请用户列表
   */
  async getInvitedUsers(id: string, limit: number = 50) {
    await this.findById(id);

    const invitedUsers = await this.prisma.client.users.findMany({
      where: { referred_by_user_id: id },
      select: {
        id: true,
        email: true,
        status: true,
        created_at: true,
        vip_level: true,
      },
      orderBy: { created_at: 'desc' },
      take: limit,
    });

    // 一次性获取所有相关返佣记录
    const inviteeIds = invitedUsers.map((u) => u.id);
    const allCommissions = await this.prisma.client.user_commissions.findMany({
      where: {
        referrer_id: id,
        invitee_id: { in: inviteeIds },
      },
      select: {
        invitee_id: true,
        commission_amount: true,
      },
    });

    // 构建返佣映射
    const commissionMap = new Map<string, number>();
    for (const c of allCommissions) {
      const current = commissionMap.get(c.invitee_id) || 0;
      commissionMap.set(c.invitee_id, current + Number(c.commission_amount || 0));
    }

    // 组装结果
    const result = invitedUsers.map((invitee) => ({
      id: invitee.id,
      email: invitee.email,
      status: invitee.status,
      vipLevel: invitee.vip_level,
      createdAt: invitee.created_at.toISOString(),
      totalCommission: (commissionMap.get(invitee.id) || 0).toFixed(8),
    }));

    return result;
  }

  /**
   * 获取团队成员列表（一级/二级）
   * 普通用户邀请功能，与代理商系统完全独立
   *
   * @param id 用户 ID
   * @param level 层级：1=一级（直接邀请），2=二级（间接邀请），不传则返回全部
   * @param limit 限制数量
   * @returns 团队成员列表
   */
  async getTeamMembers(id: string, level?: number, limit: number = 100) {
    await this.findById(id);

    // 一级成员：直接被当前用户邀请的
    const level1Members = await this.prisma.client.users.findMany({
      where: { referred_by_user_id: id },
      select: {
        id: true,
        email: true,
        status: true,
        created_at: true,
        vip_level: true,
      },
      orderBy: { created_at: 'desc' },
      take: limit,
    });

    // 二级成员：被一级成员邀请的
    const level1Ids = level1Members.map((m) => m.id);
    const level2Members = level1Ids.length > 0
      ? await this.prisma.client.users.findMany({
          where: { referred_by_user_id: { in: level1Ids } },
          select: {
            id: true,
            email: true,
            status: true,
            created_at: true,
            vip_level: true,
            referred_by_user_id: true,
          },
          orderBy: { created_at: 'desc' },
          take: limit,
        })
      : [];

    // 一次性获取所有相关的返佣记录
    const allMemberIds = [...level1Ids, ...level2Members.map((m) => m.id)];
    const allCommissions = allMemberIds.length > 0
      ? await this.prisma.client.user_commissions.findMany({
          where: {
            referrer_id: id,
            invitee_id: { in: allMemberIds },
          },
          select: {
            invitee_id: true,
            commission_amount: true,
            level: true,
          },
        })
      : [];

    // 构建返佣映射（按 invitee_id 和 level 分组）
    const commissionMap = new Map<string, number>();
    for (const c of allCommissions) {
      const key = `${c.invitee_id}_${c.level}`;
      const current = commissionMap.get(key) || 0;
      commissionMap.set(key, current + Number(c.commission_amount || 0));
    }

    // 组装一级成员结果
    const level1WithCommission = level1Members.map((member) => ({
      id: member.id,
      email: member.email,
      status: member.status,
      vipLevel: member.vip_level,
      createdAt: member.created_at.toISOString(),
      commission: (commissionMap.get(`${member.id}_1`) || 0).toFixed(8),
      level: 1,
    }));

    // 如果只查一级，直接返回
    if (level === 1) {
      return {
        level1: level1WithCommission,
        level2: [],
        total: level1WithCommission.length,
        level1Count: level1WithCommission.length,
        level2Count: 0,
      };
    }

    // 组装二级成员结果
    const level2WithCommission = level2Members.map((member) => {
      const referrer = level1Members.find((m) => m.id === member.referred_by_user_id);
      return {
        id: member.id,
        email: member.email,
        status: member.status,
        vipLevel: member.vip_level,
        createdAt: member.created_at.toISOString(),
        commission: (commissionMap.get(`${member.id}_2`) || 0).toFixed(8),
        level: 2,
        referrerEmail: referrer?.email || '未知',
      };
    });

    // 如果只查二级，只返回二级
    if (level === 2) {
      return {
        level1: [],
        level2: level2WithCommission,
        total: level2WithCommission.length,
        level1Count: 0,
        level2Count: level2WithCommission.length,
      };
    }

    // 返回全部
    return {
      level1: level1WithCommission,
      level2: level2WithCommission,
      total: level1WithCommission.length + level2WithCommission.length,
      level1Count: level1WithCommission.length,
      level2Count: level2WithCommission.length,
    };
  }

  /**
   * 获取用户登录日志
   * @param id 用户 ID
   * @param limit 限制数量
   * @returns 登录日志列表
   */
  async getLoginLogs(id: string, limit: number = 20) {
    const logs = await this.prisma.client.login_logs.findMany({
      where: { user_id: id },
      orderBy: { created_at: 'desc' },
      take: limit,
    });

    return logs.map((log) => ({
      id: log.id,
      ip: log.ip_address || '未知',
      device: log.user_agent
        ? this.parseUserAgent(log.user_agent)
        : '未知设备',
      location: log.location || '未知',
      time: log.created_at.toISOString(),
      status: log.login_status || 'success',
    }));
  }

  /**
   * 解析 User-Agent 字符串
   */
  private parseUserAgent(ua: string): string {
    if (ua.includes('iPhone')) return 'iPhone';
    if (ua.includes('iPad')) return 'iPad';
    if (ua.includes('Android')) return 'Android 设备';
    if (ua.includes('Mac')) return 'Mac';
    if (ua.includes('Windows')) return 'Windows PC';
    if (ua.includes('Linux')) return 'Linux';
    return '未知设备';
  }
}
