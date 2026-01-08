# QuantFi 移动端 App 级 UI 设计方案

> 版本：v1.0
> 生成日期：2026-01-04
> 文档类型：可商用级移动端 UI 设计规范
> 适用范围：iOS / Android / PWA

---

## 一、设计理念与原则

### 1.1 设计目标

打造**接近微信/支付宝级别**的原生 App 体验，让用户在移动端也能流畅完成量化交易的全部操作。

### 1.2 核心设计原则

| 原则 | 说明 | 实现方式 |
|-----|------|---------|
| **一屏聚焦** | 每屏只做一件事，减少认知负担 | 卡片式布局，信息层级清晰 |
| **拇指友好** | 核心操作在拇指热区内 | 底部导航 + 底部操作按钮 |
| **即时反馈** | 每次触控都有响应 | 触感反馈 + 微动效 + 状态变化 |
| **视觉连贯** | 页面切换自然流畅 | 统一过渡动画 + 手势支持 |
| **信息降噪** | 只展示当前最重要的信息 | 渐进披露 + 折叠/展开 |

### 1.3 设计参考

| 参考 App | 借鉴点 |
|---------|-------|
| 微信 | 底部 Tab 切换、卡片列表、下拉刷新 |
| 支付宝 | 首页快捷入口网格、资产卡片渐变 |
| Binance | 交易界面布局、K 线图交互、盈亏配色 |
| Robinhood | 简洁的投资组合展示、动画曲线 |

---

## 二、移动端导航架构

### 2.1 底部 Tab Bar（5 个）

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                      [ 页面内容区 ]                          │
│                                                             │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐             │
│   │ 🏠  │  │ 📈  │  │ ⚡  │  │ 💰  │  │ 👤  │             │
│   │首页 │  │交易 │  │策略 │  │资产 │  │我的 │             │
│   └─────┘  └─────┘  └─────┘  └─────┘  └─────┘             │
│      ●                                                      │
│                                                             │
│   ─────────────────────────────────────────────────────    │
│                    [ 安全区 - iOS ]                         │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Tab 详细定义

#### Tab 1：首页 (Home)

| 属性 | 内容 |
|-----|------|
| **图标** | `Home` (lucide-react) |
| **路由** | `/dashboard` |
| **激活匹配** | `/dashboard` 及其子路由 |
| **核心职责** | 资产总览、收益趋势、运行状态概览 |
| **主要模块** | 公告横幅、核心指标卡片(4个)、收益曲线、机器人状态、持仓概览 |
| **不包含** | 具体配置操作、资金操作 |

#### Tab 2：交易 (Trade)

| 属性 | 内容 |
|-----|------|
| **图标** | `TrendingUp` (lucide-react) |
| **路由** | `/trading` |
| **激活匹配** | `/trading/*`, `/instances/*` |
| **核心职责** | 实盘控制、K线查看、VPS管理 |
| **主要模块** | 策略运行状态、K线图(可折叠)、交易日志流、快捷入口(VPS/历史/回测) |
| **不包含** | 策略选择（去策略Tab）、资金操作（去资产Tab） |

#### Tab 3：策略 (Strategy)

| 属性 | 内容 |
|-----|------|
| **图标** | `Zap` (lucide-react) |
| **路由** | `/strategies` |
| **激活匹配** | `/strategies/*` |
| **核心职责** | 浏览策略市场、管理我的策略 |
| **主要模块** | 策略卡片列表、筛选标签、我的配置入口、上传入口 |
| **不包含** | 策略执行（去交易Tab） |

#### Tab 4：资产 (Assets)

| 属性 | 内容 |
|-----|------|
| **图标** | `Wallet` (lucide-react) |
| **路由** | `/wallet` |
| **激活匹配** | `/wallet/*` |
| **核心职责** | 资产管理、充值提现、$QFI代币管理 |
| **主要模块** | 资产总览卡片(含USDT+积分+QFI)、快捷操作网格、交易记录列表 |
| **特别说明** | $QFI 代币余额在此页面展示，点击可进入代币详情页 |

#### Tab 5：我的 (Me)

| 属性 | 内容 |
|-----|------|
| **图标** | `User` (lucide-react) |
| **路由** | `/me` |
| **激活匹配** | `/me`, `/settings/*`, `/ecosystem/*`, `/referral`, `/help`, `/announcements`, `/subscription` |
| **核心职责** | 个人信息、账户设置、会员订阅、生态入口 |
| **主要模块** | 用户信息卡、**会员订阅入口(新增)**、功能入口列表、退出登录 |
| **特别说明** | 承担「设置中心」+「功能聚合」的双重职责 |

### 2.3 Tab Bar 视觉规范

