import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
// 盐的长度（字节）
const SALT_LENGTH = 16;

// 缓存已派生的密钥（避免每次调用都做 scrypt）
let cachedKey: Buffer | null = null;
let cachedSalt: string | null = null;

// 获取加密密钥（从环境变量 + 固定盐派生）
// 注意：使用 ENCRYPTION_SALT 环境变量作为盐，比硬编码 'salt' 安全
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error('ENCRYPTION_KEY 环境变量未设置');
  }

  // 盐从环境变量读取，向后兼容：如果没设 ENCRYPTION_SALT 则使用旧盐 'salt'
  const salt = process.env.ENCRYPTION_SALT || 'salt';

  // 缓存机制：相同密钥+盐不重复计算
  if (cachedKey && cachedSalt === `${key}:${salt}`) {
    return cachedKey;
  }

  cachedKey = crypto.scryptSync(key, salt, 32);
  cachedSalt = `${key}:${salt}`;
  return cachedKey;
}

export interface EncryptedData {
  encryptedData: string; // Base64 编码
  iv: string; // Base64 编码
  authTag: string; // Base64 编码
}

// AES-256-GCM 加密
export function encrypt(plaintext: string): EncryptedData {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  const authTag = cipher.getAuthTag();

  return {
    encryptedData: encrypted,
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
  };
}

// AES-256-GCM 解密
export function decrypt(encrypted: EncryptedData): string {
  const key = getEncryptionKey();
  const iv = Buffer.from(encrypted.iv, 'base64');
  const authTag = Buffer.from(encrypted.authTag, 'base64');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted.encryptedData, 'base64', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

// 掩码显示 API Key（只显示前4位和后4位）
export function maskApiKey(key: string): string {
  if (key.length <= 8) {
    return '****';
  }
  return `${key.slice(0, 4)}****${key.slice(-4)}`;
}

// 生成安全的随机字符串（用于密钥、盐等）
export function generateSecureRandom(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}
