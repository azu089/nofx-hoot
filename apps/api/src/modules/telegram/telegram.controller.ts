import {
  Controller,
  Post,
  Delete,
  Get,
  Body,
  UseGuards,
  Request,
  Ip,
  HttpCode,
  HttpStatus,
  Param,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiHeader,
} from '@nestjs/swagger';
import { TelegramService } from './telegram.service';
import { TelegramApiService } from './telegram-api.service';
import { TelegramNotificationService, NotificationSettings } from './telegram-notification.service';
import { TelegramBotService } from './telegram-bot.service';
import {
  TelegramAuthDto,
  LinkTelegramDto,
  TelegramAuthResponseDto,
  TelegramLinkStatusDto,
} from './dto';
import {
  TelegramDashboardDto,
  TelegramStrategiesResponseDto,
  TelegramWalletDto,
  TelegramCheckinResponseDto,
  TelegramInviteDto,
  TelegramTradeControlDto,
  TelegramPanicDto,
  TelegramPanicResponseDto,
} from './dto/telegram-dashboard.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Telegram')
@Controller('telegram')
export class TelegramController {
  constructor(
    private readonly telegramService: TelegramService,
    private readonly telegramApiService: TelegramApiService,
    private readonly notificationService: TelegramNotificationService,
    private readonly botService: TelegramBotService,
  ) {}

  // ==================== 认证相关 ====================

  @Post('auth')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Telegram 登录/注册' })
  @ApiResponse({
    status: 200,
    description: '登录成功',
    type: TelegramAuthResponseDto,
  })
  @ApiResponse({ status: 401, description: '认证失败' })
  async authenticate(
    @Body() dto: TelegramAuthDto,
    @Ip() ip: string,
  ): Promise<TelegramAuthResponseDto> {
    return this.telegramService.authenticate(dto, ip);
  }