```css
/* Tab Bar 样式 */
.tab-bar {
  height: 56px;                    /* 不含安全区 */
  background: rgba(11, 14, 17, 0.95);
  backdrop-filter: blur(20px);
  border-top: 1px solid rgba(43, 49, 57, 0.5);
}

/* Tab Item */
.tab-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

/* 图标 */
.tab-icon {
  width: 24px;
  height: 24px;
  transition: all 0.2s ease;
}

/* 激活态图标 */
.tab-icon.active {
  color: #3772FF;
  filter: drop-shadow(0 0 8px rgba(55, 114, 255, 0.5));
  transform: scale(1.1);
}

/* 标签文字 */
.tab-label {
  font-size: 10px;
  font-weight: 500;
  transition: color 0.2s ease;
}

/* 激活指示器 */
.tab-indicator {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #3772FF;
  box-shadow: 0 0 8px rgba(55, 114, 255, 0.8);
  margin-top: 2px;
}
```

### 2.4 Tab 切换交互

| 交互 | 效果 |
|-----|------|
| 点击 Tab | 切换到对应页面，有轻微触感反馈 |
| 双击当前 Tab | 回到页面顶部 / 刷新数据 |
| 长按 Tab | 可选：显示快捷操作气泡 |
| 左右滑动页面 | **不支持**（避免与页面内滑动冲突） |

---

## 三、核心页面线框图

### 3.1 首页 `/dashboard`

```
┌─────────────────────────────────────────┐
│ ▓▓▓▓▓▓▓▓ 状态栏 (系统) ▓▓▓▓▓▓▓▓         │
├─────────────────────────────────────────┤
│                                         │
│  QuantFi              🔔 ···            │  ← 顶部导航栏
│                                         │
├─────────────────────────────────────────┤
│ 📢 系统公告：xxx...            [查看 →] │  ← 公告横幅（可关闭）
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────────┐ ┌─────────────┐       │
│  │ 💰 总资产    │ │ 📈 今日盈亏  │       │  ← 核心指标卡片
│  │ $12,345.67 │ │ +$123.45 ↑ │       │     (2x2 网格)
│  │ ≈ ¥89,000   │ │ 胜率 68%    │       │
│  └─────────────┘ └─────────────┘       │
│                                         │
│  ┌─────────────┐ ┌─────────────┐       │
│  │ 🖥️ VPS      │ │ 📊 今日交易  │       │
│  │ 1 运行中    │ │ 12 笔       │       │
│  │ CPU 25%     │ │ 燃油费 $5   │       │
│  └─────────────┘ └─────────────┘       │
│                                         │
├─────────────────────────────────────────┤
│                                         │
│  收益曲线        [7天] [30天] [全部]    │  ← 收益图表
│  ┌─────────────────────────────────┐   │
│  │                     ╱╲          │   │
│  │              ╱╲   ╱    ╲        │   │
│  │         ╱╲  ╱  ╲ ╱      ╲ ╱╲   │   │
│  │    ╱╲  ╱  ╲╱    ╲        ╲╱ ╲  │   │
│  │ ╲╱  ╲╱                         │   │
│  └─────────────────────────────────┘   │
│                                         │
├─────────────────────────────────────────┤
│                                         │
│  🤖 机器人状态                   [→]    │  ← 机器人卡片
│  ┌─────────────────────────────────┐   │
│  │ ● 运行中 · 稳健防御型           │   │
│  │ 运行 48h · 今日 12 单           │   │
│  │                                 │   │
│  │    [停止]      [重启]           │   │
│  └─────────────────────────────────┘   │
│                                         │
├─────────────────────────────────────────┤
│                                         │
│  📊 当前持仓 (3)               [全部 →] │  ← 持仓摘要
│  ┌─────────────────────────────────┐   │
│  │ SOL/USDT  +3.2%     +$45.67   │   │
│  │ ETH/USDT  -0.5%     -$12.34   │   │
│  │ BTC/USDT  +1.8%     +$78.90   │   │
│  └─────────────────────────────────┘   │
│                                         │
│                                         │
│         ↓ 下拉刷新 / 上拉加载           │
│                                         │
├─────────────────────────────────────────┤
│  🏠     📈     ⚡     💰     👤        │  ← Tab Bar
│  首页   交易   策略   资产   我的       │
│   ●                                     │
└─────────────────────────────────────────┘
```

### 3.2 交易页 `/trading`

