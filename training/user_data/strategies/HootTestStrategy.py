"""
HootTestStrategy - HOOT 平台功能验收测试策略 (超高频版)
======================================================

设计目标：
1. 极高频信号 - 1分钟K线，几乎每隔几分钟就产生信号
2. 容易触发止盈止损 - 极度敏感的入场条件
3. 安全可控 - 策略层不设止损，由平台接管
4. 覆盖做多做空 - 测试 direction 参数过滤

技术指标：
- RSI(7) 超宽阈值
- EMA(3/8) 快速交叉
- 无成交量过滤（最大化信号频率）
"""

import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from pandas import DataFrame
from typing import Dict, Optional

from freqtrade.strategy import (
    IStrategy,
    Trade,
    IntParameter,
    DecimalParameter,
    BooleanParameter,
)

import talib.abstract as ta


class HootTestStrategy(IStrategy):
    """
    HootTestStrategy: 超高频测试策略

    Entry Logic:
        Long  = RSI(7) < 48 + EMA(3) > EMA(8)  (几乎任何小幅回调)
        Short = RSI(7) > 52 + EMA(3) < EMA(8)  (几乎任何小幅反弹)

    Exit Logic:
        反向信号平仓，由 HOOT 平台止盈止损接管
    """

    INTERFACE_VERSION = 3

    def version(self) -> str:
        return "2.0.0"

    # --- 支持做空 (合约) ---
    can_short = True

    # --- 时间周期: 1分钟 (极高频信号) ---
    timeframe = "1m"

    # --- 启动所需K线数量 ---
    startup_candle_count: int = 20

    # === ROI: 不使用策略层止盈，由平台接管 ===
    minimal_roi = {
        "0": 100,  # 100% = 实际不触发
    }

    # === Stoploss: 不使用策略层止损，由平台接管 ===
    stoploss = -0.99  # -99% = 实际不触发

    # === 不使用 Trailing Stop (由平台接管) ===
    trailing_stop = False

    # === 订单类型 ===
    order_types = {
        "entry": "market",
        "exit": "market",
        "stoploss": "market",
        "stoploss_on_exchange": False,
    }

    # === 未成交订单超时 ===
    unfilledtimeout = {
        "entry": 5,
        "exit": 5,
        "unit": "minutes",
    }

    # ===================================================================
    # 指标计算
    # ===================================================================
    def populate_indicators(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        # EMA 快慢线
        dataframe["ema_3"] = ta.EMA(dataframe, timeperiod=3)
        dataframe["ema_8"] = ta.EMA(dataframe, timeperiod=8)

        # RSI
        dataframe["rsi"] = ta.RSI(dataframe, timeperiod=7)

        return dataframe

    # ===================================================================
    # 入场信号 - 极度敏感
    # ===================================================================
    def populate_entry_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        # ---- 做多: RSI < 48 + EMA金叉 ----
        dataframe.loc[
            (
                (dataframe["rsi"] < 48)
                & (dataframe["ema_3"] > dataframe["ema_8"])
                & (dataframe["volume"] > 0)
            ),
            ["enter_long", "enter_tag"],
        ] = (1, "rsi_dip_ema_up")

        # ---- 做空: RSI > 52 + EMA死叉 ----
        dataframe.loc[
            (
                (dataframe["rsi"] > 52)
                & (dataframe["ema_3"] < dataframe["ema_8"])
                & (dataframe["volume"] > 0)
            ),
            ["enter_short", "enter_tag"],
        ] = (1, "rsi_bounce_ema_down")

        return dataframe

    # ===================================================================
    # 出场信号 - 反向信号平仓
    # ===================================================================
    def populate_exit_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        # ---- 平多 ----
        dataframe.loc[
            (
                (dataframe["rsi"] > 55)
                & (dataframe["ema_3"] < dataframe["ema_8"])
                & (dataframe["volume"] > 0)
            ),
            ["exit_long", "exit_tag"],
        ] = (1, "exit_long_signal")

        # ---- 平空 ----
        dataframe.loc[
            (
                (dataframe["rsi"] < 45)
                & (dataframe["ema_3"] > dataframe["ema_8"])
                & (dataframe["volume"] > 0)
            ),
            ["exit_short", "exit_tag"],
        ] = (1, "exit_short_signal")

        return dataframe

    # ===================================================================
    # 杠杆设置 - 由 HOOT 平台控制
    # ===================================================================
    def leverage(
        self,
        pair: str,
        current_time: datetime,
        current_rate: float,
        proposed_leverage: float,
        max_leverage: float,
        entry_tag: Optional[str],
        side: str,
        **kwargs,
    ) -> float:
        return 1.0
