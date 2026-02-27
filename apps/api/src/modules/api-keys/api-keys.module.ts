import { Module, forwardRef } from '@nestjs/common';
import { ApiKeysService } from './api-keys.service';
import { ApiKeysController } from './api-keys.controller';
import { ExchangeAdaptersModule } from '../exchange-adapters/exchange-adapters.module';

@Module({
  imports: [forwardRef(() => ExchangeAdaptersModule)],
  controllers: [ApiKeysController],
  providers: [ApiKeysService],
  exports: [ApiKeysService],
})
export class ApiKeysModule {}
