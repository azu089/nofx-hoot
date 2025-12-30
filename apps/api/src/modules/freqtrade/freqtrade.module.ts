import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { FreqtradeService } from './freqtrade.service';
import { ConfigModule } from '../../config/config.module';

/**
 * Freqtrade 模块
 * 负责与 VPS 上的 Freqtrade API 通信
 */
@Module({
  imports: [
    HttpModule.register({
      timeout: 10000, // 10 秒超时
      maxRedirects: 5,
    }),
    ConfigModule,
  ],
  providers: [FreqtradeService],
  exports: [FreqtradeService],
})
export class FreqtradeModule {}
