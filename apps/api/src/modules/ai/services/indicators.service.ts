import { Injectable } from '@nestjs/common';
import { RSI, MACD, BollingerBands, ATR, OBV, EMA } from 'technicalindicators';

/**
 * OHLCV 数据接口
 */
export interface OHLCV {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * 技术指标计算结果接口
 */
export interface IndicatorsResult {
  rsi: number | null;
  rsi7: number | null;           // 新增：短周期 RSI
  macd: {
    macd: number | null;
    signal: number | null;
    histogram: number | null;
  };
  bollingerBands: {
    upper: number | null;
    middle: number | null;
    lower: number | null;
  };
  atr: number | null;
  atr3: number | null;           // 新增：短周期 ATR
  obv: number | null;
  ema: {
    ema12: number | null;
    ema20: number | null;        // 新增
    ema26: number | null;
    ema50: number | null;
  };
  donchian: {                    // 新增：Donchian Channel
    upper: number | null;
    middle: number | null;
    lower: number | null;
  };
}

/**
 * 技术指标计算服务
 * 使用 technicalindicators 库计算各种技术指标
 */
@Injectable()
export class IndicatorsService {
  /**
   * 计算 RSI (相对强弱指标)
   * @param closes 收盘价数组
   * @param period 周期 (默认 14)
   * @returns RSI 值 (0-100)
   */
  calculateRSI(closes: number[], period: number = 14): number | null {
    if (closes.length < period) {
      return null;
    }

    const rsiValues = RSI.calculate({
      values: closes,
      period,
    });

    return rsiValues.length > 0 ? rsiValues[rsiValues.length - 1] : null;
  }

  /**
   * 计算 MACD (指数平滑异同移动平均线)
   * @param closes 收盘价数组
   * @returns MACD 对象 { macd, signal, histogram }
   */
  calculateMACD(closes: number[]): {
    macd: number | null;
    signal: number | null;
    histogram: number | null;
  } {
    if (closes.length < 26) {
      return { macd: null, signal: null, histogram: null };
    }

    const macdValues = MACD.calculate({
      values: closes,
      fastPeriod: 12,
      slowPeriod: 26,
      signalPeriod: 9,
      SimpleMAOscillator: false,
      SimpleMASignal: false,
    });

    if (macdValues.length === 0) {
      return { macd: null, signal: null, histogram: null };
    }

    const latest = macdValues[macdValues.length - 1];
    return {
      macd: latest.MACD || null,
      signal: latest.signal || null,
      histogram: latest.histogram || null,
    };
  }

  /**
   * 计算布林带
   * @param closes 收盘价数组
   * @param period 周期 (默认 20)
   * @returns 布林带对象 { upper, middle, lower }
   */
  calculateBollingerBands(
    closes: number[],
    period: number = 20,
  ): {
    upper: number | null;
    middle: number | null;
    lower: number | null;
  } {
    if (closes.length < period) {
      return { upper: null, middle: null, lower: null };
    }

    const bbValues = BollingerBands.calculate({
      values: closes,
      period,
      stdDev: 2,
    });

    if (bbValues.length === 0) {
      return { upper: null, middle: null, lower: null };
    }

    const latest = bbValues[bbValues.length - 1];
    return {
      upper: latest.upper || null,
      middle: latest.middle || null,
      lower: latest.lower || null,
    };
  }

  /**
   * 计算 ATR (平均真实波幅)
   * @param highs 最高价数组
   * @param lows 最低价数组
   * @param closes 收盘价数组
   * @param period 周期 (默认 14)
   * @returns ATR 值
   */
  calculateATR(
    highs: number[],
    lows: number[],
    closes: number[],
    period: number = 14,
  ): number | null {
    if (highs.length < period || lows.length < period || closes.length < period) {
      return null;
    }

    const atrValues = ATR.calculate({
      high: highs,
      low: lows,
      close: closes,
      period,
    });

    return atrValues.length > 0 ? atrValues[atrValues.length - 1] : null;
  }

  /**
   * 计算 OBV (能量潮指标)
   * @param closes 收盘价数组
   * @param volumes 成交量数组
   * @returns OBV 值
   */
  calculateOBV(closes: number[], volumes: number[]): number | null {
    if (closes.length < 2 || volumes.length < 2) {
      return null;
    }

    const obvValues = OBV.calculate({
      close: closes,
      volume: volumes,
    });

    return obvValues.length > 0 ? obvValues[obvValues.length - 1] : null;
  }

