# QuantFi UI 高保真全局设计方案

> 版本: v2.0
> 更新日期: 2026-01-11
> 状态: 规划中
> 设计风格: 华尔街暗黑 + 玻璃拟态 + 科技感

---

## 一、设计系统 (Design System)

### 1.1 核心设计原则

| 原则 | 说明 | 实现方式 |
|------|------|---------|
| **极简专业** | 隐藏复杂性，只展示用户关心的数据 | 精简信息层级，突出核心指标 |
| **信任感** | 华尔街风格，专业金融产品质感 | 深色背景、精确数字、稳重配色 |
| **数据可视化** | 让数字说话，直观展示收益变化 | 迷你图表、进度条、颜色编码 |
| **一键操作** | 核心功能一步到位 | 大按钮、清晰 CTA、减少点击 |
| **响应式** | 桌面端和移动端体验一致 | 自适应布局、触摸友好 |

### 1.2 配色方案

```css
:root {
  /* ===== 背景层次 ===== */
  --bg-primary: #0B0E11;        /* 主背景 - 深黑蓝 */
  --bg-secondary: #131722;       /* 卡片背景 */
  --bg-tertiary: #1E222D;        /* 输入框/悬浮态 */
  --bg-elevated: rgba(255, 255, 255, 0.05); /* 浮层 */
  --bg-glass: rgba(19, 23, 34, 0.8);        /* 玻璃效果 */

  /* ===== 品牌色 ===== */
  --brand-primary: #3772FF;      /* 科技蓝 - 主按钮/链接 */
  --brand-secondary: #2962FF;    /* 深蓝 - 悬浮态 */
  --brand-gradient: linear-gradient(135deg, #3772FF 0%, #00D9E8 100%);
  --brand-glow: 0 0 20px rgba(55, 114, 255, 0.4);

  /* ===== 语义色 ===== */
  --success: #00C087;            /* 翡翠绿 - 盈利/涨/成功 */
  --success-bg: rgba(0, 192, 135, 0.1);
  --success-glow: 0 0 12px rgba(0, 192, 135, 0.3);

  --danger: #F23645;             /* 玫瑰红 - 亏损/跌/错误 */
  --danger-bg: rgba(242, 54, 69, 0.1);
  --danger-glow: 0 0 12px rgba(242, 54, 69, 0.3);

  --warning: #F7931A;            /* 橙色 - 警告/积分 */
  --warning-bg: rgba(247, 147, 26, 0.1);

  --purple: #A855F7;             /* 紫色 - 代币/高级 */
  --purple-bg: rgba(168, 85, 247, 0.1);

  --cyan: #00D9E8;               /* 青色 - 信息/链接 */

  /* ===== 文字 ===== */
  --text-primary: #FFFFFF;       /* 主文字 */
  --text-secondary: #848E9C;     /* 次要文字 */
  --text-tertiary: #5E6673;      /* 辅助文字 */
  --text-disabled: #3C4251;      /* 禁用文字 */

  /* ===== 边框 ===== */
  --border-primary: #2B3139;     /* 主边框 */
  --border-secondary: #1F2937;   /* 次级边框 */
  --border-focus: #3772FF;       /* 聚焦边框 */
  --border-glass: rgba(255, 255, 255, 0.08); /* 玻璃边框 */
}
```

### 1.3 字体规范

```css
/* 主字体 */
font-family: 'Inter', 'SF Pro Display', -apple-system, sans-serif;

/* 数字专用（等宽） */
font-family: 'JetBrains Mono', 'Roboto Mono', monospace;
font-variant-numeric: tabular-nums;

/* 字号层级 */
--text-xs: 10px;    /* 标签/辅助 */
--text-sm: 12px;    /* 次要信息 */
--text-base: 14px;  /* 正文 */
--text-lg: 16px;    /* 小标题 */
--text-xl: 18px;    /* 标题 */
--text-2xl: 24px;   /* 页面标题 */
--text-3xl: 32px;   /* 重要数据 */
--text-4xl: 40px;   /* 核心数字 */
--text-5xl: 48px;   /* 英雄数字 */
```

### 1.4 间距与圆角

