/**
 * Lighter DEX — 交易签名模块
 *
 * Lighter 使用 ZK 链签名（TxClient），需要原生签名库支持。
 * 本模块定义签名接口，实际签名由外部模块（lighter-sdk）提供。
 *
 *
 * 设计：
 *   LighterTxSigner 接口 — 可插拔签名模块
 *   ├─ 未来: NativeSigner — 使用 lighter-sdk npm 包
 *   └─ 当前: 抛出明确错误，等待 SDK 集成
 */

import { Logger } from '@nestjs/common';

const logger = new Logger('LighterSigning');

// ========================= 签名参数 =========================

/** 创建订单参数（传给 TxClient.CreateOrder） */
export interface CreateOrderSignParams {
  orderBookIndex: number;
  /** 基础资产数量（已乘以 10^sizeDecimals 的整数） */
  baseAmount: bigint;
  /** 价格（X18 格式） */
  priceX18: bigint;
  /** true=买, false=卖 */
  isBuy: boolean;
  /** 订单类型: 0=limit, 1=market, 2=stopLoss, 4=takeProfit */
  orderType: number;
  /** 时效: GTC, IOC, FOK */
  timeInForce: string;
  /** 是否减仓 */
  reduceOnly: boolean;
  /** 触发价格（止损/止盈用） */
  triggerPrice?: bigint;
}

/** 取消订单参数 */
export interface CancelOrdersSignParams {
  orderIds: number[];
}

/** Auth 消息签名参数 */
export interface AuthSignParams {
  message: string;
}

// ========================= 签名接口 =========================

/**
 * Lighter 交易签名器接口
 *
 * 所有需要链上签名的操作通过此接口完成。
 * 实现需要提供 TxClient 功能（创建签名交易）。
 */
export interface LighterTxSigner {
  /**
   * 初始化签名器
   * @param apiKeyPrivateKey API Key 私钥 (40字节 hex)
   * @param chainId 链 ID (mainnet=304, testnet=300)
   * @param accountIndex 账户索引
   * @param apiKeyIndex API Key 索引 (0-255)
   */
  initialize(
    apiKeyPrivateKey: string,
    chainId: number,
    accountIndex: number,
    apiKeyIndex: number,
  ): Promise<void>;

  /**
   * 签名创建订单交易
   * @returns Multipart form data 的 signed transaction 字段值
   */
  signCreateOrder(params: CreateOrderSignParams): Promise<Buffer>;

  /**
   * 签名取消订单交易
   * @returns Multipart form data 的 signed transaction 字段值
   */
  signCancelOrders(params: CancelOrdersSignParams): Promise<Buffer>;

  /**
   * 签名认证消息（用于获取 auth token）
   * @returns 签名的 hex 字符串
   */
  signAuthMessage(params: AuthSignParams): Promise<string>;

  /** 是否已初始化 */
  isReady(): boolean;
}

// ========================= 占位实现 =========================

/**
 * 占位签名器 — 抛出明确错误
 *
 * 当 lighter-sdk 未安装或未配置时使用。
 * 所有签名操作返回友好错误信息。
 *
 * TODO(@lighter-xyz): 等待 lighter-sdk npm 包发布后替换为 NativeLighterSigner
 * 跟踪: https://github.com/lighter-xyz/lighter-sdk (尚未发布 npm 包)
 * 当前状态: 市场数据 + 只读账户查询可用, 交易下单/取消/认证不可用
 * 替换步骤:
 *   1. `pnpm add lighter-sdk` (待发布)
 *   2. 实现 NativeLighterSigner (import TxClient from lighter-sdk)
 *   3. 在 AdapterFactory 中注入 NativeLighterSigner 替换 PlaceholderLighterSigner
 */
export class PlaceholderLighterSigner implements LighterTxSigner {
  private ready = false;

  async initialize(
    _apiKeyPrivateKey: string,
    _chainId: number,
    _accountIndex: number,
    _apiKeyIndex: number,
  ): Promise<void> {
    logger.warn(
      'Lighter 签名模块未配置 — 写操作将不可用。' +
        '如需交易功能，请安装 lighter-sdk 并配置 NativeLighterSigner',
    );
    this.ready = false;
  }

  async signCreateOrder(_params: CreateOrderSignParams): Promise<Buffer> {
    throw new Error(
      'Lighter 签名模块未配置：无法创建订单。' +
        '请安装 lighter-sdk npm 包或等待 Lighter 原生签名支持。',
    );
  }

  async signCancelOrders(_params: CancelOrdersSignParams): Promise<Buffer> {
    throw new Error(
      'Lighter 签名模块未配置：无法取消订单。' +
        '请安装 lighter-sdk npm 包或等待 Lighter 原生签名支持。',
    );
  }

  async signAuthMessage(_params: AuthSignParams): Promise<string> {
    throw new Error(
      'Lighter 签名模块未配置：无法获取认证令牌。' +
        '请安装 lighter-sdk npm 包或等待 Lighter 原生签名支持。',
    );
  }

  isReady(): boolean {
    return this.ready;
  }
}

// ========================= 工具函数 =========================

/**
 * Float64 → PriceX18 转换
 *
 * @param price 浮点价格
 * @returns X18 格式的价格（BigInt）
 */
export function floatToPriceX18(price: number): bigint {
  // PriceX18 = price * 10^18
  const PRICE_X18_MULTIPLIER = 10n ** 18n;
  // 先转成字符串避免精度丢失
  const parts = price.toFixed(18).split('.');
  const intPart = BigInt(parts[0]) * PRICE_X18_MULTIPLIER;
  const decPart = BigInt((parts[1] || '0').padEnd(18, '0').slice(0, 18));
  return intPart + decPart;
}

/**
 * 数量 → 基础数量（乘以 10^sizeDecimals）
 *
 * @param quantity 浮点数量
 * @param sizeDecimals 精度位数
 * @returns 缩放后的整数
 */
export function quantityToBaseAmount(
  quantity: number,
  sizeDecimals: number,
): bigint {
  const multiplier = 10 ** sizeDecimals;
  return BigInt(Math.round(quantity * multiplier));
}

/**
 * EIP-55 校验和地址转换
 *
 * @param address 小写或混合大小写地址
 * @returns EIP-55 校验和格式地址
 */
export function toChecksumAddress(address: string): string {
  // ethers.getAddress 已实现 EIP-55
  // 但为避免引入整个 ethers，这里用简单实现
  const addr = address.toLowerCase().replace('0x', '');
  const { createHash } = require('crypto');
  const hash = createHash('sha3-256').update(addr).digest('hex');

  let checksummed = '0x';
  for (let i = 0; i < addr.length; i++) {
    if (parseInt(hash[i], 16) >= 8) {
      checksummed += addr[i].toUpperCase();
    } else {
      checksummed += addr[i];
    }
  }
  return checksummed;
}
