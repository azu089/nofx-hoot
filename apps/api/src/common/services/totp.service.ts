import { Injectable } from '@nestjs/common';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';

/**
 * TOTP 双因素认证服务
 * 使用 Google Authenticator 标准 (RFC 6238)
 */
@Injectable()
export class TotpService {
  private readonly issuer = 'QuantFi';

  /**
   * 生成 TOTP 密钥
   * @returns Base32 编码的密钥
   */
  generateSecret(): string {
    return authenticator.generateSecret();
  }

  /**
   * 生成 TOTP URI (用于导入到 Authenticator App)
   * @param email 用户邮箱
   * @param secret TOTP 密钥
   * @returns otpauth:// URI
   */
  generateUri(email: string, secret: string): string {
    return authenticator.keyuri(email, this.issuer, secret);
  }

  /**
   * 生成二维码 (Base64 Data URL)
   * @param email 用户邮箱
   * @param secret TOTP 密钥
   * @returns Base64 编码的二维码图片
   */
  async generateQrCode(email: string, secret: string): Promise<string> {
    const uri = this.generateUri(email, secret);
    return QRCode.toDataURL(uri);
  }

  /**
   * 验证 TOTP 令牌
   * @param token 6位数字令牌
   * @param secret TOTP 密钥
   * @returns 是否验证成功
   */
  verify(token: string, secret: string): boolean {
    try {
      return authenticator.verify({ token, secret });
    } catch {
      return false;
    }
  }

  /**
   * 生成当前 TOTP 令牌 (仅用于测试)
   * @param secret TOTP 密钥
   * @returns 当前有效的 6 位令牌
   */
  generate(secret: string): string {
    return authenticator.generate(secret);
  }
}
