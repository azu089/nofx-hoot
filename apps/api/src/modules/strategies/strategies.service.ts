import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * 策略服务
 * 处理交易策略相关业务逻辑
 */
@Injectable()
export class StrategiesService {
  constructor(private readonly prisma: PrismaService) {}

  // TODO: 实现策略配置验证
  // TODO: 实现策略部署到 VPS
  // TODO: 实现策略运行状态监控
  // TODO: 实现回测数据处理
}
