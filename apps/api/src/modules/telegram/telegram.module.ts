import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TelegramController } from './telegram.controller';
import { TelegramService } from './telegram.service';
import { TelegramApiService } from './telegram-api.service';
import { TelegramBotService } from './telegram-bot.service';
import { TelegramNotificationService } from './telegram-notification.service';
import { TelegramGuard } from './telegram.guard';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    ConfigModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const jwtConfig = configService.get('jwt');
        return {
          secret: jwtConfig.secret,
          signOptions: {
            expiresIn: jwtConfig.expiresIn,
          },
        };
      },
    }),
  ],
  controllers: [TelegramController],
  providers: [
    TelegramService,
    TelegramApiService,
    TelegramBotService,
    TelegramNotificationService,
    TelegramGuard,
  ],
  exports: [
    TelegramService,
    TelegramApiService,
    TelegramBotService,
    TelegramNotificationService,
    TelegramGuard,
  ],
})
export class TelegramModule {}
