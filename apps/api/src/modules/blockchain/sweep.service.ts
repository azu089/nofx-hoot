import { Injectable, Logger } from '@nestjs/common';
import { ethers, Contract, Wallet } from 'ethers';
import { PrismaService } from '../../prisma/prisma.service';
import { HdWalletService } from './hd-wallet.service';
import { BlockchainService } from './blockchain.service';

// ERC-20 ABI（转账 + 查余额）
const ERC20_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
];

export interface SweepResult {
  chain: string;
  address: string;
  asset: string;
  amount: string;
  txHash?: string;
  success: boolean;
  error?: string;
}

/**
 * 资金归集服务（多链）
 *
 * 将用户充值地址（HD 派生地址）的资金归集到热钱包
 *
 * EVM 链 (BSC/ETH/Polygon):
 * 1. 查询派生地址的 ERC-20 余额
 * 2. 先从热钱包打原生 Gas 代币（BNB/ETH/MATIC）
 * 3. 用派生地址私钥签名 ERC-20 转账到热钱包
 *
 * TRON:
 * 1. 查询派生地址的 TRC20 USDT 余额
 * 2. 先从热钱包打 TRX（用于能量/带宽费用）
 * 3. 用派生地址私钥签名 TRC20 转账到热钱包
 *
 * 触发方式：管理员手动触发或定时任务
 */
@Injectable()
export class SweepService {
  private readonly logger = new Logger(SweepService.name);

  // 最小归集金额（低于此金额不值得归集）
  private readonly MIN_SWEEP_AMOUNT = '1'; // 1 USDT

  // EVM 链 Gas 费预估（从热钱包发送给派生地址用于 ERC-20 转账）
  private readonly EVM_GAS_FUND: Record<
    string,
    { amount: string; symbol: string }
  > = {
    BSC: { amount: '0.0003', symbol: 'BNB' },
    ETH: { amount: '0.005', symbol: 'ETH' },
    POLYGON: { amount: '0.01', symbol: 'MATIC' },
  };

  // TRON 归集 Gas 费（30 TRX = 30,000,000 SUN，用于能量/带宽）
  private readonly TRON_GAS_FUND_SUN = parseInt(
    process.env.TRON_SWEEP_GAS_AMOUNT || '30000000',
    10,
  );

  constructor(
    private prisma: PrismaService,
    private hdWalletService: HdWalletService,
    private blockchainService: BlockchainService,
  ) {}

  // ==================== 扫描余额 ====================

  /**
   * 扫描所有派生地址余额（多链）
   * 按链分组，返回有余额的地址列表
   */
  async scanBalances(): Promise<
    {
      chain: string;
      address: string;
      derivationIndex: number;
      userId: string;
      balances: { asset: string; amount: string }[];
    }[]
  > {
    // 查询所有活跃的派生地址
    const addresses = await this.prisma.depositAddress.findMany({
      where: { isActive: true, derivationIndex: { gte: 0 } },
      select: {
        address: true,
        derivationIndex: true,
        userId: true,
        chain: true,
        asset: true,
      },
    });

    // 按链分组（同一链同一地址去重）
    const chainAddresses = new Map<
      string,
      Map<string, { derivationIndex: number; userId: string }>
    >();

    for (const addr of addresses) {
      const chain = (addr.chain || 'BSC').toUpperCase();
      if (!chainAddresses.has(chain)) {
        chainAddresses.set(chain, new Map());
      }
      const chainMap = chainAddresses.get(chain)!;
      if (!chainMap.has(addr.address) && addr.userId) {
        chainMap.set(addr.address, {
          derivationIndex: addr.derivationIndex,
          userId: addr.userId,
        });
      }
    }

    const results: {
      chain: string;
      address: string;
      derivationIndex: number;
      userId: string;
      balances: { asset: string; amount: string }[];
    }[] = [];

    // 逐链扫描
    for (const [chain, addrMap] of chainAddresses) {
      if (chain === 'TRON') {
        await this.scanTronBalances(addrMap, results);
      } else {
        await this.scanEvmBalances(chain, addrMap, results);
      }
    }

    this.logger.log(
      `多链扫描完成: ${addresses.length} 个地址，${results.length} 个有余额`,
    );

    return results;
  }

