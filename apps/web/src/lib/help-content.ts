/**
 * 帮助文档内容
 * 商用级完整帮助文章 — 中英双语
 */

export interface HelpSection {
  titleZh: string
  titleEn: string
  contentZh: string
  contentEn: string
  type?: 'info' | 'warning' | 'success' | 'tip'
}

export interface HelpArticle {
  slug: string
  titleZh: string
  titleEn: string
  descriptionZh: string
  descriptionEn: string
  sections: HelpSection[]
}

// ============================================
// 1. 快速入门 / Getting Started
// ============================================
export const gettingStarted: HelpArticle = {
  slug: 'getting-started',
  titleZh: '快速入门指南',
  titleEn: 'Getting Started Guide',
  descriptionZh: '从零开始，5分钟掌握 Hoot AI 量化交易平台的核心功能',
  descriptionEn: 'Start from scratch and master Hoot AI quantitative trading platform in 5 minutes',
  sections: [
    {
      titleZh: '欢迎使用 Hoot',
      titleEn: 'Welcome to Hoot',
      contentZh: `Hoot 是一个由 AI 驱动的非托管量化交易平台，将机构级的量化策略带给每一位普通用户。

**核心价值主张：**

**AI 驱动决策** — 支持 Solo（极速）、Debate（共识）、Research（深研）、Grid（网格）四种 AI 交易模式，覆盖从高频短线到稳健网格的全场景需求。

**非托管架构** — 您的资金始终留在自己的交易所账户（如 Binance 合约账户），Hoot 通过 API 仅执行交易指令，无法提现或转移您的资金。这是行业内最安全的架构设计。

**燃油费模式（Gas Fee）** — 这是 Hoot 独创的计费模式：**只有盈利的交易才收取费用**，亏损交易一分不收。Free 用户燃油费率 25%，Pro 会员享 20% 优惠费率，还可通过质押 HOOT 代币进一步降低至最低 18%。

**多角色辩论系统** — 行业独创。在深研（Research）模式下，5 位 AI 分析师独立研究，5 个投资角色相互辩论，3 方风控专家最终裁决，确保每一笔交易都经过严格的多维度审查。

**注册即送 20 HOOT 代币**，可用于未来折扣、质押分红等生态权益。`,
      contentEn: `Hoot is an AI-powered, non-custodial quantitative trading platform that brings institutional-grade quant strategies to every user.

**Core Value Propositions:**

**AI-Driven Decision Making** — Supports four AI trading modes: Solo (speed), Debate (consensus), Research (deep analysis), and Grid — covering everything from high-frequency short-term to steady grid trading.

**Non-Custodial Architecture** — Your funds always remain in your own exchange account (e.g., Binance Futures). Hoot only executes trade instructions via API and cannot withdraw or transfer your assets. This is the safest architecture in the industry.

**Gas Fee Model** — Hoot's unique billing model: **fees are only charged on profitable trades**. Losing trades cost nothing. Free users pay 25% gas fee; Pro members enjoy a 20% discounted rate, which can be further reduced to as low as 18% by staking HOOT tokens.

**Multi-Role Debate System** — Industry-exclusive. In Research mode, 5 AI analysts research independently, 5 investment roles debate each other, and 3 risk control experts make the final ruling — ensuring every trade undergoes rigorous multi-dimensional review.

**New users receive 20 HOOT tokens upon registration**, redeemable for future discounts, staking dividends, and other ecosystem benefits.`,
    },
    {
      titleZh: '注册账户',
      titleEn: 'Create Your Account',
      contentZh: `Hoot 支持三种注册/登录方式，选择最适合您的方式即可。

**方式一：邮箱注册（推荐新手）**
1. 访问 Hoot 官网或打开 App
2. 点击「注册」
3. 输入邮箱地址（建议使用常用邮箱，用于接收交易通知）
4. 设置密码（至少 8 位，包含字母和数字）
5. 填写邀请码（如有）— 填写后双方均可获得奖励
6. 点击「注册」，查收邮件验证码并完成验证
7. 注册成功，自动到账 **20 HOOT** 新人奖励

**方式二：Web3 钱包登录**
- 支持 MetaMask、WalletConnect、Coinbase Wallet 等主流 EVM 钱包
- 点击「钱包登录」→ 连接钱包 → 签名验证（无需 Gas，仅签名）
- 适合已有加密钱包的用户，无需记忆密码

**方式三：Telegram 登录**
- 在 Telegram 中打开 @HootCool_bot
- 发送 /start，Bot 自动完成身份验证
- 适合 Telegram 深度用户，登录最快捷

**完善资料（建议）：**
- 绑定 Telegram → 获赠 10 HOOT + 接收实时交易通知
- 绑定钱包地址 → 获赠 10 HOOT + 未来链上功能权益
- 开启两步验证 2FA → 提升账户安全等级`,
      contentEn: `Hoot supports three registration/login methods — choose the one that suits you best.

**Method 1: Email Registration (Recommended for Beginners)**
1. Visit the Hoot website or open the App
2. Click "Register"
3. Enter your email address (use a frequently checked email for trade notifications)
4. Set a password (at least 8 characters, including letters and numbers)
5. Enter a referral code if you have one — both parties receive rewards
6. Click "Register", check your email for the verification code and complete verification
7. Registration successful — **20 HOOT** new user reward credited automatically

**Method 2: Web3 Wallet Login**
- Supports MetaMask, WalletConnect, Coinbase Wallet, and other mainstream EVM wallets
- Click "Wallet Login" → Connect wallet → Sign verification (no Gas required, signature only)
- Ideal for users who already have a crypto wallet — no password to remember

**Method 3: Telegram Login**
- Open @HootCool_bot in Telegram
- Send /start — the Bot handles authentication automatically
- Best for heavy Telegram users — fastest login method

**Profile Completion (Recommended):**
- Link Telegram → Earn 10 HOOT + receive real-time trade notifications
- Link wallet address → Earn 10 HOOT + future on-chain feature benefits
- Enable two-factor authentication (2FA) → Upgrade your account security level`,
    },
    {
      titleZh: '绑定交易所',
      titleEn: 'Connect Your Exchange',
      contentZh: `绑定交易所是开始 AI 交易的必要步骤。目前主要支持 **Binance 合约账户**。

**Binance 合约 API Key 创建步骤：**
1. 登录 Binance 官网 → 点击右上角头像 → 「API 管理」
2. 点击「创建 API」，选择「系统生成」
3. 为 API Key 命名（如：Hoot-Trading）
4. 完成安全验证（邮箱+手机双重验证）
5. **权限设置（关键）：**
   - ✅ 开启：读取权限
   - ✅ 开启：合约交易权限（Enable Futures）
   - ❌ 禁止：提现权限（Withdraw）— **必须关闭**
   - ❌ 禁止：现货交易（非必需）
6. 复制并妥善保存 API Key 和 Secret Key

**在 Hoot 中绑定：**
1. 进入 Hoot → 钱包 → 交易所 → 添加
2. 选择「Binance 合约」
3. 粘贴 API Key 和 Secret Key
4. 点击「测试连接」
5. 看到「连接成功」提示即完成

**安全保障：**
Hoot 使用 **AES-256-GCM 军事级加密**存储您的 API Key，密钥仅在服务器内存中短暂解密用于下单，永远不会明文落地或传输。`,
      contentEn: `Connecting an exchange is a necessary step to start AI trading. The primary supported exchange is **Binance Futures**.

**Steps to Create a Binance Futures API Key:**
1. Log in to Binance → Click your avatar (top right) → "API Management"
2. Click "Create API", select "System Generated"
3. Give your API Key a label (e.g., Hoot-Trading)
4. Complete security verification (email + phone dual verification)
5. **Permission Settings (Critical):**
   - ✅ Enable: Read Access
   - ✅ Enable: Enable Futures
   - ❌ Disable: Withdraw — **must be turned off**
   - ❌ Disable: Spot Trading (not needed)
6. Copy and securely save your API Key and Secret Key

**Connecting in Hoot:**
1. Go to Hoot → Wallet → Exchange → Add
2. Select "Binance Futures"
3. Paste your API Key and Secret Key
4. Click "Test Connection"
5. A "Connection Successful" message confirms completion

**Security Guarantee:**
Hoot uses **AES-256-GCM military-grade encryption** to store your API Key. The key is only briefly decrypted in server memory for order placement — it is never stored or transmitted in plaintext.`,
    },
    {
      titleZh: '创建第一个 AI 交易',
      titleEn: 'Create Your First AI Trade',
      contentZh: `绑定交易所后，即可创建您的第一个 AI 交易策略。

**步骤：**
1. 进入首页 → 点击「开始交易」或进入「AI 交易」页面
2. **选择 AI 模式：**
   - 新手推荐「**极速模式**」— 快速决策，适合快速体验
   - 稳健用户推荐「**网格模式**」— 震荡行情中自动高卖低买
   - 进阶用户可选「**共识模式**」或「**深研模式**」
3. **选择交易对：** 建议先从 BTC/USDT 或 ETH/USDT 开始
4. **配置风控参数：**
   - 杠杆倍数（新手建议 2-3x）
   - 最大亏损止损（建议设置 10-20%）
   - 最小投入金额（单次开仓的最低 USDT 金额）
5. 点击「启动策略」
6. AI 将开始分析行情，自动决策开仓、平仓

**首次交易建议：**
- 使用小额资金（100-500 USDT）进行体验
- 先观察 1-3 天，了解策略运作逻辑
- 确认盈亏情况与个人风险承受能力匹配后，再考虑增加资金`,
      contentEn: `Once your exchange is connected, you can create your first AI trading strategy.

**Steps:**
1. Go to Home → Click "Start Trading" or navigate to the "AI Trading" page
2. **Choose AI Mode:**
   - Beginners: "**Solo Mode**" — Fast decision-making, great for quick experience
   - Steady traders: "**Grid Mode**" — Auto buy-low sell-high in ranging markets
   - Advanced users: "**Debate Mode**" or "**Research Mode**"
3. **Select Trading Pair:** Start with BTC/USDT or ETH/USDT
4. **Configure Risk Parameters:**
   - Leverage (2-3x recommended for beginners)
   - Maximum stop-loss (10-20% recommended)
   - Minimum position size (minimum USDT per trade)
5. Click "Start Strategy"
6. AI begins analyzing the market and automatically decides when to open and close positions

**First Trade Recommendations:**
- Use a small amount (100-500 USDT) to get familiar
- Observe for 1-3 days to understand how the strategy operates
- Only increase capital after confirming the profit/loss profile matches your risk tolerance`,
    },
    {
      titleZh: '安全使用提示',
      titleEn: 'Safety Tips',
      contentZh: `在开始交易前，请务必了解以下安全规范，保护您的资金和账户。

**API 权限最小化原则：**
- 绝对不要开启「提现」权限，这是保护资金安全的第一道防线
- 仅开启「合约交易」和「读取」权限即可
- 建议在 Binance API 设置中绑定 IP 白名单，限制只有 Hoot 服务器可以使用该 API Key

**账户安全：**
- 开启两步验证（2FA）— 推荐使用 Google Authenticator
- 设置强密码：至少 8 位，包含大小写字母、数字、特殊符号
- 不要在任何非官方渠道分享您的账户密码或 API Key
- 截图保存助记词/备份码时请立即删除截图

**资金管理：**
- 仅使用**闲置资金**参与 AI 交易，不要使用生活必需资金
- 量化交易存在亏损风险，过去业绩不代表未来收益
- 设置合理的止损比例，避免单次亏损过大

**如遇异常：**
- 如发现 API Key 疑似泄露，立即在 Binance 删除该 Key 并重新创建
- 联系 Hoot 官方客服（Telegram: @HootSupport）`,
      contentEn: `Before you start trading, please review the following safety guidelines to protect your funds and account.

**Principle of Minimum API Permissions:**
- Never enable the "Withdraw" permission — this is your first line of defense for fund security
- Only enable "Futures Trading" and "Read" permissions
- It is recommended to set an IP whitelist in your Binance API settings, restricting usage to Hoot's servers only

**Account Security:**
- Enable two-factor authentication (2FA) — Google Authenticator is recommended
- Use a strong password: at least 8 characters with uppercase, lowercase, numbers, and special symbols
- Never share your account password or API Key through any unofficial channel
- If you screenshot your seed phrase/backup codes, delete the screenshot immediately

**Fund Management:**
- Only use **disposable funds** for AI trading — do not use money needed for daily expenses
- Quantitative trading carries the risk of loss; past performance does not guarantee future results
- Set reasonable stop-loss percentages to prevent large single-trade losses

**If You Notice Something Unusual:**
- If you suspect your API Key has been leaked, immediately delete it on Binance and create a new one
- Contact Hoot official support (Telegram: @HootSupport)`,
      type: 'warning',
    },
  ],
}

