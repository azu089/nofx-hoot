'use client';

import { useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@repo/design-system/components/ui/card';
import { Button } from '@repo/design-system/components/ui/button';
import { Input } from '@repo/design-system/components/ui/input';
import {
  BrainCircuit,
  Sparkles,
  Send,
  TrendingUp,
  BarChart3,
  Zap,
  Clock,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';

// 模拟 AI 生成的策略
const mockAIStrategies = [
  {
    id: '1',
    name: 'AI 趋势捕手 v1',
    description: '基于多周期 EMA 交叉的趋势跟踪策略，结合 RSI 过滤假信号',
    expectedReturn: 15.5,
    maxDrawdown: 8.2,
    confidence: 85,
    status: 'ready',
    createdAt: '2024-01-15 10:23',
  },
  {
    id: '2',
    name: 'AI 网格优化 v2',
    description: '根据历史波动率自动调整网格间距，适应不同市场环境',
    expectedReturn: 12.3,
    maxDrawdown: 5.5,
    confidence: 78,
    status: 'backtesting',
    createdAt: '2024-01-14 18:45',
  },
  {
    id: '3',
    name: 'AI 动量突破 v1',
    description: '识别强势突破信号，结合成交量确认入场时机',
    expectedReturn: 22.8,
    maxDrawdown: 15.2,
    confidence: 72,
    status: 'ready',
    createdAt: '2024-01-13 14:30',
  },
];

export default function AIStrategyPage() {
  const [prompt, setPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'ai'; content: string }>>([
    {
      role: 'ai',
      content: '你好！我是 QuantFi AI 策略助手。告诉我你想要什么样的交易策略，我可以帮你生成和优化。\n\n例如：\n- "生成一个适合震荡行情的网格策略"\n- "优化我的趋势跟踪策略，降低回撤"\n- "设计一个低风险的套利策略"',
    },
  ]);

  const handleSendMessage = async () => {
    if (!prompt.trim()) return;

    const userMessage = prompt;
    setPrompt('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setGenerating(true);

    // 模拟 AI 响应
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          role: 'ai',
          content: `收到你的需求："${userMessage}"\n\n我正在分析市场数据并生成策略...\n\n✅ 策略生成完成！\n\n**策略名称：** AI 自定义策略 v1\n**策略类型：** 趋势跟踪\n**预期年化：** 18.5%\n**最大回撤：** 10.2%\n**信心指数：** 82%\n\n策略已添加到你的策略列表，你可以在回测系统中测试其表现。`,
        },
      ]);
      setGenerating(false);
    }, 2000);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ready':
        return (
          <span className="px-2 py-1 text-xs rounded bg-green-500/20 text-green-500 flex items-center gap-1">
            <CheckCircle className="w-3 h-3" />
            可用
          </span>
        );
      case 'backtesting':
        return (
          <span className="px-2 py-1 text-xs rounded bg-yellow-500/20 text-yellow-500 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            回测中
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BrainCircuit className="w-7 h-7 text-primary" />
          AI 策略生成器
        </h1>
        <p className="text-muted-foreground">使用 AI 生成和优化交易策略</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* AI 对话 */}
        <Card className="flex flex-col h-[600px]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              AI 助手
            </CardTitle>
            <CardDescription>描述你想要的策略，AI 会帮你生成</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col">
            {/* 消息列表 */}
            <div className="flex-1 overflow-y-auto space-y-4 mb-4">
              {messages.map((msg, index) => (
                <div
                  key={index}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] p-3 rounded-lg ${
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-line">{msg.content}</p>
                  </div>
                </div>
              ))}
              {generating && (
                <div className="flex justify-start">
                  <div className="bg-muted p-3 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 animate-pulse text-primary" />
                      <span className="text-sm">AI 正在思考...</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 输入框 */}
            <div className="flex gap-2">
              <Input
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="描述你想要的策略..."
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                disabled={generating}
              />
              <Button onClick={handleSendMessage} disabled={generating || !prompt.trim()}>
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* AI 生成的策略列表 */}
        <Card className="h-[600px] flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-primary" />
              已生成策略
            </CardTitle>
            <CardDescription>AI 为你生成的交易策略</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto">
            <div className="space-y-4">
              {mockAIStrategies.map((strategy) => (
                <div
                  key={strategy.id}
                  className="p-4 bg-muted/50 rounded-lg space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-medium">{strategy.name}</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        {strategy.description}
                      </p>
                    </div>
                    {getStatusBadge(strategy.status)}
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div className="p-2 bg-muted rounded">
                      <p className="text-muted-foreground text-xs">预期年化</p>
                      <p className="font-medium text-green-500">+{strategy.expectedReturn}%</p>
                    </div>
                    <div className="p-2 bg-muted rounded">
                      <p className="text-muted-foreground text-xs">最大回撤</p>
                      <p className="font-medium text-red-500">-{strategy.maxDrawdown}%</p>
                    </div>
                    <div className="p-2 bg-muted rounded">
                      <p className="text-muted-foreground text-xs">信心指数</p>
                      <p className="font-medium">{strategy.confidence}%</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {strategy.createdAt}
                    </span>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm">
                        回测
                      </Button>
                      <Button size="sm" disabled={strategy.status !== 'ready'}>
                        启用
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 提示 */}
      <Card className="bg-yellow-500/10 border-yellow-500/30">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-yellow-500">风险提示</p>
              <p className="text-sm text-muted-foreground mt-1">
                AI 生成的策略仅供参考，不构成投资建议。请在充分了解风险后，使用回测系统验证策略表现，并根据自身风险承受能力谨慎使用。
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
