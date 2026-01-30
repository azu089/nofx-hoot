import { Module } from '@nestjs/common';
import { BlockchainController } from './blockchain.controller';
import { BlockchainService } from './blockchain.service';
import { WithdrawService } from './withdraw.service';
import { WalletModule } from '../wallet/wallet.module';

@Module({
  imports: [WalletModule],
  controllers: [BlockchainController],
  providers: [BlockchainService, WithdrawService],
  exports: [BlockchainService, WithdrawService],
})
export class BlockchainModule {}
