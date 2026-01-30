import {
  Controller,
  Get,
  Post,
  Param,
  Body,
} from '@nestjs/common';
import { PositionsService } from './positions.service';
import { ClosePositionDto } from './dto/position.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';

@Controller('positions')
export class PositionsController {
  constructor(private positionsService: PositionsService) {}

  // 获取所有持仓
  @Get()
  async findAll(@CurrentUser() user: { id: string }) {
    return this.positionsService.findAll(user.id);
  }

  // 获取活跃持仓
  @Get('open')
  async getOpenPositions(@CurrentUser() user: { id: string }) {
    return this.positionsService.getOpenPositions(user.id);
  }

  // 通过 Telegram ID 获取持仓 - 公开接口（TG Bot 调用）
  @Public()
  @Get('telegram/:telegramId')
  async getPositionsByTelegramId(@Param('telegramId') telegramId: string) {
    return this.positionsService.getPositionsByTelegramId(telegramId);
  }

  // 手动平仓
  @Post(':id/close')
  async closePosition(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: ClosePositionDto,
  ) {
    return this.positionsService.closePosition(user.id, id, dto.apiKeyId);
  }
}
