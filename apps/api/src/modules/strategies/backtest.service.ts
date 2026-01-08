import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { BacktestRequestDto, BacktestResultDto } from './dto/backtest.dto';
import {
  VisualBacktestRequestDto,
  IndicatorType,
  OperatorType,
  IndicatorConfigDto,
  ConditionConfigDto,
} from './dto/visual-backtest.dto';
import { firstValueFrom } from 'rxjs';

/**
 * K 线数据结构
 */
interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * 交易记录
 */
interface Trade {
  entryTime: string;
  exitTime: string;
  entryPrice: number;
  exitPrice: number;
  pnl: number;
  pnlPercent: number;
  type: 'long' | 'short';
}

/**
 * 回测服务
 *
 * 支持两种回测模式：
 * 1. Freqtrade 回测：由用户 VPS 上的 Freqtrade 执行（需要 VPS）
 * 2. 可视化回测：基于用户配置的指标和条件进行模拟回测（不需要 VPS）
 */
@Injectable()
export class BacktestService {
  private readonly logger = new Logger(BacktestService.name);

  constructor(private readonly httpService: HttpService) {
    this.logger.log('回测服务已启动');
  }

  /**
   * 验证回测请求参数
   */
  validateBacktestRequest(dto: BacktestRequestDto): void {
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    const now = new Date();

    if (startDate >= endDate) {
      throw new BadRequestException('开始日期必须早于结束日期');
    }

    if (endDate > now) {
      throw new BadRequestException('结束日期不能晚于今天');
    }

    const daysDiff =
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysDiff > 365) {
      throw new BadRequestException('回测时间范围不能超过 365 天');
    }

    if (!dto.pairs || dto.pairs.length === 0) {
      throw new BadRequestException('请至少选择一个交易对');
    }

