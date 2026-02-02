/**
 * 法律文档内容
 * 商用级完整法律条款
 */

export interface LegalDocumentContent {
  slug: string
  titleZh: string
  titleEn: string
  version: string
  effectiveDate: string
  contentZh: string
  contentEn: string
}

// ============================================
// 用户协议 / Terms of Service
// ============================================
export const termsOfService: LegalDocumentContent = {
  slug: 'terms',
  titleZh: '用户协议',
  titleEn: 'Terms of Service',
  version: '1.0.0',
  effectiveDate: '2026-01-01',
  contentZh: `# Hoot 平台用户协议

**版本：1.0.0**
**生效日期：2026年1月1日**
**最后更新：2026年1月1日**

---

## 第一章 总则

### 1.1 协议主体

本用户协议（以下简称"本协议"）是您（以下简称"用户"或"您"）与 Hoot 平台运营方（以下简称"Hoot"、"平台"或"我们"）之间关于使用 Hoot 平台服务所订立的协议。

### 1.2 协议效力

在使用 Hoot 平台服务之前，请您务必仔细阅读并充分理解本协议的全部内容。**当您通过网络页面点击确认、实际使用或以其他任何方式使用 Hoot 平台服务时，即表示您已阅读、理解并同意接受本协议的全部条款约束。**

如果您不同意本协议的任何内容，或者无法准确理解本协议任何条款的含义，请不要使用 Hoot 平台的任何服务。

### 1.3 协议更新

Hoot 有权根据需要不时修改本协议。协议条款一旦发生变更，我们将在平台上公布修改后的协议内容。如果您不同意修改后的协议内容，您应停止使用 Hoot 平台服务。如果您继续使用，则视为您接受修改后的协议。

---

## 第二章 服务内容

### 2.1 服务概述

Hoot 是一个 AI 驱动的量化交易技术服务平台，为用户提供以下服务：

1. **策略订阅服务**：用户可订阅平台上线的量化交易策略，接收交易信号
2. **信号分发服务**：将策略信号实时推送给订阅用户
3. **交易执行服务**：通过用户授权的交易所 API，代用户执行交易指令
4. **资产管理服务**：平台内 USDT 充值、提现及余额管理
5. **代币服务**：HOOT 代币的质押、分红等生态服务

### 2.2 服务性质

**重要声明：**
- Hoot 仅提供技术工具和信息服务，不提供任何形式的投资咨询或资产管理服务
- 平台上的策略信息和数据仅供参考，不构成任何投资建议
- 所有交易决策均由用户自行做出，用户应对其交易行为承担全部责任
- 历史收益率和回测数据不代表未来收益，过往业绩不预示未来表现

### 2.3 服务范围

Hoot 服务面向全球用户，但以下国家和地区的居民除外：
- 中国大陆
- 美国及其领土
- 朝鲜、伊朗、叙利亚、古巴、克里米亚等受制裁地区
- 其他法律法规禁止使用此类服务的地区

如果您位于上述地区，请勿使用 Hoot 服务。

---

## 第三章 用户资格与账户

### 3.1 用户资格

使用 Hoot 服务，您需要确认并保证：

1. 您已年满 18 周岁，或已达到您所在司法管辖区的法定成年年龄
2. 您具有完全民事行为能力，能够独立承担法律责任
3. 您不是任何被禁止使用本服务的司法管辖区的居民或公民
4. 您使用本服务不违反您所在地的任何适用法律法规
5. 您不在任何金融制裁名单上

### 3.2 账户注册

1. 您可通过以下方式注册 Hoot 账户：
   - 电子邮箱注册
   - 加密货币钱包地址登录
   - Telegram 账户绑定

2. 注册时，您应当：
   - 提供真实、准确、完整的个人信息
   - 及时更新个人信息以保持其真实性和有效性
   - 妥善保管账户登录凭证

### 3.3 账户安全

1. 您有责任维护账户和密码的安全性
2. 您应当对账户下的所有活动承担责任
3. 如发现任何未经授权使用账户的情况，您应立即通知 Hoot
4. 我们强烈建议您启用两步验证（2FA）以增强账户安全
5. 请勿将账户借给他人使用或转让账户

### 3.4 账户限制与终止

Hoot 保留以下权利：

1. 拒绝向任何人提供服务，无需说明理由
2. 在以下情况下限制、暂停或终止您的账户：
   - 违反本协议任何条款
   - 涉嫌欺诈、洗钱或其他违法行为
   - 收到监管机构或执法机关的要求
   - 出于安全考虑或风险控制需要
3. 对于违规账户，有权扣留相关资产直至问题解决

---

## 第四章 交易所 API 授权

### 4.1 API 授权说明

1. 为使用 Hoot 的交易执行服务，您需要提供您在第三方加密货币交易所的 API 密钥
2. 您授权 Hoot 使用该 API 密钥代您在相应交易所执行交易指令
3. 该授权仅限于交易执行，不包括资金提取

### 4.2 API 权限要求

1. **必须开启**：现货交易权限、合约交易权限（如需使用）
2. **禁止开启**：资金提取/提现权限
3. **建议开启**：IP 白名单限制（如交易所支持）

### 4.3 API 安全

1. Hoot 使用 AES-256-GCM 军用级加密算法存储您的 API 密钥
2. 您的 API 密钥在传输和存储过程中均为加密状态
3. 即使是 Hoot 的技术人员也无法查看您的原始 API 密钥
4. 您应定期检查交易所的 API 使用记录，确保无异常

### 4.4 责任声明

1. Hoot 不控制、不托管您的交易所资产
2. 您的资产始终由第三方交易所保管
3. 交易所本身的安全问题（如被黑客攻击、破产等）不属于 Hoot 责任范围
4. 因 API 权限设置不当导致的损失由您自行承担

---

## 第五章 费用与支付

### 5.1 收费模式

Hoot 采用以下收费模式：

1. **策略订阅费**
   - 按策略定价，按月收取
   - 订阅后 30 天内有效
   - 具体价格以订阅时显示为准

2. **燃油费（Gas Fee）**
   - 仅在盈利交易平仓时收取
   - 费率：盈利金额的 20%
   - 亏损交易不收取任何费用

3. **提现手续费**
   - 根据链网络不同，收取相应的网络手续费
   - 具体金额以提现时显示为准

### 5.2 支付方式

1. 策略订阅费可使用以下方式支付：
   - 平台 USDT 余额
   - 点卡余额（1 点卡 = 1 USDT）

2. 燃油费将从您的交易盈利中自动扣除

### 5.3 退款政策

1. 策略订阅费一经支付，不予退款
2. 如因 Hoot 技术故障导致服务中断超过 24 小时，我们将按比例补偿订阅时长
3. 点卡充值后不可退款，仅可用于平台消费

### 5.4 费用调整

Hoot 保留调整费用标准的权利。费用调整将提前 7 天在平台公告，调整后的费用仅对新订阅生效，不影响已生效的订阅。

---

## 第六章 用户行为规范

### 6.1 禁止行为

在使用 Hoot 服务时，您承诺不会：

1. **违法违规行为**
   - 利用平台从事洗钱、恐怖融资等违法活动
   - 规避任何适用的法律法规或监管要求
   - 进行市场操纵或任何形式的欺诈行为

2. **技术滥用行为**
   - 尝试未经授权访问平台系统或其他用户账户
   - 使用自动化工具（机器人、爬虫等）干扰平台正常运行
   - 传播恶意软件、病毒或有害代码
   - 进行逆向工程、反编译或解密平台软件

3. **其他不当行为**
   - 发布虚假、误导性或诽谤性信息
   - 冒充他人或虚假陈述与 Hoot 的关系
   - 将账户用于商业目的或转售服务
   - 任何损害 Hoot 或其他用户利益的行为

### 6.2 违规处理

对于违反上述规定的用户，Hoot 有权：

1. 发出警告或要求整改
2. 限制或暂停部分或全部服务
3. 永久终止账户
4. 冻结或扣留相关资产
5. 向有关部门报告并配合调查
6. 追究法律责任

---

## 第七章 知识产权

### 7.1 平台权利

1. Hoot 平台的所有内容，包括但不限于：
   - 软件、源代码、算法
   - 商标、标识、图形
   - 文字、图片、视频
   - 用户界面设计
   均受知识产权法律保护，归 Hoot 或其许可方所有

2. 未经书面许可，您不得：
   - 复制、修改、传播平台内容
   - 使用 Hoot 的商标、标识
   - 将平台内容用于商业目的

### 7.2 用户内容

1. 您保留对您上传到平台的内容的所有权
2. 您授予 Hoot 非独家、全球性、免版税的许可，以使用、复制、修改您的内容用于提供服务

---

## 第八章 隐私保护

Hoot 重视用户隐私保护。关于我们如何收集、使用、存储和保护您的个人信息，请参阅《隐私政策》。使用 Hoot 服务即表示您同意《隐私政策》的条款。

---

## 第九章 风险提示与免责声明

### 9.1 投资风险

**重要警告：数字资产交易存在重大风险，可能导致您全部本金损失。**

1. 市场波动风险：数字资产价格可能在短时间内剧烈波动
2. 策略风险：任何策略都可能失效，历史表现不代表未来收益
3. 技术风险：系统故障、网络延迟可能导致交易执行与预期不符
4. 流动性风险：某些交易对可能缺乏流动性
5. 监管风险：监管政策变化可能影响服务提供

### 9.2 免责声明

1. Hoot 不对以下情况承担责任：
   - 市场波动导致的投资损失
   - 策略失效导致的投资损失
   - 第三方交易所的问题（包括但不限于系统故障、安全漏洞、破产等）
   - 不可抗力事件导致的损失
   - 用户违规操作导致的损失

2. Hoot 提供的信息仅供参考，不构成投资建议
3. 您应当独立评估投资风险，并对您的投资决策负完全责任

### 9.3 责任限制

在法律允许的最大范围内：
1. Hoot 对您使用服务可能遭受的任何间接、偶发、特殊、惩罚性或后果性损害不承担责任
2. Hoot 的总责任以您在产生争议前 12 个月内向 Hoot 支付的费用为限

---

## 第十章 争议解决

### 10.1 协商解决

如发生任何争议，双方应首先通过友好协商解决。

### 10.2 仲裁

协商不成的，任何一方可将争议提交香港国际仲裁中心（HKIAC），按照提交仲裁时有效的《香港国际仲裁中心机构仲裁规则》进行仲裁。仲裁地点为香港，仲裁语言为中文或英文。

### 10.3 管辖法律

本协议的订立、效力、解释、履行和争议解决均适用中国香港特别行政区法律。

---

## 第十一章 其他条款

### 11.1 完整协议

本协议（包括《隐私政策》、《风险提示》及平台规则）构成您与 Hoot 之间关于使用服务的完整协议。

### 11.2 可分割性

如本协议任何条款被认定为无效或不可执行，该条款应被修改以使其有效可执行，同时尽可能保留原意。其余条款继续有效。

### 11.3 权利放弃

Hoot 未行使或延迟行使本协议下的任何权利，不构成对该权利的放弃。

### 11.4 转让

未经 Hoot 书面同意，您不得转让本协议下的任何权利或义务。Hoot 可以自由转让本协议。

### 11.5 联系方式

如有任何问题，请通过以下方式联系我们：
- 电子邮箱：support@hoot.trade
- Telegram：@hoot_support

---

**感谢您选择 Hoot 平台！**

© 2024-2026 Hoot. All rights reserved.`,

  contentEn: `# Hoot Platform Terms of Service

**Version: 1.0.0**
**Effective Date: January 1, 2026**
**Last Updated: January 1, 2026**

---

## Chapter 1: General Provisions

### 1.1 Parties to the Agreement

This User Agreement (hereinafter referred to as "Agreement") is entered into between you (hereinafter referred to as "User" or "you") and the operator of Hoot Platform (hereinafter referred to as "Hoot", "Platform" or "we") regarding the use of Hoot Platform services.

### 1.2 Effectiveness of Agreement

Before using Hoot Platform services, please carefully read and fully understand all contents of this Agreement. **By clicking to confirm through web pages, actual use, or any other means of using Hoot Platform services, you indicate that you have read, understood, and agreed to accept all terms of this Agreement.**

If you do not agree to any content of this Agreement, or cannot accurately understand the meaning of any terms, please do not use any services of Hoot Platform.

### 1.3 Agreement Updates

Hoot reserves the right to modify this Agreement as needed from time to time. Once the terms are changed, we will publish the modified Agreement on the Platform. If you do not agree to the modified Agreement, you should stop using Hoot Platform services. If you continue to use, you are deemed to accept the modified Agreement.

---

## Chapter 2: Service Content

### 2.1 Service Overview

Hoot is an AI-powered quantitative trading technology service platform that provides users with the following services:

1. **Strategy Subscription Service**: Users can subscribe to quantitative trading strategies listed on the platform and receive trading signals
2. **Signal Distribution Service**: Real-time push of strategy signals to subscribed users
3. **Trade Execution Service**: Execute trading orders on behalf of users through authorized exchange APIs
4. **Asset Management Service**: USDT deposit, withdrawal and balance management within the platform
5. **Token Services**: HOOT token staking, dividends and other ecosystem services

### 2.2 Nature of Services

**Important Statement:**
- Hoot only provides technical tools and information services, not any form of investment advice or asset management services
- Strategy information and data on the platform are for reference only and do not constitute any investment advice
- All trading decisions are made by users themselves, and users shall bear full responsibility for their trading activities
- Historical returns and backtesting data do not represent future returns; past performance does not predict future results

### 2.3 Service Scope

Hoot services are available to users globally, except for residents of the following countries and regions:
- Mainland China
- United States and its territories
- Sanctioned regions including North Korea, Iran, Syria, Cuba, Crimea
- Other regions where such services are prohibited by law

If you are located in the above regions, please do not use Hoot services.

---

## Chapter 3: User Eligibility and Account

### 3.1 User Eligibility

To use Hoot services, you need to confirm and warrant:

1. You are at least 18 years old, or have reached the legal age of majority in your jurisdiction
2. You have full civil capacity and can independently bear legal responsibility
3. You are not a resident or citizen of any jurisdiction prohibited from using this service
4. Your use of this service does not violate any applicable laws in your location
5. You are not on any financial sanctions list

### 3.2 Account Registration

1. You can register a Hoot account through the following methods:
   - Email registration
   - Cryptocurrency wallet address login
   - Telegram account binding

2. When registering, you should:
   - Provide true, accurate, and complete personal information
   - Update personal information promptly to maintain its authenticity and validity
   - Properly safeguard account login credentials

### 3.3 Account Security

1. You are responsible for maintaining the security of your account and password
2. You shall be responsible for all activities under your account
3. If you discover any unauthorized use of your account, you should immediately notify Hoot
4. We strongly recommend enabling two-factor authentication (2FA) to enhance account security
5. Do not lend your account to others or transfer your account

### 3.4 Account Restrictions and Termination

Hoot reserves the following rights:

1. Refuse to provide services to anyone without explanation
2. Restrict, suspend, or terminate your account in the following circumstances:
   - Violation of any terms of this Agreement
   - Suspected fraud, money laundering or other illegal activities
   - Receipt of requirements from regulatory agencies or law enforcement
   - For security or risk control purposes
3. Withhold related assets from violating accounts until issues are resolved

---

## Chapter 4: Exchange API Authorization

### 4.1 API Authorization Description

1. To use Hoot's trade execution service, you need to provide your API keys from third-party cryptocurrency exchanges
2. You authorize Hoot to use the API keys to execute trading orders on your behalf on the corresponding exchanges
3. This authorization is limited to trade execution and does not include fund withdrawal

### 4.2 API Permission Requirements

1. **Must Enable**: Spot trading permission, futures trading permission (if needed)
2. **Must NOT Enable**: Fund withdrawal permission
3. **Recommended**: IP whitelist restriction (if supported by exchange)

### 4.3 API Security

1. Hoot uses AES-256-GCM military-grade encryption to store your API keys
2. Your API keys are encrypted during transmission and storage
3. Even Hoot's technical staff cannot view your original API keys
4. You should regularly check the API usage records on exchanges to ensure no anomalies

### 4.4 Liability Disclaimer

1. Hoot does not control or custody your exchange assets
2. Your assets are always held by third-party exchanges
3. Security issues with exchanges (including but not limited to hacking, bankruptcy, etc.) are not within Hoot's scope of responsibility
4. Losses caused by improper API permission settings are your own responsibility

---

## Chapter 5: Fees and Payments

### 5.1 Fee Structure

Hoot adopts the following fee structure:

1. **Strategy Subscription Fee**
   - Priced per strategy, charged monthly
   - Valid for 30 days after subscription
   - Specific price as displayed at the time of subscription

2. **Gas Fee**
   - Charged only when closing profitable trades
   - Rate: 20% of the profit
   - No fee for losing trades

3. **Withdrawal Fee**
   - Network fees charged according to different blockchain networks
   - Specific amount as displayed at the time of withdrawal

### 5.2 Payment Methods

1. Strategy subscription fees can be paid using:
   - Platform USDT balance
   - Point card balance (1 point = 1 USDT)

2. Gas fees will be automatically deducted from your trading profits

### 5.3 Refund Policy

1. Strategy subscription fees are non-refundable once paid
2. If service interruption exceeds 24 hours due to Hoot technical failure, we will compensate subscription time proportionally
3. Point card recharges are non-refundable and can only be used for platform consumption

### 5.4 Fee Adjustments

Hoot reserves the right to adjust fee standards. Fee adjustments will be announced on the platform 7 days in advance, and adjusted fees will only apply to new subscriptions and will not affect existing subscriptions.

---

## Chapter 6: User Conduct Standards

### 6.1 Prohibited Activities

When using Hoot services, you agree not to:

1. **Illegal Activities**
   - Use the platform for money laundering, terrorist financing, or other illegal activities
   - Circumvent any applicable laws, regulations, or regulatory requirements
   - Engage in market manipulation or any form of fraud

2. **Technical Abuse**
   - Attempt unauthorized access to platform systems or other user accounts
   - Use automated tools (bots, crawlers, etc.) to interfere with normal platform operations
   - Spread malware, viruses, or harmful code
   - Reverse engineer, decompile, or decrypt platform software

3. **Other Improper Conduct**
   - Post false, misleading, or defamatory information
   - Impersonate others or misrepresent your relationship with Hoot
   - Use accounts for commercial purposes or resell services
   - Any behavior that damages the interests of Hoot or other users

### 6.2 Violation Handling

For users who violate the above provisions, Hoot has the right to:

1. Issue warnings or require rectification
2. Restrict or suspend part or all services
3. Permanently terminate accounts
4. Freeze or withhold related assets
5. Report to relevant authorities and cooperate with investigations
6. Pursue legal liability

---

## Chapter 7: Intellectual Property

### 7.1 Platform Rights

1. All content of the Hoot Platform, including but not limited to:
   - Software, source code, algorithms
   - Trademarks, logos, graphics
   - Text, images, videos
   - User interface design
   are protected by intellectual property laws and belong to Hoot or its licensors

2. Without written permission, you may not:
   - Copy, modify, or distribute platform content
   - Use Hoot's trademarks or logos
   - Use platform content for commercial purposes

### 7.2 User Content

1. You retain ownership of all content you upload to the platform
2. You grant Hoot a non-exclusive, worldwide, royalty-free license to use, copy, and modify your content for providing services

---

## Chapter 8: Privacy Protection

Hoot values user privacy protection. For information on how we collect, use, store, and protect your personal information, please refer to our Privacy Policy. By using Hoot services, you agree to the terms of the Privacy Policy.

---

## Chapter 9: Risk Disclosure and Disclaimer

### 9.1 Investment Risks

**Important Warning: Digital asset trading carries significant risks and may result in the loss of all your principal.**

1. Market volatility risk: Digital asset prices may fluctuate dramatically in short periods
2. Strategy risk: Any strategy may fail; historical performance does not represent future returns
3. Technical risk: System failures, network delays may cause trade execution to differ from expectations
4. Liquidity risk: Some trading pairs may lack liquidity
5. Regulatory risk: Changes in regulatory policies may affect service provision

### 9.2 Disclaimer

1. Hoot is not responsible for:
   - Investment losses caused by market volatility
   - Investment losses caused by strategy failure
   - Problems with third-party exchanges (including but not limited to system failures, security vulnerabilities, bankruptcy, etc.)
   - Losses caused by force majeure events
   - Losses caused by user's improper operations

2. Information provided by Hoot is for reference only and does not constitute investment advice
3. You should independently assess investment risks and bear full responsibility for your investment decisions

### 9.3 Limitation of Liability

To the maximum extent permitted by law:
1. Hoot is not liable for any indirect, incidental, special, punitive, or consequential damages you may suffer from using the services
2. Hoot's total liability is limited to the fees you paid to Hoot in the 12 months preceding the dispute

---

## Chapter 10: Dispute Resolution

### 10.1 Negotiation

In case of any dispute, both parties shall first try to resolve it through friendly negotiation.

### 10.2 Arbitration

If negotiation fails, either party may submit the dispute to the Hong Kong International Arbitration Centre (HKIAC) for arbitration in accordance with the HKIAC Administered Arbitration Rules in force at the time of submission. The place of arbitration shall be Hong Kong, and the language of arbitration shall be Chinese or English.

### 10.3 Governing Law

The formation, validity, interpretation, performance, and dispute resolution of this Agreement shall be governed by the laws of the Hong Kong Special Administrative Region of China.

---

## Chapter 11: Miscellaneous

### 11.1 Entire Agreement

This Agreement (including the Privacy Policy, Risk Disclosure, and platform rules) constitutes the entire agreement between you and Hoot regarding the use of services.

### 11.2 Severability

If any provision of this Agreement is found to be invalid or unenforceable, that provision shall be modified to make it valid and enforceable while preserving its original intent as much as possible. The remaining provisions shall continue in effect.

### 11.3 Waiver

Hoot's failure to exercise or delay in exercising any rights under this Agreement shall not constitute a waiver of such rights.

### 11.4 Assignment

You may not assign any rights or obligations under this Agreement without Hoot's written consent. Hoot may freely assign this Agreement.

### 11.5 Contact Information

If you have any questions, please contact us through:
- Email: support@hoot.trade
- Telegram: @hoot_support

---

**Thank you for choosing Hoot Platform!**

© 2024-2026 Hoot. All rights reserved.`
}

