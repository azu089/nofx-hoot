import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
} from '@nestjs/common';
import { StrategiesService } from './strategies.service';
import { SubscribeStrategyDto } from './dto/strategy.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';

@Controller('strategies')
export class StrategiesController {
  constructor(private strategiesService: StrategiesService) {}

  // 获取策略列表 - 公开接口
  @Public()
  @Get()
  async findAll() {
    return this.strategiesService.findAll();
  }

  // 获取我的订阅 - 必须放在 :id 之前，否则 'my' 会被当作 id
  @Get('my/subscriptions')
  async getMySubscriptions(@CurrentUser() user: { id: string }) {
    return this.strategiesService.getMySubscriptions(user.id);
  }

  // 获取策略详情
  @Get(':id')
  async findOne(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ) {
    return this.strategiesService.findOne(user.id, id);
  }

  // 订阅策略
  @Post(':id/subscribe')
  async subscribe(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: SubscribeStrategyDto,
  ) {
    return this.strategiesService.subscribe(user.id, id, dto);
  }

  // 取消订阅
  @Delete(':id/subscribe')
  async unsubscribe(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ) {
    await this.strategiesService.unsubscribe(user.id, id);
    return { message: '已取消订阅' };
  }
}
