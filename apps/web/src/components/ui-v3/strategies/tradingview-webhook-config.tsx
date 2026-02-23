'use client'

import { useState } from 'react'
import { X, Copy, Check, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface TradingViewWebhookConfigProps {
  onClose?: () => void
}

const exchanges = [
  { id: 'binance', name: 'Binance', connected: true },
  { id: 'okx', name: 'OKX', connected: false },
  { id: 'bybit', name: 'Bybit', connected: false },
]

const webhookTemplate = `{
  "action": "{{strategy.order.action}}",
  "symbol": "{{ticker}}",
  "price": {{close}},
  "timestamp": {{timenow}}
}`

export function TradingViewWebhookConfig({ onClose }: TradingViewWebhookConfigProps) {
  const [selectedExchange, setSelectedExchange] = useState('binance')
  const [orderAmount, setOrderAmount] = useState('100')
  const [maxPositions, setMaxPositions] = useState('5')
  const [webhookUrl] = useState('https://api.quantfi.io/webhook/tv/a1b2c3d4e5f6')
  const [copiedUrl, setCopiedUrl] = useState(false)
  const [copiedTemplate, setCopiedTemplate] = useState(false)
  const [showGuide, setShowGuide] = useState(false)

  const copyToClipboard = async (text: string, type: 'url' | 'template') => {
    try {
      await navigator.clipboard.writeText(text)
      if (type === 'url') {
        setCopiedUrl(true)
        setTimeout(() => setCopiedUrl(false), 2000)
      } else {
        setCopiedTemplate(true)
        setTimeout(() => setCopiedTemplate(false), 2000)
      }
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Failed to copy:', err)
      }
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <Card className="relative z-10 w-full max-w-lg bg-[#12121A] border-[#1E1E2E] shadow-2xl max-h-[90vh] overflow-y-auto">
        <CardContent className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-cyan-600 flex items-center justify-center">
                <span className="text-white text-lg">📈</span>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[#F8F8FC]">创建 TradingView 策略</h2>
                <p className="text-sm text-[#9090A0]">连接你的 Pine Script 策略</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-[#9090A0] hover:text-[#F8F8FC] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Step 1: Webhook URL */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-6 h-6 rounded-full bg-[#2A2A3A] text-[#F8F8FC] text-xs flex items-center justify-center font-bold">1</span>
              <label className="font-semibold text-[#F8F8FC]">复制 Webhook URL</label>
            </div>
            <div className="relative">
              <Input
                value={webhookUrl}
                readOnly
                className="bg-[#0A0A0F] border-[#2A2A3A] text-[#9090A0] pr-20 text-sm font-mono"
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={() => copyToClipboard(webhookUrl, 'url')}
                className="absolute right-1 top-1/2 -translate-y-1/2 text-[#9090A0] hover:text-[#F8F8FC]"
              >
                {copiedUrl ? <Check className="w-4 h-4 text-[#10B981]" /> : <Copy className="w-4 h-4" />}
                <span className="ml-1">{copiedUrl ? '已复制' : '复制'}</span>
              </Button>
            </div>
            <p className="text-xs text-[#606070] mt-2">
              将此 URL 粘贴到 TradingView 策略的 Webhook 设置中
            </p>
          </div>

          {/* Step 2: Select Exchange */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-6 h-6 rounded-full bg-[#2A2A3A] text-[#F8F8FC] text-xs flex items-center justify-center font-bold">2</span>
              <label className="font-semibold text-[#F8F8FC]">选择交易所</label>
            </div>
            <select
              value={selectedExchange}
              onChange={(e) => setSelectedExchange(e.target.value)}
              className="w-full bg-[#0A0A0F] border border-[#2A2A3A] rounded-lg px-4 py-3 text-[#F8F8FC]"
            >
              {exchanges.map(ex => (
                <option key={ex.id} value={ex.id} disabled={!ex.connected}>
                  {ex.connected ? '🟢' : '⚪'} {ex.name} {!ex.connected && '(未连接)'}
                </option>
              ))}
            </select>
          </div>

          {/* Step 3: Execution Params */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-6 h-6 rounded-full bg-[#2A2A3A] text-[#F8F8FC] text-xs flex items-center justify-center font-bold">3</span>
              <label className="font-semibold text-[#F8F8FC]">设置执行参数</label>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-[#9090A0] mb-2">默认下单金额 (USDT)</label>
                <Input
                  type="number"
                  value={orderAmount}
                  onChange={(e) => setOrderAmount(e.target.value)}
                  placeholder="100"
                  className="bg-[#0A0A0F] border-[#2A2A3A] text-[#F8F8FC]"
                />
              </div>
              <div>
                <label className="block text-sm text-[#9090A0] mb-2">最大同时持仓</label>
                <Input
                  type="number"
                  value={maxPositions}
                  onChange={(e) => setMaxPositions(e.target.value)}
                  placeholder="5"
                  className="bg-[#0A0A0F] border-[#2A2A3A] text-[#F8F8FC]"
                />
              </div>
            </div>
          </div>

          {/* Step 4: Signal Format */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-6 h-6 rounded-full bg-[#2A2A3A] text-[#F8F8FC] text-xs flex items-center justify-center font-bold">4</span>
              <label className="font-semibold text-[#F8F8FC]">信号格式（复制到 TradingView）</label>
            </div>
            <div className="relative">
              <pre className="bg-[#0A0A0F] border border-[#2A2A3A] rounded-lg p-4 text-sm text-[#9090A0] font-mono overflow-x-auto">
                {webhookTemplate}
              </pre>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => copyToClipboard(webhookTemplate, 'template')}
                className="absolute right-2 top-2 text-[#9090A0] hover:text-[#F8F8FC]"
              >
                {copiedTemplate ? <Check className="w-4 h-4 text-[#10B981]" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          <div className="h-px bg-[#1E1E2E] -mx-6 mb-6" />

          {/* Usage Guide */}
          <div className="mb-6">
            <button
              onClick={() => setShowGuide(!showGuide)}
              className="flex items-center gap-2 text-cyan-400 hover:text-cyan-300 transition-colors text-sm"
            >
              💡 使用步骤
              {showGuide ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showGuide && (
              <div className="mt-3 p-4 bg-[#0A0A0F] rounded-lg border border-[#1E1E2E]">
                <ol className="space-y-2 text-sm text-[#9090A0]">
                  <li className="flex gap-2">
                    <span className="text-cyan-400">1.</span>
                    在 TradingView 打开你的 Pine Script 策略
                  </li>
                  <li className="flex gap-2">
                    <span className="text-cyan-400">2.</span>
                    点击「添加警报」，选择策略条件
                  </li>
                  <li className="flex gap-2">
                    <span className="text-cyan-400">3.</span>
                    在「通知」选项卡，勾选「Webhook URL」
                  </li>
                  <li className="flex gap-2">
                    <span className="text-cyan-400">4.</span>
                    粘贴上方的 Webhook URL
                  </li>
                  <li className="flex gap-2">
                    <span className="text-cyan-400">5.</span>
                    在「消息」中粘贴上方 JSON 格式
                  </li>
                  <li className="flex gap-2">
                    <span className="text-cyan-400">6.</span>
                    保存警报，开始自动交易！
                  </li>
                </ol>
                <a
                  href="https://www.tradingview.com/support/solutions/43000529348"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 mt-3 text-cyan-400 hover:text-cyan-300 text-sm"
                >
                  TradingView 官方文档
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}
          </div>

          {/* Actions */}
          <Button
            className="w-full bg-[#1E1E2E] hover:bg-[#2A2A3A] text-[#F8F8FC] border border-[#2A2A3A] py-6"
          >
            创建策略
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