```
┌─────────────────────────────────────────┐
│ ▓▓▓▓▓▓▓▓ 状态栏 (系统) ▓▓▓▓▓▓▓▓         │
├─────────────────────────────────────────┤
│                                         │
│  交易控制台              [紧急平仓 🔴]   │  ← 顶部导航栏
│                                         │
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────────────────────────────┐   │  ← 策略状态卡片
│  │ 当前策略: 稳健防御型             │   │
│  │ 状态: ● 运行中   时间: 48h 32m  │   │
│  │ 今日: 12 笔   盈亏: +$45.67     │   │
│  │                                 │   │
│  │ [停止]  [重启]  [切换策略]      │   │
│  └─────────────────────────────────┘   │
│                                         │
├─────────────────────────────────────────┤
│                                         │
│  K 线图 (点击展开全屏)          [▽ 收起] │  ← K 线图区域
│  ┌─────────────────────────────────┐   │     (可折叠)
│  │  [1m] [5m] [15m] [1h] [4h] [1d] │   │
│  │                                 │   │
│  │  ┃┃ ┃┃┃  ┃┃┃┃  ┃┃   ┃┃┃ ┃┃    │   │
│  │  ┃┃ ┃┃┃  ┃┃┃┃  ┃┃   ┃┃┃ ┃┃    │   │
│  │  ▲ 买点       ▼ 卖点            │   │
│  └─────────────────────────────────┘   │
│                                         │
├─────────────────────────────────────────┤
│                                         │
│  实时日志                    [全屏 ↗]   │  ← 日志流区域
│  ┌─────────────────────────────────┐   │
│  │ 14:32:05 买入 SOL 10 @ $98.5   │   │
│  │ 14:30:22 卖出 ETH 0.5 盈利+$12 │   │
│  │ 14:28:15 信号触发 RSI < 30     │   │
│  │ ...                             │   │
│  └─────────────────────────────────┘   │
│                                         │
├─────────────────────────────────────────┤
│                                         │
│  快捷入口                               │  ← 快捷入口网格
│  ┌────────┐ ┌────────┐ ┌────────┐      │
│  │ 🖥️ VPS │ │ 📜 历史 │ │ 🔬 回测 │      │
│  └────────┘ └────────┘ └────────┘      │
│                                         │
├─────────────────────────────────────────┤
│  🏠     📈     ⚡     💰     👤        │
│  首页   交易   策略   资产   我的       │
│          ●                              │
└─────────────────────────────────────────┘
```

### 3.3 策略市场 `/strategies`

```
┌─────────────────────────────────────────┐
│ ▓▓▓▓▓▓▓▓ 状态栏 (系统) ▓▓▓▓▓▓▓▓         │
├─────────────────────────────────────────┤
│                                         │
│  策略市场                  [我的策略 →]  │
│                                         │
├─────────────────────────────────────────┤
│                                         │
│  [🔍 搜索策略...]                       │  ← 搜索框
│                                         │
│  [全部] [官方] [社区] │ [现货] [合约]   │  ← 筛选标签
│    ●                                    │     (横向滑动)
│                                         │
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────────────────────────────┐   │  ← 策略卡片列表
│  │ 🛡️ 稳健防御型           [官方]  │   │
│  │ 现货 · 低风险                   │   │
│  │                                 │   │
│  │ 年化: 15-25%    回撤: 8%       │   │
│  │ 使用人数: 1,234                 │   │
│  │                                 │   │
│  │           [使用此策略 →]        │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ 📈 趋势追踪型           [官方]  │   │
│  │ 现货 · 中风险                   │   │
│  │                                 │   │
│  │ 年化: 30-50%    回撤: 15%      │   │
│  │ 使用人数: 856                   │   │
│  │                                 │   │
│  │           [使用此策略 →]        │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ ⚡ 激进复利型    [社区] [🔒Pro] │   │
│  │ 合约 · 高风险                   │   │
│  │                                 │   │
│  │ 年化: 50-100%   回撤: 25%      │   │
│  │ 使用人数: 234                   │   │
│  │                                 │   │
│  │           [解锁 Pro →]          │   │
│  └─────────────────────────────────┘   │
│                                         │
│         ↓ 上拉加载更多                  │
│                                         │
├─────────────────────────────────────────┤
│  🏠     📈     ⚡     💰     👤        │
│  首页   交易   策略   资产   我的       │
│                ●                        │
└─────────────────────────────────────────┘
```

### 3.4 资产钱包 `/wallet`

