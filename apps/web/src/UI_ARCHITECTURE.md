# QuantFi 前端 UI 架构设计（完整版）

> 版本: v3.0 (Final)
> 更新日期: 2025-12-25
> 基于: QUANTFI_ULTIMATE_WHITE_PAPER v4.0
> 状态: **开发规范文档 - 所有 UI 开发必须严格遵循**

---

## 一、设计理念与视觉规范

### 1.1 核心设计原则

| 原则 | 说明 |
|------|------|
| **极简** | 隐藏复杂性，只展示用户关心的收益数据 |
| **信任感** | 华尔街风格，专业金融产品质感 |
| **暗黑模式** | 深色背景减少视觉疲劳，突出数据 |
| **一键操作** | 核心功能一步到位，不让用户思考 |

**禁止展示**：config.json、代码、复杂K线、订单ID
**必须展示**：今日收益、一键启停、风险等级、资金曲线

### 1.2 配色方案（华尔街风格 - 优化版）

```css
:root {
  /* 背景层次 */
  --bg-primary: #0B0E11;        /* 主背景 - 深黑蓝 */
  --bg-secondary: #131722;       /* 次级背景 - 卡片 */
  --bg-tertiary: #1E222D;        /* 第三层 - 输入框/悬浮 */
  --bg-elevated: rgba(255, 255, 255, 0.05); /* 浮层 */

  /* 品牌色 */
  --brand-primary: #3772FF;      /* 科技蓝 - 主按钮/链接 */
  --brand-secondary: #2962FF;    /* 深蓝 - 悬浮态 */
  --brand-gradient: linear-gradient(135deg, #3772FF 0%, #00D9E8 100%);

  /* 语义色 */
  --success: #00C087;            /* 翡翠绿 - 盈利/涨 */
  --success-bg: rgba(0, 192, 135, 0.1);
  --danger: #F23645;             /* 玫瑰红 - 亏损/跌 */
  --danger-bg: rgba(242, 54, 69, 0.1);
  --warning: #F7931A;            /* 橙色 - 警告 */
  --warning-bg: rgba(247, 147, 26, 0.1);

  /* 文字 */
  --text-primary: #FFFFFF;       /* 主文字 */
  --text-secondary: #848E9C;     /* 次要文字 */
  --text-tertiary: #5E6673;      /* 辅助文字 */
  --text-disabled: #3C4251;      /* 禁用文字 */

  /* 边框 */
  --border-primary: #2B3139;     /* 主边框 */
  --border-secondary: #1F2937;   /* 次级边框 */
  --border-focus: #3772FF;       /* 聚焦边框 */

  /* 阴影 */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.4);
  --shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.5);
}
```

### 1.3 字体规范

```css
/* 主字体 */
font-family: 'Inter', 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;

/* 数字专用（等宽） */
font-family: 'Inter', 'Roboto Mono', monospace;
font-variant-numeric: tabular-nums;

/* 字号层级 */
--text-xs: 12px;    /* 辅助信息 */
--text-sm: 14px;    /* 正文 */
--text-base: 16px;  /* 标题 */
--text-lg: 18px;    /* 小标题 */
--text-xl: 20px;    /* 页面标题 */
--text-2xl: 24px;   /* 重要数据 */
--text-3xl: 32px;   /* 大标题 */
--text-4xl: 48px;   /* 核心数字（总资产） */
```

### 1.4 间距与圆角

```css
/* 间距 */
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 20px;
--space-6: 24px;
--space-8: 32px;
--space-10: 40px;
--space-12: 48px;

/* 圆角 */
--radius-sm: 6px;   /* 按钮/输入框 */
--radius-md: 8px;   /* 小卡片 */
--radius-lg: 12px;  /* 大卡片 */
--radius-xl: 16px;  /* 弹窗 */
--radius-full: 9999px; /* 药丸标签 */
```

### 1.5 响应式断点

| 断点 | 宽度 | 布局 | 导航方式 |
|------|------|------|----------|
| Mobile | < 768px | 单列 | **底部导航** (5个Tab) |
| Tablet | 768px - 1024px | 双列 | 底部导航 |
| Desktop | > 1024px | 三列 | 左侧边栏 |

---

## 二、目录结构