```css
/* 间距系统 (4px 基数) */
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 20px;
--space-6: 24px;
--space-8: 32px;
--space-10: 40px;

/* 圆角系统 */
--radius-sm: 6px;    /* 按钮/输入框/标签 */
--radius-md: 8px;    /* 小卡片 */
--radius-lg: 12px;   /* 大卡片 */
--radius-xl: 16px;   /* 弹窗/Sheet */
--radius-full: 9999px; /* 圆形/胶囊 */
```

### 1.5 动效规范

```css
/* 过渡时长 */
--duration-fast: 150ms;
--duration-normal: 200ms;
--duration-slow: 300ms;
--duration-slower: 500ms;

/* 缓动函数 */
--ease-out: cubic-bezier(0.4, 0, 0.2, 1);
--ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);

/* 动画效果 */
@keyframes pulse-glow {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 0.6; }
}

@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}
```

### 1.6 玻璃效果 (Glassmorphism)

```css
/* 标准玻璃卡片 */
.glass-card {
  background: var(--bg-glass);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid var(--border-glass);
  border-radius: var(--radius-lg);
}

/* 光晕背景效果 */
.glow-bg {
  position: relative;
}
.glow-bg::before {
  content: '';
  position: absolute;
  top: -20%;
  right: -10%;
  width: 40%;
  height: 40%;
  background: var(--brand-primary);
  opacity: 0.2;
  filter: blur(60px);
  border-radius: 50%;
  animation: pulse-glow 4s ease-in-out infinite;
}

/* Hover 发光边框 */
.glow-border:hover {
  box-shadow: var(--brand-glow);
  border-color: rgba(55, 114, 255, 0.5);
}
```

---

## 二、全局布局系统

### 2.1 桌面端布局 (>1024px)

```
┌─────────────────────────────────────────────────────────────────┐
│ Header (64px)                                                    │
│ [Logo] [导航菜单]                     [会员等级] [用户头像 ▼]     │
├──────────────┬──────────────────────────────────────────────────┤
│              │                                                   │
│   Sidebar    │              Main Content                        │
│   (240px)    │              (flex-1)                            │
│              │                                                   │
│   [导航项]    │   ┌─────────────────────────────────────────┐   │
│   [导航项]    │   │         Page Content                    │   │
│   [导航项]    │   │         (max-width: 1400px)             │   │
│   ...        │   │         (padding: 24px)                  │   │
│              │   └─────────────────────────────────────────┘   │
│              │                                                   │
│   [版本号]    │                                                   │
├──────────────┴──────────────────────────────────────────────────┤
│ (无 Footer)                                                      │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 移动端布局 (<768px)

```
┌─────────────────────────┐
│ Mobile Header (56px)    │
│ [返回] [标题] [操作]     │
├─────────────────────────┤
│                         │
│    Main Content         │
│    (padding: 16px)      │
│    (pb: 80px)           │
│                         │
│                         │
├─────────────────────────┤
│ Bottom TabBar (64px)    │
│ [首页][交易][策略][资产][我的]│
└─────────────────────────┘
```

### 2.3 响应式断点

| 断点 | 宽度 | 布局变化 |
|------|------|---------|
| Mobile | < 768px | 底部导航、单列布局 |
| Tablet | 768-1024px | 底部导航、双列网格 |
| Desktop | > 1024px | 侧边栏、多列网格 |
| Wide | > 1400px | 内容区最大宽度限制 |

---

## 三、页面清单与升级计划

### 3.1 公开页面 (Public)

| 页面 | 路由 | 当前状态 | 升级优先级 | 升级内容 |
|------|------|---------|-----------|---------|
| Landing | / | ✅ 已完成 | - | 保持现状 |
| 登录 | /login | ✅ 基础完成 | P2 | 添加品牌动画 |
| 注册 | /register | ✅ 基础完成 | P2 | 表单优化 |
| 忘记密码 | /forgot-password | ✅ 基础完成 | P3 | - |
| 条款 | /terms | ✅ 基础完成 | - | - |
| 隐私 | /privacy | ✅ 基础完成 | - | - |

### 3.2 仪表盘模块 (Dashboard)

| 页面 | 路由 | 当前状态 | 升级优先级 | 升级内容 |
|------|------|---------|-----------|---------|
| **仪表盘** | /dashboard | 🔄 需升级 | **P0** | AssetHeroCard、快捷入口网格、任务卡片 |

**Dashboard 页面升级详情**:
```
当前布局:
┌──────────────────────────────────────────┐
│ 总资产卡片 (内联)                         │
├──────────────────────────────────────────┤
│ 公告滚动条                                │
├──────────────────────────────────────────┤
│ 快捷入口 (6个图标按钮)                    │
├──────────────────────────────────────────┤
│ Fear & Greed Index                       │
├──────────────────────────────────────────┤
│ 新手任务列表                              │
├──────────────────────────────────────────┤
│ 热门资讯 (折叠)                           │
└──────────────────────────────────────────┘

