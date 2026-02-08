import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { ethers, Contract, EventLog } from 'ethers';
import Decimal from 'decimal.js';
import { PrismaService } from '../../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { HdWalletService } from './hd-wallet.service';

// ERC-20 Transfer 事件 ABI
const ERC20_ABI = [
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function balanceOf(address account) view returns (uint256)',
];

// 代币配置
interface TokenConfig {
  address: string;
  symbol: string;
  decimals: number;
}

// EVM 链配置
interface EvmChainConfig {
  name: string;
  rpcUrl: string;
  tokens: TokenConfig[];
}

// EVM 链运行状态
interface EvmChainState {
  config: EvmChainConfig;
  provider: ethers.JsonRpcProvider;
  contracts: Map<string, Contract>;
}

@Injectable()
export class BlockchainService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BlockchainService.name);

  // 多链 EVM 状态
  private evmChains: Map<string, EvmChainState> = new Map();

  // TRON 轮询
  private tronApiUrl = '';
  private tronApiKey = '';
  private tronUsdtAddress = '';
  private readonly tronUsdtDecimals = 6;
  private tronPollingTimer: NodeJS.Timeout | null = null;
  private tronLastTimestamp = 0;

  private isListening = false;

  // 统一地址缓存: address → userId
  // EVM 地址存为 lowercase，TRON 地址保持原样（base58 区分大小写）
  private depositAddressMap: Map<string, string> = new Map();

  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => WalletService))
    private walletService: WalletService,
  ) {}

  async onModuleInit() {
    // 无论是否启用监听，都加载地址缓存
    await this.loadDepositAddressCache();

    if (process.env.ENABLE_BLOCKCHAIN_LISTENER !== 'true') {
      this.logger.log(
        '区块链监听器已禁用（设置 ENABLE_BLOCKCHAIN_LISTENER=true 启用）',
      );
      return;
    }

    await this.initializeAllChains();
    await this.startListening();
  }

  async onModuleDestroy() {
    await this.stopListening();
  }

  /**
   * 加载所有充值地址到内存缓存
   */
  async loadDepositAddressCache(): Promise<void> {
    const addresses = await this.prisma.depositAddress.findMany({
      where: { isActive: true },
      select: { address: true, userId: true, chain: true },
    });

    this.depositAddressMap.clear();
    for (const addr of addresses) {
      if (addr.chain === 'TRON') {
        // TRON 地址区分大小写
        this.depositAddressMap.set(addr.address, addr.userId);
      } else {
        // EVM 地址统一小写
        this.depositAddressMap.set(addr.address.toLowerCase(), addr.userId);
      }
    }

    this.logger.log(`已加载 ${this.depositAddressMap.size} 个充值地址到缓存`);
  }

  /**
   * 添加新地址到缓存
   */
  addAddressToCache(address: string, userId: string): void {
    this.depositAddressMap.set(address, userId);
  }

  /**
   * 初始化所有链的 Provider
   */
  private async initializeAllChains(): Promise<void> {
    // BSC（必须）
    const bscRpcUrl = process.env.BSC_RPC_URL || 'https://bsc-dataseed1.binance.org';
    const bscUsdtAddr = process.env.BSC_USDT_ADDRESS || process.env.USDT_CONTRACT_ADDRESS || '0x55d398326f99059fF775485246999027B3197955';
    await this.initEvmChain({
      name: 'BSC',
      rpcUrl: bscRpcUrl,
      tokens: [{ address: bscUsdtAddr, symbol: 'USDT', decimals: 18 }],
    });

    // ETH（可选）
    const ethRpcUrl = process.env.ETH_RPC_URL;
    if (ethRpcUrl) {
      const ethUsdtAddr = process.env.ETH_USDT_ADDRESS || '0xdAC17F958D2ee523a2206206994597C13D831ec7';
      await this.initEvmChain({
        name: 'ETH',
        rpcUrl: ethRpcUrl,
        tokens: [{ address: ethUsdtAddr, symbol: 'USDT', decimals: 6 }],
      });
    } else {
      this.logger.warn('ETH 监听未启用（未配置 ETH_RPC_URL）');
    }

    // Polygon（可选）
    const polygonRpcUrl = process.env.POLYGON_RPC_URL;
    if (polygonRpcUrl) {
      const polygonUsdtAddr = process.env.POLYGON_USDT_ADDRESS || '0xc2132D05D31c914a87C6611C10748AEb04B58e8F';
      await this.initEvmChain({
        name: 'POLYGON',
        rpcUrl: polygonRpcUrl,
        tokens: [{ address: polygonUsdtAddr, symbol: 'USDT', decimals: 6 }],
      });
    } else {
      this.logger.warn('Polygon 监听未启用（未配置 POLYGON_RPC_URL）');
    }

    // HOOT 代币（BSC 上，如果配置了）
    const hootAddress = process.env.HOOT_CONTRACT_ADDRESS;
    if (hootAddress && this.evmChains.has('BSC')) {
      const bscState = this.evmChains.get('BSC')!;
      bscState.config.tokens.push({ address: hootAddress, symbol: 'HOOT', decimals: 18 });
    }

    // TRON（可选）
    this.tronApiUrl = process.env.TRON_API_URL || '';
    this.tronApiKey = process.env.TRON_API_KEY || '';
    this.tronUsdtAddress = process.env.TRON_USDT_ADDRESS || 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';

    if (this.tronApiUrl) {
      this.logger.log(`TRON 监听已配置: ${this.tronApiUrl}`);
    } else {
      this.logger.warn('TRON 监听未启用（未配置 TRON_API_URL）');
    }
  }

  /**
   * 初始化单条 EVM 链
   */
  private async initEvmChain(config: EvmChainConfig): Promise<void> {
    try {
      const provider = new ethers.JsonRpcProvider(config.rpcUrl);
      const network = await provider.getNetwork();
      this.logger.log(
        `${config.name} 已连接 (chainId: ${network.chainId})`,
      );

      this.evmChains.set(config.name, {
        config,
        provider,
        contracts: new Map(),
      });
    } catch (error) {
      this.logger.error(`${config.name} 连接失败: ${error.message}`);
    }
  }

  /**
   * 开始监听所有链
   */
  async startListening(): Promise<void> {
    if (this.isListening) return;
    this.isListening = true;
    this.logger.log('开始监听区块链事件...');

    // 启动所有 EVM 链监听
    for (const [chainName, chainState] of this.evmChains) {
      for (const token of chainState.config.tokens) {
        await this.listenToEvmToken(chainName, chainState, token);
      }
    }

    // 启动 TRON 轮询
    if (this.tronApiUrl) {
      this.startTronPolling();
    }
  }

  /**
   * 停止监听
   */
  async stopListening(): Promise<void> {
    this.isListening = false;

    // 停止 EVM 监听
    for (const chainState of this.evmChains.values()) {
      for (const contract of chainState.contracts.values()) {
        contract.removeAllListeners();
      }
      chainState.contracts.clear();
    }

    // 停止 TRON 轮询
    if (this.tronPollingTimer) {
      clearInterval(this.tronPollingTimer);
      this.tronPollingTimer = null;
    }

    this.logger.log('已停止区块链监听');
  }

  // ==================== EVM 监听 ====================

  /**
   * 监听 EVM 链上的代币 Transfer 事件
   */
  private async listenToEvmToken(
    chainName: string,
    chainState: EvmChainState,
    config: TokenConfig,
  ): Promise<void> {
    const contract = new Contract(config.address, ERC20_ABI, chainState.provider);
    chainState.contracts.set(config.address, contract);

    contract.on(
      'Transfer',
      async (from: string, to: string, value: bigint, event: EventLog) => {
        await this.handleEvmTransfer(chainName, config, from, to, value, event);
      },
    );

    this.logger.log(`[${chainName}] 监听 ${config.symbol} Transfer: ${config.address}`);
  }

  /**
   * 处理 EVM Transfer 事件
   */
  private async handleEvmTransfer(
    chainName: string,
    config: TokenConfig,
    from: string,
    to: string,
    value: bigint,
    event: EventLog,
  ): Promise<void> {
    const txHash = event.transactionHash;
    const toAddress = to.toLowerCase();
    const amount = ethers.formatUnits(value, config.decimals);

    // 内存缓存快速查找
    const userId = this.depositAddressMap.get(toAddress);
    if (!userId) return;

    this.logger.log(
      `[${chainName}] 检测到用户 ${userId} 充值: ${amount} ${config.symbol} (tx: ${txHash})`,
    );

    try {
      await this.walletService.increaseBalance(
        userId,
        config.symbol as 'USDT' | 'HOOT',
        amount,
        txHash,
        chainName,
      );
      this.logger.log(`[${chainName}] 充值处理完成: ${txHash}`);
      await this.notifyDeposit(userId, amount, config.symbol, txHash, chainName);
    } catch (error) {
      this.logger.error(`[${chainName}] 处理充值失败: ${error.message}`, error.stack);
    }
  }

  // ==================== TRON 轮询 ====================

  /**
   * 启动 TRON 轮询（每 30 秒检查一次新的 TRC20 转账）
   */
  private startTronPolling(): void {
    // 从当前时间开始监听
    this.tronLastTimestamp = Date.now();

    this.tronPollingTimer = setInterval(async () => {
      try {
        await this.pollTronTransfers();
      } catch (error) {
        this.logger.error(`TRON 轮询异常: ${error.message}`);
      }
    }, 30_000);

    this.logger.log('TRON 轮询已启动（间隔 30 秒）');
  }

  /**
   * 轮询 TRON TRC20 转账事件
   * 使用 TronGrid API 查询 USDT 合约的 Transfer 事件
   */
  private async pollTronTransfers(): Promise<void> {
    const url = `${this.tronApiUrl}/v1/contracts/${this.tronUsdtAddress}/events` +
      `?event_name=Transfer&min_block_timestamp=${this.tronLastTimestamp}&order_by=block_timestamp,asc&limit=200`;

    const headers: Record<string, string> = {
      'Accept': 'application/json',
    };
    if (this.tronApiKey) {
      headers['TRON-PRO-API-KEY'] = this.tronApiKey;
    }

    const response = await fetch(url, { headers });
    if (!response.ok) {
      this.logger.warn(`TronGrid API 错误: ${response.status}`);
      return;
    }

    const data = await response.json() as {
      data: Array<{
        block_timestamp: number;
        transaction_id: string;
        result: {
          from: string;
          to: string;
          value: string;
        };
      }>;
    };

    if (!data.data || data.data.length === 0) return;

    let maxTimestamp = this.tronLastTimestamp;

    for (const event of data.data) {
      const toHex = event.result.to;
      const txHash = event.transaction_id;
      const rawValue = event.result.value;

      // 更新时间戳（+1ms 避免重复）
      if (event.block_timestamp > maxTimestamp) {
        maxTimestamp = event.block_timestamp + 1;
      }

      // 将 TRON hex 地址转为 base58 格式
      let toBase58: string;
      try {
        toBase58 = HdWalletService.tronHexToBase58(toHex);
      } catch {
        continue;
      }

      // 在缓存中查找
      const userId = this.depositAddressMap.get(toBase58);
      if (!userId) continue;

      // 计算金额（TRC20 USDT 精度 6，使用 Decimal 避免精度丢失）
      const amount = new Decimal(rawValue).div(new Decimal(10).pow(this.tronUsdtDecimals)).toFixed(8);

      this.logger.log(
        `[TRON] 检测到用户 ${userId} 充值: ${amount} USDT (tx: ${txHash})`,
      );

      try {
        await this.walletService.increaseBalance(userId, 'USDT', amount, txHash, 'TRON');
        this.logger.log(`[TRON] 充值处理完成: ${txHash}`);
        await this.notifyDeposit(userId, amount, 'USDT', txHash, 'TRON');
      } catch (error) {
        this.logger.error(`[TRON] 处理充值失败: ${error.message}`);
      }
    }

    this.tronLastTimestamp = maxTimestamp;
  }

  // ==================== 通用方法 ====================

  /**
   * 通知用户充值到账
   */
  private async notifyDeposit(
    userId: string,
    amount: string,
    asset: string,
    txHash: string,
    chainName: string,
  ): Promise<void> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { telegramId: true },
      });

      if (!user?.telegramId) return;

      const tgBotUrl =
        process.env.TELEGRAM_BOT_URL || 'http://localhost:3003';

      await fetch(`${tgBotUrl}/send-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegramId: user.telegramId,
          title: '充值到账',
          message: `${amount} ${asset} 已到账 (${chainName})\nTx: ${txHash.slice(0, 16)}...`,
          type: 'deposit',
        }),
      }).catch(() => {
        // TG 通知失败不影响主流程
      });
    } catch {
      // 通知失败不影响主流程
    }
  }

  /**
   * 手动扫描历史区块（仅 EVM 链）
   */
  async scanHistoricalBlocks(
    fromBlock: number,
    toBlock: number,
    tokenSymbol?: string,
    chainName = 'BSC',
  ): Promise<{ processed: number; errors: number }> {
    const chainState = this.evmChains.get(chainName);
    if (!chainState) {
      throw new Error(`链 ${chainName} 未初始化`);
    }

    let processed = 0;
    let errors = 0;

    const configs = tokenSymbol
      ? chainState.config.tokens.filter((c) => c.symbol === tokenSymbol)
      : chainState.config.tokens;

    for (const config of configs) {
      const contract = new Contract(config.address, ERC20_ABI, chainState.provider);

      this.logger.log(
        `[${chainName}] 扫描 ${config.symbol} 历史区块 ${fromBlock} - ${toBlock}`,
      );

      try {
        const filter = contract.filters.Transfer();
        const events = await contract.queryFilter(filter, fromBlock, toBlock);

        for (const event of events) {
          if (!(event instanceof EventLog)) continue;

          const [, to, value] = event.args as unknown as [string, string, bigint];
          const toAddress = to.toLowerCase();
          const userId = this.depositAddressMap.get(toAddress);
          if (!userId) continue;

          const amount = ethers.formatUnits(value, config.decimals);

          try {
            await this.walletService.increaseBalance(
              userId,
              config.symbol as 'USDT' | 'HOOT',
              amount,
              event.transactionHash,
              chainName,
            );
            processed++;
          } catch (error) {
            this.logger.error(
              `[${chainName}] 处理历史交易失败: ${event.transactionHash} - ${error.message}`,
            );
            errors++;
          }
        }
      } catch (error) {
        this.logger.error(`[${chainName}] 扫描区块失败: ${error.message}`);
        errors++;
      }
    }

    this.logger.log(`[${chainName}] 历史扫描完成: 处理 ${processed} 笔，错误 ${errors} 笔`);
    return { processed, errors };
  }

  /**
   * 获取当前区块高度（BSC）
   */
  async getCurrentBlockNumber(): Promise<number> {
    const bscState = this.evmChains.get('BSC');
    if (!bscState) {
      throw new Error('BSC Provider 未初始化');
    }
    return bscState.provider.getBlockNumber();
  }

  /**
   * 获取 Provider（向后兼容，返回 BSC provider）
   */
  getProvider(): ethers.JsonRpcProvider | null {
    return this.evmChains.get('BSC')?.provider || null;
  }

  /**
   * 获取指定链的 Provider
   */
  getProviderByChain(chain: string): ethers.JsonRpcProvider | null {
    return this.evmChains.get(chain.toUpperCase())?.provider || null;
  }

  /**
   * 获取指定链的代币配置
   */
  getTokenConfigsByChain(chain: string): TokenConfig[] {
    return this.evmChains.get(chain.toUpperCase())?.config.tokens || [];
  }

  /**
   * 获取所有已配置的 EVM 链名称
   */
  getEvmChainNames(): string[] {
    return Array.from(this.evmChains.keys());
  }

  /**
   * 获取 TRON 配置信息
   */
  getTronConfig(): { apiUrl: string; apiKey: string; usdtAddress: string } | null {
    if (!this.tronApiUrl) return null;
    return {
      apiUrl: this.tronApiUrl,
      apiKey: this.tronApiKey,
      usdtAddress: this.tronUsdtAddress,
    };
  }

  /**
   * 获取代币配置（所有链合并，向后兼容）
   */
  getTokenConfigs(): TokenConfig[] {
    const all: TokenConfig[] = [];
    for (const chain of this.evmChains.values()) {
      all.push(...chain.config.tokens);
    }
    return all;
  }

  /**
   * 检查监听状态
   */
  getStatus(): {
    isConnected: boolean;
    isListening: boolean;
    chains: { name: string; connected: boolean; tokens: string[] }[];
    tronEnabled: boolean;
    cachedAddresses: number;
  } {
    const chains = Array.from(this.evmChains.entries()).map(([name, state]) => ({
      name,
      connected: true,
      tokens: state.config.tokens.map((t) => t.symbol),
    }));

    return {
      isConnected: this.evmChains.size > 0,
      isListening: this.isListening,
      chains,
      tronEnabled: !!this.tronApiUrl,
      cachedAddresses: this.depositAddressMap.size,
    };
  }
}
