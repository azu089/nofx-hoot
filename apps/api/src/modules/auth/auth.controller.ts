import { Controller, Post, Get, Body, Param, Delete } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto } from './dto/auth.dto';
import { BindTelegramDto } from './dto/telegram.dto';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  // 注册 - 公开接口
  @Public()
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  // 登录 - 公开接口
  @Public()
  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  // 获取当前用户信息 - 需要认证
  @Get('me')
  async getProfile(@CurrentUser() user: { id: string }) {
    return this.authService.getProfile(user.id);
  }

  // ===== Telegram 相关 =====

  // 生成 Telegram 绑定码 - 需要认证（用户在网站上调用）
  @Post('telegram/bind-code')
  async generateBindCode(@CurrentUser() user: { id: string }) {
    return this.authService.generateBindCode(user.id);
  }

  // 绑定 Telegram - 公开接口（TG Bot 调用）
  @Public()
  @Post('bind-telegram')
  async bindTelegram(@Body() dto: BindTelegramDto) {
    return this.authService.bindTelegram(dto);
  }

  // 通过 Telegram ID 获取用户 - 公开接口（TG Bot 调用）
  @Public()
  @Get('telegram/:telegramId')
  async getUserByTelegramId(@Param('telegramId') telegramId: string) {
    return this.authService.getUserByTelegramId(telegramId);
  }

  // 解绑 Telegram - 需要认证
  @Delete('telegram')
  async unbindTelegram(@CurrentUser() user: { id: string }) {
    await this.authService.unbindTelegram(user.id);
    return { message: '已解绑 Telegram' };
  }
}
