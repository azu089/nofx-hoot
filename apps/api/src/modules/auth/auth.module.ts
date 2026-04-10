import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { AirdropModule } from '../airdrop/airdrop.module';
import { ReferralModule } from '../referral/referral.module';
import { NofxModule } from '../nofx/nofx.module';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: (() => {
        const secret = process.env.JWT_SECRET;
        if (!secret && process.env.NODE_ENV === 'production') {
          throw new Error('JWT_SECRET 环境变量未设置，生产环境不允许使用默认值');
        }
        return secret || 'dev-only-jwt-secret-do-not-use-in-production';
      })(),
      signOptions: { expiresIn: '15m' },
    }),
    forwardRef(() => AirdropModule),
    forwardRef(() => ReferralModule),
    NofxModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
