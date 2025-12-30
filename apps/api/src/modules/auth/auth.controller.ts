import { Controller, Post, Get, Body, HttpCode, HttpStatus, Ip, Logger, UseGuards, Req, Query } from '@nestjs/common';
import { Request } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto, UserResponseDto } from './dto/auth-response.dto';
import { RefreshTokenDto, RefreshTokenResponseDto } from './dto/refresh-token.dto';
import { JwtPayload } from './dto/jwt-payload.dto';
import {
  EnableTotpDto,
  VerifyTotpDto,
  DisableTotpDto,
  TotpSetupResponseDto,
  TotpStatusResponseDto,
} from './dto/totp.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

/**
 * 认证控制器
 * 路由前缀: /api/auth
 */
@ApiTags('认证')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  /**
   * 用户注册接口
   * POST /api/auth/register
   *
   * @param dto 注册数据
   * @returns 用户信息（不含密码）
   */
  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterDto): Promise<{
    code: number;
    message: string;
    data: UserResponseDto;
  }> {
    const user = await this.authService.register(dto);

    return {
      code: 0,
      message: '注册成功',
      data: user,
    };
  }

  /**
   * 用户登录接口
   * POST /api/auth/login
   *
   * @param dto 登录数据
   * @param ip 客户端 IP
   * @param req 请求对象（获取 User-Agent）
   * @returns JWT Token 和用户信息
   */
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Ip() ip: string,
    @Req() req: Request,
  ): Promise<{
    code: number;
    message: string;
    data: AuthResponseDto;
  }> {
    const userAgent = req.headers['user-agent'];
    const result = await this.authService.login(dto, ip, userAgent);

    return {
      code: 0,
      message: '登录成功',
      data: result,
    };
  }

  /**
   * 刷新 Access Token
   * POST /api/auth/refresh
   *
   * @param dto 包含 refresh token
   * @returns 新的 access token 和 refresh token
   */
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '刷新访问令牌' })
  async refresh(@Body() dto: RefreshTokenDto): Promise<{
    code: number;
    message: string;
    data: RefreshTokenResponseDto;
  }> {
    const result = await this.authService.refreshAccessToken(dto.refreshToken);

    return {
      code: 0,
      message: '刷新成功',
      data: result,
    };
  }

  /**
   * 获取登录日志
   * GET /api/auth/login-logs
   */
  @ApiOperation({ summary: '获取登录日志' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('login-logs')
  @HttpCode(HttpStatus.OK)
  async getLoginLogs(
    @CurrentUser() user: JwtPayload,
    @Query('limit') limit?: number,
  ): Promise<{
    code: number;
    message: string;
    data: any[];
  }> {
    const logs = await this.authService.getLoginLogs(user.sub, limit || 10);

    return {
      code: 0,
      message: '获取成功',
      data: logs,
    };
  }

  /**
   * 获取当前用户信息接口
   * GET /api/auth/me
   *
   * 需要 JWT 认证
   *
   * @param user 当前已认证的用户信息（来自 JWT）
   * @returns 完整用户信息（包括 role 和 isAgent）
   */
  @UseGuards(JwtAuthGuard)
  @Get('me')
  @HttpCode(HttpStatus.OK)
  async getMe(@CurrentUser() user: JwtPayload) {
    this.logger.log(`用户查询个人信息: ${user.email} (${user.sub})`);

    // 从数据库获取完整用户信息
    const fullUserInfo = await this.authService.getUserInfo(user.sub);

    return {
      code: 0,
      message: '获取成功',
      data: fullUserInfo,
    };
  }

  // ==================== 2FA 相关接口 ====================

  /**
   * 获取 2FA 状态
   * GET /api/auth/totp/status
   */
  @ApiOperation({ summary: '获取 2FA 状态' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('totp/status')
  @HttpCode(HttpStatus.OK)
  async getTotpStatus(@CurrentUser() user: JwtPayload): Promise<{
    code: number;
    message: string;
    data: TotpStatusResponseDto;
  }> {
    const status = await this.authService.getTotpStatus(user.sub);

    return {
      code: 0,
      message: '获取成功',
      data: status,
    };
  }

  /**
   * 生成 2FA 设置信息（二维码）
   * GET /api/auth/totp/setup
   */
  @ApiOperation({ summary: '生成 2FA 设置二维码' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('totp/setup')
  @HttpCode(HttpStatus.OK)
  async setupTotp(@CurrentUser() user: JwtPayload): Promise<{
    code: number;
    message: string;
    data: TotpSetupResponseDto;
  }> {
    const setup = await this.authService.setupTotp(user.sub);

    return {
      code: 0,
      message: '获取成功，请使用 Google Authenticator 扫描二维码',
      data: setup,
    };
  }

  /**
   * 启用 2FA
   * POST /api/auth/totp/enable
   */
  @ApiOperation({ summary: '启用 2FA' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('totp/enable')
  @HttpCode(HttpStatus.OK)
  async enableTotp(
    @CurrentUser() user: JwtPayload,
    @Body() dto: EnableTotpDto,
  ): Promise<{
    code: number;
    message: string;
  }> {
    await this.authService.enableTotp(user.sub, dto.token, dto.secret);

    this.logger.log(`用户启用 2FA: ${user.email}`);

    return {
      code: 0,
      message: '2FA 已启用',
    };
  }

  /**
   * 禁用 2FA
   * POST /api/auth/totp/disable
   */
  @ApiOperation({ summary: '禁用 2FA' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('totp/disable')
  @HttpCode(HttpStatus.OK)
  async disableTotp(
    @CurrentUser() user: JwtPayload,
    @Body() dto: DisableTotpDto,
  ): Promise<{
    code: number;
    message: string;
  }> {
    await this.authService.disableTotp(user.sub, dto.token, dto.password);

    this.logger.log(`用户禁用 2FA: ${user.email}`);

    return {
      code: 0,
      message: '2FA 已禁用',
    };
  }

  /**
   * 验证 2FA 令牌（用于敏感操作）
   * POST /api/auth/totp/verify
   */
  @ApiOperation({ summary: '验证 2FA 令牌' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('totp/verify')
  @HttpCode(HttpStatus.OK)
  async verifyTotp(
    @CurrentUser() user: JwtPayload,
    @Body() dto: VerifyTotpDto,
  ): Promise<{
    code: number;
    message: string;
    data: { verified: boolean };
  }> {
    const verified = await this.authService.verifyTotp(user.sub, dto.token);

    return {
      code: 0,
      message: '验证成功',
      data: { verified },
    };
  }

  // ==================== 设备管理接口 ====================

  /**
   * 获取用户的设备列表
   * GET /api/auth/devices
   */
  @ApiOperation({ summary: '获取登录设备列表' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('devices')
  @HttpCode(HttpStatus.OK)
  async getDevices(@CurrentUser() user: JwtPayload): Promise<{
    code: number;
    message: string;
    data: any[];
  }> {
    const devices = await this.authService.getUserDevices(user.sub);

    return {
      code: 0,
      message: '获取成功',
      data: devices.map((device) => ({
        hash: device.hash.substring(0, 8) + '...', // 只显示前8位
        createdAt: device.createdAt,
        lastSeenAt: device.lastSeenAt,
        loginCount: device.loginCount,
        browser: device.components?.userAgent?.includes('Chrome')
          ? 'Chrome'
          : device.components?.userAgent?.includes('Firefox')
            ? 'Firefox'
            : device.components?.userAgent?.includes('Safari')
              ? 'Safari'
              : 'Unknown',
        os: device.components?.platform || 'Unknown',
      })),
    };
  }

  /**
   * 删除指定设备
   * DELETE /api/auth/devices/:hash
   */
  @ApiOperation({ summary: '删除指定设备' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('devices/remove')
  @HttpCode(HttpStatus.OK)
  async removeDevice(
    @CurrentUser() user: JwtPayload,
    @Body() body: { hash: string },
  ): Promise<{
    code: number;
    message: string;
  }> {
    await this.authService.removeDevice(user.sub, body.hash);

    return {
      code: 0,
      message: '设备已删除',
    };
  }

  /**
   * 清除所有设备
   * POST /api/auth/devices/clear
   */
  @ApiOperation({ summary: '清除所有登录设备' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('devices/clear')
  @HttpCode(HttpStatus.OK)
  async clearAllDevices(@CurrentUser() user: JwtPayload): Promise<{
    code: number;
    message: string;
  }> {
    await this.authService.clearAllDevices(user.sub);

    return {
      code: 0,
      message: '所有设备已清除',
    };
  }
}