// ============================================
// 2. AI 自动交易指南 / AI Trading Guide
// ============================================
export const aiTrading: HelpArticle = {
  slug: 'ai-trading',
  titleZh: 'AI 自动交易指南',
  titleEn: 'AI Auto Trading Guide',
  descriptionZh: '深入了解四种 AI 交易模式，选择最适合您的策略',
  descriptionEn: 'Deep dive into four AI trading modes and choose the strategy that fits you best',
  sections: [
    {
      titleZh: '四种模式概览',
      titleEn: 'Overview of Four Modes',
      contentZh: `Hoot 提供四种各具特色的 AI 交易模式，覆盖不同交易风格和风险偏好。

| 模式 | 中文名 | 速度 | 准确度 | 适用场景 |
|------|--------|------|--------|----------|
| Solo | 极速 | ⚡⚡⚡⚡⚡ | ★★★ | 短线高频、快速响应 |
| Debate | 共识 | ⚡⚡⚡ | ★★★★ | 中线交易、降低误判 |
| Research | 深研 | ⚡⚡ | ★★★★★ | 长线重仓、严谨决策 |
| Grid | 网格 | ⚡⚡⚡⚡ | ★★★★ | 震荡行情、持续收益 |

**如何选择：**
- **资金少、想体验**：极速模式，快速感受 AI 交易
- **资金中等、看重稳健**：共识模式或网格模式
- **资金较多、追求严谨**：深研模式，每笔交易都经过多轮辩论
- **震荡行情、不想频繁操作**：网格模式，自动高卖低买

所有模式均**实时监控持仓风险**，触发止损时自动平仓，无需人工干预。`,
      contentEn: `Hoot offers four distinct AI trading modes, covering different trading styles and risk appetites.

| Mode | Name | Speed | Accuracy | Best For |
|------|------|-------|----------|----------|
| Solo | Speed | ⚡⚡⚡⚡⚡ | ★★★ | Short-term, high-frequency |
| Debate | Consensus | ⚡⚡⚡ | ★★★★ | Mid-term, reducing misjudgments |
| Research | Deep Research | ⚡⚡ | ★★★★★ | Long-term, large positions |
| Grid | Grid | ⚡⚡⚡⚡ | ★★★★ | Ranging markets, steady returns |

**How to Choose:**
- **Small capital, want to experience**: Solo mode — feel AI trading quickly
- **Medium capital, prefer stability**: Debate or Grid mode
- **Larger capital, demand rigor**: Research mode — every trade goes through multiple rounds of debate
- **Ranging market, prefer hands-off**: Grid mode — auto sell high, buy low

All modes **monitor position risk in real time** and auto-close positions when stop-loss is triggered — no manual intervention required.`,
    },
    {
      titleZh: '极速模式（Solo）',
      titleEn: 'Solo Mode (Speed)',
      contentZh: `极速模式是 Hoot 响应最快的 AI 交易模式，由单一高效 AI 模型完成全部分析与决策。

**工作原理：**
1. **行情采集**：实时获取K线数据、成交量、资金费率等指标
2. **AI 分析**：单一 AI 模型综合技术指标（RSI、MACD、布林带等）
3. **决策输出**：生成做多/做空/观望指令，附带置信度评分
4. **自动执行**：通过 API 在交易所直接下单
5. **通知推送**：开仓后立即推送 Telegram 通知（交易对/方向/金额/杠杆）

**适用场景：**
- 高波动性行情，需要快速响应
- 短线交易，持仓时间通常在数小时内
- 想要频繁参与市场的用户

**参数配置建议：**
- 杠杆：2-5x（单次亏损控制在账户的 2% 以内）
- 止损：5-10%（极速模式波动较大，给予适当空间）
- 最大并发持仓：2-3 个（分散风险）`,
      contentEn: `Solo mode is Hoot's fastest AI trading mode, with a single high-efficiency AI model handling all analysis and decision-making.

**How It Works:**
1. **Market Data Collection**: Real-time K-line data, volume, funding rates, and other indicators
2. **AI Analysis**: Single AI model synthesizes technical indicators (RSI, MACD, Bollinger Bands, etc.)
3. **Decision Output**: Generates long/short/wait commands with a confidence score
4. **Auto Execution**: Places orders directly on the exchange via API
5. **Push Notification**: Immediately sends Telegram notification after opening (pair/direction/amount/leverage)

**Best Used When:**
- Market is highly volatile and fast response is needed
- Short-term trading with positions typically held for a few hours
- Users who want to participate in the market frequently

**Recommended Parameter Settings:**
- Leverage: 2-5x (keep single-trade loss within 2% of account)
- Stop-loss: 5-10% (Solo mode has higher volatility, allow some breathing room)
- Max concurrent positions: 2-3 (diversify risk)`,
    },
    {
      titleZh: '共识模式（Debate）',
      titleEn: 'Debate Mode (Consensus)',
      contentZh: `共识模式通过多个 AI 模型独立分析同一交易对，以民主投票的方式做出最终决策，显著降低单一模型的误判率。

**工作原理：**
- 3-5 个不同架构的 AI 模型**独立分析**同一币种的行情数据
- 每个模型给出自己的交易建议（做多/做空/观望）和置信度
- **多数票原则**：超过半数模型看多才做多，超过半数看空才做空
- 如果意见分歧严重（如 2:3），系统选择观望，不强行开仓

**为什么更稳健：**
- 单一模型可能受到噪音数据影响产生误判
- 多模型投票相当于"众智"，极端观点被稀释
- 历史数据回测表明，共识模式的胜率比极速模式高约 8-12%

**适用场景：**
- 中线交易（持仓数小时至数天）
- 仓位较大、不希望频繁被止损
- 市场信号不明朗时，需要更多确认

**参数配置建议：**
- 杠杆：2-4x
- 止损：8-15%
- 最大并发持仓：3-5 个`,
      contentEn: `Debate mode uses multiple AI models to independently analyze the same trading pair, making the final decision through democratic voting — significantly reducing the misjudgment rate of any single model.

**How It Works:**
- 3-5 AI models with different architectures **independently analyze** market data for the same coin
- Each model provides its own trade recommendation (long/short/wait) with a confidence score
- **Majority vote principle**: Only long if more than half the models are bullish; only short if more than half are bearish
- If opinions are severely divided (e.g., 2:3), the system chooses to wait rather than force an entry

**Why It's More Stable:**
- A single model can be affected by noisy data and produce misjudgments
- Multi-model voting is the equivalent of "collective wisdom" — extreme views get diluted
- Historical backtests show Debate mode's win rate is approximately 8-12% higher than Solo mode

**Best Used When:**
- Mid-term trading (holding positions for hours to days)
- Larger positions where frequent stop-outs are undesirable
- Market signals are unclear and more confirmation is needed

**Recommended Parameter Settings:**
- Leverage: 2-4x
- Stop-loss: 8-15%
- Max concurrent positions: 3-5`,
    },
    {
      titleZh: '深研模式（Research）',
      titleEn: 'Research Mode (Deep Analysis)',
      contentZh: `深研模式是 Hoot 最严谨的交易决策系统，采用**五阶段全流程分析**，是行业内独创的多角色辩论投资决策框架。

**五阶段流水线：**

**第一阶段 — 5位分析师并行研究**
市场分析师、技术分析师、基本面分析师、新闻分析师、情绪分析师各自出具独立研究报告。

**第二阶段 — 5角色投资辩论**
Bull（多头）、Bear（空头）、Analyst（技术）、Contrarian（反向者）、Risk Manager（风控官）围绕研究报告展开多轮辩论，最终投票。

**第三阶段 — 交易员制定提案**
基于辩论结果，交易员 AI 给出具体的交易计划（入场点、目标价、止损位、仓位大小）。

**第四阶段 — 3方风控辩论**
Aggressive（激进派）、Conservative（保守派）、Neutral（中立派）三方对交易提案进行风险审查，Judge（裁判）最终裁决是否执行。

**第五阶段 — 执行或放弃**
通过风控审查的交易才会被执行；任何一方提出重大风险点均可一票否决。

**适用场景：** 大额资金、长线持仓、对准确率要求极高的用户。`,
      contentEn: `Research mode is Hoot's most rigorous trading decision system, using a **five-stage full-process analysis** — an industry-exclusive multi-role debate investment decision framework.

**Five-Stage Pipeline:**

**Stage 1 — 5 Analysts Research in Parallel**
Market Analyst, Technical Analyst, Fundamental Analyst, News Analyst, and Sentiment Analyst each independently produce their own research reports.

**Stage 2 — 5-Role Investment Debate**
Bull, Bear, Analyst (Technical), Contrarian, and Risk Manager debate multiple rounds based on the research reports, then vote.

**Stage 3 — Trader Proposal**
Based on debate results, the Trader AI formulates a specific trade plan (entry price, target price, stop-loss, position size).

**Stage 4 — 3-Party Risk Control Debate**
Aggressive, Conservative, and Neutral reviewers examine the trade proposal for risk, with a Judge making the final ruling on whether to execute.

**Stage 5 — Execute or Abandon**
Only trades that pass risk review are executed; a single major risk point raised by any party can veto the trade.

**Best Used For:** Large capital, long-term positions, users who demand the highest accuracy.`,
    },
    {
      titleZh: '风控参数配置指南',
      titleEn: 'Risk Control Parameter Guide',
      contentZh: `合理的风控参数是保护资金安全的关键。以下是每个参数的说明和推荐设置。

**核心风控参数：**

**最大并发持仓数** — 同时持有的最大仓位数量
- 新手建议：2-3 个（资金分散，单笔风险可控）
- 进阶用户：5-10 个（需要更多资金支撑）

**杠杆上限** — 每笔交易的最大杠杆倍数
- 保守：2-3x（适合新手和大额资金）
- 激进：5-10x（适合小额高频，需承受更大波动）
- 不建议超过 10x（合约强平风险极高）

**止损百分比** — 亏损达到多少时自动平仓
- 建议：5-15%（视杠杆大小调整）
- 杠杆越高，止损百分比应越小

**止盈百分比** — 盈利达到多少时自动止盈（可选）
- 不设置则由 AI 自主判断何时平仓
- 设置后 AI 会在达到目标时自动止盈

**最小仓位金额** — 每笔开仓的最低 USDT 金额
- 建议：50-200 USDT（太小会被手续费侵蚀收益）

**保证金使用率** — 账户保证金的最大使用比例
- 建议：60-80%（保留安全缓冲，避免强平）`,
      contentEn: `Proper risk control parameters are key to protecting your capital. Below is an explanation and recommended settings for each parameter.

**Core Risk Control Parameters:**

**Max Concurrent Positions** — Maximum number of positions held simultaneously
- Beginners: 2-3 (diversified capital, manageable single-trade risk)
- Advanced users: 5-10 (requires more capital support)

**Leverage Cap** — Maximum leverage multiplier per trade
- Conservative: 2-3x (suitable for beginners and large capital)
- Aggressive: 5-10x (suitable for small amounts, high-frequency; must tolerate larger swings)
- Not recommended above 10x (extremely high liquidation risk)

**Stop-Loss Percentage** — Auto close position when loss reaches this threshold
- Recommended: 5-15% (adjust based on leverage level)
- Higher leverage → smaller stop-loss percentage

**Take-Profit Percentage** — Auto close position when profit reaches this threshold (optional)
- If not set, AI autonomously judges when to close
- If set, AI auto closes when target is reached

**Minimum Position Size** — Minimum USDT per trade opening
- Recommended: 50-200 USDT (too small and fees erode returns)

**Margin Utilization Rate** — Maximum percentage of account margin to use
- Recommended: 60-80% (keep a safety buffer to avoid liquidation)`,
      type: 'tip',
    },
  ],
}

// ============================================
// 3. AI 深研模式详解 / AI Research Mode
// ============================================
export const aiResearch: HelpArticle = {
  slug: 'ai-research',
  titleZh: 'AI 深研模式详解',
  titleEn: 'AI Research Mode Deep Dive',
  descriptionZh: '解析行业独创的多角色辩论投资决策系统全流程',
  descriptionEn: 'Explore the industry-exclusive multi-role debate investment decision system in full detail',
  sections: [
    {
      titleZh: '五阶段流水线概览',
      titleEn: 'Five-Stage Pipeline Overview',
      contentZh: `深研模式（Research Mode）是 Hoot 独创的五阶段 AI 投资决策系统，模拟顶尖投资机构的完整决策流程。

**全流程示意：**

- 第1阶段：分析师研究（并行）
  - 市场分析师 → 宏观趋势报告
  - 技术分析师 → 技术指标报告
  - 基本面分析师 → 基本面报告
  - 新闻分析师 → 事件影响报告
  - 情绪分析师 → 市场情绪报告
- 第2阶段：投资辩论（5角色）
  - Bull（多头）与 Bear（空头）交锋
  - Analyst（技术）提供客观数据支撑
  - Contrarian（反向者）挑战主流观点
  - Risk Manager（风控官）评估风险
- 第3阶段：交易员提案 → 根据辩论结果制定具体交易计划
- 第4阶段：风控辩论（3方）
  - Aggressive（激进派）→ Conservative（保守派）→ Neutral（中立派）
  - Judge（裁判）最终裁决
- 第5阶段：执行决策 → 通过审查则自动下单，未通过则放弃本次机会

**优势：** 相比单一 AI 决策，深研模式从多维度交叉验证，将误判率降至最低。每份完整报告包含所有角色的分析摘要、投票结果、置信度评分和风险评级，完全透明可追溯。`,
      contentEn: `Research Mode is Hoot's proprietary five-stage AI investment decision system, simulating the complete decision-making process of top investment institutions.

**Full Process Diagram:**

\`\`\`
Stage 1: Analyst Research (Parallel)
  ├── Market Analyst → Macro Trend Report
  ├── Technical Analyst → Technical Indicator Report
  ├── Fundamental Analyst → Fundamentals Report
  ├── News Analyst → Event Impact Report
  └── Sentiment Analyst → Market Sentiment Report

Stage 2: Investment Debate (5 Roles)
  ├── Bull → Bear → Head-to-head
  ├── Analyst (Technical) → Objective data support
  ├── Contrarian → Challenges mainstream views
  └── Risk Manager → Risk assessment

Stage 3: Trader Proposal
  └── Specific trade plan based on debate results

Stage 4: Risk Control Debate (3 Parties)
  ├── Aggressive → Conservative → Neutral
  └── Judge → Final ruling

Stage 5: Execution Decision
  └── Passes review → Auto order | Fails → Opportunity abandoned
\`\`\`

**Advantage:** Compared to single-AI decisions, Research Mode cross-validates from multiple dimensions, minimizing the misjudgment rate. Each complete report contains analysis summaries from all roles, voting results, confidence scores, and risk ratings — fully transparent and traceable.`,
    },
    {
      titleZh: '第一阶段：5位分析师研究',
      titleEn: 'Stage 1: 5 Analysts Research',
      contentZh: `第一阶段由 5 位专职 AI 分析师**并行工作**，同时从不同角度对同一交易对展开独立研究。

**市场分析师（Market Analyst）**
负责宏观层面分析：市场趋势、整体流动性、大盘与比特币相关性、市场周期判断（牛市/熊市/震荡）。

**技术分析师（Technical Analyst）**
负责技术指标分析：K线形态、支撑位/阻力位、RSI 超买超卖、MACD 金叉死叉、布林带收窄/扩张、成交量变化。

**基本面分析师（Fundamental Analyst）**
负责项目基本面：链上数据（持币地址数、大户转移）、开发活跃度、生态进展、代币经济模型。

**新闻分析师（News Analyst）**
负责事件驱动分析：最近 24-48 小时重要新闻、监管动态、大户动向、社区热点事件，判断其对价格的正负影响。

**情绪分析师（Sentiment Analyst）**
负责市场情绪：社交媒体情绪指数、Fear & Greed 指数、多空比、资金费率趋势，判断市场整体情绪偏向。

**输出：** 5 份独立研究报告，作为第二阶段辩论的基础材料。`,
      contentEn: `Stage 1 involves 5 specialized AI analysts working **in parallel**, simultaneously researching the same trading pair from different perspectives.

**Market Analyst**
Responsible for macro-level analysis: market trends, overall liquidity, correlation with Bitcoin and the broader market, market cycle assessment (bull/bear/ranging).

**Technical Analyst**
Responsible for technical indicators: candlestick patterns, support/resistance levels, RSI overbought/oversold, MACD golden/death crosses, Bollinger Band squeeze/expansion, volume changes.

**Fundamental Analyst**
Responsible for project fundamentals: on-chain data (wallet addresses, whale transfers), development activity, ecosystem progress, tokenomics model.

**News Analyst**
Responsible for event-driven analysis: important news in the past 24-48 hours, regulatory developments, whale movements, community hot events — assessing positive/negative price impact.

**Sentiment Analyst**
Responsible for market sentiment: social media sentiment index, Fear & Greed Index, long/short ratio, funding rate trends — gauging overall market sentiment direction.

**Output:** 5 independent research reports, serving as the base materials for the Stage 2 debate.`,
    },
    {
      titleZh: '第二、三阶段：投资辩论与交易员提案',
      titleEn: 'Stages 2 & 3: Investment Debate & Trader Proposal',
      contentZh: `**第二阶段 — 5角色投资辩论**

5 个投资角色基于第一阶段的研究报告，展开**多轮辩论**，最终投票决定交易方向。

**Bull（多头）**
专门寻找做多理由：正面催化剂、技术突破信号、基本面改善、历史相似走势下的上涨案例。

**Bear（空头）**
专门寻找做空理由：利空信号、高位风险、市场结构恶化、潜在下跌催化剂。

**Analyst（技术分析师）**
以客观技术数据为双方提供佐证，不带主观立场，专注于数据本身说明问题。

**Contrarian（反向者）**
挑战多空双方的主流观点，提出逆向思考：当所有人都看涨时质疑上涨空间，当所有人看空时寻找超跌反弹机会。

**Risk Manager（风控官）**
评估潜在交易的风险回报比（Risk/Reward Ratio），提示黑天鹅风险、流动性风险、仓位过大风险。

**投票结果：** 5 个角色各投票，多数票决定方向（做多/做空/观望）。

---

**第三阶段 — 交易员制定具体提案**

交易员 AI 根据辩论结果，输出完整的交易计划：
- 具体入场价格区间
- 目标止盈位（Target）
- 止损位（Stop-Loss）
- 建议仓位大小（占账户比例）
- 预计持仓时间`,
      contentEn: `**Stage 2 — 5-Role Investment Debate**

5 investment roles engage in **multiple rounds of debate** based on Stage 1 research reports, then vote to decide the trade direction.

**Bull**
Seeks reasons to go long: positive catalysts, technical breakout signals, improving fundamentals, historical similar price action showing upward moves.

**Bear**
Seeks reasons to go short: bearish signals, high-level risk, deteriorating market structure, potential downward catalysts.

**Analyst (Technical)**
Provides objective technical data to support both sides without personal bias — focused purely on what the data shows.

**Contrarian**
Challenges the mainstream views of both bulls and bears: questions the upside when everyone is bullish, looks for oversold bounces when everyone is bearish.

**Risk Manager**
Evaluates the risk/reward ratio of the potential trade, flags black swan risks, liquidity risks, and oversized position risks.

**Vote Result:** All 5 roles vote, with the majority determining the direction (long/short/wait).

---

**Stage 3 — Trader Formulates Specific Proposal**

The Trader AI outputs a complete trade plan based on the debate results:
- Specific entry price range
- Target take-profit level
- Stop-loss level
- Recommended position size (as a percentage of account)
- Estimated holding period`,
    },
    {
      titleZh: '第四阶段：风控辩论',
      titleEn: 'Stage 4: Risk Control Debate',
      contentZh: `第四阶段是交易执行前的最后一道防线——三方风控专家对交易员的提案进行独立的风险审查。

**三方风控角色：**

**Aggressive（激进派）**
从收益最大化角度评估：认为值得冒险的理由、当前市场条件是否有利、仓位是否可以更大。偏向放行交易。

**Conservative（保守派）**
从风险最小化角度评估：潜在下行风险、保证金安全边际、当前市场不确定性。偏向谨慎，容易否决激进交易。

**Neutral（中立派）**
从客观平衡角度评估：权衡激进派和保守派的意见，给出折中方案或调整建议（如降低杠杆、缩小仓位）。

**Judge（裁判）**
综合三方意见，做出最终裁决：
- **执行（Execute）** — 交易计划通过，按原方案下单
- **调整后执行（Modify & Execute）** — 调整仓位/杠杆后执行
- **放弃（Reject）** — 风险过高，本次机会放弃

**一票否决制：** 如果裁判发现重大风险点（如账户可用保证金不足、行情处于极端波动期等），可直接否决交易，即使辩论阶段已投票做多/做空。`,
      contentEn: `Stage 4 is the last line of defense before trade execution — three risk control experts independently review the trader's proposal.

**Three Risk Control Roles:**

**Aggressive**
Evaluates from a profit-maximization perspective: reasons the risk is worth taking, whether current market conditions are favorable, whether position size can be larger. Leans toward approving the trade.

**Conservative**
Evaluates from a risk-minimization perspective: potential downside risk, margin safety buffer, current market uncertainty. Tends to be cautious and more likely to veto aggressive trades.

**Neutral**
Evaluates from an objective, balanced perspective: weighs the views of the Aggressive and Conservative sides, offering a compromise or adjustment suggestion (e.g., reduce leverage, shrink position size).

**Judge**
Synthesizes all three perspectives and makes the final ruling:
- **Execute** — Trade plan passes, place order as proposed
- **Modify & Execute** — Execute after adjusting position size or leverage
- **Reject** — Risk too high, this opportunity is abandoned

**Veto Power:** If the Judge identifies a critical risk point (e.g., insufficient available margin, market in extreme volatility), the trade can be immediately vetoed — even if the debate stage already voted to go long or short.`,
    },
    {
      titleZh: '发起和查看深研报告',
      titleEn: 'Initiating and Viewing Research Reports',
      contentZh: `**谁可以使用深研模式：**
- **Pro 会员**可在任意时间为任意交易对发起深研分析
- Free 用户可查看系统定期生成的公开深研报告（每日精选 3-5 个交易对）

**如何发起深研：**
1. 进入「AI 交易」→「深研模式」
2. 输入或搜索交易对（如 BTC/USDT、ETH/USDT）
3. 点击「发起深研」
4. 等待 3-8 分钟（五阶段分析需要时间）
5. 报告生成后收到 Telegram 通知，点击查看完整报告

**报告包含内容：**
- 5 位分析师的独立研究摘要
- 投资辩论各角色的核心观点
- 最终投票结果（如：4多1空，倾向做多）
- 整体置信度评分（0-100）
- 综合风险评级（低/中/高）
- 具体交易建议（入场、目标、止损）
- 交易员是否最终决定执行

**历史报告：**
所有深研报告永久保存，可在「研究报告」页面按日期/交易对检索，方便回溯分析与学习。`,
      contentEn: `**Who Can Use Research Mode:**
- **Pro members** can initiate a deep research analysis for any trading pair at any time
- Free users can view publicly generated research reports (daily selection of 3-5 trading pairs)

**How to Initiate Research:**
1. Go to "AI Trading" → "Research Mode"
2. Enter or search for a trading pair (e.g., BTC/USDT, ETH/USDT)
3. Click "Start Research"
4. Wait 3-8 minutes (the five-stage analysis takes time)
5. Receive a Telegram notification when the report is ready, click to view the full report

**Report Contents:**
- Independent research summaries from 5 analysts
- Core viewpoints from each role in the investment debate
- Final voting result (e.g., 4 long 1 short → leaning long)
- Overall confidence score (0-100)
- Comprehensive risk rating (Low/Medium/High)
- Specific trade recommendation (entry, target, stop-loss)
- Whether the Trader ultimately decided to execute

**Historical Reports:**
All research reports are permanently saved and can be retrieved by date or trading pair on the "Research Reports" page, making it easy to review and learn from past analysis.`,
      type: 'info',
    },
  ],
}

