import { PrismaClient } from '../../../node_modules/.prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

/**
 * 官方策略种子数据
 * 用于初始化系统预置的交易策略
 */

// 数据库连接字符串
const databaseUrl = process.env.DATABASE_URL ||
  'postgresql://quantfi:quantfi_dev_password@localhost:5433/quantfi';

// 创建 PostgreSQL 连接池
const pool = new Pool({
  connectionString: databaseUrl,
});

// 创建 Prisma adapter
const adapter = new PrismaPg(pool);

// 初始化 Prisma Client
const prisma = new PrismaClient({
  adapter,
} as any);

const officialStrategies = [
  {
    owner_type: 'system',
    owner_id: null,
    name: 'RSI 动量策略',
    description: '基于 RSI 指标的动量交易策略，适合震荡行情。当 RSI < 30 时买入，RSI > 70 时卖出。',
    content: `
# RSI 动量策略 (Freqtrade)
from freqtrade.strategy import IStrategy
from pandas import DataFrame
import talib.abstract as ta

class RSIMomentumStrategy(IStrategy):
    INTERFACE_VERSION = 3

    # 策略参数
    minimal_roi = {
        "0": 0.10,  # 10% 止盈
        "30": 0.05, # 30分钟后 5% 止盈
        "60": 0.02  # 60分钟后 2% 止盈
    }

    stoploss = -0.10  # 止损 10%
    timeframe = '5m'

    def populate_indicators(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe['rsi'] = ta.RSI(dataframe, timeperiod=14)
        return dataframe

    def populate_entry_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe.loc[
            (dataframe['rsi'] < 30),
            'enter_long'] = 1
        return dataframe

    def populate_exit_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe.loc[
            (dataframe['rsi'] > 70),
            'exit_long'] = 1
        return dataframe
`,
    config: {
      timeframe: '5m',
      stake_currency: 'USDT',
      recommended_leverage: 1,
    },
    performance_stats: {
      backtest: {
        total_trades: 150,
        win_rate: 65.5,
        max_drawdown: -12.5,
        sharpe_ratio: 1.8,
        profit_factor: 2.1,
      },
      live: {
        total_trades: 0,
        win_rate: 0,
        total_pnl: 0,
        last_updated: null,
      },
    },
    is_public: true,
    is_active: true,
  },
  {
    owner_type: 'system',
    owner_id: null,
    name: 'MACD 趋势跟踪',
    description: '基于 MACD 指标的趋势跟踪策略，适合单边行情。MACD 金叉买入，死叉卖出。',
    content: `
# MACD 趋势跟踪策略 (Freqtrade)
from freqtrade.strategy import IStrategy
from pandas import DataFrame
import talib.abstract as ta

class MACDTrendStrategy(IStrategy):
    INTERFACE_VERSION = 3

    minimal_roi = {
        "0": 0.15,
        "60": 0.08,
        "120": 0.03
    }

    stoploss = -0.08
    timeframe = '15m'

    def populate_indicators(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        macd = ta.MACD(dataframe)
        dataframe['macd'] = macd['macd']
        dataframe['macdsignal'] = macd['macdsignal']
        dataframe['macdhist'] = macd['macdhist']
        return dataframe

    def populate_entry_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe.loc[
            (dataframe['macd'] > dataframe['macdsignal']) &
            (dataframe['macdhist'] > 0),
            'enter_long'] = 1
        return dataframe

    def populate_exit_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe.loc[
            (dataframe['macd'] < dataframe['macdsignal']) &
            (dataframe['macdhist'] < 0),
            'exit_long'] = 1
        return dataframe
`,
    config: {
      timeframe: '15m',
      stake_currency: 'USDT',
      recommended_leverage: 2,
    },
    performance_stats: {
      backtest: {
        total_trades: 120,
        win_rate: 70.0,
        max_drawdown: -15.0,
        sharpe_ratio: 2.2,
        profit_factor: 2.5,
      },
      live: {
        total_trades: 0,
        win_rate: 0,
        total_pnl: 0,
        last_updated: null,
      },
    },
    is_public: true,
    is_active: true,
  },
  {
    owner_type: 'system',
    owner_id: null,
    name: '布林带突破策略',
    description: '基于布林带的突破策略，价格触及下轨买入，触及上轨卖出。适合波动行情。',
    content: `
# 布林带突破策略 (Freqtrade)
from freqtrade.strategy import IStrategy
from pandas import DataFrame
import talib.abstract as ta

class BollingerBandsStrategy(IStrategy):
    INTERFACE_VERSION = 3

    minimal_roi = {
        "0": 0.12,
        "45": 0.06,
        "90": 0.02
    }

    stoploss = -0.12
    timeframe = '1h'

    def populate_indicators(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        bollinger = ta.BBANDS(dataframe, timeperiod=20)
        dataframe['bb_upperband'] = bollinger['upperband']
        dataframe['bb_middleband'] = bollinger['middleband']
        dataframe['bb_lowerband'] = bollinger['lowerband']
        return dataframe

    def populate_entry_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe.loc[
            (dataframe['close'] < dataframe['bb_lowerband']),
            'enter_long'] = 1
        return dataframe

    def populate_exit_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe.loc[
            (dataframe['close'] > dataframe['bb_upperband']),
            'exit_long'] = 1
        return dataframe
`,
    config: {
      timeframe: '1h',
      stake_currency: 'USDT',
      recommended_leverage: 1,
    },
    performance_stats: {
      backtest: {
        total_trades: 100,
        win_rate: 62.0,
        max_drawdown: -18.0,
        sharpe_ratio: 1.5,
        profit_factor: 1.8,
      },
      live: {
        total_trades: 0,
        win_rate: 0,
        total_pnl: 0,
        last_updated: null,
      },
    },
    is_public: true,
    is_active: true,
  },
  {
    owner_type: 'system',
    owner_id: null,
    name: '双均线交叉策略',
    description: '基于 MA20 与 MA50 均线交叉的趋势跟踪策略。金叉买入，死叉卖出。适合趋势行情。',
    content: `
# 双均线交叉策略 (Freqtrade)
from freqtrade.strategy import IStrategy
from pandas import DataFrame
import talib.abstract as ta

class DualMAStrategy(IStrategy):
    INTERFACE_VERSION = 3

    minimal_roi = {
        "0": 0.12,
        "60": 0.06,
        "120": 0.03
    }

    stoploss = -0.08
    timeframe = '1h'

    def populate_indicators(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe['ma20'] = ta.SMA(dataframe, timeperiod=20)
        dataframe['ma50'] = ta.SMA(dataframe, timeperiod=50)
        return dataframe

    def populate_entry_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe.loc[
            (dataframe['ma20'] > dataframe['ma50']) &
            (dataframe['ma20'].shift(1) <= dataframe['ma50'].shift(1)),
            'enter_long'] = 1
        return dataframe

    def populate_exit_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe.loc[
            (dataframe['ma20'] < dataframe['ma50']) &
            (dataframe['ma20'].shift(1) >= dataframe['ma50'].shift(1)),
            'exit_long'] = 1
        return dataframe
`,
    config: {
      timeframe: '1h',
      stake_currency: 'USDT',
      recommended_leverage: 1,
    },
    performance_stats: {
      backtest: {
        total_trades: 80,
        win_rate: 58.0,
        max_drawdown: -10.0,
        sharpe_ratio: 1.6,
        profit_factor: 1.9,
      },
      live: {
        total_trades: 0,
        win_rate: 0,
        total_pnl: 0,
        last_updated: null,
      },
    },
    is_public: true,
    is_active: true,
  },
  {
    owner_type: 'system',
    owner_id: null,
    name: 'RSI+MACD 组合策略',
    description: '结合 RSI 和 MACD 双指标确认的保守策略。RSI 超卖且 MACD 金叉时买入，任一指标触发时卖出。',
    content: `
# RSI+MACD 组合策略 (Freqtrade)
from freqtrade.strategy import IStrategy
from pandas import DataFrame
import talib.abstract as ta

class RSIMACDComboStrategy(IStrategy):
    INTERFACE_VERSION = 3

    minimal_roi = {
        "0": 0.10,
        "30": 0.05,
        "60": 0.02
    }

    stoploss = -0.08
    timeframe = '15m'

    def populate_indicators(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        # RSI
        dataframe['rsi'] = ta.RSI(dataframe, timeperiod=14)

        # MACD
        macd = ta.MACD(dataframe)
        dataframe['macd'] = macd['macd']
        dataframe['macdsignal'] = macd['macdsignal']
        dataframe['macdhist'] = macd['macdhist']
        return dataframe

    def populate_entry_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        # 双重确认：RSI < 30 且 MACD 金叉
        dataframe.loc[
            (dataframe['rsi'] < 30) &
            (dataframe['macd'] > dataframe['macdsignal']) &
            (dataframe['macd'].shift(1) <= dataframe['macdsignal'].shift(1)),
            'enter_long'] = 1
        return dataframe

    def populate_exit_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        # 任一条件触发：RSI > 70 或 MACD 死叉
        dataframe.loc[
            (dataframe['rsi'] > 70) |
            ((dataframe['macd'] < dataframe['macdsignal']) &
             (dataframe['macd'].shift(1) >= dataframe['macdsignal'].shift(1))),
            'exit_long'] = 1
        return dataframe
`,
    config: {
      timeframe: '15m',
      stake_currency: 'USDT',
      recommended_leverage: 1,
    },
    performance_stats: {
      backtest: {
        total_trades: 60,
        win_rate: 72.0,
        max_drawdown: -8.0,
        sharpe_ratio: 2.0,
        profit_factor: 2.3,
      },
      live: {
        total_trades: 0,
        win_rate: 0,
        total_pnl: 0,
        last_updated: null,
      },
    },
    is_public: true,
    is_active: true,
  },
];

async function seedStrategies() {
  console.log('🌱 开始插入官方策略种子数据...');

  for (const strategy of officialStrategies) {
    // 检查是否已存在
    const existing = await prisma.strategies.findFirst({
      where: {
        name: strategy.name,
        owner_type: 'system',
      },
    });

    if (existing) {
      console.log(`⏭️  策略 "${strategy.name}" 已存在，跳过`);
      continue;
    }

    // 插入新策略
    await prisma.strategies.create({
      data: strategy as any,
    });

    console.log(`✅ 插入策略: ${strategy.name}`);
  }

  console.log('🎉 官方策略种子数据插入完成！');
}

// 执行种子数据脚本
seedStrategies()
  .catch((e) => {
    console.error('❌ 种子数据插入失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