```
apps/web/src/
│
├── app/                              # Next.js App Router
│   ├── (public)/                     # 公开页面（无需登录）
│   │   ├── page.tsx                  # 首页 Landing
│   │   ├── login/page.tsx
│   │   ├── register/page.tsx
│   │   ├── forgot-password/page.tsx
│   │   ├── terms/page.tsx            # 用户协议
│   │   ├── privacy/page.tsx          # 隐私政策
│   │   └── layout.tsx
│   │
│   ├── (dashboard)/                  # 用户端（需登录）
│   │   ├── layout.tsx                # 含 Sidebar + MobileNav
│   │   ├── dashboard/page.tsx        # 仪表盘
│   │   │
│   │   ├── strategies/               # 策略市场
│   │   │   ├── page.tsx              # 策略列表
│   │   │   └── [id]/page.tsx         # 策略详情+配置
│   │   │
│   │   ├── trading/                  # 交易控制台
│   │   │   ├── page.tsx              # 实盘控制
│   │   │   ├── backtest/page.tsx     # 回测系统
│   │   │   ├── history/page.tsx      # 交易历史
│   │   │   └── ai/page.tsx           # AI 策略生成器
│   │   │
│   │   ├── wallet/                   # 资产钱包
│   │   │   ├── page.tsx              # 资产概览
│   │   │   ├── deposit/page.tsx      # 充值
│   │   │   ├── withdraw/page.tsx     # 提现
│   │   │   ├── api-keys/page.tsx     # API Key 绑定
│   │   │   ├── billing/page.tsx      # 账单明细
│   │   │   └── points/page.tsx       # 点卡/积分
│   │   │
│   │   ├── ecosystem/                # 生态中心
│   │   │   ├── page.tsx              # 概览
│   │   │   ├── staking/page.tsx      # 质押大厅
│   │   │   ├── exchange/page.tsx     # 积分兑换
│   │   │   ├── vesting/page.tsx      # 释放进度
│   │   │   └── leaderboard/page.tsx  # 排行榜
│   │   │
│   │   ├── instances/                # VPS 实例
│   │   │   ├── page.tsx              # 实例列表
│   │   │   └── [id]/page.tsx         # 实例详情+日志
│   │   │
│   │   └── settings/                 # 设置
│   │       ├── page.tsx              # 账户设置
│   │       ├── security/page.tsx     # 安全设置(2FA)
│   │       ├── blacklist/page.tsx    # 币种黑名单
│   │       ├── notifications/page.tsx # 通知设置
│   │       └── panic/page.tsx        # 紧急按钮
│   │
│   ├── (agent)/                      # 代理商后台
│   │   ├── layout.tsx
│   │   └── agent/
│   │       ├── page.tsx              # 代理商概览
│   │       ├── promotion/page.tsx    # 推广工具
│   │       ├── performance/page.tsx  # 业绩报表
│   │       ├── referrals/page.tsx    # 下级管理
│   │       ├── commissions/page.tsx  # 佣金明细
│   │       └── withdraw/page.tsx     # 佣金提现
│   │
│   ├── (admin)/                      # 管理后台
│   │   ├── layout.tsx
│   │   └── admin/
│   │       ├── page.tsx              # 管理概览
│   │       ├── users/                # 用户管理
│   │       │   ├── page.tsx          # 用户列表
│   │       │   └── [id]/page.tsx     # 用户详情
│   │       ├── instances/page.tsx    # VPS 全网监控
│   │       ├── finance/              # 财务审计
│   │       │   ├── page.tsx          # 收支报表
│   │       │   ├── withdrawals/page.tsx # 提现审核
│   │       │   └── revenue/page.tsx  # 收入分配
│   │       ├── strategies/page.tsx   # 策略管理
│   │       ├── announcements/page.tsx # 公告管理
│   │       └── kill-switch/page.tsx  # 全网停机
│   │
│   ├── layout.tsx                    # 根布局
│   ├── globals.css
│   ├── loading.tsx                   # 全局加载
│   ├── error.tsx                     # 全局错误
│   └── not-found.tsx                 # 404
│
├── components/
│   ├── ui/                           # 基础组件（16个）
│   ├── layout/                       # 布局组件（6个）
│   ├── charts/                       # 图表组件（5个）
│   ├── forms/                        # 表单组件（10个）
│   └── features/                     # 业务组件（按模块）
│
├── hooks/                            # 自定义 Hooks（12个）
├── lib/                              # 工具库（6个文件）
├── stores/                           # Zustand（5个）
├── types/                            # 类型定义（8个）
└── styles/                           # 样式文件
```

---

## 三、页面功能详细规格

### 3.1 公开页面

#### `/` - Landing Page（首页）

**目的**：产品介绍，引导注册

| 区块 | 内容 | 交互 |
|------|------|------|
| Hero | 标语 + 总收益数据 + 注册按钮 | 点击跳转注册 |
| Features | 3个核心卖点卡片 | 悬浮动效 |
| How it works | 3步流程图解 | 滚动动画 |
| Stats | 平台数据（用户数/总收益/机器人数） | 数字滚动动画 |
| Testimonials | 用户评价 | 轮播 |
| CTA | 立即开始按钮 | 跳转注册 |
| Footer | 链接 + 社交媒体 | - |

#### `/login` - 登录

| 字段 | 类型 | 验证 |
|------|------|------|
| 邮箱 | email | 必填 + 格式 |
| 密码 | password | 必填 + 8位以上 |
| 记住我 | checkbox | 可选 |

**交互**：
- 登录成功 -> 跳转 /dashboard
- 登录失败 -> 显示错误提示
- 忘记密码链接
- 注册链接

#### `/register` - 注册

| 字段 | 类型 | 验证 |
|------|------|------|
| 邮箱 | email | 必填 + 格式 + 唯一性 |
| 密码 | password | 必填 + 8位 + 强度检测 |
| 确认密码 | password | 必须一致 |
| 邀请码 | text | 选填（自动从URL读取） |
| 用户协议 | checkbox | **必须勾选** |

**协议文案**：「我已阅读并同意《用户协议》，理解本平台仅提供技术工具服务，不承担策略运行风险。」

---

### 3.2 用户端 - 仪表盘 `/dashboard`

**定位**：用户登录后第一眼看到的"驾驶舱"，决定用户是否充值

