import { Module, forwardRef } from '@nestjs/common';
import { BlockchainController } from './blockchain.controller';
import { BlockchainService } from './blockchain.service';
import { WithdrawService } from './withdraw.service';
import { HdWalletService } from './hd-wallet.service';
import { SweepService } from './sweep.service';
import { WalletModule } from '../wallet/wallet.module';

@Module({
  imports: [forwardRef(() => WalletModule)],
  controllers: [BlockchainController],
  providers: [BlockchainService, WithdrawService, HdWalletService, SweepService],
  exports: [BlockchainService, WithdrawService, HdWalletService, SweepService],
})
export class BlockchainModule {}
