import { Injectable, Logger } from '@nestjs/common';
import { ethers, Wallet, Contract } from 'ethers';
import { PrismaService } from '../../prisma/prisma.service';
import { HdWalletService } from './hd-wallet.service';
import { Prisma } from '@prisma/client';

// 提现请求（含关联用户信息）
type WithdrawRequestWithUser = Prisma.WithdrawRequestGetPayload<{
  include: { user: { select: { id: true; email: true; telegramId: true } } };
}>;
// 不含关联的基础提现请求
type WithdrawRequestBase = Prisma.WithdrawRequestGetPayload<{ include: Record<string, never> }>;

// TronGrid API 响应（松散结构）
interface TronApiResponse {
  result?: { result?: boolean; message?: string };
  transaction?: { txID: string; signature?: string[]; [key: string]: unknown };
  message?: string;
  balance?: number;
  constant_result?: string[];
  [key: string]: unknown;
}

// ERC-20 转账 ABI
const ERC20_TRANSFER_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
];

export interface WithdrawResult {
  success: boolean;
  txHash?: string;
  relayAddress?: string; // 中继地址（用户在链上看到的 from）
  error?: string;
}

// EVM 链提现钱包配置
interface EvmChainWallet {
  provider: ethers.JsonRpcProvider;
  wallet: Wallet;
  gasSymbol: string; // 原生 Gas 代币 (BNB/ETH/MATIC)
  relayGasAmount: string; // 中继 Gas 费预估
  tokens: Map<string, { address: string; decimals: number }>;
}

// TRON 提现钱包配置
interface TronWalletConfig {
  apiUrl: string;
  apiKey: string;
  usdtContractHex: string; // TRC20 USDT 合约地址 (hex: 41...)
  hotAddressHex: string; // 热钱包地址 (hex: 41...)
  hotAddressBase58: string; // 热钱包地址 (base58: T...)
  privateKeyHex: string; // 私钥 (hex, 不含 0x)
  feeLimit: number; // 手续费上限 (SUN)
}

// 单链余额
export interface ChainBalance {
  chain: string;
  address: string;
  gasBalance: string;
  gasSymbol: string;
  usdt: string;
  hoot?: string;
}

/**
 * 提现服务（多链 + 中继钱包模式）
 *
 * EVM 链 (BSC/ETH/Polygon):
 *   热钱包 → 中继地址(HD account=1) → 用户外部地址
 *   同一私钥，所有 EVM 链共享同一地址
 *
 * TRON:
 *   热钱包 → 用户外部地址（V1 直接转账，不走中继）
 *   热钱包地址自动从 WITHDRAW_WALLET_PRIVATE_KEY 派生
 *
 * 分级逻辑（所有链通用）：
 * - 小额 (< WITHDRAW_AUTO_THRESHOLD): 自动审批 + 自动执行
 * - 大额 (>= WITHDRAW_AUTO_THRESHOLD): 需要管理员 TG 审核
 */
@Injectable()
export class WithdrawService {
  private readonly logger = new Logger(WithdrawService.name);

  // 多链 EVM 钱包
  private evmWallets: Map<string, EvmChainWallet> = new Map();
  // TRON 钱包
  private tronWallet: TronWalletConfig | null = null;

  // 自动提现阈值（USDT），可通过环境变量配置
  private readonly AUTO_THRESHOLD = parseFloat(
    process.env.WITHDRAW_AUTO_THRESHOLD || '500',
  );

  // 每日自动提现总额上限
  private readonly DAILY_AUTO_LIMIT = parseFloat(
    process.env.WITHDRAW_DAILY_AUTO_LIMIT || '5000',
  );

  // 每用户每日提现次数上限
  private readonly USER_DAILY_LIMIT = parseInt(
    process.env.WITHDRAW_USER_DAILY_LIMIT || '3',
    10,
  );

  constructor(
    private prisma: PrismaService,
    private hdWalletService: HdWalletService,
  ) {
    this.initializeWallets();
  }

  // ==================== 初始化 ====================