#### 页面结构

```
┌────────────────────────────────────────────────────┐
│  顶部公告跑马灯                                       │
├────────────────────────────────────────────────────┤
│                                                    │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐  │
│  │  总资产      │ │  今日盈亏    │ │  点卡余额    │  │
│  │  $12,345.67 │ │  +$123.45   │ │  5,000 点    │  │
│  │             │ │  +1.25%     │ │             │  │
│  └─────────────┘ └─────────────┘ └─────────────┘  │
│                                                    │
│  ┌──────────────────────────────────────────────┐  │
│  │  收益曲线图 (7天/30天/90天/全部)                 │  │
│  │  [==================== Recharts ============] │  │
│  └──────────────────────────────────────────────┘  │
│                                                    │
│  ┌───────────────────────┐ ┌───────────────────┐  │
│  │  机器人状态             │ │  VPS 状态          │  │
│  │  ● 稳健型策略           │ │  CPU: 25%         │  │
│  │  运行中 · 48小时        │ │  RAM: 60%         │  │
│  │                        │ │  IP: 1.2.3.4      │  │
│  │  [ 停止 ]  [ 重启 ]     │ │  [ 查看详情 ]      │  │
│  └───────────────────────┘ └───────────────────┘  │
│                                                    │
│  ┌──────────────────────────────────────────────┐  │
│  │  当前持仓                                      │  │
│  │  ┌─────────────────────────────────────────┐ │  │
│  │  │ SOL/USDT   +3.2%   │ ETH/USDT   -0.5%  │ │  │
│  │  │ BTC/USDT   +1.8%   │ DOGE/USDT  +5.1%  │ │  │
│  │  └─────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────┘  │
│                                                    │
└────────────────────────────────────────────────────┘
```

#### 核心组件规格

| 组件 | 样式 | 交互 |
|------|------|------|
| 总资产卡片 | 48px 白色数字 | 点击跳转钱包 |
| 今日盈亏 | 24px 绿涨红跌 | 悬浮显示明细 |
| 收益曲线 | Recharts 折线图 | 时间切换、悬浮数据点 |
| 机器人状态 | 状态徽章 + 大按钮 | 启动/停止操作 |
| 持仓列表 | 币种 + 浮盈比例 | 点击展开详情 |

---

### 3.3 用户端 - 策略市场 `/strategies`

**定位**：用户挑选"武器"的核心卖点页面

#### 策略列表页

```
┌────────────────────────────────────────────────────┐
│  策略市场                          [ 我的策略 ]      │
├────────────────────────────────────────────────────┤
│  筛选: [ 全部 ] [ 现货 ] [ 合约 ] [ 低风险 ] [ AI ]  │
├────────────────────────────────────────────────────┤
│                                                    │
│  ┌───────────────────────┐ ┌───────────────────┐  │
│  │  🛡️ 稳健防御型          │ │  📈 趋势追踪型      │  │
│  │  ────────────────      │ │  ────────────────  │  │
│  │  适合熊市 · 现货 · 低风险 │ │  中风险 · 现货      │  │
│  │                        │ │                    │  │
│  │  历史年化: 15-25%       │ │  历史年化: 30-50%   │  │
│  │  最大回撤: 8%           │ │  最大回撤: 15%      │  │
│  │  胜率: 68%             │ │  胜率: 55%         │  │
│  │                        │ │                    │  │
│  │  [ 使用此策略 ]         │ │  [ 使用此策略 ]      │  │
│  └───────────────────────┘ └───────────────────┘  │
│                                                    │
│  ┌───────────────────────┐ ┌───────────────────┐  │
│  │  ⚡ 激进复利型          │ │  🤖 AI 智能策略     │  │
│  │  ────────────────      │ │  ────────────────  │  │
│  │  高风险 · 合约 · 杠杆   │ │  AI生成 · 自适应    │  │
│  │                        │ │                    │  │
│  │  历史年化: 50-100%     │ │  历史年化: 动态      │  │
│  │  最大回撤: 25%         │ │  最大回撤: 动态      │  │
│  │  胜率: 48%             │ │  胜率: 动态         │  │
│  │                        │ │                    │  │
│  │  🔒 [ 解锁 Pro ]       │ │  [ 生成策略 ]       │  │
│  └───────────────────────┘ └───────────────────┘  │
│                                                    │
└────────────────────────────────────────────────────┘
```

#### 策略详情页 `/strategies/[id]`

| 区块 | 内容 |
|------|------|
| 策略信息 | 名称、描述、标签、风险等级 |
| 历史表现 | 收益曲线、回撤曲线、月度收益表 |
| 核心指标 | 年化收益、最大回撤、夏普比率、胜率 |
| **配置面板** | 投入金额（必填）、止损比例（默认-5.2%可调）、杠杆（如适用） |
| 操作按钮 | [ 应用此策略 ]（主按钮） |

#### AI 策略生成器 `/trading/ai`

| 字段 | 说明 |
|------|------|
| 自然语言输入 | "我想做一个基于 RSI 的策略，RSI<30买入，RSI>70卖出" |
| 生成按钮 | 调用 LLM 生成策略代码 |
| 预览 | 显示生成的策略逻辑（用户友好语言，不显示代码） |
| 回测 | 一键回测生成的策略 |
| 部署 | 应用到实盘 |

