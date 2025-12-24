import { Controller } from '@nestjs/common';
import { StrategiesService } from './strategies.service';

/**
 * 策略控制器
 * 路由前缀: /api/strategies
 */
@Controller('strategies')
export class StrategiesController {
  constructor(private readonly strategiesService: StrategiesService) {}

  // TODO: 实现创建策略接口 POST /api/strategies
  // TODO: 实现获取策略列表接口 GET /api/strategies
  // TODO: 实现获取策略详情接口 GET /api/strategies/:id
  // TODO: 实现启动策略接口 POST /api/strategies/:id/start
  // TODO: 实现停止策略接口 POST /api/strategies/:id/stop
  // TODO: 实现回测接口 POST /api/strategies/:id/backtest
}
