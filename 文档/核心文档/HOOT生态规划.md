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

**空投规则**：
| 行为 | $HOOT 数量 | 说明 |
|------|-----------|------|
| 注册 | +100 | 一次性 |
| 绑定 TG | +50 | 一次性 |
| 邀请用户 | +200 | 被邀请人完成注册 |
| 盈利交易 | +盈利×10 | 盈利 1 USDT = 10 HOOT |
| 每日签到 | +10~100 | 连续签到递增 |

**释放机制（Vesting）**：
| 参数 | 数值 | 说明 |
|------|------|------|
| 释放周期 | 30-90 天 | 线性释放 |
| 释放方式 | 每日释放 | 链下记录 |
| 最低提现 | 100 HOOT | 约 $0.1 |
| 提现手续费 | 5% 或平台代付 | Gas 费用 |

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

## 九、参考资源

- [TON 官方文档](https://docs.ton.org/)
- [TON Connect](https://docs.ton.org/develop/dapps/ton-connect/overview)
- [Telegram Mini Apps](https://core.telegram.org/bots/webapps)
- [Privy 文档](https://docs.privy.io/)
- [Resend 邮件服务](https://resend.com/docs)

---

*文档维护：持续更新中*
