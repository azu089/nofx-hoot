# Hoot UI v3.0 组件库

> 设计理念：**Web3 原生 · 有活力 · 代币驱动 · 久看不累**
> 配色原则：**统一青色调 · 不五颜六色 · 克制使用**

## 色彩系统

```
基础色
├── 背景深    #0A0A0F     近乎纯黑，带蓝调
├── 背景浅    #12121A     卡片背景
├── 边框      #1E1E2E     微妙可见
└── 分割线    #2A2A3A     更柔和

文字色
├── 主文字    #F8F8FC     不是纯白
├── 次文字    #9090A0     柔和灰
└── 弱文字    #606070     辅助说明

品牌色（统一青色调）
├── 主色      #06B6D4     cyan-500（按钮、强调）
├── 浅色      #22D3EE     cyan-400（文字、小元素）
├── 深色      #0891B2     cyan-600（hover、次要）
└── 渐变      #06B6D4 → #22D3EE   cyan-500 → cyan-400

语义色
├── 盈利      #10B981     翡翠绿（正收益）
├── 亏损      #F43F5E     玫瑰红（负收益）
├── 警告      #F59E0B     琥珀橙（提示）
└── VIP       #F59E0B     金色（VIP标识）

⚠️ 禁止使用
├── 紫色      #8B5CF6     已废弃
├── 橙红渐变  from-orange to-red  已废弃
└── 蓝紫渐变  from-blue to-purple 已废弃
```

## 组件清单

### 公共页面

| 组件 | 文件 | 说明 |
|------|------|------|
| LandingPage | `landing/landing-page.tsx` | 首页/产品介绍 |
| LoginPage | `auth/login-page.tsx` | 登录页 |
| RegisterPage | `auth/register-page.tsx` | 注册页 |

### 桌面端页面

| 组件 | 文件 | 说明 |
|------|------|------|
| Sidebar | `dashboard/sidebar.tsx` | 侧边导航栏 |
| DashboardPage | `dashboard/dashboard-page.tsx` | 仪表盘主页 |
| StrategyMarketplace | `strategies/strategy-marketplace.tsx` | 策略市场 |
| StrategyConfigModal | `strategies/strategy-config-modal.tsx` | 策略配置弹窗 |
| PositionsPage | `positions/positions-page.tsx` | 持仓管理 |
| EcosystemPage | `ecosystem/ecosystem-page.tsx` | HOOT 生态 |
| AssetsPage | `assets/assets-page.tsx` | 资产管理 |
| MePage | `me/me-page.tsx` | 个人中心 |

### 用户自定义策略组件

| 组件 | 文件 | 说明 |
|------|------|------|
| CreateStrategyModal | `strategies/create-strategy-modal.tsx` | 创建策略类型选择弹窗 |
| VisualStrategyBuilder | `strategies/visual-strategy-builder.tsx` | 可视化策略配置器（拖拽式） |
| TradingViewWebhookConfig | `strategies/tradingview-webhook-config.tsx` | TradingView Webhook 配置 |
| CodeEditor | `strategies/code-editor.tsx` | 代码编辑器（高级用户） |

### 移动端页面

| 组件 | 文件 | 说明 |
|------|------|------|
| MobileNav | `mobile/mobile-nav.tsx` | 移动端底部导航 |
| MobileDashboard | `mobile/mobile-dashboard.tsx` | 移动端仪表盘 |
| MobileStrategies | `mobile/mobile-strategies.tsx` | 移动端策略市场 |
| MobileEcosystem | `mobile/mobile-ecosystem.tsx` | 移动端生态 |
| MobileMe | `mobile/mobile-me.tsx` | 移动端个人中心 |
| MobilePositions | `mobile/mobile-positions.tsx` | 移动端持仓 |
| MobileAssets | `mobile/mobile-assets.tsx` | 移动端资产 |

## 使用方式

```tsx
import {
  // 公共页面
  LandingPage,
  LoginPage,
  RegisterPage,
  // 桌面端
  DashboardPage,
  StrategyMarketplace,
  StrategyConfigModal,
  PositionsPage,
  EcosystemPage,
  AssetsPage,
  MePage,
  // 用户自定义策略
  VisualStrategyBuilder,
  TradingViewWebhookConfig,
  CodeEditor,
  // 移动端
  MobileDashboard,
  MobileStrategies,
  MobileEcosystem,
  MobileMe,
  MobilePositions,
  MobileAssets,
} from '@/components/ui-v3'
```

## 依赖

- shadcn/ui
- Tailwind CSS
- Lucide React Icons
- clsx + tailwind-merge (for cn utility)

## 设计规范

### 字体
- 英文数字：Inter
- 中文：思源黑体 / PingFang SC
- 等宽数字：JetBrains Mono / font-mono

### 字号
- 超大数字：56px / 40px（资产总额）
- 大数字：32px / 24px（卡片主数据）
- 标题：20px / 18px
- 正文：15px / 14px
- 辅助：13px / 12px

### 间距（8px 基准）
- xs: 4px
- sm: 8px
- md: 16px
- lg: 24px
- xl: 32px

### 圆角
- 小：8px（按钮、输入框）
- 中：12px（卡片）
- 大：16px（弹窗）
- 全圆：9999px（标签、头像）

## 文件结构

```
ui-v3/
├── index.ts                      # 导出入口
├── README.md                     # 本文档
├── landing/
│   └── landing-page.tsx         # 首页
├── auth/
│   ├── login-page.tsx           # 登录页
│   └── register-page.tsx        # 注册页
├── dashboard/
│   ├── sidebar.tsx              # 侧边栏
│   └── dashboard-page.tsx       # 仪表盘
├── strategies/
│   ├── strategy-marketplace.tsx # 策略市场
│   ├── strategy-config-modal.tsx # 配置弹窗
│   ├── visual-strategy-builder.tsx # 可视化策略配置器
│   ├── tradingview-webhook-config.tsx # TradingView Webhook
│   └── code-editor.tsx          # 代码编辑器
├── positions/
│   └── positions-page.tsx       # 持仓管理
├── ecosystem/
│   └── ecosystem-page.tsx       # HOOT 生态
├── assets/
│   └── assets-page.tsx          # 资产管理
├── me/
│   └── me-page.tsx              # 个人中心
└── mobile/
    ├── mobile-nav.tsx           # 底部导航
    ├── mobile-dashboard.tsx     # 移动端首页
    ├── mobile-strategies.tsx    # 移动端策略
    ├── mobile-ecosystem.tsx     # 移动端生态
    ├── mobile-me.tsx            # 移动端个人中心
    ├── mobile-positions.tsx     # 移动端持仓
    └── mobile-assets.tsx        # 移动端资产
```

## 版本记录

| 版本 | 日期 | 变更 |
|------|------|------|
| v3.3.0 | 2026-01-29 | 全局风格统一：去除紫色，统一为青色调；更新交易所真实logo；更新项目logo |
| v3.2.0 | 2026-01-29 | 优化用户体验：策略市场添加「我的策略」Tab和「创建策略」按钮；移动端「我的」页面添加资产快捷入口 |
| v3.1.0 | 2026-01-29 | 新增用户自定义策略组件：VisualStrategyBuilder、TradingViewWebhookConfig、CodeEditor |
| v3.0.1 | 2026-01-29 | 补全遗漏页面：Landing、Login、Register、Me、Mobile Positions/Assets；修复术语"跟随"→"订阅" |
| v3.0 | 2026-01-28 | 初版：Web3风格、代币驱动、精简信息 |