```
┌─────────────────────────────────────────┐
│ ▓▓▓▓▓▓▓▓ 状态栏 (系统) ▓▓▓▓▓▓▓▓         │
├─────────────────────────────────────────┤
│                                         │
│  资产钱包          [👁️ 隐藏] [🔄 刷新]   │
│                                         │
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────────────────────────────┐   │  ← 资产总览卡片
│  │ ╔═══════════════════════════╗   │   │     (渐变背景)
│  │ ║                           ║   │   │
│  │ ║  总资产 (USDT)     🔒     ║   │   │
│  │ ║  $12,345.67               ║   │   │
│  │ ║                           ║   │   │
│  │ ║  ┌─────┐ ┌─────┐ ┌─────┐ ║   │   │  ← 快捷操作按钮
│  │ ║  │充值 │ │提现 │ │账单 │ ║   │   │
│  │ ║  └─────┘ └─────┘ └─────┘ ║   │   │
│  │ ║                           ║   │   │
│  │ ╚═══════════════════════════╝   │   │
│  └─────────────────────────────────┘   │
│                                         │
├─────────────────────────────────────────┤
│                                         │
│  资产明细                               │  ← 资产明细区域
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ 💵 USDT 余额                    │   │
│  │ 可用: $10,234.56               │   │
│  │ 冻结: $500.00                   │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ 🎯 积分余额                     │   │
│  │ 25,000 点                       │   │
│  │ ≈ $250 (可兑换 QFI)            │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │  ← QFI 代币卡片
│  │ 🪙 $QFI 代币              [→]   │   │     (新增)
│  │ 可用: 156.78 QFI               │   │
│  │ 待释放: 50.00 QFI              │   │
│  │ ≈ $41.36 · 当前价 $0.20       │   │
│  └─────────────────────────────────┘   │
│                                         │
├─────────────────────────────────────────┤
│                                         │
│  功能入口                               │  ← 功能入口列表
│  ┌─────────────────────────────────┐   │
│  │ 🔑 API Key 管理           [→]   │   │
│  │ 绑定交易所 API                  │   │
│  └─────────────────────────────────┘   │
│  ┌─────────────────────────────────┐   │
│  │ 🔄 积分兑换              [→]   │   │
│  │ 兑换 $QFI 代币                  │   │
│  └─────────────────────────────────┘   │
│                                         │
├─────────────────────────────────────────┤
│                                         │
│  最近交易                    [全部 →]   │  ← 交易记录
│  ┌─────────────────────────────────┐   │
│  │ ↓ 充值  +$500    已完成 12-25  │   │
│  │ ↑ 提现  -$200    处理中 12-24  │   │
│  │ ○ 抽成  -$12.5   已完成 12-24  │   │
│  └─────────────────────────────────┘   │
│                                         │
├─────────────────────────────────────────┤
│  🏠     📈     ⚡     💰     👤        │
│  首页   交易   策略   资产   我的       │
│                      ●                  │
└─────────────────────────────────────────┘
```

### 3.5 我的 `/me` (重要更新)

```
┌─────────────────────────────────────────┐
│ ▓▓▓▓▓▓▓▓ 状态栏 (系统) ▓▓▓▓▓▓▓▓         │
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────────────────────────────┐   │  ← 用户信息卡
│  │ ╔═══════════════════════════╗   │   │     (渐变装饰条)
│  │ ║ ░░░░░░░░░░░░░░░░░░░░░░░░░ ║   │   │
│  │ ╚═══════════════════════════╝   │   │
│  │                                 │   │
│  │  ┌────┐  用户昵称        [编辑]│   │
│  │  │ 👤 │  user@email.com        │   │
│  │  │头像│  VIP 1 会员            │   │
│  │  └────┘                        │   │
│  │                                 │   │
│  │  邀请码: ABCD1234      [复制]  │   │
│  └─────────────────────────────────┘   │
│                                         │
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────────────────────────────┐   │  ← 会员订阅卡片
│  │ 👑 会员订阅                [→]  │   │     ★★★ 新增 ★★★
│  │ ╔═══════════════════════════╗   │   │     (顶部突出位置)
│  │ ║ 当前: 免费版               ║   │   │
│  │ ║ 升级解锁: VPS + 全部策略   ║   │   │
│  │ ║                           ║   │   │
│  │ ║        [立即订阅 ¥25/月]   ║   │   │
│  │ ╚═══════════════════════════╝   │   │
│  └─────────────────────────────────┘   │
│                                         │
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────────────────────────────┐   │  ← PWA 安装提示
│  │ 📱 安装桌面应用           [安装]│   │     (未安装时显示)
│  │ 添加到主屏幕，获得原生体验      │   │
│  └─────────────────────────────────┘   │
│                                         │
├─────────────────────────────────────────┤
│                                         │
│  功能服务                               │  ← 功能入口列表
│  ┌─────────────────────────────────┐   │
│  │ 🌍 生态中心    积分 25,000 [→]  │   │
│  │ 🔒 安全中心    2FA 已开启  [→]  │   │
│  │ 🎁 邀请返佣    已邀 23 人  [→]  │   │
│  │ ⚙️ 账户设置               [→]  │   │
│  │ 🔔 通知设置               [→]  │   │
│  │ ⚠️ 币种黑名单   屏蔽 3 个 [→]  │   │
│  │ 🚨 紧急按钮               [→]  │   │
│  │ 📢 公告中心    2 条未读   [→]  │   │
│  │ ❓ 帮助与反馈             [→]  │   │
│  └─────────────────────────────────┘   │
│                                         │
├─────────────────────────────────────────┤
│                                         │
│  特殊权限 (按角色显示)                   │  ← 角色入口
│  ┌─────────────────────────────────┐   │
│  │ 🤝 代理商中心             [→]  │   │
│  │ 🛡️ 管理后台              [→]  │   │
│  └─────────────────────────────────┘   │
│                                         │
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────────────────────────────┐   │  ← 退出按钮
│  │         [🚪 退出登录]           │   │
│  └─────────────────────────────────┘   │
│                                         │
│              QuantFi v1.15.0            │  ← 版本号
│                                         │
├─────────────────────────────────────────┤
│  🏠     📈     ⚡     💰     👤        │
│  首页   交易   策略   资产   我的       │
│                            ●            │
└─────────────────────────────────────────┘
```

