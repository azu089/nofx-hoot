# ==========================================
# QuantFi 系统验证策略 v2.1
# ==========================================
# 目的：验证 QuantFi 平台所有功能正常工作
# 支持：Binance USDT 合约（Futures）
#
# 交易逻辑：
#   - RSI 下穿 45 → 做多
#   - RSI 上穿 55 或 止损/止盈触发 → 平仓
#
# 推荐配置：
#   - stake_amount: 10 USDT
#   - max_open_trades: 1
#   - timeframe: 5m
#   - 交易对: BTC/USDT:USDT (合约格式)
# ==========================================

from freqtrade.strategy import IStrategy
from freqtrade.persistence import Trade
import talib.abstract as ta
from pandas import DataFrame
from datetime import datetime
from typing import Optional
import logging

logger = logging.getLogger(__name__)


class QuantFiTestStrategy(IStrategy):
    """
    QuantFi 系统验证策略 v2.1

    支持 Binance USDT 永续合约
    极简入场条件，确保能产生交易
    """

    # ==================== 策略元信息 ====================
    INTERFACE_VERSION = 3

    # ==================== 合约配置 ====================

    # 只做多（不做空）
    can_short = False

    # 交易模式：spot（现货）或 futures（合约）
    # 注意：实际交易模式由 config.json 中的 trading_mode 决定
    # 这里只是策略层面的配置

    # 合约杠杆（由平台配置覆盖，这里是默认值）
    # 实际杠杆在 freqtrade config 中设置

    # ==================== 基础配置 ====================

    # 时间框架：5分钟（更频繁的交易机会）
    timeframe = '5m'

    # 启动时需要的历史K线数量
    startup_candle_count = 30

    # 订单类型配置
    order_types = {
        'entry': 'market',      # 入场使用市价单（合约更快成交）
        'exit': 'market',       # 出场使用市价单
        'stoploss': 'market',   # 止损使用市价单
        'stoploss_on_exchange': True,  # 在交易所设置止损单
    }

    # 订单有效期
    order_time_in_force = {
        'entry': 'GTC',   # Good Till Cancelled
        'exit': 'GTC',
    }

    # ==================== 风控参数 ====================

    # 止损：-2%（较紧的止损，测试止损功能）
    stoploss = -0.02

    # 不使用追踪止损（简化测试）
    trailing_stop = False

    # ROI 阶梯退出（测试 ROI 功能）
    minimal_roi = {
        "0": 0.015,     # 立即：1.5% 盈利退出
        "15": 0.01,     # 15分钟后：1% 盈利退出
        "30": 0.005,    # 30分钟后：0.5% 盈利退出
        "60": 0.001,    # 60分钟后：0.1% 盈利退出
    }

    # ==================== 指标计算 ====================

    def populate_indicators(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        """
        计算技术指标 - 只用 RSI（简单高效）
        """
        # RSI 14 周期
        dataframe['rsi'] = ta.RSI(dataframe, timeperiod=14)

        # RSI 前一根K线的值（用于判断穿越）
        dataframe['rsi_prev'] = dataframe['rsi'].shift(1)

        # 添加 EMA 用于趋势确认（可选）
        dataframe['ema_20'] = ta.EMA(dataframe, timeperiod=20)

        return dataframe

    # ==================== 入场信号 ====================

    def populate_entry_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        """
        入场条件（极简）：
        RSI 下穿 45（从上方跌到下方）

        逻辑：RSI 从中性区域回落，可能是回调买入机会
        """
        dataframe.loc[
            (dataframe['rsi_prev'] >= 45) &   # 前一根 RSI >= 45
            (dataframe['rsi'] < 45) &          # 当前 RSI < 45
            (dataframe['volume'] > 0),         # 有成交量
            'enter_long'
        ] = 1

        return dataframe

    # ==================== 出场信号 ====================

    def populate_exit_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        """
        出场条件：
        RSI 上穿 55（从下方涨到上方）
        """
        dataframe.loc[
            (dataframe['rsi_prev'] <= 55) &   # 前一根 RSI <= 55
            (dataframe['rsi'] > 55),           # 当前 RSI > 55
            'exit_long'
        ] = 1

        return dataframe

    # ==================== 杠杆设置（合约专用）====================

    def leverage(self, pair: str, current_time: datetime, current_rate: float,
                 proposed_leverage: float, max_leverage: float, entry_tag: Optional[str],
                 side: str, **kwargs) -> float:
        """
        设置杠杆倍数

        对于测试策略，使用低杠杆（1x）降低风险
        实际杠杆由平台配置决定，这里是兜底
        """
        # 测试用低杠杆，实际由 freqtrade config 控制
        return 1.0

    # ==================== 订单确认回调 ====================

    def confirm_trade_entry(self, pair: str, order_type: str, amount: float, rate: float,
                           time_in_force: str, current_time: datetime, entry_tag: Optional[str],
                           side: str, **kwargs) -> bool:
        """
        确认开仓订单 - 记录日志
        """
        logger.info(f"📈 [QuantFi] 开仓信号: {pair}, 方向: {side}, 价格: {rate:.4f}, 数量: {amount:.6f}")
        return True

    def confirm_trade_exit(self, pair: str, trade: Trade, order_type: str, amount: float,
                          rate: float, time_in_force: str, exit_reason: str, current_time: datetime,
                          **kwargs) -> bool:
        """
        确认平仓订单 - 记录日志
        """
        profit_pct = (rate - trade.open_rate) / trade.open_rate * 100
        logger.info(f"📉 [QuantFi] 平仓信号: {pair}, 原因: {exit_reason}, 盈亏: {profit_pct:.2f}%")
        return True


# ==================== 策略配置说明 ====================
"""
【合约交易配置】

交易对格式：
- 合约: BTC/USDT:USDT, ETH/USDT:USDT
- 现货: BTC/USDT, ETH/USDT

Freqtrade config.json 关键配置：
{
    "trading_mode": "futures",
    "margin_mode": "isolated",
    "exchange": {
        "name": "binance",
        "key": "YOUR_API_KEY",
        "secret": "YOUR_API_SECRET",
        "options": {
            "defaultType": "future"
        }
    }
}

【策略参数说明】

1. 入场条件：RSI 下穿 45
   - RSI 从 >= 45 跌到 < 45 时触发买入
   - 宽松条件，容易触发

2. 出场条件（任一满足即平仓）：
   - RSI 上穿 55
   - 止损 -2% 触发
   - ROI 止盈触发（1.5% → 0.1%）

3. 风控：
   - 止损: -2%
   - 杠杆: 1x（测试用）
   - max_open_trades: 1

【预期交易频率】
- 5 分钟 K 线
- 每天约 2-6 笔交易
- 15 小时测试期间预期 3-10 笔交易

【验证清单】
✓ 合约开仓订单执行
✓ 合约平仓订单执行
✓ 止损触发（-2%）
✓ ROI 止盈触发
✓ RSI 信号平仓
✓ 交易日志记录
"""
