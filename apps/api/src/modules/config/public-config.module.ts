import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { PublicConfigController } from './public-config.controller';

@Module({
  imports: [PrismaModule],
  controllers: [PublicConfigController],
})
export class PublicConfigModule {}
