import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { BacktestRequestDto, BacktestResultDto, CurveDataPoint } from './dto/backtest.dto';
import Decimal from 'decimal.js';

/**
 * 回测服务
 * 提供策略历史数据回测功能
 *
 * 注意：当前版本使用模拟数据生成回测结果
 * 后续可集成 Freqtrade 的实际回测引擎
 */
@Injectable()
export class BacktestService {
  private readonly logger = new Logger(BacktestService.name);
  private readonly isSandboxMode: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.isSandboxMode =
      this.configService.get<string>('BACKTEST_SANDBOX_MODE') !== 'false';

    if (this.isSandboxMode) {
      this.logger.warn('⚠️ 回测服务运行在沙盒模式（返回模拟数据）');
    }
  }

  /**
   * 执行策略回测
   * @param userId 用户 ID
   * @param dto 回测请求参数
   * @returns 回测结果
   */
  async runBacktest(userId: string, dto: BacktestRequestDto): Promise<BacktestResultDto> {
    this.logger.log(
      `用户 ${userId} 发起回测: 策略=${dto.strategyId}, 时间范围=${dto.startDate}~${dto.endDate}`,
    );

    // 验证策略是否存在
    const strategy = await this.prisma.client.strategies.findUnique({
      where: { id: dto.strategyId },
    });

    if (!strategy) {
      throw new NotFoundException('策略不存在');
    }

    // 获取策略配置（如果有）
    const strategyConfig = strategy.config as Record<string, any> || {};

    // 沙盒模式：生成模拟回测数据
    if (this.isSandboxMode) {
      return this.generateSimulatedBacktest(dto, strategy.name, strategyConfig);
    }

    // TODO: 实际回测逻辑（调用 Freqtrade backtesting API）
    // 当前版本返回模拟数据
    return this.generateSimulatedBacktest(dto, strategy.name, strategyConfig);
  }

  /**
   * 生成模拟回测结果
   * 基于策略特性和历史市场波动模型生成合理的回测数据
   */
  private generateSimulatedBacktest(
    dto: BacktestRequestDto,
    strategyName: string,
    strategyConfig: Record<string, any>,
  ): BacktestResultDto {
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    const days = Math.ceil(
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
    );

    // 根据策略名称调整收益参数
    let baseReturn = 0.15; // 基础年化 15%
    let volatility = 0.02; // 日波动率 2%
    let baseWinRate = 0.55; // 基础胜率 55%

    // 根据策略类型调整参数
    const lowerName = strategyName.toLowerCase();
    if (lowerName.includes('稳健') || lowerName.includes('防御') || lowerName.includes('rsi')) {
      baseReturn = 0.12;
      volatility = 0.015;
      baseWinRate = 0.60;
    } else if (lowerName.includes('激进') || lowerName.includes('macd')) {
      baseReturn = 0.25;
      volatility = 0.035;
      baseWinRate = 0.50;
    } else if (lowerName.includes('布林') || lowerName.includes('bollinger')) {
      baseReturn = 0.18;
      volatility = 0.025;
      baseWinRate = 0.52;
    }

    // 杠杆倍数影响
    const leverage = dto.leverage || 1;
    baseReturn *= leverage;
    volatility *= leverage;

    // 生成收益曲线
    const curve: CurveDataPoint[] = [];
    let currentValue = new Decimal(dto.initialCapital);
    let maxValue = new Decimal(dto.initialCapital);
    let maxDrawdown = new Decimal(0);
    let totalTrades = 0;
    let winTrades = 0;
    let totalProfit = new Decimal(0);
    let totalLoss = new Decimal(0);
    let profitCount = 0;
    let lossCount = 0;

    // 日收益率（从年化转换）
    const dailyReturn = baseReturn / 365;

    // 每周生成一个数据点
    for (let i = 0; i <= days; i += 7) {
      const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);

      // 模拟周收益（基于正态分布）
      const weeklyReturn = this.normalRandom(dailyReturn * 7, volatility * Math.sqrt(7));
      const changeAmount = currentValue.mul(weeklyReturn);
      currentValue = currentValue.plus(changeAmount);

      // 确保不会跌破 0
      if (currentValue.lt(0)) {
        currentValue = new Decimal(dto.initialCapital * 0.1);
      }

      // 更新最大值和回撤
      if (currentValue.gt(maxValue)) {
        maxValue = currentValue;
      }
      const drawdown = maxValue.minus(currentValue).div(maxValue).mul(100);
      if (drawdown.gt(maxDrawdown)) {
        maxDrawdown = drawdown;
      }

      // 模拟交易次数和胜负
      const weekTrades = Math.floor(Math.random() * 10) + 1;
      totalTrades += weekTrades;

      const weekWinRate = baseWinRate + (Math.random() - 0.5) * 0.1;
      const weekWins = Math.round(weekTrades * weekWinRate);
      winTrades += weekWins;

      // 模拟盈亏金额
      for (let j = 0; j < weekTrades; j++) {
        if (j < weekWins) {
          // 盈利交易
          const profit = new Decimal(30 + Math.random() * 70); // 30-100 USDT
          totalProfit = totalProfit.plus(profit);
          profitCount++;
        } else {
          // 亏损交易
          const loss = new Decimal(20 + Math.random() * 40); // 20-60 USDT
          totalLoss = totalLoss.plus(loss);
          lossCount++;
        }
      }

      curve.push({
        date: date.toISOString().split('T')[0],
        value: Number(currentValue.toFixed(2)),
        trades: weekTrades,
      });
    }

    // 计算统计指标
    const totalReturn = currentValue
      .minus(dto.initialCapital)
      .div(dto.initialCapital)
      .mul(100)
      .toNumber();

    const winRate = totalTrades > 0 ? (winTrades / totalTrades) * 100 : 0;
    const avgProfit = profitCount > 0 ? totalProfit.div(profitCount).toNumber() : 0;
    const avgLoss = lossCount > 0 ? totalLoss.div(lossCount).neg().toNumber() : 0;
    const profitFactor =
      totalLoss.gt(0) ? totalProfit.div(totalLoss).toNumber() : totalProfit.toNumber();

    // 计算夏普比率（简化版）
    // Sharpe = (平均收益率 - 无风险利率) / 收益率标准差
    const annualizedReturn = (totalReturn / days) * 365;
    const riskFreeRate = 4; // 假设无风险利率 4%
    const annualizedVolatility = volatility * Math.sqrt(365) * 100;
    const sharpeRatio =
      annualizedVolatility > 0
        ? (annualizedReturn - riskFreeRate) / annualizedVolatility
        : 0;

    const result: BacktestResultDto = {
      totalReturn: Number(totalReturn.toFixed(2)),
      winRate: Number(winRate.toFixed(2)),
      maxDrawdown: Number(maxDrawdown.neg().toFixed(2)),
      sharpeRatio: Number(Math.max(0, sharpeRatio).toFixed(2)),
      totalTrades,
      avgProfit: Number(avgProfit.toFixed(2)),
      avgLoss: Number(avgLoss.toFixed(2)),
      profitFactor: Number(Math.min(10, profitFactor).toFixed(2)),
      curve,
      strategyName,
      startDate: dto.startDate,
      endDate: dto.endDate,
      initialCapital: dto.initialCapital,
      finalCapital: Number(currentValue.toFixed(2)),
      pairs: dto.pairs,
    };

    this.logger.log(
      `回测完成: 策略=${strategyName}, 收益率=${result.totalReturn}%, 胜率=${result.winRate}%`,
    );

    return result;
  }

  /**
   * 正态分布随机数生成（Box-Muller 变换）
   */
  private normalRandom(mean: number, stdDev: number): number {
    const u1 = Math.random();
    const u2 = Math.random();
    const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    return z0 * stdDev + mean;
  }

  /**
   * 获取用户的回测历史（未来功能）
   */
  async getBacktestHistory(userId: string): Promise<any[]> {
    // TODO: 实现回测历史记录存储和查询
    // 当前返回空数组
    return [];
  }
}