---

### 3.4 用户端 - 交易控制台 `/trading`

#### 实盘控制页 `/trading`

```
┌────────────────────────────────────────────────────┐
│  交易控制台                                         │
├────────────────────────────────────────────────────┤
│                                                    │
│  ┌──────────────────────────────────────────────┐  │
│  │  当前策略: 稳健防御型                          │  │
│  │  状态: ● 运行中    运行时间: 48h 32m          │  │
│  │  今日交易: 12 笔   今日盈亏: +$45.67          │  │
│  │                                               │  │
│  │  [ 停止 ]  [ 重启 ]  [ 🔴 紧急平仓 ]          │  │
│  └──────────────────────────────────────────────┘  │
│                                                    │
│  ┌──────────────────────────────────────────────┐  │
│  │  实时日志流 (WebSocket)                        │  │
│  │  ─────────────────────────────────────────── │  │
│  │  14:32:05 买入 SOL/USDT 数量:10 价格:98.5    │  │
│  │  14:30:22 卖出 ETH/USDT 数量:0.5 盈利:+$12   │  │
│  │  14:28:15 信号触发: RSI超卖                   │  │
│  │  ...                                          │  │
│  └──────────────────────────────────────────────┘  │
│                                                    │
│  ┌───────────────────────┐ ┌───────────────────┐  │
│  │  AI 解读              │ │  快捷操作          │  │
│  │  "刚才 SOL 买入是因   │ │  [ 切换策略 ]      │  │
│  │  为 RSI 触发超卖信号  │ │  [ 调整参数 ]      │  │
│  │  ，预期反弹获利"      │ │  [ 查看历史 ]      │  │
│  └───────────────────────┘ └───────────────────┘  │
│                                                    │
└────────────────────────────────────────────────────┘
```

#### 回测系统 `/trading/backtest`

| 配置项 | 类型 | 说明 |
|--------|------|------|
| 策略选择 | dropdown | 选择要回测的策略 |
| 时间范围 | date-range | 开始/结束日期 |
| 初始资金 | number | 模拟资金量 |
| 交易对 | multi-select | 选择交易对 |
| 手续费 | number | 模拟手续费率 |

**输出报表**：
- 资金曲线图
- 最大回撤（数值+图示）
- 总收益率
- 胜率
- 盈亏比
- 交易次数
- 平均持仓时间

#### 交易历史 `/trading/history`

| 列 | 说明 |
|----|------|
| 时间 | 开仓/平仓时间 |
| 交易对 | 如 BTC/USDT |
| 方向 | 买入/卖出（多/空） |
| 数量 | 交易数量 |
| 开仓价 | 开仓价格 |
| 平仓价 | 平仓价格 |
| 盈亏 | 金额 + 百分比（绿涨红跌） |
| 手续费 | 交易手续费 |

**筛选器**：时间范围、交易对、盈亏状态

---

### 3.5 用户端 - 资产钱包 `/wallet`

#### 资产概览页 `/wallet`

```
┌────────────────────────────────────────────────────┐
│  我的资产                                          │
├────────────────────────────────────────────────────┤
│                                                    │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐  │
│  │  可用余额    │ │  冻结余额    │ │  点卡余额    │  │
│  │  $8,234.56  │ │  $500.00   │ │  12,500 点   │  │
│  │  ≈ 8234 USDT│ │             │ │  ≈ $125     │  │
│  └─────────────┘ └─────────────┘ └─────────────┘  │
│                                                    │
│  [ 充值 ]  [ 提现 ]  [ 划转 ]  [ 点卡购买 ]         │
│                                                    │
│  ┌──────────────────────────────────────────────┐  │
│  │  资产分布饼图                                  │  │
│  │  [ Recharts Pie: USDT/冻结/点卡 ]             │  │
│  └──────────────────────────────────────────────┘  │
│                                                    │
│  ┌──────────────────────────────────────────────┐  │
│  │  最近交易                        [ 查看全部 ]  │  │
│  │  ─────────────────────────────────────────── │  │
│  │  充值  +$500.00   已完成   12-25 14:30       │  │
│  │  提现  -$200.00   处理中   12-24 10:15       │  │
│  │  抽成  -$12.50    已完成   12-24 08:00       │  │
│  └──────────────────────────────────────────────┘  │
│                                                    │
└────────────────────────────────────────────────────┘
```

#### 充值页 `/wallet/deposit`

| 元素 | 说明 |
|------|------|
| 链选择 | TRC20 / ERC20 / BEP20 (Tab切换) |
| 充值地址 | 显示地址 + 二维码 + 复制按钮 |
| 最低充值 | 提示最低充值金额 |
| 充值记录 | 显示最近充值列表（状态：确认中/已完成） |

#### 提现页 `/wallet/withdraw`

| 字段 | 类型 | 验证 |
|------|------|------|
| 提现金额 | number | 必填 + 不超过可用余额 |
| 链类型 | select | TRC20/ERC20/BEP20 |
| 收款地址 | text | 必填 + 地址格式校验 |
| 安全验证 | 2FA | 二次验证（邮箱验证码/Google 2FA） |

**提现费率提示**：显示不同链的手续费