### 3.6 子页面通用结构

```
┌─────────────────────────────────────────┐
│ ▓▓▓▓▓▓▓▓ 状态栏 (系统) ▓▓▓▓▓▓▓▓         │
├─────────────────────────────────────────┤
│                                         │
│  [← 返回]    页面标题      [右侧操作]   │  ← 导航栏
│                                         │
├─────────────────────────────────────────┤
│                                         │
│                                         │
│                                         │
│              [ 页面内容 ]               │  ← 内容区域
│                                         │
│                                         │
│                                         │
│                                         │
├─────────────────────────────────────────┤
│                                         │
│            [ 底部操作按钮 ]              │  ← 固定底部
│                                         │  (如有主操作)
│  ─────────────────────────────────────  │
│             [ 安全区 - iOS ]            │
└─────────────────────────────────────────┘

注意：子页面不显示底部 Tab Bar
```

---

## 四、交互规范与手势定义

### 4.1 全局手势

| 手势 | 场景 | 效果 |
|-----|------|------|
| **下拉** | 一级页面顶部 | 下拉刷新（带弹性动画） |
| **上拉** | 列表底部 | 加载更多（无限滚动） |
| **右滑** | 子页面 | 返回上一页（iOS 风格） |
| **点击** | 任意可交互元素 | 触感反馈 + 状态变化 |
| **长按** | 卡片/列表项 | 显示更多操作（可选） |

### 4.2 返回按钮规则

| 页面层级 | 显示返回按钮 | 说明 |
|---------|-------------|-----|
| 一级页面（Tab 落地页） | ❌ 不显示 | `/dashboard`, `/trading`, `/strategies`, `/wallet`, `/me` |
| 二级页面 | ✅ 必须显示 | 所有子页面，如 `/wallet/deposit`, `/strategies/[id]` |
| 弹窗/抽屉 | ✅ 关闭按钮 | 右上角 × 或下拉关闭 |

### 4.3 触感反馈规范

| 操作 | 反馈强度 | 适用场景 |
|-----|---------|---------|
| 轻触 (Light) | 10ms 振动 | Tab 切换、列表项点击 |
| 中等 (Medium) | 20ms 振动 | 按钮点击、开关切换 |
| 重触 (Heavy) | 30ms 振动 | 重要操作（提现、平仓） |
| 成功 (Success) | 特殊模式 | 操作成功确认 |
| 错误 (Error) | 连续3次短振动 | 操作失败 |

```typescript
// 触感反馈实现
const hapticFeedback = {
  light: () => navigator.vibrate?.(10),
  medium: () => navigator.vibrate?.(20),
  heavy: () => navigator.vibrate?.(30),
  success: () => navigator.vibrate?.([10, 50, 20]),
  error: () => navigator.vibrate?.([20, 30, 20, 30, 20]),
};
```

### 4.4 加载状态规范

| 场景 | 加载方式 | 组件 |
|-----|---------|-----|
| 页面首次加载 | 骨架屏 (Skeleton) | `PageSkeleton` |
| 列表加载更多 | 底部 Spinner | `ListLoader` |
| 按钮操作中 | 按钮内 Spinner | `Button.isLoading` |
| 全局操作 | 全屏半透明遮罩 | `FullscreenLoader` |
| 下拉刷新 | 顶部动画指示器 | `PullToRefresh` |

### 4.5 空状态规范

```
┌─────────────────────────────────────────┐
│                                         │
│                                         │
│              [空状态插图]                │
│                 🔍                       │
│                                         │
│            暂无数据                      │
│       这里会显示您的xxx信息              │
│                                         │
│          [去xxx / 刷新]                 │
│                                         │
│                                         │
└─────────────────────────────────────────┘
```

| 页面 | 空状态文案 | 操作按钮 |
|-----|----------|---------|
| 策略列表 | 暂无可用策略 | 刷新 |
| 交易历史 | 暂无交易记录 | 去交易 |
| 持仓列表 | 暂无持仓 | 选择策略 |
| VPS 列表 | 暂无实例 | 创建实例 |
| 通知列表 | 暂无通知 | - |

---

## 五、视觉规范

### 5.1 配色系统（深色主题）

