import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, TrendingUp, Shield, Zap, Check, BarChart3, Lock, Cpu, Globe, Star, ChevronRight } from 'lucide-react';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'QuantFi - 智能量化交易平台',
  description: '一键部署专业量化策略，7×24 小时自动交易，无需编程，无需盯盘，AI 为你创造收益',
  openGraph: {
    title: 'QuantFi - 智能量化交易平台',
    description: '一键部署专业量化策略，7×24 小时自动交易，无需编程，无需盯盘，AI 为你创造收益',
    type: 'website',
  },
};

export default function LandingPage() {
  return (
    <>
      {/* 全局网格背景 - 固定定位，铺满整个视口 */}
      <div className="bg-grid-full" />

      <div className="min-h-screen bg-bg-primary text-white overflow-hidden relative">

      {/* Hero 区块 - 增强版 */}
      <section className="relative pt-20 pb-32 px-4 overflow-hidden">
        {/* 背景装饰层 - 移除局部网格，使用全局 */}
        <div className="absolute inset-0 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-b from-brand-primary/10 via-transparent to-transparent pointer-events-none" />

        {/* 主光晕效果 - 最底层 */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-brand-primary/20 rounded-full blur-[120px] opacity-30 pointer-events-none z-0" />
        {/* P2优化：移除无限循环动画，改为静态背景 */}
        <div className="absolute top-20 right-1/4 w-[400px] h-[400px] bg-success/10 rounded-full blur-[100px] opacity-20 pointer-events-none z-0" />
        <div className="absolute top-40 left-1/4 w-[300px] h-[300px] bg-brand-primary/15 rounded-full blur-[80px] opacity-20 pointer-events-none z-0" />

        {/* 电路纹理背景图层 - 科技感纹理 */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.18] z-[1]">
          <Image
            src="/images/hero-texture.png"
            alt=""
            fill
            className="object-cover object-center mix-blend-screen"
            style={{ filter: 'brightness(0.8) contrast(1.2)' }}
            priority
          />
        </div>

        <div className="max-w-6xl mx-auto text-center relative z-10">
          {/* 顶部标签 */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-success/10 border border-success/30 rounded-full mb-8 animate-fade-in">
            <span className="status-dot status-dot-running" />
            <span className="text-sm text-success font-medium">实时运行中 · 5,000+ 用户信赖</span>
          </div>

          {/* 主标语 - 渐变文字 */}
          <h1 className="text-5xl md:text-7xl font-bold mb-6 animate-slide-up tracking-tight">
            <span className="text-gradient-primary">量化交易</span>
            <br />
            <span className="text-white">从此自动赚钱</span>
          </h1>

          {/* 副标语 */}
          <p className="text-xl md:text-2xl text-text-secondary mb-12 max-w-3xl mx-auto animate-slide-up delay-100 leading-relaxed">
            无需编程 · 无需盯盘 · 7×24 小时自动交易
            <br />
            <span className="text-text-primary font-medium">AI 策略引擎，让专业量化触手可及</span>
          </p>

          {/* 核心数据展示 - 玻璃效果卡片 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12 max-w-4xl mx-auto">
            <div className="glass-card rounded-2xl p-6 glow-border glow-border-primary animate-slide-up delay-200 group">
              <div className="flex items-center justify-center gap-3 mb-3">
                <div className="w-10 h-10 bg-brand-primary/20 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                  <BarChart3 className="w-5 h-5 text-brand-primary" />
                </div>
              </div>
              <div className="text-4xl font-bold text-brand-primary mb-2 font-numeric animate-count">$12M+</div>
              <div className="text-text-secondary">累计管理资产</div>
            </div>

            <div className="glass-card rounded-2xl p-6 glow-border glow-border-success animate-slide-up delay-300 group">
              <div className="flex items-center justify-center gap-3 mb-3">
                <div className="w-10 h-10 bg-success/20 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                  <TrendingUp className="w-5 h-5 text-success" />
                </div>
              </div>
              <div className="text-4xl font-bold text-success mb-2 font-numeric animate-count">$2.5M+</div>
              <div className="text-text-secondary">累计用户收益</div>
            </div>

            <div className="glass-card rounded-2xl p-6 glow-border glow-border-primary animate-slide-up delay-400 group">
              <div className="flex items-center justify-center gap-3 mb-3">
                <div className="w-10 h-10 bg-brand-primary/20 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Globe className="w-5 h-5 text-brand-primary" />
                </div>
              </div>
              <div className="text-4xl font-bold text-brand-primary mb-2 font-numeric animate-count">5,000+</div>
              <div className="text-text-secondary">活跃交易用户</div>
            </div>
          </div>

          {/* 主按钮 - 增强版 */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center animate-slide-up delay-500">
            <Link
              href="/register"
              className="group px-10 py-4 bg-gradient-button rounded-xl font-bold text-lg transition-all flex items-center gap-2 shadow-lg hover:shadow-[0_0_30px_rgba(55,114,255,0.4)] hover:-translate-y-1"
            >
              免费注册，开始赚钱
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              href="#features"
              className="px-8 py-4 glass-card rounded-xl font-medium text-lg text-text-secondary transition-all hover:bg-bg-tertiary hover:text-text-primary flex items-center gap-2"
            >
              了解平台优势
              <ChevronRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Features 区块 - 卡片悬浮效果 */}
      <section id="features" className="py-20 px-4 relative">
        {/* 背景装饰 */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-bg-secondary/30 to-transparent pointer-events-none" />

        <div className="max-w-6xl mx-auto relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">
              为什么选择 <span className="text-gradient-primary">QuantFi</span>
            </h2>
            <p className="text-xl text-text-secondary">
              隐藏复杂，展示收益 —— 三大核心优势
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* 卖点 1 */}
            <div className="group glass-card rounded-2xl p-8 card-hover glow-border glow-border-primary">
              <div className="w-16 h-16 bg-gradient-to-br from-brand-primary/30 to-brand-primary/10 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                <Zap className="w-8 h-8 text-brand-primary" />
              </div>
              <h3 className="text-2xl font-bold mb-4 group-hover:text-brand-primary transition-colors">AI 驱动策略</h3>
              <p className="text-text-secondary leading-relaxed">
                人工智能实时分析市场，自动捕捉交易机会。支持自然语言生成策略，无需编程基础。
              </p>
              <div className="mt-6 pt-4 border-t border-border-secondary">
                <ul className="space-y-2 text-sm text-text-secondary">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-success" />
                    <span>自然语言生成策略</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-success" />
                    <span>实时市场分析</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-success" />
                    <span>智能风控系统</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* 卖点 2 */}
            <div className="group glass-card rounded-2xl p-8 card-hover glow-border glow-border-success">
              <div className="w-16 h-16 bg-gradient-to-br from-success/30 to-success/10 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                <Shield className="w-8 h-8 text-success" />
              </div>
              <h3 className="text-2xl font-bold mb-4 group-hover:text-success transition-colors">安全可靠</h3>
              <p className="text-text-secondary leading-relaxed">
                API Key 军事级加密存储，资金始终在您的交易所账户。多重安全验证，保障资产安全。
              </p>
              <div className="mt-6 pt-4 border-t border-border-secondary">
                <ul className="space-y-2 text-sm text-text-secondary">
                  <li className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-success" />
                    <span>AES-256 加密存储</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-success" />
                    <span>资金不离开交易所</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-success" />
                    <span>双重身份验证</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* 卖点 3 */}
            <div className="group glass-card rounded-2xl p-8 card-hover glow-border glow-border-primary">
              <div className="w-16 h-16 bg-gradient-to-br from-brand-primary/30 to-brand-primary/10 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                <TrendingUp className="w-8 h-8 text-brand-primary" />
              </div>
              <h3 className="text-2xl font-bold mb-4 group-hover:text-brand-primary transition-colors">稳定收益</h3>
              <p className="text-text-secondary leading-relaxed">
                经过严格回测验证，历史年化收益 15-50%。智能风控，控制最大回撤，保护本金安全。
              </p>
              <div className="mt-6 pt-4 border-t border-border-secondary">
                <ul className="space-y-2 text-sm text-text-secondary">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-success" />
                    <span>历史年化 15-50%</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-success" />
                    <span>智能止损保护</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-success" />
                    <span>回撤控制 &lt;15%</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it Works 区块 */}
      <section className="py-20 px-4 relative">
        {/* 移除局部网格，使用全局 */}

        <div className="max-w-6xl mx-auto relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">
              三步开启 <span className="text-gradient-primary">量化之旅</span>
            </h2>
            <p className="text-xl text-text-secondary">
              5 分钟完成配置，开启自动化收益
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {/* Step 1 */}
            <div className="relative text-center group">
              <div className="relative inline-block">
                <div className="w-20 h-20 bg-gradient-to-br from-brand-primary to-brand-secondary rounded-2xl flex items-center justify-center mx-auto mb-6 text-3xl font-bold shadow-lg shadow-brand-primary/30 group-hover:shadow-brand-primary/50 transition-shadow group-hover:scale-105 transition-transform">
                  1
                </div>
                {/* 连接线 */}
                <div className="hidden md:block absolute top-10 left-full w-full h-0.5 bg-gradient-to-r from-brand-primary/50 to-transparent" />
              </div>
              <h3 className="text-2xl font-bold mb-4">绑定交易所</h3>
              <p className="text-text-secondary leading-relaxed">
                连接币安、OKX 等主流交易所，资金始终在您的账户，安全可控。
              </p>
            </div>

            {/* Step 2 */}
            <div className="relative text-center group">
              <div className="relative inline-block">
                <div className="w-20 h-20 bg-gradient-to-br from-success to-success/80 rounded-2xl flex items-center justify-center mx-auto mb-6 text-3xl font-bold shadow-lg shadow-success/30 group-hover:shadow-success/50 transition-shadow group-hover:scale-105 transition-transform">
                  2
                </div>
                <div className="hidden md:block absolute top-10 left-full w-full h-0.5 bg-gradient-to-r from-success/50 to-transparent" />
              </div>
              <h3 className="text-2xl font-bold mb-4">选择策略</h3>
              <p className="text-text-secondary leading-relaxed">
                从 20+ 经过验证的策略中选择，或用 AI 生成专属策略。
              </p>
            </div>

            {/* Step 3 */}
            <div className="relative text-center group">
              <div className="w-20 h-20 bg-gradient-to-br from-brand-primary to-brand-secondary rounded-2xl flex items-center justify-center mx-auto mb-6 text-3xl font-bold shadow-lg shadow-brand-primary/30 group-hover:shadow-brand-primary/50 transition-shadow group-hover:scale-105 transition-transform">
                3
              </div>
              <h3 className="text-2xl font-bold mb-4">一键启动</h3>
              <p className="text-text-secondary leading-relaxed">
                机器人 7×24 自动运行，实时查看收益，随时掌控。
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats 区块 - 数字高亮 */}
      <section className="py-20 px-4 relative">
        <div className="absolute inset-0 bg-bg-secondary/50 pointer-events-none" />

        <div className="max-w-6xl mx-auto relative z-10">
          <h2 className="text-4xl md:text-5xl font-bold text-center mb-16 tracking-tight">
            平台 <span className="text-gradient-primary">实力数据</span>
          </h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="glass-card text-center p-6 rounded-xl glow-border glow-border-primary group">
              <div className="text-4xl font-bold text-brand-primary mb-2 font-numeric group-hover:scale-110 transition-transform">20+</div>
              <div className="text-sm text-text-secondary">官方验证策略</div>
            </div>
            <div className="glass-card text-center p-6 rounded-xl glow-border glow-border-success group">
              <div className="text-4xl font-bold text-success mb-2 font-numeric group-hover:scale-110 transition-transform">15-50%</div>
              <div className="text-sm text-text-secondary">历史年化收益</div>
            </div>
            <div className="glass-card text-center p-6 rounded-xl glow-border glow-border-primary group">
              <div className="text-4xl font-bold text-brand-primary mb-2 font-numeric group-hover:scale-110 transition-transform">&lt;15%</div>
              <div className="text-sm text-text-secondary">最大回撤控制</div>
            </div>
            <div className="glass-card text-center p-6 rounded-xl glow-border glow-border-success group">
              <div className="text-4xl font-bold text-success mb-2 font-numeric group-hover:scale-110 transition-transform">99.9%</div>
              <div className="text-sm text-text-secondary">系统稳定运行</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA 区块 - 最终转化 */}
      <section className="py-32 px-4 relative overflow-hidden">
        {/* 背景光效 */}
        <div className="absolute inset-0 bg-gradient-to-t from-brand-primary/10 to-transparent pointer-events-none" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-brand-primary/15 rounded-full blur-[120px] opacity-30 pointer-events-none" />
        {/* 使用全局网格，无需局部 */}

        {/* 电路纹理背景 - 与 Hero 呼应 */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.12] z-[1]">
          <Image
            src="/images/hero-texture.png"
            alt=""
            fill
            className="object-cover object-center mix-blend-screen"
            style={{ filter: 'brightness(0.8) contrast(1.2)' }}
          />
        </div>

        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-success/10 border border-success/30 rounded-full mb-8">
            <Star className="w-4 h-4 text-success" />
            <span className="text-sm text-success font-medium">限时福利：新用户注册即送 1000 体验金</span>
          </div>

          <h2 className="text-4xl md:text-6xl font-bold mb-6 tracking-tight">
            开启自动赚钱模式
          </h2>
          <p className="text-xl text-text-secondary mb-12">
            5,000+ 用户已在使用，现在加入，立即开始
          </p>

          <div className="glass-card rounded-2xl p-8 mb-12">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left mb-8">
              <div className="flex items-start gap-4 p-4 rounded-xl bg-bg-tertiary/30 hover:bg-bg-tertiary/50 transition-colors">
                <div className="w-10 h-10 bg-success/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Check className="w-5 h-5 text-success" />
                </div>
                <div>
                  <div className="font-semibold mb-1">免费试用</div>
                  <div className="text-sm text-text-secondary">注册即赠送体验金</div>
                </div>
              </div>
              <div className="flex items-start gap-4 p-4 rounded-xl bg-bg-tertiary/30 hover:bg-bg-tertiary/50 transition-colors">
                <div className="w-10 h-10 bg-success/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Check className="w-5 h-5 text-success" />
                </div>
                <div>
                  <div className="font-semibold mb-1">无需押金</div>
                  <div className="text-sm text-text-secondary">资金留在您的账户</div>
                </div>
              </div>
              <div className="flex items-start gap-4 p-4 rounded-xl bg-bg-tertiary/30 hover:bg-bg-tertiary/50 transition-colors">
                <div className="w-10 h-10 bg-success/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Check className="w-5 h-5 text-success" />
                </div>
                <div>
                  <div className="font-semibold mb-1">随时退出</div>
                  <div className="text-sm text-text-secondary">无合约锁定，随时停止</div>
                </div>
              </div>
              <div className="flex items-start gap-4 p-4 rounded-xl bg-bg-tertiary/30 hover:bg-bg-tertiary/50 transition-colors">
                <div className="w-10 h-10 bg-success/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Cpu className="w-5 h-5 text-success" />
                </div>
                <div>
                  <div className="font-semibold mb-1">7×24 支持</div>
                  <div className="text-sm text-text-secondary">专业团队在线答疑</div>
                </div>
              </div>
            </div>

            {/* P2优化：移除 animate-breathe 无限循环动画 */}
            <Link
              href="/register"
              className="inline-flex items-center gap-3 px-12 py-5 bg-gradient-button rounded-xl font-bold text-xl transition-all shadow-lg hover:shadow-[0_0_40px_rgba(55,114,255,0.5)] hover:-translate-y-1"
            >
              立即免费注册
              <ArrowRight className="w-6 h-6" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer 区块 */}
      <footer className="border-t border-border-primary py-12 px-4 bg-bg-secondary/30">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            {/* Logo 和介绍 */}
            <div className="md:col-span-2">
              <div className="text-2xl font-bold mb-4 text-gradient-primary inline-block">
                QuantFi
              </div>
              <p className="text-text-secondary mb-4 leading-relaxed">
                智能量化交易平台，让专业量化策略触手可及。<br />
                隐藏复杂，展示收益。
              </p>
              <div className="text-sm text-text-tertiary">
                © 2025 QuantFi. All rights reserved.
              </div>
            </div>

            {/* 产品链接 */}
            <div>
              <h4 className="font-semibold mb-4">产品</h4>
              <ul className="space-y-3 text-text-secondary">
                <li>
                  <Link href="/strategies" className="hover:text-brand-primary transition-colors flex items-center gap-1 group">
                    <span>策略市场</span>
                    <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Link>
                </li>
                <li>
                  <Link href="/register" className="hover:text-brand-primary transition-colors flex items-center gap-1 group">
                    <span>免费注册</span>
                    <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Link>
                </li>
                <li>
                  <Link href="/login" className="hover:text-brand-primary transition-colors flex items-center gap-1 group">
                    <span>登录</span>
                    <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Link>
                </li>
              </ul>
            </div>

            {/* 法律链接 */}
            <div>
              <h4 className="font-semibold mb-4">法律</h4>
              <ul className="space-y-3 text-text-secondary">
                <li>
                  <Link href="/terms" className="hover:text-brand-primary transition-colors flex items-center gap-1 group">
                    <span>用户协议</span>
                    <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Link>
                </li>
                <li>
                  <Link href="/privacy" className="hover:text-brand-primary transition-colors flex items-center gap-1 group">
                    <span>隐私政策</span>
                    <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Link>
                </li>
                <li>
                  <Link href="/risk" className="hover:text-brand-primary transition-colors flex items-center gap-1 group">
                    <span>风险披露</span>
                    <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          {/* 底部说明 */}
          <div className="pt-8 border-t border-border-secondary text-center text-sm text-text-tertiary leading-relaxed">
            <p className="mb-2">
              ⚠️ 风险提示：数字资产交易存在亏损风险，请理性投资，不要投入超过承受能力的资金。
            </p>
            <p>
              QuantFi 提供技术工具服务，历史收益不代表未来表现，不承诺任何收益保障。
            </p>
          </div>
        </div>
      </footer>
      </div>
    </>
  );
}