#### API Key 绑定 `/wallet/api-keys`

| 字段 | 说明 |
|------|------|
| 交易所 | Binance / OKX / Bybit / Bitget |
| 标签 | 自定义名称（如"主账户"） |
| API Key | 输入框（支持粘贴） |
| Secret Key | 密码输入框（显示 ******） |
| Passphrase | OKX/Bitget 需要 |

**安全提示**：
- 只授予交易权限，禁用提现权限
- 建议设置 IP 白名单
- 教程链接

**已绑定列表**：
- 显示标签、交易所、创建时间
- 操作：验证状态、删除

#### 账单明细 `/wallet/billing`

| 类型 | 说明 |
|------|------|
| 充值 | 充值记录 |
| 提现 | 提现记录 |
| 订阅扣费 | VPS 月费 |
| 燃油费抽成 | 盈利抽成（20%） |
| 点卡消费 | 点卡使用记录 |

**筛选器**：时间范围、类型

---

### 3.6 用户端 - 生态中心 `/ecosystem`

#### 概览页 `/ecosystem`

```
┌────────────────────────────────────────────────────┐
│  生态中心                                          │
├────────────────────────────────────────────────────┤
│                                                    │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐  │
│  │  Q-Points   │ │  质押总额    │ │  待领奖励    │  │
│  │  25,000 点  │ │  $1,500     │ │  $45.67     │  │
│  │  ≈ $250     │ │  权重: 2.5x │ │  [ 领取 ]    │  │
│  └─────────────┘ └─────────────┘ └─────────────┘  │
│                                                    │
│  ┌───────────────────────┐ ┌───────────────────┐  │
│  │  快捷入口              │ │  收益来源          │  │
│  │  [ 去质押 ]           │ │  交易挖矿: 60%     │  │
│  │  [ 积分兑换 ]          │ │  质押分红: 30%     │  │
│  │  [ 查看排行榜 ]        │ │  邀请返佣: 10%     │  │
│  └───────────────────────┘ └───────────────────┘  │
│                                                    │
│  ┌──────────────────────────────────────────────┐  │
│  │  释放进度                                      │  │
│  │  ─────────────────────────────────────────── │  │
│  │  订单#1  ████████░░  80%  剩余 18 天          │  │
│  │  订单#2  ████░░░░░░  40%  剩余 54 天          │  │
│  └──────────────────────────────────────────────┘  │
│                                                    │
└────────────────────────────────────────────────────┘
```

#### 质押大厅 `/gamefi/staking`

**双轨制展示**：

| 类型 | A 类（空投/积分） | B 类（本金购买） |
|------|-------------------|------------------|
| 资金来源 | 活动赠送/挖矿 | USDT 购买 |
| 提前解押惩罚 | 扣除 50% 本金（销毁） | 扣累计收益 + 3% 手续费 |
| 权重乘数 | 固定 1.0x | 1.0x - 3.0x（随时间递增） |

**质押表单**：
- 选择类型（A/B）
- 输入金额
- 选择锁定期（30/60/90/180天）
- 显示预估权重
- 确认质押

**我的质押列表**：
- 类型、金额、权重、解锁时间、状态
- 操作：领取奖励、解除质押

#### 积分兑换 `/gamefi/exchange`

**兑换模式**：

| 模式 | 说明 |
|------|------|
| 标准模式 | 20% 立即释放 + 80% 在 90 天内线性释放 |
| 急速模式 | 立即获得 50%，剩余 50% 直接销毁 |

**兑换表单**：
- 输入 Q-Points 数量
- 选择模式
- 显示预估获得 $QFI
- 确认兑换

#### 释放进度 `/gamefi/vesting`

每笔兑换订单独立显示：
- 订单 ID
- 总数量
- 已释放 / 待释放
- 进度条
- 下次释放时间
- 下次释放数量

#### 排行榜 `/gamefi/leaderboard`

| 列 | 说明 |
|----|------|
| 排名 | 1-100 |
| 用户 | 脱敏 ID（如 abc***xyz） |
| 总积分 | Q-Points 总量 |
| 质押权重 | 权重乘数 |
| 奖励 | 周期奖励 |

---

### 3.7 用户端 - 设置 `/settings`

#### 账户设置 `/settings`

| 项目 | 操作 |
|------|------|
| 邮箱 | 显示当前邮箱 + 修改 |
| 密码 | 修改密码 |
| 昵称 | 设置昵称 |
| 头像 | 上传头像 |
| 语言 | 中文/English |

#### 安全设置 `/settings/security`

| 项目 | 操作 |
|------|------|
| 登录密码 | 修改密码 |
| 2FA | 绑定 Google Authenticator |
| 登录日志 | 查看最近登录记录（IP、设备、时间） |
| 设备管理 | 查看已登录设备，远程登出 |

#### 币种黑名单 `/settings/blacklist`

- 多选列表：显示所有可交易币种
- 已加入黑名单的币种不会被策略交易
- 常见高风险币种提示（如 LUNA、TRX）

#### 紧急按钮 `/settings/panic`

