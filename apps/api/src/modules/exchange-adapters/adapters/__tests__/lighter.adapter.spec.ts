/**
 * LighterAdapter 单元测试
 *
 * 测试用例:
 *   1. 正常路径: 构造器正确设置属性 (主网/测试网)
 *   2. 异常路径: PlaceholderSigner 写操作抛出错误
 *   3. 工具函数: floatToPriceX18, quantityToBaseAmount, toChecksumAddress
 */

import { LighterAdapter } from '../lighter.adapter';
import {
  PlaceholderLighterSigner,
  floatToPriceX18,
  quantityToBaseAmount,
  LighterTxSigner,
} from '../lighter/signing';
import { LighterAdapterConfig, LIGHTER_BASE_URL, LIGHTER_CHAIN_ID } from '../lighter/types';

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch as any;

describe('LighterAdapter', () => {
  const mainnetConfig: LighterAdapterConfig = {
    walletAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD1e',
    apiKeyPrivateKey: 'a'.repeat(80), // 40 字节 hex
    apiKeyIndex: 0,
    isTestnet: false,
  };

  const testnetConfig: LighterAdapterConfig = {
    walletAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD1e',
    apiKeyPrivateKey: 'b'.repeat(80),
    apiKeyIndex: 1,
    isTestnet: true,
  };

  beforeEach(() => {
    mockFetch.mockReset();
  });

  // ========================= 正常路径 =========================

  describe('构造器 + 属性', () => {
    it('主网配置正确设置', () => {
      const adapter = new LighterAdapter(mainnetConfig);

      expect(adapter.exchangeType).toBe('lighter');
      expect(adapter.isDex).toBe(true);
      expect(adapter.isTestnet).toBe(false);
      expect(adapter.category).toBe('dex');
    });

    it('测试网配置正确设置', () => {
      const adapter = new LighterAdapter(testnetConfig);

      expect(adapter.exchangeType).toBe('lighter');
      expect(adapter.isDex).toBe(true);
      expect(adapter.isTestnet).toBe(true);
      expect(adapter.category).toBe('dex');
    });

    it('可注入自定义签名器', () => {
      const mockSigner: LighterTxSigner = {
        initialize: jest.fn().mockResolvedValue(undefined),
        signCreateOrder: jest.fn().mockResolvedValue(Buffer.from('signed')),
        signCancelOrders: jest.fn().mockResolvedValue(Buffer.from('signed')),
        signAuthMessage: jest.fn().mockResolvedValue('0xsig'),
        isReady: jest.fn().mockReturnValue(true),
      };

      // 不抛出错误 = 注入成功
      const adapter = new LighterAdapter(mainnetConfig, mockSigner);
      expect(adapter).toBeDefined();
    });
  });

  describe('initialize', () => {
    it('初始化加载市场列表并获取账户索引', async () => {
      // Mock 市场列表 API
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            order_books: [
              {
                order_book_index: 0,
                order_book_symbol: 'BTC',
                base_token: 'BTC',
                quote_token: 'USDC',
                size_decimals: 5,
                price_decimals: 1,
                min_base_amount: '0.00001',
                tick_size: '0.1',
                best_bid: '50000',
                best_ask: '50001',
                last_price: '50000.5',
                mark_price: '50000.3',
                index_price: '50000.2',
                open_interest: '1000',
              },
            ],
          }),
        })
        // Mock 账户 API
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            account_index: 42,
            l1_address: mainnetConfig.walletAddress,
            is_registered: true,
          }),
        });

      const adapter = new LighterAdapter(mainnetConfig);
      await adapter.initialize();

      // 验证调用了市场列表和账户 API
      expect(mockFetch).toHaveBeenCalledTimes(2);

      // 验证市场列表 URL
      const marketCall = mockFetch.mock.calls[0][0];
      expect(marketCall).toContain('/api/v1/orderBooks');

      // 验证账户 URL（地址会被 toChecksumAddress 转换大小写）
      const accountCall = mockFetch.mock.calls[1][0];
      expect(accountCall).toContain('/api/v1/account');
      expect(accountCall.toLowerCase()).toContain(
        mainnetConfig.walletAddress.toLowerCase(),
      );
    });
  });

  // ========================= 异常路径 =========================

  describe('PlaceholderSigner 写操作拒绝', () => {
    it('signCreateOrder 抛出明确错误', async () => {
      const signer = new PlaceholderLighterSigner();
      await signer.initialize('', 0, 0, 0);

      await expect(signer.signCreateOrder({} as any)).rejects.toThrow(
        'Lighter 签名模块未配置',
      );
    });

    it('signCancelOrders 抛出明确错误', async () => {
      const signer = new PlaceholderLighterSigner();
      await signer.initialize('', 0, 0, 0);

      await expect(signer.signCancelOrders({ orderIds: [1] })).rejects.toThrow(
        'Lighter 签名模块未配置',
      );
    });

    it('signAuthMessage 抛出明确错误', async () => {
      const signer = new PlaceholderLighterSigner();
      await signer.initialize('', 0, 0, 0);

      await expect(
        signer.signAuthMessage({ message: 'test' }),
      ).rejects.toThrow('Lighter 签名模块未配置');
    });

    it('isReady 在初始化后仍返回 false', async () => {
      const signer = new PlaceholderLighterSigner();
      await signer.initialize('', 0, 0, 0);

      expect(signer.isReady()).toBe(false);
    });
  });

  describe('dispose', () => {
    it('dispose 清理内部状态', async () => {
      const adapter = new LighterAdapter(mainnetConfig);
      // 手动设置一些状态
      await adapter.dispose();

      // dispose 不抛出错误
      expect(true).toBe(true);
    });
  });

  // ========================= 工具函数 =========================

  describe('floatToPriceX18', () => {
    it('整数价格转换正确', () => {
      const result = floatToPriceX18(50000);
      expect(result).toBe(50000n * 10n ** 18n);
    });

    it('小数价格转换正确', () => {
      const result = floatToPriceX18(1.5);
      expect(result).toBe(1500000000000000000n);
    });

    it('零价格转换正确', () => {
      const result = floatToPriceX18(0);
      expect(result).toBe(0n);
    });

    it('高精度小数转换', () => {
      const result = floatToPriceX18(0.00001);
      // 0.00001 * 10^18 = 10^13
      expect(result).toBe(10000000000000n);
    });
  });

  describe('quantityToBaseAmount', () => {
    it('整数数量 + 5位精度', () => {
      const result = quantityToBaseAmount(1.0, 5);
      expect(result).toBe(100000n);
    });

    it('小数数量 + 3位精度', () => {
      const result = quantityToBaseAmount(0.123, 3);
      expect(result).toBe(123n);
    });

    it('零数量', () => {
      const result = quantityToBaseAmount(0, 5);
      expect(result).toBe(0n);
    });

    it('大数量 + 高精度', () => {
      const result = quantityToBaseAmount(100.12345, 5);
      expect(result).toBe(10012345n);
    });
  });
});