    if (dto.initialCapital <= 0) {
      throw new BadRequestException('初始资金必须大于 0');
    }
  }

  /**
   * 执行可视化策略回测
   * 基于用户配置的指标和条件进行模拟回测
   */
  async runVisualBacktest(dto: VisualBacktestRequestDto): Promise<any> {
    this.logger.log(`开始可视化回测: ${dto.name}`);

    // 1. 验证参数
    this.validateVisualBacktestRequest(dto);

    // 2. 获取历史 K 线数据
    const candles = await this.fetchKlineData(
      dto.pairs[0], // 使用第一个交易对
      dto.timeframe || '4h',
      dto.startDate,
      dto.endDate,
    );

    if (candles.length < 50) {
      throw new BadRequestException('历史数据不足，请扩大时间范围或更换交易对');
    }

    this.logger.log(`获取到 ${candles.length} 根 K 线数据`);

    // 3. 计算所有指标
    const indicatorValues = this.calculateIndicators(candles, dto.indicators);

    // 4. 执行模拟交易
    const trades = this.simulateTrades(
      candles,
      indicatorValues,
      dto.buyConditions,
      dto.sellConditions,
      dto.riskManagement,
      dto.initialCapital,
      dto.leverage || 1,
    );

    // 5. 计算回测统计
    const stats = this.calculateStats(trades, dto.initialCapital);

    // 6. 生成资金曲线
    const curve = this.generateEquityCurve(trades, dto.initialCapital);

    return {
      strategyName: dto.name,
      totalReturn: stats.totalReturn,
      winRate: stats.winRate,
      maxDrawdown: stats.maxDrawdown,
      sharpeRatio: stats.sharpeRatio,
      totalTrades: trades.length,
      avgProfit: stats.avgProfit,
      avgLoss: stats.avgLoss,
      profitFactor: stats.profitFactor,
      startDate: dto.startDate,
      endDate: dto.endDate,
      initialCapital: dto.initialCapital,
      pairs: dto.pairs,
      curve,
      trades: trades.slice(0, 50), // 返回最近 50 笔交易
    };
  }

  /**
   * 验证可视化回测请求参数
   */
  private validateVisualBacktestRequest(dto: VisualBacktestRequestDto): void {
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    const now = new Date();

    if (startDate >= endDate) {
      throw new BadRequestException('开始日期必须早于结束日期');
    }

    if (endDate > now) {
      throw new BadRequestException('结束日期不能晚于今天');
    }

    const daysDiff =
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysDiff > 365) {
      throw new BadRequestException('回测时间范围不能超过 365 天');
    }

    if (!dto.indicators || dto.indicators.length === 0) {
      throw new BadRequestException('请至少配置一个技术指标');
    }

    if (!dto.buyConditions || dto.buyConditions.length === 0) {
      throw new BadRequestException('请至少配置一个买入条件');
    }

    if (!dto.sellConditions || dto.sellConditions.length === 0) {
      throw new BadRequestException('请至少配置一个卖出条件');
    }
  }

  /**
   * 从 Binance 获取历史 K 线数据
   */
  private async fetchKlineData(
    pair: string,
    timeframe: string,
    startDate: string,
    endDate: string,
  ): Promise<Candle[]> {
    // 转换交易对格式：BTC/USDT -> BTCUSDT
    const symbol = pair.replace('/', '');

    // 转换时间周期格式
    const intervalMap: Record<string, string> = {
      '1m': '1m',
      '5m': '5m',
      '15m': '15m',
      '30m': '30m',
      '1h': '1h',
      '4h': '4h',
      '1d': '1d',
    };
    const interval = intervalMap[timeframe] || '4h';

    const startTime = new Date(startDate).getTime();
    const endTime = new Date(endDate).getTime();

    try {
      // Binance API 限制每次最多 1000 根 K 线
      const allCandles: Candle[] = [];
      let currentStartTime = startTime;

      while (currentStartTime < endTime) {
        const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&startTime=${currentStartTime}&endTime=${endTime}&limit=1000`;

        const response = await firstValueFrom(this.httpService.get(url));
        const data = response.data as any[];

        if (data.length === 0) break;

        for (const item of data) {
          allCandles.push({
            time: item[0],
            open: parseFloat(item[1]),
            high: parseFloat(item[2]),
            low: parseFloat(item[3]),
            close: parseFloat(item[4]),
            volume: parseFloat(item[5]),
          });
        }

        // 更新起始时间为最后一根 K 线的时间 + 1
        currentStartTime = data[data.length - 1][0] + 1;

        // 避免请求过快
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      return allCandles;
    } catch (error: any) {
      this.logger.error(`获取 K 线数据失败: ${error.message}`);
      throw new BadRequestException(
        `获取历史数据失败，请检查交易对是否正确: ${pair}`,
      );
    }
  }

  /**
   * 计算技术指标
   */
  private calculateIndicators(
    candles: Candle[],
    indicators: IndicatorConfigDto[],
  ): Map<string, number[]> {
    const result = new Map<string, number[]>();
    const closes = candles.map((c) => c.close);
    const highs = candles.map((c) => c.high);
    const lows = candles.map((c) => c.low);

    for (const indicator of indicators) {
      switch (indicator.type) {
        case IndicatorType.RSI:
          result.set(indicator.id, this.calculateRSI(closes, indicator.params.period || 14));
          break;

        case IndicatorType.MACD: {
          const macdResult = this.calculateMACD(
            closes,
            indicator.params.fastPeriod || 12,
            indicator.params.slowPeriod || 26,
            indicator.params.signalPeriod || 9,
          );
          result.set(`${indicator.id}_macd`, macdResult.macd);
          result.set(`${indicator.id}_signal`, macdResult.signal);
          result.set(`${indicator.id}_histogram`, macdResult.histogram);
          break;
        }

        case IndicatorType.MA:
          result.set(indicator.id, this.calculateSMA(closes, indicator.params.period || 20));
          break;

        case IndicatorType.EMA:
          result.set(indicator.id, this.calculateEMA(closes, indicator.params.period || 20));
          break;

        case IndicatorType.BOLLINGER: {
          const bbResult = this.calculateBollingerBands(
            closes,
            indicator.params.period || 20,
            indicator.params.stdDev || 2,
          );
          result.set(`${indicator.id}_upper`, bbResult.upper);
          result.set(`${indicator.id}_middle`, bbResult.middle);
          result.set(`${indicator.id}_lower`, bbResult.lower);
          break;
        }

        case IndicatorType.ATR:
          result.set(indicator.id, this.calculateATR(highs, lows, closes, indicator.params.period || 14));
          break;

        case IndicatorType.STOCH: {
          const stochResult = this.calculateStochastic(
            highs,
            lows,
            closes,
            indicator.params.kPeriod || 14,
            indicator.params.dPeriod || 3,
          );
          result.set(`${indicator.id}_k`, stochResult.k);
          result.set(`${indicator.id}_d`, stochResult.d);
          break;
        }

        case IndicatorType.ADX:
          result.set(indicator.id, this.calculateADX(highs, lows, closes, indicator.params.period || 14));
          break;
      }
    }

    return result;
  }

  /**
   * 计算 RSI
   */
  private calculateRSI(closes: number[], period: number): number[] {
    const rsi: number[] = new Array(closes.length).fill(NaN);
    if (closes.length < period + 1) return rsi;

    let gains = 0;
    let losses = 0;

    // 计算初始平均值
    for (let i = 1; i <= period; i++) {
      const change = closes[i] - closes[i - 1];
      if (change > 0) gains += change;
      else losses -= change;
    }

    let avgGain = gains / period;
    let avgLoss = losses / period;

    rsi[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

    // 计算后续 RSI
    for (let i = period + 1; i < closes.length; i++) {
      const change = closes[i] - closes[i - 1];
      const gain = change > 0 ? change : 0;
      const loss = change < 0 ? -change : 0;

      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;

      rsi[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
    }

    return rsi;
  }

  /**
   * 计算 MACD
   */
  private calculateMACD(
    closes: number[],
    fastPeriod: number,
    slowPeriod: number,
    signalPeriod: number,
  ): { macd: number[]; signal: number[]; histogram: number[] } {
    const fastEMA = this.calculateEMA(closes, fastPeriod);
    const slowEMA = this.calculateEMA(closes, slowPeriod);

    const macd = fastEMA.map((fast, i) =>
      !isNaN(fast) && !isNaN(slowEMA[i]) ? fast - slowEMA[i] : NaN,
    );

    const signal = this.calculateEMA(macd, signalPeriod);

    const histogram = macd.map((m, i) =>
      !isNaN(m) && !isNaN(signal[i]) ? m - signal[i] : NaN,
    );

    return { macd, signal, histogram };
  }

  /**
   * 计算 SMA
   */
  private calculateSMA(data: number[], period: number): number[] {
    const result: number[] = new Array(data.length).fill(NaN);

    for (let i = period - 1; i < data.length; i++) {
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += data[i - j];
      }
      result[i] = sum / period;
    }

    return result;
  }

  /**
   * 计算 EMA
   */
  private calculateEMA(data: number[], period: number): number[] {
    const result: number[] = new Array(data.length).fill(NaN);
    const multiplier = 2 / (period + 1);

    // 使用 SMA 作为初始 EMA
    let sum = 0;
    let validCount = 0;
    for (let i = 0; i < period && i < data.length; i++) {
      if (!isNaN(data[i])) {
        sum += data[i];
        validCount++;
      }
    }

    if (validCount === 0) return result;

    result[period - 1] = sum / validCount;

    for (let i = period; i < data.length; i++) {
      if (!isNaN(data[i]) && !isNaN(result[i - 1])) {
        result[i] = (data[i] - result[i - 1]) * multiplier + result[i - 1];
      }
    }

    return result;
  }

  /**
   * 计算布林带
   */
  private calculateBollingerBands(
    closes: number[],
    period: number,
    stdDev: number,
  ): { upper: number[]; middle: number[]; lower: number[] } {
    const middle = this.calculateSMA(closes, period);
    const upper: number[] = new Array(closes.length).fill(NaN);
    const lower: number[] = new Array(closes.length).fill(NaN);

    for (let i = period - 1; i < closes.length; i++) {
      let sumSq = 0;
      for (let j = 0; j < period; j++) {
        sumSq += Math.pow(closes[i - j] - middle[i], 2);
      }
      const std = Math.sqrt(sumSq / period);
      upper[i] = middle[i] + stdDev * std;
      lower[i] = middle[i] - stdDev * std;
    }

    return { upper, middle, lower };
  }

  /**
   * 计算 ATR
   */
  private calculateATR(
    highs: number[],
    lows: number[],
    closes: number[],
    period: number,
  ): number[] {
    const tr: number[] = [];

    for (let i = 0; i < closes.length; i++) {
      if (i === 0) {
        tr.push(highs[i] - lows[i]);
      } else {
        const hl = highs[i] - lows[i];
        const hc = Math.abs(highs[i] - closes[i - 1]);
        const lc = Math.abs(lows[i] - closes[i - 1]);
        tr.push(Math.max(hl, hc, lc));
      }
    }

    return this.calculateSMA(tr, period);
  }

  /**
   * 计算随机指标
   */
  private calculateStochastic(
    highs: number[],
    lows: number[],
    closes: number[],
    kPeriod: number,
    dPeriod: number,
  ): { k: number[]; d: number[] } {
    const k: number[] = new Array(closes.length).fill(NaN);

    for (let i = kPeriod - 1; i < closes.length; i++) {
      let highestHigh = -Infinity;
      let lowestLow = Infinity;

      for (let j = 0; j < kPeriod; j++) {
        highestHigh = Math.max(highestHigh, highs[i - j]);
        lowestLow = Math.min(lowestLow, lows[i - j]);
      }

      const range = highestHigh - lowestLow;
      k[i] = range === 0 ? 50 : ((closes[i] - lowestLow) / range) * 100;
    }

    const d = this.calculateSMA(k, dPeriod);

    return { k, d };
  }

  /**
   * 计算 ADX
   */
  private calculateADX(
    highs: number[],
    lows: number[],
    closes: number[],
    period: number,
  ): number[] {
    const adx: number[] = new Array(closes.length).fill(NaN);
    // 简化实现：返回模拟 ADX 值
    const atr = this.calculateATR(highs, lows, closes, period);

    for (let i = period * 2; i < closes.length; i++) {
      // 简化计算
      const volatility = atr[i] / closes[i];
      adx[i] = Math.min(100, Math.max(0, volatility * 1000));
    }

    return adx;
  }

  /**
   * 模拟交易
   */
  private simulateTrades(
    candles: Candle[],
    indicatorValues: Map<string, number[]>,
    buyConditions: ConditionConfigDto[],
    sellConditions: ConditionConfigDto[],
    riskManagement: { stoploss: number; takeProfit: number; trailingStop: boolean; trailingStopOffset?: number },
    initialCapital: number,
    leverage: number,
  ): Trade[] {
    const trades: Trade[] = [];
    let inPosition = false;
    let entryPrice = 0;
    let entryTime = '';
    let highestPrice = 0;

    // 从第 50 根 K 线开始（确保指标有效）
    for (let i = 50; i < candles.length; i++) {
      const candle = candles[i];

      if (!inPosition) {
        // 检查买入条件
        if (this.checkConditions(buyConditions, indicatorValues, i, candle.close)) {
          inPosition = true;
          entryPrice = candle.close;
          entryTime = new Date(candle.time).toISOString();
          highestPrice = candle.close;
        }
      } else {
        // 更新最高价（用于移动止损）
        highestPrice = Math.max(highestPrice, candle.close);

        // 检查止损
        const pnlPercent = (candle.close - entryPrice) / entryPrice;
        if (pnlPercent <= riskManagement.stoploss) {
          trades.push(this.closeTrade(entryTime, candle, entryPrice, 'stoploss', leverage));
          inPosition = false;
          continue;
        }

        // 检查止盈
        if (pnlPercent >= riskManagement.takeProfit) {
          trades.push(this.closeTrade(entryTime, candle, entryPrice, 'takeprofit', leverage));
          inPosition = false;
          continue;
        }

        // 检查移动止损
        if (riskManagement.trailingStop) {
          const trailingStopPrice =
            highestPrice * (1 - (riskManagement.trailingStopOffset || 0.02));
          if (candle.close <= trailingStopPrice) {
            trades.push(this.closeTrade(entryTime, candle, entryPrice, 'trailing', leverage));
            inPosition = false;
            continue;
          }
        }

        // 检查卖出条件
        if (this.checkConditions(sellConditions, indicatorValues, i, candle.close)) {
          trades.push(this.closeTrade(entryTime, candle, entryPrice, 'signal', leverage));
          inPosition = false;
        }
      }
    }

    // 如果最后还在持仓，强制平仓
    if (inPosition && candles.length > 0) {
      const lastCandle = candles[candles.length - 1];
      trades.push(this.closeTrade(entryTime, lastCandle, entryPrice, 'end', leverage));
    }

    return trades;
  }

  /**
   * 创建平仓交易记录
   */
  private closeTrade(
    entryTime: string,
    exitCandle: Candle,
    entryPrice: number,
    reason: string,
    leverage: number,
  ): Trade {
    const pnlPercent = ((exitCandle.close - entryPrice) / entryPrice) * leverage;
    return {
      entryTime,
      exitTime: new Date(exitCandle.time).toISOString(),
      entryPrice,
      exitPrice: exitCandle.close,
      pnl: pnlPercent * 100,
      pnlPercent: pnlPercent * 100,
      type: 'long',
    };
  }

  /**
   * 检查交易条件
   */
  private checkConditions(
    conditions: ConditionConfigDto[],
    indicatorValues: Map<string, number[]>,
    index: number,
    currentPrice: number,
  ): boolean {
    for (const condition of conditions) {
      const indicatorKey = condition.field
        ? `${condition.indicator}_${condition.field}`
        : condition.indicator;
      const values = indicatorValues.get(indicatorKey);

      if (!values || isNaN(values[index])) {
        return false;
      }

      const indicatorValue = values[index];
      let targetValue: number;

      // 解析比较值
      if (typeof condition.value === 'string') {
        // 引用另一个指标
        const targetValues = indicatorValues.get(condition.value);
        if (!targetValues || isNaN(targetValues[index])) {
          return false;
        }
        targetValue = targetValues[index];
      } else {
        targetValue = condition.value;
      }

      // 执行比较
      let conditionMet = false;
      switch (condition.operator) {
        case OperatorType.LT:
          conditionMet = indicatorValue < targetValue;
          break;
        case OperatorType.GT:
          conditionMet = indicatorValue > targetValue;
          break;
        case OperatorType.EQ:
          conditionMet = Math.abs(indicatorValue - targetValue) < 0.0001;
          break;
        case OperatorType.CROSS_ABOVE:
          if (index > 0) {
            const prevValue = values[index - 1];
            const prevTarget =
              typeof condition.value === 'string'
                ? indicatorValues.get(condition.value)?.[index - 1] ?? targetValue
                : targetValue;
            conditionMet = prevValue <= prevTarget && indicatorValue > targetValue;
          }
          break;
        case OperatorType.CROSS_BELOW:
          if (index > 0) {
            const prevValue = values[index - 1];
            const prevTarget =
              typeof condition.value === 'string'
                ? indicatorValues.get(condition.value)?.[index - 1] ?? targetValue
                : targetValue;
            conditionMet = prevValue >= prevTarget && indicatorValue < targetValue;
          }
          break;
      }

      if (!conditionMet) {
        return false;
      }
    }

    return conditions.length > 0;
  }

  /**
   * 计算回测统计
   */
  private calculateStats(
    trades: Trade[],
    initialCapital: number,
  ): {
    totalReturn: number;
    winRate: number;
    maxDrawdown: number;
    sharpeRatio: number;
    avgProfit: number;
    avgLoss: number;
    profitFactor: number;
  } {
    if (trades.length === 0) {
      return {
        totalReturn: 0,
        winRate: 0,
        maxDrawdown: 0,
        sharpeRatio: 0,
        avgProfit: 0,
        avgLoss: 0,
        profitFactor: 0,
      };
    }

    const profits = trades.filter((t) => t.pnl > 0);
    const losses = trades.filter((t) => t.pnl <= 0);

    const totalPnl = trades.reduce((sum, t) => sum + t.pnl, 0);
    const totalReturn = totalPnl;

    const winRate = (profits.length / trades.length) * 100;

    const avgProfit =
      profits.length > 0
        ? profits.reduce((sum, t) => sum + t.pnl, 0) / profits.length
        : 0;

    const avgLoss =
      losses.length > 0
        ? losses.reduce((sum, t) => sum + t.pnl, 0) / losses.length
        : 0;

    const totalProfit = profits.reduce((sum, t) => sum + t.pnl, 0);
    const totalLoss = Math.abs(losses.reduce((sum, t) => sum + t.pnl, 0));
    const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? 999 : 0;

    // 计算最大回撤
    let peak = initialCapital;
    let maxDrawdown = 0;
    let capital = initialCapital;

    for (const trade of trades) {
      capital += (capital * trade.pnl) / 100;
      peak = Math.max(peak, capital);
      const drawdown = ((peak - capital) / peak) * 100;
      maxDrawdown = Math.max(maxDrawdown, drawdown);
    }

    // 简化的夏普比率计算
    const returns = trades.map((t) => t.pnl);
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const stdDev = Math.sqrt(
      returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length,
    );
    const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0;

    return {
      totalReturn: Number(totalReturn.toFixed(2)),
      winRate: Number(winRate.toFixed(2)),
      maxDrawdown: Number(maxDrawdown.toFixed(2)),
      sharpeRatio: Number(sharpeRatio.toFixed(2)),
      avgProfit: Number(avgProfit.toFixed(2)),
      avgLoss: Number(avgLoss.toFixed(2)),
      profitFactor: Number(profitFactor.toFixed(2)),
    };
  }

  /**
   * 生成资金曲线
   */
  private generateEquityCurve(
    trades: Trade[],
    initialCapital: number,
  ): Array<{ date: string; value: number; trades: number }> {
    if (trades.length === 0) {
      return [
        {
          date: new Date().toISOString().split('T')[0],
          value: initialCapital,
          trades: 0,
        },
      ];
    }

    const curve: Array<{ date: string; value: number; trades: number }> = [];
    const dailyData = new Map<string, { pnl: number; count: number }>();

    for (const trade of trades) {
      const date = trade.exitTime.split('T')[0];
      const existing = dailyData.get(date) || { pnl: 0, count: 0 };
      dailyData.set(date, {
        pnl: existing.pnl + trade.pnl,
        count: existing.count + 1,
      });
    }

    let capital = initialCapital;
    const sortedDates = Array.from(dailyData.keys()).sort();

    for (const date of sortedDates) {
      const data = dailyData.get(date)!;
      capital += (capital * data.pnl) / 100;
      curve.push({
        date,
        value: Number(capital.toFixed(2)),
        trades: data.count,
      });
    }

    return curve;
  }

  /**
   * 获取用户的回测历史（未来功能）
   */
  async getBacktestHistory(userId: string): Promise<BacktestResultDto[]> {
    this.logger.debug(`获取用户 ${userId} 的回测历史`);
    return [];
  }
}