  /**
   * 扫描 EVM 链地址余额
   */
  private async scanEvmBalances(
    chain: string,
    addrMap: Map<string, { derivationIndex: number; userId: string }>,
    results: any[],
  ): Promise<void> {
    const provider = this.blockchainService.getProviderByChain(chain);
    if (!provider) {
      this.logger.warn(`[${chain}] Provider 未初始化，跳过扫描`);
      return;
    }

    const tokenConfigs = this.blockchainService.getTokenConfigsByChain(chain);
    if (tokenConfigs.length === 0) return;

    for (const [address, info] of addrMap) {
      const balances: { asset: string; amount: string }[] = [];

      for (const token of tokenConfigs) {
        try {
          const contract = new Contract(token.address, ERC20_ABI, provider);
          const balance = await contract.balanceOf(address);
          const amount = ethers.formatUnits(balance, token.decimals);

          if (parseFloat(amount) >= parseFloat(this.MIN_SWEEP_AMOUNT)) {
            balances.push({ asset: token.symbol, amount });
          }
        } catch (error) {
          this.logger.error(
            `[${chain}] 查询余额失败 ${address} ${token.symbol}: ${error.message}`,
          );
        }
      }

      if (balances.length > 0) {
        results.push({
          chain,
          address,
          derivationIndex: info.derivationIndex,
          userId: info.userId,
          balances,
        });
      }
    }
  }

  /**
   * 扫描 TRON 地址余额
   */
  private async scanTronBalances(
    addrMap: Map<string, { derivationIndex: number; userId: string }>,
    results: any[],
  ): Promise<void> {
    const tronConfig = this.blockchainService.getTronConfig();
    if (!tronConfig) {
      this.logger.warn('[TRON] 未配置，跳过扫描');
      return;
    }

    for (const [address, info] of addrMap) {
      try {
        // 将 base58 地址转为 hex
        const addressHex = HdWalletService.tronBase58ToHex(address);
        const address20 = '0x' + addressHex.slice(2);

        // 查询 TRC20 USDT 余额
        const parameter = ethers.AbiCoder.defaultAbiCoder()
          .encode(['address'], [address20])
          .slice(2);

        const usdtHex = HdWalletService.tronBase58ToHex(
          tronConfig.usdtAddress,
        );

        const balanceResult = await this.tronApiCall(
          tronConfig,
          '/wallet/triggerconstantcontract',
          {
            owner_address: addressHex,
            contract_address: usdtHex,
            function_selector: 'balanceOf(address)',
            parameter,
            visible: false,
          },
        );

        if (balanceResult?.constant_result?.[0]) {
          const rawValue = BigInt('0x' + balanceResult.constant_result[0]);
          const amount = (Number(rawValue) / 1_000_000).toFixed(6); // TRC20 USDT 精度 6

          if (parseFloat(amount) >= parseFloat(this.MIN_SWEEP_AMOUNT)) {
            results.push({
              chain: 'TRON',
              address,
              derivationIndex: info.derivationIndex,
              userId: info.userId,
              balances: [{ asset: 'USDT', amount }],
            });
          }
        }
      } catch (error) {
        this.logger.error(
          `[TRON] 查询余额失败 ${address}: ${error.message}`,
        );
      }
    }
  }

  // ==================== EVM 归集 ====================

