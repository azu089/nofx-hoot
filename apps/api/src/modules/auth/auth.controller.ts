import { Controller, Post, Get, Body, HttpCode, HttpStatus, Ip, Logger, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto, UserResponseDto } from './dto/auth-response.dto';
import { JwtPayload } from './dto/jwt-payload.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

/**
 * 认证控制器
 * 路由前缀: /api/auth
 */
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
   * @returns JWT Token 和用户信息
   */
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Ip() ip: string,
  ): Promise<{
    code: number;
    message: string;
    data: AuthResponseDto;
  }> {
    const result = await this.authService.login(dto, ip);

    return {
      code: 0,
      message: '登录成功',
      data: result,
    };
  }

  /**
   * 获取当前用户信息接口
   * GET /api/auth/me
   *
   * 需要 JWT 认证
   *
   * @param user 当前已认证的用户信息
   * @returns 用户信息
   */
  @UseGuards(JwtAuthGuard)
  @Get('me')
  @HttpCode(HttpStatus.OK)
  async getMe(@CurrentUser() user: JwtPayload): Promise<{
    code: number;
    message: string;
    data: JwtPayload;
  }> {
    this.logger.log(`用户查询个人信息: ${user.email} (${user.sub})`);

    return {
      code: 0,
      message: '获取成功',
      data: user,
    };
  }
}
