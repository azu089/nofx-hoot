import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { ethers } from 'ethers';
import { createHash } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';

// EVM 兼容链列表（共享同一个地址）
const EVM_CHAINS = ['BSC', 'ETH', 'POLYGON'];

/**
 * HD 钱包服务
 *
 * 使用 BIP-44 标准从助记词派生地址
 *
 * EVM 充值:  m/44'/60'/0'/0/{index}   (ETH coin type)
 * TRON 充值: m/44'/195'/0'/0/{index}  (TRON coin type)
 * 提现中继:  m/44'/60'/1'/0/{index}   (account=1)
 *
 * 关键设计：
 * - EVM 链（BSC/ETH/Polygon）共用同一个地址（地址格式通用）
 * - TRON 使用独立派生路径，地址格式为 T... (base58check)
 * - 充值和提现使用不同的 account 路径，互不干扰
 */
@Injectable()
export class HdWalletService implements OnModuleInit {
  private readonly logger = new Logger(HdWalletService.name);
  private hdNode: ethers.HDNodeWallet | null = null;
  private isInitialized = false;

  // 延迟获取 BlockchainService，避免循环依赖
  private blockchainService: { addAddressToCache: (address: string, userId: string) => void } | null = null;

  // EVM 充值地址派生路径 (BIP-44: m/44'/60'/0'/0/)
  private readonly EVM_DEPOSIT_PATH = "m/44'/60'/0'/0";

  // TRON 充值地址派生路径 (BIP-44: m/44'/195'/0'/0/)
  private readonly TRON_DEPOSIT_PATH = "m/44'/195'/0'/0";

  // 提现中继地址派生路径 (BIP-44: m/44'/60'/1'/0/)
  private readonly RELAY_PATH = "m/44'/60'/1'/0";

  constructor(
    private prisma: PrismaService,
    private moduleRef: ModuleRef,
  ) {}

  async onModuleInit() {
    // 延迟获取 BlockchainService，此时所有模块已加载完毕，不会循环
    try {
      const { BlockchainService } = require('./blockchain.service');
      this.blockchainService = this.moduleRef.get(BlockchainService, { strict: false });
    } catch {
      this.logger.warn('BlockchainService 缓存连接失败（不影响地址生成）');
    }

    await this.initialize();
  }

  /**
   * 初始化 HD 钱包
   */
  private async initialize(): Promise<void> {
    const mnemonic = process.env.HD_WALLET_MNEMONIC;

    if (!mnemonic) {
      this.logger.warn(
        'HD 钱包助记词未配置（HD_WALLET_MNEMONIC），充值地址将无法生成',
      );
      return;
    }

    try {
      const mnemonicObj = ethers.Mnemonic.fromPhrase(mnemonic.trim());
      // 从种子创建根节点（depth=0），以便支持任意 BIP-44 派生路径
      // 注意：fromMnemonic() 默认返回 m/44'/60'/0'/0/0 (depth=5)，无法再用 m/ 前缀路径
      this.hdNode = ethers.HDNodeWallet.fromSeed(mnemonicObj.computeSeed());
      this.isInitialized = true;
      this.logger.log('HD 钱包已初始化（根节点）');
    } catch (error) {
      this.logger.error(`HD 钱包初始化失败: ${error.message}`);
    }
  }

  /**
   * 判断是否为 EVM 兼容链
   */
  static isEvmChain(chain: string): boolean {
    return EVM_CHAINS.includes(chain.toUpperCase());
  }

  /**
   * 派生 EVM 充值地址 (coin type 60)
   */
  deriveAddress(index: number): {
    address: string;
    privateKey: string;
    derivationPath: string;
  } {
    if (!this.hdNode) {
      throw new Error('HD 钱包未初始化');
    }

    const derivationPath = `${this.EVM_DEPOSIT_PATH}/${index}`;
    const childWallet = this.hdNode.derivePath(derivationPath);

    return {
      address: childWallet.address,
      privateKey: childWallet.privateKey,
      derivationPath,
    };
  }

  /**
   * 派生 TRON 充值地址 (coin type 195)
   * 从 EVM 私钥生成 TRON base58check 地址
   */
  deriveTronAddress(index: number): {
    address: string;
    privateKey: string;
    derivationPath: string;
  } {
    if (!this.hdNode) {
      throw new Error('HD 钱包未初始化');
    }

    const derivationPath = `${this.TRON_DEPOSIT_PATH}/${index}`;
    const childWallet = this.hdNode.derivePath(derivationPath);

    // 将 EVM 格式地址转为 TRON base58check 格式
    const tronAddress = HdWalletService.evmToTronAddress(childWallet.address);

    return {
      address: tronAddress,
      privateKey: childWallet.privateKey,
      derivationPath,
    };
  }

  /**
   * 派生提现中继地址 (account=1)
   * 用于隐藏热钱包，用户只看到中继地址
   */
  deriveRelayAddress(index: number): {
    address: string;
    privateKey: string;
    derivationPath: string;
  } {
    if (!this.hdNode) {
      throw new Error('HD 钱包未初始化');
    }

    const derivationPath = `${this.RELAY_PATH}/${index}`;
    const childWallet = this.hdNode.derivePath(derivationPath);

    return {
      address: childWallet.address,
      privateKey: childWallet.privateKey,
      derivationPath,
    };
  }