  @Post('link')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '绑定 Telegram 到现有账户' })
  @ApiResponse({
    status: 200,
    description: '绑定成功',
    type: TelegramLinkStatusDto,
  })
  @ApiResponse({ status: 401, description: '认证失败' })
  @ApiResponse({ status: 409, description: 'Telegram 已被其他账户绑定' })
  async linkTelegram(
    @Body() dto: LinkTelegramDto,
    @Request() req: any,
    @Ip() ip: string,
  ): Promise<TelegramLinkStatusDto> {
    return this.telegramService.linkTelegram(req.user.sub, dto.initData, ip);
  }

  @Delete('unlink')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '解绑 Telegram' })
  @ApiResponse({
    status: 200,
    description: '解绑成功',
    type: TelegramLinkStatusDto,
  })
  @ApiResponse({ status: 409, description: '请先绑定邮箱' })
  async unlinkTelegram(
    @Request() req: any,
  ): Promise<TelegramLinkStatusDto> {
    return this.telegramService.unlinkTelegram(req.user.sub);
  }

  @Get('link-status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取 Telegram 绑定状态' })
  @ApiResponse({
    status: 200,
    description: '获取成功',
    type: TelegramLinkStatusDto,
  })
  async getLinkStatus(
    @Request() req: any,
  ): Promise<TelegramLinkStatusDto> {
    return this.telegramService.getLinkStatus(req.user.sub);
  }

  // ==================== Mini App 专用 API ====================

  @Get('dashboard')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mini App 仪表盘数据' })
  @ApiResponse({
    status: 200,
    description: '获取成功',
    type: TelegramDashboardDto,
  })
  async getDashboard(
    @Request() req: any,
  ): Promise<TelegramDashboardDto> {
    return this.telegramApiService.getDashboard(req.user.sub);
  }

  @Get('strategies')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mini App 策略列表' })
  @ApiResponse({
    status: 200,
    description: '获取成功',
    type: TelegramStrategiesResponseDto,
  })
  async getStrategies(
    @Request() req: any,
  ): Promise<TelegramStrategiesResponseDto> {
    return this.telegramApiService.getStrategies(req.user.sub);
  }

  @Get('wallet')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mini App 钱包概览' })
  @ApiResponse({
    status: 200,
    description: '获取成功',
    type: TelegramWalletDto,
  })
  async getWallet(
    @Request() req: any,
  ): Promise<TelegramWalletDto> {
    return this.telegramApiService.getWallet(req.user.sub);
  }

  @Post('checkin')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '签到' })
  @ApiResponse({
    status: 200,
    description: '签到结果',
    type: TelegramCheckinResponseDto,
  })
  async checkin(
    @Request() req: any,
  ): Promise<TelegramCheckinResponseDto> {
    return this.telegramApiService.checkin(req.user.sub);
  }

  @Get('invite')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '邀请信息' })
  @ApiResponse({
    status: 200,
    description: '获取成功',
    type: TelegramInviteDto,
  })
  async getInvite(
    @Request() req: any,
  ): Promise<TelegramInviteDto> {
    return this.telegramApiService.getInvite(req.user.sub);
  }

  @Post('trade/start')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '启动策略' })
  @ApiResponse({ status: 200, description: '启动成功' })
  async startTrade(
    @Request() req: any,
    @Body() dto: TelegramTradeControlDto,
  ): Promise<{ success: boolean; message: string }> {
    return this.telegramApiService.startTrade(req.user.sub, dto.configId);
  }

  @Post('trade/stop')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '停止策略' })
  @ApiResponse({ status: 200, description: '停止成功' })
  async stopTrade(
    @Request() req: any,
    @Body() dto: TelegramTradeControlDto,
  ): Promise<{ success: boolean; message: string }> {
    return this.telegramApiService.stopTrade(req.user.sub, dto.configId);
  }

  @Post('panic')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '紧急平仓' })
  @ApiResponse({
    status: 200,
    description: '平仓结果',
    type: TelegramPanicResponseDto,
  })
  async panic(
    @Request() req: any,
    @Body() dto: TelegramPanicDto,
  ): Promise<TelegramPanicResponseDto> {
    return this.telegramApiService.panic(req.user.sub, dto);
  }

  // ==================== 策略相关扩展 ====================

  @Get('strategies/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取策略详情' })
  async getStrategyDetail(
    @Request() req: any,
    @Param('id') strategyId: string,
  ) {
    return this.telegramApiService.getStrategyDetail(req.user.sub, strategyId);
  }

  @Post('strategies/:id/subscribe')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '订阅策略' })
  async subscribeStrategy(
    @Request() req: any,
    @Param('id') strategyId: string,
    @Body() dto: { capitalAllocation?: string },
  ) {
    return this.telegramApiService.subscribeStrategy(
      req.user.sub,
      strategyId,
      dto.capitalAllocation,
    );
  }

  @Delete('strategies/:id/unsubscribe')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '取消订阅策略' })
  async unsubscribeStrategy(
    @Request() req: any,
    @Param('id') strategyId: string,
  ) {
    return this.telegramApiService.unsubscribeStrategy(req.user.sub, strategyId);
  }

  @Get('my-strategies')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取我的策略配置' })
  async getMyStrategies(@Request() req: any) {
    return this.telegramApiService.getMyStrategies(req.user.sub);
  }

  // ==================== 交易历史 ====================

  @Get('trades')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取交易历史' })
  async getTrades(
    @Request() req: any,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    return this.telegramApiService.getTrades(
      req.user.sub,
      parseInt(page),
      parseInt(limit),
    );
  }

  // ==================== 账单记录 ====================

  @Get('billing')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取账单记录' })
  async getBillingHistory(
    @Request() req: any,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    return this.telegramApiService.getBillingHistory(
      req.user.sub,
      parseInt(page),
      parseInt(limit),
    );
  }

  // ==================== 通知相关 ====================

  @Get('announcements')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取公告列表' })
  async getAnnouncements() {
    return this.telegramApiService.getAnnouncements();
  }

  @Get('notifications')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取用户通知' })
  async getNotifications(
    @Request() req: any,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    return this.telegramApiService.getNotifications(
      req.user.sub,
      parseInt(page),
      parseInt(limit),
    );
  }

  // ==================== 用户设置 ====================

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取用户详细信息' })
  async getProfile(@Request() req: any) {
    return this.telegramApiService.getProfile(req.user.sub);
  }

  @Post('profile/bind-email')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '绑定邮箱' })
  async bindEmail(
    @Request() req: any,
    @Body() dto: { email: string; password: string },
  ) {
    return this.telegramApiService.bindEmail(req.user.sub, dto.email, dto.password);
  }

  // ==================== 新手任务 ====================

  @Get('onboarding/tasks')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取新手任务列表' })
  @ApiResponse({
    status: 200,
    description: '任务列表',
  })
  async getOnboardingTasks(@Request() req: any) {
    return this.telegramApiService.getOnboardingTasks(req.user.sub);
  }

  @Post('onboarding/tasks/:taskId/complete')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '完成新手任务' })
  @ApiResponse({
    status: 200,
    description: '任务完成结果',
  })
  async completeOnboardingTask(
    @Request() req: any,
    @Param('taskId') taskId: string,
  ) {
    return this.telegramApiService.completeOnboardingTask(req.user.sub, taskId);
  }

  // ==================== 通知设置 API ====================

  @Get('notification-settings')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取通知设置' })
  @ApiResponse({
    status: 200,
    description: '通知设置',
  })
  async getNotificationSettings(@Request() req: any) {
    return {
      code: 0,
      data: await this.notificationService.getNotificationSettings(req.user.sub),
    };
  }

  @Post('notification-settings')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '更新通知设置' })
  @ApiResponse({
    status: 200,
    description: '更新成功',
  })
  async updateNotificationSettings(
    @Request() req: any,
    @Body() settings: Partial<NotificationSettings>,
  ) {
    const updatedSettings = await this.notificationService.updateNotificationSettings(
      req.user.sub,
      settings,
    );
    return {
      code: 0,
      message: '设置已更新',
      data: updatedSettings,
    };
  }

  // ==================== Webhook（生产环境用）====================

  @Post('webhook')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Telegram Bot Webhook' })
  async handleWebhook(@Body() body: any) {
    const bot = this.botService.getBotInstance();
    if (bot) {
      await bot.handleUpdate(body);
    }
    return { ok: true };
  }
}
