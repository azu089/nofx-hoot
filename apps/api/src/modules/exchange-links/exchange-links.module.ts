import { Module } from '@nestjs/common';
import { ExchangeLinksController } from './exchange-links.controller';
import { ExchangeLinksService } from './exchange-links.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ExchangeLinksController],
  providers: [ExchangeLinksService],
  exports: [ExchangeLinksService],
})
export class ExchangeLinksModule {}