```css
:root {
  /* 背景色 */
  --bg-primary: #0B0E11;      /* 主背景 */
  --bg-secondary: #131722;     /* 卡片背景 */
  --bg-tertiary: #1E222D;      /* 输入框/次级卡片 */
  --bg-elevated: #252A34;      /* 悬浮/弹窗 */

  /* 品牌色 */
  --brand-primary: #3772FF;    /* 科技蓝 - 主色 */
  --brand-secondary: #2962FF;  /* 深蓝 - 悬停态 */
  --brand-gradient: linear-gradient(135deg, #3772FF 0%, #2962FF 100%);

  /* 语义色 */
  --success: #00C087;          /* 盈利/成功 */
  --danger: #F23645;           /* 亏损/错误 */
  --warning: #F7931A;          /* 警告/积分 */
  --info: #3772FF;             /* 信息提示 */

  /* 文字色 */
  --text-primary: #FFFFFF;     /* 主文字 */
  --text-secondary: #848E9C;   /* 次要文字 */
  --text-tertiary: #5E6673;    /* 占位符/禁用 */

  /* 边框色 */
  --border-primary: #2B3139;   /* 主边框 */
  --border-secondary: #363D47; /* 次级边框 */
}
```

### 5.2 字体规范

```css
:root {
  /* 字体族 */
  --font-sans: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif;
  --font-mono: "SF Mono", "Monaco", "Menlo", monospace;

  /* 字号层级 */
  --text-xs: 10px;    /* 辅助说明 */
  --text-sm: 12px;    /* 次要信息 */
  --text-base: 14px;  /* 正文 */
  --text-lg: 16px;    /* 标题 */
  --text-xl: 18px;    /* 页面标题 */
  --text-2xl: 24px;   /* 数字/金额 */
  --text-3xl: 32px;   /* 大数字 */

  /* 行高 */
  --leading-tight: 1.2;
  --leading-normal: 1.5;
  --leading-relaxed: 1.75;

  /* 字重 */
  --font-normal: 400;
  --font-medium: 500;
  --font-semibold: 600;
  --font-bold: 700;
}
```

### 5.3 间距系统

```css
:root {
  /* 基础间距单位 */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;

  /* 页面边距 */
  --page-padding: 16px;

  /* 卡片内边距 */
  --card-padding: 16px;
  --card-padding-sm: 12px;

  /* 列表项间距 */
  --list-gap: 12px;

  /* 安全区 */
  --safe-area-top: env(safe-area-inset-top);
  --safe-area-bottom: env(safe-area-inset-bottom);
}
```

### 5.4 圆角规范

```css
:root {
  --radius-sm: 6px;    /* 小按钮/标签 */
  --radius-md: 8px;    /* 输入框/小卡片 */
  --radius-lg: 12px;   /* 卡片 */
  --radius-xl: 16px;   /* 大卡片/弹窗 */
  --radius-2xl: 24px;  /* 底部弹窗 */
  --radius-full: 9999px; /* 圆形 */
}
```

### 5.5 阴影规范

```css
:root {
  /* 卡片阴影 */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.2);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.3);
  --shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.4);

  /* 发光效果 */
  --glow-primary: 0 0 20px rgba(55, 114, 255, 0.3);
  --glow-success: 0 0 20px rgba(0, 192, 135, 0.3);
  --glow-danger: 0 0 20px rgba(242, 54, 69, 0.3);
}
```

---

## 六、动效规范

### 6.1 时间曲线

```css
:root {
  /* 缓动函数 */
  --ease-in: cubic-bezier(0.4, 0, 1, 1);
  --ease-out: cubic-bezier(0, 0, 0.2, 1);
  --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-spring: cubic-bezier(0.175, 0.885, 0.32, 1.275);

  /* 时长 */
  --duration-fast: 150ms;
  --duration-normal: 250ms;
  --duration-slow: 350ms;
}
```

### 6.2 页面切换动画

```css
/* 页面进入 */
@keyframes page-enter {
  from {
    opacity: 0;
    transform: translateX(20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

/* 页面退出 */
@keyframes page-exit {
  from {
    opacity: 1;
    transform: translateX(0);
  }
  to {
    opacity: 0;
    transform: translateX(-20px);
  }
}

.page-transition-enter {
  animation: page-enter 250ms var(--ease-out);
}

.page-transition-exit {
  animation: page-exit 200ms var(--ease-in);
}
```

### 6.3 组件动效

| 组件 | 动效 | 时长 | 缓动 |
|-----|------|-----|------|
| 按钮点击 | 缩放 0.95 → 1 | 150ms | ease-out |
| 卡片悬浮 | 上移 2px + 阴影 | 200ms | ease-out |
| Tab 切换 | 图标缩放 + 颜色 | 200ms | ease-in-out |
| 列表项出现 | 淡入 + 上移 | 300ms | ease-out |
| 下拉刷新 | 弹性拉伸 | 300ms | spring |
| Toast 出现 | 底部滑入 | 250ms | ease-out |
| 弹窗打开 | 缩放 0.9 → 1 + 淡入 | 200ms | ease-out |