```
┌────────────────────────────────────────────────────┐
│  ⚠️ 紧急操作                                        │
├────────────────────────────────────────────────────┤
│                                                    │
│  ┌──────────────────────────────────────────────┐  │
│  │                                               │  │
│  │           🔴 一键清仓 (Panic Sell)             │  │
│  │                                               │  │
│  │      将所有持仓立即卖出，全部换成 USDT         │  │
│  │                                               │  │
│  │              [ 执行清仓 ]                      │  │
│  │                                               │  │
│  └──────────────────────────────────────────────┘  │
│                                                    │
│  ⚠️ 警告：此操作不可撤销，请谨慎使用                 │
│                                                    │
│  ┌──────────────────────────────────────────────┐  │
│  │  紧急停止机器人                                │  │
│  │  停止所有自动交易，保持当前持仓                 │  │
│  │              [ 紧急停止 ]                      │  │
│  └──────────────────────────────────────────────┘  │
│                                                    │
└────────────────────────────────────────────────────┘
```

**二次确认**：执行前弹窗要求输入密码或 2FA 验证

---

### 3.8 代理商后台 `/agent`

#### 概览 `/agent`

| 卡片 | 内容 |
|------|------|
| 下级总数 | 直推 + 间推 |
| 累计佣金 | 总返佣金额 |
| 本月佣金 | 本月返佣 |
| 可提现 | 可提现余额 |

#### 推广工具 `/agent/promotion`

| 工具 | 说明 |
|------|------|
| 邀请链接 | 专属链接 + 复制按钮 |
| 邀请码 | 专属邀请码 + 复制按钮 |
| 海报生成 | 选择模板 -> 生成带二维码海报 -> 下载 |
| 二维码 | 独立二维码下载 |

#### 业绩报表 `/agent/performance`

| 数据 | 说明 |
|------|------|
| 返佣曲线图 | 日/周/月返佣趋势 |
| 下级贡献 | 各下级贡献的佣金排行 |
| 转化率 | 注册/激活/付费转化率 |

#### 下级管理 `/agent/referrals`

| 列 | 说明 |
|----|------|
| 用户 ID | 脱敏显示 |
| 注册时间 | 注册日期 |
| 状态 | 未激活/已激活/VIP |
| 累计贡献 | 产生的佣金总额 |
| 最近活跃 | 最后登录时间 |

#### 佣金明细 `/agent/commissions`

| 列 | 说明 |
|----|------|
| 时间 | 产生时间 |
| 下级 | 贡献用户（脱敏） |
| 类型 | 订阅返佣/交易返佣 |
| 金额 | 返佣金额 |
| 状态 | 已结算/待结算 |

#### 佣金提现 `/agent/withdraw`

- 可提现余额
- 提现表单（金额、地址、链类型）
- 提现记录

---

### 3.9 管理后台 `/admin`

#### 概览 `/admin`

| 卡片 | 内容 |
|------|------|
| 今日新增用户 | 数量 + 趋势 |
| 活跃 VPS | 运行中的实例数 |
| 今日收入 | 总收入 |
| 待审核提现 | 待处理数量 |

#### 用户管理 `/admin/users`

**列表页**：
- 搜索：邮箱、用户ID
- 筛选：VIP等级、状态、注册时间
- 操作：查看详情、封号、重置密码

**详情页** `/admin/users/[id]`：
- 用户信息：邮箱、VIP、注册时间
- 资产信息：余额、冻结、点卡
- VPS 状态：运行/停止、IP
- 交易记录：最近交易
- 操作：封号、重置密码、重置API Key、强制登出

#### VPS 全网监控 `/admin/instances`

| 列 | 说明 |
|----|------|
| 实例 ID | VPS ID |
| 用户 | 所属用户 |
| IP | 公网 IP |
| 状态 | 运行/停止/异常/僵尸 |
| CPU | 使用率 |
| 内存 | 使用率 |
| 最后心跳 | 最后心跳时间 |
| 操作 | 停止/销毁 |

**僵尸节点检测**：15分钟无心跳自动标记

**Kill Switch**：
```
┌─────────────────────────────────────┐
│  🔴 全网紧急停机 (Kill Switch)       │
│                                      │
│  停止全网所有机器人开单               │
│  已运行持仓保留，新订单全部暂停        │
│                                      │
│  [ 执行全网停机 ]                     │
│                                      │
│  ⚠️ 需要管理员二次验证                │
└─────────────────────────────────────┘
```

#### 财务审计 `/admin/finance`

**收支报表**：
- 今日/本周/本月/自定义时间
- 收入：订阅费、燃油费抽成
- 支出：VPS成本、提现
- 利润：净利润

**收入分配**：
- 40% 运营成本
- 40% 回购奖励池（50%销毁 + 50%分红）
- 20% 风险储备金

**提现审核** `/admin/finance/withdrawals`：
- 待审核列表
- 用户信息、金额、地址
- 操作：通过（填写TxHash）、拒绝（填写原因）

#### 策略管理 `/admin/strategies`

- 官方策略列表
- 上传新策略（.py 文件）
- 更新策略版本
- 启用/禁用策略

#### 公告管理 `/admin/announcements`

- 公告列表
- 新建公告（标题、内容、类型、有效期）
- 编辑/删除/置顶

---

## 四、组件库详细清单

### 4.1 基础 UI 组件 `/components/ui/`