升级后布局:
┌──────────────────────────────────────────┐
│ AssetHeroCard (光晕+玻璃效果)             │
│ ├─ 总资产 (大字体等宽)                    │
│ ├─ 今日盈亏 (趋势箭头)                    │
│ └─ 点卡/代币余额网格                      │
├──────────────────────────────────────────┤
│ QuickActionGrid (图标+文字+描述)          │
│ ├─ VPS实例  ├─ 推荐交易所  ├─ 安装APP    │
│ ├─ API绑定  ├─ 生态中心    └─ 邀请好友   │
├──────────────────────────────────────────┤
│ MarketSentimentCard (恐惧贪婪仪表盘)      │
├──────────────────────────────────────────┤
│ OnboardingTaskCard (进度环+任务列表)      │
├──────────────────────────────────────────┤
│ NewsCard (卡片式资讯列表)                 │
└──────────────────────────────────────────┘
```

### 3.3 交易模块 (Trading)

| 页面 | 路由 | 当前状态 | 升级优先级 | 升级内容 |
|------|------|---------|-----------|---------|
| **交易控制台** | /trading | 🔄 需升级 | **P0** | 盈亏概览卡、持仓卡片V2 |
| 历史记录 | /trading/history | ✅ 基础完成 | P2 | 筛选优化、图表 |
| 回测系统 | /trading/backtest | ✅ 基础完成 | P2 | 结果可视化 |
| AI 策略 | /trading/ai | ✅ 基础完成 | P2 | AI 对话界面 |
| 交易信号 | /trading/signals | ✅ 基础完成 | P3 | 信号卡片样式 |

**Trading 页面升级详情**:
```
当前布局:
┌──────────────────────────────────────────┐
│ [现货/合约] [时间范围▼]                   │
├──────────────────────────────────────────┤
│ 盈亏概览 (累计/今日/当月)                 │
│ 收益曲线图                                │
│ 交易统计文字                              │
├──────────────────────────────────────────┤
│ [持仓] [历史] [日志] Tab                  │
├──────────────────────────────────────────┤
│ 持仓列表 (基础卡片)                       │
│ ├─ BTC/USDT 做多 3x +125.80             │
│ └─ ETH/USDT 做多    -42.50              │
└──────────────────────────────────────────┘

升级后布局:
┌──────────────────────────────────────────┐
│ TradingHeader                            │
│ [现货/合约 切换] [周期选择] [刷新]         │
├──────────────────────────────────────────┤
│ AccountOverviewCard (玻璃效果)           │
│ ├─ 权益总额 (大字体)                      │
│ ├─ 未实现盈亏 | 已实现盈亏 | 保证金       │
│ └─ 迷你权益曲线                          │
├──────────────────────────────────────────┤
│ BotStatusCard (运行状态+策略列表)         │
├──────────────────────────────────────────┤
│ [持仓 Badge] [历史] [日志] Tab            │
├──────────────────────────────────────────┤
│ PositionCardV2 列表                      │
│ ├─ 交易对 | 方向 | 杠杆                   │
│ ├─ 盈亏金额/百分比 (颜色编码)             │
│ ├─ 止盈止损进度条                        │
│ └─ [AI解读] [详情] 按钮                  │
└──────────────────────────────────────────┘
```

### 3.4 策略模块 (Strategies)

| 页面 | 路由 | 当前状态 | 升级优先级 | 升级内容 |
|------|------|---------|-----------|---------|
| **策略市场** | /strategies | 🔄 需升级 | **P0** | StrategyCardV2 |
| 策略详情 | /strategies/[id] | ✅ 基础完成 | P1 | 详情页重构 |
| 我的策略 | /strategies/my | ✅ 基础完成 | P2 | 卡片样式统一 |
| 策略管理 | /strategies/manage | ✅ 基础完成 | P2 | - |
| 策略创建 | /strategies/create | ✅ 基础完成 | P2 | 表单优化 |

**Strategies 页面升级详情**:
```
当前布局:
┌──────────────────────────────────────────┐
│ 策略市场              [我的策略][策略管理] │
├──────────────────────────────────────────┤
│ [搜索] [类型▼] [来源▼] [交易类型▼] [排序▼]│
│ 共找到 17 个策略                          │
├──────────────────────────────────────────┤
│ ┌─────┐ ┌─────┐ ┌─────┐                 │
│ │策略1│ │策略2│ │策略3│  (3列网格)       │
│ │57%  │ │55%  │ │68%  │                 │
│ │-48% │ │-19% │ │-10% │                 │
│ └─────┘ └─────┘ └─────┘                 │
└──────────────────────────────────────────┘

