import {
  BadRequestException,
  Body,
  Controller,
  Logger,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { InternalTokenGuard } from './internal-token.guard';
import { NofxEventsService } from './nofx-events.service';
import type { NofxEventEnvelope } from './nofx-events.service';

/**
 * NofxEventsController —— webhook 入口，接收 nofx 交易内核的回调事件。
 *
 * 路由：POST /api/internal/nofx/events
 *
 * 鉴权链：
 * 1. @Public() — 让全局 JwtAuthGuard 放行（不要求 HOOT 用户 JWT，因为
 *    nofx 是服务级调用方，没有用户 token）
 * 2. @UseGuards(InternalTokenGuard) — 用 X-Internal-Token 共享密钥校验
 *    nofx 的身份
 *
 * 不要把这条路由放在用户业务路径下（避免被全局 throttler 误伤）。
 */
@Controller('internal/nofx')
export class NofxEventsController {
  private readonly logger = new Logger(NofxEventsController.name);

  constructor(private readonly events: NofxEventsService) {}

  @Public()
  @UseGuards(InternalTokenGuard)
  @Post('events')
  async receive(@Body() body: NofxEventEnvelope) {
    if (!body || typeof body !== 'object') {
      throw new BadRequestException('invalid body');
    }
    if (!body.event_id || !body.type) {
      throw new BadRequestException('event_id and type are required');
    }
    const result = await this.events.record(body);
    return result;
  }
}
