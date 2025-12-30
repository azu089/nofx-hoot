import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CryptoService } from './crypto.service';
import * as crypto from 'crypto';

describe('CryptoService', () => {
  let service: CryptoService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CryptoService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue(undefined), // 使用默认密钥
          },
        },
      ],
    }).compile();

    service = module.get<CryptoService>(CryptoService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('encrypt', () => {
    // 正常路径：加密字符串应返回 encryptedBlob、iv、authTag
    it('should encrypt string and return encryptedBlob, iv, authTag', () => {
      const plaintext = 'test-api-key-12345';

      const result = service.encrypt(plaintext);

      expect(result).toHaveProperty('encryptedBlob');
      expect(result).toHaveProperty('iv');
      expect(result).toHaveProperty('authTag');

      // 验证 base64 格式
      expect(result.encryptedBlob).toMatch(/^[A-Za-z0-9+/=]+$/);
      expect(result.iv).toMatch(/^[A-Za-z0-9+/=]+$/);
      expect(result.authTag).toMatch(/^[A-Za-z0-9+/=]+$/);

      // IV 长度应为 12 字节（base64 编码后 16 字符）
      expect(Buffer.from(result.iv, 'base64').length).toBe(12);

      // authTag 长度应为 16 字节（base64 编码后约 24 字符）
      expect(Buffer.from(result.authTag, 'base64').length).toBe(16);
    });

    // 边界路径：空字符串加密
    it('should encrypt empty string', () => {
      const plaintext = '';

      const result = service.encrypt(plaintext);

      expect(result.encryptedBlob).toBeDefined();
      expect(result.iv).toBeDefined();
      expect(result.authTag).toBeDefined();
    });

    // 边界路径：长字符串加密（如 API Key）
    it('should encrypt long string (API Key)', () => {
      const plaintext =
        'sk_live_51234567890abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ';

      const result = service.encrypt(plaintext);

      expect(result.encryptedBlob).toBeDefined();
      expect(result.iv).toBeDefined();
      expect(result.authTag).toBeDefined();
      expect(result.encryptedBlob.length).toBeGreaterThan(0);
    });

    // 正常路径：每次加密应使用不同的 IV
    it('should use different IV for each encryption', () => {
      const plaintext = 'test-api-key';

      const result1 = service.encrypt(plaintext);
      const result2 = service.encrypt(plaintext);

      // IV 应不同（随机生成）
      expect(result1.iv).not.toBe(result2.iv);
      // 密文也应不同（因为 IV 不同）
      expect(result1.encryptedBlob).not.toBe(result2.encryptedBlob);
    });
  });

  describe('decrypt', () => {
    // 正常路径：加密后解密应返回原始字符串
    it('should decrypt encrypted string and return original plaintext', () => {
      const plaintext = 'test-api-key-12345';

      const encrypted = service.encrypt(plaintext);
      const decrypted = service.decrypt(
        encrypted.encryptedBlob,
        encrypted.iv,
        encrypted.authTag,
      );

      expect(decrypted).toBe(plaintext);
    });

    // 异常路径：错误的 authTag 应抛出错误
    it('should throw error with wrong authTag', () => {
      const plaintext = 'test-api-key-12345';

      const encrypted = service.encrypt(plaintext);

      // 生成错误的 authTag
      const wrongAuthTag = crypto.randomBytes(16).toString('base64');

      expect(() => {
        service.decrypt(encrypted.encryptedBlob, encrypted.iv, wrongAuthTag);
      }).toThrow();
    });

    // 异常路径：错误的 iv 应抛出错误或返回乱码
    it('should throw error or return garbage with wrong iv', () => {
      const plaintext = 'test-api-key-12345';

      const encrypted = service.encrypt(plaintext);

      // 生成错误的 iv
      const wrongIv = crypto.randomBytes(12).toString('base64');

      expect(() => {
        service.decrypt(encrypted.encryptedBlob, wrongIv, encrypted.authTag);
      }).toThrow();
    });

    // 异常路径：错误的 encryptedBlob 应抛出错误
    it('should throw error with wrong encryptedBlob', () => {
      const plaintext = 'test-api-key-12345';

      const encrypted = service.encrypt(plaintext);

      // 篡改密文
      const wrongBlob = 'invalid-base64-blob';

      expect(() => {
        service.decrypt(wrongBlob, encrypted.iv, encrypted.authTag);
      }).toThrow();
    });
  });

  describe('encrypt and decrypt round-trip', () => {
    // 加密解密往返测试：任意字符串加密后解密应等于原始值
    it('should return original string after encrypt and decrypt', () => {
      const testCases = [
        'simple-api-key',
        'sk_live_1234567890',
        '特殊字符: !@#$%^&*()',
        'unicode: 你好世界 🚀',
        '',
        'a'.repeat(1000), // 长字符串
      ];

      testCases.forEach((plaintext) => {
        const encrypted = service.encrypt(plaintext);
        const decrypted = service.decrypt(
          encrypted.encryptedBlob,
          encrypted.iv,
          encrypted.authTag,
        );

        expect(decrypted).toBe(plaintext);
      });
    });
  });

  describe('generateKey', () => {
    // 密钥生成测试：生成的密钥应为 64 个十六进制字符
    it('should generate 64 hex characters key', () => {
      const key = CryptoService.generateKey();

      expect(key).toHaveLength(64);
      expect(key).toMatch(/^[0-9a-f]{64}$/);
    });

    // 密钥生成测试：每次生成的密钥应不同
    it('should generate different keys each time', () => {
      const key1 = CryptoService.generateKey();
      const key2 = CryptoService.generateKey();

      expect(key1).not.toBe(key2);
    });

    // 密钥生成测试：生成的密钥应可用于加密
    it('should generate usable key for encryption', () => {
      const generatedKey = CryptoService.generateKey();

      // 创建新的 ConfigService mock 使用生成的密钥
      const testModule = Test.createTestingModule({
        providers: [
          CryptoService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn().mockReturnValue(generatedKey),
            },
          },
        ],
      }).compile();

      testModule.then((module) => {
        const testService = module.get<CryptoService>(CryptoService);
        const plaintext = 'test-key';

        const encrypted = testService.encrypt(plaintext);
        const decrypted = testService.decrypt(
          encrypted.encryptedBlob,
          encrypted.iv,
          encrypted.authTag,
        );

        expect(decrypted).toBe(plaintext);
      });
    });
  });

  describe('constructor with ENCRYPTION_KEY', () => {
    it('should use default key when ENCRYPTION_KEY is not configured', () => {
      // 已在 beforeEach 中配置（返回 undefined）
      expect(service).toBeDefined();

      // 应能正常加密解密
      const plaintext = 'test';
      const encrypted = service.encrypt(plaintext);
      const decrypted = service.decrypt(
        encrypted.encryptedBlob,
        encrypted.iv,
        encrypted.authTag,
      );

      expect(decrypted).toBe(plaintext);
    });

    it('should throw error when ENCRYPTION_KEY is invalid length', async () => {
      const invalidKey = '123456'; // 只有 6 字符，应为 64

      await expect(
        Test.createTestingModule({
          providers: [
            CryptoService,
            {
              provide: ConfigService,
              useValue: {
                get: jest.fn().mockReturnValue(invalidKey),
              },
            },
          ],
        }).compile(),
      ).rejects.toThrow('ENCRYPTION_KEY 必须是 64 个十六进制字符（32 字节）');
    });

    it('should use provided ENCRYPTION_KEY when configured', async () => {
      const customKey = CryptoService.generateKey();

      const module = await Test.createTestingModule({
        providers: [
          CryptoService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn().mockReturnValue(customKey),
            },
          },
        ],
      }).compile();

      const customService = module.get<CryptoService>(CryptoService);

      const plaintext = 'test';
      const encrypted = customService.encrypt(plaintext);
      const decrypted = customService.decrypt(
        encrypted.encryptedBlob,
        encrypted.iv,
        encrypted.authTag,
      );

      expect(decrypted).toBe(plaintext);
    });
  });
});
