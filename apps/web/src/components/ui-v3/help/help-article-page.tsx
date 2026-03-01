'use client'

import {
  ArrowLeft,
  BookOpen,
  Key,
  TrendingUp,
  CreditCard,
  Shield,
  Receipt,
  Brain,
  Wallet,
  Coins,
  Users,
  Send,
  Microscope,
  ShieldCheck,
  Grid3X3,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Info,
  Lightbulb
} from 'lucide-react'
import { helpArticles } from '@/lib/help-content'
import { useLocale } from '@/i18n/provider'
import { useTranslations } from 'next-intl'

interface HelpArticlePageProps {
  slug: string
  onBack?: () => void
  onNavigate?: (path: string) => void
}

// 文章图标映射
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  'getting-started': BookOpen,
  'ai-trading': Brain,
  'ai-research': Microscope,
  'api-keys': Key,
  'wallet-funds': Wallet,
  'hoot-token': Coins,
  'invite-earn': Users,
  'billing-security': ShieldCheck,
  'tg-bot': Send,
  'grid-trading': Grid3X3,
  // 旧slug兼容
  'strategies': TrendingUp,
  'deposits-withdrawals': CreditCard,
  'security': Shield,
  'billing': Receipt,
}

// 旧版 defaultArticles 保留作为 fallback（已移至 help-content.ts）
const defaultArticles: Record<string, { titleZh: string; titleEn: string; sections: Array<{ titleZh: string; titleEn: string; contentZh: string; contentEn: string; type?: 'info' | 'warning' | 'success' | 'tip' }> }> = {
  'getting-started': {
    titleZh: '快速入门',
    titleEn: 'Getting Started',
    sections: [
      {
        titleZh: '欢迎使用 Hoot',
        titleEn: 'Welcome to Hoot',
        contentZh: 'Hoot 是一个 AI 驱动的量化交易平台，帮助您轻松跟随专业策略进行交易。本指南将帮助您快速上手。',
        contentEn: 'Hoot is an AI-powered quantitative trading platform that helps you easily follow professional strategies for trading. This guide will help you get started quickly.'
      },
      {
        titleZh: '第一步：创建账户',
        titleEn: 'Step 1: Create Account',
        contentZh: '1. 访问 Hoot 官网或下载 App\n2. 点击"注册"按钮\n3. 使用邮箱或钱包地址注册\n4. 完成邮箱验证（如使用邮箱注册）',
        contentEn: '1. Visit Hoot website or download the App\n2. Click the "Register" button\n3. Register using email or wallet address\n4. Complete email verification (if using email)'
      },
      {
        titleZh: '第二步：绑定交易所 API',
        titleEn: 'Step 2: Connect Exchange API',
        contentZh: '1. 进入"钱包" > "API 密钥管理"\n2. 选择您使用的交易所（支持 Binance、OKX、Bybit）\n3. 在交易所创建 API Key（只需开启交易权限，无需提现权限）\n4. 将 API Key 和 Secret 填入 Hoot\n5. 测试连接确认配置正确',
        contentEn: '1. Go to "Wallet" > "API Key Management"\n2. Select your exchange (supports Binance, OKX, Bybit)\n3. Create API Key on exchange (only trading permission needed, no withdrawal)\n4. Enter API Key and Secret in Hoot\n5. Test connection to confirm setup'
      },
      {
        titleZh: '第三步：订阅策略',
        titleEn: 'Step 3: Subscribe to Strategy',
        contentZh: '1. 浏览"策略市场"，查看各策略的收益率和风险等级\n2. 选择适合您风险偏好的策略\n3. 设置每单金额和最大持仓数\n4. 确认订阅并开始跟单',
        contentEn: '1. Browse "Strategy Market" to view returns and risk levels\n2. Choose a strategy that matches your risk preference\n3. Set amount per trade and max positions\n4. Confirm subscription and start copy trading'
      },
      {
        titleZh: '安全提示',
        titleEn: 'Security Tips',
        contentZh: '• 请勿将 API Key 泄露给任何人\n• 建议开启两步验证保护账户\n• 定期检查交易记录确保正常',
        contentEn: '• Never share your API Key with anyone\n• Enable 2FA for account protection\n• Regularly check trading records',
        type: 'warning'
      }
    ]
  },
  'api-keys': {
    titleZh: 'API 密钥管理',
    titleEn: 'API Key Management',
    sections: [
      {
        titleZh: '什么是 API Key',
        titleEn: 'What is an API Key',
        contentZh: 'API Key 是您在交易所创建的密钥对，允许 Hoot 代您执行交易。通过 API Key，Hoot 可以在收到策略信号时自动下单，无需您手动操作。',
        contentEn: 'An API Key is a key pair created on your exchange that allows Hoot to execute trades on your behalf. Through API Keys, Hoot can automatically place orders when receiving strategy signals.'
      },
      {
        titleZh: '如何创建 API Key',
        titleEn: 'How to Create API Key',
        contentZh: '以 Binance 为例：\n\n1. 登录 Binance 账户\n2. 进入"API 管理"页面\n3. 点击"创建 API"\n4. 设置 API 名称（如：Hoot Trading）\n5. 完成安全验证\n6. 权限设置：只开启"启用现货交易"，不要开启"启用提现"',
        contentEn: 'Using Binance as example:\n\n1. Log in to Binance account\n2. Go to "API Management" page\n3. Click "Create API"\n4. Set API name (e.g., Hoot Trading)\n5. Complete security verification\n6. Permission: Only enable "Enable Spot Trading", do NOT enable "Enable Withdrawals"'
      },
      {
        titleZh: '重要安全提示',
        titleEn: 'Important Security Tips',
        contentZh: '• 绝对不要开启提现权限\n• 建议设置 IP 白名单限制\n• 定期更换 API Key\n• 如发现异常立即删除 API Key',
        contentEn: '• NEVER enable withdrawal permission\n• Set IP whitelist restriction if possible\n• Rotate API Keys regularly\n• Delete API Key immediately if suspicious activity detected',
        type: 'warning'
      },
      {
        titleZh: 'API Key 安全存储',
        titleEn: 'API Key Security Storage',
        contentZh: 'Hoot 使用 AES-256-GCM 军用级加密存储您的 API Key。您的密钥在传输和存储过程中都是加密的，即使是 Hoot 的工程师也无法查看您的原始密钥。',
        contentEn: 'Hoot uses AES-256-GCM military-grade encryption to store your API Keys. Your keys are encrypted during transmission and storage. Even Hoot engineers cannot view your raw keys.',
        type: 'success'
      }
    ]
  },
  'strategies': {
    titleZh: '策略使用指南',
    titleEn: 'Strategy Guide',
    sections: [
      {
        titleZh: '策略市场介绍',
        titleEn: 'Strategy Market Introduction',
        contentZh: 'Hoot 策略市场汇集了多种专业量化策略，每个策略都经过严格的回测和实盘验证。您可以根据自己的风险偏好选择合适的策略。',
        contentEn: 'Hoot Strategy Market features various professional quantitative strategies, each thoroughly backtested and live-tested. Choose strategies based on your risk preference.'
      },
      {
        titleZh: '如何选择策略',
        titleEn: 'How to Choose Strategy',
        contentZh: '选择策略时，请关注以下指标：\n\n• 收益率：7天/30天/90天收益率\n• 最大回撤：策略历史最大亏损幅度\n• 胜率：盈利交易占比\n• 风险等级：低/中/高\n\n建议新手从低风险策略开始，熟悉后再尝试更激进的策略。',
        contentEn: 'When choosing a strategy, focus on:\n\n• Returns: 7d/30d/90d returns\n• Max Drawdown: Historical maximum loss\n• Win Rate: Percentage of profitable trades\n• Risk Level: Low/Medium/High\n\nBeginners should start with low-risk strategies.'
      },
      {
        titleZh: '订阅配置说明',
        titleEn: 'Subscription Settings',
        contentZh: '订阅策略时需要配置：\n\n1. API Key：选择要使用的交易所账户\n2. 每单金额：每次交易投入的 USDT 数量\n3. 最大持仓：同时持有的最大仓位数\n4. 止损止盈：可选的风控设置',
        contentEn: 'Configure when subscribing:\n\n1. API Key: Select exchange account to use\n2. Amount per Trade: USDT amount for each trade\n3. Max Positions: Maximum concurrent positions\n4. Stop Loss/Take Profit: Optional risk settings'
      },
      {
        titleZh: '小贴士',
        titleEn: 'Tips',
        contentZh: '• 不要把所有资金都用于一个策略\n• 建议预留 20% 资金作为安全边际\n• 关注市场行情调整策略配置',
        contentEn: '• Don\'t allocate all funds to one strategy\n• Reserve 20% funds as safety margin\n• Adjust strategy settings based on market conditions',
        type: 'tip'
      }
    ]
  },
  'deposits-withdrawals': {
    titleZh: '充值与提现',
    titleEn: 'Deposits & Withdrawals',
    sections: [
      {
        titleZh: '充值说明',
        titleEn: 'Deposit Instructions',
        contentZh: 'Hoot 支持 USDT 充值，用于支付订阅费用和平台服务。\n\n支持的链：\n• BNB Smart Chain (BSC)\n• Ethereum (ERC20)\n• Tron (TRC20)\n\n建议使用 BSC 链，手续费最低。',
        contentEn: 'Hoot supports USDT deposits for subscription fees and platform services.\n\nSupported chains:\n• BNB Smart Chain (BSC)\n• Ethereum (ERC20)\n• Tron (TRC20)\n\nBSC is recommended for lowest fees.'
      },
      {
        titleZh: '充值步骤',
        titleEn: 'Deposit Steps',
        contentZh: '1. 进入"钱包" > "充值"\n2. 选择充值链（建议 BSC）\n3. 复制充值地址\n4. 从您的钱包或交易所转账 USDT\n5. 等待区块确认（通常 1-3 分钟）',
        contentEn: '1. Go to "Wallet" > "Deposit"\n2. Select chain (BSC recommended)\n3. Copy deposit address\n4. Transfer USDT from your wallet or exchange\n5. Wait for block confirmation (usually 1-3 minutes)'
      },
      {
        titleZh: '提现说明',
        titleEn: 'Withdrawal Instructions',
        contentZh: '提现流程：\n\n1. 进入"钱包" > "提现"\n2. 输入提现金额和地址\n3. 提交提现申请\n4. 等待审核（通常 24 小时内）\n5. 审核通过后自动发放',
        contentEn: 'Withdrawal process:\n\n1. Go to "Wallet" > "Withdraw"\n2. Enter amount and address\n3. Submit withdrawal request\n4. Wait for review (usually within 24 hours)\n5. Auto-released after approval'
      },
      {
        titleZh: '注意事项',
        titleEn: 'Important Notes',
        contentZh: '• 确保充值地址和链正确，错误的链可能导致资金丢失\n• 最低充值金额：10 USDT\n• 最低提现金额：20 USDT\n• 提现手续费：根据链不同，1-5 USDT',
        contentEn: '• Ensure correct address and chain, wrong chain may cause fund loss\n• Minimum deposit: 10 USDT\n• Minimum withdrawal: 20 USDT\n• Withdrawal fee: 1-5 USDT depending on chain',
        type: 'warning'
      }
    ]
  },
  'security': {
    titleZh: '安全设置',
    titleEn: 'Security Settings',
    sections: [
      {
        titleZh: '账户安全概述',
        titleEn: 'Account Security Overview',
        contentZh: 'Hoot 采用多层安全机制保护您的账户和资产。我们建议您开启所有可用的安全功能。',
        contentEn: 'Hoot uses multiple security layers to protect your account and assets. We recommend enabling all available security features.'
      },
      {
        titleZh: '两步验证 (2FA)',
        titleEn: 'Two-Factor Authentication (2FA)',
        contentZh: '强烈建议开启两步验证：\n\n1. 进入"设置" > "安全设置"\n2. 点击"开启两步验证"\n3. 使用 Google Authenticator 扫描二维码\n4. 输入验证码确认\n\n开启后，每次登录都需要输入动态验证码。',
        contentEn: 'Strongly recommend enabling 2FA:\n\n1. Go to "Settings" > "Security"\n2. Click "Enable 2FA"\n3. Scan QR code with Google Authenticator\n4. Enter code to confirm\n\nAfter enabling, each login requires a dynamic code.'
      },
      {
        titleZh: '密码安全',
        titleEn: 'Password Security',
        contentZh: '密码设置建议：\n\n• 至少 8 位字符\n• 包含大小写字母、数字和符号\n• 不要使用生日、电话等易猜信息\n• 定期更换密码\n• 不要在多个平台使用相同密码',
        contentEn: 'Password recommendations:\n\n• At least 8 characters\n• Include uppercase, lowercase, numbers, symbols\n• Avoid birthday, phone number, etc.\n• Change password regularly\n• Don\'t reuse passwords across platforms'
      },
      {
        titleZh: 'API Key 安全',
        titleEn: 'API Key Security',
        contentZh: '保护您的 API Key：\n\n• 只在 Hoot 官方平台输入 API Key\n• 不要截图或分享 API Key\n• 设置 IP 白名单（如交易所支持）\n• 定期检查 API Key 使用记录',
        contentEn: 'Protect your API Keys:\n\n• Only enter API Keys on official Hoot platform\n• Don\'t screenshot or share API Keys\n• Set IP whitelist (if exchange supports)\n• Regularly check API Key usage logs',
        type: 'info'
      }
    ]
  },
  'billing': {
    titleZh: '计费说明',
    titleEn: 'Billing Information',
    sections: [
      {
        titleZh: '收费模式',
        titleEn: 'Pricing Model',
        contentZh: 'Hoot 采用透明的收费模式：\n\n1. 策略订阅费：按策略定价，月度订阅\n2. 燃油费：仅在盈利时收取 20%\n\n无隐藏费用，无充值手续费。',
        contentEn: 'Hoot uses transparent pricing:\n\n1. Strategy subscription: Monthly, varies by strategy\n2. Gas fee: 20% only on profits\n\nNo hidden fees, no deposit fees.'
      },
      {
        titleZh: '策略订阅费',
        titleEn: 'Strategy Subscription',
        contentZh: '每个策略有不同的月订阅费，订阅后 30 天内有效。\n\n支付方式：\n• USDT 余额\n• 点卡余额（1:1 USDT）\n\n续费方式：自动续费或手动续费',
        contentEn: 'Each strategy has different monthly fees, valid for 30 days.\n\nPayment methods:\n• USDT balance\n• Point card balance (1:1 USDT)\n\nRenewal: Auto or manual'
      },
      {
        titleZh: '燃油费（Gas Fee）',
        titleEn: 'Gas Fee',
        contentZh: '燃油费是 Hoot 的核心收费机制：\n\n• 仅在盈利交易平仓时收取\n• 费率：盈利金额的 20%\n• 亏损交易不收取任何费用\n\n这确保了我们的利益与您一致——只有您赚钱，我们才收费。',
        contentEn: 'Gas fee is Hoot\'s core charging mechanism:\n\n• Only charged when closing profitable trades\n• Rate: 20% of profit\n• No charge for losing trades\n\nThis aligns our interests—we only charge when you profit.',
        type: 'success'
      },
      {
        titleZh: '点卡系统',
        titleEn: 'Point Card System',
        contentZh: '点卡是 Hoot 的预付费系统：\n\n• 1 点卡 = 1 USDT\n• 可用于支付订阅费\n• 充值赠送活动不定期推出\n• 点卡不可提现，只能消费',
        contentEn: 'Point cards are Hoot\'s prepaid system:\n\n• 1 Point = 1 USDT\n• Can pay for subscriptions\n• Bonus promotions available\n• Points cannot be withdrawn',
        type: 'info'
      }
    ]
  }
}

