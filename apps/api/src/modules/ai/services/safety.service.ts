import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AI_SAFETY_DEFAULTS } from '../constants/safety-defaults';

// ========================= 类型定义 =========================

export interface SafetyCheckInput {
  userId: string;
  symbol: string;
  direction: string; // buy, sell, hold
  action?: string; // open_long, open_short, close_long, close_short, hold, wait
  confidence: number;
  consensusScore: number;
  positionSize?: number;
  leverage?: number;
  indicators?: {
    rsi: number | null;
    macd: { macd: number | null; signal: number | null; histogram: number | null };
    bollingerBands: { upper: number | null; middle: number | null; lower: number | null };
    atr: number | null;
    atr3?: number | null; // 3 周期 ATR（短期波动率）
    atr14?: number | null; // 14 周期 ATR（标准波动率）
    obv: number | null;
    ema: { ema12: number | null; ema26: number | null; ema50: number | null };
  };
  // P5 新增
  fundingRate?: number; // 资金费率
  takeProfitPercent?: number; // 止盈百分比
  stopLossPercent?: number; // 止损百分比
  stopLossValid?: boolean;   // SL 方向是否正确（open_long: SL<price; open_short: SL>price）
  takeProfitValid?: boolean; // TP 方向是否正确（open_long: TP>price; open_short: TP<price）
  // v6: 分析模式
  mode?: string; // "quick" | "expert" — quick 模式跳过 L2 共识检查
  totalModels?: number; // 参与投票的总模型数（用于 L2 动态共识门槛）
  volume24h?: number; // 24h 成交量 USD（用于 L10 流动性检查）
  positionSizeUSD?: number; // 实际仓位金额（美元），用于 L10 流动性比较
  currentPrice?: number; // 当前价格，用于 L9 regime 感知 R:R 计算
  priceChange1h?: number; // 近1h价格变化率（%），用于 L9 黑天鹅检测（ATR 滞后补偿）
  strategyId?: string; // AI策略ID，用于 L9 按策略独立计算持仓数
  // 策略级风控参数（优先于 aiConfig 全局默认值）
  strategyRiskConfig?: {
    maxLeverage?: number;
    btcEthMaxLeverage?: number;      // 分类杠杆（BTC/ETH）
    altcoinMaxLeverage?: number;     // 分类杠杆（山寨币）
    minRiskRewardRatio?: number;     // 最小风险收益比
    maxPositions?: number;
    maxDailyTrades?: number;
    cooldownMinutes?: number;
    maxDailyDrawdown?: number;       // 策略级日最大回撤（美元），优先于 aiConfig
    circuitBreaker?: { maxConsecutiveLosses?: number; maxDrawdownPercent?: number };
  };
}

export interface SafetyCheckResult {
  passed: boolean;
  blockedBy: string | null; // 被哪一层拦截: "L1", "L2", etc.
  blockedReason: string | null;
  warnings: string[]; // 软警告（不拦截，但注入 prompt）
  adjustedPositionSizePct?: number; // L4 positionSize 削减后的百分比（调用方应用于 decision）
  adjustedLeverage?: number;        // L4 杠杆削减后的值（调用方应用于 decision）
  checks: Array<{
    layer: string;
    name: string;
    passed: boolean;
    detail: string;
  }>;
}

interface SafetyLayerResult {
  passed: boolean;
  detail: string;
  clippedPositionSizePct?: number; // L4 positionSize 削减时携带新值
  clippedLeverage?: number;        // L4 杠杆削减时携带新值
}

// ========================= 服务实现 =========================