  /**
   * 执行 EVM 链归集（BSC/ETH/Polygon 通用）
   */
  async sweepEvmAddress(
    chain: string,
    derivationIndex: number,
    tokenAddress: string,
    tokenSymbol: string,
    decimals: number,
  ): Promise<SweepResult> {
    const provider = this.blockchainService.getProviderByChain(chain);
    const hotWalletKey = process.env.WITHDRAW_WALLET_PRIVATE_KEY;
    const hotWalletAddress = process.env.HOT_WALLET_ADDRESS;

    if (!provider || !hotWalletKey || !hotWalletAddress) {
      return {
        chain,
        address: '',
        asset: tokenSymbol,
        amount: '0',
        success: false,
        error: `[${chain}] 归集配置不完整`,
      };
    }

    // 获取派生地址的私钥
    const childPrivateKey =
      this.hdWalletService.getPrivateKeyByIndex(derivationIndex);
    const childWallet = new Wallet(childPrivateKey, provider);
    const childAddress = childWallet.address;

    // Gas 配置
    const gasConfig = this.EVM_GAS_FUND[chain] || {
      amount: '0.001',
      symbol: chain,
    };

    try {
      // 1. 查询代币余额
      const tokenContract = new Contract(tokenAddress, ERC20_ABI, provider);
      const balance = await tokenContract.balanceOf(childAddress);
      const amount = ethers.formatUnits(balance, decimals);

      if (balance === BigInt(0)) {
        return {
          chain,
          address: childAddress,
          asset: tokenSymbol,
          amount: '0',
          success: true,
          error: '余额为0，无需归集',
        };
      }

      // 2. 检查 Gas 余额
      const gasBalance = await provider.getBalance(childAddress);
      const requiredGas = ethers.parseEther(gasConfig.amount);

      if (gasBalance < requiredGas) {
        // 从热钱包打 Gas 费
        this.logger.log(
          `[${chain}] 为 ${childAddress} 充值 ${gasConfig.amount} ${gasConfig.symbol} Gas...`,
        );
        const hotWallet = new Wallet(hotWalletKey, provider);

        const gasTx = await hotWallet.sendTransaction({
          to: childAddress,
          value: requiredGas,
        });
        await gasTx.wait();
        this.logger.log(`[${chain}] Gas 费已到账: ${gasTx.hash}`);
      }

      // 3. 从派生地址转 ERC-20 到热钱包
      const childTokenContract = new Contract(
        tokenAddress,
        ERC20_ABI,
        childWallet,
      );

      this.logger.log(
        `[${chain}] 归集 ${amount} ${tokenSymbol}: ${childAddress} → ${hotWalletAddress}`,
      );

      const tx = await childTokenContract.transfer(hotWalletAddress, balance);
      const receipt = await tx.wait();

      this.logger.log(`[${chain}] 归集成功: ${receipt.hash}`);

      return {
        chain,
        address: childAddress,
        asset: tokenSymbol,
        amount,
        txHash: receipt.hash,
        success: true,
      };
    } catch (error) {
      this.logger.error(
        `[${chain}] 归集失败 ${childAddress}: ${error.message}`,
      );
      return {
        chain,
        address: childAddress,
        asset: tokenSymbol,
        amount: '0',
        success: false,
        error: error.message,
      };
    }
  }

  // ==================== TRON 归集 ====================

