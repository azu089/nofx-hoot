import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { StrategiesController } from './strategies.controller';
import { StrategiesService } from './strategies.service';
import { BacktestService } from './backtest.service';
import { AutoReviewService } from './auto-review.service';
import { RevenuePricingService } from './revenue-pricing.service';
import { StrategyDeployService } from './strategy-deploy.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { InstancesModule } from '../instances/instances.module';
import { FreqtradeModule } from '../freqtrade/freqtrade.module';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { DigitalOceanModule } from '../digitalocean/digitalocean.module';

/**
 * 策略模块
 *
 * 核心职责：
 * - 策略管理（CRUD）
 * - 策略回测（委托给用户 VPS 上的 Freqtrade 执行）
 * - 策略部署到 VPS
 * - 社区策略审核与收益分成
 */
@Module({
  imports: [PrismaModule, InstancesModule, FreqtradeModule, ApiKeysModule, DigitalOceanModule, HttpModule],
  controllers: [StrategiesController],
  providers: [
    StrategiesService,
    BacktestService,
    AutoReviewService,
    RevenuePricingService,
    StrategyDeployService,
  ],
  exports: [
    StrategiesService,
    BacktestService,
    AutoReviewService,
    RevenuePricingService,
    StrategyDeployService,
  ],
})
export class StrategiesModule {}
