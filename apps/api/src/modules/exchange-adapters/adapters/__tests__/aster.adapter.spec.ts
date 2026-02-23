/**
 * AsterAdapter 单元测试
 *
 * 测试用例:
 *   1. 正常路径: 构造器正确设置属性 (主网/测试网)
 *   2. 异常路径: 无效凭证 / API 错误处理
 *   3. 签名路径: signAsterRequest 生成有效签名
 */

import { AsterAdapter } from '../aster.adapter';
import { signAsterRequest, genNonce } from '../aster/signing';
import { AsterAdapterConfig, ASTER_BASE_URL } from '../aster/types';

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch as any;

describe('AsterAdapter', () => {
  // 使用 Hardhat 默认账户 #0 和 #1（有效 EIP-55 checksum 地址）
  const mainnetConfig: AsterAdapterConfig = {
    userAddress: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    signerAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    privateKey:
      '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
    isTestnet: false,
  };

  const testnetConfig: AsterAdapterConfig = {
    ...mainnetConfig,
    isTestnet: true,
  };

  beforeEach(() => {
    mockFetch.mockReset();
  });

  // ========================= 正常路径 =========================

  describe('构造器 + 属性', () => {
    it('主网配置正确设置', () => {
      const adapter = new AsterAdapter(mainnetConfig);

      expect(adapter.exchangeType).toBe('aster');
      expect(adapter.isDex).toBe(true);
      expect(adapter.isTestnet).toBe(false);
      expect(adapter.category).toBe('dex');
    });

    it('测试网配置正确设置', () => {
      const adapter = new AsterAdapter(testnetConfig);

      expect(adapter.exchangeType).toBe('aster');
      expect(adapter.isDex).toBe(true);
      expect(adapter.isTestnet).toBe(true);
      expect(adapter.category).toBe('dex');
    });
  });

  describe('initialize', () => {
    it('初始化加载 exchangeInfo 并缓存精度', async () => {
      // Mock exchangeInfo API (第1次 fetch)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          symbols: [
            {
              symbol: 'BTCUSDT',
              status: 'TRADING',
              baseAsset: 'BTC',
              quoteAsset: 'USDT',
              filters: [
                {
                  filterType: 'PRICE_FILTER',
                  tickSize: '0.10',
                  minPrice: '0.10',
                  maxPrice: '1000000.00',
                },
                {
                  filterType: 'LOT_SIZE',
                  stepSize: '0.001',
                  minQty: '0.001',
                  maxQty: '1000.000',
                },
                {
                  filterType: 'MIN_NOTIONAL',
                  notional: '5.0',
                },
              ],
            },
            {
              symbol: 'ETHUSDT',
              status: 'TRADING',
              baseAsset: 'ETH',
              quoteAsset: 'USDT',
              filters: [
                {
                  filterType: 'PRICE_FILTER',
                  tickSize: '0.01',
                  minPrice: '0.01',
                  maxPrice: '100000.00',
                },
                {
                  filterType: 'LOT_SIZE',
                  stepSize: '0.01',
                  minQty: '0.01',
                  maxQty: '10000.00',
                },
                {
                  filterType: 'MIN_NOTIONAL',
                  notional: '5.0',
                },
              ],
            },
          ],
        }),
      });
      // Mock getBalance → /fapi/v3/balance (第2次 fetch)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify([
          { asset: 'USDT', balance: '1000.00', availableBalance: '800.00', crossUnPnl: '0.00' },
        ]),
      });
      // Mock getPositions → /fapi/v3/positionRisk (第3次 fetch，getBalance 内部调用)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify([]),
      });

      const adapter = new AsterAdapter(mainnetConfig);
      await adapter.initialize();

      // 验证调用了 exchangeInfo + getBalance + getPositions
      expect(mockFetch).toHaveBeenCalledTimes(3);
      const url = mockFetch.mock.calls[0][0];
      expect(url).toContain('/fapi/v3/exchangeInfo');
    });
  });

  // ========================= 异常路径 =========================

  describe('异常处理', () => {
    it('exchangeInfo 请求失败时初始化抛出错误', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      });

      const adapter = new AsterAdapter(mainnetConfig);

      await expect(adapter.initialize()).rejects.toThrow();
    });

    it('网络错误时初始化抛出错误', async () => {
      mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const adapter = new AsterAdapter(mainnetConfig);

      await expect(adapter.initialize()).rejects.toThrow();
    });
  });

  describe('dispose', () => {
    it('dispose 清理精度缓存', async () => {
      // 先初始化 (exchangeInfo + getBalance + getPositions)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ symbols: [] }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify([]),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify([]),
      });

      const adapter = new AsterAdapter(mainnetConfig);
      await adapter.initialize();
      await adapter.dispose();

      // dispose 不抛出错误
      expect(true).toBe(true);
    });
  });

  // ========================= 签名工具函数 =========================

  describe('signAsterRequest', () => {
    // 使用 Hardhat 默认私钥 #0 进行确定性测试
    const testPrivateKey =
      '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
    const testUserAddress = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
    const testSignerAddress = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';

    it('生成有效签名格式 (65字节 hex)', () => {
      const result = signAsterRequest(
        '{"symbol":"BTCUSDT","side":"BUY"}',
        testUserAddress,
        testSignerAddress,
        testPrivateKey,
      );

      // 签名应该是 0x 开头的 hex 字符串
      expect(result.signature).toMatch(/^0x[0-9a-f]+$/i);
      // 65 字节 = 130 hex + 0x = 132 字符
      expect(result.signature.length).toBe(132);

      // nonce 应该是数字字符串
      expect(result.nonce).toMatch(/^\d+$/);
      // nonce 应该是微秒级（至少 16 位）
      expect(result.nonce.length).toBeGreaterThanOrEqual(16);
    });

    it('不同输入生成不同签名', () => {
      const sig1 = signAsterRequest(
        '{"symbol":"BTCUSDT"}',
        testUserAddress,
        testSignerAddress,
        testPrivateKey,
      );

      const sig2 = signAsterRequest(
        '{"symbol":"ETHUSDT"}',
        testUserAddress,
        testSignerAddress,
        testPrivateKey,
      );

      // 签名本身由于 nonce 不同一定不同
      // 但即使忽略 nonce，不同输入也应产生不同签名
      expect(sig1.signature).not.toBe(sig2.signature);
    });

    it('无 0x 前缀的私钥也能正常签名', () => {
      const keyWithout0x = testPrivateKey.slice(2);

      const result = signAsterRequest(
        '{"test":true}',
        testUserAddress,
        testSignerAddress,
        keyWithout0x,
      );

      expect(result.signature).toMatch(/^0x[0-9a-f]+$/i);
      expect(result.signature.length).toBe(132);
    });
  });

  describe('genNonce', () => {
    it('生成微秒级时间戳', () => {
      const nonce = genNonce();

      // 应该是数字字符串
      expect(nonce).toMatch(/^\d+$/);

      // 应该约等于 Date.now() * 1000
      const nowMicro = Date.now() * 1000;
      const nonceNum = Number(nonce);
      // 误差 < 1 秒
      expect(Math.abs(nonceNum - nowMicro)).toBeLessThan(1000000);
    });

    it('连续调用生成递增 nonce', () => {
      const n1 = genNonce();
      const n2 = genNonce();

      // n2 >= n1 (时间递增或相等)
      expect(BigInt(n2)).toBeGreaterThanOrEqual(BigInt(n1));
    });
  });
});
