import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

/**
 * 加密服务
 * 使用 AES-256-GCM 加密敏感数据（如 API Key）
 *
 * 安全要求：
 * - 密钥必须从环境变量读取
 * - 每次加密使用随机 IV
 * - 禁止在日志中打印明文
 */
@Injectable()
export class CryptoService {
  private readonly logger = new Logger(CryptoService.name);
  private readonly algorithm = 'aes-256-gcm';
  private readonly ivLength = 12; // GCM 推荐 12 字节
  private readonly authTagLength = 16;
  private readonly encryptionKey: Buffer;

  constructor(private readonly configService: ConfigService) {
    const keyHex = this.configService.get<string>('ENCRYPTION_KEY');

    if (!keyHex) {
      this.logger.warn('ENCRYPTION_KEY 未配置，使用默认密钥（仅限开发环境）');
      // 开发环境默认密钥（32字节 = 64 hex chars）
      this.encryptionKey = Buffer.from(
        '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        'hex'
      );
    } else {
      if (keyHex.length !== 64) {
        throw new Error('ENCRYPTION_KEY 必须是 64 个十六进制字符（32 字节）');
      }
      this.encryptionKey = Buffer.from(keyHex, 'hex');
    }
  }

  /**
   * AES-256-GCM 加密
   * @param plaintext 明文
   * @returns 加密结果（密文、IV、认证标签）
   */
  encrypt(plaintext: string): {
    encryptedBlob: string;
    iv: string;
    authTag: string;
  } {
    // 生成随机 IV
    const iv = crypto.randomBytes(this.ivLength);

    // 创建加密器
    const cipher = crypto.createCipheriv(
      this.algorithm,
      this.encryptionKey,
      iv,
      { authTagLength: this.authTagLength }
    );

    // 加密
    let encrypted = cipher.update(plaintext, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    // 获取认证标签
    const authTag = cipher.getAuthTag();

    return {
      encryptedBlob: encrypted,
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
    };
  }

  /**
   * AES-256-GCM 解密
   * @param encryptedBlob 密文（base64）
   * @param iv IV（base64）
   * @param authTag 认证标签（base64）
   * @returns 明文
   */
  decrypt(encryptedBlob: string, iv: string, authTag: string): string {
    const ivBuffer = Buffer.from(iv, 'base64');
    const authTagBuffer = Buffer.from(authTag, 'base64');

    // 创建解密器
    const decipher = crypto.createDecipheriv(
      this.algorithm,
      this.encryptionKey,
      ivBuffer,
      { authTagLength: this.authTagLength }
    );

    // 设置认证标签
    decipher.setAuthTag(authTagBuffer);

    // 解密
    let decrypted = decipher.update(encryptedBlob, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * 生成随机加密密钥（用于初始化）
   * @returns 64 字符的十六进制字符串
   */
  static generateKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }
}