// ============================================
// 4. 交易所绑定指南 / API Keys Guide
// ============================================
export const apiKeys: HelpArticle = {
  slug: 'api-keys',
  titleZh: '交易所绑定指南',
  titleEn: 'Exchange Connection Guide',
  descriptionZh: '安全绑定 Binance 及去中心化交易所，开始 AI 自动交易',
  descriptionEn: 'Securely connect Binance and decentralized exchanges to start AI auto trading',
  sections: [
    {
      titleZh: 'API Key 安全模型',
      titleEn: 'API Key Security Model',
      contentZh: `在绑定交易所之前，理解 Hoot 的非托管安全模型非常重要。

**非托管架构（Non-Custodial）：**
Hoot 采用非托管设计——您的资金始终留在您自己的交易所账户。Hoot 通过 API Key 仅能执行交易（买入/卖出），**无法提现、无法转账**您的资金。即使 Hoot 服务器发生任何问题，您的资金也不会受到影响。

**技术安全保障：**

**AES-256-GCM 军事级加密**
您提交的 API Key 和 Secret Key 在服务器接收后立即使用 AES-256-GCM 加密算法加密存储。加密密钥由硬件安全模块（HSM）管理，与数据库完全隔离存储。

**内存解密机制**
API Key 仅在需要下单的瞬间在服务器内存中短暂解密，执行完毕后立即清除内存中的明文数据。任何日志文件、数据库备份中均**不包含**明文 API Key。

**最小权限原则**
Hoot 系统架构级别强制要求 API 只能执行交易，即使用户误开了提现权限，Hoot 的代码层面也不会发起提现请求。但建议您在交易所侧彻底关闭提现权限作为双重保障。

**传输加密**
所有与交易所之间的 API 通信均通过 TLS 1.3 加密传输，防止中间人攻击。`,
      contentEn: `Before connecting your exchange, it's important to understand Hoot's non-custodial security model.

**Non-Custodial Architecture:**
Hoot is designed as non-custodial — your funds always remain in your own exchange account. Through the API Key, Hoot can only execute trades (buy/sell) and **cannot withdraw or transfer** your funds. Even if anything happens to Hoot's servers, your funds are unaffected.

**Technical Security Guarantees:**

**AES-256-GCM Military-Grade Encryption**
API Keys and Secret Keys you submit are immediately encrypted using the AES-256-GCM algorithm upon receipt. Encryption keys are managed by a Hardware Security Module (HSM) stored completely separate from the database.

**In-Memory Decryption Mechanism**
API Keys are only briefly decrypted in server memory at the instant an order needs to be placed. Plaintext data is immediately cleared from memory after execution. No log files or database backups **contain** plaintext API Keys.

**Principle of Minimum Privilege**
Hoot's system architecture enforces API-only trade execution at the code level — even if a user accidentally enables withdrawal permissions, Hoot's code will never initiate a withdrawal request. However, we strongly recommend disabling withdrawal permissions on the exchange side as a double safeguard.

**Encrypted Transmission**
All API communications with exchanges are transmitted via TLS 1.3 encryption, preventing man-in-the-middle attacks.`,
    },
    {
      titleZh: 'Binance 合约 API Key 创建',
      titleEn: 'Creating a Binance Futures API Key',
      contentZh: `以下是在 Binance 创建合约交易 API Key 的详细步骤。

**步骤一：进入 API 管理**
1. 登录 Binance 官网（binance.com）
2. 点击右上角头像 → 下拉菜单选择「API 管理」
3. 进入 API 管理页面

**步骤二：创建新 API Key**
1. 点击「创建 API」按钮
2. 选择「系统生成」（推荐，安全性更高）
3. 在标签栏输入名称，如：Hoot-Trading-2024
4. 点击「下一步」

**步骤三：安全验证**
1. 完成邮箱验证码验证
2. 完成手机短信验证码验证（如已绑定）
3. 完成 Google 2FA 验证（如已开启，强烈建议）

**步骤四：设置权限（关键步骤）**
在权限设置页面：
- ✅ **勾选「读取权限」**（Enable Reading）
- ✅ **勾选「合约交易」**（Enable Futures）
- ❌ **不要勾选「提现」**（Withdraw）— 这是保护资金安全的关键
- ❌ **不要勾选「现货交易」**（非必需）
- ❌ **不要勾选「内部转账」**（非必需）

**步骤五：保存 Key**
1. 系统展示 API Key（以 xxx 开头的长字符串）和 Secret Key
2. **⚠️ Secret Key 只展示一次**，务必立即复制并妥善保存
3. 建议使用密码管理器（如 1Password）保存`,
      contentEn: `Here are the detailed steps for creating a Futures trading API Key on Binance.

**Step 1: Access API Management**
1. Log in to Binance (binance.com)
2. Click your avatar (top right) → Select "API Management" from the dropdown
3. You'll land on the API Management page

**Step 2: Create a New API Key**
1. Click the "Create API" button
2. Select "System Generated" (recommended, higher security)
3. Enter a label such as: \`Hoot-Trading-2024\`
4. Click "Next"

**Step 3: Security Verification**
1. Complete email verification code
2. Complete SMS verification (if phone is bound)
3. Complete Google 2FA verification (if enabled — strongly recommended)

**Step 4: Set Permissions (Critical Step)**
On the permissions settings page:
- ✅ **Check "Enable Reading"**
- ✅ **Check "Enable Futures"**
- ❌ **Do NOT check "Withdraw"** — This is the key to protecting your funds
- ❌ **Do NOT check "Spot Trading"** (not needed)
- ❌ **Do NOT check "Internal Transfer"** (not needed)

**Step 5: Save the Key**
1. The system displays the API Key (a long string starting with \`xxx\`) and Secret Key
2. **⚠️ The Secret Key is only shown once** — copy and save it immediately
3. It is recommended to use a password manager (e.g., 1Password) to store it`,
    },
    {
      titleZh: '在 Hoot 中绑定 API Key',
      titleEn: 'Connecting API Key in Hoot',
      contentZh: `完成 Binance API Key 创建后，按以下步骤在 Hoot 中绑定。

**绑定步骤：**
1. 登录 Hoot → 进入底部导航「钱包」
2. 点击「交易所」选项卡
3. 点击右上角「+ 添加」按钮
4. 在交易所列表中选择「Binance 合约」（USDM）
5. 在「API Key」输入框粘贴您的 API Key
6. 在「Secret Key」输入框粘贴您的 Secret Key
7. 点击「测试连接」按钮
8. 等待 3-5 秒，看到以下提示即表示成功：
   - ✅ 「连接成功」
   - 显示当前账户余额（可用余额 + 总权益）
9. 点击「确认保存」完成绑定

**常见错误处理：**

**「权限不足」错误**
→ 检查是否开启了「合约交易（Enable Futures）」权限

**「签名无效」错误**
→ 检查复制的 API Key 和 Secret Key 是否完整，注意首尾无多余空格

**「IP 受限」错误**
→ 您在 Binance 设置了 IP 白名单，需要在 Binance 后台将 Hoot 的服务器 IP 添加进去（IP 地址请联系 Hoot 客服获取）

**「账户不存在」错误**
→ 确认您使用的是「合约账户 API Key」，而非现货账户 API Key`,
      contentEn: `After creating your Binance API Key, follow these steps to connect it in Hoot.

**Connection Steps:**
1. Log in to Hoot → Go to "Wallet" in the bottom navigation
2. Click the "Exchange" tab
3. Click the "+ Add" button in the top right
4. Select "Binance Futures" (USDM) from the exchange list
5. Paste your API Key in the "API Key" field
6. Paste your Secret Key in the "Secret Key" field
7. Click the "Test Connection" button
8. Wait 3-5 seconds — the following message means success:
   - ✅ "Connection Successful"
   - Current account balance is displayed (available balance + total equity)
9. Click "Confirm Save" to complete the connection

**Common Error Solutions:**

**"Insufficient Permissions" Error**
→ Check that you enabled "Enable Futures" permission

**"Invalid Signature" Error**
→ Check that the copied API Key and Secret Key are complete — ensure no extra spaces at the beginning or end

**"IP Restricted" Error**
→ You set an IP whitelist on Binance. Add Hoot's server IPs to the whitelist in your Binance settings (contact Hoot support for the IP addresses)

**"Account Not Found" Error**
→ Confirm you are using a "Futures Account API Key", not a Spot account API Key`,
    },
    {
      titleZh: 'DEX 钱包绑定',
      titleEn: 'DEX Wallet Connection',
      contentZh: `除 Binance 外，Hoot 还支持主流去中心化永续合约交易所的连接。

**Hyperliquid 绑定：**
Hyperliquid 使用「Agent 钱包」机制，无需暴露主钱包私钥：
1. 在 Hyperliquid 官网创建 Agent 钱包（子授权钱包）
2. 获取 Agent 钱包地址和私钥
3. 在 Hoot 选择「Hyperliquid」→ 填入 Agent 钱包地址和私钥
4. Agent 钱包仅有交易权限，无法转移主钱包资产

**Aster 绑定：**
1. 获取您的 Aster 账户钱包地址
2. 导出用于签名的私钥（建议使用专用交易子钱包）
3. 在 Hoot 选择「Aster」→ 填入钱包地址和签名私钥

**Lighter 绑定：**
Lighter 需要三个信息：
1. 用户钱包地址
2. 钱包私钥（用于主账户操作）
3. API Key 私钥（用于日常交易操作）

**所有私钥安全保障：**
与 Binance API Key 相同，所有 DEX 私钥均使用 **AES-256-GCM 加密**存储，仅在下单时短暂解密，永远不会明文落地或出现在日志中。`,
      contentEn: `In addition to Binance, Hoot also supports connections to mainstream decentralized perpetual contract exchanges.

**Hyperliquid Connection:**
Hyperliquid uses an "Agent Wallet" mechanism, so you don't need to expose your main wallet's private key:
1. Create an Agent Wallet (sub-authorized wallet) on the Hyperliquid website
2. Obtain the Agent Wallet address and private key
3. In Hoot, select "Hyperliquid" → Enter the Agent Wallet address and private key
4. The Agent Wallet only has trading permissions and cannot transfer main wallet assets

**Aster Connection:**
1. Get your Aster account wallet address
2. Export the private key used for signing (recommended: use a dedicated trading sub-wallet)
3. In Hoot, select "Aster" → Enter the wallet address and signing private key

**Lighter Connection:**
Lighter requires three pieces of information:
1. User wallet address
2. Wallet private key (for main account operations)
3. API Key private key (for daily trading operations)

**Security for All Private Keys:**
Same as Binance API Keys — all DEX private keys are stored with **AES-256-GCM encryption**, only briefly decrypted when placing orders, and never stored in plaintext or appear in any logs.`,
    },
    {
      titleZh: '安全最佳实践',
      titleEn: 'Security Best Practices',
      contentZh: `遵循以下安全实践，最大化保护您的交易资产。

**IP 白名单设置：**
在 Binance API 设置中启用 IP 白名单，只允许 Hoot 服务器的 IP 地址使用该 API Key。即使 API Key 泄露，未知 IP 也无法使用。请联系 Hoot 客服获取最新的服务器 IP 列表。

**定期轮换 API Key（建议每 90 天一次）：**
1. 在 Binance 创建新的 API Key（权限设置相同）
2. 在 Hoot 中更新为新的 API Key（旧 Key 仍然可用，不影响运行中的策略）
3. 确认 Hoot 连接测试通过后，在 Binance 删除旧的 API Key

**监控 API 使用记录：**
- 定期在 Binance「API 管理」页面查看 API Key 的使用记录
- 如发现异常请求（特别是非交易类请求），立即删除 Key 并联系 Hoot 支持

**绝对禁止：**
- ❌ 截图保存 API Key（截图可能同步到云端）
- ❌ 通过聊天工具（微信/Telegram/邮件）发送 API Key
- ❌ 在公共 Wi-Fi 下操作 API Key 设置
- ❌ 开启「提现」权限给任何第三方平台

**如发现 API Key 泄露：**
1. 立即登录 Binance → API 管理 → 删除该 Key
2. 检查账户交易记录，确认无异常交易
3. 重新创建 API Key 并在 Hoot 更新
4. 联系 Hoot 客服（Telegram: @HootSupport）报告安全事件`,
      contentEn: `Follow these security practices to maximize protection of your trading assets.

**IP Whitelist Settings:**
Enable the IP whitelist in your Binance API settings to allow only Hoot's server IP addresses to use that API Key. Even if the API Key is leaked, unknown IPs cannot use it. Contact Hoot support for the latest server IP list.

**Regular API Key Rotation (Recommended every 90 days):**
1. Create a new API Key on Binance (same permission settings)
2. Update to the new API Key in Hoot (the old Key remains usable and won't interrupt running strategies)
3. After confirming the Hoot connection test passes, delete the old API Key on Binance

**Monitor API Usage Records:**
- Regularly check API Key usage history in Binance's "API Management" page
- If you spot unusual requests (especially non-trade requests), immediately delete the Key and contact Hoot support

**Absolutely Prohibited:**
- ❌ Screenshot to save API Key (screenshots may sync to the cloud)
- ❌ Send API Key via chat tools (WeChat/Telegram/email)
- ❌ Manage API Key settings on public Wi-Fi
- ❌ Enable "Withdraw" permission for any third-party platform

**If You Discover a Leaked API Key:**
1. Immediately log in to Binance → API Management → Delete that Key
2. Check account trading history to confirm no abnormal transactions
3. Create a new API Key and update it in Hoot
4. Contact Hoot support (Telegram: @HootSupport) to report the security incident`,
      type: 'success',
    },
  ],
}