### 6.4 骨架屏动画

```css
@keyframes skeleton-pulse {
  0%, 100% {
    opacity: 0.4;
  }
  50% {
    opacity: 0.8;
  }
}

.skeleton {
  background: linear-gradient(
    90deg,
    var(--bg-tertiary) 0%,
    var(--bg-secondary) 50%,
    var(--bg-tertiary) 100%
  );
  background-size: 200% 100%;
  animation: skeleton-pulse 1.5s ease-in-out infinite;
}
```

---

## 七、组件库清单

### 7.1 基础组件

| 组件 | 文件路径 | 说明 |
|-----|---------|------|
| Button | `components/ui/button.tsx` | 按钮（gradient/outline/ghost） |
| Input | `components/ui/input.tsx` | 输入框 |
| Card | `components/ui/card.tsx` | 卡片容器 |
| Badge | `components/ui/badge.tsx` | 标签/徽章 |
| Dialog | `components/ui/dialog.tsx` | 弹窗 |
| Toast | `components/ui/toast.tsx` | 轻提示 |
| Spinner | `components/ui/spinner.tsx` | 加载指示器 |
| Skeleton | `components/ui/skeleton.tsx` | 骨架屏 |
| Switch | `components/ui/switch.tsx` | 开关 |
| Tabs | `components/ui/tabs.tsx` | 标签页切换 |

### 7.2 移动端专用组件

| 组件 | 文件路径 | 说明 |
|-----|---------|------|
| MobileNav | `components/layout/MobileNav.tsx` | 底部 Tab 导航 |
| MobileHeader | `components/ui/MobileHeader.tsx` | 移动端头部导航 |
| MobileBackButton | `components/ui/MobileBackButton.tsx` | 返回按钮 |
| PullToRefresh | `components/ui/pull-to-refresh.tsx` | 下拉刷新 |
| BottomSheet | `components/ui/bottom-sheet.tsx` | 底部弹出层（待实现） |
| ActionSheet | `components/ui/action-sheet.tsx` | 操作菜单（待实现） |
| SwipeableCard | `components/ui/swipeable-card.tsx` | 可滑动卡片（待实现） |

### 7.3 业务组件

| 组件 | 文件路径 | 说明 |
|-----|---------|------|
| AssetCard | `components/features/wallet/AssetCard.tsx` | 资产卡片 |
| StrategyCard | `components/features/strategies/StrategyCard.tsx` | 策略卡片 |
| TradeLogItem | `components/features/trading/TradeLogItem.tsx` | 交易日志项 |
| PositionCard | `components/features/trading/PositionCard.tsx` | 持仓卡片 |
| PnLChart | `components/charts/PnLChart.tsx` | 盈亏曲线图 |
| StatCard | `components/features/dashboard/StatCard.tsx` | 统计指标卡 |

---

## 八、缺失功能补全方案

### 8.1 会员订阅入口（P0 - 必须修复）

**问题**：移动端没有「会员订阅」入口，影响核心付费转化

**解决方案**：

1. **`/me` 页面添加订阅卡片**（最显眼位置）

```tsx
// /me/page.tsx - 在用户信息卡下方添加
<Card className="bg-gradient-to-r from-brand-primary/20 to-warning/20 border-brand-primary/30">
  <CardContent className="p-4">
    <div className="flex items-center gap-4">
      <div className="w-12 h-12 bg-gradient-to-br from-warning to-warning/60 rounded-xl flex items-center justify-center">
        <Crown className="w-6 h-6 text-white" />
      </div>
      <div className="flex-1">
        <h3 className="text-white font-bold">会员订阅</h3>
        <p className="text-text-secondary text-sm">
          {isSubscribed ? `VIP${vipLevel} 会员` : '升级解锁全部功能'}
        </p>
      </div>
      <Button variant="gradient" size="sm">
        {isSubscribed ? '管理' : '订阅'}
      </Button>
    </div>
  </CardContent>
</Card>
```

2. **仪表盘添加订阅引导**（未订阅用户）

```tsx
// /dashboard/page.tsx - 在公告下方添加
{!isSubscribed && (
  <SubscriptionPromptBanner
    onPress={() => router.push('/subscription')}
    price="¥25/月起"
  />
)}
```

### 8.2 $QFI 代币余额展示（已在钱包页）

**当前状态**：已在 `/wallet` 页面有积分展示，需补充 QFI 代币卡片

**解决方案**：在资产明细区域添加 QFI 代币卡片