  /**
   * 获取下一个可用的派生索引
   * 从数据库中查询当前最大的 derivationIndex，+1
   */
  async getNextIndex(): Promise<number> {
    const maxRecord = await this.prisma.depositAddress.findFirst({
      orderBy: { derivationIndex: 'desc' },
      select: { derivationIndex: true },
    });

    return (maxRecord?.derivationIndex ?? -1) + 1;
  }

  /**
   * 为用户生成新的充值地址
   * - EVM 链: 使用 EVM 派生路径，地址格式 0x...
   * - TRON:   使用 TRON 派生路径，地址格式 T...
   */
  async generateDepositAddress(
    userId: string,
    chain: string,
    asset: string,
  ): Promise<{ address: string; derivationIndex: number }> {
    if (!this.isInitialized) {
      throw new Error('HD 钱包未初始化，请检查 HD_WALLET_MNEMONIC 配置');
    }

    // 获取下一个索引
    const nextIndex = await this.getNextIndex();

    // 根据链类型派生地址
    const isTron = chain === 'TRON';
    const derived = isTron
      ? this.deriveTronAddress(nextIndex)
      : this.deriveAddress(nextIndex);

    // TRON 地址区分大小写，EVM 地址统一小写
    const normalizedAddress = isTron
      ? derived.address
      : derived.address.toLowerCase();

    // 将当前用户+链+资产的旧地址标记为非当前
    await this.prisma.depositAddress.updateMany({
      where: { userId, chain, asset, isCurrent: true },
      data: { isCurrent: false },
    });

    // 保存新地址到数据库
    await this.prisma.depositAddress.create({
      data: {
        userId,
        chain,
        asset,
        address: normalizedAddress,
        derivationIndex: nextIndex,
        isCurrent: true,
      },
    });

    // 更新 BlockchainService 的内存缓存
    this.blockchainService?.addAddressToCache(normalizedAddress, userId);

    this.logger.log(
      `为用户 ${userId} 生成充值地址: ${normalizedAddress} (index: ${nextIndex}, chain: ${chain})`,
    );

    return { address: normalizedAddress, derivationIndex: nextIndex };
  }

  /**
   * 获取 EVM 充值派生地址的私钥（用于 EVM 归集）
   */
  getPrivateKeyByIndex(index: number): string {
    if (!this.hdNode) {
      throw new Error('HD 钱包未初始化');
    }

    const { privateKey } = this.deriveAddress(index);
    return privateKey;
  }

  /**
   * 获取 TRON 充值派生地址的私钥（用于 TRON 归集）
   */
  getTronPrivateKeyByIndex(index: number): string {
    if (!this.hdNode) {
      throw new Error('HD 钱包未初始化');
    }

    const { privateKey } = this.deriveTronAddress(index);
    return privateKey;
  }

  /**
   * 获取提现中继地址的私钥
   */
  getRelayPrivateKeyByIndex(index: number): string {
    if (!this.hdNode) {
      throw new Error('HD 钱包未初始化');
    }

    const { privateKey } = this.deriveRelayAddress(index);
    return privateKey;
  }

  /**
   * 检查是否已初始化
   */
  getIsInitialized(): boolean {
    return this.isInitialized;
  }

  /**
   * 将 EVM 地址 (0x...) 转为 TRON 地址 (T...)
   * TRON 地址 = base58check(0x41 + 20字节地址)
   */
  static evmToTronAddress(evmAddress: string): string {
    // 0x41 前缀代表 TRON 主网
    const rawHex = '41' + evmAddress.slice(2).toLowerCase();
    const rawBytes = Buffer.from(rawHex, 'hex');

    // 双重 SHA256 计算校验码
    const hash1 = createHash('sha256').update(rawBytes).digest();
    const hash2 = createHash('sha256').update(hash1).digest();
    const checksum = hash2.slice(0, 4);

    // 拼接原始字节 + 校验码，base58 编码
    const full = Buffer.concat([rawBytes, checksum]);
    return ethers.encodeBase58(full);
  }

  /**
   * 将 TRON base58 地址 (T...) 转为 hex 格式 (41...)
   * 用于 TronGrid API 调用
   */
  static tronBase58ToHex(base58Address: string): string {
    const decoded = ethers.decodeBase58(base58Address);
    // base58 解码后: 21 字节地址(41+20) + 4 字节校验码 = 25 字节 = 50 hex chars
    const fullHex = decoded.toString(16).padStart(50, '0');
    return fullHex.slice(0, 42); // 取前 42 个字符 (41 + 20 字节地址)
  }

  /**
   * 将 TRON hex 地址 (41...) 转为 base58 格式 (T...)
   * 用于区块链监听时转换事件中的地址格式
   */
  static tronHexToBase58(hexAddress: string): string {
    // 去掉可能的 0x 前缀
    const cleanHex = hexAddress.startsWith('0x') ? hexAddress.slice(2) : hexAddress;
    const rawBytes = Buffer.from(cleanHex, 'hex');

    const hash1 = createHash('sha256').update(rawBytes).digest();
    const hash2 = createHash('sha256').update(hash1).digest();
    const checksum = hash2.slice(0, 4);

    const full = Buffer.concat([rawBytes, checksum]);
    return ethers.encodeBase58(full);
  }
}