| 组件 | 变体 | Props |
|------|------|-------|
| Button | primary / secondary / danger / ghost / link | size, loading, disabled, icon |
| Input | text / password / number / search | label, error, prefix, suffix |
| Select | single / multi | options, placeholder, searchable |
| Checkbox | - | checked, indeterminate, label |
| Switch | - | checked, size, label |
| Radio | - | options, value |
| Textarea | - | rows, maxLength |
| Card | - | title, actions, loading |
| Modal | - | open, onClose, title, size |
| Drawer | left / right / bottom | open, onClose, title |
| Tabs | line / card | items, activeKey |
| Table | - | columns, data, loading, pagination |
| Badge | status / count / dot | color, size |
| Avatar | - | src, name, size |
| Tooltip | - | content, placement |
| Toast | success / error / warning / info | duration, action |
| Skeleton | text / avatar / card / table | loading |
| Spinner | - | size, color |
| Progress | line / circle | percent, status |
| Empty | - | description, action |
| Alert | success / error / warning / info | title, closable |
| Dropdown | - | items, trigger |
| Popover | - | content, trigger, placement |
| DatePicker | date / range | format, disabledDate |
| Pagination | - | total, current, pageSize |
| Breadcrumb | - | items |
| Steps | - | current, items |
| Tag | - | color, closable |
| Divider | horizontal / vertical | text |

### 4.2 布局组件 `/components/layout/`

| 组件 | 说明 |
|------|------|
| AppLayout | 根布局（含全局 Provider） |
| DashboardLayout | 用户端布局（Sidebar + Header + Content） |
| AdminLayout | 管理后台布局 |
| Header | 顶部导航栏 |
| Sidebar | 侧边栏导航（桌面端） |
| MobileNav | 底部导航（移动端，5个Tab） |
| PageContainer | 页面容器（含标题、面包屑） |
| AuthGuard | 认证守卫 |
| RoleGuard | 权限守卫 |

### 4.3 图表组件 `/components/charts/`

| 组件 | 库 | 用途 |
|------|-----|------|
| PnLCurve | Recharts | 收益曲线（折线图） |
| AssetPie | Recharts | 资产分布（饼图） |
| BarChart | Recharts | 柱状图（日收益） |
| AreaChart | Recharts | 面积图（累计收益） |
| ProgressRing | CSS | 环形进度（释放进度） |
| MiniChart | Recharts | 迷你图（卡片内嵌） |

### 4.4 表单组件 `/components/forms/`

| 组件 | 字段 |
|------|------|
| LoginForm | email, password |
| RegisterForm | email, password, confirmPassword, inviteCode, agreement |
| DepositForm | chain, amount |
| WithdrawForm | amount, chain, address, 2fa |
| ApiKeyForm | exchange, label, apiKey, secret, passphrase |
| StrategyConfigForm | amount, stopLoss, leverage |
| StakeForm | type, amount, lockDays |
| ExchangeForm | points, mode |
| BacktestForm | strategy, dateRange, capital, pairs |
| PanicConfirmForm | password / 2fa |

### 4.5 业务功能组件 `/components/features/`

