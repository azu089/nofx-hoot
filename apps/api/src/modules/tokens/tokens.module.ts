import { Module } from '@nestjs/common';
import { TokensService } from './tokens.service';
import { TokensController } from './tokens.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { ConfigsModule } from '../configs/configs.module';

/**
 * 代币模块
 * 处理积分兑换代币、线性释放、销毁等功能
 */
@Module({
  imports: [PrismaModule, ConfigsModule],
  controllers: [TokensController],
  providers: [TokensService],
  exports: [TokensService],
})
export class TokensModule {}
