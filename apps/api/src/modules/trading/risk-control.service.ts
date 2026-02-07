import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TradingService, TradingConfig } from './trading.service';

export interface RiskCheckResult {
  allowed: boolean;
  reason?: string;
  details?: Record<string, any>;
}

export interface RiskConfig {
  maxPositions: number; // 最大持仓数
  maxDailyTrades: number; // 每日最大交易次数
  minBalance: number; // 最小余额要求
  allowSameSymbol: boolean; // 是否允许同币种重复开仓
}

// 风控检查选项
export interface RiskCheckOptions {
  tradingConfig?: TradingConfig; // 交易配置（用于正确查询余额）
  side?: 'long' | 'short'; // 开仓方向（用于同币种多空共存检查）
}

// 默认风控配置
const DEFAULT_RISK_CONFIG: RiskConfig = {
  maxPositions: 5,
  maxDailyTrades: 20,
  minBalance: 0, // 测试阶段暂时设为 0，生产环境建议 10 USDT
  allowSameSymbol: false,
};

@Injectable()
export class RiskControlService {
  private readonly logger = new Logger(RiskControlService.name);

  constructor(
    private prisma: PrismaService,
    private tradingService: TradingService,
  ) {}

  /**
   * 执行全面风控检查
   */
  async check(
    userId: string,
    apiKeyId: string,
    symbol: string,
    amountUsdt: number,
    options?: RiskCheckOptions,
  ): Promise<RiskCheckResult> {
    // 获取用户风控配置（如果有自定义配置）
    const config = await this.getUserRiskConfig(userId);

    // 1. 检查最大持仓数
    const positionCheck = await this.checkMaxPositions(
      userId,
      config.maxPositions,
    );
    if (!positionCheck.allowed) {
      return positionCheck;
    }

    // 2. 检查同币种重复持仓（合约模式下允许同币种多空共存，但同方向不允许重复）
    if (!config.allowSameSymbol) {
      const symbolCheck = await this.checkSameSymbol(userId, symbol, options?.side);
      if (!symbolCheck.allowed) {
        return symbolCheck;
      }
    }

    // 3. 检查每日交易次数
    const dailyCheck = await this.checkDailyTradeLimit(
      userId,
      config.maxDailyTrades,
    );
    if (!dailyCheck.allowed) {
      return dailyCheck;
    }

    // 4. 检查交易所余额（传入交易配置以查询正确的账户类型）
    const balanceCheck = await this.checkBalance(
      userId,
      apiKeyId,
      amountUsdt,
      config.minBalance,
      options?.tradingConfig,
    );
    if (!balanceCheck.allowed) {
      return balanceCheck;
    }

    return { allowed: true };
  }

  /**
   * 检查最大持仓数
   */
  private async checkMaxPositions(
    userId: string,
    maxPositions: number,
  ): Promise<RiskCheckResult> {
    const openPositions = await this.prisma.position.count({
      where: {
        userId,
        status: 'open',
      },
    });

    if (openPositions >= maxPositions) {
      this.logger.warn(
        `用户 ${userId} 已达最大持仓数: ${openPositions}/${maxPositions}`,
      );
      return {
        allowed: false,
        reason: 'max_positions_reached',
        details: { current: openPositions, max: maxPositions },
      };
    }

    return { allowed: true };
  }

  /**
   * 检查同币种重复持仓
   * 当指定 side 时，只检查同方向持仓（允许同币种多空共存）
   */
  private async checkSameSymbol(
    userId: string,
    symbol: string,
    side?: 'long' | 'short',
  ): Promise<RiskCheckResult> {
    const existingPosition = await this.prisma.position.findFirst({
      where: {
        userId,
        symbol,
        status: 'open',
        ...(side ? { side } : {}),
      },
    });

    if (existingPosition) {
      const sideLabel = side ? `${side} ` : '';
      this.logger.warn(`用户 ${userId} 已有 ${symbol} ${sideLabel}持仓`);
      return {
        allowed: false,
        reason: 'symbol_already_open',
        details: { symbol, side: existingPosition.side, positionId: existingPosition.id },
      };
    }

    return { allowed: true };
  }

  /**
   * 检查每日交易次数
   */
  private async checkDailyTradeLimit(
    userId: string,
    maxDailyTrades: number,
  ): Promise<RiskCheckResult> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayTrades = await this.prisma.position.count({
      where: {
        userId,
        createdAt: { gte: today },
      },
    });

    if (todayTrades >= maxDailyTrades) {
      this.logger.warn(
        `用户 ${userId} 已达每日交易限制: ${todayTrades}/${maxDailyTrades}`,
      );
      return {
        allowed: false,
        reason: 'daily_limit_reached',
        details: { current: todayTrades, max: maxDailyTrades },
      };
    }

    return { allowed: true };
  }

  /**
   * 检查交易所余额
   */
  private async checkBalance(
    userId: string,
    apiKeyId: string,
    requiredAmount: number,
    minBalance: number,
    tradingConfig?: TradingConfig,
  ): Promise<RiskCheckResult> {
    try {
      const balance = await this.tradingService.fetchBalance(
        userId,
        apiKeyId,
        tradingConfig,
      );

      // 检查是否满足本次交易
      if (balance < requiredAmount) {
        this.logger.warn(
          `用户 ${userId} 余额不足: ${balance} < ${requiredAmount}`,
        );
        return {
          allowed: false,
          reason: 'insufficient_balance',
          details: { balance, required: requiredAmount },
        };
      }

      // 检查交易后是否满足最小余额
      const afterTradeBalance = balance - requiredAmount;
      if (afterTradeBalance < minBalance) {
        this.logger.warn(
          `用户 ${userId} 交易后余额低于最小要求: ${afterTradeBalance} < ${minBalance}`,
        );
        return {
          allowed: false,
          reason: 'balance_below_minimum',
          details: { afterTrade: afterTradeBalance, minRequired: minBalance },
        };
      }

      return { allowed: true, details: { balance } };
    } catch (error) {
      this.logger.error(`查询余额失败: ${error.message}`);
      return {
        allowed: false,
        reason: 'balance_check_failed',
        details: { error: error.message },
      };
    }
  }

  /**
   * 获取用户风控配置
   */
  private async getUserRiskConfig(userId: string): Promise<RiskConfig> {
    // 可以从数据库读取用户自定义配置
    // 目前返回默认配置
    const subscription = await this.prisma.strategySubscription.findFirst({
      where: { userId, isActive: true },
      select: { maxPositions: true },
    });

    return {
      ...DEFAULT_RISK_CONFIG,
      maxPositions:
        subscription?.maxPositions || DEFAULT_RISK_CONFIG.maxPositions,
    };
  }

  /**
   * 记录风控拒绝日志
   */
  async logRejection(
    userId: string,
    signalId: string,
    reason: string,
    details: Record<string, any>,
  ): Promise<void> {
    await this.prisma.riskLog.create({
      data: {
        userId,
        signalId,
        reason,
        details: JSON.stringify(details),
      },
    });
  }
}
