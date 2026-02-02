# HOOT 产品需求规划

> 更新日期：2026-01-31
> 版本：v1.0

---

## 一、项目概述

**产品名称**：HOOT
**中文昵称**：圆圆 (Yuányuán)
**定位**：AI 量化交易平台，主打 Telegram 生态
**域名**：hoot.cool ✅ 已购买
**代币**：$HOOT（规划中）

**品牌调性**：
> "看起来呆呆的，实际上很 cool 地帮你赚钱"

---

## 二、链与代币策略

### 2.1 主链选择：TON

| 评估维度 | TON | Base | Solana |
|---------|-----|------|--------|
| TG 集成度 | ⭐⭐⭐⭐⭐ 原生 | ⭐ 无 | ⭐⭐ 需外部钱包 |
| Gas 费用 | ~$0.01 极低 | ~$0.05 中等 | ~$0.001 极低 |
| 用户门槛 | 零门槛 | 需装 MetaMask | 需装 Phantom |
| 目标用户契合度 | TG 用户完美适配 | EVM 原住民 | DeFi 玩家 |

**决策**：$HOOT 主代币发行在 **TON 链**

**理由**：
1. Telegram 官方区块链，钱包内置于 TG
2. 用户无需安装任何钱包 App
3. @wallet 机器人直接收发代币
4. TON Connect 一键授权
5. 完美适配 TG Mini App 生态

### 2.2 多链扩展策略

**担忧**：只做 TON 会错过 Base/ETH 等 EVM 生态用户

**解决方案**：账户抽象 + 跨链桥

```
阶段 1 (MVP)     : TON 链 + 积分系统
阶段 2 (增长期)  : 发行 $HOOT + Base 跨链桥
阶段 3 (成熟期)  : 多链 DEX 上线
```

### 2.3 代币经济模型

**基础参数**：
| 参数 | 数值 | 说明 |
|------|------|------|
| 代币名称 | $HOOT | TON 链 Jetton |
| 总供应量 | 100,000,000 | 1亿枚 |
| 发行价格 | $0.001 | FDV $100,000 |
| 初始流动性 | $3,000-5,000 | TON/HOOT 交易对 |

**代币分配**：
| 分配 | 数量 | 占比 | 说明 |
|------|------|------|------|
| 空投池 | 10,000,000 | 10% | 用户空投奖励 |
| 团队 | 20,000,000 | 20% | 12个月线性释放 |
| 生态基金 | 30,000,000 | 30% | 市场/合作/激励 |
| 流动性 | 10,000,000 | 10% | DEX 交易对 |
| 储备 | 30,000,000 | 30% | 未来发展储备 |

### 2.4 空投系统（链下代币）

**策略**：直接发 $HOOT 代币，但链下记录，3个月后统一上链

**为什么链下先行？**
- 用户立即获得代币奖励感知
- 灵活调整空投规则
- 3个月后上链，用户可提取到 TON 钱包
- 避免早期频繁链上交互的 Gas 成本

**空投规则 v3**（基于行业标准研究优化）：
| 行为 | $HOOT 数量 | 说明 | 终身上限 |
|------|-----------|------|---------|
| 注册 | +50 | 一次性，需完成验证 | 50 |
| 绑定 TG | +10 | 一次性 | 10 |
| 绑定钱包 | +10 | 一次性 | 10 |
| 绑定邮箱 | +15 | 一次性，需邮箱验证 | 15 |
| 邀请用户 | +25 | 每成功邀请 1 人 | 2,000 (约 80 人) |
| 盈利交易 | +盈利×3 | 盈利 1 USDT = 3 HOOT | 1,000 |
| 每日签到 | +3~15 | 连续签到递增，每天+2 | 500 |

**单用户终身最大**: 3,585 HOOT（参考 Binance 4% 上限原则）

**防滥用上限配置**（每日 + 终身双重限制）：