升级后布局:
┌──────────────────────────────────────────┐
│ StrategyMarketHeader                     │
│ 策略市场              [我的策略][策略管理] │
├──────────────────────────────────────────┤
│ FilterBar (玻璃效果)                      │
│ [搜索] [类型] [来源] [风险等级] [排序]     │
│ 共找到 17 个策略              [清空筛选]  │
├──────────────────────────────────────────┤
│ StrategyCardV2 Grid (3列)                │
│ ┌──────────────────────┐                 │
│ │ [官方徽章] BTC网格交易                  │
│ │ ━━━━━━━ 迷你收益曲线 ━━━━━━━           │
│ │ 胜率 72% | 回撤 -9% | 夏普 1.2         │
│ │ [风险:低] [订阅数: 128]                 │
│ │        [详情] [回测]                   │
│ └──────────────────────┘                 │
└──────────────────────────────────────────┘
```

### 3.5 资产模块 (Wallet)

| 页面 | 路由 | 当前状态 | 升级优先级 | 升级内容 |
|------|------|---------|-----------|---------|
| **钱包概览** | /wallet | 🔄 需升级 | **P1** | 资产卡片、分布图 |
| 充值 | /wallet/deposit | ✅ 基础完成 | P2 | 二维码样式 |
| 提现 | /wallet/withdraw | ✅ 基础完成 | P2 | 表单优化 |
| API Key | /wallet/api-keys | ✅ 基础完成 | P2 | 卡片样式 |
| 账单明细 | /wallet/billing | ✅ 基础完成 | P2 | 列表优化 |
| 闪兑 | /wallet/exchange | ✅ 基础完成 | P2 | 交互优化 |

**Wallet 页面升级详情**:
```
升级后布局:
┌──────────────────────────────────────────┐
│ WalletHeader                             │
│ 资产钱包                          [刷新]  │
├──────────────────────────────────────────┤
│ AssetGrid (4列)                          │
│ ┌────────┐┌────────┐┌────────┐┌────────┐│
│ │ USDT   ││ 积分   ││ QFI    ││ 点卡   ││
│ │9127.50 ││24,520  ││1397.33 ││50.00   ││
│ │  ↗     ││  ↗     ││  ↗     ││  ↗     ││
│ └────────┘└────────┘└────────┘└────────┘│
├──────────────────────────────────────────┤
│ QuickActions                             │
│ [闪兑] [账单明细] [API Key管理]           │
├──────────────────────────────────────────┤
│ AssetDistributionChart (饼图)            │
├──────────────────────────────────────────┤
│ ActionCards                              │
│ ┌─────────────┐ ┌─────────────┐         │
│ │ 充值        │ │ 提现        │         │
│ │ TRC20/ERC20 │ │ 可提: 9127  │         │
│ └─────────────┘ └─────────────┘         │
├──────────────────────────────────────────┤
│ TransactionList (最近交易)               │
└──────────────────────────────────────────┘
```

### 3.6 生态模块 (Ecosystem)

| 页面 | 路由 | 当前状态 | 升级优先级 | 升级内容 |
|------|------|---------|-----------|---------|
| 生态概览 | /ecosystem | ✅ 基础完成 | P2 | 仪表盘卡片 |
| 积分中心 | /ecosystem/points | ✅ 基础完成 | P2 | 积分动画 |
| **质押大厅** | /ecosystem/staking | 🔄 需升级 | **P1** | 质押卡片、权重可视化 |
| 积分兑换 | /ecosystem/exchange | ✅ 基础完成 | P2 | 兑换动画 |
| 释放进度 | /ecosystem/vesting | ✅ 基础完成 | P2 | 进度可视化 |
| 排行榜 | /ecosystem/leaderboard | ✅ 基础完成 | P2 | 排名动效 |
| Token 信息 | /ecosystem/token | ✅ 基础完成 | P3 | - |

### 3.7 个人/设置模块

| 页面 | 路由 | 当前状态 | 升级优先级 | 升级内容 |
|------|------|---------|-----------|---------|
| 个人中心 | /me | ✅ 基础完成 | P2 | 统一卡片样式 |
| 推荐交易所 | /me/exchanges | ✅ 基础完成 | P3 | - |
| 设置首页 | /settings | ✅ 基础完成 | P3 | - |
| 账号设置 | /settings/account | ✅ 基础完成 | P3 | - |
| 安全设置 | /settings/security | ✅ 基础完成 | P3 | - |
| 通知设置 | /settings/notifications | ✅ 基础完成 | P3 | - |
| 外观设置 | /settings/appearance | ✅ 基础完成 | P3 | - |
| 邀请好友 | /referral | ✅ 基础完成 | P2 | 分享卡片 |

### 3.8 实例模块 (Instances)

| 页面 | 路由 | 当前状态 | 升级优先级 | 升级内容 |
|------|------|---------|-----------|---------|
| 实例列表 | /instances | ✅ 基础完成 | P2 | 状态卡片 |
| 实例详情 | /instances/[id] | ✅ 基础完成 | P2 | 监控图表 |

### 3.9 代理商模块 (Agent)

| 页面 | 路由 | 当前状态 | 升级优先级 | 升级内容 |
|------|------|---------|-----------|---------|
| 代理概览 | /agent | ✅ 基础完成 | P3 | 仪表盘 |
| 推广工具 | /agent/promotion | ✅ 基础完成 | P3 | - |
| 业绩报表 | /agent/performance | ✅ 基础完成 | P3 | - |
| 下级管理 | /agent/referrals | ✅ 基础完成 | P3 | - |
| 佣金明细 | /agent/commissions | ✅ 基础完成 | P3 | - |
| 佣金提现 | /agent/withdraw | ✅ 基础完成 | P3 | - |

### 3.10 管理后台 (Admin)

| 页面 | 路由 | 当前状态 | 升级优先级 | 升级内容 |
|------|------|---------|-----------|---------|
| 管理概览 | /admin | ✅ 基础完成 | P3 | 数据仪表盘 |
| 用户管理 | /admin/users | ✅ 基础完成 | P3 | - |
| 财务管理 | /admin/finance | ✅ 基础完成 | P3 | - |
| 策略管理 | /admin/strategies | ✅ 基础完成 | P3 | - |
| 公告管理 | /admin/announcements | ✅ 基础完成 | P3 | - |
| Kill Switch | /admin/kill-switch | ✅ 基础完成 | P3 | - |

### 3.11 Telegram Mini App

| 页面 | 路由 | 当前状态 | 升级优先级 | 升级内容 |
|------|------|---------|-----------|---------|
| TG 首页 | /tg | ✅ 基础完成 | P3 | - |
| TG 策略 | /tg/strategies | ✅ 基础完成 | P3 | - |
| TG 钱包 | /tg/wallet | ✅ 基础完成 | P3 | - |
| TG 交易 | /tg/trading | ✅ 基础完成 | P3 | - |

---

## 四、组件库清单

### 4.1 基础 UI 组件 (26个)

| 组件 | 文件 | 状态 | 升级内容 |
|------|------|------|---------|
| Button | button.tsx | ✅ | 添加发光效果变体 |
| Card | card.tsx | 🔄 | 添加 glass 变体 |
| Input | input.tsx | ✅ | - |
| Select | select.tsx | ✅ | - |
| Checkbox | checkbox.tsx | ✅ | - |
| Switch | switch.tsx | ✅ | - |
| Slider | slider.tsx | ✅ | - |
| Tabs | tabs.tsx | 🔄 | 添加动画下划线 |
| Badge | badge.tsx | 🔄 | 添加发光变体 |
| Avatar | avatar.tsx | ✅ | - |
| Progress | progress.tsx | 🔄 | 添加渐变色 |
| Spinner | spinner.tsx | ✅ | - |
| Alert | alert.tsx | ✅ | - |
| Dialog | dialog.tsx | 🔄 | 玻璃效果 |
| Modal | modal.tsx | 🔄 | 玻璃效果 |
| Sheet | sheet.tsx | 🔄 | 玻璃效果 |
| Toast | toast.tsx | ✅ | - |
| Skeleton | skeleton.tsx | 🔄 | shimmer 动画 |
| Empty | empty.tsx | 🔄 | 添加插图 |
| Label | label.tsx | ✅ | - |
| Textarea | textarea.tsx | ✅ | - |
| DateRangePicker | DateRangePicker.tsx | ✅ | - |
| PullToRefresh | pull-to-refresh.tsx | ✅ | - |
| ErrorState | error-state.tsx | 🔄 | 添加插图 |
| PWAInstallPrompt | PWAInstallPrompt.tsx | ✅ | - |
| MobileBackButton | MobileBackButton.tsx | ✅ | - |

### 4.2 业务组件 - 已有 (32个)

| 组件 | 文件 | 模块 | 状态 |
|------|------|------|------|
| AnnouncementBanner | dashboard/ | Dashboard | ✅ |
| FearGreedIndex | dashboard/ | Dashboard | ✅ |
| OnboardingTasks | dashboard/ | Dashboard | ✅ |
| AiInsightCard | dashboard/ | Dashboard | ✅ |
| AiAnalysisModal | dashboard/ | Dashboard | ✅ |
| **AssetHeroCard** | dashboard/ | Dashboard | 🆕 新增 |
| TradingHeroCard | trading/ | Trading | ✅ |
| PositionCard | trading/ | Trading | ✅ |
| **PositionCardV2** | trading/ | Trading | 🆕 新增 |
| **AccountOverviewCard** | trading/ | Trading | 🆕 新增 |
| BotStatusCard | trading/ | Trading | ✅ |
| TradingLog | trading/ | Trading | ✅ |
| PeriodPnLStats | trading/ | Trading | ✅ |
| PanicButton | trading/ | Trading | ✅ |
| AdvancedParams | trading/ | Trading | ✅ |
| SignalCard | trading/ | Trading | ✅ |
| TradeSignalCard | trading/ | Trading | ✅ |
| TradeAiInsightCard | trading/ | Trading | ✅ |
| SymbolSearch | trading/ | Trading | ✅ |
| TradingKLineView | trading/ | Trading | ✅ |
| StrategyQuickControlSheet | trading/ | Trading | ✅ |
| StrategySelector | strategies/ | Strategies | ✅ |
| **StrategyCardV2** | strategies/ | Strategies | 🆕 新增 |
| AdvancedSettings | strategies/ | Strategies | ✅ |
| CollapsibleSection | strategies/ | Strategies | ✅ |
| ConditionRow | strategies/ | Strategies | ✅ |
| TemplateSelector | strategies/ | Strategies | ✅ |
| StrategyConditionCard | strategies/ | Strategies | ✅ |
| ParamsHelpModal | strategies/ | Strategies | ✅ |
| DynamicContent | landing/ | Landing | ✅ |
| DynamicBanner | landing/ | Landing | ✅ |

### 4.3 布局组件 (7个)

| 组件 | 文件 | 状态 |
|------|------|------|
| Header | header.tsx | ✅ |
| Sidebar | sidebar.tsx | ✅ |
| MobileHeader | MobileHeader.tsx | ✅ |
| MobileNav | MobileNav.tsx | ✅ |
| MobileTabBar | MobileTabBar.tsx | ✅ |
| MobileLayout | MobileLayout.tsx | ✅ |
| TelegramNav | TelegramNav.tsx | ✅ |

### 4.4 待新增组件

| 组件名 | 用途 | 优先级 |
|--------|------|--------|
| SparklineChart | 迷你收益曲线 | P0 |
| GaugeChart | 仪表盘图表 | P1 |
| StatCard | 统计数据卡片 | P1 |
| QuickActionGrid | 快捷操作网格 | P1 |
| TransactionItem | 交易记录项 | P2 |
| StakingCard | 质押卡片 | P2 |
| LeaderboardItem | 排行榜项 | P2 |
| EmptyIllustration | 空状态插图 | P2 |

---

## 五、v0.app API 配置

### 5.1 配置状态

| 项目 | 状态 | 详情 |
|------|------|------|
| API Token | ✅ 已配置 | `v1:26xzL1Fetn3agA3ROiaUNYTQ:fBw2Cwh8TiDyiUEL9EKM4thK` |
| SDK | ✅ 已安装 | v0-sdk ^0.15.3 |
| 生成脚本 | ✅ 已创建 | scripts/v0-generate.ts |
| 获取脚本 | ✅ 已创建 | scripts/v0-fetch-code.ts |

### 5.2 已生成组件

| 组件 | v0 Chat ID | 状态 |
|------|-----------|------|
| Dashboard Card | rmxMI1ek0qO | ✅ 已获取 |
| Trading Console | uCa4fJ7evee | ✅ 已获取 |
| Strategy Card | sMmw7wdGtWr | ✅ 已获取 |

### 5.3 待生成组件

| 组件 | 描述 | 优先级 |
|------|------|--------|
| WalletOverviewCard | 钱包概览卡片 | P1 |
| StakingPanel | 质押面板 | P1 |
| QuickActionButton | 快捷操作按钮 | P1 |
| StatisticsGrid | 统计数据网格 | P2 |

---

## 六、升级执行计划

### Phase 1: 核心页面升级 (P0)

**目标**: Dashboard、Trading、Strategies 三个核心页面

| 步骤 | 任务 | 预计文件数 |
|------|------|-----------|
| 1.1 | 集成 AssetHeroCard 到 Dashboard | 2 |
| 1.2 | 集成 AccountOverviewCard 到 Trading | 2 |
| 1.3 | 集成 PositionCardV2 到 Trading | 2 |
| 1.4 | 集成 StrategyCardV2 到 Strategies | 2 |
| 1.5 | 验证编译 + 视觉测试 | - |

### Phase 2: 基础组件升级 (P1)

**目标**: 升级通用组件，统一视觉风格

| 步骤 | 任务 | 预计文件数 |
|------|------|-----------|
| 2.1 | Card 组件添加 glass 变体 | 1 |
| 2.2 | Badge 组件添加发光变体 | 1 |
| 2.3 | Dialog/Modal/Sheet 玻璃效果 | 3 |
| 2.4 | Skeleton shimmer 动画 | 1 |
| 2.5 | 新增 SparklineChart 组件 | 1 |

### Phase 3: 次要页面升级 (P2)

**目标**: Wallet、Ecosystem、Me 等页面

| 步骤 | 任务 | 预计文件数 |
|------|------|-----------|
| 3.1 | Wallet 页面卡片升级 | 2 |
| 3.2 | Staking 页面卡片升级 | 2 |
| 3.3 | Me 页面统一样式 | 1 |
| 3.4 | 登录/注册页面优化 | 2 |

### Phase 4: 细节打磨 (P3)

**目标**: 动效、空状态、管理后台

| 步骤 | 任务 |
|------|------|
| 4.1 | 添加页面切换动画 |
| 4.2 | 空状态插图设计 |
| 4.3 | Admin 后台样式统一 |
| 4.4 | Telegram Mini App 适配 |

---

## 七、验收标准

### 7.1 视觉验收清单

- [ ] 所有卡片使用统一圆角 (8px/12px)
- [ ] 核心数字使用等宽字体
- [ ] 盈亏颜色正确 (绿涨红跌)
- [ ] 玻璃效果卡片有 backdrop-blur
- [ ] hover 状态有明显反馈
- [ ] 移动端触摸区域 ≥ 44px
- [ ] 暗色背景下文字可读性良好

### 7.2 功能验收清单

- [ ] 数据刷新有加载动画
- [ ] 点击跳转路由正确
- [ ] 空状态有友好提示
- [ ] 错误状态可重试
- [ ] 骨架屏显示正确

### 7.3 性能验收清单

- [ ] 首屏加载 < 3s
- [ ] 页面切换 < 500ms
- [ ] 动画流畅 60fps
- [ ] 无明显布局抖动

---

## 更新日志

| 日期 | 版本 | 变更 |
|------|------|------|
| 2026-01-11 | v2.0 | 全面重构，覆盖所有页面和组件 |
| 2026-01-11 | v1.0 | 初始版本 |