  /**
   * 初始化所有链的提现钱包
   * - BSC: 必须（默认 RPC）
   * - ETH/Polygon: 有 RPC 配置则启用
   * - TRON: 有 API URL 则启用
   * - 所有 EVM 链使用同一私钥（同一地址）
   * - TRON 热钱包地址自动从私钥派生
   */
  private async initializeWallets(): Promise<void> {
    const privateKey = process.env.WITHDRAW_WALLET_PRIVATE_KEY;
    if (!privateKey) {
      this.logger.warn('提现钱包私钥未配置（WITHDRAW_WALLET_PRIVATE_KEY）');
      return;
    }

    // BSC（必须）
    this.initEvmChainWallet('BSC', {
      rpcUrl:
        process.env.BSC_RPC_URL || 'https://bsc-dataseed1.binance.org',
      privateKey,
      gasSymbol: 'BNB',
      relayGasAmount: '0.0003', // BSC Gas 低
      tokens: {
        USDT: {
          address:
            process.env.BSC_USDT_ADDRESS ||
            process.env.USDT_CONTRACT_ADDRESS ||
            '0x55d398326f99059fF775485246999027B3197955',
          decimals: 18,
        },
        ...(process.env.HOOT_CONTRACT_ADDRESS
          ? {
              HOOT: {
                address: process.env.HOOT_CONTRACT_ADDRESS,
                decimals: 18,
              },
            }
          : {}),
      },
    });

    // ETH（可选）
    if (process.env.ETH_RPC_URL) {
      this.initEvmChainWallet('ETH', {
        rpcUrl: process.env.ETH_RPC_URL,
        privateKey,
        gasSymbol: 'ETH',
        relayGasAmount: '0.005', // ETH Gas 较高
        tokens: {
          USDT: {
            address:
              process.env.ETH_USDT_ADDRESS ||
              '0xdAC17F958D2ee523a2206206994597C13D831ec7',
            decimals: 6,
          },
        },
      });
    }

    // Polygon（可选）
    if (process.env.POLYGON_RPC_URL) {
      this.initEvmChainWallet('POLYGON', {
        rpcUrl: process.env.POLYGON_RPC_URL,
        privateKey,
        gasSymbol: 'MATIC',
        relayGasAmount: '0.01', // Polygon Gas 低但要多给一些
        tokens: {
          USDT: {
            address:
              process.env.POLYGON_USDT_ADDRESS ||
              '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
            decimals: 6,
          },
        },
      });
    }

    // TRON（可选）
    if (process.env.TRON_API_URL) {
      this.initTronWallet(privateKey);
    }
  }

  /**
   * 初始化单条 EVM 链钱包
   */
  private initEvmChainWallet(
    chain: string,
    config: {
      rpcUrl: string;
      privateKey: string;
      gasSymbol: string;
      relayGasAmount: string;
      tokens: Record<string, { address: string; decimals: number }>;
    },
  ): void {
    try {
      const provider = new ethers.JsonRpcProvider(config.rpcUrl);
      const wallet = new Wallet(config.privateKey, provider);
      this.evmWallets.set(chain, {
        provider,
        wallet,
        gasSymbol: config.gasSymbol,
        relayGasAmount: config.relayGasAmount,
        tokens: new Map(Object.entries(config.tokens)),
      });
      this.logger.log(
        `[${chain}] 提现钱包已初始化: ${wallet.address} (Gas: ${config.gasSymbol})`,
      );
    } catch (error) {
      this.logger.error(`[${chain}] 初始化提现钱包失败: ${error.message}`);
    }
  }

  /**
   * 初始化 TRON 提现钱包
   * 从同一私钥派生 TRON 地址
   */
  private initTronWallet(privateKey: string): void {
    try {
      const evmWallet = new Wallet(privateKey);
      const tronBase58 = HdWalletService.evmToTronAddress(evmWallet.address);
      const tronHex = '41' + evmWallet.address.slice(2).toLowerCase();

      const usdtBase58 =
        process.env.TRON_USDT_ADDRESS || 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
      const usdtHex = HdWalletService.tronBase58ToHex(usdtBase58);

      this.tronWallet = {
        apiUrl: process.env.TRON_API_URL!,
        apiKey: process.env.TRON_API_KEY || '',
        usdtContractHex: usdtHex,
        hotAddressHex: tronHex,
        hotAddressBase58: tronBase58,
        privateKeyHex: privateKey.startsWith('0x')
          ? privateKey.slice(2)
          : privateKey,
        feeLimit: parseInt(process.env.TRON_FEE_LIMIT || '100000000', 10), // 100 TRX
      };

      this.logger.log(`[TRON] 提现钱包已初始化: ${tronBase58}`);
    } catch (error) {
      this.logger.error(`[TRON] 初始化提现钱包失败: ${error.message}`);
    }
  }

