import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { MarketController } from './market.controller';
import { MarketService } from './market.service';

@Module({
  imports: [
    HttpModule.register({
      timeout: 10000,
      maxRedirects: 3,
    }),
  ],
  controllers: [MarketController],
  providers: [MarketService],
  exports: [MarketService],
})
export class MarketModule {}
