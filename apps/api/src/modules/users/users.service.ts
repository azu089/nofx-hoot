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
}
