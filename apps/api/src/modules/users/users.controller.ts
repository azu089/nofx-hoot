import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/dto/jwt-payload.dto';
import { plainToInstance } from 'class-transformer';

/**
 * 用户控制器
 * 路由前缀: /api/users
 * 所有接口都需要 JWT 认证
 */
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(private readonly usersService: UsersService) {}

  /**
   * 获取当前用户详细信息
   * GET /api/users/profile
   * 需要认证
   */
  @Get('profile')
  async getProfile(@CurrentUser() user: JwtPayload) {
    this.logger.log(`用户 ${user.sub} 查询个人信息`);

    const userInfo = await this.usersService.findById(user.sub);

    // 使用 UserResponseDto 进行脱敏
    const safeUser = plainToInstance(UserResponseDto, userInfo, {
      excludeExtraneousValues: true, // 只包含 @Expose() 标记的字段
    });

    return {
      code: 0,
      message: 'success',
      data: safeUser,
    };
  }

  /**
   * 更新当前用户信息
   * PATCH /api/users/profile
   * 需要认证
   */
  @Patch('profile')
  async updateProfile(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateUserDto,
  ) {
    this.logger.log(`用户 ${user.sub} 更新个人信息`);

    const updatedUser = await this.usersService.updateProfile(user.sub, dto);

    // 使用 UserResponseDto 进行脱敏
    const safeUser = plainToInstance(UserResponseDto, updatedUser, {
      excludeExtraneousValues: true,
    });

    return {
      code: 0,
      message: '更新成功',
      data: safeUser,
    };
  }

  /**
   * 启用 2FA
   * POST /api/users/2fa/enable
   * 需要认证
   * 注意：暂时只做数据库标记，不实现完整 TOTP
   */
  @Post('2fa/enable')
  @HttpCode(HttpStatus.OK)
  async enable2FA(@CurrentUser() user: JwtPayload) {
    this.logger.log(`用户 ${user.sub} 启用 2FA`);

    const updatedUser = await this.usersService.enable2FA(user.sub);

    // 使用 UserResponseDto 进行脱敏
    const safeUser = plainToInstance(UserResponseDto, updatedUser, {
      excludeExtraneousValues: true,
    });

    return {
      code: 0,
      message: '2FA 已启用',
      data: safeUser,
    };
  }

  /**
   * 禁用 2FA
   * POST /api/users/2fa/disable
   * 需要认证
   */
  @Post('2fa/disable')
  @HttpCode(HttpStatus.OK)
  async disable2FA(@CurrentUser() user: JwtPayload) {
    this.logger.log(`用户 ${user.sub} 禁用 2FA`);

    const updatedUser = await this.usersService.disable2FA(user.sub);

    // 使用 UserResponseDto 进行脱敏
    const safeUser = plainToInstance(UserResponseDto, updatedUser, {
      excludeExtraneousValues: true,
    });

    return {
      code: 0,
      message: '2FA 已禁用',
      data: safeUser,
    };
  }
}