| 类型 | 每日上限 | 终身上限 | 说明 |
|------|---------|---------|------|
| 签到 | 15 HOOT | 500 HOOT | 连续签到最高 15/天 |
| 推荐 | 250 HOOT | 2,000 HOOT | 约 10 人/天，80 人终身 |
| 交易盈利 | 50 HOOT | 1,000 HOOT | 防止刷量套利 |

**释放机制（Vesting）v3**：
| 参数 | 数值 | 说明 |
|------|------|------|
| 释放周期 | 90 天 | 统一线性释放（行业标准 6-12 月，取中值平衡体验） |
| 锁定期 | 7 天 cliff | 防止立即提现套利 |
| 释放方式 | 每日释放 | 链下记录 |
| 最低提现 | 100 HOOT | 约 $0.1 |
| 提现手续费 | 5% 销毁 | 通缩机制 |

**状态流转**：
```
用户行为 → 空投记录(pending) → 确认(confirmed) → 每日释放(vesting)
                                                      ↓
                                            可用余额(available)
                                                      ↓
                                    上链后提取(onchain) → TON 钱包
```

**余额字段设计**：
- `hootBalance`: 总余额（锁定 + 可用）
- `lockedBalance`: 锁定余额（释放中）
- `availableBalance`: 可用余额（可提取）

---

## 三、用户认证系统

### 3.1 核心方案：Privy 账户抽象

**选择 Privy 的理由**：
- 一套代码实现 TG + 钱包 + 邮箱登录
- 自动创建 Embedded Wallet（多链）
- 用户无感知，零门槛

**用户登录后自动拥有**：
- TON 地址（TG 生态）
- EVM 地址（Base/ETH 共用）
- Solana 地址（可选）

### 3.2 登录方式分层

| 用户类型 | 预估占比 | 登录方式 | 钱包类型 |
|---------|---------|---------|---------|
| TG 小白用户 | 70% | TG 一键登录 | Embedded（自动创建）|
| Crypto 原住民 | 30% | 连接外部钱包 | External（MetaMask 等）|

### 3.3 登录 UI 设计

**TG Mini App 内**：
- 自动登录，不显示任何选项
- 用户打开即登录完成

**网页端**：
```
┌─────────────────────────────────────┐
│         欢迎来到 HOOT 🦉            │
│                                     │
│  ┌─────────────────────────────┐   │
│  │  📱 用 Telegram 继续        │   │  ← 主推，最大按钮
│  └─────────────────────────────┘   │
│                                     │
│         ─── 或者 ───                │
│                                     │
│  ┌─────────────┐ ┌─────────────┐   │
│  │ 🦊 钱包登录  │ │ 📧 邮箱登录  │   │  ← 次要选项
│  └─────────────┘ └─────────────┘   │
└─────────────────────────────────────┘
```

### 3.4 钱包登录保留原因

1. **不丢用户** - Crypto 玩家习惯用自己钱包
2. **资产安全感** - 有些人不信任托管钱包
3. **账户合并** - 用户可后期绑定 TG ↔ 外部钱包
4. **空投场景** - 用户想用特定地址接收空投

### 3.5 账户模型设计

```typescript
interface User {
  id: string;

  // 登录方式（可多个）
  telegramId?: string;
  email?: string;

  // 钱包地址
  wallets: {
    ton?: string;         // TON 链地址
    evm?: string;         // EVM 链地址 (Base/ETH)
    embedded?: string;    // Privy 自动创建的托管钱包
    external?: string[];  // 用户连接的外部钱包
  };

  // 主钱包（用于收款/空投）
  primaryWallet: string;

  // 积分系统
  points: number;
  pointsHistory: PointTransaction[];
}
```

---

## 四、TG Mini App 集成

### 4.1 用户认证流程

```
用户点击 Mini App
       ↓
TG 自动注入用户信息 (initData)
       ↓
后端验证签名
       ↓
Privy 创建/关联账户
       ↓
自动生成多链钱包
       ↓
用户直接使用（0 步骤注册）
```

### 4.2 TG WebApp 数据获取