  // ==================== 分级逻辑 ====================

  /**
   * 处理新提现申请（分级逻辑入口）
   *
   * 由 WalletService.createWithdrawRequest 调用
   */
  async processNewWithdraw(withdrawRequestId: string): Promise<{
    action: 'auto_executed' | 'pending_review';
    result?: WithdrawResult;
  }> {
    const request = await this.prisma.withdrawRequest.findUnique({
      where: { id: withdrawRequestId },
      include: {
        user: { select: { id: true, email: true, telegramId: true } },
      },
    });

    if (!request) {
      return {
        action: 'pending_review',
        result: { success: false, error: '提现请求不存在' },
      };
    }

    const amount = parseFloat(request.amount.toString());

    // 风控检查
    const riskCheck = await this.checkWithdrawRisk(request.userId, amount);
    if (!riskCheck.passed) {
      this.logger.warn(
        `提现风控拦截: 用户 ${request.userId}, 原因: ${riskCheck.reason}`,
      );
      await this.notifyAdminForReview(request);
      return { action: 'pending_review' };
    }

    // 小额自动执行
    if (amount < this.AUTO_THRESHOLD) {
      this.logger.log(
        `小额提现自动执行: ${amount} ${request.asset} (阈值: ${this.AUTO_THRESHOLD})`,
      );

      // 自动审批
      await this.prisma.withdrawRequest.update({
        where: { id: withdrawRequestId },
        data: {
          status: 'approved',
          reviewedBy: 'system_auto',
          reviewedAt: new Date(),
        },
      });

      // 自动执行
      const result = await this.executeWithdraw(withdrawRequestId);

      if (!result.success) {
        // executeWithdraw 内部已将状态设为 failed 并处理退款（余额不足时）
        // 通知管理员关注
        await this.notifyAdminForReview(request);
        return { action: 'pending_review', result };
      }

      return { action: 'auto_executed', result };
    }

    // 大额 → 通知管理员审核
    this.logger.log(
      `大额提现等待审核: ${amount} ${request.asset} (阈值: ${this.AUTO_THRESHOLD})`,
    );
    await this.notifyAdminForReview(request);
    return { action: 'pending_review' };
  }

  /**
   * 风控检查
   */
  private async checkWithdrawRisk(
    userId: string,
    amount: number,
  ): Promise<{ passed: boolean; reason?: string }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 检查用户今日提现次数
    const todayCount = await this.prisma.withdrawRequest.count({
      where: {
        userId,
        createdAt: { gte: today },
      },
    });

    if (todayCount >= this.USER_DAILY_LIMIT) {
      return {
        passed: false,
        reason: `今日提现次数已达上限 (${this.USER_DAILY_LIMIT} 次)`,
      };
    }

    // 检查今日全平台自动提现总额（包含 approved/processing/completed，防止绕过限额）
    const todayAutoTotal = await this.prisma.withdrawRequest.aggregate({
      where: {
        createdAt: { gte: today },
        reviewedBy: 'system_auto',
        status: { in: ['approved', 'processing', 'completed'] },
      },
      _sum: { amount: true },
    });

    const currentTotal = parseFloat(
      todayAutoTotal._sum.amount?.toString() || '0',
    );
    if (currentTotal + amount > this.DAILY_AUTO_LIMIT) {
      return {
        passed: false,
        reason: `今日自动提现总额即将超过上限 (${currentTotal}/${this.DAILY_AUTO_LIMIT})`,
      };
    }

