"""
QuantFi 实盘测试策略 - 仅用于验证交易流程
注意：此策略仅用于测试，不适合实际交易使用
"""
from freqtrade.strategy import IStrategy
from pandas import DataFrame
import talib.abstract as ta


class TestStrategy(IStrategy):
    """
    极简测试策略 - 用于验证交易链路
    - 买入条件：RSI < 40（容易触发）
    - 卖出条件：RSI > 60 或 盈利 1%
    - 止损：2%
    - 每单：10 USDT
    """

    INTERFACE_VERSION = 3

    # 最小盈利目标 1%
    minimal_roi = {
        "0": 0.01  # 1% 盈利就卖
    }

    # 止损 2%
    stoploss = -0.02

    # 5分钟K线
    timeframe = '5m'

    # 启动需要的K线数量
    startup_candle_count = 30

    # 是否可以做空（否）
    can_short = False

    # 交易数量控制
    max_open_trades = 1

    def populate_indicators(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        """计算技术指标"""
        # RSI 指标
        dataframe['rsi'] = ta.RSI(dataframe, timeperiod=14)

        return dataframe

    def populate_entry_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        """买入信号：RSI < 40（容易触发）"""
        dataframe.loc[
            (dataframe['rsi'] < 40),
            'enter_long'
        ] = 1

        return dataframe

    def populate_exit_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        """卖出信号：RSI > 60"""
        dataframe.loc[
            (dataframe['rsi'] > 60),
            'exit_long'
        ] = 1

        return dataframe