export function HelpArticlePage({ slug, onBack, onNavigate }: HelpArticlePageProps) {
  const t = useTranslations('help')
  const tCommon = useTranslations('common')

  // 跟随系统语言设置
  const { locale: systemLocale } = useLocale()
  // 映射系统语言到内容语言（帮助内容只有 zh/en 两种版本）
  const locale = systemLocale === 'en' ? 'en' : 'zh'

  // 优先使用新的 helpArticles，fallback 到 defaultArticles
  const article = helpArticles[slug] || defaultArticles[slug]

  // 解析内联 Markdown
  const parseInlineMarkdown = (text: string): React.ReactNode => {
    const parts: React.ReactNode[] = []
    const regex = /\*\*(.*?)\*\*/g
    let lastIndex = 0
    let match

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index))
      }
      parts.push(
        <strong key={match.index} className="text-[#F8F8FC] font-semibold">
          {match[1]}
        </strong>
      )
      lastIndex = regex.lastIndex
    }

    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex))
    }

    return parts.length > 0 ? parts : text
  }

  // 渲染内容（支持 Markdown 格式）
  const renderContent = (text: string) => {
    const lines = text.split('\n')
    const elements: React.ReactNode[] = []

    lines.forEach((line, index) => {
      const trimmedLine = line.trim()

      if (trimmedLine.startsWith('**') && trimmedLine.endsWith('**') && !trimmedLine.includes('**', 2)) {
        // 独立加粗标题
        elements.push(
          <p key={index} className="font-bold text-[#06B6D4] mt-4 mb-2">
            {trimmedLine.replace(/\*\*/g, '')}
          </p>
        )
      } else if (trimmedLine.startsWith('• ') || trimmedLine.startsWith('- ')) {
        // 列表项
        elements.push(
          <li key={index} className="text-[#9090A0] ml-4 mb-1 list-disc">
            {parseInlineMarkdown(trimmedLine.replace(/^[•\-]\s/, ''))}
          </li>
        )
      } else if (/^\d+\.\s/.test(trimmedLine)) {
        // 有序列表
        elements.push(
          <li key={index} className="text-[#9090A0] ml-4 mb-1 list-decimal">
            {parseInlineMarkdown(trimmedLine.replace(/^\d+\.\s/, ''))}
          </li>
        )
      } else if (trimmedLine.startsWith('✓ ') || trimmedLine.startsWith('✅ ')) {
        // 成功项
        elements.push(
          <div key={index} className="flex items-start gap-2 mb-1">
            <span className="text-green-400">✓</span>
            <span className="text-[#9090A0]">{parseInlineMarkdown(trimmedLine.replace(/^[✓✅]\s/, ''))}</span>
          </div>
        )
      } else if (trimmedLine.startsWith('❌ ')) {
        // 错误项
        elements.push(
          <div key={index} className="flex items-start gap-2 mb-1">
            <span className="text-red-400">✗</span>
            <span className="text-[#9090A0]">{parseInlineMarkdown(trimmedLine.replace(/^❌\s/, ''))}</span>
          </div>
        )
      } else if (trimmedLine.startsWith('⚠️ ')) {
        // 警告项
        elements.push(
          <div key={index} className="flex items-start gap-2 mb-1">
            <span className="text-yellow-400">⚠</span>
            <span className="text-[#9090A0]">{parseInlineMarkdown(trimmedLine.replace(/^⚠️\s/, ''))}</span>
          </div>
        )
      } else if (trimmedLine.startsWith('□ ')) {
        // 复选框
        elements.push(
          <div key={index} className="flex items-start gap-2 mb-1">
            <span className="text-[#06B6D4]">☐</span>
            <span className="text-[#9090A0]">{trimmedLine.replace(/^□\s/, '')}</span>
          </div>
        )
      } else if (trimmedLine.startsWith('|') && trimmedLine.endsWith('|')) {
        // 简单表格行（跳过分隔行）
        if (!trimmedLine.includes('---')) {
          const cells = trimmedLine.split('|').filter(c => c.trim())
          elements.push(
            <div key={index} className="grid grid-cols-2 gap-2 text-sm text-[#9090A0] mb-1">
              {cells.map((cell, i) => (
                <span key={i} className={i === 0 ? 'font-medium text-[#F8F8FC]' : ''}>
                  {cell.trim()}
                </span>
              ))}
            </div>
          )
        }
      } else if (trimmedLine === '') {
        elements.push(<div key={index} className="h-2" />)
      } else {
        elements.push(
          <p key={index} className="text-[#9090A0] mb-2 leading-relaxed">
            {parseInlineMarkdown(trimmedLine)}
          </p>
        )
      }
    })

    return elements
  }

  // 渲染提示框
  const renderAlert = (content: string, type: 'info' | 'warning' | 'success' | 'tip') => {
    const configs = {
      info: { icon: Info, bg: 'bg-blue-500/10', border: 'border-blue-500/20', text: 'text-blue-400' },
      warning: { icon: AlertCircle, bg: 'bg-yellow-500/10', border: 'border-yellow-500/20', text: 'text-yellow-400' },
      success: { icon: CheckCircle2, bg: 'bg-green-500/10', border: 'border-green-500/20', text: 'text-green-400' },
      tip: { icon: Lightbulb, bg: 'bg-purple-500/10', border: 'border-purple-500/20', text: 'text-purple-400' }
    }
    const config = configs[type]
    const AlertIcon = config.icon

    return (
      <div className={`${config.bg} ${config.border} border rounded-xl p-4 mt-4`}>
        <div className="flex items-start gap-3">
          <AlertIcon className={`w-5 h-5 ${config.text} flex-shrink-0 mt-0.5`} />
          <div className="text-sm leading-relaxed">{renderContent(content)}</div>
        </div>
      </div>
    )
  }

  if (!article) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] text-[#F8F8FC] flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-[#606070] mx-auto mb-4" />
          <p className="text-[#9090A0]">{t('articleNotFound')}</p>
          <button
            type="button"
            onClick={onBack}
            className="mt-4 px-4 py-2 bg-[#06B6D4] text-white rounded-lg"
          >
            {t('backToHelpCenter')}
          </button>
        </div>
      </div>
    )
  }

  const title = locale === 'zh' ? article.titleZh : article.titleEn

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-[#F8F8FC]">
      {/* Header - 统一简洁样式 */}
      <div className="sticky top-0 z-50 bg-[#0A0A0F]/95 backdrop-blur-lg border-b border-[#1E1E2E]">
        <div className="flex items-center justify-between px-4 h-14">
          <button
            type="button"
            onClick={onBack}
            aria-label={tCommon('back')}
            className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-[#12121A] transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <h1 className="text-base font-semibold text-white">{title}</h1>
          <div className="w-10" />
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="space-y-6">
          {article.sections.map((section, index) => {
            const sectionTitle = locale === 'zh' ? section.titleZh : section.titleEn
            const sectionContent = locale === 'zh' ? section.contentZh : section.contentEn

            return (
              <section key={index} className="bg-[#12121A]/80 backdrop-blur-xl border border-[#1E1E2E] rounded-2xl p-6">
                <h2 className="text-lg font-semibold text-[#F8F8FC] mb-4 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-[#06B6D4]/20 text-[#06B6D4] text-sm flex items-center justify-center">
                    {index + 1}
                  </span>
                  {sectionTitle}
                </h2>

                {section.type ? (
                  renderAlert(sectionContent, section.type)
                ) : (
                  <div className="prose prose-invert max-w-none">
                    {renderContent(sectionContent)}
                  </div>
                )}
              </section>
            )
          })}
        </div>

        {/* 相关链接 */}
        <div className="mt-8 bg-[#12121A]/80 backdrop-blur-xl border border-[#1E1E2E] rounded-2xl p-6">
          <h3 className="text-lg font-semibold mb-4">{t('relatedTopics')}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {Object.entries(helpArticles)
              .filter(([key]) => key !== slug)
              .slice(0, 4)
              .map(([key, relatedArticle]) => {
                const Icon = iconMap[key] || BookOpen
                return (
                  <button
                    type="button"
                    key={key}
                    onClick={() => onNavigate?.(`/help/${key}`)}
                    className="flex items-center gap-3 p-3 rounded-xl bg-[#1E1E2E]/50 hover:bg-[#1E1E2E] transition-colors text-left group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-[#06B6D4]/10 flex items-center justify-center group-hover:bg-[#06B6D4]/20 transition-colors">
                      <Icon className="w-4 h-4 text-[#06B6D4]" />
                    </div>
                    <span className="text-sm text-[#F8F8FC]">
                      {locale === 'zh' ? relatedArticle.titleZh : relatedArticle.titleEn}
                    </span>
                    <ChevronRight className="w-4 h-4 text-[#606070] ml-auto group-hover:text-[#06B6D4] transition-colors" />
                  </button>
                )
              })}
          </div>
        </div>

        {/* Bottom Spacer */}
        <div className="h-20 md:h-0" />
      </div>
    </div>
  )
}
