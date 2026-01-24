import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ApiKeysController } from './api-keys.controller';
import { ApiKeysService } from './api-keys.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { CryptoService } from '../../common/services/crypto.service';
import { InstancesModule } from '../instances/instances.module';

@Module({
  imports: [PrismaModule, HttpModule, InstancesModule],
  controllers: [ApiKeysController],
  providers: [ApiKeysService, CryptoService],
  exports: [ApiKeysService, CryptoService],
})
export class ApiKeysModule {}
