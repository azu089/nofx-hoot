'use client';

import { useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@repo/design-system/components/ui/card';
import { Button } from '@repo/design-system/components/ui/button';
import { Input } from '@repo/design-system/components/ui/input';
import {
  HelpCircle,
  Search,
  Book,
  MessageCircle,
  Mail,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Zap,
  Wallet,
  BarChart3,
  Shield,
  Users,
  Settings,
} from 'lucide-react';

// 常见问题分类
const faqCategories = [
  {
    id: 'getting-started',
    name: '新手入门',
    icon: Book,
    questions: [
      {
        q: '如何开始使用 QuantFi？',
        a: '1. 注册账户并完成邮箱验证\n2. 充值 USDT 到您的钱包\n3. 绑定交易所 API Key\n4. 在策略市场选择合适的策略订阅\n5. 配置投入金额并启动策略',
      },
      {
        q: '支持哪些交易所？',
        a: '目前支持 Binance、OKX、Bybit 三大交易所。我们会持续接入更多交易所。',
      },
      {
        q: '最低投入金额是多少？',
        a: '不同策略的最低投入金额不同，一般在 100-1000 USDT 之间。具体请查看策略详情页面。',
      },
    ],
  },
  {
    id: 'strategies',
    name: '策略相关',
    icon: Zap,
    questions: [
      {
        q: '策略是如何运行的？',
        a: '策略运行在我们的云端服务器上，通过您绑定的 API Key 进行交易。您无需保持电脑开机，策略会 24/7 自动运行。',
      },
      {
        q: '策略订阅费是怎么收取的？',
        a: '策略订阅费按周期（月/季/年）一次性收取。订阅期间可随时暂停策略，但不支持退款。',
      },
      {
        q: 'Gas 费是什么？',
        a: 'Gas 费是策略盈利后收取的分成，比例为盈利的 20%。只有盈利才收取，亏损不收费。',
      },
      {
        q: '可以同时运行多个策略吗？',
        a: '可以。您可以同时订阅和运行多个策略，但建议根据资金规模合理分配。',
      },
    ],
  },
  {
    id: 'wallet',
    name: '钱包与资金',
    icon: Wallet,
    questions: [
      {
        q: '如何充值？',
        a: '进入「钱包」-「充值」页面，选择充值网络（TRC20/ERC20/BEP20），复制充值地址，从您的钱包转账 USDT 即可。',
      },
      {
        q: '充值多久到账？',
        a: '取决于区块链网络确认速度：\n- TRC20：约 1-3 分钟\n- ERC20：约 5-15 分钟\n- BEP20：约 1-3 分钟',
      },
      {
        q: '如何提现？',
        a: '进入「钱包」-「提现」页面，输入提现地址和金额，确认后即可发起提现。提现会在 24 小时内处理。',
      },
      {
        q: '提现手续费是多少？',
        a: '不同网络手续费不同：\n- TRC20：1 USDT\n- ERC20：5 USDT\n- BEP20：0.5 USDT',
      },
    ],
  },
  {
    id: 'security',
    name: '安全相关',
    icon: Shield,
    questions: [
      {
        q: 'API Key 安全吗？',
        a: '我们采用银行级 AES-256-GCM 加密存储您的 API Key，传输过程全程 HTTPS 加密。建议只授予"交易"权限，不要授予"提现"权限。',
      },
      {
        q: '如何启用两步验证？',
        a: '进入「设置」-「安全设置」，点击启用两步验证，使用 Google Authenticator 扫描二维码，输入验证码即可。',
      },
      {
        q: '忘记密码怎么办？',
        a: '点击登录页面的「忘记密码」，输入注册邮箱，按照邮件提示重置密码。',
      },
    ],
  },
  {
    id: 'gamefi',
    name: 'GameFi 积分',
    icon: Users,
    questions: [
      {
        q: '如何获取积分？',
        a: '积分获取途径：\n1. 策略交易产生的 Gas 费（1 USDT = 100 积分）\n2. 邀请好友（好友首充返 1000 积分）\n3. 每日签到\n4. 参与平台活动',
      },
      {
        q: '积分可以做什么？',
        a: '积分可以兑换成 USDT 或 QFI 代币。标准模式 100:1（100积分=1USDT），急速模式 110:1（额外10%手续费但即时到账）。',
      },
      {
        q: '质押有什么好处？',
        a: 'A 类质押：随存随取，固定年化 5%\nB 类质押：锁仓可获得更高权重和年化，最高 15% APR + 3x 权重',
      },
    ],
  },
  {
    id: 'technical',
    name: '技术问题',
    icon: Settings,
    questions: [
      {
        q: 'API Key 显示无效怎么办？',
        a: '请检查：\n1. API Key 和 Secret 是否复制完整\n2. API 权限是否正确（需要现货交易权限）\n3. 是否绑定了 IP 白名单（需添加我们的 IP）\n4. API Key 是否过期',
      },
      {
        q: '策略突然停止了怎么办？',
        a: '可能原因：\n1. 余额不足以支付订阅费\n2. API Key 失效\n3. 交易所 API 临时故障\n请检查以上情况后联系客服。',
      },
      {
        q: '如何查看策略日志？',
        a: '进入「交易」-「交易控制台」，可以实时查看策略运行日志和交易记录。',
      },
    ],
  },
];

// 快速入口
const quickLinks = [
  { name: '新手指南', icon: Book, href: '/help/guide' },
  { name: '视频教程', icon: BarChart3, href: '/help/videos' },
  { name: '在线客服', icon: MessageCircle, href: '#chat' },
  { name: '提交工单', icon: Mail, href: '/help/ticket' },
];

export default function HelpPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedCategory, setExpandedCategory] = useState<string | null>('getting-started');
  const [expandedQuestions, setExpandedQuestions] = useState<Set<string>>(new Set());

  const toggleQuestion = (categoryId: string, questionIndex: number) => {
    const key = `${categoryId}-${questionIndex}`;
    setExpandedQuestions((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // 过滤问题
  const filteredCategories = searchTerm
    ? faqCategories.map((category) => ({
        ...category,
        questions: category.questions.filter(
          (q) =>
            q.q.toLowerCase().includes(searchTerm.toLowerCase()) ||
            q.a.toLowerCase().includes(searchTerm.toLowerCase())
        ),
      })).filter((category) => category.questions.length > 0)
    : faqCategories;

  return (
    <div className="space-y-6 p-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold flex items-center justify-center gap-2">
          <HelpCircle className="w-7 h-7 text-primary" />
          帮助中心
        </h1>
        <p className="text-muted-foreground mt-1">有问题？我们来帮您解答</p>
      </div>

      {/* 搜索框 */}
      <div className="max-w-2xl mx-auto">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="搜索常见问题..."
            className="pl-12 py-6 text-lg"
          />
        </div>
      </div>

      {/* 快速入口 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
        {quickLinks.map((link) => (
          <Card key={link.name} className="hover:border-primary/50 transition-colors cursor-pointer">
            <CardContent className="p-4 text-center">
              <link.icon className="w-8 h-8 mx-auto mb-2 text-primary" />
              <p className="font-medium">{link.name}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* FAQ 列表 */}
      <div className="max-w-4xl mx-auto">
        <h2 className="text-xl font-bold mb-4">常见问题</h2>

        {filteredCategories.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <HelpCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">未找到相关问题</p>
              <p className="text-sm text-muted-foreground mt-2">
                试试其他关键词，或联系在线客服
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredCategories.map((category) => {
              const Icon = category.icon;
              const isExpanded = expandedCategory === category.id || searchTerm;

              return (
                <Card key={category.id}>
                  <CardHeader
                    className="cursor-pointer"
                    onClick={() => setExpandedCategory(isExpanded && !searchTerm ? null : category.id)}
                  >
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center">
                          <Icon className="w-5 h-5 text-primary" />
                        </div>
                        <span>{category.name}</span>
                        <span className="text-sm text-muted-foreground font-normal">
                          ({category.questions.length} 个问题)
                        </span>
                      </div>
                      {!searchTerm && (
                        isExpanded ? (
                          <ChevronUp className="w-5 h-5 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-muted-foreground" />
                        )
                      )}
                    </CardTitle>
                  </CardHeader>

                  {isExpanded && (
                    <CardContent className="pt-0">
                      <div className="space-y-2">
                        {category.questions.map((item, index) => {
                          const isQuestionExpanded = expandedQuestions.has(`${category.id}-${index}`);

                          return (
                            <div
                              key={index}
                              className="border rounded-lg overflow-hidden"
                            >
                              <div
                                className="p-4 flex items-center justify-between cursor-pointer hover:bg-muted/50"
                                onClick={() => toggleQuestion(category.id, index)}
                              >
                                <p className="font-medium">{item.q}</p>
                                {isQuestionExpanded ? (
                                  <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                ) : (
                                  <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                )}
                              </div>
                              {isQuestionExpanded && (
                                <div className="p-4 pt-0 border-t bg-muted/30">
                                  <p className="text-muted-foreground whitespace-pre-line">
                                    {item.a}
                                  </p>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* 联系我们 */}
      <div className="max-w-4xl mx-auto">
        <Card className="bg-gradient-to-r from-primary/10 to-primary/5">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold">还有其他问题？</h3>
                <p className="text-muted-foreground">
                  我们的客服团队随时为您服务
                </p>
              </div>
              <div className="flex gap-3">
                <Button variant="outline">
                  <Mail className="w-4 h-4 mr-2" />
                  提交工单
                </Button>
                <Button>
                  <MessageCircle className="w-4 h-4 mr-2" />
                  在线客服
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 底部链接 */}
      <div className="max-w-4xl mx-auto text-center">
        <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground">
          <a href="#" className="hover:text-foreground flex items-center gap-1">
            用户协议 <ExternalLink className="w-3 h-3" />
          </a>
          <a href="#" className="hover:text-foreground flex items-center gap-1">
            隐私政策 <ExternalLink className="w-3 h-3" />
          </a>
          <a href="#" className="hover:text-foreground flex items-center gap-1">
            风险声明 <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  );
}
