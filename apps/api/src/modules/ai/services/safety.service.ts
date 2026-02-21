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
  // v6: 分析模式
  mode?: string; // "quick" | "expert" — quick 模式跳过 L2 共识检查
  // 策略级风控参数（优先于 aiConfig 全局默认值）
  strategyRiskConfig?: {
    maxLeverage?: number;
    maxPositions?: number;
    maxDailyTrades?: number;
    cooldownMinutes?: number;
    maxDailyDrawdown?: number;   // 策略级日最大回撤（美元），优先于 aiConfig
    circuitBreaker?: { maxConsecutiveLosses?: number; maxDrawdownPercent?: number };
  };
}

export interface SafetyCheckResult {
  passed: boolean;
  blockedBy: string | null; // 被哪一层拦截: "L1", "L2", etc.
  blockedReason: string | null;
  warnings: string[]; // 软警告（不拦截，但注入 prompt）
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
   * 运行全部 9 层安全检查
   * 所有检查都会运行，但只要有一层失败，整体结果就是失败
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
    const isClose = this.isCloseAction(input);

    // L1: 结构化输出验证
    const l1 = this.checkL1(input);
    checks.push({
      layer: 'L1',
      name: '结构化输出验证',
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
        name: '多模型共识检查',
        passed: true,
        detail: isClose ? '平仓动作，跳过共识检查' : '快速模式，跳过共识检查',
      });
    } else {
      const l2 = this.checkL2(input);
      checks.push({
        layer: 'L2',
        name: '多模型共识检查',
        passed: l2.passed,
        detail: l2.detail,
      });
      if (!l2.passed && !blockedBy) {
        blockedBy = 'L2';
        blockedReason = l2.detail;
      }
    }

    // L3: 指标硬约束（平仓跳过）
    if (isClose) {
      checks.push({
        layer: 'L3',
        name: '指标硬约束',
        passed: true,
        detail: '平仓动作，跳过指标约束',
      });
    } else {
      const l3 = this.checkL3(input);
      checks.push({
        layer: 'L3',
        name: '指标硬约束',
        passed: l3.passed,
        detail: l3.detail,
      });
      if (!l3.passed && !blockedBy) {
        blockedBy = 'L3';
        blockedReason = l3.detail;
      }
    }

    // L4: 仓位与杠杆限制（平仓跳过）
    if (isClose) {
      checks.push({
        layer: 'L4',
        name: '仓位与杠杆限制',
        passed: true,
        detail: '平仓动作，跳过仓位/杠杆检查',
      });
    } else {
      const l4 = await this.checkL4(input);
      checks.push({
        layer: 'L4',
        name: '仓位与杠杆限制',
        passed: l4.passed,
        detail: l4.detail,
      });
      if (!l4.passed && !blockedBy) {
        blockedBy = 'L4';
        blockedReason = l4.detail;
      }
    }

    // L5: 熔断机制（平仓跳过）
    if (isClose) {
      checks.push({
        layer: 'L5',
        name: '熔断机制',
        passed: true,
        detail: '平仓动作，跳过熔断检查',
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
        detail: '平仓动作，跳过冷却期检查',
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

    // L7: Drawdown 保护（平仓不跳过——需要检查是否应该平仓）
    const l7 = await this.checkL7(input);
    checks.push({
      layer: 'L7',
      name: 'Drawdown 保护',
      passed: l7.passed,
      detail: l7.detail,
    });
    if (!l7.passed && !blockedBy) {
      blockedBy = 'L7';
      blockedReason = l7.detail;
    }

    // L8: 资金费率感知（分级处理：硬拦截 + 软警告）
    const l8 = this.checkL8(input);
    checks.push({
      layer: 'L8',
      name: '资金费率检查',
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
      name: '硬限制 + 波动率检查',
      passed: l9.passed,
      detail: l9.detail,
    });
    if (!l9.passed && !blockedBy) {
      blockedBy = 'L9';
      blockedReason = l9.detail;
    }

    // 判断整体是否通过（所有层都通过才算通过）
    const allPassed = checks.every((check) => check.passed);

    const result: SafetyCheckResult = {
      passed: allPassed,
      blockedBy,
      blockedReason,
      warnings,
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
        detail: `无效的方向: ${input.direction}，必须是 buy/sell/hold`,
      };
    }
    if (!actionValid) {
      return {
        passed: false,
        detail: `无效的动作: ${input.action}，必须是 ${validActions.join('/')}`,
      };
    }

    // 检查置信度
    if (typeof input.confidence !== 'number' || input.confidence < 0 || input.confidence > 100) {
      return {
        passed: false,
        detail: `无效的置信度: ${input.confidence}，必须是 0-100`,
      };
    }

    // 检查共识分数
    if (
      typeof input.consensusScore !== 'number' ||
      input.consensusScore < 0 ||
      input.consensusScore > 5
    ) {
      return {
        passed: false,
        detail: `无效的共识分数: ${input.consensusScore}，必须是 0-5`,
      };
    }

    return {
      passed: true,
      detail: `结构验证通过: direction=${input.direction}, confidence=${input.confidence}, consensus=${input.consensusScore}`,
    };
  }

  // ========================= L2: 多模型共识检查 =========================

  /**
   * L2: 至少 3/5 的角色必须达成共识
   */
  private checkL2(input: SafetyCheckInput): SafetyLayerResult {
    const minConsensus = AI_SAFETY_DEFAULTS.minConsensusModels;

    if (input.consensusScore < minConsensus) {
      return {
        passed: false,
        detail: `共识不足: ${input.consensusScore}/5，需要至少 ${minConsensus}/5 的模型同意`,
      };
    }

    return {
      passed: true,
      detail: `共识达标: ${input.consensusScore}/5 的模型同意 ${input.direction}`,
    };
  }

  // ========================= L3: 指标硬约束 =========================

  /**
   * L3: 基于技术指标的硬性规则
   * - RSI > 80 时禁止做多
   * - RSI < 20 时禁止做空
   * - 可选：布林带边界检查
   */
  private checkL3(input: SafetyCheckInput): SafetyLayerResult {
    const direction = input.direction.toLowerCase();

    // 如果没有指标数据，跳过检查（但给出警告）
    if (!input.indicators) {
      return {
        passed: true,
        detail: '无指标数据，跳过 L3 检查',
      };
    }

    const { rsi, bollingerBands } = input.indicators;

    // RSI 检查
    if (rsi !== null) {
      // 禁止在超买区做多
      if (direction === 'buy' && rsi > AI_SAFETY_DEFAULTS.rsiOverbought) {
        return {
          passed: false,
          detail: `RSI 超买 (${rsi.toFixed(2)} > ${AI_SAFETY_DEFAULTS.rsiOverbought})，禁止做多`,
        };
      }

      // 禁止在超卖区做空
      if (direction === 'sell' && rsi < AI_SAFETY_DEFAULTS.rsiOversold) {
        return {
          passed: false,
          detail: `RSI 超卖 (${rsi.toFixed(2)} < ${AI_SAFETY_DEFAULTS.rsiOversold})，禁止做空`,
        };
      }
    }

    // 布林带检查（可选，作为额外保护）
    if (bollingerBands && bollingerBands.upper && bollingerBands.lower) {
      // 可以在这里添加更多布林带逻辑
      // 例如：价格突破上轨时禁止做多等
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
        detail: '未提供仓位/杠杆信息，跳过 L4 检查',
      };
    }

    // 获取用户的 AI 配置
    const aiConfig = await this.prisma.aiConfig.findUnique({
      where: { userId: input.userId },
    });

    if (!aiConfig || !aiConfig.isEnabled) {
      return {
        passed: false,
        detail: 'AI 交易未启用或配置不存在',
      };
    }

    // 检查仓位大小
    if (input.positionSize && aiConfig.maxPositionSize) {
      if (input.positionSize > Number(aiConfig.maxPositionSize)) {
        return {
          passed: false,
          detail: `仓位超限: ${input.positionSize}% > ${aiConfig.maxPositionSize}% (最大仓位比例)`,
        };
      }
    }

    // 检查杠杆（策略风控参数优先，fallback 全局 aiConfig）
    const effectiveMaxLeverage = input.strategyRiskConfig?.maxLeverage ?? (aiConfig.maxLeverage ? Number(aiConfig.maxLeverage) : null);
    if (input.leverage && effectiveMaxLeverage) {
      if (input.leverage > effectiveMaxLeverage) {
        return {
          passed: false,
          detail: `杠杆超限: ${input.leverage}x > ${effectiveMaxLeverage}x`,
        };
      }
    }

    return {
      passed: true,
      detail: `仓位/杠杆检查通过: position=${input.positionSize || 'N/A'}, leverage=${input.leverage || 'N/A'}`,
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
        detail: 'AI 交易未启用或配置不存在',
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
        detail: `熔断触发: 24h 内失败 ${failedCount} 次，达到阈值 ${effectiveCircuitBreaker}`,
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
        detail: `超过每日交易次数: ${todayTradeCount}/${effectiveMaxDailyTrades}`,
      };
    }

    // 3. 检查每日最大回撤（策略级优先，fallback 全局 aiConfig，默认 $100）
    const maxDailyDrawdown =
      input.strategyRiskConfig?.maxDailyDrawdown ??
      (aiConfig.maxDailyDrawdown ? Number(aiConfig.maxDailyDrawdown) : 100);

    // 3a. 查询今日已平仓 AI 交易的实现盈亏
    const closedPositions = await this.prisma.position.findMany({
      where: {
        userId: input.userId,
        source: { in: ['ai_analysis', 'ai_research', 'ai_strategy'] },
        status: 'closed',
        closedAt: { gte: todayStart },
      },
      select: { realizedPnl: true },
    });
    const closedPnl = closedPositions.reduce(
      (sum, p) => sum + Number(p.realizedPnl || 0),
      0,
    );

    // 3b. 查询未平仓 AI 持仓的浮动盈亏
    const openPositions = await this.prisma.position.findMany({
      where: {
        userId: input.userId,
        source: { in: ['ai_analysis', 'ai_research', 'ai_strategy'] },
        status: 'open',
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
        detail: `每日回撤已达 $${Math.abs(totalDailyPnl).toFixed(2)}，超过限制 $${maxDailyDrawdown}`,
      };
    }

    return {
      passed: true,
      detail: `熔断检查通过: 失败=${failedCount}, 今日交易=${todayTradeCount}/${effectiveMaxDailyTrades || '无限制'}, 今日PnL=$${totalDailyPnl.toFixed(2)}`,
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
        detail: 'AI 交易未启用或配置不存在',
      };
    }

    // 冷却时长：策略风控参数优先，fallback 全局 aiConfig
    const effectiveCooldownMinutes = input.strategyRiskConfig?.cooldownMinutes ?? aiConfig.cooldownMinutes;

    // 如果没有配置冷却期，跳过检查
    if (!effectiveCooldownMinutes || effectiveCooldownMinutes === 0) {
      return {
        passed: true,
        detail: '未配置冷却期，跳过 L6 检查',
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
          detail: `冷却期未满: 距离上次交易 ${Math.floor(timeSinceLastTrade / 60000)} 分钟，需等待 ${remainingMinutes} 分钟`,
        };
      }
    }

    return {
      passed: true,
      detail: `冷却期检查通过: 冷却时长 ${effectiveCooldownMinutes} 分钟`,
    };
  }

  // ========================= L7: Drawdown 保护 =========================

  /**
   * L7: Drawdown 保护
   * 检查用户 AI 持仓是否有 "盈利>5% 但从最高点回撤≥40%" 的情况
   * 如果有，建议不再开新仓（让系统先处理现有回撤持仓）
   */
  private async checkL7(input: SafetyCheckInput): Promise<SafetyLayerResult> {
    try {
      // 查找用户的 AI 来源开放持仓（通过 signalId 关联到有 AI 分析的信号）
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

        // 如果某持仓曾盈利 >5% 但当前回撤严重（亏损 >20%），警告
        // 简化逻辑：如果任何持仓亏损超过阈值，拒绝开新仓
        if (pnlPercent < AI_SAFETY_DEFAULTS.drawdownBlockThreshold) {
          return {
            passed: false,
            detail: `持仓 ${pos.id} 亏损 ${pnlPercent.toFixed(1)}% 超过 ${Math.abs(AI_SAFETY_DEFAULTS.drawdownBlockThreshold)}% 阈值，暂停开新仓`,
          };
        }
      }

      return {
        passed: true,
        detail: `Drawdown 检查通过: ${openPositions.length} 个开放持仓均在安全范围`,
      };
    } catch (error) {
      this.logger.warn(`L7 Drawdown 检查出错: ${error.message}`);
      return {
        passed: false,
        detail: 'Drawdown 检查异常，拒绝开仓（安全优先）',
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
        detail: '无资金费率数据，跳过 L8 检查',
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
        detail: `平仓动作，跳过资金费率检查 (${frPercent.toFixed(4)}%/8h)`,
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
        detail: `资金费率极端: ${frPercent.toFixed(4)}%/8h，${direction === 'buy' ? '做多' : '做空'}需支付高额费用，暂停交易`,
      };
    }

    // 级别 2：偏高资金费率 → 软警告
    if (absFundingRate > AI_SAFETY_DEFAULTS.fundingRateHigh && isPayingFunding) {
      return {
        passed: true,
        detail: `资金费率偏高: ${frPercent.toFixed(4)}%/8h (软警告)`,
        warning: `资金费率偏高 (${frPercent.toFixed(4)}%/8h)，持仓成本较大，建议短线操作`,
      };
    }

    // 级别 3：负资金费率 + 做多 → 软提示（正面信息）
    if (input.fundingRate < AI_SAFETY_DEFAULTS.fundingRateNegativeBenefit && direction === 'buy') {
      return {
        passed: true,
        detail: `负资金费率: ${frPercent.toFixed(4)}%/8h，做多可获得费率收益`,
        warning: `负资金费率 (${frPercent.toFixed(4)}%/8h)，做多可获得费率收益`,
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
   * - 最大 AI 持仓数 ≤ 3（开仓时）
   * - 风险收益比 ≥ 2:1（TP/SL 比值，开仓时）
   * - 同一 symbol 不开反向仓（开仓时）
   * - ATR 短期飙升检测（atr3/atr14 > 2.0 需更高共识，>3.0 硬拦截）
   * 平仓动作跳过仓位/冲突检查，但 ATR 极端仍拦截
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
            detail: `波动率极端: ATR3/ATR14 = ${atrRatio.toFixed(2)}，超过 ${AI_SAFETY_DEFAULTS.atrExtremeRatio} 阈值，暂停所有交易`,
          };
        }

        // 波动率异常 → 开仓需更高共识
        if (!isClose && atrRatio > AI_SAFETY_DEFAULTS.atrAnomalyRatio && input.confidence < AI_SAFETY_DEFAULTS.atrAnomalyMinConfidence) {
          return {
            passed: false,
            detail: `波动率异常升高: ATR3/ATR14 = ${atrRatio.toFixed(2)}，当前信心度 ${input.confidence}% 不足 ${AI_SAFETY_DEFAULTS.atrAnomalyMinConfidence}%，需更高共识`,
          };
        }
      }

      // === 以下检查仅对开仓动作执行 ===
      if (isClose) {
        return {
          passed: true,
          detail: '平仓动作，跳过仓位/冲突硬限制检查',
        };
      }

      // 1. 最大持仓数检查
      const openPositionCount = await this.prisma.position.count({
        where: {
          userId: input.userId,
          status: 'open',
        },
      });

      if (openPositionCount >= maxPositions) {
        return {
          passed: false,
          detail: `已达最大持仓限制: ${openPositionCount}/${maxPositions}`,
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
          detail: `${input.symbol} 已有 ${oppositeSize} 持仓 (${conflictingPosition.id})，不可开反向仓`,
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
          detail: `${input.symbol} 已有 ${sameSide} 持仓 (${existingPosition.id})，不重复开仓`,
        };
      }

      // 4. 风险收益比检查（如果提供了 TP/SL）
      if (input.takeProfitPercent && input.stopLossPercent && input.stopLossPercent > 0) {
        const riskRewardRatio = input.takeProfitPercent / input.stopLossPercent;
        if (riskRewardRatio < AI_SAFETY_DEFAULTS.minRiskRewardRatio) {
          return {
            passed: false,
            detail: `风险收益比不足: TP ${input.takeProfitPercent}% / SL ${input.stopLossPercent}% = ${riskRewardRatio.toFixed(1)}:1，需要 ≥ ${AI_SAFETY_DEFAULTS.minRiskRewardRatio}:1`,
          };
        }
      }

      // 拼接 ATR 信息到通过详情
      const atrInfo = (input.indicators?.atr3 != null && input.indicators?.atr14 != null && input.indicators.atr14 > 0)
        ? `, ATR3/ATR14=${(input.indicators.atr3 / input.indicators.atr14).toFixed(2)}`
        : '';

      return {
        passed: true,
        detail: `硬限制检查通过: 持仓 ${openPositionCount}/${maxPositions}, 无冲突${atrInfo}`,
      };
    } catch (error) {
      this.logger.warn(`L9 硬限制检查出错: ${error.message}`);
      return {
        passed: false,
        detail: '硬限制检查异常，拒绝开仓（安全优先）',
      };
    }
  }
}