// ============================================
// 5. 钱包与资金 / Wallet & Funds
// ============================================
export const walletFunds: HelpArticle = {
  slug: 'wallet-funds',
  titleZh: '钱包与资金',
  titleEn: 'Wallet & Funds',
  descriptionZh: '了解 Hoot 平台内的资金管理：USDT、HOOT 代币、点卡的充提与使用',
  descriptionEn: 'Understand fund management on the Hoot platform: USDT, HOOT tokens, and point cards',
  sections: [
    {
      titleZh: '三种余额说明',
      titleEn: 'Three Types of Balances',
      contentZh: `Hoot 平台内有三种不同类型的余额，各有不同用途。

**1. USDT 余额**
- **用途：** 支付 Pro 会员订阅费、燃油费（盈利分成）自动扣款
- **充值：** 支持 BSC/TRC20/ERC20 链上充值
- **提现：** 支持提现至您的外部钱包
- **特点：** 主要的平台计价货币，1:1 锚定美元

**2. HOOT 代币余额**
- **用途：** 平台生态代币，用于质押分红、折扣、未来生态权益
- **获取方式：** 注册奖励、每日签到、邀请好友、盈利奖励等多种方式免费获得
- **特点：** 目前为平台积分形式，未来计划上链（TON DEX → 主流 DEX）
- **不可提现：** 当前阶段不支持直接提现，未来上链后可转换

**3. 点卡（Credit Card）**
- **用途：** 平台代金券，可用于支付订阅费、燃油费
- **面值：** 1 点卡 = 1 USDT
- **获取：** 充值赠送、邀请活动奖励、促销活动
- **规则：** 优先于 USDT 使用、不可提现、永久有效、不可转让

**余额优先级（扣款顺序）：**
点卡 > USDT（系统优先消耗点卡，再使用 USDT）`,
      contentEn: `The Hoot platform has three different types of balances, each with different uses.

**1. USDT Balance**
- **Use:** Pay Pro membership subscription fees; automatic deduction for gas fees (profit sharing)
- **Deposit:** Supports on-chain deposits via BSC/TRC20/ERC20
- **Withdraw:** Supports withdrawal to your external wallet
- **Note:** Primary platform currency, pegged 1:1 to USD

**2. HOOT Token Balance**
- **Use:** Platform ecosystem token for staking dividends, discounts, and future ecosystem benefits
- **How to Earn:** Register reward, daily check-in, referrals, profit bonuses, and more — all free
- **Note:** Currently in platform points form; future plans to go on-chain (TON DEX → mainstream DEX)
- **Non-withdrawable:** Direct withdrawal not supported at this stage; will be convertible after going on-chain

**3. Credit Points (Point Card)**
- **Use:** Platform voucher, applicable to subscription fees and gas fees
- **Value:** 1 Point = 1 USDT
- **How to Earn:** Deposit bonuses, referral rewards, promotional events
- **Rules:** Used before USDT; non-withdrawable; permanently valid; non-transferable

**Balance Priority (Deduction Order):**
Point Cards > USDT (system uses point cards first, then USDT)`,
    },
    {
      titleZh: 'USDT 充值',
      titleEn: 'USDT Deposit',
      contentZh: `向 Hoot 钱包充值 USDT，用于订阅和支付燃油费。

**支持的充值网络：**

| 网络 | 代号 | 手续费 | 到账时间 | 推荐度 |
|------|------|--------|----------|--------|
| BNB Smart Chain | BSC/BEP20 | 极低（约 $0.1） | 1-2 分钟 | ⭐⭐⭐⭐⭐ 强烈推荐 |
| Tron | TRC20 | 低（约 $1） | 1-3 分钟 | ⭐⭐⭐⭐ |
| Ethereum | ERC20 | 高（$5-50） | 3-10 分钟 | ⭐⭐ 不推荐 |

**最低充值金额：10 USDT**

**充值步骤：**
1. 进入 Hoot → 钱包 → 充值
2. 选择充值网络（推荐 BSC/BEP20）
3. 系统生成您的**专属充值地址**（每个用户、每条链有唯一地址）
4. 复制地址（或扫描二维码）
5. 从您的交易所或钱包向该地址转账
6. 等待区块确认（通常 1-5 分钟）
7. 到账后收到 Telegram 通知，USDT 余额自动更新

**重要注意事项：**
- 充值网络必须与您选择的网络一致（如选了 BSC，就必须从 BSC 网络转账）
- 地址一旦生成长期有效，可重复使用
- 最小充值 10 USDT，低于此金额将无法到账（资金不会丢失，但需联系客服处理）`,
      contentEn: `Deposit USDT to your Hoot wallet for subscriptions and gas fee payments.

**Supported Deposit Networks:**

| Network | Code | Fee | Arrival Time | Recommendation |
|---------|------|-----|--------------|----------------|
| BNB Smart Chain | BSC/BEP20 | Very Low (~$0.1) | 1-2 min | ⭐⭐⭐⭐⭐ Strongly Recommended |
| Tron | TRC20 | Low (~$1) | 1-3 min | ⭐⭐⭐⭐ |
| Ethereum | ERC20 | High ($5-50) | 3-10 min | ⭐⭐ Not Recommended |

**Minimum Deposit: 10 USDT**

**Deposit Steps:**
1. Go to Hoot → Wallet → Deposit
2. Select the deposit network (BSC/BEP20 recommended)
3. The system generates your **exclusive deposit address** (unique address per user, per chain)
4. Copy the address (or scan the QR code)
5. Transfer from your exchange or wallet to that address
6. Wait for block confirmation (usually 1-5 minutes)
7. Receive a Telegram notification upon arrival; USDT balance updates automatically

**Important Notes:**
- The deposit network must match the network you selected (e.g., if you chose BSC, you must transfer from the BSC network)
- Once generated, the address is valid long-term and can be reused
- Minimum deposit is 10 USDT; amounts below this will not arrive (funds are not lost but require contacting support)`,
    },
    {
      titleZh: 'USDT 提现',
      titleEn: 'USDT Withdrawal',
      contentZh: `将 Hoot 钱包中的 USDT 提现到您的外部钱包或交易所。

**提现步骤：**
1. 进入 Hoot → 钱包 → 提现
2. 输入提现目标钱包地址（仔细核对，错误无法追回）
3. 选择提现网络（必须与目标地址匹配）
4. 输入提现金额
5. 完成安全验证（邮箱验证码 + 2FA 如已开启）
6. 点击「确认提现」
7. 等待处理（通常 24 小时内，小额可能自动发放）

**提现规则：**
- **最低提现金额：** 20 USDT
- **手续费：** 1-5 USDT（视网络而定，BSC 最低约 1 USDT）
- **处理时间：** 工作日 24 小时内；节假日可能延迟至 48 小时
- **小额自动发放：** 金额 ≤ 500 USDT 的提现会自动处理，无需人工审核

**提现限额：**
- 单笔最大：10,000 USDT
- 24 小时累计最大：30,000 USDT
- 如需超额提现，请联系客服进行人工审核

**地址安全核对：**
提现前请逐字核对提现地址的**前 6 位和后 6 位**，防止剪贴板劫持攻击（某些恶意软件会替换剪贴板中的钱包地址）。`,
      contentEn: `Withdraw USDT from your Hoot wallet to your external wallet or exchange.

**Withdrawal Steps:**
1. Go to Hoot → Wallet → Withdraw
2. Enter the destination wallet address (double-check carefully — errors cannot be reversed)
3. Select the withdrawal network (must match the destination address)
4. Enter the withdrawal amount
5. Complete security verification (email code + 2FA if enabled)
6. Click "Confirm Withdrawal"
7. Wait for processing (usually within 24 hours; small amounts may be sent automatically)

**Withdrawal Rules:**
- **Minimum withdrawal:** 20 USDT
- **Fee:** 1-5 USDT (depends on network; BSC lowest at ~1 USDT)
- **Processing time:** Within 24 hours on business days; may be delayed to 48 hours on holidays
- **Auto-processing for small amounts:** Withdrawals ≤ 500 USDT are processed automatically without manual review

**Withdrawal Limits:**
- Max per transaction: 10,000 USDT
- Max 24-hour cumulative: 30,000 USDT
- For larger withdrawals, contact support for manual review

**Address Security Check:**
Before withdrawing, verify the **first 6 and last 6 characters** of the withdrawal address character by character to guard against clipboard hijacking attacks (some malware replaces wallet addresses in the clipboard).`,
    },
    {
      titleZh: '交易所余额查看',
      titleEn: 'Viewing Exchange Balances',
      contentZh: `绑定交易所 API Key 后，Hoot 可以实时读取您在交易所的合约账户余额，方便您统一监控资产。

**可查看的余额信息：**
- **可用余额（Available Margin）：** 当前可用于开仓的 USDT 数量
- **已用保证金（Used Margin）：** 当前持仓所占用的保证金
- **未实现盈亏（Unrealized PnL）：** 所有未平仓持仓的浮动盈亏
- **总权益（Total Equity）：** 可用余额 + 已用保证金 + 未实现盈亏

**查看方式：**
1. 进入 Hoot → 钱包
2. 在「交易所账户」区域可看到实时余额
3. 数据每 30 秒自动刷新一次
4. 也可在「AI 交易」页面顶部的账户信息栏查看

**重要说明：**
- Hoot 显示的交易所余额是**只读**的，不会影响您在交易所的正常使用
- 您仍然可以随时登录 Binance 查看账户、手动操作（但建议不要与 Hoot 的 AI 策略发生冲突）
- 如果您在 Binance 手动开仓而 Hoot 同时有 AI 策略运行，可能导致超出风控参数的情况，请注意协调`,
      contentEn: `After connecting your exchange API Key, Hoot can read your exchange futures account balance in real time, allowing you to monitor your assets in one place.

**Balance Information Available:**
- **Available Margin:** Amount of USDT currently available for opening positions
- **Used Margin:** Margin currently occupied by open positions
- **Unrealized PnL:** Floating profit and loss from all open positions
- **Total Equity:** Available Margin + Used Margin + Unrealized PnL

**How to View:**
1. Go to Hoot → Wallet
2. The "Exchange Account" section shows real-time balances
3. Data auto-refreshes every 30 seconds
4. You can also view it in the account info bar at the top of the "AI Trading" page

**Important Notes:**
- The exchange balance shown in Hoot is **read-only** and does not affect your normal exchange usage
- You can still log in to Binance at any time to view your account or operate manually (but be careful not to conflict with Hoot's AI strategies)
- If you manually open positions on Binance while Hoot's AI strategies are running, this may push beyond your configured risk control parameters — please coordinate accordingly`,
    },
    {
      titleZh: '充提注意事项',
      titleEn: 'Deposit & Withdrawal Precautions',
      contentZh: `在进行资金充提操作时，请特别注意以下事项，避免资金损失。

**充值注意事项：**

⚠️ **网络必须匹配**
充值地址和您从哪个链转账**必须完全一致**。
- 如果 Hoot 显示的是 BSC 地址，您必须从 BSC 网络转账
- 如果错误地从 ERC20 网络转账到 BSC 地址，资金将**永久丢失**，无法找回

⚠️ **小额测试原则**
首次充值，建议先充值 10-20 USDT 进行测试，确认到账后再充值大额。

⚠️ **等待确认**
充值后不要立即操作，等待区块确认完成（1-5 分钟），Telegram 通知到达后再开始交易。

**提现注意事项：**

⚠️ **地址核对**
提现地址输入错误，资金**无法追回**。务必逐字检查前 6 位和后 6 位，或使用扫码方式。

⚠️ **网络匹配**
提现网络必须与目标地址所在网络匹配。向交易所提现时，请在交易所充值页面确认该交易所支持的网络。

⚠️ **不要向合约地址提现**
提现目标地址必须是普通钱包地址，不要向智能合约地址（如 DeFi 协议）提现，可能导致资金锁定。

**如遇资金问题：**
- 超过 30 分钟未到账：联系 Hoot 客服，提供交易哈希（TxHash）
- 发现账户异常：立即冻结账户并联系客服`,
      contentEn: `Please pay special attention to the following when depositing or withdrawing funds to avoid losses.

**Deposit Precautions:**

⚠️ **Network Must Match**
The deposit address and the chain you're transferring from **must match exactly**.
- If Hoot shows a BSC address, you must transfer from the BSC network
- If you accidentally transfer from ERC20 to a BSC address, funds will be **permanently lost** and unrecoverable

⚠️ **Small Test First**
For your first deposit, try a small amount (10-20 USDT) to verify it arrives before depositing larger amounts.

⚠️ **Wait for Confirmation**
After depositing, don't act immediately — wait for block confirmations to complete (1-5 minutes). Start trading after the Telegram notification arrives.

**Withdrawal Precautions:**

⚠️ **Verify Address**
If you enter the wrong withdrawal address, funds are **unrecoverable**. Always verify the first 6 and last 6 characters, or use QR code scanning.

⚠️ **Network Match**
The withdrawal network must match the network of the destination address. When withdrawing to an exchange, check the deposit page of that exchange to confirm which networks it supports.

⚠️ **Do Not Withdraw to Contract Addresses**
The withdrawal destination must be a regular wallet address. Do not withdraw to smart contract addresses (e.g., DeFi protocols) as this may lock your funds.

**If You Encounter Fund Issues:**
- Funds not arrived after 30+ minutes: Contact Hoot support with the transaction hash (TxHash)
- Suspicious account activity noticed: Immediately freeze the account and contact support`,
      type: 'warning',
    },
  ],
}

