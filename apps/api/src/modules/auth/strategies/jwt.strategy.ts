import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from '../dto/jwt-payload.dto';

/**
 * JWT 认证策略
 * 负责从请求中提取 JWT 并验证
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(private readonly configService: ConfigService) {
    const secret = configService.get<string>('jwt.secret');
    if (!secret) {
      throw new Error('JWT_SECRET 配置缺失');
    }

    super({
      // 从 Bearer Token 中提取 JWT
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      // 不忽略过期时间
      ignoreExpiration: false,
      // JWT 密钥
      secretOrKey: secret,
    });
  }

  /**
   * 验证 JWT Payload
   * 此方法会在 JWT 签名验证成功后调用
   * 返回值会被附加到 request.user
   *
   * @param payload JWT 解析后的 Payload
   * @returns 用户信息
   */
  async validate(payload: JwtPayload): Promise<JwtPayload> {
    // 基本校验
    if (!payload.sub || !payload.email) {
      this.logger.warn('JWT Payload 缺失必要字段', { payload });
      throw new UnauthorizedException('无效的 Token');
    }

    // 可以在这里添加额外验证，例如：
    // 1. 检查用户是否存在
    // 2. 检查用户状态是否正常
    // 3. 检查 Token 是否在黑名单中
    // 目前简单返回 Payload

    this.logger.debug(`JWT 验证成功: ${payload.email} (${payload.sub})`);

    return {
      sub: payload.sub,
      userId: payload.sub,  // 兼容新旧代码
      email: payload.email,
      vipLevel: payload.vipLevel,
    };
  }
}
