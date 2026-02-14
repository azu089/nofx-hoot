"""
HootOwlV1 - HOOT 平台趋势策略 (超高频测试版)
==============================================

设计目标：
1. 极高频信号 - 1分钟K线，布林带回归入场
2. 与 HootTestStrategy 使用不同指标逻辑（验证多策略独立运行）
3. 安全可控 - 策略层不设止损，由平台接管

技术指标：
- Bollinger Bands(14, 1.5) 窄带
- RSI(9) 辅助过滤
- 无成交量过滤
"""

import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from pandas import DataFrame
from typing import Dict, Optional

from freqtrade.strategy import (
    IStrategy,
    Trade,
)

import talib.abstract as ta


class HootOwlV1(IStrategy):
    """
    HootOwlV1: 布林带回归 + RSI 过滤

    Entry Logic:
        Long  = 价格触及布林带下轨 + RSI < 50
        Short = 价格触及布林带上轨 + RSI > 50

    Exit Logic:
        Long exit  = 价格触及布林带上轨
        Short exit = 价格触及布林带下轨
    """

    INTERFACE_VERSION = 3

    def version(self) -> str:
        return "1.1.0"

    # --- 支持做空 (合约) ---
    can_short = True

    # --- 时间周期: 1分钟 (极高频信号) ---
    timeframe = "1m"

    # --- 启动所需K线数量 ---
    startup_candle_count: int = 20

    # === ROI: 不使用策略层止盈，由平台接管 ===
    minimal_roi = {
        "0": 100,
    }

    # === Stoploss: 不使用策略层止损，由平台接管 ===
    stoploss = -0.99

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
        # Bollinger Bands (窄带 - 1.5 标准差，更容易触发)
        bollinger = ta.BBANDS(dataframe, timeperiod=14, nbdevup=1.5, nbdevdn=1.5)
        dataframe["bb_upper"] = bollinger["upperband"]
        dataframe["bb_middle"] = bollinger["middleband"]
        dataframe["bb_lower"] = bollinger["lowerband"]

        # RSI
        dataframe["rsi"] = ta.RSI(dataframe, timeperiod=9)

        return dataframe

    # ===================================================================
    # 入场信号 - 布林带回归 (极度敏感)
    # ===================================================================
    def populate_entry_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        # ---- 做多: 价格接近或触及下轨 + RSI偏低 ----
        dataframe.loc[
            (
                (dataframe["close"] <= dataframe["bb_lower"] * 1.002)
                & (dataframe["rsi"] < 50)
                & (dataframe["volume"] > 0)
            ),
            ["enter_long", "enter_tag"],
        ] = (1, "bb_lower_touch")

        # ---- 做空: 价格接近或触及上轨 + RSI偏高 ----
        dataframe.loc[
            (
                (dataframe["close"] >= dataframe["bb_upper"] * 0.998)
                & (dataframe["rsi"] > 50)
                & (dataframe["volume"] > 0)
            ),
            ["enter_short", "enter_tag"],
        ] = (1, "bb_upper_touch")

        return dataframe

    # ===================================================================
    # 出场信号 - 布林带对面出场
    # ===================================================================
    def populate_exit_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        # ---- 平多: 价格接近上轨 ----
        dataframe.loc[
            (
                (dataframe["close"] >= dataframe["bb_upper"] * 0.999)
                & (dataframe["volume"] > 0)
            ),
            ["exit_long", "exit_tag"],
        ] = (1, "bb_upper_exit")

        # ---- 平空: 价格接近下轨 ----
        dataframe.loc[
            (
                (dataframe["close"] <= dataframe["bb_lower"] * 1.001)
                & (dataframe["volume"] > 0)
            ),
            ["exit_short", "exit_tag"],
        ] = (1, "bb_lower_exit")

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
