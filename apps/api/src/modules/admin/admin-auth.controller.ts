/**
 * 管理员认证控制器（增强版）
 * 支持两步验证、安全状态管理
 */
import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Req,
  Put,
  ForbiddenException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { AdminAuthService } from './admin-auth.service';
import {
  AdminLoginDto,
  ChangePasswordDto,
  CreateAdminDto,
  EnableTotpDto,
  DisableTotpDto,
} from './dto/auth.dto';
import { ApiTags } from '@nestjs/swagger';
import { AdminGuard } from './guards/admin.guard';
import { Admin } from './decorators/admin.decorator';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('admin-auth')
@Controller('admin/auth')
export class AdminAuthController {
  constructor(private adminAuthService: AdminAuthService) {}

  /**
   * 管理员登录
   * POST /admin/auth/login
   * 严格限流：每分钟最多 5 次，防止暴力破解
   */
  @Public() // 登录接口不需要认证
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('login')
  async login(@Body() dto: AdminLoginDto, @Req() req: Request) {
    const ip = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    return this.adminAuthService.login(dto, ip, userAgent);
  }

  /**
   * 获取当前管理员信息
   * GET /admin/auth/me
   */
  @Public() // 跳过全局 JwtAuthGuard
  @UseGuards(AdminGuard) // 使用 AdminGuard 验证
  @Get('me')
  async getMe(@Admin() admin: { id: string }) {
    return this.adminAuthService.getMe(admin.id);
  }

  /**
   * 修改密码
   * PUT /admin/auth/password
   */
  @Public()
  @UseGuards(AdminGuard)
  @Put('password')
  async changePassword(
    @Admin() admin: { id: string },
    @Body() dto: ChangePasswordDto,
  ) {
    return this.adminAuthService.changePassword(
      admin.id,
      dto.oldPassword,
      dto.newPassword,
      dto.totpCode,
    );
  }

  // ==================== TOTP 两步验证 ====================

  /**
   * 生成 TOTP 密钥和二维码
   * POST /admin/auth/totp/generate
   */
  @Public()
  @UseGuards(AdminGuard)
  @Post('totp/generate')
  async generateTotpSecret(@Admin() admin: { id: string }) {
    return this.adminAuthService.generateTotpSecret(admin.id);
  }

  /**
   * 启用两步验证
   * POST /admin/auth/totp/enable
   */
  @Public()
  @UseGuards(AdminGuard)
  @Post('totp/enable')
  async enableTotp(@Admin() admin: { id: string }, @Body() dto: EnableTotpDto) {
    return this.adminAuthService.enableTotp(admin.id, dto.totpCode);
  }

  /**
   * 禁用两步验证
   * POST /admin/auth/totp/disable
   */
  @Public()
  @UseGuards(AdminGuard)
  @Post('totp/disable')
  async disableTotp(
    @Admin() admin: { id: string },
    @Body() dto: DisableTotpDto,
  ) {
    return this.adminAuthService.disableTotp(
      admin.id,
      dto.password,
      dto.totpCode,
    );
  }

  /**
   * 获取安全状态
   * GET /admin/auth/security
   */
  @Public()
  @UseGuards(AdminGuard)
  @Get('security')
  async getSecurityStatus(@Admin() admin: { id: string }) {
    return this.adminAuthService.getSecurityStatus(admin.id);
  }

  // ==================== 管理员管理 ====================

  /**
   * 创建管理员（仅超级管理员）
   * POST /admin/auth/admins
   */
  @Public()
  @UseGuards(AdminGuard)
  @Post('admins')
  async createAdmin(
    @Admin() admin: { id: string; role: string },
    @Body() dto: CreateAdminDto,
  ) {
    // 仅超级管理员可创建
    if (admin.role !== 'super_admin') {
      throw new ForbiddenException('权限不足');
    }
    return this.adminAuthService.createAdmin(dto, admin.id);
  }

  /**
   * 获取管理员列表
   * GET /admin/auth/admins
   */
  @Public()
  @UseGuards(AdminGuard)
  @Get('admins')
  async getAdmins(@Admin() admin: { role: string }) {
    // 仅超级管理员可查看
    if (admin.role !== 'super_admin') {
      throw new ForbiddenException('权限不足');
    }
    return this.adminAuthService.getAdmins();
  }
}