  /**
   * 计算 EMA (指数移动平均线)
   * @param closes 收盘价数组
   * @param period 周期
   * @returns EMA 值
   */
  calculateEMA(closes: number[], period: number): number | null {
    if (closes.length < period) {
      return null;
    }

    const emaValues = EMA.calculate({
      values: closes,
      period,
    });

    return emaValues.length > 0 ? emaValues[emaValues.length - 1] : null;
  }

  /**
   * 计算 Donchian Channel (唐奇安通道)
   * @param highs 最高价数组
   * @param lows 最低价数组
   * @param period 周期 (默认 20)
   * @returns { upper, middle, lower }
   */
  calculateDonchianChannel(
    highs: number[],
    lows: number[],
    period: number = 20,
  ): { upper: number | null; middle: number | null; lower: number | null } {
    if (highs.length < period || lows.length < period) {
      return { upper: null, middle: null, lower: null };
    }

    // 取最近 period 个 K 线的最高价和最低价
    const recentHighs = highs.slice(-period);
    const recentLows = lows.slice(-period);

    const upper = Math.max(...recentHighs);
    const lower = Math.min(...recentLows);
    const middle = (upper + lower) / 2;

    return { upper, middle, lower };
  }

  /**
   * 计算所有技术指标
   * @param ohlcv OHLCV 数据数组
   * @returns 所有技术指标的计算结果
   */
  calculateAll(ohlcv: OHLCV[]): IndicatorsResult {
    if (!ohlcv || ohlcv.length === 0) {
      return {
        rsi: null,
        rsi7: null,
        macd: { macd: null, signal: null, histogram: null },
        bollingerBands: { upper: null, middle: null, lower: null },
        atr: null,
        atr3: null,
        obv: null,
        ema: { ema12: null, ema20: null, ema26: null, ema50: null },
        donchian: { upper: null, middle: null, lower: null },
      };
    }

    // 提取各个价格和成交量数组
    const closes = ohlcv.map((d) => d.close);
    const highs = ohlcv.map((d) => d.high);
    const lows = ohlcv.map((d) => d.low);
    const volumes = ohlcv.map((d) => d.volume);

    return {
      rsi: this.calculateRSI(closes),
      rsi7: this.calculateRSI(closes, 7),
      macd: this.calculateMACD(closes),
      bollingerBands: this.calculateBollingerBands(closes),
      atr: this.calculateATR(highs, lows, closes),
      atr3: this.calculateATR(highs, lows, closes, 3),
      obv: this.calculateOBV(closes, volumes),
      ema: {
        ema12: this.calculateEMA(closes, 12),
        ema20: this.calculateEMA(closes, 20),
        ema26: this.calculateEMA(closes, 26),
        ema50: this.calculateEMA(closes, 50),
      },
      donchian: this.calculateDonchianChannel(highs, lows),
    };
  }

  /**
   * 返回最近 N 根 K 线的指标序列（供 AI 感知趋势方向）
   * 独立方法，不修改 calculateAll() 接口和 IndicatorsResult 类型
   */
  calculateSeries(ohlcv: OHLCV[], count = 10): {
    rsiSeries: number[];
    macdHistSeries: number[];
  } {
    if (ohlcv.length < 26) return { rsiSeries: [], macdHistSeries: [] };
    const closes = ohlcv.map(b => b.close);

    // RSI(14) 序列
    const rsiAll = RSI.calculate({ values: closes, period: 14 });
    const rsiSeries = rsiAll.slice(-count).map(v => Math.round(v * 10) / 10);

    // MACD Histogram 序列
    const macdAll = MACD.calculate({
      values: closes,
      fastPeriod: 12,
      slowPeriod: 26,
      signalPeriod: 9,
      SimpleMAOscillator: false,
      SimpleMASignal: false,
    });
    const macdHistSeries = macdAll
      .slice(-count)
      .map(v => Math.round((v.histogram ?? 0) * 100) / 100);

    return { rsiSeries, macdHistSeries };
  }
}