// ============================================
// 6. HOOT 代币经济 / HOOT Token Economics
// ============================================
export const hootToken: HelpArticle = {
  slug: 'hoot-token',
  titleZh: 'HOOT 代币经济',
  titleEn: 'HOOT Token Economics',
  descriptionZh: '了解 HOOT 代币的获取方式、质押机制与生态价值',
  descriptionEn: 'Learn how to earn HOOT tokens, the staking mechanism, and ecosystem value',
  sections: [
    {
      titleZh: 'HOOT 代币概览',
      titleEn: 'HOOT Token Overview',
      contentZh: `HOOT 是 Hoot 平台的核心生态代币，贯穿从签到到质押、从折扣到支付的完整价值链路。

**代币定位：**
HOOT 不仅仅是一个积分系统，它是连接平台所有参与者的经济纽带：
- 用户通过日常行为（签到、交易盈利、邀请）赚取 HOOT
- 质押 HOOT 可分享平台燃油费收入的 50%
- 持有/质押 HOOT 享受燃油费费率折扣
- 未来用于支付高级功能、参与治理投票

**代币路线图：**
1. **当前阶段（平台积分）：** HOOT 作为平台内部积分流通，用于签到奖励、邀请奖励、质押分红等
2. **第二阶段（TON 链上线）：** HOOT 代币在 TON 区块链上发行，可在 TON DEX 交易
3. **第三阶段（主流 DEX）：** 在 Uniswap、PancakeSwap 等主流 DEX 上线，获得更广泛流动性

**代币经济模型特点：**
- **通缩设计：** 部分使用场景消耗 HOOT（如高级功能解锁），总供应量将随时间减少
- **价值支撑：** 质押分红机制将真实的平台收入（USDT）分配给 HOOT 持有者，提供内在价值支撑
- **社区导向：** 50% 的平台燃油费收入回馈给质押社区，激励长期持有`,
      contentEn: `HOOT is the core ecosystem token of the Hoot platform, connecting a complete value chain from check-ins to staking, from discounts to payments.

**Token Positioning:**
HOOT is more than just a points system — it's the economic link connecting all platform participants:
- Users earn HOOT through daily activities (check-ins, profitable trades, referrals)
- Staking HOOT lets you share 50% of platform gas fee revenue
- Holding/staking HOOT earns gas fee rate discounts
- Future uses: pay for premium features, participate in governance voting

**Token Roadmap:**
1. **Current Phase (Platform Points):** HOOT circulates as internal platform points for check-in rewards, referral rewards, staking dividends, etc.
2. **Phase 2 (TON Chain Launch):** HOOT token issues on the TON blockchain, tradable on TON DEX
3. **Phase 3 (Mainstream DEX):** Listed on Uniswap, PancakeSwap, and other mainstream DEXes for broader liquidity

**Token Economic Model Features:**
- **Deflationary Design:** Some use cases consume HOOT (e.g., unlocking premium features), reducing total supply over time
- **Value Support:** The staking dividend mechanism distributes real platform revenue (USDT) to HOOT holders, providing intrinsic value backing
- **Community Oriented:** 50% of platform gas fee income flows back to the staking community, incentivizing long-term holding`,
    },
    {
      titleZh: '获取方式',
      titleEn: 'How to Earn HOOT',
      contentZh: `HOOT 代币有多种免费获取方式，通过日常使用平台即可持续累积。

**一次性奖励：**

| 行为 | HOOT 奖励 | 说明 |
|------|-----------|------|
| 新用户注册 | 20 HOOT | 注册即到账，无需额外操作 |
| 绑定 Telegram | 10 HOOT | 在设置中绑定 TG 账号 |
| 绑定钱包地址 | 10 HOOT | 连接 MetaMask 等 Web3 钱包 |
| 绑定邮箱 | 10 HOOT | 完善账户邮箱（如注册时未填写） |
| 成功邀请好友 | 15 HOOT/人 | 被邀请人首次订阅策略后发放 |

**持续性奖励：**

**每日签到（2-8 HOOT/天）**
连续签到递增奖励，中断后重新从 2 HOOT 开始：
- 第 1 天：2 HOOT
- 第 2 天：4 HOOT
- 第 3 天：6 HOOT
- 第 4 天及以后：8 HOOT（封顶）

**盈利交易奖励**
AI 策略产生盈利时，按盈利金额的 2 倍获得 HOOT 奖励：
- 盈利 $1 USDT → 获得 2 HOOT
- 盈利 $10 USDT → 获得 20 HOOT
- 盈利 $100 USDT → 获得 200 HOOT`,
      contentEn: `HOOT tokens can be earned for free in many ways — you can continuously accumulate them simply by using the platform daily.

**One-Time Rewards:**

| Action | HOOT Reward | Notes |
|--------|-------------|-------|
| New user registration | 20 HOOT | Credited instantly upon registration |
| Link Telegram | 10 HOOT | Link your TG account in Settings |
| Link wallet address | 10 HOOT | Connect MetaMask or another Web3 wallet |
| Link email | 10 HOOT | Complete account email (if not provided at registration) |
| Successful referral | 15 HOOT per person | Issued after referred user makes their first strategy subscription |

**Ongoing Rewards:**

**Daily Check-In (2-8 HOOT/day)**
Consecutive check-ins earn progressively more — resets to 2 HOOT if you miss a day:
- Day 1: 2 HOOT
- Day 2: 4 HOOT
- Day 3: 6 HOOT
- Day 4 and beyond: 8 HOOT (capped)

**Profitable Trade Bonus**
When AI strategies generate profit, you earn HOOT at 2x the profit amount:
- Profit $1 USDT → Earn 2 HOOT
- Profit $10 USDT → Earn 20 HOOT
- Profit $100 USDT → Earn 200 HOOT`,
    },
    {
      titleZh: '每日签到机制',
      titleEn: 'Daily Check-In Mechanism',
      contentZh: `每日签到是最简单、最稳定的 HOOT 获取方式，坚持签到可获得递增奖励。

**签到规则详解：**

**基础规则：**
- 每自然日（00:00-23:59 UTC+8）签到一次
- 基础奖励：2 HOOT/天
- 连续签到每天增加 2 HOOT，上限 8 HOOT/天
- 中断连续（漏签一天）后，下次签到从 2 HOOT 重新开始

**连续签到收益：**
- 前 3 天合计：2 + 4 + 6 = 12 HOOT
- 第 4 天起每天 8 HOOT（封顶保持）
- 30 天累计（保持连续）：12 + 27×8 = 228 HOOT
- 365 天累计（保持连续）：12 + 362×8 = 2,908 HOOT

**签到方式：**
1. **App 内签到：** 打开 Hoot App → 首页 → 点击签到按钮
2. **Telegram Bot 签到：** 打开 @HootCool_bot → 发送 /checkin
3. 两种方式等效，选择最方便的即可

**签到提醒：**
可在 Telegram Bot 中设置每日签到提醒，确保不遗漏（发送 /remind 开启）。`,
      contentEn: `Daily check-in is the simplest and most consistent way to earn HOOT, with increasing rewards for consecutive check-ins.

**Check-In Rules in Detail:**

**Basic Rules:**
- One check-in per calendar day (00:00-23:59 UTC+8)
- Base reward: 2 HOOT/day
- Consecutive check-ins add 2 HOOT per day, capped at 8 HOOT/day
- If you miss a day (break the streak), the next check-in resets to 2 HOOT

**Consecutive Check-In Earnings:**
- First 3 days total: 2 + 4 + 6 = 12 HOOT
- Day 4 onward: 8 HOOT/day (capped and maintained)
- 30-day total (maintaining streak): 12 + 27×8 = 228 HOOT
- 365-day total (maintaining streak): 12 + 362×8 = 2,908 HOOT

**Check-In Methods:**
1. **In-App Check-In:** Open Hoot App → Home → Click the check-in button
2. **Telegram Bot Check-In:** Open @HootCool_bot → Send /checkin
3. Both methods are equivalent — choose whichever is most convenient

**Check-In Reminders:**
You can set daily check-in reminders in the Telegram Bot to make sure you never miss one (send /remind to enable).`,
    },
    {
      titleZh: '质押分红机制',
      titleEn: 'Staking Dividend Mechanism',
      contentZh: `质押 HOOT 可以分享平台燃油费收入的 50%，是持有 HOOT 最重要的价值体现。

**分红来源：**
Hoot 平台收取的**所有燃油费的 50%**自动进入全网质押分红池。
例如：某周平台收取燃油费总计 10,000 USDT，则分红池为 5,000 USDT，按质押份额分配给所有质押者。

**质押权重：**

| 锁定类型 | 锁定天数 | 权重 |
|---------|---------|------|
| 活期 | 0（随时可取） | 1.0x |
| 定期 | 30 天 | 1.3x |
| 定期 | 90 天 | 1.8x |
| 定期 | 180 天 | 2.4x |
| 定期 | 365 天 | 3.0x |

**收益计算公式：**
我的周收益 = 分红池总额 × (我的质押量 × 我的权重) / 全网加权质押总量

**示例计算：**
- 分红池：5,000 USDT
- 我质押：10,000 HOOT，锁定 365 天（3.0x 权重）
- 我的加权份额：10,000 × 3.0 = 30,000
- 全网加权总量：1,000,000
- 我的周收益：5,000 × 30,000/1,000,000 = 150 USDT/周

**分红发放：** 每周一自动发放，可在钱包记录中查看每笔分红明细。`,
      contentEn: `Staking HOOT allows you to share 50% of platform gas fee revenue — the most important value expression of holding HOOT.

**Dividend Source:**
**50% of all gas fees** collected by the Hoot platform automatically flows into the global staking dividend pool.
For example: if the platform collects 10,000 USDT in gas fees in a given week, the dividend pool is 5,000 USDT, distributed to all stakers according to their share.

**Staking Weight:**

| Type | Lock-up Days | Weight |
|------|-------------|--------|
| Flexible | 0 (withdraw anytime) | 1.0x |
| Fixed | 30 days | 1.3x |
| Fixed | 90 days | 1.8x |
| Fixed | 180 days | 2.4x |
| Fixed | 365 days | 3.0x |

**Earnings Formula:**
My weekly earnings = Dividend pool × (My stake × My weight) / Total weighted stake network-wide

**Example Calculation:**
- Dividend pool: 5,000 USDT
- I stake: 10,000 HOOT, locked for 365 days (3.0x weight)
- My weighted share: 10,000 × 3.0 = 30,000
- Total weighted network-wide: 1,000,000
- My weekly earnings: 5,000 × 30,000/1,000,000 = 150 USDT/week

**Dividend Distribution:** Automatically issued every Monday. View each dividend detail in your wallet history.`,
    },
    {
      titleZh: '消耗场景',
      titleEn: 'HOOT Consumption Scenarios',
      contentZh: `HOOT 代币的消耗场景是其通缩模型的重要组成部分，减少流通供应，支撑长期价值。

**当前消耗场景：**

**1. 支付会员订阅（享折扣）**
用 HOOT 代替 USDT 支付 Pro 会员订阅费，享受 9 折优惠（比 USDT 支付便宜 10%）：
- 月费：$19.99 USDT → 约 18,000 HOOT（按当期价格）
- 季费：$49.99 USDT → 约 44,991 HOOT
- 年费：$149.99 USDT → 约 134,991 HOOT

**2. 燃油费折扣（质押量决定折扣幅度）**

| 质押量 | 燃油费折扣 | Free 用户实际费率 | Pro 用户实际费率 |
|-------|---------|-----------------|-----------------|
| 0 HOOT | 0% | 25% | 20% |
| 1,000 HOOT | 2% | 23% | 18% |
| 5,000 HOOT | 5% | 20% | 15% |
| 20,000 HOOT | 8% | 17% | 12% |
| 50,000 HOOT | 10% | 15% | 10% |

**3. 未来高级功能解锁（规划中）**
- 自定义 AI 参数调优
- 优先使用新发布的 AI 模型
- 高频信号订阅
- 跨交易所套利策略

**代币通缩保障：**
用于支付订阅的 HOOT 代币中，30% 直接销毁（Burn），永久退出流通。这确保随着平台规模扩大，HOOT 的流通量持续减少，形成通缩压力。`,
      contentEn: `HOOT token consumption scenarios are a key component of its deflationary model, reducing circulating supply and supporting long-term value.

**Current Consumption Scenarios:**

**1. Pay for Membership Subscription (with discount)**
Pay Pro membership with HOOT instead of USDT and enjoy a 10% discount:
- Monthly: $19.99 USDT → approximately 18,000 HOOT (at current price)
- Quarterly: $49.99 USDT → approximately 44,991 HOOT
- Annual: $149.99 USDT → approximately 134,991 HOOT

**2. Gas Fee Discount (determined by staking amount)**

| Staked Amount | Gas Discount | Free User Effective Rate | Pro User Effective Rate |
|--------------|-------------|--------------------------|-------------------------|
| 0 HOOT | 0% | 25% | 20% |
| 1,000 HOOT | 2% | 23% | 18% |
| 5,000 HOOT | 5% | 20% | 15% |
| 20,000 HOOT | 8% | 17% | 12% |
| 50,000 HOOT | 10% | 15% | 10% |

**3. Future Premium Feature Unlocks (Planned)**
- Custom AI parameter tuning
- Priority access to newly released AI models
- High-frequency signal subscriptions
- Cross-exchange arbitrage strategies

**Token Deflation Guarantee:**
Of the HOOT tokens used to pay subscriptions, 30% is directly burned, permanently removed from circulation. This ensures that as the platform scales, HOOT's circulating supply continuously decreases, creating deflationary pressure.`,
      type: 'success',
    },
  ],
}

