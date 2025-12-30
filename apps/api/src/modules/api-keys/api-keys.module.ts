import { Module } from '@nestjs/common';
import { ApiKeysController } from './api-keys.controller';
import { ApiKeysService } from './api-keys.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { CryptoService } from '../../common/services/crypto.service';

@Module({
  imports: [PrismaModule],
  controllers: [ApiKeysController],
  providers: [ApiKeysService, CryptoService],
  exports: [ApiKeysService, CryptoService],
})
export class ApiKeysModule {}