  /**
   * 执行 TRON 归集（TRC20 转账到热钱包）
   */
  async sweepTronAddress(
    derivationIndex: number,
    amount: string,
  ): Promise<SweepResult> {
    const tronConfig = this.blockchainService.getTronConfig();
    const hotWalletKey = process.env.WITHDRAW_WALLET_PRIVATE_KEY;

    if (!tronConfig || !hotWalletKey) {
      return {
        chain: 'TRON',
        address: '',
        asset: 'USDT',
        amount: '0',
        success: false,
        error: '[TRON] 归集配置不完整',
      };
    }

    // 获取 TRON 派生地址
    const childPrivateKey =
      this.hdWalletService.getTronPrivateKeyByIndex(derivationIndex);
    const { address: childBase58 } =
      this.hdWalletService.deriveTronAddress(derivationIndex);
    const childHex = HdWalletService.tronBase58ToHex(childBase58);

    // 热钱包 TRON 地址（优先使用独立配置，回退到从 EVM 私钥派生）
    const evmWallet = new Wallet(hotWalletKey);
    const hotTronBase58 = process.env.TRON_HOT_WALLET_ADDRESS
      || HdWalletService.evmToTronAddress(evmWallet.address);
    const hotTronHex = process.env.TRON_HOT_WALLET_ADDRESS
      ? HdWalletService.tronBase58ToHex(process.env.TRON_HOT_WALLET_ADDRESS)
      : '41' + evmWallet.address.slice(2).toLowerCase();

    const usdtHex = HdWalletService.tronBase58ToHex(tronConfig.usdtAddress);

    try {
      // 1. 检查子地址 TRX 余额（用于能量/带宽）
      const accountResult = await this.tronApiCall(
        tronConfig,
        '/wallet/getaccount',
        {
          address: childHex,
          visible: false,
        },
      );

      const trxBalance = accountResult?.balance || 0;

      if (trxBalance < this.TRON_GAS_FUND_SUN) {
        // 从热钱包发送 TRX 作为 Gas 费
        const sendAmount = this.TRON_GAS_FUND_SUN - trxBalance;
        this.logger.log(
          `[TRON] 为 ${childBase58} 充值 ${sendAmount / 1_000_000} TRX Gas...`,
        );

        await this.sendTrx(
          tronConfig,
          hotTronHex,
          hotWalletKey,
          childHex,
          sendAmount,
        );

        // 等待交易确认
        await this.delay(5000);
      }

      // 2. 构建 TRC20 转账交易（从子地址 → 热钱包）
      const amountSun = BigInt(
        Math.round(parseFloat(amount) * 1_000_000),
      );

      const hotAddress20 = '0x' + hotTronHex.slice(2);
      const parameter = ethers.AbiCoder.defaultAbiCoder()
        .encode(['address', 'uint256'], [hotAddress20, amountSun])
        .slice(2);

      const triggerResult = await this.tronApiCall(
        tronConfig,
        '/wallet/triggersmartcontract',
        {
          owner_address: childHex,
          contract_address: usdtHex,
          function_selector: 'transfer(address,uint256)',
          parameter,
          fee_limit: 100_000_000, // 100 TRX
          call_value: 0,
          visible: false,
        },
      );

      if (!triggerResult?.result?.result || !triggerResult?.transaction) {
        const errMsg = triggerResult?.result?.message
          ? Buffer.from(triggerResult.result.message, 'hex').toString()
          : '构建 TRON 归集交易失败';
        return {
          chain: 'TRON',
          address: childBase58,
          asset: 'USDT',
          amount,
          success: false,
          error: errMsg,
        };
      }

      const transaction = triggerResult.transaction;
      const txID = transaction.txID;

      // 3. 用子地址私钥签名
      const childKeyHex = childPrivateKey.startsWith('0x')
        ? childPrivateKey.slice(2)
        : childPrivateKey;
      const signingKey = new ethers.SigningKey('0x' + childKeyHex);
      const signature = signingKey.sign(ethers.getBytes('0x' + txID));

      const signatureHex =
        signature.r.slice(2) +
        signature.s.slice(2) +
        signature.yParity.toString(16).padStart(2, '0');

      transaction.signature = [signatureHex];

      // 4. 广播交易
      const broadcastResult = await this.tronApiCall(
        tronConfig,
        '/wallet/broadcasttransaction',
        transaction,
      );

      if (!broadcastResult?.result) {
        return {
          chain: 'TRON',
          address: childBase58,
          asset: 'USDT',
          amount,
          success: false,
          error: broadcastResult?.message || '广播 TRON 归集交易失败',
        };
      }

      this.logger.log(
        `[TRON] 归集成功: ${amount} USDT ${childBase58} → ${hotTronBase58}, tx=${txID}`,
      );

      return {
        chain: 'TRON',
        address: childBase58,
        asset: 'USDT',
        amount,
        txHash: txID,
        success: true,
      };
    } catch (error) {
      this.logger.error(
        `[TRON] 归集失败 ${childBase58}: ${error.message}`,
      );
      return {
        chain: 'TRON',
        address: childBase58,
        asset: 'USDT',
        amount: '0',
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 发送 TRX（热钱包 → 子地址，用于 Gas）
   */
  private async sendTrx(
    tronConfig: { apiUrl: string; apiKey: string },
    fromHex: string,
    fromPrivateKey: string,
    toHex: string,
    amountSun: number,
  ): Promise<string> {
    // 构建 TRX 转账交易
    const txResult = await this.tronApiCall(
      tronConfig,
      '/wallet/createtransaction',
      {
        owner_address: fromHex,
        to_address: toHex,
        amount: amountSun,
        visible: false,
      },
    );

    if (!txResult?.txID) {
      throw new Error('构建 TRX 转账交易失败');
    }

    // 签名
    const keyHex = fromPrivateKey.startsWith('0x')
      ? fromPrivateKey.slice(2)
      : fromPrivateKey;
    const signingKey = new ethers.SigningKey('0x' + keyHex);
    const signature = signingKey.sign(
      ethers.getBytes('0x' + txResult.txID),
    );

    const signatureHex =
      signature.r.slice(2) +
      signature.s.slice(2) +
      signature.yParity.toString(16).padStart(2, '0');

    txResult.signature = [signatureHex];

    // 广播
    const broadcastResult = await this.tronApiCall(
      tronConfig,
      '/wallet/broadcasttransaction',
      txResult,
    );

    if (!broadcastResult?.result) {
      throw new Error(broadcastResult?.message || '广播 TRX 转账失败');
    }

    this.logger.log(`[TRON] TRX Gas 已发送: ${txResult.txID}`);
    return txResult.txID;
  }

  // ==================== 全量归集 ====================

  /**
   * 执行全量归集（扫描所有链、所有地址并归集）
   */
  async sweepAll(): Promise<{
    results: SweepResult[];
    totalSwept: number;
    totalFailed: number;
  }> {
    const results: SweepResult[] = [];
    let totalSwept = 0;
    let totalFailed = 0;

    // 扫描有余额的地址
    const addressesWithBalance = await this.scanBalances();

    if (addressesWithBalance.length === 0) {
      this.logger.log('没有需要归集的地址');
      return { results, totalSwept: 0, totalFailed: 0 };
    }

    for (const addr of addressesWithBalance) {
      for (const balance of addr.balances) {
        let result: SweepResult;

        if (addr.chain === 'TRON') {
          result = await this.sweepTronAddress(
            addr.derivationIndex,
            balance.amount,
          );
        } else {
          // EVM 链
          const tokenConfigs =
            this.blockchainService.getTokenConfigsByChain(addr.chain);
          const tokenConfig = tokenConfigs.find(
            (t) => t.symbol === balance.asset,
          );
          if (!tokenConfig) {
            results.push({
              chain: addr.chain,
              address: addr.address,
              asset: balance.asset,
              amount: balance.amount,
              success: false,
              error: `代币 ${balance.asset} 在链 ${addr.chain} 上未配置`,
            });
            totalFailed++;
            continue;
          }

          result = await this.sweepEvmAddress(
            addr.chain,
            addr.derivationIndex,
            tokenConfig.address,
            tokenConfig.symbol,
            tokenConfig.decimals,
          );
        }

        results.push(result);

        if (result.success && result.txHash) {
          totalSwept++;
        } else if (!result.success) {
          totalFailed++;
        }

        // 每笔归集间隔 3 秒，避免 nonce 冲突
        await this.delay(3000);
      }
    }

    this.logger.log(
      `全量归集完成: 成功 ${totalSwept} 笔，失败 ${totalFailed} 笔`,
    );

    return { results, totalSwept, totalFailed };
  }

  // ==================== 工具方法 ====================

  /**
   * TronGrid API 通用调用
   */
  private async tronApiCall(
    config: { apiUrl: string; apiKey: string },
    path: string,
    body: any,
  ): Promise<any> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (config.apiKey) {
      headers['TRON-PRO-API-KEY'] = config.apiKey;
    }

    const response = await fetch(`${config.apiUrl}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`TronGrid API 错误: ${response.status}`);
    }

    return response.json();
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