```tsx
// /wallet/page.tsx - 资产明细区域
<div className="bg-bg-secondary border border-border-primary rounded-xl p-4">
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 bg-brand-primary/20 rounded-lg flex items-center justify-center">
        <Coins className="w-5 h-5 text-brand-primary" />
      </div>
      <div>
        <p className="text-text-secondary text-xs">$QFI 代币</p>
        <p className="text-white font-bold text-lg">
          {qfiBalance?.available || '0.00'} QFI
        </p>
      </div>
    </div>
    <ChevronRight className="w-5 h-5 text-text-tertiary" />
  </div>
  <div className="flex items-center gap-4 mt-3 text-xs text-text-tertiary">
    <span>待释放: {qfiBalance?.vesting || '0'} QFI</span>
    <span>≈ ${(parseFloat(qfiBalance?.total || '0') * 0.20).toFixed(2)}</span>
  </div>
</div>
```

### 8.3 子页面返回按钮统一

**问题**：部分子页面缺少返回按钮

**解决方案**：

1. 创建统一的 `PageHeader` 组件

```tsx
// components/ui/PageHeader.tsx
interface PageHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  rightAction?: React.ReactNode;
}

export function PageHeader({ title, subtitle, showBack = true, rightAction }: PageHeaderProps) {
  const router = useRouter();

  return (
    <div className="sticky top-0 z-40 bg-bg-primary/95 backdrop-blur-lg border-b border-border-primary lg:hidden">
      <div className="flex items-center justify-between h-14 px-4">
        {showBack ? (
          <button onClick={() => router.back()} className="p-2 -ml-2">
            <ChevronLeft className="w-6 h-6 text-text-primary" />
          </button>
        ) : (
          <div className="w-10" />
        )}

        <div className="flex-1 text-center">
          <h1 className="text-lg font-bold text-text-primary">{title}</h1>
          {subtitle && (
            <p className="text-xs text-text-tertiary">{subtitle}</p>
          )}
        </div>

        <div className="w-10 flex justify-end">
          {rightAction}
        </div>
      </div>
    </div>
  );
}
```

2. 所有子页面使用 `PageHeader`

```tsx
// 示例：/wallet/deposit/page.tsx
export default function DepositPage() {
  return (
    <div className="pb-safe">
      <PageHeader title="充值" />
      {/* 页面内容 */}
    </div>
  );
}
```

### 8.4 底部安全区适配

**问题**：部分页面底部被 Tab Bar 或 iPhone 底部横条遮挡

**解决方案**：

1. 一级页面（有 Tab Bar）：`pb-20 lg:pb-6`
2. 子页面（无 Tab Bar）：`pb-safe`
3. 有底部固定按钮的页面：`pb-24` + 按钮 `bottom-safe`

```tsx
// 布局组件中统一处理
<main className="min-h-screen pb-20 lg:pb-6">
  {children}
</main>

// 底部固定按钮
<div className="fixed bottom-0 left-0 right-0 p-4 pb-safe bg-bg-primary border-t border-border-primary lg:hidden">
  <Button className="w-full">确认操作</Button>
</div>
```

---

## 九、实施检查清单

### 9.1 Phase 1：核心问题修复（1-2天）

- [ ] `/me` 页面添加「会员订阅」卡片入口
- [ ] `/wallet` 页面添加 $QFI 代币余额展示
- [ ] 所有子页面添加统一的 `PageHeader` 组件
- [ ] 检查并修复底部安全区适配

### 9.2 Phase 2：交互体验优化（2-3天）

- [ ] 实现下拉刷新组件 `PullToRefresh`
- [ ] Tab 切换添加触感反馈
- [ ] 按钮点击添加缩放动效
- [ ] 页面切换添加过渡动画
- [ ] 骨架屏统一样式

### 9.3 Phase 3：视觉统一（2-3天）

- [ ] 统一所有卡片圆角和阴影
- [ ] 统一空状态样式和文案
- [ ] 统一加载状态样式
- [ ] 统一 Toast 提示样式
- [ ] 检查配色一致性

### 9.4 Phase 4：细节打磨（1-2天）

- [ ] 优化 K 线图在移动端的交互
- [ ] 优化长列表滚动性能
- [ ] 添加页面骨架屏
- [ ] 测试不同 iPhone 机型适配
- [ ] 测试 Android 设备适配

---

## 十、附录：关键文件路径

| 文件 | 路径 | 说明 |
|-----|------|------|
| 底部导航 | `apps/web/src/components/layout/MobileNav.tsx` | Tab Bar 组件 |
| 个人中心 | `apps/web/src/app/(dashboard)/me/page.tsx` | 我的页面 |
| 钱包页 | `apps/web/src/app/(dashboard)/wallet/page.tsx` | 资产页面 |
| 仪表盘 | `apps/web/src/app/(dashboard)/dashboard/page.tsx` | 首页 |
| 全局样式 | `apps/web/src/app/globals.css` | CSS 变量 |
| UI 组件 | `apps/web/src/components/ui/` | 基础组件目录 |
| 布局组件 | `apps/web/src/components/layout/` | 布局组件目录 |

---

*本文档为可商用级移动端 UI 设计规范，可直接交付前端工程师或 UI 设计工具使用。*
