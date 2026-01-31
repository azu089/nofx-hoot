/**
 * 管理员认证控制器
 */
import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Req,
  Put,
} from '@nestjs/common';
import type { Request } from 'express';
import { AdminAuthService } from './admin-auth.service';
import { AdminLoginDto, ChangePasswordDto, CreateAdminDto } from './dto/auth.dto';
import { AdminGuard } from './guards/admin.guard';
import { Admin } from './decorators/admin.decorator';
import { Public } from '../auth/decorators/public.decorator';

@Controller('admin/auth')
export class AdminAuthController {
  constructor(private adminAuthService: AdminAuthService) {}

  /**
   * 管理员登录
   * POST /admin/auth/login
   */
  @Public() // 登录接口不需要认证
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
    );
  }

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
      throw new Error('权限不足');
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
      throw new Error('权限不足');
    }
    return this.adminAuthService.getAdmins();
  }
}
