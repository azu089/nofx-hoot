import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TradingGateway } from './trading.gateway';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'default-secret',
    }),
  ],
  providers: [TradingGateway],
  exports: [TradingGateway],
})
export class GatewaysModule {}