```typescript
// 前端获取用户信息
const tg = window.Telegram.WebApp;

const user = tg.initDataUnsafe.user;
// user.id          → 123456789 (唯一标识)
// user.first_name  → "John"
// user.username    → "john_doe"
// user.language_code → "zh-hans"

// 签名数据发送到后端验证
const initData = tg.initData;
```

### 4.3 后端签名验证

```typescript
import crypto from 'crypto';

function verifyTelegramAuth(initData: string, botToken: string): boolean {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  params.delete('hash');

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(botToken)
    .digest();

  const calculatedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  return calculatedHash === hash;
}
```

---

## 五、技术栈规划

### 5.1 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                    HOOT 技术架构                             │
├─────────────────────────────────────────────────────────────┤
│  前端       : TG Mini App (React/Next.js)                   │
│  认证       : Privy + Telegram WebApp API                   │
│  钱包连接   : TON Connect + Privy Embedded                  │
│  主链       : TON                                            │
│  扩展链     : Base (EVM)                                     │
│  后端       : NestJS API                                     │
│  数据库     : PostgreSQL + Redis                             │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 核心依赖

```bash
# TON 相关
@tonconnect/ui-react
@ton/ton

# TG Mini App
@twa-dev/sdk

# 账户抽象
@privy-io/react-auth

# 邮件服务
resend
```

---

## 六、开发阶段规划

### Phase 1: MVP（1-2 个月）

- [ ] TG Mini App 基础框架
- [ ] Privy 集成（TG 登录 + Embedded Wallet）
- [ ] 积分系统（代币前身）
- [ ] TON Connect 钱包连接
- [ ] 基础交易功能

### Phase 2: 增长期（3-6 个月）

- [ ] 发行 $HOOT 代币（TON 链）
- [ ] 积分兑换代币功能
- [ ] Base 跨链桥集成
- [ ] 外部钱包登录支持
- [ ] 账户合并功能

### Phase 3: 成熟期（6 个月+）

- [ ] 多链 DEX 上线
- [ ] 治理代币功能
- [ ] DAO 投票机制
- [ ] 更多链扩展

---

## 七、待完成事项

### 基础设施
- [ ] Resend 邮件域名配置（hoot.cool）
- [ ] Privy 账户注册与配置
- [ ] TG Bot 创建与配置
- [ ] TON 钱包服务搭建

### 设计资产
- [x] 域名：hoot.cool
- [x] Token Logo：已选定
- [x] App Logo：已选定
- [ ] TG Mini App 图标
- [ ] 品牌设计规范文档

---

## 八、关键决策记录

| 日期 | 决策 | 理由 |
|------|------|------|
| 2026-01-30 | 品牌从 KOALA 改为 HOOT | 猫头鹰形象更适合金融 + 夜间交易 |
| 2026-01-31 | 域名选择 hoot.cool | 短、好记、契合品牌调性 |
| 2026-01-31 | 主链选择 TON | TG 原生集成，用户零门槛 |
| 2026-01-31 | 采用 Privy 账户抽象 | 一套代码实现多登录方式 + 多链钱包 |
| 2026-01-31 | 先积分后代币 | 降低合规风险，验证需求后再发币 |
| 2026-01-31 | 保留钱包登录选项 | 不丢失 Crypto 原住民用户 |

---

## 九、代理商代币收益系统

> 更新日期：2026-02-02
> 版本：v1.0

### 9.1 收益结构总览

代理商收益 = **法币分成** + **代币配额收益** + **代币分红收益**