// ============================================
// 7. 邀请返佣指南 / Invite & Earn
// ============================================
export const inviteEarn: HelpArticle = {
  slug: 'invite-earn',
  titleZh: '邀请返佣指南',
  titleEn: 'Invite & Earn Guide',
  descriptionZh: '通过邀请好友获取永久返佣和 HOOT 空投奖励',
  descriptionEn: 'Earn permanent referral commissions and HOOT airdrop rewards by inviting friends',
  sections: [
    {
      titleZh: '返佣机制详解',
      titleEn: 'Referral Commission Mechanism',
      contentZh: `Hoot 采用两级返佣制度，邀请好友即可获得永久被动收入。

**两级返佣结构：**

**L1 直推返佣（你直接邀请的好友）**
- 返佣比例：好友燃油费的 10%
- 永久有效：只要好友在使用 Hoot 交易，你就持续获得返佣
- 实时到账：好友每次触发燃油费扣款时，你的返佣同步到账

**L2 间推返佣（好友邀请的人）**
- 返佣比例：间接好友燃油费的 5%
- 同样永久有效，同样实时到账
- 可叠加：L1 + L2 同时生效

**返佣计算示例：**
假设您有 10 位 L1 好友，每位每月产生 100 USDT 燃油费：
- 您每月 L1 收入：10 × 100 × 10% = 100 USDT/月

如果每位 L1 好友又各自邀请了 5 位 L2 好友，每位 L2 每月产生 50 USDT 燃油费：
- 您每月 L2 收入：10 × 5 × 50 × 5% = 125 USDT/月

合计：225 USDT/月 纯被动收入

**重要说明：**
- 返佣仅基于燃油费（盈利分成），订阅费不参与返佣
- 同一用户只能被一个邀请人绑定（先到先得）
- 返佣记录可在钱包→返佣明细中查看`,
      contentEn: `Hoot uses a two-tier referral system, giving you permanent passive income for inviting friends.

**Two-Tier Commission Structure:**

**L1 Direct Referral (Friends you directly invite)**
- Commission rate: 10% of friend's gas fees
- Permanent: As long as your friend is trading on Hoot, you keep earning commissions
- Real-time crediting: Every time a friend triggers a gas fee deduction, your commission arrives simultaneously

**L2 Indirect Referral (People your friends invite)**
- Commission rate: 5% of indirect friend's gas fees
- Also permanent and credited in real time
- Stackable: L1 + L2 earn simultaneously

**Commission Calculation Example:**
Assume you have 10 L1 friends, each generating 100 USDT in gas fees per month:
- Your monthly L1 income: 10 × 100 × 10% = 100 USDT/month

If each L1 friend also invites 5 L2 friends, each generating 50 USDT in gas fees per month:
- Your monthly L2 income: 10 × 5 × 50 × 5% = 125 USDT/month

Total: 225 USDT/month in pure passive income

**Important Notes:**
- Commissions are based solely on gas fees (profit sharing) — subscription fees do not participate
- Each user can only be bound to one referrer (first come, first served)
- Commission records are viewable in Wallet → Commission Details`,
    },
    {
      titleZh: 'HOOT 空投奖励',
      titleEn: 'HOOT Airdrop Rewards',
      contentZh: `成功邀请好友不仅带来长期返佣，还能立即获得 HOOT 空投奖励。

**空投规则：**
每成功邀请 1 位好友，获得 15 HOOT 一次性空投奖励。

**"成功邀请"的定义（防刷机制）：**
被邀请人必须满足以下全部条件才视为成功邀请：
1. 使用您的邀请链接或邀请码注册
2. 完成账户邮箱验证
3. 首次订阅 AI 交易策略（绑定 API Key 并启动策略即算）

此门槛防止刷邀请，确保每一个奖励都对应真实的活跃用户。

**空投发放时机：**
被邀请人完成首次策略订阅后，15 HOOT 立即到账，无需等待。

**累积空投示例：**
- 邀请 5 人成功：75 HOOT
- 邀请 20 人成功：300 HOOT
- 邀请 50 人成功：750 HOOT
- 邀请 100 人成功：1,500 HOOT

**注意：** 邀请空投有终身上限 1,000 HOOT（即最多 66 人的空投奖励），超过上限后不再发放空投奖励，但返佣依然永久有效。`,
      contentEn: `Successfully inviting friends not only earns long-term commissions but also immediately unlocks HOOT airdrop rewards.

**Airdrop Rules:**
For each successfully invited friend, you earn a one-time 15 HOOT airdrop reward.

**Definition of "Successfully Invited" (Anti-Abuse Mechanism):**
The invited person must meet all of the following conditions to count as a successful referral:
1. Register using your referral link or code
2. Complete account email verification
3. Make their first AI strategy subscription (binding API Key and starting a strategy counts)

This threshold prevents referral farming and ensures each reward corresponds to a genuinely active user.

**Airdrop Timing:**
After the invited person completes their first strategy subscription, 15 HOOT is credited immediately — no waiting required.

**Cumulative Airdrop Examples:**
- 5 successful invites: 75 HOOT
- 20 successful invites: 300 HOOT
- 50 successful invites: 750 HOOT
- 100 successful invites: 1,500 HOOT

**Note:** Invitation airdrops have a lifetime cap of 1,000 HOOT (equivalent to about 66 referrals). After reaching this cap, airdrop rewards are no longer issued, but commissions (USDT) remain permanently valid with no cap.`,
    },
    {
      titleZh: '如何邀请好友',
      titleEn: 'How to Invite Friends',
      contentZh: `Hoot 提供多种邀请渠道，让您轻松分享邀请链接。

**获取邀请链接/邀请码：**

**通过 App 获取：**
1. 打开 Hoot App → 底部导航「我的」
2. 点击「邀请好友」
3. 可看到邀请链接和 6 位邀请码
4. 点击「复制链接」或「复制邀请码」

**通过 Telegram Bot 获取：**
1. 打开 @HootCool_bot
2. 发送 /invite
3. Bot 返回您的专属邀请链接和当前邀请统计

**分享渠道建议：**

**Twitter/X（效果最佳）：**
分享交易截图（盈利记录）+ 邀请链接，附加话题标签 #HootAI #量化交易

**Telegram 群组：**
在加密货币交流群、量化投资群中分享使用体验和邀请链接

**微信朋友圈：**
分享收益截图 + 邀请二维码，对国内用户效果好

**YouTube/抖音：**
录制 Hoot 使用教程视频，在简介中放置邀请链接（长期流量）

**查看邀请统计：**
进入「邀请好友」页面可查看：已邀请人数、待确认人数、已成功人数、累计获得返佣金额、累计获得空投 HOOT 数量。`,
      contentEn: `Hoot provides multiple invitation channels to make sharing your referral link easy.

**Getting Your Referral Link/Code:**

**Via the App:**
1. Open Hoot App → Bottom navigation "My"
2. Click "Invite Friends"
3. You'll see your referral link and 6-character referral code
4. Click "Copy Link" or "Copy Code"

**Via Telegram Bot:**
1. Open @HootCool_bot
2. Send /invite
3. The Bot returns your exclusive referral link and current referral stats

**Recommended Sharing Channels:**

**Twitter/X (Best Results):**
Share trade screenshots (profit records) + referral link with hashtags #HootAI #QuantTrading

**Telegram Groups:**
Share your experience and referral link in crypto discussion and quantitative investing groups

**WeChat Moments:**
Share earnings screenshots + referral QR code — effective for Chinese users

**YouTube/TikTok:**
Record Hoot tutorial videos with referral link in the description (long-term traffic)

**Viewing Referral Statistics:**
Go to "Invite Friends" page to view: total invited, pending (registered but not subscribed), successful, cumulative commission earned, and cumulative HOOT airdrop received.`,
    },
    {
      titleZh: '邀请排行榜',
      titleEn: 'Referral Leaderboard',
      contentZh: `Hoot 设有邀请排行榜系统，顶级邀请者可获得额外奖励。

**周排行榜（每周重置）**
统计本周成功邀请人数：
- 第 1 名：额外 200 HOOT 奖励
- 第 2 名：额外 100 HOOT 奖励
- 第 3 名：额外 50 HOOT 奖励

**月排行榜（每月重置）**
统计本月成功邀请人数 + 被邀请人产生的燃油费总额：
- 第 1 名：额外 500 HOOT + 平台特别徽章
- 第 2 名：额外 300 HOOT
- 第 3 名：额外 150 HOOT

**里程碑奖励（累计邀请量）：**

| 累计成功邀请人数 | 里程碑奖励 |
|----------------|-----------|
| 5 人 | 50 HOOT 一次性奖励 |
| 20 人 | 200 HOOT 一次性奖励 |
| 50 人 | 500 HOOT 一次性奖励 |
| 100 人 | 1,000 HOOT 一次性奖励 + KOL 合作资格 |

**KOL 合作计划：**
累计成功邀请 100 人以上的用户，可申请成为 Hoot 官方 KOL 合作伙伴，享受：
- 专属高返佣比率（L1 最高 15%，L2 最高 8%）
- 专属推广物料支持
- 优先体验新功能资格
- 官方社交媒体曝光机会`,
      contentEn: `Hoot has a referral leaderboard system with extra rewards for top inviters.

**Weekly Leaderboard (Resets Every Week)**
Counts successful invitations this week:
- 1st Place: Extra 200 HOOT reward
- 2nd Place: Extra 100 HOOT reward
- 3rd Place: Extra 50 HOOT reward

**Monthly Leaderboard (Resets Every Month)**
Counts successful invitations this month + total gas fees generated by invited users:
- 1st Place: Extra 500 HOOT + special platform badge
- 2nd Place: Extra 300 HOOT
- 3rd Place: Extra 150 HOOT

**Milestone Rewards (Cumulative Invitations):**

| Cumulative Successful Invites | Milestone Reward |
|-------------------------------|-----------------|
| 5 people | 50 HOOT one-time reward |
| 20 people | 200 HOOT one-time reward |
| 50 people | 500 HOOT one-time reward |
| 100 people | 1,000 HOOT one-time reward + KOL partner eligibility |

**KOL Partnership Program:**
Users with 100+ cumulative successful referrals can apply to become an official Hoot KOL partner, enjoying:
- Exclusive higher commission rates (L1 up to 15%, L2 up to 8%)
- Exclusive promotional materials support
- Priority access to new features
- Official social media exposure opportunities`,
    },
    {
      titleZh: '注意事项',
      titleEn: 'Important Notes',
      contentZh: `参与邀请计划前，请了解以下规则和限制，确保合规参与。

**返佣计算规则：**
- 返佣基于被邀请人实际支付的燃油费金额计算
- 如被邀请人使用点卡或 HOOT 支付燃油费，同样计入返佣基数
- 返佣以 USDT 形式发放至您的 Hoot 钱包，可查看可提现
- 返佣没有有效期，永久有效

**防滥用机制（反刷邀请保护）：**

以下情况系统会自动检测并取消奖励：
- 同 IP 注册：同一 IP 地址注册的多个账号不计有效邀请
- 同设备注册：同一手机/电脑设备注册的多个账号不计有效邀请
- 自邀请：用自己的邀请码注册新账号不计有效邀请
- 虚假订阅：注册后立即取消订阅（无实际使用）不计有效邀请

**终身邀请空投上限：**
邀请空投（15 HOOT/人）的终身上限为 1,000 HOOT。达到上限后，不再发放空投奖励，但返佣（USDT）依然永久有效，无上限。

**返佣到账时间：**
返佣实时处理，通常在被邀请人燃油费扣款后 1-3 分钟内到账。

**查看方式：**
Hoot App → 钱包 → 返佣明细（可按时间段筛选，查看每笔返佣的来源用户和金额）`,
      contentEn: `Before joining the referral program, please understand the following rules and limitations to ensure compliant participation.

**Commission Calculation Rules:**
- Commissions are calculated based on the actual gas fees paid by invited users
- If invited users pay gas fees with point cards or HOOT, these also count toward the commission base
- Commissions are paid in USDT to your Hoot wallet and are viewable and withdrawable
- Commissions never expire — they are permanently valid

**Anti-Abuse Mechanisms (Anti-Farming Protection):**

The system automatically detects and nullifies rewards in the following cases:
- Same IP registration: Multiple accounts registered from the same IP don't count as valid referrals
- Same device registration: Multiple accounts registered on the same phone/computer don't count as valid referrals
- Self-referral: Registering a new account with your own referral code doesn't count
- Fake subscription: Registering and immediately canceling subscription (no actual usage) doesn't count

**Lifetime Referral Airdrop Cap:**
The lifetime cap for referral airdrops (15 HOOT per person) is 1,000 HOOT. After reaching this cap, airdrop rewards are no longer issued, but commissions (USDT) remain permanently valid with no cap.

**Commission Arrival Time:**
Commissions are processed in real time, typically arriving within 1-3 minutes after the invited user's gas fee is deducted.

**How to View:**
Hoot App → Wallet → Commission Details (filterable by time period, showing the source user and amount for each commission)`,
      type: 'info',
    },
  ],
}

// ============================================
// 8. 计费与安全 / Billing & Security
// ============================================
export const billingSecurity: HelpArticle = {
  slug: 'billing-security',
  titleZh: '计费与安全',
  titleEn: 'Billing & Security',
  descriptionZh: '了解燃油费计费模式、会员订阅、点卡系统与账户安全设置',
  descriptionEn: 'Understand the gas fee model, membership subscription, point card system, and account security settings',
  sections: [
    {
      titleZh: '燃油费（Gas Fee）详解',
      titleEn: 'Gas Fee Explained',
      contentZh: `燃油费是 Hoot 的核心收费机制，也是行业最友好的计费模式之一。

**核心原则：只赚钱才收费**

**燃油费计算规则：**
- 仅在盈利平仓时收取
- 收取金额 = 本次平仓盈利金额 × 燃油费率
- 亏损交易 → 燃油费 = $0
- 保本平仓 → 燃油费 = $0
- 盈利平仓 → 燃油费 = 盈利 × 费率

**费率标准：**

| 用户类型 | 燃油费率 | 说明 |
|---------|---------|------|
| Free 用户 | 25% | 无需任何订阅，盈利分 25% |
| Pro 会员 | 20% | 月付/季付/年付 Pro 会员享受 |
| 质押折扣 | 最高 -10% | 质押 HOOT 可叠加降低费率 |
| Pro + 最高质押 | 最低 10% | Pro 会员 + 质押 50,000 HOOT |

**燃油费去向：**
- 50% → 全网 HOOT 质押分红池（回馈给质押用户）
- 30% → 平台运营（服务器、开发、团队）
- 20% → HOOT 代币回购销毁（通缩支撑）

**示例：**
一笔交易盈利 $100 USDT，Pro 会员 + 质押 5,000 HOOT（折扣 5%）：
- 实际费率：20% - 5% = 15%
- 燃油费：$100 × 15% = $15 USDT
- 您实际到手：$100 - $15 = $85 USDT`,
      contentEn: `Gas fees are Hoot's core billing mechanism and one of the most user-friendly pricing models in the industry.

**Core Principle: Only pay when you profit**

**Gas Fee Calculation Rules:**
- Only charged on profitable position closes
- Amount = Profit from this close × Gas fee rate
- Losing trade → Gas fee = $0
- Break-even close → Gas fee = $0
- Profitable close → Gas fee = Profit × Rate

**Rate Standards:**

| User Type | Gas Fee Rate | Notes |
|-----------|-------------|-------|
| Free User | 25% | No subscription needed; share 25% of profits |
| Pro Member | 20% | Monthly/quarterly/annual Pro members |
| Staking Discount | Up to -10% | Stack reduction by staking HOOT |
| Pro + Max Staking | As low as 10% | Pro member + staking 50,000 HOOT |

**Where Gas Fees Go:**
- 50% → Global HOOT staking dividend pool (returned to stakers)
- 30% → Platform operations (servers, development, team)
- 20% → HOOT token buyback and burn (deflation support)

**Example:**
A trade profits $100 USDT, user is Pro member + staking 5,000 HOOT (5% discount):
- Effective rate: 20% - 5% = 15%
- Gas fee: $100 × 15% = $15 USDT
- Your actual take-home: $100 - $15 = $85 USDT`,
    },
    {
      titleZh: 'Pro 会员订阅',
      titleEn: 'Pro Membership Subscription',
      contentZh: `Pro 会员可享受更低的燃油费率和更多策略配额，适合重度用户。

**会员价格：**

| 套餐 | 价格 | 等效月价 | 节省 |
|------|------|---------|------|
| 月付 | $19.99 USDT | $19.99 | — |
| 季付 | $49.99 USDT | $16.66 | 省 17% |
| 年付 | $149.99 USDT | $12.50 | 省 37% |

**Pro 会员特权对比：**

| 功能 | Free 用户 | Pro 会员 |
|------|----------|---------|
| 燃油费率 | 25% | 20% |
| 同时运行策略数 | 2 个 | 10 个 |
| 深研报告发起 | 仅看公开报告 | 可自定义发起 |
| API Key 绑定数 | 1 个交易所 | 5 个交易所 |
| 历史记录查看 | 最近 30 天 | 全部历史 |
| 客服优先级 | 普通队列 | 优先响应 |
| 新功能优先体验 | 否 | 是 |

**支付方式：**
- USDT 余额直接扣款
- 点卡（1 点卡 = 1 USDT）
- 未来支持 HOOT 支付（享额外折扣）

**订阅管理：**
- 自动续订：到期前 3 天自动从账户余额扣款
- 关闭自动续订：进入「设置」→「会员订阅」→「取消自动续订」
- 取消后当前周期仍然有效，到期后降为 Free 用户
- 不支持退款（已开始的订阅周期）`,
      contentEn: `Pro members enjoy lower gas fee rates and larger strategy quotas — ideal for heavy users.

**Membership Pricing:**

| Plan | Price | Effective Monthly | Savings |
|------|-------|------------------|---------|
| Monthly | $19.99 USDT | $19.99 | — |
| Quarterly | $49.99 USDT | $16.66 | Save 17% |
| Annual | $149.99 USDT | $12.50 | Save 37% |

**Pro Membership Benefits Comparison:**

| Feature | Free User | Pro Member |
|---------|----------|------------|
| Gas fee rate | 25% | 20% |
| Concurrent running strategies | 2 | 10 |
| Research report initiation | View public reports only | Custom initiation |
| API Key bindings | 1 exchange | 5 exchanges |
| History access | Last 30 days | Full history |
| Support priority | Standard queue | Priority response |
| Early access to new features | No | Yes |

**Payment Methods:**
- USDT balance direct deduction
- Point cards (1 point = 1 USDT)
- Future: HOOT payment with additional discount

**Subscription Management:**
- Auto-renewal: Automatically deducted from account balance 3 days before expiration
- Cancel auto-renewal: Go to "Settings" → "Membership" → "Cancel Auto-Renewal"
- Current period remains active after cancellation; account downgrades to Free upon expiration
- No refunds for already-started subscription periods`,
    },
    {
      titleZh: '点卡系统',
      titleEn: 'Point Card System',
      contentZh: `点卡是 Hoot 平台的预付费代金券，面值 1 点卡 = 1 USDT，是 USDT 的等价替代支付手段。

**点卡用途：**
- 支付 Pro 会员订阅费（与 USDT 等价）
- 支付燃油费（系统自动优先扣除点卡余额）
- 未来活动消耗场景

**点卡获取方式：**

| 获取方式 | 说明 |
|---------|------|
| 充值赠送 | 首次充值 ≥ $100 USDT 赠 $10 点卡（10% 赠送） |
| 邀请奖励 | 邀请好友成功，被邀请人首充时双方各得 $5 点卡 |
| 促销活动 | 节日活动、新用户专属活动等不定期发放 |
| 会员权益 | Pro 年付会员每月赠 $5 点卡（全年 $60 点卡） |

**点卡规则：**
- 优先扣除：支付时系统优先使用点卡，余额不足再用 USDT
- 不可提现：点卡不能提现为 USDT，只能在平台内消费
- 永久有效：点卡无有效期，不会过期
- 不可转让：点卡绑定账户，不可转给其他用户
- 不可退款：通过活动/奖励获得的点卡不可退款

**查看点卡余额：**
进入钱包页面，在余额区域可看到 USDT、HOOT、点卡三种余额分别显示。`,
      contentEn: `Point cards are prepaid vouchers on the Hoot platform. 1 point card = 1 USDT — an equivalent substitute payment method for USDT.

**Point Card Uses:**
- Pay Pro membership subscription fees (equivalent to USDT)
- Pay gas fees (system automatically deducts from point card balance first)
- Future activity consumption scenarios

**How to Earn Point Cards:**

| Method | Description |
|--------|-------------|
| Deposit bonus | First deposit ≥ $100 USDT earns $10 in points (10% bonus) |
| Referral reward | When an invited friend makes their first deposit, both parties get $5 in points |
| Promotional events | Holiday campaigns, new user exclusives, issued periodically |
| Membership benefit | Pro annual members receive $5 in points per month ($60 points per year) |

**Point Card Rules:**
- Deducted first: System uses point cards before USDT when paying
- Non-withdrawable: Points cannot be withdrawn as USDT
- Permanently valid: Points have no expiration date
- Non-transferable: Points are bound to your account
- Non-refundable: Points obtained through events/rewards cannot be refunded

**Viewing Point Card Balance:**
On the Wallet page, the balance area shows USDT, HOOT, and Point Cards as separate balances.`,
    },
    {
      titleZh: '账户安全设置',
      titleEn: 'Account Security Settings',
      contentZh: `完善的账户安全设置是保护您资产的第一道防线。

**密码安全：**
- 强密码要求：至少 8 位，必须包含大写字母、小写字母、数字
- 推荐：12 位以上，加入特殊符号（@#$%&）
- 密码不重用：不要使用与其他平台相同的密码
- 密码管理器：推荐使用 1Password、Bitwarden 等工具管理密码

**两步验证（2FA）设置步骤：**
1. 下载 Google Authenticator（iOS/Android）
2. 进入 Hoot → 设置 → 安全 → 两步验证
3. 扫描页面上的二维码（或手动输入密钥）
4. Google Authenticator 中出现 6 位动态码
5. 在 Hoot 输入该 6 位码完成验证
6. 系统显示 8 个备份码，立即手写保存，存放在安全位置

**备份码的重要性：**
如果丢失手机或 Google Authenticator 数据被清除，备份码是恢复账户访问权限的唯一方式。请将备份码写在纸上，存放在只有您知道的安全位置（不要保存在手机相册）。

**登录安全提示：**
- 仅在官方域名（hoot.cool）登录
- 注意识别钓鱼网站（检查 URL 拼写）
- 不要在他人设备上保存登录状态
- 发现可疑登录记录立即修改密码并联系客服

**设备管理：**
在「设置」→「登录设备」中可以查看所有已登录设备，发现陌生设备可一键下线。`,
      contentEn: `Comprehensive account security settings are the first line of defense for protecting your assets.

**Password Security:**
- Strong password requirement: Minimum 8 characters, must include uppercase, lowercase, and numbers
- Recommended: 12+ characters, add special symbols (@#$%&)
- No password reuse: Do not use the same password as other platforms
- Password manager: Recommended tools: 1Password, Bitwarden

**Two-Factor Authentication (2FA) Setup Steps:**
1. Download Google Authenticator (iOS/Android)
2. Go to Hoot → Settings → Security → Two-Factor Authentication
3. Scan the QR code on the page (or manually enter the key)
4. A 6-digit dynamic code appears in Google Authenticator
5. Enter this 6-digit code in Hoot to complete verification
6. The system displays 8 backup codes — write them down immediately and store in a safe place

**Importance of Backup Codes:**
If you lose your phone or Google Authenticator data is cleared, backup codes are the only way to regain access to your account. Write the backup codes on paper and store them in a secure location only you know (do not save in your phone's photo album).

**Login Security Tips:**
- Only log in on the official domain (hoot.cool)
- Be alert to phishing sites (check URL spelling)
- Do not save login sessions on other people's devices
- If you spot suspicious login activity, immediately change your password and contact support

**Device Management:**
In "Settings" → "Login Devices" you can view all logged-in devices and sign out any unrecognized device with one click.`,
    },
    {
      titleZh: 'API Key 安全管理',
      titleEn: 'API Key Security Management',
      contentZh: `交易所 API Key 是访问您交易账户的凭证，其安全管理至关重要。

**Hoot 的安全存储机制：**
- AES-256-GCM 加密：业界最高标准的对称加密算法
- 分离存储：加密密钥与数据分开存放，即使数据库泄露也无法解密
- 内存临时解密：仅在下单时在内存短暂解密，不落磁盘，不进日志
- 权限限制：代码层面强制禁止发起提现请求

**您应该做的：**

**权限设置最小化：**
在交易所只开启「读取」和「合约交易」权限，绝对不开「提现」权限。

**定期轮换（每 90 天）：**
1. 在 Binance 创建新 Key（相同权限）
2. 在 Hoot 更新 Key
3. 确认连接成功后删除旧 Key

**设置 IP 白名单：**
在 Binance API 设置中绑定 Hoot 服务器 IP，只有 Hoot 服务器可以使用该 Key。

**监控使用记录：**
定期查看 Binance API 使用记录，确认所有请求均为交易相关，如发现异常请求立即处理。

**紧急情况处理：**
如怀疑 Key 泄露，第一时间在 Binance 删除该 Key（无需登录 Hoot），这会立即使该 Key 失效，Hoot 的 AI 策略将暂停运行（不影响已持有仓位，需手动处理）。`,
      contentEn: `Exchange API Keys are the credentials for accessing your trading account — their security management is critical.

**Hoot's Secure Storage Mechanism:**
- AES-256-GCM encryption: Industry's highest standard symmetric encryption algorithm
- Separated storage: Encryption keys stored separately from data — even a database breach cannot decrypt
- Temporary in-memory decryption: Only briefly decrypted in memory when placing orders — never written to disk or logs
- Permission restriction: Code-level enforcement prohibits initiating withdrawal requests

**What You Should Do:**

**Minimize permissions:**
Only enable "Read" and "Futures Trading" permissions on the exchange — absolutely do not enable "Withdraw".

**Regular rotation (every 90 days):**
1. Create a new Key on Binance (same permissions)
2. Update the Key in Hoot
3. After confirming the connection succeeds, delete the old Key

**Set IP whitelist:**
Bind Hoot's server IPs in your Binance API settings — only Hoot's servers can use that Key.

**Monitor usage records:**
Regularly check Binance API usage records to confirm all requests are trade-related. Handle any unusual requests immediately.

**Emergency Response:**
If you suspect a Key has been leaked, immediately delete it on Binance (no need to log into Hoot first) — this instantly invalidates the Key. Hoot's AI strategies will pause (existing open positions must be handled manually).`,
      type: 'success',
    },
  ],
}