@Injectable()
export class SafetyService {
  private readonly logger = new Logger(SafetyService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 判断是否为平仓动作（平仓跳过部分安全检查）
   */
  private isCloseAction(input: SafetyCheckInput): boolean {
    const action = (input.action || '').toLowerCase();
    return action === 'close_long' || action === 'close_short';
  }

  /**
   * 运行全部安全检查层
   *
   * 硬拦截层: L1(结构), L2(共识), L4(仓位/杠杆), L5(熔断), L6(冷却), L8(极端资金费率), L9(ATR极端+R:R+持仓冲突)
   * 软警告层: L3(RSI), L7(Drawdown), L10(流动性)
   *
   * 设计决策: L3/L7 为软警告，不硬拦截 RSI/ATR/Drawdown，由 AI 自主评估。
   *
   * 平仓动作（close_long/close_short）跳过 L2/L3/L5/L6 检查
   */
  async checkAll(input: SafetyCheckInput): Promise<SafetyCheckResult> {
    this.logger.log(
      `开始安全检查: userId=${input.userId}, symbol=${input.symbol}, direction=${input.direction}, action=${input.action || 'N/A'}`,
    );

    const checks: SafetyCheckResult['checks'] = [];
    const warnings: string[] = [];
    let blockedBy: string | null = null;
    let blockedReason: string | null = null;
    let adjustedPositionSizePct: number | undefined;
    let adjustedLeverage: number | undefined;
    const isClose = this.isCloseAction(input);

    // L1: 结构化输出验证
    const l1 = this.checkL1(input);
    checks.push({
      layer: 'L1',
      name: '结构验证',
      passed: l1.passed,
      detail: l1.detail,
    });
    if (!l1.passed && !blockedBy) {
      blockedBy = 'L1';
      blockedReason = l1.detail;
    }

    // L2: 多模型共识检查（平仓跳过；quick 模式跳过——无多模型共识）
    const isQuickMode = input.mode === 'quick';
    if (isClose || isQuickMode) {
      checks.push({
        layer: 'L2',
        name: '多模型共识',
        passed: true,
        detail: isClose ? '平仓操作，跳过共识检查' : '极速模式，跳过共识检查',
      });
    } else {
      const l2 = this.checkL2(input);
      checks.push({
        layer: 'L2',
        name: '多模型共识',
        passed: l2.passed,
        detail: l2.detail,
      });
      if (!l2.passed && !blockedBy) {
        blockedBy = 'L2';
        blockedReason = l2.detail;
      }
    }

    // L3: 指标软警告（平仓跳过；不拦截，仅注入 warning）
    if (isClose) {
      checks.push({
        layer: 'L3',
        name: '指标警告',
        passed: true,
        detail: '平仓操作，跳过指标检查',
      });
    } else {
      const l3 = this.checkL3(input);
      checks.push({
        layer: 'L3',
        name: '指标警告',
        passed: true, // L3 永远不拦截（软警告）
        detail: l3.detail,
      });
      if (l3.warning) {
        warnings.push(l3.warning);
      }
    }

    // L4: 仓位与杠杆限制（平仓跳过）
    if (isClose) {
      checks.push({
        layer: 'L4',
        name: '仓位与杠杆',
        passed: true,
        detail: '平仓操作，跳过仓位/杠杆检查',
      });
    } else {
      const l4 = await this.checkL4(input);
      checks.push({
        layer: 'L4',
        name: '仓位与杠杆',
        passed: l4.passed,
        detail: l4.detail,
      });
      if (!l4.passed && !blockedBy) {
        blockedBy = 'L4';
        blockedReason = l4.detail;
      }
      if (l4.clippedPositionSizePct !== undefined) {
        adjustedPositionSizePct = l4.clippedPositionSizePct;
      }
      if (l4.clippedLeverage !== undefined) {
        adjustedLeverage = l4.clippedLeverage;
      }
    }

    // L5: 熔断机制（平仓跳过）
    if (isClose) {
      checks.push({
        layer: 'L5',
        name: '熔断机制',
        passed: true,
        detail: '平仓操作，跳过熔断检查',
      });
    } else {
      const l5 = await this.checkL5(input);
      checks.push({
        layer: 'L5',
        name: '熔断机制',
        passed: l5.passed,
        detail: l5.detail,
      });
      if (!l5.passed && !blockedBy) {
        blockedBy = 'L5';
        blockedReason = l5.detail;
      }
    }

    // L6: 冷却期检查（平仓跳过）
    if (isClose) {
      checks.push({
        layer: 'L6',
        name: '冷却期检查',
        passed: true,
        detail: '平仓操作，跳过冷却期检查',
      });
    } else {
      const l6 = await this.checkL6(input);
      checks.push({
        layer: 'L6',
        name: '冷却期检查',
        passed: l6.passed,
        detail: l6.detail,
      });
      if (!l6.passed && !blockedBy) {
        blockedBy = 'L6';
        blockedReason = l6.detail;
      }
    }

    // L7: Drawdown 软警告（不拦截，仅注入 warning）
    const l7 = await this.checkL7(input);
    checks.push({
      layer: 'L7',
      name: '回撤警告',
      passed: true, // L7 永远不拦截
      detail: l7.detail,
    });
    if (l7.warning) {
      warnings.push(l7.warning);
    }

    // L8: 资金费率感知（分级处理：硬拦截 + 软警告）
    const l8 = this.checkL8(input);
    checks.push({
      layer: 'L8',
      name: '资金费率',
      passed: l8.passed,
      detail: l8.detail,
    });
    if (!l8.passed && !blockedBy) {
      blockedBy = 'L8';
      blockedReason = l8.detail;
    }
    if (l8.warning) {
      warnings.push(l8.warning);
    }

    // L9: 代码强制硬限制 + ATR 波动率守卫
    const l9 = await this.checkL9(input);
    checks.push({
      layer: 'L9',
      name: '硬限制与波动率',
      passed: l9.passed,
      detail: l9.detail,
    });
    if (!l9.passed && !blockedBy) {
      blockedBy = 'L9';
      blockedReason = l9.detail;
    }

    // L10: 流动性软警告（不拦截，仅记录警告）
    if (!isClose) {
      const l10 = this.checkL10(input);
      checks.push({
        layer: 'L10',
        name: '流动性检查',
        passed: true, // L10 永远不拦截
        detail: l10.detail,
      });
      if (l10.warning) {
        warnings.push(l10.warning);
      }
    }

    // 判断整体是否通过（所有层都通过才算通过）
    const allPassed = checks.every((check) => check.passed);

    const result: SafetyCheckResult = {
      passed: allPassed,
      blockedBy,
      blockedReason,
      warnings,
      adjustedPositionSizePct,
      adjustedLeverage,
      checks,
    };

    if (allPassed) {
      this.logger.log(
        `安全检查通过: ${input.symbol} ${input.direction}${warnings.length > 0 ? ` (${warnings.length} 条软警告)` : ''}`,
      );
    } else {
      this.logger.warn(
        `安全检查失败: ${input.symbol} ${input.direction} - 被 ${blockedBy} 拦截: ${blockedReason}`,
      );
    }

    return result;
  }

  // ========================= L1: 结构化输出验证 =========================

  /**
   * L1: 验证输入数据结构的完整性和合法性
   */
  private checkL1(input: SafetyCheckInput): SafetyLayerResult {
    // 检查方向（兼容旧格式 buy/sell/hold 和新格式 6-action）
    const validDirections = ['buy', 'sell', 'hold'];
    const validActions = [
      'open_long', 'open_short', 'close_long', 'close_short', 'hold', 'wait',
    ];
    const directionValid = validDirections.includes(input.direction.toLowerCase());
    const actionValid = !input.action || validActions.includes(input.action.toLowerCase());

    if (!directionValid) {
      return {
        passed: false,
        detail: `无效方向: ${input.direction}，必须是 buy/sell/hold`,
      };
    }
    if (!actionValid) {
      return {
        passed: false,
        detail: `无效操作: ${input.action}，必须是 ${validActions.join('/')}`,
      };
    }

    // 检查置信度
    if (typeof input.confidence !== 'number' || input.confidence < 0 || input.confidence > 100) {
      return {
        passed: false,
        detail: `无效置信度: ${input.confidence}，必须 0-100`,
      };
    }

    // 检查共识分数（上限 = 实际模型数，兼容 6+ 模型配置）
    const maxConsensusScore = input.totalModels ?? 20;
    if (
      typeof input.consensusScore !== 'number' ||
      input.consensusScore < 0 ||
      input.consensusScore > maxConsensusScore
    ) {
      return {
        passed: false,
        detail: `无效共识分数: ${input.consensusScore}，必须 0-${maxConsensusScore}`,
      };
    }

    return {
      passed: true,
      detail: `验证通过: direction=${input.direction}, confidence=${input.confidence}, consensus=${input.consensusScore}`,
    };
  }

  // ========================= L2: 多模型共识检查 =========================

  /**
   * L2: 多模型共识检查（动态门槛）
   * - 2 模型: 50% 门槛（1/2 即可，避免全票要求过严）
   * - 3+ 模型: 60% 门槛
   * - 下限 = min(total, minConsensusModels) 防止不可能情况
   */
  private checkL2(input: SafetyCheckInput): SafetyLayerResult {
    const total = input.totalModels || 5;
    // 2 模型用 50% 门槛（ceil(2*0.6)=2 全票太严），3+ 用 60%
    const ratio = total <= 2 ? 0.5 : 0.6;
    const minConsensus = Math.max(
      Math.ceil(total * ratio),
      Math.min(total, AI_SAFETY_DEFAULTS.minConsensusModels),
    );

    if (input.consensusScore < minConsensus) {
      return {
        passed: false,
        detail: `共识不足: ${input.consensusScore}/${total}，需要至少 ${minConsensus}/${total} (${Math.round(ratio * 100)}%) 的模型同意`,
      };
    }

    return {
      passed: true,
      detail: `共识达标: ${input.consensusScore}/${total} 的模型同意 ${input.direction}`,
    };
  }

  // ========================= L3: 指标硬约束 =========================

  /**
   * L3: 基于技术指标的软警告（不拦截，仅注入提示）
   *
   * 设计决策: RSI 无代码级硬拦截，AI 看到数据后自主决策。
   * 硬拦截剥夺了 AI 在强趋势延续场景下正确交易的能力。改为软警告，让 AI 自行判断。
   */
  private checkL3(input: SafetyCheckInput): SafetyLayerResult & { warning?: string } {
    const direction = input.direction.toLowerCase();

    // 如果没有指标数据，跳过检查
    if (!input.indicators) {
      return {
        passed: true,
        detail: '无指标数据，跳过 L3',
      };
    }

    const { rsi } = input.indicators;

    // RSI 极端值 → 软警告（不拦截）
    if (rsi !== null) {
      if (direction === 'buy' && rsi > AI_SAFETY_DEFAULTS.rsiOverbought) {
        return {
          passed: true,
          detail: `RSI 超买: ${rsi.toFixed(2)} > ${AI_SAFETY_DEFAULTS.rsiOverbought}`,
          warning: `RSI 超买 (${rsi.toFixed(2)})，做多风险较高`,
        };
      }

      if (direction === 'sell' && rsi < AI_SAFETY_DEFAULTS.rsiOversold) {
        return {
          passed: true,
          detail: `RSI 超卖: ${rsi.toFixed(2)} < ${AI_SAFETY_DEFAULTS.rsiOversold}`,
          warning: `RSI 超卖 (${rsi.toFixed(2)})，做空风险较高`,
        };
      }
    }

    return {
      passed: true,
      detail: `指标检查通过: RSI=${rsi?.toFixed(2) || 'N/A'}`,
    };
  }

  // ========================= L4: 仓位与杠杆限制 =========================

  /**
   * L4: 检查仓位大小和杠杆是否超过用户配置的限制
   */
  private async checkL4(input: SafetyCheckInput): Promise<SafetyLayerResult> {
    // 如果没有提供仓位或杠杆信息，跳过检查
    if (!input.positionSize && !input.leverage) {
      return {
        passed: true,
        detail: '无仓位/杠杆数据，跳过 L4',
      };
    }

    // 获取用户的 AI 配置
    const aiConfig = await this.prisma.aiConfig.findUnique({
      where: { userId: input.userId },
    });

    if (!aiConfig || !aiConfig.isEnabled) {
      return {
        passed: false,
        detail: 'AI 交易未启用或配置缺失',
      };
    }

    // 仓位% 和杠杆超限时均自动削减（clip），不拒绝
    // 只有非法值（leverage=0, positionSize≤0）才拒绝
    let clippedPositionSizePct: number | undefined;
    let clippedLeverage: number | undefined;
    const clipDetails: string[] = [];

    // 检查仓位百分比（超限 → clip，不拒绝）
    if (input.positionSize && aiConfig.maxPositionSize) {
      const maxPct = Number(aiConfig.maxPositionSize);
      if (input.positionSize > maxPct) {
        clippedPositionSizePct = maxPct;
        clipDetails.push(`positionSize ${input.positionSize}%→${maxPct}%`);
      }
    }

    // 检查杠杆（超限 → clip，不拒绝；超限自动降至配置上限）
    if (input.leverage) {
      const bs = input.symbol.split('/')[0]?.toUpperCase();
      const isMaj = bs === 'BTC' || bs === 'ETH';
      const effectiveMaxLeverage = isMaj
        ? (input.strategyRiskConfig?.btcEthMaxLeverage ?? input.strategyRiskConfig?.maxLeverage ?? (aiConfig.maxLeverage ? Number(aiConfig.maxLeverage) : null))
        : (input.strategyRiskConfig?.altcoinMaxLeverage ?? input.strategyRiskConfig?.maxLeverage ?? (aiConfig.maxLeverage ? Number(aiConfig.maxLeverage) : null));
      if (effectiveMaxLeverage && input.leverage > effectiveMaxLeverage) {
        clippedLeverage = effectiveMaxLeverage;
        clipDetails.push(`leverage ${input.leverage}x→${effectiveMaxLeverage}x (${isMaj ? 'BTC/ETH' : 'altcoin'})`);
      }
    }

    if (clipDetails.length > 0) {
      return {
        passed: true,
        detail: `[L4 自动削减] ${clipDetails.join(', ')}`,
        clippedPositionSizePct,
        clippedLeverage,
      };
    }

    return {
      passed: true,
      detail: `仓位/杠杆通过: position=${input.positionSize || 'N/A'}, leverage=${input.leverage || 'N/A'}`,
    };
  }

  // ========================= L5: 熔断机制 =========================

  /**
   * L5: 熔断保护
   * - 检查最近 24h 失败交易次数
   * - 检查每日交易次数限制
   * - 检查每日最大回撤
   */
  private async checkL5(input: SafetyCheckInput): Promise<SafetyLayerResult> {
    const aiConfig = await this.prisma.aiConfig.findUnique({
      where: { userId: input.userId },
    });

    if (!aiConfig || !aiConfig.isEnabled) {
      return {
        passed: false,
        detail: 'AI 交易未启用或配置缺失',
      };
    }

    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // 1. 检查失败交易次数（熔断器）
    const failedCount = await this.prisma.aiAnalysis.count({
      where: {
        userId: input.userId,
        status: 'failed',
        createdAt: { gte: last24h },
      },
    });

    // 熔断阈值：策略风控参数优先，fallback 全局 aiConfig
    const effectiveCircuitBreaker = input.strategyRiskConfig?.circuitBreaker?.maxConsecutiveLosses ?? aiConfig.circuitBreaker;
    if (effectiveCircuitBreaker && failedCount >= effectiveCircuitBreaker) {
      return {
        passed: false,
        detail: `熔断触发: 24h 内 ${failedCount} 次失败，阈值 ${effectiveCircuitBreaker}`,
      };
    }

    // 2. 检查每日交易次数
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayTradeCount = await this.prisma.aiAnalysis.count({
      where: {
        userId: input.userId,
        status: { in: ['executed', 'pending'] },
        createdAt: { gte: todayStart },
      },
    });

    // 每日交易次数上限：策略风控参数优先，fallback 全局 aiConfig
    const effectiveMaxDailyTrades = input.strategyRiskConfig?.maxDailyTrades ?? aiConfig.maxDailyTrades;
    if (effectiveMaxDailyTrades && todayTradeCount >= effectiveMaxDailyTrades) {
      return {
        passed: false,
        detail: `日交易上限: ${todayTradeCount}/${effectiveMaxDailyTrades}`,
      };
    }

    // 3. 检查每日最大回撤（策略级优先，fallback 全局 aiConfig，默认 $100）
    const maxDailyDrawdown =
      input.strategyRiskConfig?.maxDailyDrawdown ??
      (aiConfig.maxDailyDrawdown ? Number(aiConfig.maxDailyDrawdown) : 100);

    // 3a. 查询今日已平仓 AI 交易的实现盈亏（按策略独立计算）
    // 排除 syncPositionsForUser 产生的重复 close 记录（manual/not_found_on_exchange）
    const closedPositions = await this.prisma.position.findMany({
      where: {
        userId: input.userId,
        source: { in: ['ai_analysis', 'ai_research', 'ai_strategy'] },
        status: 'closed',
        closedAt: { gte: todayStart },
        closeReason: { notIn: ['manual', 'not_found_on_exchange'] },
        ...(input.strategyId ? { aiStrategyId: input.strategyId } : {}),
      },
      select: { realizedPnl: true },
    });
    const closedPnl = closedPositions.reduce(
      (sum, p) => sum + Number(p.realizedPnl || 0),
      0,
    );

    // 3b. 查询未平仓 AI 持仓的浮动盈亏（按策略独立计算）
    const openPositions = await this.prisma.position.findMany({
      where: {
        userId: input.userId,
        source: { in: ['ai_analysis', 'ai_research', 'ai_strategy'] },
        status: 'open',
        ...(input.strategyId ? { aiStrategyId: input.strategyId } : {}),
      },
      select: { unrealizedPnl: true },
    });
    const unrealizedPnl = openPositions.reduce(
      (sum, p) => sum + Number(p.unrealizedPnl || 0),
      0,
    );

    // 3c. 总回撤 = 已实现亏损 + 浮动亏损
    const totalDailyPnl = closedPnl + unrealizedPnl;

    if (totalDailyPnl < -maxDailyDrawdown) {
      return {
        passed: false,
        detail: `日回撤 $${Math.abs(totalDailyPnl).toFixed(2)} 超过限额 $${maxDailyDrawdown}${input.strategyId ? ' (本策略)' : ''}`,
      };
    }

    // 4. 连续亏损检查（基于已实现 PnL，按策略隔离，防止跨策略误触发熔断）
    // 排除 syncPositionsForUser 产生的重复 close 记录（manual/not_found_on_exchange）
    const maxConsecLoss = input.strategyRiskConfig?.circuitBreaker?.maxConsecutiveLosses;
    if (maxConsecLoss && maxConsecLoss > 0) {
      const recentClosed = await this.prisma.position.findMany({
        where: {
          userId: input.userId,
          source: { in: ['ai_analysis', 'ai_research', 'ai_strategy'] },
          status: 'closed',
          closedAt: { gte: last24h },
          closeReason: { notIn: ['manual', 'not_found_on_exchange'] },
          ...(input.strategyId ? { aiStrategyId: input.strategyId } : {}),
        },
        orderBy: { closedAt: 'desc' },
        take: maxConsecLoss,
        select: { realizedPnl: true },
      });

      if (recentClosed.length >= maxConsecLoss) {
        const allLosses = recentClosed.every(p => Number(p.realizedPnl ?? 0) < 0);
        if (allLosses) {
          return {
            passed: false,
            detail: `连续 ${recentClosed.length} 笔亏损（24h内），触发熔断保护`,
          };
        }
      }
    }

    return {
      passed: true,
      detail: `熔断通过: 失败=${failedCount}, 今日=${todayTradeCount}/${effectiveMaxDailyTrades || '无限制'}, 日盈亏=$${totalDailyPnl.toFixed(2)}`,
    };
  }

  // ========================= L6: 冷却期检查 =========================

  /**
   * L6: 检查同一交易对的冷却期
   * 防止短时间内频繁交易同一标的
   */
  private async checkL6(input: SafetyCheckInput): Promise<SafetyLayerResult> {
    const aiConfig = await this.prisma.aiConfig.findUnique({
      where: { userId: input.userId },
    });

    if (!aiConfig || !aiConfig.isEnabled) {
      return {
        passed: false,
        detail: 'AI 交易未启用或配置缺失',
      };
    }

    // 冷却时长：策略风控参数优先，fallback 全局 aiConfig
    const effectiveCooldownMinutes = input.strategyRiskConfig?.cooldownMinutes ?? aiConfig.cooldownMinutes;

    // 如果没有配置冷却期，跳过检查
    if (!effectiveCooldownMinutes || effectiveCooldownMinutes === 0) {
      return {
        passed: true,
        detail: '未配置冷却期，跳过 L6',
      };
    }

    // 查找最近一次针对该交易对的分析
    const lastAnalysis = await this.prisma.aiAnalysis.findFirst({
      where: {
        userId: input.userId,
        symbol: input.symbol,
        status: { in: ['executed', 'pending'] },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (lastAnalysis) {
      const timeSinceLastTrade = Date.now() - lastAnalysis.createdAt.getTime();
      const cooldownMs = effectiveCooldownMinutes * 60 * 1000;

      if (timeSinceLastTrade < cooldownMs) {
        const remainingMinutes = Math.ceil((cooldownMs - timeSinceLastTrade) / 60000);
        return {
          passed: false,
          detail: `冷却中: 距上次交易 ${Math.floor(timeSinceLastTrade / 60000)} 分钟，还需等待 ${remainingMinutes} 分钟`,
        };
      }
    }

    return {
      passed: true,
      detail: `冷却期通过: ${effectiveCooldownMinutes} 分钟`,
    };
  }

  // ========================= L7: Drawdown 保护 =========================

  /**
   * L7: Drawdown 保护（软警告，不拦截）
   *
   * 设计决策: Drawdown 无代码级硬拦截。某一持仓亏损严重不代表其他品种也不能交易。
   * 改为软警告，让 AI 看到当前持仓回撤情况后自行判断。
   */
  private async checkL7(input: SafetyCheckInput): Promise<SafetyLayerResult & { warning?: string }> {
    try {
      const openPositions = await this.prisma.position.findMany({
        where: {
          userId: input.userId,
          status: 'open',
        },
        select: {
          id: true,
          entryPrice: true,
          markPrice: true,
          unrealizedPnl: true,
          margin: true,
        },
      });

      for (const pos of openPositions) {
        if (!pos.markPrice || !pos.margin || Number(pos.margin) === 0) continue;

        const margin = Number(pos.margin);
        const unrealizedPnl = Number(pos.unrealizedPnl || 0);
        const pnlPercent = (unrealizedPnl / margin) * 100;

        // 软警告：某持仓亏损超过阈值时提醒（不拦截）
        if (pnlPercent < AI_SAFETY_DEFAULTS.drawdownBlockThreshold) {
          return {
            passed: true, // 不拦截
            detail: `持仓 ${pos.id.slice(0, 8)} 亏损 ${pnlPercent.toFixed(1)}% 超过 ${Math.abs(AI_SAFETY_DEFAULTS.drawdownBlockThreshold)}% 阈值`,
            warning: `回撤警告: 持仓亏损 ${pnlPercent.toFixed(1)}%，开仓前请评估风险`,
          };
        }
      }

      return {
        passed: true,
        detail: `回撤通过: ${openPositions.length} 个持仓在安全范围内`,
      };
    } catch (error) {
      this.logger.warn(`L7 Drawdown 检查出错: ${error.message}`);
      // 检查异常也不拦截，仅警告
      return {
        passed: true,
        detail: '回撤检查出错',
        warning: '回撤检查出错，无法确认持仓状态',
      };
    }
  }

  // ========================= L8: 资金费率检查（分级处理） =========================

  /**
   * L8: 资金费率分级检查
   * - |fr| > 0.1%/8h → 硬拦截（极端）
   * - |fr| > 0.05%/8h → 软警告（偏高，注入 prompt）
   * - fr < -0.05%/8h + 做多 → 软提示（负费率做多可获收益）
   * - 平仓动作不受资金费率限制
   */
  private checkL8(
    input: SafetyCheckInput,
  ): SafetyLayerResult & { warning?: string } {
    if (input.fundingRate === undefined || input.fundingRate === null) {
      return {
        passed: true,
        detail: '无资金费率数据，跳过 L8',
      };
    }

    const frPercent = input.fundingRate * 100; // 转为百分比显示
    const absFundingRate = Math.abs(input.fundingRate);
    const direction = input.direction.toLowerCase();
    const isClose = this.isCloseAction(input);

    // 平仓不受资金费率限制
    if (isClose) {
      return {
        passed: true,
        detail: `平仓操作，跳过资金费率检查 (${frPercent.toFixed(4)}%/8h)`,
      };
    }

    // 判断是否在支付资金费率方
    const isPayingFunding =
      (direction === 'buy' && input.fundingRate > 0) ||
      (direction === 'sell' && input.fundingRate < 0);

    // 级别 1：极端资金费率 → 硬拦截
    if (absFundingRate > AI_SAFETY_DEFAULTS.fundingRateExtreme && isPayingFunding) {
      return {
        passed: false,
        detail: `极端资金费率: ${frPercent.toFixed(4)}%/8h，${direction === 'buy' ? '多方' : '空方'}费用过高，已暂停`,
      };
    }

    // 级别 2：偏高资金费率 → 软警告
    if (absFundingRate > AI_SAFETY_DEFAULTS.fundingRateHigh && isPayingFunding) {
      return {
        passed: true,
        detail: `资金费率偏高: ${frPercent.toFixed(4)}%/8h (警告)`,
        warning: `资金费率偏高 (${frPercent.toFixed(4)}%/8h)，持仓成本较大`,
      };
    }

    // 级别 3：负资金费率 + 做多 → 软提示（正面信息）
    if (input.fundingRate < AI_SAFETY_DEFAULTS.fundingRateNegativeBenefit && direction === 'buy') {
      return {
        passed: true,
        detail: `负资金费率: ${frPercent.toFixed(4)}%/8h，多方可获资金费`,
        warning: `负资金费率 (${frPercent.toFixed(4)}%/8h)，多方可获资金费收入`,
      };
    }

    return {
      passed: true,
      detail: `资金费率正常: ${frPercent.toFixed(4)}%/8h`,
    };
  }

  // ========================= L9: 硬限制 + ATR 波动率守卫 =========================

  /**
   * L9: 代码强制硬限制 + ATR 波动率守卫
   * - 最大 AI 持仓数 ≤ 配置值（开仓时）
   * - 风险收益比 ≥ 2:1（TP/SL 比值，开仓时）
   * - 同一 symbol 不开反向仓（开仓时）
   * - ATR 短期飙升检测: >3.0 硬拦截, >2.0 仅日志警告（不拦截）
   * 平仓动作跳过仓位/冲突检查，但 ATR 极端(>3.0)仍拦截
   */
  private async checkL9(input: SafetyCheckInput): Promise<SafetyLayerResult> {
    const isClose = this.isCloseAction(input);

    // 读取用户配置的最大持仓数（策略风控参数优先，fallback 全局 aiConfig，最终默认 3）
    const aiConfigForL9 = await this.prisma.aiConfig.findUnique({
      where: { userId: input.userId },
      select: { maxPositions: true },
    });
    const maxPositions = input.strategyRiskConfig?.maxPositions ?? aiConfigForL9?.maxPositions ?? 3;

    try {
      // === ATR 波动率守卫（开仓和平仓都检查） ===
      if (input.indicators?.atr3 != null && input.indicators?.atr14 != null && input.indicators.atr14 > 0) {
        const atrRatio = input.indicators.atr3 / input.indicators.atr14;

        // 极端波动 → 硬拦截
        if (atrRatio > AI_SAFETY_DEFAULTS.atrExtremeRatio) {
          return {
            passed: false,
            detail: `极端波动: ATR3/ATR14=${atrRatio.toFixed(2)} 超过 ${AI_SAFETY_DEFAULTS.atrExtremeRatio}，暂停所有交易`,
          };
        }

        // 波动率异常 → 软警告（ATR 无代码级硬拦截，AI 自主评估）
        if (!isClose && atrRatio > AI_SAFETY_DEFAULTS.atrAnomalyRatio) {
          // 不拦截，仅记录警告，让 AI 在 prompt 中看到波动率信息后自行决策
          this.logger.warn(
            `L9 波动率异常: ATR3/ATR14 = ${atrRatio.toFixed(2)} > ${AI_SAFETY_DEFAULTS.atrAnomalyRatio}，confidence=${input.confidence}%`,
          );
        }
      }

      // === priceChange1h 黑天鹅拦截（仅新开仓，ATR 滞后补偿） ===
      if (!isClose && input.priceChange1h !== undefined && input.priceChange1h !== null) {
        const absChange = Math.abs(input.priceChange1h);
        if (absChange > AI_SAFETY_DEFAULTS.priceChange1hExtreme) {
          return {
            passed: false,
            detail: `黑天鹅行情: 近1h涨跌 ${input.priceChange1h.toFixed(2)}% 超过 ±${AI_SAFETY_DEFAULTS.priceChange1hExtreme}%，暂停新开仓`,
          };
        }
        if (absChange > AI_SAFETY_DEFAULTS.priceChange1hHigh) {
          this.logger.warn(
            `L9 快速行情警告: 近1h涨跌 ${input.priceChange1h.toFixed(2)}%，接近极端阈值 ±${AI_SAFETY_DEFAULTS.priceChange1hExtreme}%`,
          );
        }
      }

      // === 以下检查仅对开仓动作执行 ===
      if (isClose) {
        return {
          passed: true,
          detail: '平仓操作，跳过硬限制检查',
        };
      }

      // 1. 最大持仓数检查（按策略独立计算）
      const positionWhere: { userId: string; status: string; aiStrategyId?: string } = {
        userId: input.userId,
        status: 'open',
      };
      if (input.strategyId) {
        positionWhere.aiStrategyId = input.strategyId;
      }
      const openPositionCount = await this.prisma.position.count({
        where: positionWhere,
      });

      if (openPositionCount >= maxPositions) {
        return {
          passed: false,
          detail: `持仓数上限: ${openPositionCount}/${maxPositions}${input.strategyId ? ' (本策略)' : ''}`,
        };
      }

      // 2. 同一 symbol 不开反向仓检查
      const direction = input.direction.toLowerCase();
      const oppositeSize = direction === 'buy' ? 'short' : 'long';

      const conflictingPosition = await this.prisma.position.findFirst({
        where: {
          userId: input.userId,
          symbol: input.symbol,
          side: oppositeSize,
          status: 'open',
        },
      });

      if (conflictingPosition) {
        return {
          passed: false,
          detail: `${input.symbol} 存在 ${oppositeSize} 持仓，不能开反向仓`,
        };
      }

      // 3. 同一 symbol 不重复开仓检查
      const sameSide = direction === 'buy' ? 'long' : 'short';
      const existingPosition = await this.prisma.position.findFirst({
        where: {
          userId: input.userId,
          symbol: input.symbol,
          side: sameSide,
          status: 'open',
        },
      });

      if (existingPosition) {
        return {
          passed: false,
          detail: `${input.symbol} 已有 ${sameSide} 持仓，不能重复开仓`,
        };
      }

      // 4. 开仓动作：SL/TP 强制验证 + 方向检查 + R:R 检查（仅对 open_long/open_short 执行）
      const isOpenAction = input.action === 'open_long' || input.action === 'open_short';
      if (isOpenAction) {
        // 4a. 强制要求 SL 存在（StopLoss<=0 → 硬拒绝）
        if (!input.stopLossPercent || input.stopLossPercent <= 0) {
          return {
            passed: false,
            detail: '开仓必须提供止损价格，SL 未设置或无效',
          };
        }
        // 4b. 强制要求 TP 存在（TakeProfit<=0 → 硬拒绝）
        if (!input.takeProfitPercent || input.takeProfitPercent <= 0) {
          return {
            passed: false,
            detail: '开仓必须提供止盈价格，TP 未设置或无效',
          };
        }
        // 4c. 方向性验证（open_long: SL<price,TP>price; open_short: SL>price,TP<price）
        if (input.stopLossValid === false) {
          return {
            passed: false,
            detail: `止损方向错误: ${input.action} 时 SL 应在当前价格的${input.action === 'open_long' ? '下方' : '上方'}`,
          };
        }
        if (input.takeProfitValid === false) {
          return {
            passed: false,
            detail: `止盈方向错误: ${input.action} 时 TP 应在当前价格的${input.action === 'open_long' ? '上方' : '下方'}`,
          };
        }
        // 4d. 风险收益比（riskRewardRatio < minRiskRewardRatio → 硬拒绝）
        const riskRewardRatio = input.takeProfitPercent / input.stopLossPercent;
        const requiredRR = input.strategyRiskConfig?.minRiskRewardRatio
          ?? AI_SAFETY_DEFAULTS.minRiskRewardRatio;
        if (riskRewardRatio < requiredRR) {
          return {
            passed: false,
            detail: `风险收益比不足: 止盈 ${input.takeProfitPercent.toFixed(2)}%/止损 ${input.stopLossPercent.toFixed(2)}%=${riskRewardRatio.toFixed(2)}，需 ≥ ${requiredRR}`,
          };
        }
      }

      // 拼接 ATR 信息到通过详情
      const atrInfo = (input.indicators?.atr3 != null && input.indicators?.atr14 != null && input.indicators.atr14 > 0)
        ? `, ATR3/ATR14=${(input.indicators.atr3 / input.indicators.atr14).toFixed(2)}`
        : '';

      return {
        passed: true,
        detail: `硬限制通过: 持仓 ${openPositionCount}/${maxPositions}，无冲突${atrInfo}`,
      };
    } catch (error) {
      this.logger.warn(`L9 硬限制检查出错: ${error.message}`);
      return {
        passed: false,
        detail: '硬限制检查出错，拒绝开仓（安全优先）',
      };
    }
  }

  // ========================= L10: 流动性软警告 =========================

  /**
   * L10: 流动性检查（软警告，不拦截）
   * 如果 24h 成交量不足仓位金额的 100 倍，发出滑点警告
   */
  private checkL10(input: SafetyCheckInput): { detail: string; warning?: string } {
    if (!input.volume24h) {
      return { detail: '无成交量数据，跳过 L10' };
    }

    // 优先使用 positionSizeUSD（美元），回退到 positionSize（百分比）× 粗略估算
    const posSizeUSD = input.positionSizeUSD;
    if (!posSizeUSD || posSizeUSD <= 0) {
      return { detail: `24h 成交量 $${input.volume24h.toFixed(0)}，无仓位金额，跳过` };
    }

    const minVolume = posSizeUSD * 100;

    if (input.volume24h < minVolume) {
      const ratio = (input.volume24h / posSizeUSD).toFixed(0);
      return {
        detail: `流动性不足: 24h 成交量 $${input.volume24h.toFixed(0)} < 100 倍仓位 $${minVolume.toFixed(0)}`,
        warning: `流动性警告: 24h 成交量仅为仓位的 ${ratio} 倍，可能产生滑点`,
      };
    }

    return {
      detail: `流动性正常: 24h 成交量 $${input.volume24h.toFixed(0)}`,
    };
  }
}