```
┌─────────────────────────────────────────────────────────────┐
│  代理商收益体系                                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  收益 1：法币分成（已有，持续性）                             │
│  ├── 订阅费分成（用户订阅策略费用的 10-30%）                  │
│  └── 燃油费分成（用户交易燃油费的 10-30%）                    │
│                                                             │
│  收益 2：私募配额（一次性）⭐                                 │
│  ├── 以折扣价购买 $HOOT                                     │
│  ├── 锁仓 6-12 个月线性释放                                  │
│  └── 代币升值 → 代理自然获利                                 │
│                                                             │
│  收益 3：交易分红池（持续性）⭐                               │
│  ├── 平台手续费 10% 进入代理分红池                           │
│  ├── 每月回购 $HOOT 分给代理                                 │
│  └── 按代理贡献的用户交易量比例分配                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 9.2 私募配额方案

**核心思路**：让代理商低价买币，涨了自然赚

| 代理等级 | 配额上限 | 折扣价 | 锁仓条件 | 业绩要求 |
|---------|---------|--------|---------|---------|
| 普通代理 (bronze) | 50 万 HOOT | 7折 ($0.0007) | 6个月线性释放 | 10 付费用户 |
| 银牌代理 (silver) | 200 万 HOOT | 5折 ($0.0005) | 6个月线性释放 | 50 付费用户 |
| 金牌代理 (gold) | 500 万 HOOT | 3折 ($0.0003) | 9个月线性释放 | 200 付费用户 |
| 钻石代理 (platinum) | 1000 万 HOOT | 2折 ($0.0002) | 12个月线性释放 | 500 付费用户 |

**收益示例**（金牌代理）：
```
私募配额 500万 HOOT × 3折（$0.0003）= 投入 $1,500
代币涨到 $0.01 → 价值 $50,000 → 利润 $48,500 ✅
```

**配额规则**：
- 配额不可转让，仅限代理本人使用
- 未达业绩要求，未释放部分收回
- 代理退出，未释放部分收回
- 每季度评估业绩，调整配额等级

### 9.3 交易分红池方案

**核心思路**：平台手续费的一部分，回购 HOOT 分给代理

```
用户交易 → 平台收手续费（燃油费）
                ↓
          燃油费的 10% 进入「代理分红池」
                ↓
          每月末结算，回购 $HOOT
                ↓
          按代理贡献比例分配

例如：
平台月燃油费收入 $10,000
  → 10% = $1,000 进入代理分红池
  → 回购等值 $HOOT
  → 代理 A 贡献了 30% 的用户交易量
  → 代理 A 拿到 $300 等值的 HOOT
```

**分红池参数**：
| 参数 | 数值 | 说明 |
|------|------|------|
| 池子来源 | 燃油费 10% | 每笔盈利交易的燃油费 |
| 结算周期 | 每月 | 月末计算，次月初发放 |
| 分配方式 | 按贡献比例 | 代理下属用户交易量占比 |
| 最低发放 | 100 HOOT | 不足则累计到下月 |
| 释放方式 | 立即可用 | 无锁仓期 |

### 9.4 数据库设计

```sql
-- 代理商私募配额
CREATE TABLE agent_token_quotas (
  id UUID PRIMARY KEY,
  agent_id UUID REFERENCES agents(id),

  -- 配额信息
  level VARCHAR(20),           -- bronze, silver, gold, platinum
  quota_amount DECIMAL(18,8),  -- 配额数量
  purchase_price DECIMAL(18,8), -- 购买单价
  purchase_amount DECIMAL(18,8), -- 购买金额

  -- 释放配置
  vesting_months INT,          -- 释放周期（月）
  vesting_start TIMESTAMP,     -- 开始释放时间
  released_amount DECIMAL(18,8) DEFAULT 0, -- 已释放数量

  -- 状态
  status VARCHAR(20),          -- pending, active, completed, revoked

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP
);

