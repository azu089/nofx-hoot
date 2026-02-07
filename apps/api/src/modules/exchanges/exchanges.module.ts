import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ExchangesController } from './exchanges.controller';

@Module({
  imports: [PrismaModule],
  controllers: [ExchangesController],
})
export class ExchangesModule {}