    return { passed: true };
  }

  /**
   * 通知管理员审核提现（通过独立的 Admin TG Bot）
   */
  private async notifyAdminForReview(request: WithdrawRequestWithUser): Promise<void> {
    try {
      const adminBotUrl =
        process.env.ADMIN_BOT_URL || 'http://localhost:4003';

      const message = [
        `\u{1F4B0} <b>提现审核请求</b>`,
        ``,
        `\u{1F464} 用户: ${request.user?.email || request.userId}`,
        `\u{1F4B5} 金额: ${request.amount} ${request.asset}`,
        `\u{1F4B8} 手续费: ${request.fee} ${request.asset}`,
        `\u{1F517} 链: ${request.chain}`,
        `\u{1F4CD} 地址: <code>${request.address}</code>`,
        `\u23F0 时间: ${new Date().toLocaleString('zh-CN')}`,
        ``,
        `\u{1F511} 请求ID: <code>${request.id}</code>`,
      ].join('\n');

      await fetch(`${adminBotUrl}/notify-withdraw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          withdrawRequestId: request.id,
          message,
        }),
      }).catch((err) => {
        this.logger.error(`发送提现审核通知失败: ${err.message}`);
      });
    } catch (error) {
      this.logger.error(`提现审核通知异常: ${error.message}`);
    }
  }

  /**
   * 审批提现（管理员操作）
   */
  async approveWithdraw(
    withdrawRequestId: string,
    reviewedBy: string,
  ): Promise<WithdrawResult> {
    const request = await this.prisma.withdrawRequest.findUnique({
      where: { id: withdrawRequestId },
    });

    if (!request || request.status !== 'pending') {
      return { success: false, error: '提现请求不存在或状态不正确' };
    }

    // 更新为已审批
    await this.prisma.withdrawRequest.update({
      where: { id: withdrawRequestId },
      data: {
        status: 'approved',
        reviewedBy,
        reviewedAt: new Date(),
      },
    });

    // 立即执行
    return this.executeWithdraw(withdrawRequestId);
  }

  /**
   * 拒绝提现（管理员操作）
   * 退回用户余额
   */
  async rejectWithdraw(
    withdrawRequestId: string,
    reviewedBy: string,
    reason?: string,
  ): Promise<{ success: boolean; error?: string }> {
    const request = await this.prisma.withdrawRequest.findUnique({
      where: { id: withdrawRequestId },
    });

    if (!request || request.status !== 'pending') {
      return { success: false, error: '提现请求不存在或状态不正确' };
    }

    // 退回余额
    await this.prisma.$transaction(async (tx) => {
      const balanceField =
        request.asset === 'USDT' ? 'usdtBalance' : 'hootBalance';
      const refundAmount = request.amount.add(request.fee); // 金额 + 手续费

      await tx.user.update({
        where: { id: request.userId },
        data: { [balanceField]: { increment: refundAmount } },
      });

      await tx.withdrawRequest.update({
        where: { id: withdrawRequestId },
        data: {
          status: 'rejected',
          reviewedBy,
          reviewedAt: new Date(),
          remark: reason || '管理员拒绝',
        },
      });

      await tx.transaction.updateMany({
        where: { uniqueOrderId: `withdraw_${withdrawRequestId}` },
        data: { status: 'failed', remark: reason || '审核未通过' },
      });
    });

    this.logger.log(`提现已拒绝: ${withdrawRequestId}, 余额已退回`);

    return { success: true };
  }

  /**
   * 获取下一个可用的中继地址索引
   * 使用 MAX+1 并依赖数据库唯一约束防止并发冲突
   */
  private async getNextRelayIndex(): Promise<number> {
    const result = await this.prisma.$queryRaw<[{ max_index: number | null }]>`
      SELECT MAX(relay_index) as max_index FROM withdraw_requests WHERE relay_index IS NOT NULL
    `;

    return (result[0]?.max_index ?? -1) + 1;
  }

  // ==================== 执行提现（多链路由）====================

  /**
   * 执行提现（根据链类型路由到 EVM 或 TRON）
   */
  async executeWithdraw(withdrawRequestId: string): Promise<WithdrawResult> {
    if (!this.hdWalletService.getIsInitialized()) {
      return { success: false, error: 'HD 钱包未初始化，无法生成中继地址' };
    }

    // 乐观锁：原子性将 approved → processing，防止双重提交
    const updated = await this.prisma.withdrawRequest.updateMany({
      where: { id: withdrawRequestId, status: 'approved' },
      data: { status: 'processing' },
    });

    if (updated.count === 0) {
      // 没有行被更新，说明请求不存在或状态已不是 approved
      const existing = await this.prisma.withdrawRequest.findUnique({
        where: { id: withdrawRequestId },
        select: { status: true },
      });
      if (!existing) {
        return { success: false, error: '提现请求不存在' };
      }
      return {
        success: false,
        error: `提现请求状态不正确 (当前: ${existing.status})，可能已被其他操作处理`,
      };
    }

    // 重新读取完整请求数据
    const withdrawRequest = await this.prisma.withdrawRequest.findUnique({
      where: { id: withdrawRequestId },
    });

    if (!withdrawRequest) {
      return { success: false, error: '提现请求不存在' };
    }

    const chain = (withdrawRequest.chain || 'BSC').toUpperCase();

    try {
      let result: WithdrawResult;

      if (chain === 'TRON') {
        result = await this.executeTronWithdraw(withdrawRequest);
      } else {
        result = await this.executeEvmWithdraw(withdrawRequest, chain);
      }

      if (result.success) {
        // 更新数据库状态
        await this.prisma.withdrawRequest.update({
          where: { id: withdrawRequestId },
          data: {
            status: 'completed',
            txHash: result.txHash,
            processedAt: new Date(),
          },
        });

        await this.prisma.transaction.updateMany({
          where: { uniqueOrderId: `withdraw_${withdrawRequestId}` },
          data: { status: 'completed', txHash: result.txHash },
        });

        this.logger.log(
          `[${chain}] 提现成功: ${withdrawRequest.amount} ${withdrawRequest.asset} → ${withdrawRequest.address}, tx=${result.txHash}`,
        );

        // 通知用户
        await this.notifyWithdrawComplete(withdrawRequest, result.txHash!);
      } else {
        // 执行失败，回退为 failed 状态
        await this.prisma.withdrawRequest.update({
          where: { id: withdrawRequestId },
          data: {
            status: 'failed',
            remark: result.error || '链上交易执行失败',
          },
        });

        // 执行失败自动退款（用户资金不能卡住）
        await this.refundWithdraw(withdrawRequest, result.error || '链上交易执行失败');
      }

      return result;
    } catch (error) {
      this.logger.error(`[${chain}] 提现失败: ${error.message}`);

      // 异常时回退为 failed 状态并自动退款
      await this.prisma.withdrawRequest.update({
        where: { id: withdrawRequestId },
        data: {
          status: 'failed',
          remark: error.message || '提现执行异常',
        },
      });

      // 自动退款
      await this.refundWithdraw(withdrawRequest, error.message || '提现执行异常').catch(
        (refundErr) => this.logger.error(`退款失败: ${refundErr.message}`),
      );

      return { success: false, error: error.message };
    }
  }

  /**
   * 退款：执行失败时将余额退回给用户
   */
  private async refundWithdraw(
    request: WithdrawRequestBase,
    reason: string,
  ): Promise<void> {
    try {
      const balanceField =
        request.asset === 'USDT' ? 'usdtBalance' : 'hootBalance';
      const refundAmount = request.amount.add(request.fee);

      await this.prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: request.userId },
          data: { [balanceField]: { increment: refundAmount } },
        });

        await tx.withdrawRequest.update({
          where: { id: request.id },
          data: { status: 'refunded', remark: reason },
        });

        await tx.transaction.updateMany({
          where: { uniqueOrderId: `withdraw_${request.id}` },
          data: { status: 'failed', remark: reason },
        });
      });

      this.logger.log(
        `提现退款完成: ${request.id}, 金额 ${refundAmount} ${request.asset} 已退回用户 ${request.userId}`,
      );
    } catch (error) {
      this.logger.error(
        `提现退款失败: ${request.id}, 原因: ${error.message}（需人工处理）`,
      );
    }
  }

  // ==================== EVM 提现（中继模式）====================

  /**
   * 执行 EVM 提现（BSC/ETH/Polygon 通用）
   *
   * 链上交易顺序：
   * 1. 热钱包 → 中继: 发送原生 Gas 代币
   * 2. 热钱包 → 中继: 发送 ERC-20 代币
   * 3. 中继 → 用户: 转出代币到用户外部地址
   */
  private async executeEvmWithdraw(
    withdrawRequest: WithdrawRequestBase,
    chain: string,
  ): Promise<WithdrawResult> {
    const chainWallet = this.evmWallets.get(chain);
    if (!chainWallet) {
      return { success: false, error: `链 ${chain} 未配置提现钱包` };
    }

    const { asset, amount, address: toAddress } = withdrawRequest;

    // 获取代币配置
    const tokenConfig = chainWallet.tokens.get(asset);
    if (!tokenConfig) {
      return {
        success: false,
        error: `链 ${chain} 不支持代币 ${asset}`,
      };
    }

    const amountWei = ethers.parseUnits(amount.toString(), tokenConfig.decimals);

    // Step 0: 检查热钱包余额
    const hotContract = new Contract(
      tokenConfig.address,
      ERC20_TRANSFER_ABI,
      chainWallet.wallet,
    );
    const hotBalance = await hotContract.balanceOf(chainWallet.wallet.address);

    if (hotBalance < amountWei) {
      this.logger.error(
        `[${chain}] 热钱包余额不足: ${ethers.formatUnits(hotBalance, tokenConfig.decimals)} < ${amount}`,
      );
      return { success: false, error: '提现钱包余额不足' };
    }

    // Step 1: 派生中继地址
    const relayIndex = await this.getNextRelayIndex();
    const { address: relayAddress, privateKey: relayPrivateKey } =
      this.hdWalletService.deriveRelayAddress(relayIndex);

    this.logger.log(
      `[${chain}] 提现中继: index=${relayIndex}, relay=${relayAddress}, 目标=${toAddress}`,
    );

    // 保存中继信息
    await this.prisma.withdrawRequest.update({
      where: { id: withdrawRequest.id },
      data: {
        relayAddress: relayAddress.toLowerCase(),
        relayIndex,
      },
    });

    // Step 2: 热钱包 → 中继: 发送 Gas 费
    this.logger.log(
      `[${chain}] [1/3] 热钱包 → 中继: 发送 Gas 费 ${chainWallet.relayGasAmount} ${chainWallet.gasSymbol}`,
    );
    const gasAmount = ethers.parseEther(chainWallet.relayGasAmount);

    const gasTx = await chainWallet.wallet.sendTransaction({
      to: relayAddress,
      value: gasAmount,
    });
    await gasTx.wait();
    this.logger.log(`[${chain}] [1/3] Gas 费已到账: ${gasTx.hash}`);

    // Step 3: 热钱包 → 中继: 发送 ERC-20 代币
    this.logger.log(
      `[${chain}] [2/3] 热钱包 → 中继: 发送 ${amount} ${asset}`,
    );

    const fundTx = await hotContract.transfer(relayAddress, amountWei);
    const fundReceipt = await fundTx.wait();
    this.logger.log(`[${chain}] [2/3] 代币已到中继: ${fundReceipt.hash}`);

    // 记录 funding tx hash
    await this.prisma.withdrawRequest.update({
      where: { id: withdrawRequest.id },
      data: { fundingTxHash: fundReceipt.hash },
    });

    // Step 4: 中继 → 用户: 转出代币
    this.logger.log(
      `[${chain}] [3/3] 中继 → 用户: ${amount} ${asset} → ${toAddress}`,
    );

    const relayWallet = new Wallet(relayPrivateKey, chainWallet.provider);
    const relayContract = new Contract(
      tokenConfig.address,
      ERC20_TRANSFER_ABI,
      relayWallet,
    );

    const relayTx = await relayContract.transfer(toAddress, amountWei);
    const relayReceipt = await relayTx.wait();

    return {
      success: true,
      txHash: relayReceipt.hash,
      relayAddress,
    };
  }

  // ==================== TRON 提现 ====================

  /**
   * 执行 TRON 提现（TRC20 直接转账）
   *
   * V1 不走中继，直接从热钱包转到用户地址
   * 使用 TronGrid API:
   * 1. triggersmartcontract 构建交易
   * 2. secp256k1 签名
   * 3. broadcasttransaction 广播
   */
  private async executeTronWithdraw(
    withdrawRequest: WithdrawRequestBase,
  ): Promise<WithdrawResult> {
    if (!this.tronWallet) {
      return { success: false, error: 'TRON 提现钱包未配置' };
    }

    const { asset, amount, address: toAddress } = withdrawRequest;

    if (asset !== 'USDT') {
      return { success: false, error: `TRON 链暂不支持代币 ${asset}` };
    }

    // 将用户的 base58 地址转为 hex
    let toAddressHex: string;
    try {
      toAddressHex = HdWalletService.tronBase58ToHex(toAddress);
    } catch {
      return {
        success: false,
        error: `无效的 TRON 地址: ${toAddress}`,
      };
    }

    // TRC20 USDT 精度 6
    const amountSun = BigInt(
      Math.round(parseFloat(amount.toString()) * 1_000_000),
    );

    // Step 1: 构建 TRC20 transfer 交易
    // ABI 编码参数: transfer(address,uint256)
    // 地址参数去掉 TRON 的 41 前缀，使用 20 字节地址
    const toAddress20 = '0x' + toAddressHex.slice(2); // 41xxxx -> 0xxxxx
    const abiCoder = ethers.AbiCoder.defaultAbiCoder();
    const parameter = abiCoder
      .encode(['address', 'uint256'], [toAddress20, amountSun])
      .slice(2); // 去掉 0x 前缀

    this.logger.log(
      `[TRON] 提现: ${amount} USDT → ${toAddress}`,
    );

    // Step 2: 调用 TronGrid API 构建交易
    const triggerResult = await this.tronApiCall(
      '/wallet/triggersmartcontract',
      {
        owner_address: this.tronWallet.hotAddressHex,
        contract_address: this.tronWallet.usdtContractHex,
        function_selector: 'transfer(address,uint256)',
        parameter,
        fee_limit: this.tronWallet.feeLimit,
        call_value: 0,
        visible: false,
      },
    );

    if (
      !triggerResult?.result?.result ||
      !triggerResult?.transaction
    ) {
      const errMsg =
        triggerResult?.result?.message
          ? Buffer.from(triggerResult.result.message, 'hex').toString()
          : '构建 TRON 交易失败';
      return { success: false, error: errMsg };
    }

    const transaction = triggerResult.transaction;
    const txID = transaction.txID;

    // Step 3: 签名交易
    const signingKey = new ethers.SigningKey(
      '0x' + this.tronWallet.privateKeyHex,
    );
    const signature = signingKey.sign(ethers.getBytes('0x' + txID));

    // TRON 签名格式: r(32) + s(32) + v(1), v = yParity (0 or 1)
    const signatureHex =
      signature.r.slice(2) +
      signature.s.slice(2) +
      signature.yParity.toString(16).padStart(2, '0');

    transaction.signature = [signatureHex];

    // Step 4: 广播交易
    const broadcastResult = await this.tronApiCall(
      '/wallet/broadcasttransaction',
      transaction,
    );

    if (!broadcastResult?.result) {
      const errMsg = broadcastResult?.message || '广播 TRON 交易失败';
      return { success: false, error: errMsg };
    }

    this.logger.log(`[TRON] 提现成功: tx=${txID}`);

    return {
      success: true,
      txHash: txID,
    };
  }

  /**
   * TronGrid API 通用调用
   */
  private async tronApiCall(path: string, body: Record<string, unknown>): Promise<TronApiResponse | null> {
    if (!this.tronWallet) return null;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.tronWallet.apiKey) {
      headers['TRON-PRO-API-KEY'] = this.tronWallet.apiKey;
    }

    const response = await fetch(`${this.tronWallet.apiUrl}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`TronGrid API 错误: ${response.status}`);
    }

    return response.json();
  }

  // ==================== 通知 ====================

  /**
   * 通知用户提现完成
   */
  private async notifyWithdrawComplete(
    request: WithdrawRequestBase,
    txHash: string,
  ): Promise<void> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: request.userId },
        select: { telegramId: true },
      });

      if (!user?.telegramId) return;

      // 用户通知走用户 Bot
      const userBotUrl =
        process.env.TELEGRAM_BOT_URL || 'http://localhost:4002';

      await fetch(`${userBotUrl}/send-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegramId: user.telegramId,
          title: '提现成功',
          message: `${request.amount} ${request.asset} 已发送 (${request.chain || 'BSC'})\nTx: ${txHash.slice(0, 16)}...`,
          type: 'withdraw',
        }),
      }).catch(() => {});
    } catch {
      // 通知失败不影响主流程
    }
  }

  // ==================== 批量 & 余额查询 ====================

  /**
   * 批量执行提现
   */
  async executeBatchWithdraw(withdrawRequestIds: string[]): Promise<{
    results: { id: string; result: WithdrawResult }[];
    successCount: number;
    failCount: number;
  }> {
    const results: { id: string; result: WithdrawResult }[] = [];
    let successCount = 0;
    let failCount = 0;

    for (const id of withdrawRequestIds) {
      const result = await this.executeWithdraw(id);
      results.push({ id, result });

      if (result.success) {
        successCount++;
      } else {
        failCount++;
      }

      // 添加延迟避免 nonce 问题
      await this.delay(3000);
    }

    return { results, successCount, failCount };
  }

  /**
   * 获取提现钱包余额（多链）
   * 返回每条链的热钱包余额
   */
  async getWithdrawWalletBalance(): Promise<ChainBalance[]> {
    const balances: ChainBalance[] = [];

    // EVM 链余额查询
    for (const [chain, config] of this.evmWallets) {
      try {
        const address = config.wallet.address;

        // 查询原生 Gas 代币余额
        const gasBalance = await config.provider.getBalance(address);

        // 查询 USDT 余额
        let usdtBalance = BigInt(0);
        const usdtToken = config.tokens.get('USDT');
        if (usdtToken) {
          const contract = new Contract(
            usdtToken.address,
            ERC20_TRANSFER_ABI,
            config.provider,
          );
          usdtBalance = await contract.balanceOf(address);
        }

        // 查询 HOOT 余额（仅 BSC）
        let hootFormatted: string | undefined;
        const hootToken = config.tokens.get('HOOT');
        if (hootToken) {
          const contract = new Contract(
            hootToken.address,
            ERC20_TRANSFER_ABI,
            config.provider,
          );
          const hootBalance = await contract.balanceOf(address);
          hootFormatted = ethers.formatUnits(hootBalance, hootToken.decimals);
        }

        balances.push({
          chain,
          address,
          gasBalance: ethers.formatEther(gasBalance),
          gasSymbol: config.gasSymbol,
          usdt: ethers.formatUnits(
            usdtBalance,
            usdtToken?.decimals ?? 18,
          ),
          hoot: hootFormatted,
        });
      } catch (error) {
        this.logger.error(
          `[${chain}] 查询提现钱包余额失败: ${error.message}`,
        );
        balances.push({
          chain,
          address: config.wallet.address,
          gasBalance: '0',
          gasSymbol: config.gasSymbol,
          usdt: '0',
        });
      }
    }

    // TRON 余额查询
    if (this.tronWallet) {
      try {
        // 查询 TRX 余额
        let trxBalance = '0';
        const accountResult = await this.tronApiCall('/wallet/getaccount', {
          address: this.tronWallet.hotAddressHex,
          visible: false,
        });
        if (accountResult?.balance) {
          // balance 单位是 SUN，1 TRX = 1,000,000 SUN
          trxBalance = (accountResult.balance / 1_000_000).toFixed(6);
        }

        // 查询 TRC20 USDT 余额
        let usdtBalance = '0';
        const toAddress20 =
          '0x' + this.tronWallet.hotAddressHex.slice(2);
        const parameter = ethers.AbiCoder.defaultAbiCoder()
          .encode(['address'], [toAddress20])
          .slice(2);

        const balanceResult = await this.tronApiCall(
          '/wallet/triggerconstantcontract',
          {
            owner_address: this.tronWallet.hotAddressHex,
            contract_address: this.tronWallet.usdtContractHex,
            function_selector: 'balanceOf(address)',
            parameter,
            visible: false,
          },
        );

        if (
          balanceResult?.constant_result?.[0]
        ) {
          const rawHex = balanceResult.constant_result[0];
          const rawValue = BigInt('0x' + rawHex);
          usdtBalance = (Number(rawValue) / 1_000_000).toFixed(6); // TRC20 USDT 精度 6
        }

        balances.push({
          chain: 'TRON',
          address: this.tronWallet.hotAddressBase58,
          gasBalance: trxBalance,
          gasSymbol: 'TRX',
          usdt: usdtBalance,
        });
      } catch (error) {
        this.logger.error(
          `[TRON] 查询提现钱包余额失败: ${error.message}`,
        );
        balances.push({
          chain: 'TRON',
          address: this.tronWallet.hotAddressBase58,
          gasBalance: '0',
          gasSymbol: 'TRX',
          usdt: '0',
        });
      }
    }

    return balances;
  }

  /**
   * 获取已配置的提现链列表
   */
  getConfiguredChains(): string[] {
    const chains = Array.from(this.evmWallets.keys());
    if (this.tronWallet) chains.push('TRON');
    return chains;
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
