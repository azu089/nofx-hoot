import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service';
import { Public } from '../auth/decorators/public.decorator';

@Controller('health')
export class HealthController {
  constructor(private healthService: HealthService) {}

  // 完整健康检查（公开）
  @Public()
  @Get()
  async check() {
    return this.healthService.check();
  }

  // 存活探针（公开）
  @Public()
  @Get('liveness')
  async liveness() {
    return this.healthService.liveness();
  }

  // 就绪探针（公开）
  @Public()
  @Get('readiness')
  async readiness() {
    return this.healthService.readiness();
  }

  // 系统指标（需要认证，管理员查看）
  @Get('metrics')
  async metrics() {
    return this.healthService.getMetrics();
  }

  // 业务统计（需要认证，管理员查看）
  @Get('stats')
  async stats() {
    return this.healthService.getStats();
  }
}