-- 代理商分红池
CREATE TABLE agent_dividend_pools (
  id UUID PRIMARY KEY,

  -- 周期
  period_start TIMESTAMP,
  period_end TIMESTAMP,
  month_number VARCHAR(7),     -- 2026-02

  -- 池子金额
  gas_fee_total DECIMAL(18,8), -- 本月燃油费总额
  pool_rate DECIMAL(5,4),      -- 进入池子比例（如 0.10 = 10%）
  pool_amount DECIMAL(18,8),   -- 池子金额

  -- 回购信息
  hoot_price DECIMAL(18,8),    -- 回购均价
  hoot_amount DECIMAL(18,8),   -- 回购 HOOT 数量

  -- 分配
  distributed_amount DECIMAL(18,8) DEFAULT 0,

  status VARCHAR(20),          -- collecting, pending, distributed
  distributed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 代理商分红记录
CREATE TABLE agent_dividend_records (
  id UUID PRIMARY KEY,
  pool_id UUID REFERENCES agent_dividend_pools(id),
  agent_id UUID REFERENCES agents(id),

  -- 贡献数据
  user_trade_volume DECIMAL(18,8),  -- 下属用户交易量
  contribution_rate DECIMAL(10,8),   -- 贡献比例

  -- 分红金额
  dividend_amount DECIMAL(18,8),     -- 分红 HOOT 数量

  status VARCHAR(20),                -- pending, paid
  paid_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 9.5 代理后台展示

```
┌─────────────────────────────────────┐
│  🪙 代币资产                        │
│                                     │
│  私募配额    5,000,000 HOOT         │
│  ├── 已释放   2,000,000             │
│  ├── 释放中   3,000,000             │
│  └── 当前价值  $50,000              │
│                                     │
│  分红累计    125,000 HOOT           │
│  ├── 本月分红  30,000               │
│  └── 当前价值  $1,250               │
│                                     │
│  总代币价值   $51,250               │
│  总投入成本   $1,500                │
│  收益率       3316% 📈              │
└─────────────────────────────────────┘
```

### 9.6 关键规则

| 规则 | 说明 | 原因 |
|------|------|------|
| **必须锁仓** | 6-12个月线性释放 | 防代理拿完就砸盘 |
| **业绩绑定** | 未达标扣回未释放部分 | 防止拿了币不干活 |
| **禁止转让** | 配额不可转给他人 | 防炒配额 |
| **退出机制** | 代理退出，未释放部分收回 | 保护项目 |
| **最低门槛** | 必须有付费用户才能购买配额 | 确保真实代理 |

### 9.7 代理完整收益示例

```
代理商 A（金牌）

一次性收益：
  私募配额 500万 HOOT × 3折（$0.0003）= 投入 $1,500
  代币涨到 $0.01 → 价值 $50,000 → 利润 $48,500 ✅

持续性收益（每月）：
  订阅费分成         $800
  燃油费分成         $400
  代币分红           $300 等值 HOOT
  ──────────────────────
  月收入             $1,500 + HOOT 增值
```

---

## 十、链上升级路径

### 10.1 空投释放系统升级

当前采用链下方案，后期无缝升级到链上：

```
阶段 1（当前-链下）：
┌───────────────────────────────────┐
│ (🦉) HOOT 释放中          7,550  │
│      空投锁仓 · 每日释放          │
└───────────────────────────────────┘
  - 数据存储：PostgreSQL 数据库
  - 提现方式：后台热钱包转币
  - 优点：灵活、低成本、便于调试

阶段 2（未来-链上）：
┌───────────────────────────────────┐
│ (🦉) HOOT 释放中          7,550  │
│      空投锁仓 · 每日释放          │
│      🔗 查看链上合约 ↗            │  ← 新增
└───────────────────────────────────┘
  - 数据来源：Vesting 智能合约
  - 领取方式：调用合约 Claim 方法
  - 优点：透明、去中心化、用户自主
```

### 10.2 升级步骤

1. **部署合约**：在 TON 链部署 Vesting 合约
2. **配置环境变量**：
   ```
   VESTING_CONTRACT_ADDRESS=EQ...xxx
   ENABLE_ONCHAIN_VESTING=true
   ```
3. **打开开关**：后台系统自动切换数据源
4. **UI 微调**：添加「查看链上合约」链接

### 10.3 用户体验

- **升级前后**：界面几乎无变化
- **用户感知**：无缝过渡，体验一致
- **新增价值**：透明可验证，增强信任

---

## 十一、参考资源

- [TON 官方文档](https://docs.ton.org/)
- [TON Connect](https://docs.ton.org/develop/dapps/ton-connect/overview)
- [Telegram Mini Apps](https://core.telegram.org/bots/webapps)
- [Privy 文档](https://docs.privy.io/)
- [Resend 邮件服务](https://resend.com/docs)

---

*文档维护：持续更新中*