// ============================================
// 隐私政策 / Privacy Policy
// ============================================
export const privacyPolicy: LegalDocumentContent = {
  slug: 'privacy',
  titleZh: '隐私政策',
  titleEn: 'Privacy Policy',
  version: '1.0.0',
  effectiveDate: '2026-01-01',
  contentZh: `# Hoot 平台隐私政策

**版本：1.0.0**
**生效日期：2026年1月1日**
**最后更新：2026年1月1日**

---

## 第一章 引言

Hoot 平台（以下简称"Hoot"、"我们"或"平台"）深知用户隐私的重要性，致力于保护您的个人信息安全。本隐私政策旨在向您说明我们如何收集、使用、存储、共享和保护您的个人信息，以及您享有的相关权利。

请在使用我们的服务之前仔细阅读本隐私政策。使用 Hoot 服务即表示您同意本政策的条款。

---

## 第二章 信息收集

### 2.1 您主动提供的信息

**账户信息**
- 电子邮箱地址
- 用户名/昵称
- 密码（以加密形式存储）
- 手机号码（如提供）

**身份验证信息**
- 加密货币钱包地址
- Telegram 账户 ID 和用户名

**支付与交易信息**
- 充值和提现记录
- 策略订阅记录
- 交易历史

**交易所 API 信息**
- API Key 和 Secret（使用 AES-256-GCM 加密存储）
- API 标签/名称

**通信信息**
- 客服沟通记录
- 反馈和建议

### 2.2 自动收集的信息

**设备信息**
- 设备类型和型号
- 操作系统版本
- 浏览器类型和版本
- 屏幕分辨率

**网络信息**
- IP 地址
- 网络运营商
- 地理位置（基于 IP）

**使用信息**
- 登录时间和频率
- 功能使用情况
- 页面浏览记录
- 点击行为

**日志信息**
- 系统错误日志
- API 调用日志
- 安全事件日志

### 2.3 第三方来源的信息

- 交易所 API 返回的交易数据
- 区块链上的公开交易记录

---

## 第三章 信息使用目的

我们使用收集的信息用于以下目的：

### 3.1 提供和改进服务
- 创建和管理您的账户
- 处理交易和订阅
- 执行交易信号
- 提供客户支持
- 改进产品功能和用户体验

### 3.2 安全与合规
- 验证用户身份
- 防止欺诈和滥用
- 检测和阻止恶意活动
- 遵守法律法规和监管要求
- 响应执法机关的合法要求

### 3.3 通信与通知
- 发送服务通知（如交易确认、安全警报）
- 发送产品更新和功能公告
- 发送营销信息（在您同意的情况下）

### 3.4 分析与研究
- 分析服务使用情况
- 进行统计研究
- 改进算法和策略效果

---

## 第四章 信息存储与安全

### 4.1 存储位置

您的数据存储在位于以下地区的安全服务器上：
- 新加坡
- 香港

我们选择具有高安全标准的数据中心，确保您的数据得到妥善保护。

### 4.2 安全措施

我们采取多层安全措施保护您的信息：

**技术措施**
- 所有数据传输使用 TLS 1.3 加密
- API 密钥使用 AES-256-GCM 军用级加密存储
- 敏感数据采用哈希+盐值处理
- 定期进行安全审计和渗透测试
- 实施入侵检测和防御系统

**管理措施**
- 严格的访问控制和权限管理
- 员工背景审查和安全培训
- 数据访问日志记录和审计
- 安全事件响应流程

### 4.3 数据保留

我们按以下标准保留您的数据：

| 数据类型 | 保留期限 |
|---------|---------|
| 账户基本信息 | 账户存续期间 + 注销后 30 天 |
| 交易记录 | 7 年（满足监管要求） |
| 财务记录 | 7 年（满足监管要求） |
| 登录日志 | 1 年 |
| 系统日志 | 90 天 |
| API 调用日志 | 90 天 |
| 客服记录 | 3 年 |

账户注销后，我们将在规定期限内删除或匿名化您的个人信息，但法律要求保留的除外。

---

## 第五章 信息共享与披露

### 5.1 我们不会出售您的个人信息

我们**绝不会**出售、出租或交易您的个人信息给第三方用于营销目的。

### 5.2 可能共享信息的情况

在以下情况下，我们可能需要共享您的信息：

**服务提供商**
- 云服务和托管服务提供商
- 支付处理服务商
- 客服外包服务商
- 安全服务提供商

所有服务提供商均签署严格的数据保护协议，仅能访问履行职责所必需的信息。

**法律要求**
- 遵守法院命令、传票或法律程序
- 响应政府机构的合法要求
- 保护 Hoot 或用户的合法权益
- 调查和防止欺诈或非法活动

**业务转让**
- 如发生合并、收购或资产出售，您的信息可能作为业务资产转让
- 我们将提前通知您，并确保接收方继续遵守本隐私政策

### 5.3 匿名化数据

我们可能会与第三方共享经过匿名化处理的汇总数据，用于行业分析和研究目的。这些数据无法识别任何个人身份。

---

## 第六章 Cookie 和追踪技术

### 6.1 我们使用的技术

**Cookie**
- 会话 Cookie：保持您的登录状态
- 偏好 Cookie：记住您的设置偏好
- 分析 Cookie：了解服务使用情况

**本地存储**
- 用于存储应用设置和缓存数据

### 6.2 管理 Cookie

您可以通过浏览器设置管理 Cookie 偏好：
- 接受所有 Cookie
- 拒绝所有 Cookie
- 在接收 Cookie 时收到通知

请注意，禁用某些 Cookie 可能影响您使用我们服务的体验。

---

## 第七章 您的权利

根据适用的数据保护法律，您享有以下权利：

### 7.1 访问权
您有权获取我们持有的关于您的个人信息副本。

### 7.2 更正权
您有权要求更正不准确或不完整的个人信息。

### 7.3 删除权
在某些情况下，您有权要求删除您的个人信息：
- 数据不再需要
- 您撤回同意
- 数据被非法处理

### 7.4 限制处理权
您有权要求限制我们处理您的个人信息。

### 7.5 数据可携带权
您有权以结构化、机器可读的格式获取您的数据。

### 7.6 反对权
您有权反对：
- 基于合法利益的数据处理
- 用于营销目的的数据处理

### 7.7 行使权利

要行使上述权利，请通过以下方式联系我们：
- 电子邮箱：privacy@hoot.trade
- 平台内「设置 > 隐私」页面

我们将在 30 天内响应您的请求。某些情况下可能需要验证您的身份。

---

## 第八章 未成年人保护

Hoot 服务不面向 18 岁以下的未成年人。我们不会故意收集未成年人的个人信息。如果我们发现意外收集了未成年人的信息，我们将立即删除。

如果您是家长或监护人，发现您的孩子向我们提供了个人信息，请联系我们。

---

## 第九章 跨境数据传输

您的数据可能被传输到您所在国家/地区以外的服务器进行处理和存储。我们确保：
- 数据仅传输到具有充分数据保护法律的地区
- 与所有数据接收方签署符合标准的数据传输协议
- 采取适当的安全措施保护数据传输

---

## 第十章 第三方链接

我们的服务可能包含指向第三方网站或服务的链接（如交易所网站）。我们对这些第三方的隐私实践不承担责任。建议您在访问时查阅其隐私政策。

---

## 第十一章 政策更新

我们可能会不时更新本隐私政策。更新后的政策将在平台上公布。重大变更将通过以下方式通知：
- 平台公告
- 电子邮件通知
- 应用内消息

建议您定期查看本政策以了解任何变更。继续使用服务即表示接受更新后的政策。

---

## 第十二章 联系我们

如有任何隐私相关问题或疑虑，请联系我们的数据保护官：

**电子邮箱**：privacy@hoot.trade

**邮寄地址**：
Data Protection Officer
Hoot Platform
[地址将在正式注册后公布]

我们将尽快回复您的咨询，通常在 5 个工作日内。

---

**感谢您信任 Hoot 平台！**

© 2024-2026 Hoot. All rights reserved.`,

  contentEn: `# Hoot Platform Privacy Policy

**Version: 1.0.0**
**Effective Date: January 1, 2026**
**Last Updated: January 1, 2026**

---

## Chapter 1: Introduction

Hoot Platform (hereinafter referred to as "Hoot", "we", or "Platform") understands the importance of user privacy and is committed to protecting your personal information. This Privacy Policy explains how we collect, use, store, share, and protect your personal information, as well as your related rights.

Please read this Privacy Policy carefully before using our services. By using Hoot services, you agree to the terms of this policy.

---

## Chapter 2: Information Collection

### 2.1 Information You Provide

**Account Information**
- Email address
- Username/nickname
- Password (stored in encrypted form)
- Phone number (if provided)

**Identity Verification Information**
- Cryptocurrency wallet address
- Telegram account ID and username

**Payment and Transaction Information**
- Deposit and withdrawal records
- Strategy subscription records
- Transaction history

**Exchange API Information**
- API Key and Secret (stored with AES-256-GCM encryption)
- API label/name

**Communication Information**
- Customer service communication records
- Feedback and suggestions

### 2.2 Automatically Collected Information

**Device Information**
- Device type and model
- Operating system version
- Browser type and version
- Screen resolution

**Network Information**
- IP address
- Network carrier
- Geographic location (based on IP)

**Usage Information**
- Login time and frequency
- Feature usage
- Page browsing records
- Click behavior

**Log Information**
- System error logs
- API call logs
- Security event logs

### 2.3 Information from Third-Party Sources

- Transaction data returned from exchange APIs
- Public transaction records on blockchain

---

## Chapter 3: Purpose of Information Use

We use the collected information for the following purposes:

### 3.1 Providing and Improving Services
- Creating and managing your account
- Processing transactions and subscriptions
- Executing trading signals
- Providing customer support
- Improving product features and user experience

### 3.2 Security and Compliance
- Verifying user identity
- Preventing fraud and abuse
- Detecting and blocking malicious activities
- Complying with laws, regulations, and regulatory requirements
- Responding to legitimate requests from law enforcement

### 3.3 Communications and Notifications
- Sending service notifications (e.g., transaction confirmations, security alerts)
- Sending product updates and feature announcements
- Sending marketing information (with your consent)

### 3.4 Analysis and Research
- Analyzing service usage
- Conducting statistical research
- Improving algorithm and strategy effectiveness

---

## Chapter 4: Information Storage and Security

### 4.1 Storage Location

Your data is stored on secure servers located in:
- Singapore
- Hong Kong

We select data centers with high security standards to ensure your data is properly protected.

### 4.2 Security Measures

We implement multiple layers of security measures to protect your information:

**Technical Measures**
- All data transmission uses TLS 1.3 encryption
- API keys stored with AES-256-GCM military-grade encryption
- Sensitive data processed with hash + salt
- Regular security audits and penetration testing
- Intrusion detection and prevention systems

**Administrative Measures**
- Strict access control and permission management
- Employee background checks and security training
- Data access logging and auditing
- Security incident response procedures

### 4.3 Data Retention

We retain your data according to the following standards:

| Data Type | Retention Period |
|-----------|------------------|
| Basic account information | Account duration + 30 days after deletion |
| Transaction records | 7 years (regulatory compliance) |
| Financial records | 7 years (regulatory compliance) |
| Login logs | 1 year |
| System logs | 90 days |
| API call logs | 90 days |
| Customer service records | 3 years |

After account deletion, we will delete or anonymize your personal information within the specified period, except as required by law.

---

## Chapter 5: Information Sharing and Disclosure

### 5.1 We Do Not Sell Your Personal Information

We will **never** sell, rent, or trade your personal information to third parties for marketing purposes.

### 5.2 Circumstances Where Information May Be Shared

We may need to share your information in the following circumstances:

**Service Providers**
- Cloud and hosting service providers
- Payment processing providers
- Customer service outsourcing providers
- Security service providers

All service providers sign strict data protection agreements and can only access information necessary to fulfill their duties.

**Legal Requirements**
- Complying with court orders, subpoenas, or legal processes
- Responding to legitimate requests from government agencies
- Protecting the legitimate rights of Hoot or users
- Investigating and preventing fraud or illegal activities

**Business Transfers**
- In case of merger, acquisition, or asset sale, your information may be transferred as business assets
- We will notify you in advance and ensure the recipient continues to comply with this Privacy Policy

### 5.3 Anonymized Data

We may share anonymized aggregate data with third parties for industry analysis and research purposes. This data cannot identify any individual.

---

## Chapter 6: Cookies and Tracking Technologies

### 6.1 Technologies We Use

**Cookies**
- Session cookies: Maintain your login status
- Preference cookies: Remember your settings
- Analytics cookies: Understand service usage

**Local Storage**
- Used to store application settings and cache data

### 6.2 Managing Cookies

You can manage cookie preferences through browser settings:
- Accept all cookies
- Reject all cookies
- Receive notification when receiving cookies

Please note that disabling certain cookies may affect your experience using our services.

---

## Chapter 7: Your Rights

Under applicable data protection laws, you have the following rights:

### 7.1 Right of Access
You have the right to obtain a copy of personal information we hold about you.

### 7.2 Right of Rectification
You have the right to request correction of inaccurate or incomplete personal information.

### 7.3 Right of Erasure
In certain circumstances, you have the right to request deletion of your personal information:
- Data is no longer needed
- You withdraw consent
- Data was processed unlawfully

### 7.4 Right to Restrict Processing
You have the right to request that we restrict processing of your personal information.

### 7.5 Right to Data Portability
You have the right to obtain your data in a structured, machine-readable format.

### 7.6 Right to Object
You have the right to object to:
- Data processing based on legitimate interests
- Data processing for marketing purposes

### 7.7 Exercising Your Rights

To exercise the above rights, please contact us through:
- Email: privacy@hoot.trade
- Platform "Settings > Privacy" page

We will respond to your request within 30 days. In some cases, identity verification may be required.

---

## Chapter 8: Protection of Minors

Hoot services are not intended for minors under 18 years of age. We do not knowingly collect personal information from minors. If we discover that we have accidentally collected information from a minor, we will delete it immediately.

If you are a parent or guardian and discover that your child has provided us with personal information, please contact us.

---

## Chapter 9: Cross-Border Data Transfers

Your data may be transferred to servers outside your country/region for processing and storage. We ensure:
- Data is only transferred to regions with adequate data protection laws
- Standard data transfer agreements are signed with all data recipients
- Appropriate security measures are taken to protect data transfers

---

## Chapter 10: Third-Party Links

Our services may contain links to third-party websites or services (such as exchange websites). We are not responsible for the privacy practices of these third parties. We recommend reviewing their privacy policies when visiting.

---

## Chapter 11: Policy Updates

We may update this Privacy Policy from time to time. Updated policies will be published on the platform. Significant changes will be notified through:
- Platform announcements
- Email notifications
- In-app messages

We recommend reviewing this policy regularly to stay informed of any changes. Continued use of services indicates acceptance of the updated policy.

---

## Chapter 12: Contact Us

If you have any privacy-related questions or concerns, please contact our Data Protection Officer:

**Email**: privacy@hoot.trade

**Mailing Address**:
Data Protection Officer
Hoot Platform
[Address to be published after official registration]

We will respond to your inquiry as soon as possible, typically within 5 business days.

---

**Thank you for trusting Hoot Platform!**

© 2024-2026 Hoot. All rights reserved.`
}

