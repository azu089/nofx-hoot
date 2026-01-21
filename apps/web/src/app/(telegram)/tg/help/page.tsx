'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTelegramContext } from '@/components/providers/TelegramProvider';
import {
  ArrowLeft,
  HelpCircle,
  MessageCircle,
  FileText,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Mail,
  Send,
} from 'lucide-react';

interface FAQ {
  question: string;
  answer: string;
}

const faqs: FAQ[] = [
  {
    question: '如何获得积分？',
    answer: '您可以通过以下方式获得积分：\n\n1.【每日签到】基础 10 积分/天，连签最高 50 积分/天\n2.【交易挖矿】每 100 USDT 交易量 = 1 积分，VIP 享 1.2-2.0 倍加成\n3.【邀请返佣】直推交易挖矿的 5%，间推 2.5%\n4.【点卡返佣】直推购买点卡的 10%，间推 5%',
  },
  {
    question: '积分有什么用？',
    answer: '积分主要用途：\n\n1.【兑换代币】1000 积分 = 1 QFI\n2.【质押分红】质押积分获得平台收益分红\n3.【抵扣订阅】使用积分抵扣 VIP 费用\n\n代币价格上涨时，您的积分也同步增值！',
  },
  {
    question: '如何开始使用 QuantFi？',
    answer: '注册账户后，您可以浏览策略市场选择感兴趣的策略，绑定交易所 API Key，开通 VPS 实例后即可开始自动化交易。',
  },
  {
    question: 'VPS 订阅费用是多少？',
    answer: 'VPS 订阅费用为 $25/月，包含独立云服务器、自动备份和技术支持。您可以使用积分抵扣费用。',
  },
  {
    question: '如何绑定交易所 API Key？',
    answer: '进入「钱包」->「API 密钥」页面，选择交易所类型，输入 API Key 和 Secret 即可完成绑定。请确保开启交易权限但关闭提现权限。',
  },
  {
    question: '什么是燃油费？',
    answer: '燃油费是平台从您的盈利中收取的服务费，比例为盈利的 20%。只有盈利时才收取，亏损时不收费。',
  },
  {
    question: '策略运行出问题怎么办？',
    answer: '您可以在设置页面使用「紧急按钮」一键停止所有策略。如需进一步帮助，请联系客服。',
  },
  {
    question: '如何提现？',
    answer: '进入「钱包」->「提现」页面，选择提现网络，输入提现地址和金额，完成安全验证后即可提交。',
  },
];

export default function TgHelpPage() {
  const router = useRouter();
  const { haptic } = useTelegramContext();
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    haptic('selection');
    setExpandedFaq(expandedFaq === index ? null : index);
  };

  const contactOptions = [
    {
      icon: Send,
      label: 'Telegram 客服',
      desc: '7x24 在线支持',
      action: () => {
        haptic('selection');
        window.open('https://t.me/quantfi_support', '_blank');
      },
    },
    {
      icon: Mail,
      label: '邮件支持',
      desc: 'support@quantfi.io',
      action: () => {
        haptic('selection');
        window.location.href = 'mailto:support@quantfi.io';
      },
    },
  ];

  return (
    <div className="space-y-4 pb-24">
      {/* 顶部 */}
      <button
        onClick={() => { haptic('selection'); router.back(); }}
        className="flex items-center gap-2 text-text-secondary"
      >
        <ArrowLeft size={20} />
        <span className="text-lg font-medium text-white">帮助中心</span>
      </button>

      {/* 联系客服 */}
      <div className="bg-gradient-to-r from-brand-primary/20 to-brand-secondary/20 border border-brand-primary/30 rounded-xl p-4">
        <div className="flex items-center gap-3 mb-3">
          <MessageCircle className="w-6 h-6 text-brand-primary" />
          <div>
            <h3 className="text-white font-medium">需要帮助？</h3>
            <p className="text-text-tertiary text-xs">我们的客服团队随时为您服务</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {contactOptions.map((option, idx) => {
            const Icon = option.icon;
            return (
              <button
                key={idx}
                onClick={option.action}
                className="p-3 bg-bg-secondary/50 rounded-xl text-left"
              >
                <Icon className="w-5 h-5 text-brand-primary mb-2" />
                <p className="text-white text-sm font-medium">{option.label}</p>
                <p className="text-text-tertiary text-xs">{option.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* 常见问题 */}
      <div className="space-y-2">
        <h3 className="text-white font-medium flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-brand-primary" />
          常见问题
        </h3>

        <div className="space-y-2">
          {faqs.map((faq, idx) => (
            <div
              key={idx}
              className="bg-bg-secondary border border-border-primary rounded-xl overflow-hidden"
            >
              <button
                onClick={() => toggleFaq(idx)}
                className="w-full p-4 flex items-center justify-between text-left"
              >
                <span className="text-white text-sm font-medium pr-4">{faq.question}</span>
                {expandedFaq === idx ? (
                  <ChevronUp className="w-4 h-4 text-text-tertiary flex-shrink-0" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-text-tertiary flex-shrink-0" />
                )}
              </button>
              {expandedFaq === idx && (
                <div className="px-4 pb-4 pt-0">
                  <p className="text-text-secondary text-sm leading-relaxed">
                    {faq.answer}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 文档链接 */}
      <div className="bg-bg-secondary border border-border-primary rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-brand-primary" />
            <div>
              <p className="text-white text-sm font-medium">使用文档</p>
              <p className="text-text-tertiary text-xs">详细的使用指南和教程</p>
            </div>
          </div>
          <button
            onClick={() => {
              haptic('selection');
              window.open('https://docs.quantfi.io', '_blank');
            }}
            className="p-2 text-text-secondary"
          >
            <ExternalLink className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 反馈建议 */}
      <div className="bg-bg-secondary border border-border-primary rounded-xl p-4">
        <h4 className="text-white font-medium text-sm mb-2">提交反馈</h4>
        <p className="text-text-tertiary text-xs mb-3">
          如果您有任何建议或遇到问题，欢迎联系我们
        </p>
        <button
          onClick={() => {
            haptic('selection');
            window.open('https://t.me/quantfi_feedback', '_blank');
          }}
          className="w-full py-3 bg-brand-primary/10 text-brand-primary rounded-xl text-sm font-medium"
        >
          提交反馈
        </button>
      </div>
    </div>
  );
}
