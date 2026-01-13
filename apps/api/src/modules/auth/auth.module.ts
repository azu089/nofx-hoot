import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { VerificationCodeService } from './verification-code.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { TotpService } from '../../common/services/totp.service';
import { LoginLogService } from '../../common/services/login-log.service';
import { FingerprintService } from '../../common/services/fingerprint.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { EmailModule } from '../email/email.module';

/**
 * 认证模块
 * 负责用户注册、登录、Token 验证等
 */
@Module({
  imports: [
    PrismaModule,
    EmailModule,
    // 注册 Passport 模块
    PassportModule.register({ defaultStrategy: 'jwt' }),
    // 配置 JWT 模块
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
  controllers: [AuthController],
  providers: [AuthService, VerificationCodeService, JwtStrategy, TotpService, LoginLogService, FingerprintService],
  exports: [AuthService, VerificationCodeService, TotpService, LoginLogService, FingerprintService],
})
export class AuthModule {}