// ============================================
// 9. Telegram Bot 使用指南 / TG Bot Guide
// ============================================
export const tgBot: HelpArticle = {
  slug: 'tg-bot',
  titleZh: 'Telegram Bot 使用指南',
  titleEn: 'Telegram Bot Guide',
  descriptionZh: '通过 @HootCool_bot 管理账户、查看持仓、接收交易通知',
  descriptionEn: 'Manage your account, view positions, and receive trade notifications via @HootCool_bot',
  sections: [
    {
      titleZh: '开始使用',
      titleEn: 'Getting Started',
      contentZh: `Hoot Telegram Bot（@HootCool_bot）是您随时随地管理量化交易的移动指挥中心。

**找到并启动 Bot：**
1. 在 Telegram 搜索框中搜索 @HootCool_bot
2. 点击搜索结果进入 Bot 对话
3. 点击「Start」或发送 /start
4. Bot 自动欢迎并引导下一步操作

**登录方式：**

**已有 Hoot 账户（已绑定 Telegram）：**
在 Bot 中发送 /start，Bot 自动识别您的 Telegram ID 并完成静默登录，无需输入密码。

**已有 Hoot 账户（未绑定 Telegram）：**
1. 发送 /bind
2. Bot 提示输入绑定码
3. 打开 Hoot App → 设置 → 绑定 Telegram → 获取绑定码
4. 将 6 位绑定码发给 Bot
5. 绑定成功，同时获得 10 HOOT 奖励

**TG Mini App：**
在 Bot 菜单底部点击「打开 Hoot」或发送 /app，可直接在 Telegram 内打开完整的 Hoot Web 应用（TG Mini App），无需跳转浏览器，体验更流畅。

**注意：** Bot 的所有操作数据与 Hoot 网页版实时同步，查看的余额、持仓数据均为最新数据。`,
      contentEn: `Hoot Telegram Bot (@HootCool_bot) is your mobile command center for managing quantitative trading anytime, anywhere.

**Find and Launch the Bot:**
1. Search @HootCool_bot in Telegram's search bar
2. Click the search result to open the Bot conversation
3. Click "Start" or send /start
4. The Bot automatically welcomes you and guides the next steps

**Login Methods:**

**Existing Hoot account (Telegram already linked):**
Send /start in the Bot — the Bot automatically recognizes your Telegram ID and completes silent login without requiring a password.

**Existing Hoot account (Telegram not yet linked):**
1. Send /bind
2. The Bot prompts you to enter a binding code
3. Open Hoot App → Settings → Link Telegram → Get Binding Code
4. Send the 6-digit binding code to the Bot
5. Binding successful — you also receive 10 HOOT as a reward

**TG Mini App:**
At the bottom of the Bot menu, click "Open Hoot" or send /app to open the full Hoot Web application directly inside Telegram — no browser redirect needed for a smoother experience.

**Note:** All Bot operation data syncs in real time with the Hoot web version — the balances and position data you view are always current.`,
    },
    {
      titleZh: '核心命令',
      titleEn: 'Core Commands',
      contentZh: `以下是 @HootCool_bot 最常用的命令，熟记这些命令可大幅提升使用效率。

**账户与资产查看：**

/wallet — 查看钱包余额
返回您的 USDT 余额、HOOT 余额、点卡余额，以及绑定的交易所账户总权益。

/trade — 查看当前持仓
显示所有 AI 策略的当前持仓：交易对、方向（多/空）、开仓价、当前价、未实现盈亏、持仓时长。

/history — 查看交易历史
列出最近 20 条平仓记录，包含盈亏金额、持仓时间、燃油费扣款信息。

**日常操作：**

/checkin — 每日签到
完成当日签到，显示今日获得的 HOOT 数量和当前连续签到天数。

/invite — 获取邀请信息
显示您的邀请链接、邀请码，以及已邀请人数和累计获得的返佣金额。

**紧急操作：**

/closeall — 一键平仓（紧急使用）
立即停止所有 AI 策略并平掉所有持仓。此操作不可撤销，执行前 Bot 会要求二次确认。适用于市场突发极端行情、需要紧急资金等场景。

**帮助：**

/help — 查看所有命令列表`,
      contentEn: `The following are the most frequently used commands in @HootCool_bot. Memorizing these will greatly improve your efficiency.

**Account & Asset Viewing:**

/wallet — View wallet balances
Returns your USDT balance, HOOT balance, point card balance, and total equity of your linked exchange account.

/trade — View current positions
Shows all AI strategy positions: trading pair, direction (long/short), entry price, current price, unrealized P&L, and holding duration.

/history — View trading history
Lists the last 20 closed positions, including P&L amount, holding time, and gas fee deduction info.

**Daily Operations:**

/checkin — Daily check-in
Complete today's check-in, showing the HOOT earned today and the current consecutive check-in streak.

/invite — Get referral info
Shows your referral link, referral code, number of people invited, and cumulative commission earned.

**Emergency Operations:**

/closeall — Close all positions (emergency use)
Immediately stops all AI strategies and closes all positions. This action is irreversible — the Bot requires a second confirmation before executing.

**Help:**

/help — View the full command list`,
    },
    {
      titleZh: 'AI 策略管理',
      titleEn: 'AI Strategy Management',
      contentZh: `通过 Telegram Bot 可以方便地监控和管理 AI 交易策略的运行状态。

**查看策略状态：**
发送 /strategies 或点击 Bot 菜单中的「策略管理」，Bot 返回所有策略的运行状态列表。

**策略状态类型：**
- 运行中（Running）：AI 正在监控行情，随时可能开仓
- 空转中（Idle）：AI 在监控但当前行情不满足开仓条件
- 已停止（Stopped）：策略已手动停止或触发风控自动停止
- 错误（Error）：策略遇到异常（如 API 连接失败），需要处理

**策略操作（通过 Bot 菜单按钮）：**

**暂停策略：**
选择某个运行中的策略 → 点击「暂停」→ AI 停止开新仓，但现有持仓继续持有，等待 AI 正常平仓。

**停止策略（不平仓）：**
点击「停止」→ AI 完全停止，现有持仓需要手动处理（不会自动平仓）。

**停止并平仓：**
点击「停止并平仓」→ AI 停止后立即市价平掉所有该策略的持仓。

**恢复策略：**
选择已停止的策略 → 点击「恢复」→ AI 重新开始监控和交易。

**注意：** Bot 的策略操作与 Hoot App 完全同步，在 Bot 中暂停的策略，在 App 中同样显示为已暂停。`,
      contentEn: `The Telegram Bot lets you conveniently monitor and manage the running status of AI trading strategies.

**Viewing Strategy Status:**
Send /strategies or click "Strategy Management" in the Bot menu — the Bot returns a status list for all strategies.

**Strategy Status Types:**
- Running: AI is monitoring the market and may open positions at any time
- Idle: AI is monitoring but current market conditions don't meet entry criteria
- Stopped: Strategy manually stopped or automatically stopped by risk control
- Error: Strategy encountered an exception (e.g., API connection failure) that needs attention

**Strategy Operations (via Bot menu buttons):**

**Pause Strategy:**
Select a running strategy → Click "Pause" → AI stops opening new positions, but existing positions continue to be held.

**Stop Strategy (without closing positions):**
Click "Stop" → AI stops completely; existing positions must be handled manually.

**Stop and Close All:**
Click "Stop & Close" → AI stops, then immediately closes all that strategy's positions at market price.

**Resume Strategy:**
Select a stopped strategy → Click "Resume" → AI resumes monitoring and trading.

**Note:** Bot strategy operations are fully synced with the Hoot App — a strategy paused in the Bot also shows as paused in the App.`,
    },
    {
      titleZh: '交易通知设置',
      titleEn: 'Trade Notification Settings',
      contentZh: `Hoot Bot 提供全面的实时交易推送通知，让您随时掌握账户动态。

**通知类型：**

**开仓通知（每次开仓触发）**
内容包括：交易对、方向（做多/做空）、杠杆倍数、开仓价、仓位金额、策略模式、AI 置信度。

**平仓通知（每次平仓触发）**
内容包括：交易对、方向、持仓时长、平仓价、盈亏金额和百分比、燃油费扣款金额、实际到手净收益。

**风控告警（触发止损或预警）**
内容包括：策略名称、触发原因（止损/强平预警）、亏损百分比、已执行的操作（已自动平仓/已暂停策略）。

**异常告警**
内容包括：异常类型（API 连接失败/账户余额不足/交易所拒绝下单等）、影响的策略、建议处理措施。

**通知设置（自定义推送内容）：**
发送 /settings → 进入通知设置 → 可开关各类通知（可单独关闭开仓通知，保留平仓和告警通知，减少干扰）。

**通知频率：**
平台不会发送广告推送，只发送与您账户直接相关的交易和安全通知。`,
      contentEn: `Hoot Bot provides comprehensive real-time trade push notifications so you're always up to date on your account activity.

**Notification Types:**

**Open Position Notification (triggered on each trade opening)**
Content includes: trading pair, direction (long/short), leverage, entry price, position size, strategy mode, AI confidence score.

**Close Position Notification (triggered on each trade closing)**
Content includes: trading pair, direction, holding duration, close price, P&L amount and percentage, gas fee charged, net earnings.

**Risk Control Alert (stop-loss triggered or pre-warning)**
Content includes: strategy name, trigger reason (stop-loss/liquidation warning), loss percentage, action taken (auto-closed/strategy paused).

**Anomaly Alert**
Content includes: anomaly type (API connection failure/insufficient account balance/exchange order rejection, etc.), affected strategies, recommended action.

**Notification Settings (customize push content):**
Send /settings → Enter notification settings → Toggle individual notification types on/off (e.g., disable open position notifications while keeping close and alert notifications to reduce interruptions).

**Notification Frequency:**
The platform never sends promotional pushes — only trading and security notifications directly related to your account.`,
    },
    {
      titleZh: '工具命令与 Mini App',
      titleEn: 'Utility Commands & Mini App',
      contentZh: `除了核心交易功能，Bot 还提供多个实用工具命令和完整 Mini App 体验。

**工具命令：**

/bind — 绑定 Hoot 账户
未绑定账户时使用，通过绑定码将 Telegram 账号与 Hoot 账户关联，获得 10 HOOT 奖励。

/lang — 语言切换
支持中文（Chinese）和英文（English）切换，发送 /lang 按提示选择即可。

/fees — 查看燃油费记录
显示最近 30 天的燃油费扣款明细：交易对、盈利金额、费率、扣款金额。

/earnings — 查看质押分红
显示您的 HOOT 质押状态和历史分红记录。

/referral — 详细邀请统计
提供 L1/L2 分层统计、各级返佣金额、待确认邀请等详细数据。

/help — 帮助菜单
显示所有可用命令的完整列表和简要说明。

**TG Mini App（推荐使用）：**
在 Bot 对话界面底部，点击「打开 Hoot」按钮或发送 /app，可在 Telegram 内直接打开完整的 Hoot Web 应用。

Mini App 支持所有 Web 端功能：完整仪表盘、AI 策略创建和管理、钱包充提操作、设置和安全配置。

**优势：** 无需下载单独 App，在 Telegram 内即可完成所有操作，体验接近原生 App。`,
      contentEn: `Beyond core trading features, the Bot also provides several utility commands and a full Mini App experience.

**Utility Commands:**

/bind — Link Hoot account
Use when not yet linked. Associates your Telegram account with your Hoot account via a binding code, earning 10 HOOT.

/lang — Language switch
Supports Chinese and English. Send /lang and follow the prompts to select.

/fees — View gas fee records
Shows gas fee deduction details for the last 30 days: trading pair, profit, fee rate, and fee charged.

/earnings — View staking dividends
Shows your HOOT staking status and historical dividend records.

/referral — Detailed referral stats
Provides L1/L2 tier breakdown, commission amounts per tier, pending invitations, and more.

/help — Help menu
Displays the complete list of all available commands with brief descriptions.

**TG Mini App (Recommended):**
At the bottom of the Bot conversation, click the "Open Hoot" button or send /app to open the full Hoot Web application directly inside Telegram.

The Mini App supports all web features: full dashboard, AI strategy creation and management, wallet deposit/withdrawal, settings and security configuration.

**Advantage:** No separate app download needed — complete all operations within Telegram with a near-native app experience.`,
      type: 'info',
    },
  ],
}

