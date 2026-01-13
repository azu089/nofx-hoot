'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Button } from '@/components/ui';
import { MobileHeader } from '@/components/ui';
import {
  HelpCircle,
  MessageCircle,
  FileText,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Mail,
  Send,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * 帮助与反馈页面
 *
 * 功能：
 * - 常见问题 FAQ
 * - 联系客服
 * - 用户指南链接
 * - 意见反馈
 */

interface FAQItem {
  question: string;
  answer: string;
}

const faqList: FAQItem[] = [
  {
    question: '如何获得积分？',
    answer: '您可以通过以下 4 种方式获得积分：\n\n1. 【每日签到】基础 10 积分/天，连续签到最高可达 50 积分/天\n2. 【交易挖矿】每 100 USDT 交易量 = 1 积分，VIP 用户可享受 1.2x-2.0x 倍率加成\n3. 【交易挖矿返佣】您的直接推荐人交易挖矿获得积分的 5%，间接推荐人的 2.5%\n4. 【点卡购买返佣】您的直接推荐人购买点卡金额的 5%，间接推荐人的 2.5%\n\n示例：普通用户每年可获得约 7,770 积分，VIP1 用户约 17,770 积分，VIP3 大户约 142,350 积分。',
  },
  {
    question: '积分有什么用？',
    answer: '积分主要有 3 大用途：\n\n1. 【兑换代币】1000 积分 = 1 QFI 代币（代币价格上涨时，您的积分同步增值）\n   - 标准模式：20% 立即到账 + 80% 线性释放 90 天\n   - 快速模式：50% 立即到账 + 50% 销毁\n\n2. 【质押挖矿】质押积分可获得平台手续费分红\n   - 支持 1 个月、3 个月、6 个月、1 年锁定期\n   - 锁定时间越长，权重越高，收益越多\n   - 预计年化收益 15-25%\n\n3. 【抵扣订阅费】使用积分抵扣 VIP 订阅费用（即将开放）\n\n提示：QFI 代币具有增值空间，当代币价格从 $0.5 涨至 $5 时，您的 10,000 积分价值也会从 $5 涨至 $50！',
  },
  {
    question: '如何开始使用量化交易？',
    answer: '1. 在"钱包"页面充值 USDT；2. 在"钱包"绑定交易所 API Key；3. 在"策略市场"选择一个策略并启用；4. 在"交易控制台"监控您的交易状态。',
  },
  {
    question: '什么是燃油费？',
    answer: '燃油费是平台从您的盈利中收取的服务费，比例为盈利的 20%。只有在您盈利时才会收取，亏损时不收取任何费用。',
  },
  {
    question: '如何绑定交易所 API Key？',
    answer: '在"钱包 > API Key"页面点击"添加 API Key"，输入您的交易所 API Key 和 Secret。请确保只开启"交易"权限，不要开启"提现"权限以保证资金安全。',
  },
  {
    question: '策略运行后多久能看到收益？',
    answer: '策略收益取决于市场行情和策略类型。网格策略通常在横盘行情中表现更好，趋势策略在单边行情中表现更好。建议至少运行 7 天以上再评估策略效果。',
  },
  {
    question: '如何提现？',
    answer: '在"钱包 > 提现"页面输入提现金额和钱包地址，完成 2FA 验证后提交。提现需要人工审核，通常在 24 小时内处理完成。',
  },
  {
    question: '什么是质押？',
    answer: '质押是将您的积分或代币锁定在平台，以获取平台收益分红。A 类质押使用积分，B 类质押使用 $QFI 代币。质押时间越长，权重越高，收益越多。',
  },
  {
    question: '如何邀请好友？',
    answer: '在"邀请返佣"页面复制您的邀请链接或邀请码，分享给好友。好友通过您的链接注册后，您可以获得其交易燃油费的 10% 作为返佣。',
  },
  {
    question: '遇到问题如何联系客服？',
    answer: '您可以通过本页面底部的"联系客服"按钮发送消息，或发送邮件至 support@quantfi.io。我们会在 24 小时内回复您。',
  },
];

export default function HelpPage() {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackSent, setFeedbackSent] = useState(false);

  const handleToggle = (index: number) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  const handleSendFeedback = () => {
    if (!feedbackText.trim()) return;
    // 模拟发送反馈
    setFeedbackSent(true);
    setFeedbackText('');
    setTimeout(() => setFeedbackSent(false), 3000);
  };

  return (
    <div className="space-y-4 lg:space-y-6 pb-20 lg:pb-6">
      <MobileHeader
        title="帮助与反馈"
        subtitle="常见问题解答、联系客服"
      />

      {/* 快捷入口 - 移动端 2x2 网格，极简风格 */}
      <div className="lg:hidden grid grid-cols-2 gap-3 px-4">
        <a
          href="https://docs.quantfi.io"
          target="_blank"
          rel="noopener noreferrer"
          className="p-4 bg-bg-secondary rounded-xl flex flex-col items-center gap-3"
        >
          <div className="w-12 h-12 rounded-full bg-brand-primary/10 flex items-center justify-center">
            <FileText className="w-6 h-6 text-brand-primary" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-text-primary">用户指南</p>
            <p className="text-xs text-text-tertiary flex items-center justify-center gap-1 mt-1">
              查看文档 <ExternalLink className="w-3 h-3" />
            </p>
          </div>
        </a>

        <a href="mailto:support@quantfi.io" className="p-4 bg-bg-secondary rounded-xl flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center">
            <Mail className="w-6 h-6 text-success" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-text-primary">邮件客服</p>
            <p className="text-xs text-text-tertiary mt-1">support@quantfi.io</p>
          </div>
        </a>

        <a
          href="https://t.me/quantfi_support"
          target="_blank"
          rel="noopener noreferrer"
          className="p-4 bg-bg-secondary rounded-xl flex flex-col items-center gap-3"
        >
          <div className="w-12 h-12 rounded-full bg-brand-secondary/10 flex items-center justify-center">
            <MessageCircle className="w-6 h-6 text-brand-secondary" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-text-primary">Telegram</p>
            <p className="text-xs text-text-tertiary flex items-center justify-center gap-1 mt-1">
              在线客服 <ExternalLink className="w-3 h-3" />
            </p>
          </div>
        </a>

        <a
          href="https://discord.gg/quantfi"
          target="_blank"
          rel="noopener noreferrer"
          className="p-4 bg-bg-secondary rounded-xl flex flex-col items-center gap-3"
        >
          <div className="w-12 h-12 rounded-full bg-warning/10 flex items-center justify-center">
            <MessageCircle className="w-6 h-6 text-warning" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-text-primary">Discord</p>
            <p className="text-xs text-text-tertiary flex items-center justify-center gap-1 mt-1">
              社区交流 <ExternalLink className="w-3 h-3" />
            </p>
          </div>
        </a>
      </div>

      {/* 桌面端快捷入口 */}
      <div className="hidden lg:grid grid-cols-2 md:grid-cols-4 gap-4">
        <a
          href="https://docs.quantfi.io"
          target="_blank"
          rel="noopener noreferrer"
          className="block"
        >
          <Card variant="glass" className="hover:border-brand-primary/30 transition-colors cursor-pointer">
            <CardContent className="p-4 flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-brand-primary/10 flex items-center justify-center">
                <FileText className="w-6 h-6 text-brand-primary" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-text-primary">用户指南</p>
                <p className="text-xs text-text-tertiary flex items-center justify-center gap-1 mt-1">
                  查看文档 <ExternalLink className="w-3 h-3" />
                </p>
              </div>
            </CardContent>
          </Card>
        </a>

        <a href="mailto:support@quantfi.io" className="block">
          <Card variant="glass" className="hover:border-brand-primary/30 transition-colors cursor-pointer">
            <CardContent className="p-4 flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center">
                <Mail className="w-6 h-6 text-success" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-text-primary">邮件客服</p>
                <p className="text-xs text-text-tertiary mt-1">support@quantfi.io</p>
              </div>
            </CardContent>
          </Card>
        </a>

        <a
          href="https://t.me/quantfi_support"
          target="_blank"
          rel="noopener noreferrer"
          className="block"
        >
          <Card variant="glass" className="hover:border-brand-primary/30 transition-colors cursor-pointer">
            <CardContent className="p-4 flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-brand-secondary/10 flex items-center justify-center">
                <MessageCircle className="w-6 h-6 text-brand-secondary" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-text-primary">Telegram</p>
                <p className="text-xs text-text-tertiary flex items-center justify-center gap-1 mt-1">
                  在线客服 <ExternalLink className="w-3 h-3" />
                </p>
              </div>
            </CardContent>
          </Card>
        </a>

        <a
          href="https://discord.gg/quantfi"
          target="_blank"
          rel="noopener noreferrer"
          className="block"
        >
          <Card variant="glass" className="hover:border-brand-primary/30 transition-colors cursor-pointer">
            <CardContent className="p-4 flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-warning/10 flex items-center justify-center">
                <MessageCircle className="w-6 h-6 text-warning" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-text-primary">Discord</p>
                <p className="text-xs text-text-tertiary flex items-center justify-center gap-1 mt-1">
                  社区交流 <ExternalLink className="w-3 h-3" />
                </p>
              </div>
            </CardContent>
          </Card>
        </a>
      </div>

      {/* 常见问题 - 移动端极简风格 */}
      <div className="lg:hidden">
        <div className="px-4 py-3">
          <h3 className="text-sm font-medium text-text-primary flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-brand-primary" />
            常见问题
          </h3>
        </div>
        <div>
          {faqList.map((faq, index) => (
            <div
              key={index}
              className={cn(
                'transition-colors',
                index % 2 === 1 ? 'bg-bg-secondary' : '',
                expandedIndex === index ? 'bg-brand-primary/5' : ''
              )}
            >
              <button
                onClick={() => handleToggle(index)}
                className="w-full flex items-center justify-between px-4 py-4 text-left"
              >
                <span className="text-sm font-medium text-text-primary pr-4">{faq.question}</span>
                {expandedIndex === index ? (
                  <ChevronUp className="w-4 h-4 text-brand-primary flex-shrink-0" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-text-tertiary flex-shrink-0" />
                )}
              </button>
              {expandedIndex === index && (
                <div className="px-4 pb-4">
                  <p className="text-sm text-text-secondary leading-relaxed">{faq.answer}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 桌面端常见问题 */}
      <Card variant="glass" className="hidden lg:block">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-brand-primary" />
            常见问题
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {faqList.map((faq, index) => (
            <div
              key={index}
              className={cn(
                'rounded-xl border transition-colors',
                expandedIndex === index
                  ? 'border-brand-primary/30 bg-brand-primary/5'
                  : 'border-border-primary/30 hover:border-border-primary/50'
              )}
            >
              <button
                onClick={() => handleToggle(index)}
                className="w-full flex items-center justify-between p-4 text-left"
              >
                <span className="text-sm font-medium text-text-primary pr-4">{faq.question}</span>
                {expandedIndex === index ? (
                  <ChevronUp className="w-4 h-4 text-brand-primary flex-shrink-0" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-text-tertiary flex-shrink-0" />
                )}
              </button>
              {expandedIndex === index && (
                <div className="px-4 pb-4">
                  <p className="text-sm text-text-secondary leading-relaxed">{faq.answer}</p>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* 意见反馈 - 移动端极简风格 */}
      <div className="lg:hidden px-4 space-y-4">
        <h3 className="text-sm font-medium text-text-primary flex items-center gap-2">
          <Send className="w-4 h-4 text-brand-primary" />
          意见反馈
        </h3>
        <textarea
          value={feedbackText}
          onChange={(e) => setFeedbackText(e.target.value)}
          placeholder="请描述您遇到的问题或建议..."
          className="w-full h-32 px-4 py-3 bg-bg-secondary rounded-xl text-text-primary placeholder-text-tertiary resize-none focus:outline-none focus:ring-1 focus:ring-brand-primary/30"
        />
        <div className="flex items-center justify-between">
          <p className="text-xs text-text-tertiary">
            我们会认真阅读每一条反馈
          </p>
          <Button
            variant="gradient"
            onClick={handleSendFeedback}
            disabled={!feedbackText.trim()}
          >
            <Send className="w-4 h-4 mr-2" />
            提交反馈
          </Button>
        </div>
        {feedbackSent && (
          <div className="p-3 rounded-lg bg-success/10 text-success text-sm text-center">
            感谢您的反馈！我们会尽快处理。
          </div>
        )}
      </div>

      {/* 桌面端意见反馈 */}
      <Card variant="glass" className="hidden lg:block">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="w-5 h-5 text-brand-primary" />
            意见反馈
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <textarea
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
            placeholder="请描述您遇到的问题或建议..."
            className="w-full h-32 px-4 py-3 bg-bg-tertiary border border-border-primary rounded-xl text-text-primary placeholder-text-tertiary resize-none focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20"
          />
          <div className="flex items-center justify-between">
            <p className="text-xs text-text-tertiary">
              我们会认真阅读每一条反馈
            </p>
            <Button
              variant="gradient"
              onClick={handleSendFeedback}
              disabled={!feedbackText.trim()}
            >
              <Send className="w-4 h-4 mr-2" />
              提交反馈
            </Button>
          </div>
          {feedbackSent && (
            <div className="p-3 rounded-lg bg-success/10 text-success text-sm text-center">
              感谢您的反馈！我们会尽快处理。
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
