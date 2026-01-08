'use client';

import { Modal } from '@/components/ui';

interface ParamsHelpModalProps {
  open: boolean;
  onClose: () => void;
}

// 参数说明数据
const PARAMS_HELP = [
  {
    category: '基础参数',
    items: [
      {
        name: '初始资金',
        description: '回测时使用的虚拟本金，影响收益率计算和仓位大小。',
        suggestion: '与您计划实际投入的资金一致',
      },
      {
        name: '交易对',
        description: '策略监控的交易币对，可选择多个进行分散投资。',
        suggestion: '选择流动性好的主流币种，如 BTC、ETH',
      },
      {
        name: '回测周期',
        description: '历史数据的时间范围，用于验证策略在不同市场环境下的表现。',
        suggestion: '至少选择 3 个月以上，覆盖牛熊市场',
      },
    ],
  },
  {
    category: '高级参数',
    items: [
      {
        name: '交易所',
        description: '执行交易的交易所平台，不同交易所手续费和深度不同。',
        suggestion: '根据已绑定的 API Key 选择',
      },
      {
        name: '止损 (%)',
        description: '当亏损达到该比例时自动平仓止损。例：-5% 表示亏损 5% 时触发。',
        suggestion: '根据风险承受能力设置，通常 -3% 到 -10%',
      },
      {
        name: '止盈 (%)',
        description: '当盈利达到该比例时自动平仓获利。例：10% 表示盈利 10% 时触发。',
        suggestion: '止盈/止损比率建议 ≥ 2:1',
      },
      {
        name: 'K线周期',
        description: '策略分析使用的时间周期。1m/5m 适合高频交易；15m/1h 适合日内；4h/1d 适合波段。',
        suggestion: '15m-4h 适合大多数用户',
      },
      {
        name: '杠杆倍数',
        description: '放大收益和风险的倍数。1x = 无杠杆。杠杆会同时放大盈利和亏损。',
        suggestion: '新手建议 1-3x，有经验可考虑 5-10x',
      },
      {
        name: '最大持仓数',
        description: '同时持有的最大仓位数量，用于分散风险。',
        suggestion: '3-5 个，避免单一持仓风险',
      },
      {
        name: '手续费率',
        description: '交易所收取的手续费比例。Binance 0.1%，OKX 0.08%，Bybit 0.1%。',
        suggestion: '查看您交易所的实际费率',
      },
      {
        name: '未成交超时',
        description: '挂单超过指定时间未成交则自动取消。',
        suggestion: '5-15 分钟，避免订单长时间挂着',
      },
    ],
  },
  {
    category: '风控设置',
    items: [
      {
        name: '模拟交易',
        description: '使用虚拟资金进行交易，不实际下单。适合测试策略或熟悉系统。',
        suggestion: '新策略建议先模拟交易验证',
      },
      {
        name: '移动止损（追踪止损）',
        description: '止损线随价格上涨而上移，锁定部分利润。价格涨到新高后，止损价会跟随上移。',
        suggestion: '趋势行情中使用，防止利润回吐',
      },
      {
        name: '交易所止损',
        description: '在交易所端设置止损单，而非本地监控。优点是网络中断时仍能触发止损。',
        suggestion: '始终开启，增加安全性',
      },
      {
        name: '退出取消挂单',
        description: '策略停止时自动取消所有未成交的挂单。',
        suggestion: '通常保持开启',
      },
    ],
  },
  {
    category: '黑天鹅防护',
    items: [
      {
        name: '黑天鹅防护',
        description: '当市场出现剧烈波动（如闪崩）时自动触发保护机制，防止重大损失。',
        suggestion: '建议开启，阈值 -8% ~ -15%',
      },
      {
        name: '触发阈值',
        description: '价格在指定时间内跌幅超过该值时触发防护。',
        suggestion: '-8% 到 -15%，根据风险偏好调整',
      },
      {
        name: '检测窗口',
        description: '监测价格波动的时间周期，在此时间内跌幅超过阈值则触发。',
        suggestion: '3-10 分钟',
      },
      {
        name: '触发动作',
        description: '暂停交易：停止开新仓，保留现有持仓；全部平仓：立即平掉所有持仓；仅通知：只发送警报。',
        suggestion: '根据风险承受能力选择',
      },
    ],
  },
];

export function ParamsHelpModal({ open, onClose }: ParamsHelpModalProps) {
  return (
    <Modal open={open} onClose={onClose} title="参数说明" size="lg" position="top">
      <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
        {PARAMS_HELP.map((category) => (
          <div key={category.category}>
            <h3 className="text-sm font-medium text-text-secondary mb-3 border-b border-border-primary pb-2">
              {category.category}
            </h3>
            <div className="space-y-4">
              {category.items.map((item) => (
                <div key={item.name} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">{item.name}</span>
                  </div>
                  <p className="text-xs text-text-secondary leading-relaxed">{item.description}</p>
                  {item.suggestion && (
                    <p className="text-xs text-brand-primary">建议：{item.suggestion}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}