// ============================================
// 风险提示 / Risk Disclosure
// ============================================
export const riskDisclosure: LegalDocumentContent = {
  slug: 'risk',
  titleZh: '风险提示',
  titleEn: 'Risk Disclosure',
  version: '1.0.0',
  effectiveDate: '2026-01-01',
  contentZh: `# Hoot 平台风险提示

**版本：1.0.0**
**生效日期：2026年1月1日**
**最后更新：2026年1月1日**

---

## 重要声明

⚠️ 请在使用 Hoot 平台服务之前仔细阅读本风险提示。数字资产交易是一种高风险投资活动，可能导致您的全部本金损失。您应当在充分了解相关风险后，根据自身的财务状况和风险承受能力，审慎决定是否使用本平台服务。

---

## 第一章 市场风险

### 1.1 价格波动风险

数字资产市场具有高度波动性，价格可能在极短时间内发生剧烈变化：

- **极端波动**：数字资产价格可能在数小时甚至数分钟内上涨或下跌 10% 以上
- **闪崩风险**：市场可能出现突发性大幅下跌，触发连锁清算
- **归零风险**：某些数字资产可能因项目失败、监管打击等原因变得毫无价值
- **24/7 市场**：数字资产市场全天候运行，价格波动可能发生在任何时间

**案例警示**：历史上曾多次出现单日跌幅超过 30% 的市场事件，某些山寨币在数日内归零。

### 1.2 流动性风险

- **买卖价差**：某些交易对可能存在较大的买卖价差，导致交易成本增加
- **深度不足**：大额订单可能因市场深度不足而无法按预期价格成交
- **滑点风险**：实际成交价格可能与下单时的价格存在较大差异
- **无法平仓**：在极端市场条件下，可能无法及时平仓止损

### 1.3 杠杆风险

如果您使用杠杆进行合约交易：

- **放大损失**：杠杆会同时放大收益和损失
- **强制平仓**：保证金不足时可能被强制平仓，导致全部保证金损失
- **穿仓风险**：在极端波动下，损失可能超过初始保证金
- **资金费率**：持有合约头寸需要支付或收取资金费率，可能侵蚀利润

**重要提示**：我们强烈建议新手用户不要使用高杠杆交易。即使是经验丰富的交易者，也应谨慎控制杠杆倍数。

---

## 第二章 策略风险

### 2.1 历史表现不代表未来

**这是最重要的风险警示之一：**

- 过去的收益率、回测数据、胜率等指标仅供参考
- 历史表现优异的策略在未来可能失效或亏损
- 回测数据存在过度拟合风险，实盘表现可能大相径庭
- 市场环境变化可能导致策略逻辑失效

### 2.2 策略失效风险

量化策略可能因以下原因失效：

- **市场结构变化**：市场微观结构、参与者构成发生变化
- **策略拥挤**：同类策略使用者增多，导致策略效果下降
- **黑天鹅事件**：策略无法预见和应对的极端市场事件
- **规则变更**：交易所规则、手续费结构变更影响策略表现
- **流动性变化**：目标交易对流动性下降

### 2.3 信号延迟风险

- **网络延迟**：信号从策略端到执行端的传输存在延迟
- **交易所响应**：交易所 API 响应时间不稳定
- **执行延迟**：从收到信号到实际成交存在时间差
- **价格变化**：延迟期间价格可能已发生显著变化

### 2.4 单一策略风险

- 将全部资金投入单一策略会放大风险
- 建议分散投资于多个相关性较低的策略
- 任何单一策略都可能经历较长的回撤期

---

## 第三章 技术风险

### 3.1 系统故障风险

尽管我们采取多重措施保障系统稳定，但仍可能出现：

- **服务中断**：服务器故障、维护升级导致服务暂时不可用
- **数据延迟**：市场数据传输延迟影响信号准确性
- **Bug 风险**：软件缺陷可能导致非预期的交易行为
- **容量问题**：高峰期系统可能出现拥堵

### 3.2 网络安全风险

- **黑客攻击**：平台可能遭受网络攻击
- **钓鱼欺诈**：用户可能遭遇钓鱼网站或欺诈信息
- **账户盗用**：弱密码或泄露的凭证可能导致账户被盗
- **恶意软件**：用户设备上的恶意软件可能窃取信息

### 3.3 第三方服务风险

Hoot 依赖第三方服务提供商，包括但不限于：

- **交易所**：交易所可能出现系统故障、安全漏洞、破产等问题
- **云服务**：云服务提供商可能出现服务中断
- **数据提供商**：市场数据可能出现错误或延迟
- **区块链网络**：区块链网络拥堵可能影响充值提现

**重要提示**：您的资产由第三方交易所托管，Hoot 不对交易所的安全性负责。请选择信誉良好的主流交易所。

### 3.4 API 风险

- **权限泄露**：API Key 泄露可能导致资产损失
- **权限误设**：错误开启提现权限可能导致资产被盗
- **调用限制**：超出交易所 API 调用限制可能导致交易失败
- **版本变更**：交易所 API 变更可能影响服务正常运行

---

## 第四章 监管与法律风险

### 4.1 监管政策风险

数字资产行业监管环境快速变化：

- **政策禁令**：某些国家/地区可能全面禁止数字资产交易
- **牌照要求**：监管机构可能要求服务提供商持有特定牌照
- **税务风险**：数字资产交易可能产生税务义务
- **合规要求**：KYC/AML 等合规要求可能不断加强

### 4.2 法律不确定性

- 数字资产的法律地位在许多司法管辖区仍不明确
- 相关法律法规正在制定和完善中
- 跨境交易可能涉及多个司法管辖区的法律问题
- 智能合约和去中心化应用的法律效力存在争议

### 4.3 账户冻结风险

在以下情况下，您的账户或资产可能被冻结：

- 监管机构或执法机关的要求
- 涉嫌违反用户协议
- 涉嫌从事违法活动
- 交易所的合规要求

---

## 第五章 操作风险

### 5.1 用户操作失误

- **转账错误**：发送资产到错误地址将无法找回
- **链网络选错**：选择错误的区块链网络可能导致资产丢失
- **金额设置错误**：设置过大的交易金额可能导致超出预期的损失
- **参数配置错误**：错误的策略参数设置可能导致非预期的交易行为

### 5.2 资金管理风险

- **过度投资**：投入超出承受能力的资金
- **无止损**：未设置止损可能导致损失扩大
- **追涨杀跌**：情绪化操作可能加剧损失
- **全仓交易**：将全部资金用于单笔交易风险极高

---

## 第六章 平台特有风险

### 6.1 信号执行风险

- 信号可能因各种原因未能成功执行
- 实际成交价格可能与信号价格存在差异
- 部分信号可能被风控系统拦截
- 交易所订单状态可能出现异常

### 6.2 费用影响

- 燃油费（盈利的 20%）会减少您的实际收益
- 策略订阅费是固定成本，无论盈亏
- 交易所交易手续费会影响策略净收益
- 资金费率（合约）可能侵蚀利润

### 6.3 策略容量限制

- 部分策略可能因订阅人数过多而降低效果
- 平台可能需要限制某些策略的订阅数量
- 大资金可能无法完全跟随某些策略

---

## 第七章 风险管理建议

### 7.1 资金管理

1. **只投入可承受损失的资金**
   - 不要使用生活必需资金进行投资
   - 不要使用借款或贷款进行投资
   - 建议投资金额不超过流动资产的 10-20%

2. **分散投资**
   - 不要将全部资金投入单一策略
   - 考虑使用多个相关性较低的策略
   - 保持适当的现金储备

3. **控制仓位**
   - 单笔交易金额应合理
   - 控制同时持有的仓位数量
   - 合约交易使用低杠杆（建议不超过 3 倍）

### 7.2 安全措施

1. **账户安全**
   - 使用强密码并定期更换
   - 启用两步验证（2FA）
   - 不要在公共设备上登录账户

2. **API 安全**
   - 绝不开启 API 的提现权限
   - 设置 IP 白名单（如交易所支持）
   - 定期检查 API 使用记录
   - 发现异常立即删除 API Key

3. **信息安全**
   - 警惕钓鱼网站和诈骗信息
   - 不要向任何人透露密码或 API Key
   - 只从官方渠道下载应用

### 7.3 心理准备

1. **接受亏损的可能性**
   - 做好全部本金损失的心理准备
   - 任何投资都有风险，包括"稳健"策略

2. **保持理性**
   - 不要因短期亏损而恐慌操作
   - 不要因短期盈利而盲目加仓
   - 设定明确的投资目标和止损线

3. **持续学习**
   - 了解数字资产市场的基本原理
   - 学习风险管理知识
   - 关注市场动态和监管变化

---

## 第八章 免责声明

1. **Hoot 仅提供技术工具和信息服务，不提供投资建议**
2. **您应当独立评估投资风险，并对您的投资决策负完全责任**
3. **Hoot 不保证任何策略的盈利性**
4. **Hoot 不对因市场波动、策略失效、技术故障、第三方服务问题或任何其他原因导致的损失承担责任**

---

## 第九章 风险承受能力评估

在开始使用 Hoot 服务之前，请诚实回答以下问题：

□ 我了解数字资产交易的基本原理
□ 我了解量化交易策略的工作方式
□ 我能够承受可能的全部本金损失
□ 我使用的是闲置资金，不是生活必需资金
□ 我没有借款或贷款进行投资
□ 我有足够的心理准备面对投资亏损
□ 我不位于禁止使用此类服务的地区

**如果您无法确认上述所有条目，我们建议您暂不使用 Hoot 服务。**

---

## 第十章 最终确认

通过使用 Hoot 平台服务，您确认：

1. 您已仔细阅读并理解本风险提示的全部内容
2. 您了解数字资产交易的高风险性质
3. 您愿意承担使用本平台服务可能带来的所有风险
4. 您同意本风险提示中的所有条款

---

**投资有风险，入市需谨慎。**

**请只投入您能承受损失的资金。**

---

© 2024-2026 Hoot. All rights reserved.`,

  contentEn: `# Hoot Platform Risk Disclosure

**Version: 1.0.0**
**Effective Date: January 1, 2026**
**Last Updated: January 1, 2026**

---

## Important Statement

⚠️ Please carefully read this Risk Disclosure before using Hoot Platform services. Digital asset trading is a high-risk investment activity that may result in the loss of all your principal. You should carefully decide whether to use this platform's services based on your financial situation and risk tolerance after fully understanding the relevant risks.

---

## Chapter 1: Market Risks

### 1.1 Price Volatility Risk

The digital asset market is highly volatile, and prices may change dramatically in a very short time:

- **Extreme Volatility**: Digital asset prices may rise or fall more than 10% within hours or even minutes
- **Flash Crash Risk**: Markets may experience sudden sharp declines, triggering cascading liquidations
- **Zero Value Risk**: Some digital assets may become worthless due to project failure, regulatory action, etc.
- **24/7 Market**: Digital asset markets operate around the clock; price fluctuations may occur at any time

**Case Warning**: History has seen multiple market events with single-day drops exceeding 30%, and some altcoins have gone to zero within days.

### 1.2 Liquidity Risk

- **Bid-Ask Spread**: Some trading pairs may have large bid-ask spreads, increasing trading costs
- **Insufficient Depth**: Large orders may not be executed at expected prices due to insufficient market depth
- **Slippage Risk**: Actual execution prices may differ significantly from order prices
- **Inability to Close**: In extreme market conditions, it may be impossible to close positions in time to stop losses

### 1.3 Leverage Risk

If you use leverage for futures trading:

- **Amplified Losses**: Leverage amplifies both gains and losses
- **Forced Liquidation**: Insufficient margin may result in forced liquidation, causing total margin loss
- **Negative Balance Risk**: Under extreme volatility, losses may exceed initial margin
- **Funding Rate**: Holding futures positions requires paying or receiving funding rates, which may erode profits

**Important Note**: We strongly recommend that novice users avoid high-leverage trading. Even experienced traders should carefully control leverage ratios.

---

## Chapter 2: Strategy Risks

### 2.1 Past Performance Does Not Guarantee Future Results

**This is one of the most important risk warnings:**

- Past returns, backtesting data, win rates, and other metrics are for reference only
- Strategies with excellent historical performance may fail or lose money in the future
- Backtesting data carries overfitting risk; live performance may differ significantly
- Market environment changes may cause strategy logic to fail

### 2.2 Strategy Failure Risk

Quantitative strategies may fail due to:

- **Market Structure Changes**: Changes in market microstructure and participant composition
- **Strategy Crowding**: Increased users of similar strategies reducing strategy effectiveness
- **Black Swan Events**: Extreme market events that strategies cannot foresee or handle
- **Rule Changes**: Exchange rule changes, fee structure changes affecting strategy performance
- **Liquidity Changes**: Decreased liquidity in target trading pairs

### 2.3 Signal Delay Risk

- **Network Latency**: Signal transmission from strategy to execution has latency
- **Exchange Response**: Exchange API response times are unstable
- **Execution Delay**: There is a time gap between receiving signals and actual execution
- **Price Changes**: Prices may have changed significantly during delays

### 2.4 Single Strategy Risk

- Investing all funds in a single strategy amplifies risk
- Recommend diversifying across multiple strategies with low correlation
- Any single strategy may experience extended drawdown periods

---

## Chapter 3: Technical Risks

### 3.1 System Failure Risk

Despite multiple measures to ensure system stability, issues may still occur:

- **Service Interruption**: Server failures, maintenance upgrades causing temporary service unavailability
- **Data Delay**: Market data transmission delays affecting signal accuracy
- **Bug Risk**: Software defects may cause unexpected trading behavior
- **Capacity Issues**: System congestion may occur during peak periods

### 3.2 Cybersecurity Risk

- **Hacking Attacks**: Platform may be subject to cyberattacks
- **Phishing Scams**: Users may encounter phishing websites or fraudulent information
- **Account Theft**: Weak passwords or leaked credentials may lead to account theft
- **Malware**: Malware on user devices may steal information

### 3.3 Third-Party Service Risk

Hoot relies on third-party service providers, including but not limited to:

- **Exchanges**: Exchanges may experience system failures, security vulnerabilities, bankruptcy, etc.
- **Cloud Services**: Cloud service providers may experience service interruptions
- **Data Providers**: Market data may have errors or delays
- **Blockchain Networks**: Blockchain network congestion may affect deposits and withdrawals

**Important Note**: Your assets are held by third-party exchanges. Hoot is not responsible for exchange security. Please choose reputable mainstream exchanges.

### 3.4 API Risk

- **Permission Leakage**: API Key leakage may result in asset loss
- **Permission Misconfiguration**: Incorrectly enabling withdrawal permissions may lead to asset theft
- **Rate Limits**: Exceeding exchange API rate limits may cause trading failures
- **Version Changes**: Exchange API changes may affect normal service operation

---

## Chapter 4: Regulatory and Legal Risks

### 4.1 Regulatory Policy Risk

The digital asset industry's regulatory environment is rapidly changing:

- **Policy Bans**: Some countries/regions may completely ban digital asset trading
- **License Requirements**: Regulators may require service providers to hold specific licenses
- **Tax Risk**: Digital asset trading may create tax obligations
- **Compliance Requirements**: KYC/AML and other compliance requirements may continue to strengthen

### 4.2 Legal Uncertainty

- The legal status of digital assets remains unclear in many jurisdictions
- Related laws and regulations are being developed and refined
- Cross-border transactions may involve legal issues in multiple jurisdictions
- Legal validity of smart contracts and decentralized applications is disputed

### 4.3 Account Freeze Risk

Your account or assets may be frozen in the following circumstances:

- Requests from regulatory agencies or law enforcement
- Suspected violation of user agreement
- Suspected involvement in illegal activities
- Exchange compliance requirements

---

## Chapter 5: Operational Risks

### 5.1 User Operation Errors

- **Transfer Errors**: Sending assets to the wrong address cannot be recovered
- **Wrong Network**: Selecting the wrong blockchain network may result in asset loss
- **Amount Setting Errors**: Setting too large a trading amount may cause unexpected losses
- **Parameter Configuration Errors**: Incorrect strategy parameter settings may cause unexpected trading behavior

### 5.2 Fund Management Risks

- **Overinvestment**: Investing more than you can afford to lose
- **No Stop Loss**: Not setting stop losses may lead to expanded losses
- **Chasing Highs and Selling Lows**: Emotional operations may exacerbate losses
- **All-in Trading**: Using all funds for a single trade is extremely risky

---

## Chapter 6: Platform-Specific Risks

### 6.1 Signal Execution Risk

- Signals may fail to execute successfully for various reasons
- Actual execution prices may differ from signal prices
- Some signals may be intercepted by risk control systems
- Exchange order status may be abnormal

### 6.2 Fee Impact

- Gas fee (20% of profits) reduces your actual returns
- Strategy subscription fees are fixed costs regardless of profit or loss
- Exchange trading fees affect strategy net returns
- Funding rates (futures) may erode profits

### 6.3 Strategy Capacity Limits

- Some strategies may become less effective with too many subscribers
- Platform may need to limit subscriptions for certain strategies
- Large funds may not be able to fully follow certain strategies

---

## Chapter 7: Risk Management Recommendations

### 7.1 Fund Management

1. **Only Invest What You Can Afford to Lose**
   - Do not use essential living expenses for investment
   - Do not use borrowed money or loans for investment
   - Recommended investment amount should not exceed 10-20% of liquid assets

2. **Diversification**
   - Do not invest all funds in a single strategy
   - Consider using multiple strategies with low correlation
   - Maintain adequate cash reserves

3. **Position Control**
   - Single trade amounts should be reasonable
   - Control the number of positions held simultaneously
   - Use low leverage for futures trading (recommended not to exceed 3x)

### 7.2 Security Measures

1. **Account Security**
   - Use strong passwords and change them regularly
   - Enable two-factor authentication (2FA)
   - Do not log into accounts on public devices

2. **API Security**
   - Never enable API withdrawal permissions
   - Set IP whitelist (if exchange supports)
   - Regularly check API usage records
   - Delete API Key immediately if anomalies are detected

3. **Information Security**
   - Beware of phishing websites and scam information
   - Do not disclose passwords or API Keys to anyone
   - Only download applications from official channels

### 7.3 Psychological Preparation

1. **Accept the Possibility of Loss**
   - Be mentally prepared for total principal loss
   - All investments have risks, including "stable" strategies

2. **Stay Rational**
   - Do not panic trade due to short-term losses
   - Do not blindly add positions due to short-term gains
   - Set clear investment goals and stop-loss levels

3. **Continuous Learning**
   - Understand the basic principles of digital asset markets
   - Learn risk management knowledge
   - Follow market trends and regulatory changes

---

## Chapter 8: Disclaimer

1. **Hoot only provides technical tools and information services, not investment advice**
2. **You should independently assess investment risks and bear full responsibility for your investment decisions**
3. **Hoot does not guarantee the profitability of any strategy**
4. **Hoot is not responsible for losses caused by market volatility, strategy failure, technical failures, third-party service issues, or any other reasons**

---

## Chapter 9: Risk Tolerance Assessment

Before starting to use Hoot services, please honestly answer the following questions:

□ I understand the basic principles of digital asset trading
□ I understand how quantitative trading strategies work
□ I can bear the possible total loss of principal
□ I am using discretionary funds, not essential living expenses
□ I have not borrowed or taken loans for investment
□ I am mentally prepared to face investment losses
□ I am not located in a region where such services are prohibited

**If you cannot confirm all of the above items, we recommend that you do not use Hoot services at this time.**

---

## Chapter 10: Final Confirmation

By using Hoot Platform services, you confirm:

1. You have carefully read and understood all contents of this Risk Disclosure
2. You understand the high-risk nature of digital asset trading
3. You are willing to bear all risks that may arise from using this platform's services
4. You agree to all terms in this Risk Disclosure

---

**Investment carries risks; enter the market with caution.**

**Only invest what you can afford to lose.**

---

© 2024-2026 Hoot. All rights reserved.`
}

// 导出所有法律文档
export const legalDocuments: Record<string, LegalDocumentContent> = {
  terms: termsOfService,
  privacy: privacyPolicy,
  risk: riskDisclosure
}
