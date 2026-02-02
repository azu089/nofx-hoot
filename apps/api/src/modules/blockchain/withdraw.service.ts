import { Injectable, Logger } from '@nestjs/common';
import { ethers, Wallet, Contract } from 'ethers';
import { PrismaService } from '../../prisma/prisma.service';

// ERC-20 转账 ABI
const ERC20_TRANSFER_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
];

export interface WithdrawResult {
  success: boolean;
  txHash?: string;
  error?: string;
}

@Injectable()
export class WithdrawService {
  private readonly logger = new Logger(WithdrawService.name);
  private provider: ethers.JsonRpcProvider | null = null;
  private wallet: Wallet | null = null;

  constructor(private prisma: PrismaService) {
    this.initializeWallet();
  }

  /**
   * 初始化提现钱包
   */
  private async initializeWallet(): Promise<void> {
    const privateKey = process.env.WITHDRAW_WALLET_PRIVATE_KEY;
    if (!privateKey) {
      this.logger.warn('提现钱包私钥未配置（WITHDRAW_WALLET_PRIVATE_KEY）');
      return;
    }

    const rpcUrl =
      process.env.BSC_RPC_URL || 'https://bsc-dataseed1.binance.org';

    try {
      this.provider = new ethers.JsonRpcProvider(rpcUrl);
      this.wallet = new Wallet(privateKey, this.provider);
      this.logger.log(`提现钱包已初始化: ${this.wallet.address}`);
    } catch (error) {
      this.logger.error(`初始化提现钱包失败: ${error.message}`);
    }
  }

  /**
   * 执行提现（发送链上交易）
   */
  async executeWithdraw(withdrawRequestId: string): Promise<WithdrawResult> {
    if (!this.wallet || !this.provider) {
      return { success: false, error: '提现钱包未初始化' };
    }

    // 获取提现请求
    const withdrawRequest = await this.prisma.withdrawRequest.findUnique({
      where: { id: withdrawRequestId },
    });

    if (!withdrawRequest) {
      return { success: false, error: '提现请求不存在' };
    }

    if (withdrawRequest.status !== 'approved') {
      return { success: false, error: '提现请求状态不正确' };
    }

    const { asset, amount, address: toAddress } = withdrawRequest;

    // 获取代币合约地址
    const tokenAddress = this.getTokenAddress(asset);
    if (!tokenAddress) {
      return { success: false, error: `不支持的代币: ${asset}` };
    }

    try {
      const contract = new Contract(
        tokenAddress,
        ERC20_TRANSFER_ABI,
        this.wallet,
      );

      // 检查提现钱包余额
      const balance = await contract.balanceOf(this.wallet.address);
      const amountWei = ethers.parseUnits(amount.toString(), 18);

      if (balance < amountWei) {
        this.logger.error(
          `提现钱包余额不足: ${ethers.formatUnits(balance, 18)} < ${amount}`,
        );
        return { success: false, error: '提现钱包余额不足' };
      }

      // 发送交易
      this.logger.log(`执行提现: ${amount} ${asset} -> ${toAddress}`);

      const tx = await contract.transfer(toAddress, amountWei);
      const receipt = await tx.wait();

      const txHash = receipt.hash;

      // 更新提现状态
      await this.prisma.withdrawRequest.update({
        where: { id: withdrawRequestId },
        data: {
          status: 'completed',
          txHash,
          processedAt: new Date(),
        },
      });

      // 更新交易记录
      await this.prisma.transaction.updateMany({
        where: {
          uniqueOrderId: `withdraw_${withdrawRequestId}`,
        },
        data: {
          status: 'completed',
          txHash,
        },
      });

      this.logger.log(`提现成功: ${txHash}`);

      return { success: true, txHash };
    } catch (error) {
      this.logger.error(`提现失败: ${error.message}`);

      // 记录失败状态（可选择是否回滚余额）
      await this.prisma.withdrawRequest.update({
        where: { id: withdrawRequestId },
        data: {
          remark: `执行失败: ${error.message}`,
        },
      });

      return { success: false, error: error.message };
    }
  }

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
   * 获取提现钱包余额
   */
  async getWithdrawWalletBalance(): Promise<{
    address: string;
    bnb: string;
    usdt: string;
    hoot: string;
  } | null> {
    if (!this.wallet || !this.provider) {
      return null;
    }

    const bnbBalance = await this.provider.getBalance(this.wallet.address);

    let usdtBalance = BigInt(0);
    let hootBalance = BigInt(0);

    const usdtAddress = this.getTokenAddress('USDT');
    const hootAddress = this.getTokenAddress('HOOT');

    if (usdtAddress) {
      const contract = new Contract(
        usdtAddress,
        ERC20_TRANSFER_ABI,
        this.provider,
      );
      usdtBalance = await contract.balanceOf(this.wallet.address);
    }

    if (hootAddress) {
      const contract = new Contract(
        hootAddress,
        ERC20_TRANSFER_ABI,
        this.provider,
      );
      hootBalance = await contract.balanceOf(this.wallet.address);
    }

    return {
      address: this.wallet.address,
      bnb: ethers.formatEther(bnbBalance),
      usdt: ethers.formatUnits(usdtBalance, 18),
      hoot: ethers.formatUnits(hootBalance, 18),
    };
  }

  /**
   * 获取代币合约地址
   */
  private getTokenAddress(asset: string): string | null {
    switch (asset) {
      case 'USDT':
        return (
          process.env.USDT_CONTRACT_ADDRESS ||
          '0x55d398326f99059fF775485246999027B3197955'
        );
      case 'HOOT':
        return process.env.HOOT_CONTRACT_ADDRESS || null;
      default:
        return null;
    }
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
