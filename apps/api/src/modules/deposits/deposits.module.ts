import { Module } from '@nestjs/common';
import { DepositsController } from './deposits.controller';
import { DepositsService } from './deposits.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { WalletsModule } from '../wallets/wallets.module';

@Module({
  imports: [PrismaModule, WalletsModule],
  controllers: [DepositsController],
  providers: [DepositsService],
})
export class DepositsModule {}
