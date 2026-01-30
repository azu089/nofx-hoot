'use client'

import { useState } from 'react'
import { X, Play, Save, FileCode, Settings } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface CodeEditorProps {
  onClose?: () => void
}

const defaultPythonCode = `# Hoot Strategy Template
# 使用 Freqtrade 策略框架

from freqtrade.strategy import IStrategy
from pandas import DataFrame
import talib.abstract as ta

class MyStrategy(IStrategy):
    """
    我的自定义策略
    """

    # 最小 ROI
    minimal_roi = {
        "0": 0.1,    # 10% 止盈
        "30": 0.05,  # 30分钟后 5% 止盈
        "60": 0.02,  # 60分钟后 2% 止盈
    }

    # 止损
    stoploss = -0.05  # 5% 止损

    # 时间周期
    timeframe = '5m'

    def populate_indicators(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        """添加技术指标"""
        # RSI
        dataframe['rsi'] = ta.RSI(dataframe, timeperiod=14)

        # 移动平均线
        dataframe['ma_20'] = ta.SMA(dataframe, timeperiod=20)
        dataframe['ma_50'] = ta.SMA(dataframe, timeperiod=50)

        return dataframe

    def populate_entry_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        """买入信号"""
        dataframe.loc[
            (
                (dataframe['rsi'] < 30) &  # RSI 超卖
                (dataframe['close'] > dataframe['ma_20'])  # 价格在 MA20 上方
            ),
            'enter_long'] = 1

        return dataframe

    def populate_exit_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        """卖出信号"""
        dataframe.loc[
            (
                (dataframe['rsi'] > 70)  # RSI 超买
            ),
            'exit_long'] = 1

        return dataframe
`

const languages = [
  { id: 'python', name: 'Python (Freqtrade)', icon: '🐍' },
  { id: 'pine', name: 'Pine Script', icon: '📈' },
]

export function CodeEditor({ onClose }: CodeEditorProps) {
  const [code, setCode] = useState(defaultPythonCode)
  const [language, setLanguage] = useState('python')
  const [strategyName, setStrategyName] = useState('')
  const [showSettings, setShowSettings] = useState(false)

  const lineNumbers = code.split('\n').map((_, i) => i + 1)

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <Card className="relative z-10 w-full max-w-4xl bg-[#12121A] border-[#1E1E2E] shadow-2xl h-[85vh] flex flex-col">
        <CardContent className="p-0 flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-[#1E1E2E]">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <FileCode className="w-5 h-5 text-cyan-400" />
                <h2 className="font-semibold text-[#F8F8FC]">代码编辑器</h2>
              </div>
              <span className="px-2 py-1 rounded bg-amber-500/20 text-amber-400 text-xs">高级功能</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="p-2 text-[#9090A0] hover:text-[#F8F8FC] transition-colors"
              >
                <Settings className="w-5 h-5" />
              </button>
              <button
                onClick={onClose}
                className="p-2 text-[#9090A0] hover:text-[#F8F8FC] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Toolbar */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-[#1E1E2E] bg-[#0A0A0F]">
            <div className="flex items-center gap-4">
              {/* Language Selector */}
              <div className="flex items-center gap-2">
                <span className="text-[#606070] text-sm">语言:</span>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="bg-[#12121A] border border-[#2A2A3A] rounded px-3 py-1 text-sm text-[#F8F8FC]"
                >
                  {languages.map(lang => (
                    <option key={lang.id} value={lang.id}>
                      {lang.icon} {lang.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Strategy Name */}
              <div className="flex items-center gap-2">
                <span className="text-[#606070] text-sm">策略名称:</span>
                <Input
                  value={strategyName}
                  onChange={(e) => setStrategyName(e.target.value)}
                  placeholder="MyStrategy"
                  className="w-40 h-8 bg-[#12121A] border-[#2A2A3A] text-[#F8F8FC] text-sm"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="border-[#2A2A3A] text-[#9090A0] hover:text-[#F8F8FC]"
              >
                <Play className="w-4 h-4 mr-1" />
                运行回测
              </Button>
              <Button
                size="sm"
                className="bg-[#1E1E2E] hover:bg-[#2A2A3A] text-[#F8F8FC] border border-[#2A2A3A]"
              >
                <Save className="w-4 h-4 mr-1" />
                保存
              </Button>
            </div>
          </div>

          {/* Settings Panel */}
          {showSettings && (
            <div className="p-4 border-b border-[#1E1E2E] bg-[#0A0A0F]">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-[#9090A0] mb-1">交易对</label>
                  <Input
                    placeholder="BTC/USDT, ETH/USDT"
                    className="bg-[#12121A] border-[#2A2A3A] text-[#F8F8FC] text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm text-[#9090A0] mb-1">每笔金额 (USDT)</label>
                  <Input
                    type="number"
                    placeholder="100"
                    className="bg-[#12121A] border-[#2A2A3A] text-[#F8F8FC] text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm text-[#9090A0] mb-1">交易所</label>
                  <select className="w-full bg-[#12121A] border border-[#2A2A3A] rounded px-3 py-2 text-sm text-[#F8F8FC]">
                    <option>Binance</option>
                    <option>OKX</option>
                    <option>Bybit</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Code Editor Area */}
          <div className="flex-1 flex overflow-hidden">
            {/* Line Numbers */}
            <div className="w-12 bg-[#0A0A0F] border-r border-[#1E1E2E] py-4 px-2 overflow-hidden">
              <div className="text-right text-[#606070] text-sm font-mono leading-6 select-none">
                {lineNumbers.map(num => (
                  <div key={num}>{num}</div>
                ))}
              </div>
            </div>

            {/* Code Area */}
            <div className="flex-1 relative">
              <textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="absolute inset-0 w-full h-full bg-[#0A0A0F] text-[#F8F8FC] p-4 font-mono text-sm leading-6 resize-none focus:outline-none"
                spellCheck={false}
                style={{
                  tabSize: 4,
                }}
              />
            </div>
          </div>

          {/* Status Bar */}
          <div className="flex items-center justify-between px-4 py-2 border-t border-[#1E1E2E] bg-[#0A0A0F] text-xs text-[#606070]">
            <div className="flex items-center gap-4">
              <span>Python</span>
              <span>UTF-8</span>
              <span>行 {code.split('\n').length}</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-amber-400">⚠️ 高级功能，需要编程经验</span>
              <a href="#" className="text-cyan-400 hover:text-cyan-300">查看文档</a>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