**dashboard/**
- AssetCard - 资产卡片（总资产/盈亏/点卡）
- PnLSummary - 盈亏摘要
- BotStatusCard - 机器人状态（含启停按钮）
- VpsStatusCard - VPS 资源监控
- PositionList - 持仓列表
- AnnouncementMarquee - 公告跑马灯
- QuickActions - 快捷操作栏

**strategies/**
- StrategyCard - 策略卡片
- StrategyDetail - 策略详情
- StrategyConfigPanel - 策略配置面板
- BacktestResult - 回测结果
- RiskBadge - 风险等级徽章
- StrategyTags - 策略标签

**trading/**
- TradingControlPanel - 交易控制面板
- LogStream - 实时日志流（WebSocket）
- TradeHistoryTable - 交易历史表格
- BacktestReportCard - 回测报告卡片
- PanicButton - 紧急平仓按钮
- AiInsight - AI 解读卡片

**wallet/**
- BalanceCard - 余额卡片
- DepositAddress - 充值地址（含二维码）
- WithdrawForm - 提现表单
- TransactionList - 交易记录列表
- ApiKeyList - API Key 列表
- BillingTable - 账单表格

**gamefi/**
- PointsCard - 积分卡片
- StakingPoolCard - 质押池卡片
- StakeItem - 我的质押项
- VestingProgressBar - 释放进度条
- VestingOrderList - 释放订单列表
- ExchangePanel - 兑换面板
- LeaderboardTable - 排行榜表格

**instances/**
- InstanceCard - 实例卡片
- InstanceMetrics - 实例指标（CPU/内存）
- InstanceLogs - 实例日志
- BackupList - 备份列表

**agent/**
- InviteLinkCard - 邀请链接卡片
- InviteCodeCard - 邀请码卡片
- PosterGenerator - 海报生成器
- ReferralTable - 下级表格
- CommissionChart - 返佣曲线图
- CommissionTable - 佣金明细表

**admin/**
- UserTable - 用户管理表格
- UserDetailCard - 用户详情卡片
- InstanceMonitorTable - VPS 监控表格
- WithdrawalReviewTable - 提现审核表格
- RevenueChart - 收支图表
- KillSwitchPanel - 全网停机面板
- AnnouncementForm - 公告表单

---

## 五、状态管理

### 5.1 Zustand Stores

```typescript
// stores/auth.store.ts
interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  role: 'user' | 'agent' | 'admin';
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
}

// stores/wallet.store.ts
interface WalletState {
  balance: string;
  frozenBalance: string;
  pointBalance: string;
  transactions: Transaction[];
  fetchWallet: () => Promise<void>;
}

// stores/trading.store.ts
interface TradingState {
  botStatus: 'running' | 'stopped' | 'error';
  currentStrategy: Strategy | null;
  positions: Position[];
  logs: LogEntry[];
  startBot: () => Promise<void>;
  stopBot: () => Promise<void>;
  panicSell: () => Promise<void>;
}

// stores/ecosystem.store.ts (原 gamefi.store.ts)
interface EcosystemState {
  points: string;
  stakes: Stake[];
  vestingOrders: VestingOrder[];
  pendingRewards: string;
  fetchEcosystem: () => Promise<void>;
}

// stores/ui.store.ts
interface UIState {
  sidebarOpen: boolean;
  theme: 'dark' | 'light';
  notifications: Notification[];
  toggleSidebar: () => void;
  addNotification: (n: Notification) => void;
}
```

### 5.2 React Query Keys

```typescript
const queryKeys = {
  // 用户
  user: ['user'],
  wallet: ['wallet'],

  // 交易
  positions: ['positions'],
  trades: (filters) => ['trades', filters],
  botStatus: ['botStatus'],

  // 策略
  strategies: ['strategies'],
  strategy: (id) => ['strategy', id],
  myStrategies: ['myStrategies'],

  // 生态中心 (Ecosystem)
  stakes: ['stakes'],
  vestingOrders: ['vestingOrders'],
  leaderboard: ['leaderboard'],

  // 实例
  instances: ['instances'],
  instance: (id) => ['instance', id],

  // 管理后台
  adminUsers: (filters) => ['admin', 'users', filters],
  adminInstances: ['admin', 'instances'],
  adminWithdrawals: ['admin', 'withdrawals'],
};
```

---

## 六、交互规范

### 6.1 加载状态

| 场景 | 处理方式 |
|------|----------|
| 页面首次加载 | 全屏骨架屏 |
| 列表加载 | 表格骨架屏 |
| 按钮操作 | 按钮 loading 态 |
| 卡片刷新 | 卡片内 Spinner |

### 6.2 空状态

每个列表页必须有空状态：
- 插图 + 描述文案 + 引导按钮

### 6.3 错误处理

| 错误类型 | 处理方式 |
|----------|----------|
| 网络错误 | Toast 提示 + 重试按钮 |
| 401 未授权 | 跳转登录页 |
| 403 无权限 | 显示无权限页面 |
| 404 未找到 | 显示 404 页面 |
| 表单错误 | 字段下方红色提示 |
| 业务错误 | Toast 提示具体信息 |

### 6.4 确认操作

以下操作必须二次确认：
- 删除 API Key
- 提现
- 紧急平仓
- 解除质押
- 封号用户
- 全网停机

确认方式：Modal + 密码/2FA

### 6.5 实时更新

| 数据 | 更新方式 |
|------|----------|
| 交易日志 | WebSocket 实时推送 |
| 持仓盈亏 | 10秒轮询 |
| VPS 状态 | 30秒轮询 |
| 余额 | 操作后刷新 |

---

## 七、移动端适配

### 7.1 底部导航 (MobileNav)

5 个 Tab：

| Tab | 图标 | 路由 |
|-----|------|------|
| 首页 | Home | /dashboard |
| 交易 | TrendingUp | /trading |
| 策略 | Zap | /strategies |
| 资产 | Wallet | /wallet |
| 我的 | User | /settings |

### 7.2 移动端特殊处理

- 表格 -> 卡片列表
- 侧边栏 -> 抽屉
- 复杂表单 -> 分步表单
- 图表 -> 简化版/全屏

---

## 八、开发检查清单

新增页面时，必须确保：

- [ ] 路由符合本文档定义
- [ ] 组件放在正确的目录
- [ ] 使用现有 UI 组件，不重复造轮子
- [ ] 遵循命名规范（kebab-case 文件，PascalCase 组件）
- [ ] 处理 Loading 状态（骨架屏）
- [ ] 处理 Empty 状态（空状态插图）
- [ ] 处理 Error 状态（错误提示）
- [ ] 移动端响应式适配
- [ ] 关键操作有确认弹窗
- [ ] 表单有完整验证
- [ ] 敏感操作有二次验证

---

## 九、文件引用规范

```typescript
// 从 ui 导入基础组件
import { Button, Card, Input, Modal } from '@/components/ui';

// 从 features 导入业务组件
import { AssetCard, BotStatusCard } from '@/components/features/dashboard';

// 从 hooks 导入 hooks
import { useAuth, useWallet, useTrading } from '@/hooks';

// 从 stores 导入状态
import { useAuthStore, useTradingStore } from '@/stores';

// 从 lib 导入工具
import { api, formatCurrency, formatDate } from '@/lib';

// 从 types 导入类型
import type { User, Strategy, Position } from '@/types';
```

---

*本文档为 QuantFi 前端开发的唯一权威规范，所有 UI 开发必须严格遵循。*