// ============================================
// 10. 网格交易指南 / Grid Trading Guide
// ============================================
export const gridTrading: HelpArticle = {
  slug: 'grid-trading',
  titleZh: '网格交易指南',
  titleEn: 'Grid Trading Guide',
  descriptionZh: '了解 AI 增强网格交易的原理、配置方法和风险控制',
  descriptionEn: 'Understand AI-enhanced grid trading principles, configuration, and risk management',
  sections: [
    {
      titleZh: '网格交易原理',
      titleEn: 'Grid Trading Principles',
      contentZh: `网格交易是一种专为震荡行情设计的量化策略，通过在价格区间内设置多个网格层，自动实现"低买高卖"循环获利。

**基本原理：**
想象一把梯子，每一层梯子就是一个网格节点：
- 当价格下跌到某个网格节点时 → 自动买入该层
- 当价格上涨到某个网格节点时 → 自动卖出该层（如上一层有买入仓位）

如此反复，每上下穿越一个网格层，就赚取一个格间价差的利润。

**适用行情：**
- 最适合：震荡/横盘行情，价格在区间内反复波动
- 次适合：缓慢趋势行情，有方向但波动较大
- 不适合：强烈单边行情，价格持续单向下跌或上涨

**优势：**
- 无需判断涨跌方向
- 自动执行，无需盯盘
- 行情震荡越频繁，成交越多，盈利越多
- 适合 BTC、ETH 等波动相对稳定的主流资产

**核心参数：**
- 价格区间（上下边界）
- 网格数量（格数越多，格间距越小，成交更频繁）
- 每格投入金额
- 总资金上限`,
      contentEn: `Grid trading is a quantitative strategy designed for ranging markets. By setting up multiple grid levels within a price range, it automatically achieves a "buy low, sell high" cycle for recurring profits.

**Basic Principle:**
Imagine a ladder where each rung is a grid node:
- When price drops to a grid node → automatically buy at that level
- When price rises to a grid node → automatically sell at that level (if a buy position exists below)

Repeat this cycle — every time price crosses a grid level, you earn the price difference for that interval.

**Best Market Conditions:**
- Best: Ranging/sideways market, price oscillates within a range
- Good: Slow trend with high volatility
- Not suitable: Strong one-directional move, continuous directional price action

**Advantages:**
- No need to predict price direction
- Fully automated — no need to watch the screen
- The more frequent the oscillation, the more fills, the more profit
- Suitable for major assets like BTC and ETH with relatively stable volatility

**Core Parameters:**
- Price range (upper and lower boundaries)
- Number of grids (more grids = smaller intervals = more frequent fills)
- Capital per grid level
- Total capital limit`,
    },
    {
      titleZh: 'AI 增强网格',
      titleEn: 'AI-Enhanced Grid',
      contentZh: `Hoot 的网格策略不是传统的固定参数网格，而是通过 AI 实时感知市场状态、动态调整参数的智能网格。

**传统网格 vs AI 增强网格：**

| 对比项 | 传统网格 | Hoot AI 增强网格 |
|--------|---------|----------------|
| 参数设置 | 用户一次性设定，固定不变 | AI 根据市场动态调整 |
| 市场适应性 | 只适合特定区间，出界失效 | AI 识别趋势，动态扩缩边界 |
| 格间距 | 固定等比或等差 | AI 在关键支撑阻力处加密网格 |
| 杠杆 | 固定 | AI 在低波动时提高，高波动时降低 |
| 仓位分配 | 均匀分配 | AI 在趋势方向加重仓位 |

**AI 市场状态感知（Market Regime Detection）：**

**Ranging（震荡）：** 检测到价格在区间内震荡 → 维持正常网格，积极交易

**Trending（趋势）：** 检测到强方向性行情 → 减少逆势单，跟随趋势调整网格中心

**Volatile（高波动）：** 检测到异常波动 → 扩大格间距防止频繁止损，降低杠杆

**AI 调参频率：**
每隔 15-30 分钟，AI 重新评估市场状态并决定是否需要调整参数。如果市场状态未变化，则保持原参数不动，不频繁调整造成多余手续费。`,
      contentEn: `Hoot's grid strategy is not a traditional fixed-parameter grid — it's an intelligent grid that uses AI to sense market conditions in real time and dynamically adjust parameters.

**Traditional Grid vs AI-Enhanced Grid:**

| Comparison | Traditional Grid | Hoot AI-Enhanced Grid |
|------------|----------------|-----------------------|
| Parameter setting | User sets once, stays fixed | AI adjusts dynamically |
| Market adaptability | Only works in specific range | AI dynamically expands/contracts boundaries |
| Grid spacing | Fixed equal ratio | AI densifies grid at support/resistance levels |
| Leverage | Fixed | AI increases in low volatility, reduces in high volatility |
| Position allocation | Even distribution | AI weights positions in the trend direction |

**AI Market Regime Detection:**

**Ranging:** Price oscillating within a range → Maintain normal grid, trade actively

**Trending:** Strong directional move detected → Reduce counter-trend orders, adjust grid center

**Volatile:** Abnormal volatility detected → Widen spacing to prevent frequent stop-outs, reduce leverage

**AI Parameter Adjustment Frequency:**
Every 15-30 minutes, AI re-evaluates market conditions and decides whether to adjust parameters. If the regime hasn't changed, parameters remain unchanged to avoid unnecessary fees.`,
    },
    {
      titleZh: '创建网格策略',
      titleEn: 'Creating a Grid Strategy',
      contentZh: `按照以下步骤创建您的第一个 AI 网格交易策略。

**步骤一：进入网格交易**
Hoot App → AI 交易 → 选择「网格模式」

**步骤二：选择交易对**
推荐交易对：
- BTC/USDT 合约（最稳定，历史震荡区间大）
- ETH/USDT 合约（波动适中，流动性好）
- SOL/USDT 合约（波动较大，网格利润高但风险也高）
- 不建议选择小市值代币（流动性差，滑点大）

**步骤三：配置参数**

| 参数 | 推荐范围 | 说明 |
|------|---------|------|
| 网格数量 | 5-15 格 | 太少成交少，太多手续费高 |
| 每格投入金额 | $50-200 USDT | 保证每笔 ≥ MIN_NOTIONAL($20) |
| 最大总投入 | $500-2000 USDT | 控制总风险敞口 |
| 杠杆倍数 | 1-3x | 网格策略不建议高杠杆 |
| 止损设置 | 总亏损 15-20% | 单边行情保护 |

**步骤四：AI 模型选择**
推荐选择「共识模式」用于网格参数优化（多模型决策更稳健）。

**步骤五：确认并启动**
检查参数摘要 → 确认账户有足够余额 → 点击「启动网格」→ 策略开始运行`,
      contentEn: `Follow these steps to create your first AI grid trading strategy.

**Step 1: Enter Grid Trading**
Hoot App → AI Trading → Select "Grid Mode"

**Step 2: Select Trading Pair**
Recommended pairs:
- BTC/USDT Futures (most stable, historically large oscillation range)
- ETH/USDT Futures (moderate volatility, good liquidity)
- SOL/USDT Futures (higher volatility = higher grid profits but also higher risk)
- Not recommended: low market cap tokens (poor liquidity, high slippage)

**Step 3: Configure Parameters**

| Parameter | Recommended Range | Description |
|-----------|-----------------|-------------|
| Number of grids | 5-15 | Too few = infrequent fills; too many = high fees |
| Capital per grid | $50-200 USDT | Ensure each order ≥ MIN_NOTIONAL ($20) |
| Max total capital | $500-2000 USDT | Controls total risk exposure |
| Leverage | 1-3x | High leverage not recommended for grid |
| Stop-loss setting | 15-20% total loss | Protection against one-directional moves |

**Step 4: Select AI Model**
"Debate Mode" is recommended for grid parameter optimization (multi-model decisions are more stable).

**Step 5: Confirm and Launch**
Review the parameter summary → Confirm sufficient account balance → Click "Start Grid" → Strategy begins running`,
    },
    {
      titleZh: '风险控制',
      titleEn: 'Risk Control',
      contentZh: `网格交易虽然相对稳健，但仍有特定风险需要防范，以下是关键风控措施。

**最低格间利润检查：**
每个格间的利润必须高于手续费，否则越交易越亏。

计算参考：
- 格间利润 = 格间价差 / 开仓价 × 100%
- 手续费成本 ≈ 进出各一次 ≈ 0.04% × 2 = 0.08%
- 安全格间利润 ≥ 0.12% 以上

Hoot 系统自动计算并提示：如果格间距太小，系统会显示警告并建议减少格数或扩大区间。

**MIN_NOTIONAL 检查（$20 最低名义价值）：**
Binance 要求每笔订单的名义价值（价格 × 数量）≥ $20。Hoot 在下每一笔网格单前会自动检查，不满足条件的层级会自动跳过，不会报错或停止策略。

**最大资金限制：**
在策略配置中设置「最大总投入」，防止网格在单边下跌时不断加仓导致超额亏损。触发上限后，新的买单不再执行。

**总止损保护：**
设置整体策略的止损阈值（如总亏损 15%）。触发时，策略自动停止并平仓所有网格持仓，保留剩余资金。

建议止损设置不要太紧，给予网格足够的浮亏容忍空间，避免正常震荡触发止损。`,
      contentEn: `Grid trading is relatively steady but still has specific risks. Here are the key risk control measures.

**Minimum Grid Profit Check:**
Each grid interval's profit must exceed the trading fees, otherwise the more you trade, the more you lose.

Calculation reference:
- Grid interval profit = Price difference per grid / Entry price × 100%
- Fee cost ≈ entry + exit ≈ 0.04% × 2 = 0.08%
- Safe grid interval profit ≥ 0.12% or above

Hoot's system automatically calculates and alerts you: if grid spacing is too small, the system displays a warning and suggests reducing grid count or widening the range.

**MIN_NOTIONAL Check ($20 minimum notional value):**
Binance requires each order's notional value (price × quantity) ≥ $20. Hoot automatically checks this before placing every grid order. Grid levels that don't meet this are automatically skipped — no errors or strategy stops.

**Maximum Capital Limit:**
Set a "Max Total Capital" in the strategy configuration to prevent excessive losses from continuous buying during a one-directional decline. Once the limit is reached, new buy orders no longer execute.

**Overall Stop-Loss Protection:**
Set an overall strategy stop-loss threshold (e.g., 15% total loss). When triggered, the strategy automatically stops and closes all grid positions, preserving remaining capital.

It's recommended not to set stop-losses too tight — give the grid enough floating loss tolerance to avoid normal oscillations triggering the stop-loss.`,
    },
    {
      titleZh: '常见问题',
      titleEn: 'Frequently Asked Questions',
      contentZh: `以下是网格交易最常见的问题和解决方案。

**Q1：单边上涨/下跌时怎么办？**

单边上涨：所有网格的买入单无法成交（价格一直涨），只有低位的买单部分成交。策略处于空转状态，不亏损，但也无法获利。AI 会识别趋势并上移网格中心，追踪行情。

单边下跌：这是最大风险。价格持续下跌会持续触发买入，网格持仓越来越多，产生大量浮亏。此时止损设置会保护您，在亏损达到设定阈值时自动停止。建议在下跌趋势确认时手动停止网格，避免越套越深。

**Q2：手续费吃掉了利润怎么办？**

主要原因是格间距太小，解决方案：
- 减少网格数量（5-10 格）以增大格间距
- 或扩大价格区间，在相同格数下增加格间距
- 格间利润 ≥ 0.15% 才能保证净利润

**Q3：推荐的交易对和网格数量？**

| 交易对 | 推荐网格数 | 推荐总资金 | 理由 |
|--------|---------|---------|------|
| BTC/USDT | 8-12 格 | $500-2000 | 震荡幅度大，格间利润好 |
| ETH/USDT | 8-12 格 | $300-1000 | 与 BTC 相关性高，走势类似 |
| SOL/USDT | 5-8 格 | $200-500 | 波动大，格数太多风险高 |

**Q4：网格运行多久才看到效果？**

建议至少运行 7-14 天，让网格有足够多的成交次数来展现复利效应。短期（1-3天）内成交次数少，评价效果意义不大。`,
      contentEn: `Here are the most frequently asked questions about grid trading and their solutions.

**Q1: What to do during a one-directional up or down move?**

One-directional rise: All grid buy orders fail to fill (price keeps rising). Strategy is idle — no loss, but no profit either. AI will detect the trend and shift the grid center upward to track the market.

One-directional decline: This is the biggest risk. Continuous price drops keep triggering buy orders, building up large positions with growing floating losses. Your stop-loss setting will protect you, automatically stopping when losses reach the configured threshold. Consider manually stopping the grid when a downtrend is confirmed.

**Q2: Fees are eating my profits — what can I do?**

The main cause is grid spacing being too small. Solutions:
- Reduce the number of grids (5-10 levels) to increase spacing
- Or widen the price range to increase spacing with the same number of grids
- Grid interval profit ≥ 0.15% is needed to ensure net profit

**Q3: Recommended pairs and grid counts?**

| Pair | Recommended Grids | Recommended Capital | Reason |
|------|------------------|--------------------|----|
| BTC/USDT | 8-12 grids | $500-2000 | Large oscillation range, good per-grid profit |
| ETH/USDT | 8-12 grids | $300-1000 | High BTC correlation, similar price action |
| SOL/USDT | 5-8 grids | $200-500 | High volatility — too many grids increases risk |

**Q4: How long until I see results?**

It's recommended to run for at least 7-14 days to allow enough fills to demonstrate the compound effect. Short-term (1-3 days) fill counts are low and results are not meaningful to evaluate.`,
      type: 'tip',
    },
  ],
}

// ============================================
// 导出
// ============================================
export const helpArticles: Record<string, HelpArticle> = {
  'getting-started': gettingStarted,
  'ai-trading': aiTrading,
  'ai-research': aiResearch,
  'api-keys': apiKeys,
  'wallet-funds': walletFunds,
  'hoot-token': hootToken,
  'invite-earn': inviteEarn,
  'billing-security': billingSecurity,
  'tg-bot': tgBot,
  'grid-trading': gridTrading,
  // 旧 slug 兼容（重定向到新文章）
  'strategies': aiTrading,
  'deposits-withdrawals': walletFunds,
  'security': billingSecurity,
  'billing': billingSecurity,
}
