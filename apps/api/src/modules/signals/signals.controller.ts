import { Controller, Post, Get, Body, Query, Param, UseGuards } from '@nestjs/common';
import { SignalsService } from './signals.service';
import { WebhookSignalDto } from './dto/signal.dto';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { WebhookSignatureGuard } from './guards/webhook-signature.guard';

@Controller('signals')
export class SignalsController {
  constructor(private signalsService: SignalsService) {}

  // Freqtrade Webhook 接口 - 公开接口，使用 HMAC-SHA256 签名验证
  @Public()
  @UseGuards(WebhookSignatureGuard)
  @Post('webhook')
  async receiveWebhook(@Body() dto: WebhookSignalDto) {
    return this.signalsService.receiveWebhook(dto);
  }

  // 获取最近的信号列表
  @Get('recent')
  async getRecentSignals(@Query('limit') limit?: string) {
    return this.signalsService.getRecentSignals(
      limit ? parseInt(limit, 10) : 20,
    );
  }

  // 获取信号执行详情
  @Get(':id/executions')
  async getSignalExecutions(@Param('id') signalId: string) {
    return this.signalsService.getSignalExecutions(signalId);
  }

  // 获取用户的执行历史
  @Get('my/executions')
  async getMyExecutions(
    @CurrentUser() user: { id: string },
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.signalsService.getUserExecutions(
      user.id,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  // 获取信号统计（公开）
  @Public()
  @Get('stats')
  async getSignalStats(@Query('hours') hours?: string) {
    return this.signalsService.getSignalStats(
      hours ? parseInt(hours, 10) : 24,
    );
  }
}
