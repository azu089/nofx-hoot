import { Controller, Post, Get, Body, Param, Delete, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { TelegramBotGuard } from '../../common/guards/telegram-bot.guard';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto, RefreshTokenDto } from './dto/auth.dto';
import {
  BindTelegramDto,
  TelegramLoginDto,
  TelegramWebAppLoginDto,
  GetWalletNonceDto,
  WalletLoginDto,
  BindEmailDto,
  BindWalletDto,
} from './dto/telegram.dto';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  // 注册 - 公开接口（严格限流：每分钟最多 5 次）
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  // 登录 - 公开接口（严格限流：每分钟最多 10 次，防止暴力破解）
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('login')
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.authService.login(dto, req.ip);
  }

  // 刷新 Token - 公开接口（限流：每分钟最多 10 次）
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('refresh')
  async refreshToken(@Body() dto: RefreshTokenDto, @Req() req: Request) {
    return this.authService.refreshAccessToken(
      dto.refreshToken,
      req.ip,
      req.headers['user-agent'],
    );
  }

  // 登出 - 需要认证（撤销所有活跃 Refresh Token）
  @Post('logout')
  async logout(@CurrentUser() user: { id: string }) {
    await this.authService.revokeAllTokens(user.id);
    return { message: '已登出' };
  }

  // 获取当前用户信息 - 需要认证
  @Get('me')
  async getProfile(@CurrentUser() user: { id: string }) {
    return this.authService.getProfile(user.id);
  }

  // ===== 邮箱验证 =====

  // 发送验证码 - 公开接口（严格限流：每分钟最多 3 次，防止邮件轰炸）
  @Public()
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @Post('send-verification')
  async sendVerification(@Body('email') email: string) {
    return this.authService.sendVerificationCode(email);
  }

  // 验证邮箱 - 公开接口
  @Public()
  @Post('verify-email')
  async verifyEmail(@Body() body: { email: string; code: string }) {
    return this.authService.verifyEmail(body.email, body.code);
  }

  // ===== Telegram 相关 =====

  // 生成 Telegram 绑定码 - 需要认证（用户在网站上调用）
  @Post('telegram/bind-code')
  async generateBindCode(@CurrentUser() user: { id: string }) {
    return this.authService.generateBindCode(user.id);
  }

  // 绑定 Telegram - TG Bot 专用（需验证 Bot 密钥）
  @Public()
  @UseGuards(TelegramBotGuard)
  @Post('bind-telegram')
  async bindTelegram(@Body() dto: BindTelegramDto) {
    return this.authService.bindTelegram(dto);
  }

  // 通过 Telegram ID 获取用户 - TG Bot 专用（需验证 Bot 密钥）
  @Public()
  @UseGuards(TelegramBotGuard)
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

  // ===== Telegram 自动登录 =====

  // TG 自动登录 - TG Bot 专用（需验证 Bot 密钥）
  @Public()
  @UseGuards(TelegramBotGuard)
  @Post('telegram/login')
  async loginByTelegram(@Body() dto: TelegramLoginDto) {
    return this.authService.loginByTelegram(dto);
  }

  // TG WebApp 登录 - Mini App 前端调用（通过 initData 验签，无需 Bot 密钥）
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('telegram/webapp-login')
  async loginByWebApp(@Body() dto: TelegramWebAppLoginDto) {
    return this.authService.loginByWebApp(dto.initData);
  }

  // ===== 钱包登录 =====

  // 获取钱包登录 Nonce - 公开接口
  @Public()
  @Post('wallet/nonce')
  async getWalletNonce(@Body() dto: GetWalletNonceDto) {
    return this.authService.getWalletNonce(dto.address);
  }

  // 钱包登录 - 公开接口
  @Public()
  @Post('wallet/login')
  async loginByWallet(@Body() dto: WalletLoginDto) {
    return this.authService.loginByWallet(
      dto.address,
      dto.signature,
      dto.message,
    );
  }

  // ===== 账户绑定 =====

  // 绑定邮箱 - 需要认证
  @Post('bind/email')
  async bindEmail(
    @CurrentUser() user: { id: string },
    @Body() dto: BindEmailDto,
  ) {
    return this.authService.bindEmail(user.id, dto.email, dto.password);
  }

  // 绑定钱包 - 需要认证
  @Post('bind/wallet')
  async bindWallet(
    @CurrentUser() user: { id: string },
    @Body() dto: BindWalletDto,
  ) {
    return this.authService.bindWallet(
      user.id,
      dto.address,
      dto.signature,
      dto.message,
    );
  }

  // 解绑钱包 - 需要认证
  @Delete('wallet')
  async unbindWallet(@CurrentUser() user: { id: string }) {
    return this.authService.unbindWallet(user.id);
  }

  // 获取完整用户信息（包含绑定状态）
  @Get('profile')
  async getFullProfile(@CurrentUser() user: { id: string }) {
    return this.authService.getFullProfile(user.id);
  }
}
