import { Module } from '@nestjs/common';
import { WithdrawalsController } from './withdrawals.controller';
import { WithdrawalsService } from './withdrawals.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { WalletsModule } from '../wallets/wallets.module';
import { TotpService } from '../../common/services/totp.service';

@Module({
  imports: [PrismaModule, WalletsModule],
  controllers: [WithdrawalsController],
  providers: [WithdrawalsService, TotpService],
})
export class WithdrawalsModule {}
