import { registerAs } from '@nestjs/config';
import { IsString, validateSync } from 'class-validator';
import { plainToClass } from 'class-transformer';

/**
 * 加密配置类（用于验证）
 */
class EncryptionConfigClass {
  @IsString()
  key: string;
}

/**
 * 加密配置
 *
 * 用于加密存储用户的交易所 API Key
 * 使用 AES-256-GCM 算法
 */
export default registerAs('encryption', () => {
  const config = plainToClass(EncryptionConfigClass, {
    key: process.env.ENCRYPTION_KEY || 'your-32-byte-encryption-key-here-change-in-production',
  });

  // 验证配置
  const errors = validateSync(config);
  if (errors.length > 0) {
    throw new Error(`加密配置验证失败: ${errors.toString()}`);
  }

  // 生产环境额外检查
  if (process.env.NODE_ENV === 'production') {
    // 检查是否使用默认值
    if (config.key.includes('your') || config.key.includes('change')) {
      throw new Error('生产环境禁止使用默认 ENCRYPTION_KEY，请设置 32 字节密钥');
    }
    // 检查密钥长度（必须是 64 位十六进制，即 32 字节）
    if (config.key.length !== 64 || !/^[0-9a-f]{64}$/i.test(config.key)) {
      throw new Error('生产环境 ENCRYPTION_KEY 必须是 64 位十六进制字符串（32 字节）');
    }
  }

  return config;
});
