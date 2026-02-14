/**
 * ExchangeAdaptersModule — 交易所适配器 NestJS 模块
 *
 * 提供:
 *   - AdapterFactoryService: 根据 API Key 创建交易所适配器
 *
 * 依赖:
 *   - ApiKeysModule: 获取解密的凭证
 */

import { Module } from '@nestjs/common';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { AdapterFactoryService } from './adapter-factory.service';

@Module({
  imports: [ApiKeysModule],
  providers: [AdapterFactoryService],
  exports: [AdapterFactoryService],
})
export class ExchangeAdaptersModule {}
