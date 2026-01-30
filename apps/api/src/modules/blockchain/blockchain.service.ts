import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ethers, Contract, EventLog } from 'ethers';
import { PrismaService } from '../../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';

// ERC-20 Transfer 事件 ABI
const ERC20_ABI = [
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
];

// 监控配置
interface TokenConfig {
  address: string;
  symbol: string;
  decimals: number;
}

@Injectable()
export class BlockchainService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BlockchainService.name);
  private provider: ethers.JsonRpcProvider | null = null;
  private contracts: Map<string, Contract> = new Map();
  private isListening = false;

  // 支持的代币配置
  private readonly tokenConfigs: TokenConfig[] = [];

  constructor(
    private prisma: PrismaService,
    private walletService: WalletService,
  ) {}

  async onModuleInit() {
    if (process.env.ENABLE_BLOCKCHAIN_LISTENER !== 'true') {
      this.logger.log('区块链监听器已禁用（设置 ENABLE_BLOCKCHAIN_LISTENER=true 启用）');
      return;
    }

    await this.initializeProvider();
    await this.loadTokenConfigs();
    await this.startListening();
  }

  async onModuleDestroy() {
    await this.stopListening();
  }

  /**
   * 初始化 RPC Provider
   */
  private async initializeProvider(): Promise<void> {
    const rpcUrl = process.env.BSC_RPC_URL || 'https://bsc-dataseed1.binance.org';

    try {
      this.provider = new ethers.JsonRpcProvider(rpcUrl);
      const network = await this.provider.getNetwork();
      this.logger.log(`已连接到区块链网络: ${network.name} (chainId: ${network.chainId})`);
    } catch (error) {
      this.logger.error(`连接区块链失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 加载代币配置
   */
  private async loadTokenConfigs(): Promise<void> {
    // BSC 主网 USDT
    const usdtAddress = process.env.USDT_CONTRACT_ADDRESS || '0x55d398326f99059fF775485246999027B3197955';
    // HOOT 代币地址（需要部署后配置）
    const hootAddress = process.env.HOOT_CONTRACT_ADDRESS;

    // USDT
    this.tokenConfigs.push({
      address: usdtAddress,
      symbol: 'USDT',
      decimals: 18,
    });

    // HOOT（如果配置了）
    if (hootAddress) {
      this.tokenConfigs.push({
        address: hootAddress,
        symbol: 'HOOT',
        decimals: 18,
      });
    }

    this.logger.log(`加载了 ${this.tokenConfigs.length} 个代币配置`);
  }

  /**
   * 开始监听
   */
  async startListening(): Promise<void> {
    if (!this.provider || this.isListening) return;

    this.isListening = true;
    this.logger.log('开始监听区块链事件...');

    for (const config of this.tokenConfigs) {
      await this.listenToToken(config);
    }
  }

  /**
   * 停止监听
   */
  async stopListening(): Promise<void> {
    this.isListening = false;

    for (const contract of this.contracts.values()) {
      contract.removeAllListeners();
    }
    this.contracts.clear();

    this.logger.log('已停止区块链监听');
  }

  /**
   * 监听单个代币的 Transfer 事件
   */
  private async listenToToken(config: TokenConfig): Promise<void> {
    if (!this.provider) return;

    const contract = new Contract(config.address, ERC20_ABI, this.provider);
    this.contracts.set(config.address, contract);

    // 监听 Transfer 事件
    contract.on('Transfer', async (from: string, to: string, value: bigint, event: EventLog) => {
      await this.handleTransferEvent(config, from, to, value, event);
    });

    this.logger.log(`监听 ${config.symbol} Transfer 事件: ${config.address}`);
  }

  /**
   * 处理 Transfer 事件
   */
  private async handleTransferEvent(
    config: TokenConfig,
    from: string,
    to: string,
    value: bigint,
    event: EventLog,
  ): Promise<void> {
    const txHash = event.transactionHash;
    const amount = ethers.formatUnits(value, config.decimals);

    this.logger.debug(`检测到 ${config.symbol} 转账: ${from} -> ${to}, 金额: ${amount}`);

    try {
      // 查找是否是平台充值地址
      const depositAddress = await this.prisma.depositAddress.findFirst({
        where: {
          address: to.toLowerCase(),
          asset: config.symbol,
        },
      });

      if (!depositAddress) {
        // 不是平台地址，忽略
        return;
      }

      this.logger.log(`检测到用户 ${depositAddress.userId} 充值: ${amount} ${config.symbol}`);

      // 调用钱包服务处理充值
      await this.walletService.increaseBalance(
        depositAddress.userId,
        config.symbol as 'USDT' | 'HOOT',
        amount,
        txHash,
      );

      this.logger.log(`充值处理完成: ${txHash}`);
    } catch (error) {
      this.logger.error(`处理充值失败: ${error.message}`, error.stack);
    }
  }

  /**
   * 手动扫描历史区块（用于补漏）
   */
  async scanHistoricalBlocks(
    fromBlock: number,
    toBlock: number,
    tokenSymbol?: string,
  ): Promise<{ processed: number; errors: number }> {
    if (!this.provider) {
      throw new Error('Provider 未初始化');
    }

    let processed = 0;
    let errors = 0;

    const configs = tokenSymbol
      ? this.tokenConfigs.filter((c) => c.symbol === tokenSymbol)
      : this.tokenConfigs;

    for (const config of configs) {
      const contract = new Contract(config.address, ERC20_ABI, this.provider);

      // 获取所有平台充值地址
      const depositAddresses = await this.prisma.depositAddress.findMany({
        where: { asset: config.symbol },
        select: { address: true, userId: true },
      });

      if (depositAddresses.length === 0) continue;

      const addressMap = new Map(
        depositAddresses.map((d) => [d.address.toLowerCase(), d.userId]),
      );

      this.logger.log(
        `扫描 ${config.symbol} 历史区块 ${fromBlock} - ${toBlock}`,
      );

      try {
        // 查询 Transfer 事件
        const filter = contract.filters.Transfer();
        const events = await contract.queryFilter(filter, fromBlock, toBlock);

        for (const event of events) {
          if (!(event instanceof EventLog)) continue;

          const [from, to, value] = event.args as unknown as [string, string, bigint];
          const toAddress = to.toLowerCase();

          // 检查是否是充值到平台地址
          const userId = addressMap.get(toAddress);
          if (!userId) continue;

          const amount = ethers.formatUnits(value, config.decimals);

          try {
            await this.walletService.increaseBalance(
              userId,
              config.symbol as 'USDT' | 'HOOT',
              amount,
              event.transactionHash,
            );
            processed++;
          } catch (error) {
            this.logger.error(
              `处理历史交易失败: ${event.transactionHash} - ${error.message}`,
            );
            errors++;
          }
        }
      } catch (error) {
        this.logger.error(`扫描区块失败: ${error.message}`);
        errors++;
      }
    }

    this.logger.log(`历史扫描完成: 处理 ${processed} 笔，错误 ${errors} 笔`);
    return { processed, errors };
  }

  /**
   * 获取当前区块高度
   */
  async getCurrentBlockNumber(): Promise<number> {
    if (!this.provider) {
      throw new Error('Provider 未初始化');
    }
    return this.provider.getBlockNumber();
  }

  /**
   * 检查监听状态
   */
  getStatus(): {
    isConnected: boolean;
    isListening: boolean;
    monitoredTokens: string[];
  } {
    return {
      isConnected: !!this.provider,
      isListening: this.isListening,
      monitoredTokens: this.tokenConfigs.map((c) => c.symbol),
    };
  }
}
