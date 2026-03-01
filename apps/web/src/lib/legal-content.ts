/**
 * 法律文档内容
 * 商用级完整法律条款 v2.0.0
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
  version: '2.0.0',
  effectiveDate: '2026-03-15',
  contentZh: `# Hoot 平台用户服务协议

**版本：2.0.0**
**生效日期：2026 年 3 月 15 日**
**最后更新：2026 年 3 月 1 日**

---

## 第一章 总则

### 1.1 协议主体

本协议由 **Hoot 平台运营方**（以下简称"平台"或"我们"）与**用户**（以下简称"您"或"用户"）就 Hoot 平台（网址：hoot.trade，以下简称"本平台"）的使用而订立。本平台提供 AI 量化交易、策略订阅、数字资产管理及相关服务。

本协议自您点击"同意"按钮、完成账户注册、或以任何方式使用本平台服务之时起生效，对双方均具有法律约束力。

### 1.2 协议效力

**您理解并确认**：

1. 您点击"同意本协议"、"注册账户"或开始使用本平台任何功能，即视为您已阅读、理解并同意接受本协议全部条款的约束。
2. 如您不同意本协议任何条款，请立即停止使用本平台服务。
3. 本协议构成您与平台之间具有法律约束力的合同，适用于您对本平台的一切使用行为。
4. 本协议中凡涉及豁免或限制平台责任的条款，均已以**加粗**方式提示您注意，请您重点阅读。

### 1.3 协议更新

1. 平台有权根据业务发展、法律法规变化或产品升级等需要，不时修订本协议。
2. 对于**重大变更**（包括但不限于：收费方式、核心功能变更、数据处理方式变更），平台将提前至少 **14 天**通过站内通知、电子邮件或 Telegram 消息通知您。
3. 对于 **AI 功能的新增使用**，平台将要求您进行单独的知情确认（opt-in），您选择启用 AI 功能即视为同意相关条款。
4. 协议更新后，您继续使用本平台服务即视为同意更新后的协议。如您不同意，应在变更生效前停止使用并注销账户。
5. 平台将在本平台页面显示协议的最新版本号及生效日期，历史版本可通过客服查阅。

### 1.4 文档体系

本协议与以下文件共同构成您与平台之间的**完整法律框架**：

1. **本协议**（用户服务协议 v2.0.0）——核心权利义务
2. **隐私政策 v2.0.0**——个人数据处理规则
3. **风险提示书**——交易风险专项披露

上述文件如有冲突，以本协议为准；本协议未规定事项，以隐私政策及风险提示书为准。

### 1.5 定义

本协议中下列术语的含义如下：

- **"AI 分析"**：指平台通过大语言模型（LLM）对市场数据、技术指标、链上数据等进行的自动化处理与分析输出，包括但不限于市场状态判断、交易信号生成、风险评估。
- **"网格交易"**：指在用户预设的价格区间内，由系统自动在不同价格档位执行买入和卖出操作的量化交易策略。
- **"LLM 提供商"**：指向平台提供大语言模型 API 服务的第三方机构，包括但不限于 DeepSeek、OpenAI、Anthropic、Google、阿里云（通义千问）、xAI（Grok）、Moonshot（Kimi）。
- **"DEX"**：去中心化交易所（Decentralized Exchange），用户无需注册即可通过智能合约进行链上资产交易，包括但不限于 Lighter、Aster 等平台。
- **"私钥"**：控制区块链钱包资产的唯一加密密钥。持有私钥即等同于控制对应钱包内全部资产，私钥一旦泄露，资产将面临永久损失风险。
- **"归属释放"（Vesting）**：HOOT 代币按预设时间表逐步解锁的机制，在解锁期前代币不可流通或使用。
- **"HOOT 代币"**：Hoot 平台发行的实用型代币，用于平台内功能使用、质押分红、积分兑换及生态治理，不构成任何形式的投资证券。
- **"代理商"**：通过平台正式代理商计划注册、参与用户推荐并依规则获取佣金的用户。
- **"研究会话"**：平台 AI 研究功能中，用户发起的一次完整的多阶段市场分析流程，包括数据采集、指标计算、多模型分析、辩论对抗及最终综合报告等环节。
- **"辩论系统"**：平台独有的多 AI 角色协同分析机制，由多头分析师、空头分析师、技术分析师、反向者及风控官等虚拟角色，对特定交易决策进行多轮正反方辩论，以形成更为客观的综合判断。
- **"市场状态"**：AI 系统对当前市场波动程度的分类判断，分为：窄幅震荡（Sideways）、标准趋势（Standard）、宽幅波动（Wide）、剧烈行情（Volatile）四种状态，用于指导网格参数自适应调整。
- **"绑定码"**：用户通过 Telegram Bot 进行账户绑定时使用的 6 位数字一次性验证码，有效期为 5 分钟。

---

## 第二章 服务内容

### 2.1 服务概述

平台向您提供以下 12 项主要服务：

1. **策略订阅服务**：您可在平台策略市场中浏览、订阅由平台或第三方策略师提供的量化交易策略，并获取相关交易信号。
2. **信号分发服务**：平台将经策略引擎生成的交易信号，通过 WebSocket、Telegram Bot 等渠道实时分发至您的账户。
3. **交易执行服务**：平台通过您授权的 CEX（中心化交易所）API，在您账户内自动执行交易指令。
4. **资产管理服务**：包括 USDT 充值（链上转账）、提现（链上提现）、平台余额管理及交易历史查询。
5. **代币服务**：包括 HOOT 代币空投领取、质押挖矿、质押分红及代币相关生态功能。
6. **AI 交易服务**：包括 AI 驱动的网格交易策略、市场状态自动检测、参数自适应调整及 AI 自动交易决策。
7. **AI 研究服务**：包括多智能体辩论分析（多头/空头/技术/反向/风控五角色辩论）、五阶段分析流水线（数据采集→指标分析→LLM 评估→辩论→综合报告）及研究历史管理。
8. **DEX 交易服务**：通过平台托管钱包或用户自有钱包，在 Lighter、Aster 等去中心化交易所执行链上合约交易。
9. **Telegram Bot 服务**：通过官方 Telegram Bot（@HootCool_bot）提供交易面板操作、余额查询、绑定码认证、每日签到及推送通知等功能。
10. **会员与积分服务**：包括月度/季度/年度会员套餐、积分卡购买及使用（1 积分 = 1 USDT）、积分奖励任务。
11. **空投与奖励服务**：包括注册空投、推荐奖励、签到奖励及交易盈利奖励等。
12. **代理商与推荐服务**：包括代理商注册、多级佣金结算、代理商专属后台及分红池分配。

### 2.2 服务性质

**您理解并明确同意以下关于 AI 服务性质的重要声明**：

1. 本平台提供的**所有 AI 分析、交易信号、市场状态判断、辩论结论及研究报告**，均为技术性信息处理输出，**不构成任何形式的投资建议、财务建议、证券推荐或法律意见**。
2. AI 系统的输出结果基于历史数据和当前市场数据的模式识别，**不代表对未来市场走势的预测或保证**。
3. 您基于平台 AI 分析所做的任何交易决策，均属**您的独立投资判断**，平台不承担因此产生的任何盈亏责任。
4. 数字资产交易存在极高风险，您可能损失全部投入资金，**请在充分了解风险的前提下谨慎参与**。

### 2.3 服务范围限制

**以下地区的用户被明确禁止使用本平台服务**：

- 中华人民共和国大陆地区
- 美利坚合众国及其领土
- 朝鲜民主主义人民共和国
- 伊朗伊斯兰共和国
- 俄罗斯联邦（特定服务）
- 受联合国、欧盟、美国财政部 OFAC 或其他主要国际制裁机构制裁的地区
- 当地法律禁止数字资产交易或本类服务的任何其他地区

您声明并保证您不位于上述受限地区，且不代表上述地区的主体使用本平台。平台有权在任何时候对受限地区的访问实施技术屏蔽或账户封禁，且不承担因此产生的任何责任。

### 2.4 AI 服务专项条款

1. **AI 分析局限性声明**：AI 分析系统基于大语言模型，存在固有局限性，包括但不限于：模型幻觉（生成看似合理但实际错误的内容）、训练数据偏差、对极端市场行情的分析能力不足、上下文窗口限制导致的信息丢失。平台不保证 AI 分析结果的准确性、完整性或时效性。

2. **辩论系统说明**：辩论系统中的"多头分析师"、"空头分析师"等角色均为平台构建的 AI 提示词角色，并非真正独立的人类分析师或自主 AI 系统。辩论结论仅代表模型在给定提示词框架下的输出，不代表独立的客观判断。

3. **AI 可用性限制**：平台 AI 服务依赖第三方 LLM 提供商的 API 接口，平台**不保证 AI 服务的持续可用性**。LLM 提供商可能因限流、维护、服务中断或政策变更等原因导致 AI 功能不可用，平台对此不承担赔偿责任。

4. **AI 决策审计权**：您有权通过平台账户后台查阅您的 AI 分析历史记录、辩论过程日志及交易决策依据，平台将保留上述记录至少 90 天。

5. **人工审核建议**：对于 AI 生成的任何重大交易建议，**我们强烈建议您在执行前进行独立的人工核查**，不应完全依赖 AI 系统进行自动化决策。

### 2.5 DEX 服务专项条款

1. **私钥托管披露**：当您使用平台 DEX 交易功能时，平台将为您生成区块链钱包并托管相应私钥（采用 AES-256-GCM 加密存储）。**您理解托管私钥意味着平台对您的链上资产具有技术操作能力**，这与完全自主的非托管钱包不同。

2. **私钥导出权利**：您随时有权申请导出您的私钥，平台将在完成身份验证后提供明文私钥。私钥导出后，您应立即妥善保管，不得泄露给任何第三方。

3. **智能合约风险**：链上交易通过智能合约执行，智能合约可能存在代码漏洞、逻辑缺陷或遭受黑客攻击，可能导致资产损失。平台已采取合理的安全措施，但**不对智能合约风险导致的资产损失承担赔偿责任**。

4. **链上交易不可逆**：区块链交易一经确认即不可撤销，**平台无法回滚已确认的链上交易**。您在发起 DEX 交易前应仔细确认交易参数。

---

## 第三章 用户资格与账户

### 3.1 用户资格

使用本平台服务，您须同时满足以下条件：

1. **年龄要求**：您已年满 18 周岁，或在您所在司法管辖区达到法定成年年龄（以较高者为准）。
2. **行为能力**：您具有完全民事行为能力，能够独立承担本协议约定的全部义务。
3. **制裁合规**：您不在任何国际制裁名单中，包括但不限于联合国安理会制裁名单、美国 OFAC SDN 名单、欧盟制裁名单。
4. **地区合规**：您所在地区未明确禁止数字资产交易或本平台提供的服务。
5. **独立判断**：您具备对数字资产交易风险进行独立判断的能力，并了解可能损失全部投资的风险。

如您代表企业或机构注册，则您额外声明您具有代表该实体订立本协议的合法授权。

### 3.2 账户注册

平台支持以下方式注册账户：

1. **邮箱注册**：提供有效电子邮件地址并设置密码，完成邮箱验证后即可注册。
2. **钱包地址注册**：通过支持的 Web3 钱包（MetaMask、RainbowKit 等）连接区块链钱包地址注册。
3. **Telegram 绑定**：通过官方 Telegram Bot 发送绑定码（6 位数字，有效期 5 分钟）完成账户绑定，现有账户可绑定 Telegram 以启用 Bot 功能。

**注册要求**：
- 每位用户仅允许注册一个账户，禁止多账号注册。
- 您提供的注册信息必须真实、准确、完整，并在信息变更时及时更新。
- 平台有权对注册信息进行核验，虚假信息注册的账户可能被立即封禁。

### 3.3 账户安全

1. **密码保护**：您应设置强密码，并对账户密码及登录凭证承担保密义务，不得将账户提供给任何第三方使用。

2. **暴力破解防护**：
   - 同一邮箱连续登录失败 **5 次**，账户将被锁定 **30 分钟**。
   - 同一 IP 地址连续登录失败 **15 次**，该 IP 将被锁定 **30 分钟**。

3. **访问令牌管理**：平台采用滚动 Token 机制，每次登录将签发新的访问令牌，过期令牌自动失效。建议您定期注销不活跃的登录会话。

4. **双因素认证（2FA）**：**强烈建议**您启用 2FA 以提升账户安全性。对于绑定了 DEX 钱包或 API Key 的账户，建议强制启用 2FA。

5. **异常登录通知**：检测到异地登录等异常行为时，平台将向您的注册邮箱或 Telegram 发送安全提醒。

6. **账户安全责任**：因您的疏忽（包括密码泄露、设备丢失、点击钓鱼链接等）导致的账户被盗，平台不承担相应损失。您发现账户异常应立即联系平台客服。

### 3.4 账户限制与终止

平台在下列情况下有权限制、暂停或终止您的账户：

1. 您违反本协议任何条款；
2. 您提供虚假注册信息；
3. 您的账户存在欺诈、洗钱或其他违法活动嫌疑；
4. 监管机构或执法部门要求；
5. 您长期不活跃（超过 24 个月未登录）。

账户终止前，平台将依合理情况提前通知（除紧急安全事项外）。账户终止后，您的平台余额将按照提现流程退还（需扣除适用手续费）。

---

## 第四章 密钥授权

### 4.1 CEX API 授权说明

为实现自动化交易执行，您可将中心化交易所（如 Binance、OKX 等）的 API 密钥授权给平台使用。平台将通过您的 API 密钥代您在对应交易所执行策略信号。

### 4.2 API 权限要求

您在交易所创建 API 密钥时，**必须遵守以下权限规则**：

- **必须启用**：交易权限（读取账户信息、下单、撤单）
- **严禁启用**：提现权限（Withdrawal）

**您声明并保证您授权给平台的 API 密钥未启用提现权限。** 如因您误操作启用提现权限导致的损失，由您自行承担。

### 4.3 API 安全存储

1. 您的 CEX API 密钥（API Key 和 Secret）在传输及存储过程中，均采用 **AES-256-GCM 算法**进行加密，加密密钥由平台安全管理，不以明文形式存储于数据库或日志中。
2. 平台工作人员**无法查阅**您的 API Secret 明文，API 密钥仅在执行交易时于内存中短暂解密使用。
3. 如您删除 API Key 授权，平台将立即停止调用，并将加密存储的密钥数据从系统中清除。
4. 您可随时在账户设置中查看、添加或删除已授权的 API Key。

### 4.4 DEX 钱包与私钥管理

1. **私钥生成**：当您启用 DEX 交易功能时，平台将为您在相应区块链（EVM 兼容链、Solana 等）上生成钱包私钥，并采用 AES-256-GCM 算法加密后存储于平台安全数据库。

2. **私钥导出权利**：您可在账户设置中申请导出您的私钥明文，申请时需进行完整的身份验证。导出的私钥由您自行保管，**平台不承担私钥导出后因保管不当造成的任何损失**。

3. **托管风险确认**：您明确知晓并接受以下风险：
   - 平台托管私钥期间，若平台遭受黑客攻击，您的链上资产存在被盗风险；
   - 平台有义务采取合理的技术和管理措施保护私钥安全，但**不能对零风险作出保证**；
   - 如您不愿承担托管风险，应选择使用自有钱包（非托管方式）连接 DEX。

4. **各链特定风险**：
   - **Solana 及其 L2**：账户租金押金、程序升级风险、MEV 攻击。
   - **EVM 兼容链**：Gas 费波动、合约审计不完整风险、链上拥堵导致的交易延迟。

### 4.5 LLM API 密钥管理

1. **支持的 LLM 提供商**：平台支持用户自备以下 7 家 LLM 提供商的 API 密钥：DeepSeek、OpenAI、Anthropic、Google（Gemini）、阿里云（通义千问）、xAI（Grok）、Moonshot（Kimi）。

2. **密钥用途限制**：您提供的 LLM API 密钥**仅用于**为您生成 AI 交易分析和研究报告，不用于任何其他目的。

3. **加密存储**：LLM API 密钥与 CEX API 密钥采用相同的 AES-256-GCM 加密方案存储，平台工作人员无法查阅明文。

4. **费用自行承担**：使用自备 LLM API 密钥的用户，对应 LLM 服务费用由您自行承担并直接向相应 LLM 提供商支付。平台不对因 LLM 提供商计费方式变更、额度超限或账单争议承担任何责任。

5. **优先级规则**：AI 功能调用 LLM 时，优先级为：**用户自备密钥 > 平台配置密钥 > 系统环境变量**。如用户自备密钥不可用（无效、额度耗尽等），系统将自动降级使用平台密钥，并在账户中记录此次降级事件。

6. **密钥有效性验证**：添加 LLM API 密钥时，平台将进行连通性测试。测试结果仅验证当下可用性，不代表对未来持续可用性的保证。

### 4.6 责任声明

对于以下三类密钥（CEX API 密钥、DEX 私钥、LLM API 密钥），平台对以下情形**不承担赔偿责任**：

- 因您主动泄露密钥给第三方导致的损失；
- 因您的设备遭受恶意软件感染导致密钥被盗；
- 因您使用平台以外的第三方工具读取或操作密钥导致的安全事件；
- 因不可抗力（平台无法控制的黑客攻击、零日漏洞等）导致的极端安全事件（平台将尽力采取行业合理措施防范）。

---

## 第五章 费用与支付

### 5.1 收费模式

平台当前收取以下费用：

1. **策略订阅费**：按各策略的定价标准，以月为周期向您收取。具体金额以平台策略详情页所示为准，平台有权调整各策略定价。

2. **燃油费（Performance Fee）**：仅在策略产生**正盈利**时收取盈利金额的 **20%** 作为燃油费，**亏损期间不收取任何燃油费**。燃油费计算以每个结算周期的净盈利为基准，结算周期以平台规则为准。

3. **提现手续费**：用户发起链上提现时，将收取对应链网络的实际 Gas 费用，平台不在 Gas 费之外额外收取附加手续费（特殊情况除外，届时会提前公告）。

4. **会员套餐费**：平台提供月度、季度、年度三档会员套餐，不同会员等级享有不同的策略访问权限、AI 调用配额及专属功能。

5. **AI 分析成本**：使用平台提供的 LLM 密钥进行 AI 研究的用户，平台将按实际消耗的 Token 量折算成本向您收取，具体计费单价以平台公告为准。

### 5.2 支付方式

平台支持以下支付方式：

1. **USDT 余额**：从您的平台 USDT 账户余额直接扣划，优先级最高。
2. **积分卡**：平台积分卡（1 积分 = 1 USDT 等值），可在平台内购买，可用于支付平台内各类费用。
3. **HOOT 代币**：持有 HOOT 代币的用户可使用 HOOT 代币支付部分费用，具体适用范围及折扣比例以平台公告为准。

### 5.3 AI 成本透明度

平台承诺向您提供以下 AI 成本信息：

1. **调用成本追踪**：每次 AI 分析调用的 Token 消耗量及折算费用将在账户后台可查阅。
2. **月度预算系统**：您可在账户设置中设定 AI 服务的月度消费上限，达到上限后 AI 功能将自动暂停，直至下月重置或您手动调整上限。
3. **模型成本对照表**：平台将在官网公示各 LLM 提供商各模型的单位 Token 成本，以便您选择适合的模型。

### 5.4 退款政策

1. **策略订阅费**：已支付的当月订阅费原则上**不予退款**。如因平台原因（服务故障、策略强制下架等）导致服务不可用，平台将按实际不可用时长比例折算退款。

2. **燃油费**：已结算的燃油费**不予退款**，如认为计算有误，可在 7 日内向客服申请复核。

3. **会员套餐费**：激活后的会员套餐**不予退款**，未激活的套餐可申请退款。

4. **积分卡**：积分卡一经使用或转赠，**不予退款**；未使用的积分卡在有效期内可申请退款（扣除手续费）。

5. **例外情形**：因法律法规要求或监管机构指令，平台可能被要求退还部分或全部费用，届时将按相关规定执行。

### 5.5 费用调整

1. 平台有权根据运营成本、市场变化等因素调整各项收费标准。
2. 费用调整将提前至少 **7 个自然日**通过站内公告、邮件或 Telegram 通知用户。
3. 费用调整对调整生效日之后的新结算周期适用，不影响已支付费用。

---

## 第六章 HOOT 代币经济

### 6.1 代币性质与免责声明

1. **HOOT 代币是平台发行的实用型代币（Utility Token）**，旨在为平台用户提供功能访问、质押权益、生态治理等使用价值。

2. **HOOT 代币不构成任何形式的证券、股权、债券、投资合同或其他金融工具**，持有 HOOT 代币不代表对平台公司的任何所有权或收益权索赔。

3. **平台不对 HOOT 代币的市场价格、流动性或增值作出任何保证或承诺。** 代币价格受市场供需影响，可能大幅波动乃至归零，您应充分了解并接受相应风险。

4. 持有或使用 HOOT 代币可能受您所在司法管辖区法律的约束，**您须自行了解并遵守当地相关法律法规**，平台不对合规义务提供法律意见。

### 6.2 空投规则

平台当前的 HOOT 代币空投规则如下：

1. **注册奖励**：成功完成账户注册并验证邮箱，奖励 **20 HOOT**。
2. **推荐奖励**：通过您的专属推荐链接或代码成功邀请新用户注册并完成验证，奖励 **15 HOOT**（每推荐一位新用户）。
3. **签到奖励**：每日完成签到（通过平台 App 或 Telegram Bot）获得 **2-8 HOOT**，连续签到天数越多奖励递增，中断后重置为基础值。
4. **交易盈利倍增**：当月策略交易产生正盈利时，当月已获得的空投奖励（不含盈利倍增本身）将享受 **2 倍加成**。

**重要限制**：
- 平台**保留随时修改、暂停或终止**空投计划的权利，修改将提前公告。
- 严禁通过多账号、虚假推荐、刷单等方式薅羊毛，一经发现将没收相关代币并封禁账户。
- 空投代币可能受归属释放机制约束，具体释放时间表以平台公告为准。

### 6.3 归属释放机制

1. 部分 HOOT 代币奖励（包括特定空投批次、团队代币等）采用归属释放（Vesting）机制，在释放期满前代币处于锁定状态，无法流通、质押或转出。
2. 归属释放时间表将在相应奖励发放时明确告知，一般以区块链合约记录，链上数据公开可查。
3. **如您违反本协议，平台有权在合理范围内没收或取消您尚未释放的代币奖励**，已释放代币不受影响。

### 6.4 质押规则

1. **活期质押**：可随时解除，权重系数 **1.0x**，分红依照实际质押量按比例分配。
2. **定期质押**：锁定期越长，权重系数越高，最高可达 **3.0x**，解锁期内不可提前赎回（特殊情况除外，届时将说明）。
3. **质押分红**：平台每周从平台手续费收入中划拨一定比例至质押分红池，按质押权重比例分配给所有质押用户，分红以 USDT 或 HOOT 发放（以实际情况为准）。
4. **智能合约风险**：质押功能通过链上智能合约实现，存在合约漏洞、外部攻击等风险，可能导致质押资产损失，**平台不对因智能合约原因导致的质押损失承担赔偿责任**。

### 6.5 代币供应与分配

HOOT 代币总供应量、分配比例及释放计划等信息将在平台白皮书和官方公告中公示，平台有权在合理范围内对代币经济参数进行调整，但核心分配比例的重大调整将经过社区公告并设置合理过渡期。

---

## 第七章 代理商与推荐体系

### 7.1 代理商计划概述

平台设有正式的代理商推荐计划，分为以下四个等级：

| 等级 | 名称 | 晋升条件 |
|------|------|---------|
| L1 | Bronze（铜牌）| 满足基本注册要求 |
| L2 | Silver（银牌）| 满足累计推荐用户数及交易量门槛 |
| L3 | Gold（金牌）| 满足更高推荐量及平台贡献度 |
| L4 | Platinum（铂金）| 满足顶级推荐量及平台战略合作要求 |

各等级具体晋升条件、专属权益及分红池分配比例，以平台代理商专区公告为准。

### 7.2 佣金结构

1. **直推佣金（L1）**：您直接推荐的用户（第一层被推荐人）在平台产生的策略订阅费及燃油费，您可获得 **10%** 的佣金。
2. **间推佣金（L2）**：您推荐的用户再推荐的用户（第二层被推荐人）在平台产生的相应费用，您可获得 **5%** 的佣金。
3. **层级限制**：佣金体系**严格限于两级**，不延伸至第三级及以上，本计划**不构成传销或非法多级分销**。
4. **佣金叠加**：如同一用户同时属于多位代理商的推荐范围，以系统最先记录的推荐关系为准，不重复计算。

### 7.3 佣金结算

1. **结算频率**：佣金每月结算一次，上月产生的有效佣金将在次月固定日期结算至您的平台账户余额。
2. **最低提现门槛**：佣金余额需达到平台规定的最低门槛（具体金额以平台公告为准）方可发起提现。
3. **税务责任**：佣金收入的税务申报和缴纳义务**完全由您自行承担**，平台不代扣代缴任何税款，且不提供税务建议。
4. **佣金来源核实**：平台将对佣金来源的合规性进行定期审计，对于通过欺诈手段获取的佣金，平台有权撤回并追偿。

### 7.4 代理商分红池

1. 平台每月从手续费收入中划拨一定比例至代理商分红池，按代理商等级和贡献度进行分配。
2. 分红池中包含平台回购 HOOT 代币的部分，以增强代币价值。
3. **平台不保证分红池每月必然有收入**，分红金额取决于平台整体运营收入，可能为零。
4. 分红计算及发放规则以平台每月公告为准，平台有权根据运营情况调整分红比例。

### 7.5 代理商义务

作为代理商，您承诺并保证：

1. **禁止误导性推广**：不得向潜在用户承诺固定收益或保证性回报，不得夸大平台功能或隐瞒重要风险。
2. **遵守当地广告法**：在您所在地区的推广活动须符合当地广告法律法规，涉及金融产品的推广可能需要当地监管许可。
3. **风险披露义务**：须确保您推荐的用户在注册前已了解数字资产交易的主要风险，不得向明显不具备风险承受能力的人群推荐。
4. **不得假冒官方**：不得以平台官方名义发布任何声明、承诺或声明。
5. **不得转让代理权**：代理商资格为个人资质，不得转让、出售或分授权给第三方。

### 7.6 代理商资格终止

以下情形将导致代理商资格被终止，且已结算佣金予以扣回：

- 违反 7.5 条所列义务；
- 通过虚假账户或刷单行为套取佣金；
- 违反本协议其他条款；
- 账户被封禁或注销。

代理商资格终止后，因您推荐关系产生的历史佣金（违规期间除外）将正常结算，违规期间的佣金将被没收。

---

## 第八章 用户行为规范

### 8.1 禁止行为

您在使用本平台时，严禁从事以下行为：

**（一）违法违规类**
1. 利用平台从事洗钱、恐怖融资、赌博、欺诈、市场操纵或其他违法活动；
2. 规避或试图规避适用于您的任何监管要求；
3. 向受制裁的个人、实体或地区转移资产；
4. 伪造身份或使用他人身份注册、使用账户。

**（二）技术滥用类**
1. 对平台系统进行未授权访问、渗透测试、爆破攻击；
2. 利用自动化脚本、机器人程序对平台接口进行超出正常使用的批量请求；
3. 利用平台已知或未知漏洞进行套利或获取非正当利益；
4. 干扰、破坏或超负荷使用平台基础设施。

**（三）AI 系统滥用类**
1. **提示词注入攻击**：通过构造特殊输入尝试绕过 AI 系统的安全限制或操纵 AI 输出；
2. **对抗性输入操纵**：系统性地测试 AI 系统边界，以破坏 AI 交易决策逻辑为目的；
3. **模型权重提取**：通过系统性调用尝试反向推导或提取平台 AI 模型的权重、架构或 Prompt；
4. **AI 输出的商业化转售**：将平台 AI 生成的分析报告用于商业出售或分发，超出个人使用范围。

**（四）Telegram Bot 滥用类**
1. 使用机器人或自动化程序代替您与平台 Bot 进行交互；
2. 对 Bot 命令进行高频刷屏干扰其他用户使用；
3. 通过 Bot 传播违法、骚扰或垃圾信息。

**（五）代币薅羊毛类**
1. 注册多个账户以获取多份空投奖励；
2. 通过虚假推荐、自我推荐或刷单行为获取推荐奖励；
3. 以系统性方式利用签到、任务等奖励机制中的漏洞。

**（六）代理商欺诈类**
1. 向被推荐人承诺保证性投资回报；
2. 以误导性、虚假或夸大的宣传材料进行推广；
3. 隐瞒重要风险信息或平台限制。

### 8.2 违规处理

平台对违规行为的处理措施包括但不限于：

1. **警告**：首次轻微违规，发出书面警告。
2. **功能限制**：暂停特定功能的使用权限。
3. **账户冻结**：暂时冻结账户，禁止操作，期间余额不可动用。
4. **代币没收**：没收违规获取的代币奖励及佣金。
5. **账户永久封禁**：情节严重者永久封禁账户，余额按规定处理。
6. **法律追究**：对于涉及洗钱、欺诈等严重违法行为，平台有权向执法机构举报并追究法律责任。

---

## 第九章 知识产权

### 9.1 平台权利

本平台的以下内容属于平台的独有知识产权，受著作权法、专利法、商标法及其他适用法律的保护：

1. 平台软件代码、系统架构及数据库设计；
2. 交易策略算法、信号生成模型及相关技术文档；
3. AI 分析模型、Prompt 工程设计、辩论系统框架及相关训练数据集；
4. 平台 UI/UX 设计、品牌标识（HOOT 及相关 Logo、吉祥物）；
5. 平台白皮书、用户文档及研究报告（平台自行发布的部分）。

未经平台书面授权，您不得复制、修改、分发、销售、出租或以任何方式利用上述知识产权。

### 9.2 AI 生成内容的使用许可

1. 您通过本平台 AI 功能生成的个人分析报告、研究记录及辩论日志，平台授予您**个人、非商业、不可转让的使用许可**。
2. 您**不得将**平台 AI 生成的分析内容转售、商业分发、在社交媒体大规模传播（超出个人分享范围），或作为向第三方提供投资建议的依据。
3. 平台对所有 AI 生成内容保留改进模型所需的匿名化数据使用权（具体见隐私政策）。

### 9.3 用户内容

1. 您在平台发布的内容（如评论、策略描述等），您保留相应著作权，但同时授予平台在平台范围内展示、传播的非独家许可。
2. 您保证您发布的内容不侵犯第三方知识产权，如因此引发侵权纠纷，您应独立承担责任并赔偿平台因此遭受的损失。

---

## 第十章 隐私保护

本平台的隐私数据处理规则，详见**《Hoot 隐私政策 v2.0.0》**，该政策与本协议共同构成您与平台之间关于数据处理的完整约定。

您使用本平台服务即视为同意隐私政策中关于数据收集、处理、存储及共享的相关条款。如您不同意隐私政策，请立即停止使用本平台。

平台承诺将依据隐私政策的规定，采用行业通行的技术和管理措施保护您的个人数据，但因本协议已在相关条款中对数据安全风险作出充分披露，平台不对超出本协议明示承诺范围的数据安全事件承担无限责任。

---

## 第十一章 风险提示与免责声明

### 11.1 投资风险

**数字资产投资属于高风险投资活动，具体风险包括但不限于**：

1. 价格极端波动：数字资产价格可能在短时间内大幅下跌乃至归零；
2. 监管风险：各国对数字资产的监管政策仍在快速演变，可能导致平台服务受限；
3. 流动性风险：在特定市场条件下，资产可能无法及时变现；
4. 对手方风险：交易所（CEX/DEX）可能因技术故障、流动性危机或欺诈破产；
5. 技术风险：区块链网络故障、智能合约漏洞、密钥丢失等导致的资产损失。

**您应仅以可承受损失的资金参与数字资产投资，切勿动用生活资金或贷款投资。**

### 11.2 AI 交易风险

使用平台 AI 交易功能存在以下特定风险：

1. **AI 幻觉风险**：LLM 可能生成看似合理但实际错误的市场分析，导致错误的交易决策；
2. **辩论共识失败**：多 AI 角色辩论可能在信息不充分时形成错误的"共识"，不能保证辩论结论优于单一分析；
3. **模型退化风险**：LLM 提供商更新模型版本可能导致 AI 分析逻辑发生不可预见的变化；
4. **Prompt 局限**：AI 系统的分析能力受限于 Prompt 设计，无法覆盖所有市场情景，对于极端行情可能失效；
5. **延迟风险**：AI 分析需要一定的处理时间，市场价格可能在分析完成前发生重大变化。

### 11.3 自动化交易风险

1. **网格趋势亏损**：网格交易策略在单边趋势行情中可能产生持续亏损，不适合所有市场环境；
2. **自动执行风险**：平台将自动执行策略信号，可能在您未关注账户时累积超出预期的风险敞口；
3. **安全限制不完整**：虽然平台设有多种安全限制，但无法保证在所有极端情形下均能有效防止超额亏损；
4. **系统故障风险**：平台技术故障、网络中断或交易所 API 异常可能导致策略执行失败或延迟，产生预期外的损失。

### 11.4 免责声明

**平台对以下情形明确声明不承担赔偿责任**：

1. AI 模型（包括辩论系统）产生错误分析导致的交易损失；
2. 第三方 LLM 提供商服务中断、限流或停止服务导致 AI 功能不可用期间的损失；
3. 因 DEX 平台（Lighter、Aster 等）智能合约漏洞、升级或停止服务导致的资产损失；
4. HOOT 代币价格下跌、流动性不足或价值归零导致的损失；
5. 因监管政策变化要求平台停止服务或冻结资产导致的损失；
6. 因用户操作失误（错误的交易参数、意外触发的 Telegram Bot 命令等）导致的损失；
7. 因不可抗力事件（自然灾害、战争、大规模网络攻击、区块链网络故障等）导致的服务中断或损失。

### 11.5 责任限制

在适用法律允许的最大范围内，**平台对用户承担的全部赔偿责任，以用户在索赔事件发生前的 12 个自然月内向平台实际支付的费用总额为限**，且不得超过此限额。

上述责任限制不适用于：因平台故意欺诈或重大过失直接导致的损失；在不允许限制责任的司法管辖区，按当地法律另行处理。

---

## 第十二章 Telegram Bot 条款

### 12.1 Bot 服务范围

平台官方 Telegram Bot（@HootCool_bot）提供以下功能：

1. 账户绑定（通过 6 位绑定码，有效期 5 分钟）；
2. 实时交易面板（查看持仓、余额、策略状态）；
3. 交易操作（一键平仓 /closeall、单策略操作等）；
4. 每日签到（领取 HOOT 签到奖励）；
5. 余额查询及交易历史推送；
6. 重要通知推送（大额交易提醒、账户安全提醒等）。

### 12.2 Telegram 平台依赖性

1. 平台 Bot 服务依赖 Telegram 平台的正常运营。Telegram 的服务中断、政策变化或在特定地区被封锁，将直接影响 Bot 服务的可用性。
2. **平台不对 Telegram 平台本身的可用性、安全性或内容承担任何责任**，Bot 服务的中断不视为平台违约。
3. 如 Telegram 平台对 Bot 服务实施限制，平台将尽力通过其他渠道（网页、App）提供替代服务。

### 12.3 命令安全与确认机制

1. **高风险命令**（如 /closeall、/withdraw 等）：执行前将要求您进行二次确认，**一旦确认执行，指令将即时生效，无法撤销**，请务必谨慎操作。
2. **会话安全**：Telegram Bot 会话不设超时，但绑定码具有 5 分钟有效期，超期须重新获取。
3. **防误触保护**：平台将对高风险命令设置合理的频率限制，防止因误操作造成重复执行。
4. 如您的 Telegram 账号被盗，可能导致他人通过 Bot 操作您的账户。发现账号异常应立即向平台申请解绑。

### 12.4 Telegram 数据收集

1. 通过 Telegram Bot 与平台交互时，平台会收集您的 Telegram 用户 ID 及相关交互数据，用于提供 Bot 服务及账户安全管理。
2. 平台不收集您在 Telegram 私聊或群组中（与平台 Bot 交互之外）的任何通讯内容。
3. Telegram 平台本身的数据收集行为，以 Telegram 隐私政策为准，与本平台无关。

---

## 第十三章 争议解决

### 13.1 协商解决

如您与平台之间产生任何争议，双方应首先尝试通过友好协商解决。您可通过以下联系方式向平台提出申诉：

- 电子邮件：support@hoot.trade
- Telegram：@hoot_support
- 平台内客服系统

平台将在收到申诉后 **15 个工作日**内进行书面回复。

### 13.2 仲裁

1. 如协商未能在 30 日内解决争议，任何一方均可将争议提交香港国际仲裁中心（**HKIAC**）进行仲裁。
2. 仲裁将依据 HKIAC 届时有效的仲裁规则进行，仲裁地点为**香港特别行政区**，仲裁语言为中文（必要时可加英文）。
3. 仲裁裁决为终局性裁决，对双方均具有约束力。
4. 仲裁费用由败诉方承担，但仲裁员可根据具体情形作出不同安排。

### 13.3 管辖法律

本协议的成立、效力、履行、解释及争议解决，均适用**香港特别行政区**法律（不考虑法律冲突规则）。

### 13.4 集体诉讼豁免

**在适用法律允许的范围内，您同意以个人身份解决与平台的任何争议，放弃参与集体诉讼、集体仲裁或其他任何以集体形式主张权利的程序的权利。** 如该条款在您所在司法管辖区不适用，则以当地法律为准。

---

## 第十四章 其他条款

### 14.1 完整协议

本协议（包括本协议引用的隐私政策、风险提示书等文件）构成您与平台之间就平台服务达成的**完整协议**，取代双方之前就本事项达成的任何口头或书面协议。

### 14.2 可分割性

如本协议任何条款被有管辖权的法院认定为无效、不可执行或违法，该条款将在最小必要范围内被修改或剔除，本协议其余条款继续有效，不受影响。

### 14.3 权利放弃

平台未行使或延迟行使本协议项下的任何权利，不构成对该权利的放弃，也不影响平台此后行使该权利。

### 14.4 转让

您不得将本协议项下的任何权利或义务转让给第三方，未经平台书面同意的转让无效。平台有权将本协议项下的权利义务转让给其关联公司或业务继承方，届时将提前通知用户。

### 14.5 不可抗力

因以下不可抗力事件导致平台无法履行本协议义务的，平台不承担违约责任：

1. 第三方 LLM 服务提供商（DeepSeek、OpenAI 等）的不可预见的服务中断、API 封禁或政策变更；
2. 区块链网络严重拥堵、分叉或技术故障；
3. 中心化交易所（Binance、OKX 等）的 API 关闭、交易暂停或平台破产；
4. 监管机构的突发性政策变化、业务禁令或资产冻结指令；
5. 自然灾害、战争、恐怖主义、疫情等不可预见的重大事件；
6. 大规模网络攻击（DDoS、零日漏洞利用等）。

发生不可抗力事件时，平台将尽快通知用户并采取合理的补救措施，力争最小化对用户的影响。

### 14.6 联系方式

如您对本协议有任何疑问，请通过以下渠道联系我们：

- **客服邮箱**：support@hoot.trade
- **Telegram 客服**：@hoot_support
- **官方网站**：hoot.trade

---

© 2024-2026 Hoot. All rights reserved.

本协议中文版本为正式法律文本，英文版本仅供参考。如两个版本存在冲突，以中文版本为准。`,
  contentEn: `# Hoot Platform User Service Agreement

**Version: 2.0.0**
**Effective Date: March 15, 2026**
**Last Updated: March 1, 2026**

---

## Chapter 1: General Provisions

### 1.1 Parties to This Agreement

This Agreement is entered into between the **Hoot Platform Operator** (hereinafter referred to as "Platform" or "we") and the **User** (hereinafter referred to as "you" or "User") with respect to your use of the Hoot Platform (website: hoot.trade, hereinafter referred to as "this Platform"), which provides AI-powered quantitative trading, strategy subscription, digital asset management, and related services.

This Agreement takes effect from the moment you click "Agree," complete account registration, or use any of the Platform's services in any manner, and is legally binding on both parties.

### 1.2 Legal Effect

**You understand and confirm that**:

1. By clicking "I Agree," "Register Account," or beginning to use any feature of this Platform, you are deemed to have read, understood, and accepted all terms of this Agreement.
2. If you do not agree to any term of this Agreement, please immediately stop using the Platform's services.
3. This Agreement constitutes a legally binding contract between you and the Platform and applies to all your use of this Platform.
4. Clauses in this Agreement that exempt or limit the Platform's liability are highlighted in **bold** to draw your attention; please read them carefully.

### 1.3 Agreement Updates

1. The Platform reserves the right to amend this Agreement from time to time based on business development, changes in laws and regulations, or product upgrades.
2. For **material changes** (including but not limited to: changes to fee structures, core functionality, or data processing methods), the Platform will provide at least **14 days' advance notice** via in-platform notifications, email, or Telegram messages.
3. For **new AI features**, the Platform will require you to provide a separate informed consent (opt-in); your choice to enable AI features constitutes your agreement to the relevant terms.
4. After an Agreement update, your continued use of the Platform's services constitutes acceptance of the updated Agreement. If you disagree, you should stop using the Platform and deactivate your account before the changes take effect.
5. The Platform will display the latest version number and effective date of this Agreement on Platform pages; historical versions are available upon request through customer service.

### 1.4 Document Framework

This Agreement, together with the following documents, constitutes the **complete legal framework** between you and the Platform:

1. **This Agreement** (User Service Agreement v2.0.0) — core rights and obligations
2. **Privacy Policy v2.0.0** — personal data processing rules
3. **Risk Disclosure Statement** — specialized trading risk disclosures

In the event of conflict among the above documents, this Agreement shall prevail; matters not addressed in this Agreement shall be governed by the Privacy Policy and Risk Disclosure Statement.

### 1.5 Definitions

The following terms in this Agreement have the meanings set forth below:

- **"AI Analysis"**: Refers to the automated processing and analysis output by the Platform using Large Language Models (LLMs) on market data, technical indicators, on-chain data, and other information, including but not limited to market condition assessment, trading signal generation, and risk evaluation.
- **"Grid Trading"**: A quantitative trading strategy in which the system automatically executes buy and sell orders at different price levels within a user-defined price range.
- **"LLM Provider"**: Third-party entities providing large language model API services to the Platform, including but not limited to DeepSeek, OpenAI, Anthropic, Google, Alibaba Cloud (Tongyi Qianwen), xAI (Grok), and Moonshot (Kimi).
- **"DEX"**: Decentralized Exchange, where users can conduct on-chain asset transactions through smart contracts without registration, including but not limited to Lighter and Aster.
- **"Private Key"**: The unique cryptographic key that controls blockchain wallet assets. Possession of the private key is equivalent to control of all assets in the corresponding wallet; if a private key is compromised, the assets face the risk of permanent loss.
- **"Vesting"**: The mechanism by which HOOT tokens are gradually unlocked according to a preset schedule; tokens are non-transferable until the vesting period ends.
- **"HOOT Token"**: The utility token issued by the Hoot Platform, used for Platform feature access, staking rewards, points exchange, and ecosystem governance, and does not constitute any form of investment security.
- **"Agent"**: A user who has officially registered under the Platform's agent program, participates in user referrals, and earns commissions according to the rules.
- **"Research Session"**: A complete multi-stage market analysis process initiated by a user within the Platform's AI research feature, including data collection, indicator calculation, multi-model analysis, debate, and final comprehensive report.
- **"Debate System"**: The Platform's proprietary multi-AI role collaborative analysis mechanism, in which virtual roles including a Bull Analyst, Bear Analyst, Technical Analyst, Contrarian, and Risk Officer conduct multi-round debates on specific trading decisions to form a more objective composite judgment.
- **"Market Condition"**: The AI system's classification of the current market's level of volatility into four categories: Sideways (narrow range), Standard (normal trend), Wide (broad fluctuations), and Volatile (extreme market conditions), used to guide adaptive adjustments to grid parameters.
- **"Binding Code"**: A 6-digit one-time verification code used when binding an account via the Telegram Bot, valid for 5 minutes.

---

## Chapter 2: Services

### 2.1 Service Overview

The Platform provides you with the following 12 main services:

1. **Strategy Subscription Service**: You may browse and subscribe to quantitative trading strategies provided by the Platform or third-party strategists in the Platform's strategy marketplace and receive related trading signals.
2. **Signal Distribution Service**: The Platform distributes trading signals generated by the strategy engine to your account in real time via WebSocket, Telegram Bot, and other channels.
3. **Trade Execution Service**: The Platform automatically executes trading instructions in your account through the CEX (Centralized Exchange) API you have authorized.
4. **Asset Management Service**: Includes USDT deposits (on-chain transfers), withdrawals (on-chain withdrawals), Platform balance management, and transaction history queries.
5. **Token Service**: Includes HOOT token airdrop claims, staking mining, staking dividends, and token-related ecosystem features.
6. **AI Trading Service**: Includes AI-driven grid trading strategies, automatic market condition detection, adaptive parameter adjustment, and AI-automated trading decisions.
7. **AI Research Service**: Includes multi-agent debate analysis (Bull/Bear/Technical/Contrarian/Risk Control five-role debate), five-stage analysis pipeline (data collection → indicator analysis → LLM evaluation → debate → comprehensive report), and research history management.
8. **DEX Trading Service**: Executes on-chain contract trades on decentralized exchanges such as Lighter and Aster, using Platform-hosted wallets or user-owned wallets.
9. **Telegram Bot Service**: Provides trade panel operations, balance inquiries, binding code authentication, daily check-ins, and push notifications via the official Telegram Bot (@HootCool_bot).
10. **Membership and Points Service**: Includes monthly/quarterly/annual membership plans, points card purchases and usage (1 point = 1 USDT), and points reward tasks.
11. **Airdrop and Reward Service**: Includes registration airdrops, referral rewards, check-in rewards, and trading profit rewards.
12. **Agent and Referral Service**: Includes agent registration, multi-level commission settlement, agent-exclusive dashboards, and dividend pool distributions.

### 2.2 Nature of Services

**You understand and expressly agree to the following important statements regarding the nature of AI services**:

1. **All AI analyses, trading signals, market condition assessments, debate conclusions, and research reports** provided by this Platform are outputs of technical information processing and **do not constitute any form of investment advice, financial advice, securities recommendations, or legal opinion**.
2. The outputs of AI systems are based on pattern recognition of historical and current market data and **do not represent predictions or guarantees of future market movements**.
3. Any trading decisions you make based on the Platform's AI analysis are **your independent investment judgment**, and the Platform does not assume any liability for profits or losses arising therefrom.
4. Digital asset trading carries extremely high risks, and you may lose your entire invested capital. **Please participate cautiously and only after fully understanding the risks.**

### 2.3 Service Area Restrictions

**Users in the following jurisdictions are expressly prohibited from using this Platform's services**:

- Mainland China
- The United States of America and its territories
- The Democratic People's Republic of Korea
- The Islamic Republic of Iran
- The Russian Federation (certain services)
- Regions subject to sanctions by the United Nations, the European Union, the U.S. Treasury's OFAC, or other major international sanctions bodies
- Any other jurisdiction where local law prohibits digital asset trading or this type of service

You represent and warrant that you are not located in the above restricted regions and are not using this Platform on behalf of any entity in those regions. The Platform reserves the right to implement technical blocking or account banning for restricted regions at any time and assumes no liability for any consequences thereof.

### 2.4 AI Service-Specific Terms

1. **AI Analysis Limitations Disclosure**: The AI analysis system is based on large language models and has inherent limitations, including but not limited to: model hallucination (generating plausible-sounding but factually incorrect content), training data biases, insufficient analytical capability for extreme market conditions, and information loss due to context window constraints. The Platform does not guarantee the accuracy, completeness, or timeliness of AI analysis results.

2. **Debate System Clarification**: The "Bull Analyst," "Bear Analyst," and other roles in the Debate System are AI prompt-engineered personas created by the Platform and are not genuinely independent human analysts or autonomous AI systems. Debate conclusions represent only the model's output within a given prompt framework and do not constitute independent objective judgments.

3. **AI Availability Limitations**: The Platform's AI services depend on API interfaces provided by third-party LLM Providers. The Platform **does not guarantee the continuous availability of AI services**. LLM Providers may cause AI features to be unavailable due to rate limiting, maintenance, service interruptions, or policy changes; the Platform is not liable for compensation in such cases.

4. **AI Decision Audit Rights**: You have the right to review your AI analysis history, debate process logs, and trading decision basis through your Platform account dashboard. The Platform will retain such records for at least 90 days.

5. **Recommendation for Human Review**: For any significant trading recommendations generated by AI, **we strongly recommend that you conduct independent human verification before execution** and should not rely entirely on the AI system for automated decision-making.

### 2.5 DEX Service-Specific Terms

1. **Private Key Custody Disclosure**: When you use the Platform's DEX trading feature, the Platform will generate blockchain wallets for you and custody the corresponding private keys (encrypted and stored using AES-256-GCM). **You understand that custodying private keys means the Platform has technical operational capability over your on-chain assets**, which differs from a fully self-sovereign non-custodial wallet.

2. **Private Key Export Rights**: You have the right to request the export of your private keys at any time; the Platform will provide the plaintext private key after identity verification. After exporting, you are responsible for safeguarding your private key and must not disclose it to any third party.

3. **Smart Contract Risk**: On-chain transactions are executed through smart contracts, which may contain code vulnerabilities, logical flaws, or be subject to hacking attacks, potentially resulting in asset losses. The Platform has taken reasonable security measures, but **does not assume liability for asset losses caused by smart contract risks**.

4. **Irreversibility of On-Chain Transactions**: Once confirmed on the blockchain, transactions cannot be reversed. **The Platform cannot roll back confirmed on-chain transactions.** Please carefully verify transaction parameters before initiating DEX trades.

---

## Chapter 3: User Eligibility and Accounts

### 3.1 User Eligibility

To use this Platform's services, you must simultaneously meet the following conditions:

1. **Age Requirement**: You are at least 18 years of age, or have reached the legal age of majority in your jurisdiction (whichever is higher).
2. **Legal Capacity**: You have full legal capacity and are able to independently assume all obligations stipulated in this Agreement.
3. **Sanctions Compliance**: You are not on any international sanctions list, including but not limited to the UN Security Council sanctions list, the U.S. OFAC SDN list, and the EU sanctions list.
4. **Jurisdictional Compliance**: Digital asset trading or the services provided by this Platform are not expressly prohibited in your jurisdiction.
5. **Independent Judgment**: You have the ability to independently assess the risks of digital asset trading and understand that you may lose your entire investment.

If you register on behalf of a company or institution, you additionally represent that you have the legal authority to bind that entity to this Agreement.

### 3.2 Account Registration

The Platform supports the following account registration methods:

1. **Email Registration**: Provide a valid email address and set a password; registration is complete after email verification.
2. **Wallet Address Registration**: Register by connecting a blockchain wallet address via a supported Web3 wallet (MetaMask, RainbowKit, etc.).
3. **Telegram Binding**: Complete account binding via the official Telegram Bot using a binding code (6 digits, valid for 5 minutes); existing accounts can bind Telegram to enable Bot features.

**Registration Requirements**:
- Each user is permitted to register only one account; multiple account registrations are prohibited.
- Registration information you provide must be truthful, accurate, and complete, and must be updated promptly when information changes.
- The Platform reserves the right to verify registration information; accounts registered with false information may be immediately banned.

### 3.3 Account Security

1. **Password Protection**: You should set a strong password and bear confidentiality obligations for your account password and login credentials, and must not provide your account to any third party.

2. **Brute Force Protection**:
   - After **5 consecutive** failed login attempts for the same email address, the account will be locked for **30 minutes**.
   - After **15 consecutive** failed login attempts from the same IP address, that IP will be locked for **30 minutes**.

3. **Access Token Management**: The Platform uses a rolling Token mechanism; each login issues a new access token, and expired tokens automatically become invalid. You are advised to regularly log out of inactive login sessions.

4. **Two-Factor Authentication (2FA)**: **It is strongly recommended** that you enable 2FA to enhance account security. For accounts with bound DEX wallets or API Keys, enabling 2FA is strongly advised.

5. **Unusual Login Notifications**: Upon detection of anomalous activity such as logins from unusual locations, the Platform will send security alerts to your registered email or Telegram.

6. **Account Security Responsibility**: The Platform is not responsible for losses resulting from account compromises due to your negligence (including password leakage, device loss, clicking phishing links, etc.). You should immediately contact Platform customer service upon discovering account anomalies.

### 3.4 Account Restrictions and Termination

The Platform reserves the right to restrict, suspend, or terminate your account in the following circumstances:

1. You violate any provision of this Agreement;
2. You provide false registration information;
3. Your account is suspected of fraud, money laundering, or other illegal activities;
4. Required by regulatory authorities or law enforcement agencies;
5. Your account is long inactive (no login for more than 24 months).

The Platform will provide reasonable advance notice before account termination (except for urgent security matters). After account termination, your Platform balance will be returned via the withdrawal process (subject to applicable fees).

---

## Chapter 4: Key Authorization

### 4.1 CEX API Authorization Overview

To enable automated trade execution, you may authorize the Platform to use your API credentials from centralized exchanges (such as Binance, OKX, etc.). The Platform will execute strategy signals on your behalf in the corresponding exchange using your API credentials.

### 4.2 API Permission Requirements

When creating API credentials at an exchange, **you must adhere to the following permission rules**:

- **Must enable**: Trading permissions (read account information, place orders, cancel orders)
- **Must NOT enable**: Withdrawal permissions

**You represent and warrant that the API credentials you authorize to the Platform do not have withdrawal permissions enabled.** Any losses resulting from your accidental activation of withdrawal permissions are your sole responsibility.

### 4.3 Secure API Storage

1. Your CEX API credentials (API Key and Secret) are encrypted using **AES-256-GCM** during transmission and storage; encryption keys are securely managed by the Platform and are not stored in plaintext in databases or logs.
2. Platform personnel **cannot view** the plaintext of your API Secret; API credentials are briefly decrypted in memory only when executing trades.
3. If you delete an API Key authorization, the Platform will immediately cease using it and purge the encrypted credential data from the system.
4. You may view, add, or remove authorized API Keys at any time in your account settings.

### 4.4 DEX Wallet and Private Key Management

1. **Private Key Generation**: When you enable DEX trading features, the Platform will generate wallet private keys for you on the corresponding blockchain (EVM-compatible chains, Solana, etc.) and store them encrypted using AES-256-GCM in the Platform's secure database.

2. **Private Key Export Rights**: You may apply to export your private key plaintext in account settings; full identity verification is required before the application. Exported private keys are your responsibility to safeguard, and **the Platform is not liable for any losses resulting from improper storage after private key export**.

3. **Custody Risk Acknowledgment**: You expressly acknowledge and accept the following risks:
   - While the Platform holds your private keys in custody, your on-chain assets are at risk of theft if the Platform suffers a cyberattack;
   - The Platform is obligated to take reasonable technical and administrative measures to protect private key security, but **cannot guarantee zero risk**;
   - If you are unwilling to bear custody risks, you should choose to use your own wallet (non-custodial method) to connect to DEX.

4. **Chain-Specific Risks**:
   - **Solana and its L2s**: Account rent deposits, program upgrade risks, MEV attacks.
   - **EVM-compatible chains**: Gas fee volatility, incomplete smart contract audit risks, transaction delays due to network congestion.

### 4.5 LLM API Key Management

1. **Supported LLM Providers**: The Platform supports users providing their own API keys from the following 7 LLM Providers: DeepSeek, OpenAI, Anthropic, Google (Gemini), Alibaba Cloud (Tongyi Qianwen), xAI (Grok), and Moonshot (Kimi).

2. **Key Usage Restrictions**: LLM API keys you provide are **used exclusively** for generating AI trading analyses and research reports for you and for no other purpose.

3. **Encrypted Storage**: LLM API keys are stored using the same AES-256-GCM encryption scheme as CEX API keys; Platform personnel cannot view them in plaintext.

4. **Self-Incurred Costs**: Users who provide their own LLM API keys are responsible for paying corresponding LLM service fees directly to the respective LLM Providers. The Platform assumes no liability for LLM Provider billing changes, quota overages, or billing disputes.

5. **Priority Rules**: When AI features invoke LLMs, the priority order is: **User-provided keys > Platform-configured keys > System environment variables**. If user-provided keys are unavailable (invalid, quota exhausted, etc.), the system will automatically fall back to Platform keys and record this fallback event in the account.

6. **Key Validity Verification**: When adding an LLM API key, the Platform will conduct a connectivity test. Test results only verify current availability and do not represent a guarantee of future continuous availability.

### 4.6 Liability Disclaimer

For the following three types of credentials (CEX API keys, DEX private keys, LLM API keys), the Platform **expressly disclaims liability** for:

- Losses resulting from your voluntary disclosure of credentials to third parties;
- Credential theft resulting from malware infection of your device;
- Security incidents caused by your use of third-party tools outside the Platform to read or operate credentials;
- Extreme security events caused by force majeure (cyberattacks, zero-day exploits, etc. beyond Platform control) (the Platform will endeavor to implement industry-reasonable preventive measures).

---

## Chapter 5: Fees and Payments

### 5.1 Fee Structure

The Platform currently charges the following fees:

1. **Strategy Subscription Fee**: Charged monthly according to each strategy's pricing; specific amounts are as displayed on the Platform's strategy detail pages, and the Platform reserves the right to adjust strategy pricing.

2. **Performance Fee (Fuel Fee)**: Charged only when a strategy generates **positive profits** at a rate of **20% of profit**; **no performance fee is charged during loss periods**. Performance fees are calculated based on net profits per settlement cycle; settlement cycle rules are as defined by the Platform.

3. **Withdrawal Fee**: When initiating an on-chain withdrawal, users pay the actual Gas fees for the corresponding network; the Platform does not charge additional fees beyond Gas fees (except as otherwise announced in special circumstances).

4. **Membership Plan Fee**: The Platform offers monthly, quarterly, and annual membership plans, with different levels providing varying strategy access, AI invocation quotas, and exclusive features.

5. **AI Analysis Cost**: For users who utilize Platform-provided LLM keys for AI research, the Platform will charge costs proportional to actual Token consumption; specific pricing per unit is as announced by the Platform.

### 5.2 Payment Methods

The Platform supports the following payment methods:

1. **USDT Balance**: Directly deducted from your Platform USDT account balance; highest priority.
2. **Points Cards**: Platform points cards (1 point = 1 USDT equivalent), purchasable within the Platform, applicable to various Platform fees.
3. **HOOT Tokens**: Users holding HOOT Tokens may use them to pay for certain fees; applicable scope and discount ratios are as announced by the Platform.

### 5.3 AI Cost Transparency

The Platform commits to providing you with the following AI cost information:

1. **Call Cost Tracking**: Token consumption and calculated costs for each AI analysis invocation will be viewable in your account dashboard.
2. **Monthly Budget System**: You may set a monthly spending cap for AI services in account settings; once the cap is reached, AI features will automatically pause until the next month's reset or you manually adjust the cap.
3. **Model Cost Comparison**: The Platform will publish per-Token costs for each LLM Provider and model on the official website for your reference when selecting appropriate models.

### 5.4 Refund Policy

1. **Strategy Subscription Fees**: Already-paid monthly subscription fees are **generally non-refundable**. If the service is unavailable due to Platform reasons (service failure, forced strategy delisting, etc.), the Platform will calculate and refund in proportion to actual unavailability time.

2. **Performance Fees**: Settled performance fees are **non-refundable**; if you believe a calculation is incorrect, you may apply for review through customer service within 7 days.

3. **Membership Plan Fees**: Activated membership plans are **non-refundable**; unactivated plans may be refunded upon application.

4. **Points Cards**: Once used or gifted, points cards are **non-refundable**; unused points cards within their validity period may be refunded (subject to handling fees).

5. **Exceptional Circumstances**: The Platform may be required by law or regulatory authority to refund partial or full fees; such refunds will be processed in accordance with the relevant regulations.

### 5.5 Fee Adjustments

1. The Platform reserves the right to adjust its fee structures based on operating costs, market changes, and other factors.
2. Fee adjustments will be communicated at least **7 calendar days** in advance via in-platform announcements, email, or Telegram.
3. Fee adjustments apply to new settlement cycles after the effective date and do not affect already-paid fees.

---

## Chapter 6: HOOT Token Economy

### 6.1 Token Nature and Disclaimer

1. **HOOT Token is a utility token issued by the Platform**, designed to provide Platform users with functional access, staking rights, ecosystem governance, and other usage value.

2. **HOOT Token does not constitute any form of security, equity, bond, investment contract, or other financial instrument.** Holding HOOT Tokens does not represent any ownership interest or income claim against the Platform company.

3. **The Platform makes no guarantee or representation regarding the market price, liquidity, or appreciation of HOOT Tokens.** Token prices are subject to market supply and demand and may fluctuate significantly or become worthless; you should fully understand and accept these risks.

4. Holding or using HOOT Tokens may be subject to the laws of your jurisdiction. **You are responsible for understanding and complying with applicable local laws and regulations**; the Platform does not provide legal advice on compliance obligations.

### 6.2 Airdrop Rules

The Platform's current HOOT Token airdrop rules are as follows:

1. **Registration Reward**: Successfully completing account registration and email verification earns **20 HOOT**.
2. **Referral Reward**: Successfully inviting a new user to register and complete verification via your exclusive referral link or code earns **15 HOOT** per referred user.
3. **Check-in Reward**: Completing daily check-in (via the Platform App or Telegram Bot) earns **2-8 HOOT**, with rewards increasing with consecutive check-in days and resetting to the base value upon interruption.
4. **Trading Profit Multiplier**: When monthly strategy trading generates positive profits, airdrops already earned that month (excluding the profit multiplier itself) receive a **2x bonus**.

**Important Restrictions**:
- The Platform **reserves the right to modify, suspend, or terminate** the airdrop program at any time; modifications will be announced in advance.
- Exploiting the system through multiple accounts, fake referrals, wash trading, or other means is strictly prohibited; upon detection, related tokens will be confiscated and accounts banned.
- Airdrop tokens may be subject to vesting mechanisms; specific release schedules will be as announced by the Platform.

### 6.3 Vesting Mechanism

1. Certain HOOT Token rewards (including specific airdrop batches, team tokens, etc.) are subject to vesting mechanisms; tokens in the locked state before the vesting period ends cannot be circulated, staked, or transferred.
2. Vesting schedules will be clearly communicated when respective rewards are issued; they are generally recorded in blockchain contracts with publicly verifiable on-chain data.
3. **If you violate this Agreement, the Platform reserves the right to confiscate or cancel unvested token rewards to a reasonable extent**; already-vested tokens are not affected.

### 6.4 Staking Rules

1. **Flexible Staking**: Redeemable at any time, weight coefficient of **1.0x**, dividends distributed proportionally based on actual staking amount.
2. **Fixed-Term Staking**: The longer the lock-up period, the higher the weight coefficient, with a maximum of **3.0x**; early redemption during the lock-up period is not permitted (except in special circumstances as stated).
3. **Staking Dividends**: The Platform allocates a certain proportion of Platform fee income to the staking dividend pool weekly, distributed to all staking users in proportion to their staking weight; dividends are paid in USDT or HOOT (subject to actual conditions).
4. **Smart Contract Risk**: Staking features are implemented through on-chain smart contracts and carry risks of contract vulnerabilities and external attacks, which may result in staked asset losses. **The Platform assumes no liability for staking losses caused by smart contract issues**.

### 6.5 Token Supply and Distribution

Information on HOOT Token total supply, allocation ratios, and release schedules will be publicly available in the Platform's whitepaper and official announcements. The Platform reserves the right to adjust token economic parameters within reasonable limits, but significant adjustments to core allocation ratios will be subject to community announcement with a reasonable transition period.

---

## Chapter 7: Agent and Referral Program

### 7.1 Agent Program Overview

The Platform maintains an official agent referral program with the following four tiers:

| Tier | Name | Advancement Requirements |
|------|------|-------------------------|
| L1 | Bronze | Meet basic registration requirements |
| L2 | Silver | Meet cumulative referral user count and trading volume thresholds |
| L3 | Gold | Meet higher referral volumes and Platform contribution metrics |
| L4 | Platinum | Meet top-tier referral volumes and Platform strategic cooperation requirements |

Specific advancement conditions, exclusive benefits, and dividend pool allocation ratios for each tier are as announced in the Platform's agent section.

### 7.2 Commission Structure

1. **Direct Referral Commission (L1)**: For strategy subscription fees and performance fees generated by users you directly refer (first-tier referrals), you earn **10%** in commissions.
2. **Indirect Referral Commission (L2)**: For applicable fees generated by users referred by users you referred (second-tier referrals), you earn **5%** in commissions.
3. **Tier Restriction**: The commission system is **strictly limited to two levels** and does not extend to the third tier or beyond. This program **does not constitute pyramid selling or illegal multi-level distribution**.
4. **Commission Overlap**: If the same user falls within the referral scope of multiple agents, the referral relationship first recorded by the system prevails; commissions are not calculated multiple times.

### 7.3 Commission Settlement

1. **Settlement Frequency**: Commissions are settled monthly; valid commissions generated in the previous month will be settled to your Platform account balance on a fixed date each month.
2. **Minimum Withdrawal Threshold**: Commission balances must reach the Platform-specified minimum threshold (specific amount as announced) before initiating a withdrawal.
3. **Tax Responsibility**: Tax filing and payment obligations for commission income are **entirely your own responsibility**; the Platform does not withhold or remit taxes and does not provide tax advice.
4. **Commission Source Verification**: The Platform will periodically audit the compliance of commission sources; commissions obtained through fraudulent means may be recalled and pursued.

### 7.4 Agent Dividend Pool

1. The Platform allocates a certain proportion of fee income to the agent dividend pool monthly, distributed according to agent tier and contribution.
2. The dividend pool includes HOOT Token buyback portions to enhance token value.
3. **The Platform does not guarantee that the dividend pool will have income every month**; dividend amounts depend on overall Platform operating revenue and may be zero.
4. Dividend calculation and distribution rules are as announced by the Platform each month; the Platform reserves the right to adjust dividend ratios based on operating conditions.

### 7.5 Agent Obligations

As an agent, you commit and warrant that:

1. **No Misleading Promotion**: You will not promise potential users fixed returns or guaranteed profits, and will not exaggerate Platform features or conceal material risks.
2. **Compliance with Local Advertising Laws**: Promotional activities in your jurisdiction must comply with local advertising laws and regulations; marketing financial products may require local regulatory permits.
3. **Risk Disclosure Obligation**: You must ensure that users you refer have understood the main risks of digital asset trading before registering; you must not recommend to individuals clearly lacking risk tolerance.
4. **No Official Impersonation**: You may not issue any statements, commitments, or representations in the name of the Platform's official entity.
5. **Non-Transferability of Agent Status**: Agent status is a personal qualification and may not be transferred, sold, or sub-licensed to third parties.

### 7.6 Agent Status Termination

The following circumstances will result in termination of agent status and clawback of settled commissions:

- Violation of obligations listed in Article 7.5;
- Obtaining commissions through fake accounts or wash trading;
- Violation of other provisions of this Agreement;
- Account ban or deactivation.

After termination of agent status, historical commissions generated through your referral relationships (excluding the violation period) will be settled normally; commissions during the violation period will be confiscated.

---

## Chapter 8: User Code of Conduct

### 8.1 Prohibited Activities

When using this Platform, you are strictly prohibited from engaging in the following activities:

**Category I: Illegal and Regulatory Violations**
1. Using the Platform for money laundering, terrorist financing, gambling, fraud, market manipulation, or other illegal activities;
2. Circumventing or attempting to circumvent any regulatory requirements applicable to you;
3. Transferring assets to sanctioned individuals, entities, or regions;
4. Forging identities or using another person's identity to register or use an account.

**Category II: Technical Abuse**
1. Unauthorized access, penetration testing, or brute-force attacks on Platform systems;
2. Using automated scripts or bots to make bulk requests to Platform interfaces beyond normal usage;
3. Exploiting known or unknown Platform vulnerabilities for arbitrage or improper gain;
4. Interfering with, damaging, or overloading Platform infrastructure.

**Category III: AI System Abuse**
1. **Prompt Injection Attacks**: Constructing special inputs to circumvent AI system safety constraints or manipulate AI outputs;
2. **Adversarial Input Manipulation**: Systematically testing AI system boundaries with the purpose of disrupting AI trading decision logic;
3. **Model Weight Extraction**: Systematically invoking the Platform to reverse-engineer or extract AI model weights, architectures, or Prompts;
4. **Commercial Resale of AI Outputs**: Using AI-generated analysis reports for commercial sale or distribution beyond personal use.

**Category IV: Telegram Bot Abuse**
1. Using bots or automated programs to interact with the Platform Bot on your behalf;
2. High-frequency spamming of Bot commands that interferes with other users;
3. Spreading illegal, harassing, or spam content through the Bot.

**Category V: Token Exploitation**
1. Registering multiple accounts to obtain multiple airdrop rewards;
2. Earning referral rewards through fake referrals, self-referrals, or wash trading;
3. Systematically exploiting loopholes in check-in, task, and other reward mechanisms.

**Category VI: Agent Fraud**
1. Promising guaranteed investment returns to referred individuals;
2. Conducting promotions with misleading, false, or exaggerated materials;
3. Concealing material risk information or Platform limitations.

### 8.2 Handling of Violations

The Platform's measures for handling violations include but are not limited to:

1. **Warning**: For first-time minor violations, issuing a written warning.
2. **Feature Restrictions**: Temporarily suspending permission to use specific features.
3. **Account Freeze**: Temporarily freezing the account and prohibiting operations, with balances inaccessible during the freeze period.
4. **Token Confiscation**: Confiscating tokens and commissions obtained through violations.
5. **Permanent Account Ban**: For serious violations, permanent account banning with balances handled according to regulations.
6. **Legal Action**: For serious violations involving money laundering, fraud, and other crimes, the Platform reserves the right to report to law enforcement and pursue legal remedies.

---

## Chapter 9: Intellectual Property

### 9.1 Platform Rights

The following content on this Platform constitutes the Platform's exclusive intellectual property and is protected by copyright law, patent law, trademark law, and other applicable laws:

1. Platform software code, system architecture, and database design;
2. Trading strategy algorithms, signal generation models, and related technical documentation;
3. AI analysis models, Prompt engineering designs, Debate System frameworks, and related training datasets;
4. Platform UI/UX design and brand identifiers (HOOT and related logos and mascots);
5. Platform whitepapers, user documentation, and research reports (those published by the Platform itself).

Without written authorization from the Platform, you may not copy, modify, distribute, sell, rent, or exploit the above intellectual property in any manner.

### 9.2 License for AI-Generated Content

1. For personal analysis reports, research records, and debate logs you generate through this Platform's AI features, the Platform grants you a **personal, non-commercial, non-transferable usage license**.
2. You **may not** commercially resell, commercially distribute, mass-circulate on social media (beyond personal sharing), or use Platform AI-generated analysis content as a basis for providing investment advice to third parties.
3. The Platform retains the right to use anonymized data from all AI-generated content for model improvement purposes (see Privacy Policy for details).

### 9.3 User Content

1. For content you publish on the Platform (such as comments, strategy descriptions, etc.), you retain the corresponding copyright but simultaneously grant the Platform a non-exclusive license to display and distribute within the Platform.
2. You warrant that content you publish does not infringe third-party intellectual property rights; if infringement disputes arise, you shall independently bear responsibility and compensate the Platform for any resulting losses.

---

## Chapter 10: Privacy Protection

The rules governing the Platform's personal data processing are detailed in the **Hoot Privacy Policy v2.0.0**, which together with this Agreement constitutes the complete agreement between you and the Platform regarding data processing.

Your use of this Platform's services constitutes your agreement to the relevant provisions in the Privacy Policy regarding data collection, processing, storage, and sharing. If you do not agree to the Privacy Policy, please immediately stop using this Platform.

The Platform commits to protecting your personal data using industry-standard technical and administrative measures in accordance with the Privacy Policy. However, as this Agreement has made sufficient disclosure of data security risks in relevant clauses, the Platform does not bear unlimited liability for data security events beyond the scope of express commitments in this Agreement.

---

## Chapter 11: Risk Disclosures and Disclaimers

### 11.1 Investment Risks

**Digital asset investment is a high-risk investment activity, with specific risks including but not limited to**:

1. Extreme price volatility: Digital asset prices can decline dramatically or become worthless in a short time;
2. Regulatory risk: Regulatory policies for digital assets in various countries are rapidly evolving and may lead to Platform service restrictions;
3. Liquidity risk: In certain market conditions, assets may not be liquidated in a timely manner;
4. Counterparty risk: Exchanges (CEX/DEX) may fail due to technical failures, liquidity crises, or fraud;
5. Technical risk: Asset losses due to blockchain network failures, smart contract vulnerabilities, or key loss.

**You should only participate in digital asset investments with funds you can afford to lose; never use living expenses or borrowed funds for investment.**

### 11.2 AI Trading Risks

Using the Platform's AI trading features involves the following specific risks:

1. **AI Hallucination Risk**: LLMs may generate market analyses that sound plausible but are factually incorrect, leading to erroneous trading decisions;
2. **Debate Consensus Failure**: Multi-AI role debates may reach incorrect "consensus" when information is insufficient; debate conclusions are not guaranteed to be superior to single-model analysis;
3. **Model Degradation Risk**: LLM Provider model updates may cause unforeseen changes to AI analysis logic;
4. **Prompt Limitations**: AI system analytical capabilities are constrained by Prompt design and cannot cover all market scenarios; the system may fail in extreme market conditions;
5. **Latency Risk**: AI analysis requires processing time; market prices may change significantly before analysis is complete.

### 11.3 Automated Trading Risks

1. **Grid Trending Losses**: Grid trading strategies may sustain continuous losses in one-directional trending markets and are not suited for all market environments;
2. **Automated Execution Risk**: The Platform automatically executes strategy signals, potentially accumulating risk exposure beyond expectations while you are not monitoring your account;
3. **Incomplete Safety Constraints**: Although the Platform maintains various safety constraints, it cannot guarantee effective prevention of excessive losses in all extreme scenarios;
4. **System Failure Risk**: Platform technical failures, network interruptions, or exchange API anomalies may cause strategy execution failures or delays, resulting in unexpected losses.

### 11.4 Disclaimers

**The Platform expressly disclaims liability for the following circumstances**:

1. Trading losses caused by incorrect analyses produced by AI models (including the Debate System);
2. Losses during periods when AI features are unavailable due to unforeseen service interruptions, rate limiting, or service termination by third-party LLM Providers;
3. Asset losses caused by smart contract vulnerabilities, upgrades, or service termination of DEX platforms (Lighter, Aster, etc.);
4. Losses caused by HOOT Token price declines, insufficient liquidity, or value becoming zero;
5. Losses caused by regulatory policy changes requiring the Platform to cease services or freeze assets;
6. Losses caused by user operational errors (incorrect trading parameters, accidentally triggered Telegram Bot commands, etc.);
7. Service interruptions or losses caused by force majeure events (natural disasters, war, terrorism, pandemics, large-scale cyberattacks, blockchain network failures, etc.).

### 11.5 Limitation of Liability

To the maximum extent permitted by applicable law, **the Platform's total liability to users for compensation is limited to the total amount of fees actually paid by the user to the Platform in the 12 calendar months preceding the claim event**, and shall not exceed this limit.

The above limitation of liability does not apply to: losses directly caused by Platform intentional fraud or gross negligence; in jurisdictions that do not permit liability limitations, local law applies.

---

## Chapter 12: Telegram Bot Terms

### 12.1 Bot Service Scope

The Platform's official Telegram Bot (@HootCool_bot) provides the following features:

1. Account binding (via 6-digit binding code, valid for 5 minutes);
2. Real-time trade panel (view positions, balance, strategy status);
3. Trading operations (one-click close all /closeall, single strategy operations, etc.);
4. Daily check-in (earn HOOT check-in rewards);
5. Balance inquiries and transaction history push notifications;
6. Important push notifications (large transaction alerts, account security alerts, etc.).

### 12.2 Telegram Platform Dependency

1. The Platform's Bot service depends on the normal operation of the Telegram platform. Telegram service interruptions, policy changes, or blocking in certain regions will directly impact Bot service availability.
2. **The Platform assumes no responsibility for the availability, security, or content of the Telegram platform itself**; Bot service interruptions do not constitute Platform breach of contract.
3. If the Telegram platform restricts Bot services, the Platform will endeavor to provide alternative services through other channels (web, app).

### 12.3 Command Security and Confirmation Mechanism

1. **High-Risk Commands** (such as /closeall, /withdraw, etc.): Require secondary confirmation before execution. **Once confirmed, instructions take effect immediately and cannot be reversed**; please exercise extreme caution.
2. **Session Security**: Telegram Bot sessions have no timeout, but binding codes have a 5-minute validity period; new codes must be requested after expiry.
3. **Accidental Operation Protection**: The Platform implements reasonable frequency limits on high-risk commands to prevent accidental repeated execution.
4. If your Telegram account is compromised, others may operate your Platform account via the Bot. Upon discovering account anomalies, immediately request account unbinding from the Platform.

### 12.4 Telegram Data Collection

1. When interacting with the Platform via the Telegram Bot, the Platform collects your Telegram User ID and related interaction data for the purpose of providing Bot services and account security management.
2. The Platform does not collect any communication content from your Telegram private chats or group conversations (outside of interactions with the Platform Bot).
3. The Telegram platform's own data collection practices are governed by Telegram's Privacy Policy and are unrelated to this Platform.

---

## Chapter 13: Dispute Resolution

### 13.1 Negotiated Resolution

If any dispute arises between you and the Platform, both parties should first attempt to resolve it through friendly negotiation. You may submit a complaint to the Platform through the following contact methods:

- Email: support@hoot.trade
- Telegram: @hoot_support
- In-Platform customer service system

The Platform will provide a written response within **15 business days** of receiving a complaint.

### 13.2 Arbitration

1. If negotiation fails to resolve the dispute within 30 days, either party may submit the dispute to the **Hong Kong International Arbitration Centre (HKIAC)** for arbitration.
2. The arbitration will be conducted in accordance with HKIAC's then-current arbitration rules; the arbitration seat is the **Hong Kong Special Administrative Region**, and the arbitration language is Chinese (English may be added as necessary).
3. Arbitral awards are final and binding on both parties.
4. Arbitration costs are borne by the losing party, although the arbitrator may make different arrangements based on specific circumstances.

### 13.3 Governing Law

The formation, validity, performance, interpretation, and dispute resolution of this Agreement are all governed by the laws of the **Hong Kong Special Administrative Region** (without regard to conflict of laws rules).

### 13.4 Class Action Waiver

**To the extent permitted by applicable law, you agree to resolve any disputes with the Platform on an individual basis and waive your right to participate in class actions, class arbitrations, or any other proceedings asserting rights on a collective basis.** If this provision is not applicable in your jurisdiction, local law prevails.

---

## Chapter 14: Miscellaneous

### 14.1 Entire Agreement

This Agreement (including the Privacy Policy, Risk Disclosure Statement, and other documents referenced herein) constitutes the **entire agreement** between you and the Platform with respect to Platform services and supersedes any prior oral or written agreements between the parties on this subject matter.

### 14.2 Severability

If any provision of this Agreement is determined by a court of competent jurisdiction to be invalid, unenforceable, or unlawful, that provision will be modified or severed to the minimum necessary extent, and the remaining provisions of this Agreement will continue in full force and effect.

### 14.3 Waiver

The Platform's failure to exercise or delay in exercising any right under this Agreement does not constitute a waiver of that right and does not affect the Platform's ability to exercise that right thereafter.

### 14.4 Assignment

You may not assign any rights or obligations under this Agreement to any third party; assignments without the Platform's written consent are void. The Platform reserves the right to assign rights and obligations under this Agreement to its affiliates or business successors, with advance notice to users.

### 14.5 Force Majeure

The Platform shall not be liable for breach of this Agreement where it is unable to perform its obligations due to the following force majeure events:

1. Unforeseen service interruptions, API blocks, or policy changes by third-party LLM service providers (DeepSeek, OpenAI, etc.);
2. Serious blockchain network congestion, forks, or technical failures;
3. API shutdowns, trading suspensions, or platform insolvency at centralized exchanges (Binance, OKX, etc.);
4. Sudden regulatory policy changes, business prohibitions, or asset freeze orders by regulatory authorities;
5. Unforeseen major events including natural disasters, war, terrorism, and pandemics;
6. Large-scale cyberattacks (DDoS, zero-day exploit exploitation, etc.).

In the event of a force majeure event, the Platform will notify users as soon as possible and take reasonable remedial measures to minimize the impact on users.

### 14.6 Contact Information

If you have any questions about this Agreement, please contact us through the following channels:

- **Customer Service Email**: support@hoot.trade
- **Telegram Support**: @hoot_support
- **Official Website**: hoot.trade

---

© 2024-2026 Hoot. All rights reserved.

The Chinese version of this Agreement is the authoritative legal text; the English version is provided for reference only. In the event of conflict between the two versions, the Chinese version prevails.`
}

// ============================================
// 隐私政策 / Privacy Policy
// ============================================
export const privacyPolicy: LegalDocumentContent = {
  slug: 'privacy',
  titleZh: '隐私政策',
  titleEn: 'Privacy Policy',
  version: '2.0.0',
  effectiveDate: '2026-03-15',
  contentZh: `
# 隐私政策

**版本：2.0.0**
**生效日期：2026年3月15日**
**最后更新：2026年3月1日**

---

## 第一章 引言

欢迎使用 Hoot 平台（以下简称"本平台"、"我们"或"Hoot"）。

Hoot 是一个面向全球用户的 AI 驱动量化交易与资产管理平台。我们深知您的个人信息对您而言至关重要，因此我们将保护您的隐私和个人数据安全视为最高优先事项之一。

本隐私政策（以下简称"本政策"）旨在向您说明：我们收集哪些信息、如何使用这些信息、如何存储和保护这些信息，以及您对自己数据所拥有的权利。本政策参照并符合以下国际标准与法规的基本原则：

- **欧盟人工智能法案（EU AI Act）**：关于高风险 AI 系统的透明度、可问责性与人工监督要求
- **欧盟加密资产市场监管框架（MiCA）**：关于加密资产服务提供商的数据处理规范
- **新加坡个人数据保护法（PDPA）**：关于个人数据的收集、使用与披露规范
- **通用数据保护条例（GDPR）**精神原则：数据最小化、目的限制、存储期限合理化

**重要提示**：在使用 Hoot 平台的任何服务（包括但不限于网页、移动应用、Telegram 机器人、API 接口及 AI 交易功能）之前，请您仔细阅读本政策全文。**您使用或继续使用本平台服务，即表示您已阅读、理解并同意本政策的全部条款。** 如您不同意本政策，请立即停止使用本平台所有服务。

如您对本政策有任何疑问，可通过第十三章所列联系方式与我们取得联系。

---

## 第二章 信息收集

我们收集的信息来源于三类渠道：您主动提供的信息、平台自动收集的信息，以及来自第三方的信息。

### 2.1 您主动提供的信息

在您注册账户、使用功能或与我们沟通时，您可能主动向我们提供以下信息：

**账户基本信息**
- 邮箱地址（用于账户注册与登录身份验证）
- 用户名或昵称（用于平台内展示）
- 账户密码（经 bcrypt 单向哈希加密后存储，我们无法还原您的明文密码）
- 手机号码（用于双因素认证及安全通知，选填）

**身份验证信息**
- 区块链钱包地址（用于加密资产充提、链上身份验证及 DEX 交互）
- Telegram 账户 ID 及用户名（用于 Telegram Bot 登录、信号推送与社区互动）

**支付与交易信息**
- 充值记录（金额、时间、链上交易哈希）
- 提现记录（金额、时间、目标地址、链上交易哈希）
- 订阅记录（套餐类型、有效期、支付方式）
- 交易历史（交易对、方向、数量、价格、执行时间）

**交易所 API 信息**
- 交易所 API Key 及 API Secret（用于代您在 Binance、OKX、Bybit 等交易所执行交易）
- 以上密钥经 **AES-256-GCM** 算法加密后存储，加密密钥仅在服务器内存中持有，不以明文形式写入任何数据库或日志

**LLM API 密钥**
- 您自行提供的大语言模型（LLM）API 密钥，支持：DeepSeek、OpenAI、Anthropic、Google、阿里云（百炼）、xAI（Grok）、Moonshot（月之暗面）
- 以上密钥同样经 **AES-256-GCM** 算法加密存储，仅用于代您调用相应 AI 服务，不用于任何其他目的

**AI 配置偏好**
- 选用的 AI 模型名称及版本
- 模型温度参数（Temperature）及其他推理参数
- 月度 LLM 费用预算上限设置
- AI 交易风险控制参数（最大持仓比例、止损阈值、最大回撤容忍度等）

**DEX 钱包信息**
- 用于 Lighter、Aster 等去中心化交易所（DEX）的区块链钱包地址
- 由您授权委托平台管理的加密私钥（经 AES-256-GCM 加密后存储，仅用于执行您授权的 DEX 交易操作）

**会员信息**
- 当前套餐类型（基础版、专业版、机构版等）
- 订阅开始与到期日期
- 历史订阅与续费记录

**推荐与代理商信息**
- 您使用或分发的邀请码
- 代理商等级及晋升历史
- 邀请用户列表及活跃状态
- 佣金发放历史及提现记录

**通信信息**
- 您与客服团队的沟通记录
- 您提交的反馈、建议或投诉内容
- 您参与问卷调查的回复

### 2.2 自动收集的信息

当您使用本平台时，我们的系统会自动收集以下信息：

**设备信息**
- 设备类型（PC、手机、平板）及型号
- 操作系统名称及版本
- 浏览器类型及版本
- 屏幕分辨率及色深
- 设备唯一标识符（Device ID，用于多设备登录管理）

**网络信息**
- IP 地址（用于安全检测、异常登录识别及地理位置推断）
- 互联网服务提供商（ISP）
- 大致地理位置（国家/地区级别，精确到城市级别以供风控使用）

**使用行为信息**
- 登录时间、登录频率及会话时长
- 功能使用情况（哪些功能被使用、使用频率）
- 页面浏览路径及停留时长
- 点击行为及交互操作序列
- 搜索关键词（在平台内搜索策略或交易对时）

**系统日志信息**
- 系统错误日志（含错误码、错误信息、发生时间）
- API 调用日志（接口名称、调用时间、响应状态码、请求 ID）
- 安全事件日志（登录失败、异常访问、权限拒绝等）

**AI 分析数据**
- 用于 AI 辅助分析的技术指标数值：RSI、MACD、布林带（BB）、ATR、OBV 等
- AI 分析置信度评分及置信区间
- 多智能体辩论过程记录（各 AI 角色的论点、反驳与结论）
- AI 推理链（Chain-of-Thought）内容
- 多智能体共识结果及投票记录
- AI 研究会话（Research Session）的输入输出数据

**网格交易数据**
- 网格策略运行时的格线状态（各格线价格、持仓状态、挂单状态）
- 市场状态分类（趋势市、震荡市、突破信号等）
- 实时浮动盈亏及已实现盈亏
- 价格突破检测事件记录
- 每日盈亏快照（Daily PnL Snapshot）

**LLM 使用统计**
- 每次 AI 调用消耗的 Token 数量（输入 Token / 输出 Token）
- 每次 AI 调用的估算费用
- API 调用延迟（响应时间）
- 模型选择历史记录
- 月度预算使用进度及预警触发记录

**Telegram Bot 数据**
- Telegram 用户 ID 及用户名（从 Telegram API 获取）
- Bot 命令使用历史（如 /start、/balance、/checkin 等）
- 签到时间戳及连续签到天数
- 与 Bot 的交互频率及消息类型

**策略绩效数据**
- 历史交易胜率
- 夏普比率（Sharpe Ratio）
- 最大回撤（Max Drawdown）及回撤持续时间
- 完整交易历史记录（含进出场信号来源）

### 2.3 来自第三方的信息

我们也可能从以下第三方渠道获取与您账户相关的信息：

- **交易所 API**：通过您提供的 API Key，获取您在 Binance、OKX、Bybit 等交易所的账户余额、持仓状态及历史成交数据
- **区块链网络**：从公开区块链账本读取与您钱包地址相关的链上交易记录（此类信息本质上公开，任何人均可查询）
- **AI 模型服务提供商**：AI 模型对您提交请求的响应内容（我们将其用于展示给您，并记录以供性能分析）
- **去中心化交易所（DEX）**：Lighter、Aster 等 DEX 对您委托执行的链上交易的确认状态
- **Telegram API**：您通过 Telegram Bot 发起的交互数据（在您主动与 Bot 互动时）

---

## 第三章 信息使用目的

我们使用收集到的信息仅用于以下明确目的。我们承诺不将您的个人信息用于本政策未列明的其他目的。

### 3.1 提供和改进服务

- **账户管理**：创建和维护您的账户，验证您的身份，处理登录和权限管理
- **功能实现**：提供量化交易、AI 分析、策略回测、绩效统计等核心功能
- **个性化体验**：根据您的使用习惯和偏好设置，为您呈现个性化的界面和内容
- **产品优化**：分析平台整体使用数据（去标识化后），改善用户体验和功能设计

### 3.2 安全与合规

- **账户安全**：检测可疑登录、防范账户被盗及未授权访问
- **反欺诈**：识别和阻止欺诈性交易或洗钱行为
- **风险控制**：监测异常交易行为，执行止损、强平等风控措施
- **法律合规**：满足适用的反洗钱（AML）、了解你的客户（KYC）及其他金融监管要求
- **审计留存**：保存交易记录以满足财务审计及监管查询需求

### 3.3 通信与通知

- **服务通知**：向您发送账户活动通知（登录确认、提现成功、系统维护等）
- **交易提醒**：推送 AI 信号、仓位变动、止损触发等实时通知
- **安全警报**：在检测到可疑活动时立即通知您
- **产品更新**：告知您平台新功能、版本更新及政策变更（仅在您未退订的情况下）
- **客户支持**：回复您的问题、反馈和投诉

### 3.4 分析与研究

- **平台分析**：统计活跃用户数、功能使用率、留存率等平台运营指标
- **策略研究**：对匿名化、聚合化的交易数据进行统计分析，用于改进 AI 策略模型
- **风险研究**：分析市场风险事件，改进风控模型

### 3.5 AI 服务提供

- **AI 辅助分析**：将市场数据和技术指标提交给 AI 模型，生成交易分析和建议
- **多智能体辩论**：在多个 AI 角色之间执行结构化辩论，形成多方视角的综合分析
- **自动网格执行**：根据 AI 分析结果，在您授权范围内自动执行网格交易操作
- **Prompt 工程优化**：使用去标识化、聚合化的交互数据（不含个人可识别信息），持续改进 AI 提示词模板
- **预算监控**：追踪您的 LLM API 调用费用，在接近预算上限时发出预警

### 3.6 代币经济管理

- **空投与奖励**：根据您的持仓量、质押量及平台活跃度，计算并发放 HOOT 代币奖励
- **佣金结算**：计算代理商推荐佣金，按周期执行自动结算
- **会员权益管理**：根据您的套餐类型，解锁或限制相应功能访问权限
- **质押管理**：记录和管理您的 HOOT 代币质押状态、锁定期及解锁时间

---

## 第四章 信息存储与安全

### 4.1 存储位置

您的个人数据主要存储于以下地区：

- **新加坡**：主数据库、业务应用服务器
- **香港**：灾备数据库、部分缓存服务

我们选择上述地区的原因：法律体系完善、数据保护标准高、网络连接质量优秀，且距离亚太地区主要用户群最近。

### 4.2 安全措施

**技术安全措施**

| 措施类别 | 具体实现 |
|---------|---------|
| 传输加密 | TLS 1.3 全程加密所有网络通信 |
| 静态加密 | AES-256-GCM 加密存储所有密钥类敏感数据 |
| 密码存储 | bcrypt（工作因子 ≥ 12）单向哈希，不可逆还原 |
| 数据库加密 | 数据库磁盘层面启用透明数据加密（TDE） |
| 访问控制 | 基于角色的最小权限访问控制（RBAC） |
| 网络隔离 | 数据库层网络隔离，不直接对外暴露 |
| DDoS 防护 | CDN 层及应用层 DDoS 防护 |
| WAF 防护 | Web 应用防火墙过滤恶意请求 |

**AI 数据特定安全措施**

- AI 推理过程中的用户数据在内存中处理，不额外持久化原始 Prompt 内容
- LLM API 密钥仅在加密状态下存储，解密操作仅在内存中完成，解密后的明文密钥不写入任何日志
- AI 辩论记录和研究会话数据按 2.3 所述与账户关联存储，但在统计分析时进行去标识化处理

**DEX 钱包特定安全措施**

- 委托管理的私钥经 AES-256-GCM 加密后存储，加密主密钥通过硬件安全模块（HSM）或等效的密钥管理服务（KMS）管理
- 私钥的解密操作仅在执行 DEX 交易的受信任执行环境（TEE）中进行
- 私钥不以任何形式出现在日志、调试输出或错误报告中
- 您可以随时撤销平台对您私钥的访问权限（详见第七章）

**认证与访问保护**

- 支持双因素认证（2FA），强烈建议启用
- 登录失败次数超限后自动锁定账户
- 异常登录（新设备、新地区）触发二次验证
- 活跃会话管理，支持远程注销所有设备

**管理措施**

- 员工访问生产数据须通过身份验证和操作审计
- 定期安全培训和意识教育
- 数据访问需求遵循最小必要原则审批
- 与第三方服务商签订数据处理协议（DPA）

### 4.3 数据保留期限

我们仅在实现收集目的所必需的期限内保留您的个人数据。具体保留期限如下：

| 数据类型 | 保留期限 | 说明 |
|---------|---------|------|
| 账户基本信息 | 账户存续期间 + 注销后 30 天 | 30 天缓冲期用于处理注销争议 |
| 交易记录 / 财务记录 | 7 年 | 符合财务审计及监管要求 |
| 登录日志 | 1 年 | 用于安全审计及异常追溯 |
| 系统日志 / API 调用日志 | 90 天 | 用于故障排查，定期轮转 |
| 客服沟通记录 | 3 年 | 用于纠纷处理及服务改进 |
| AI 分析结果 | 1 年 | 用于策略绩效评估 |
| AI 辩论记录 / 研究会话 | 1 年 | 用于模型改进参考 |
| LLM 使用日志 | 90 天 | 用于费用核对及预算管理 |
| 网格运行时数据 | 策略存续期间 + 90 天 | 90 天用于策略结束后的清算核对 |
| 策略历史绩效 | 3 年 | 用于长期绩效回溯分析 |
| Telegram 交互记录 | 1 年 | 用于 Bot 功能改进 |
| 空投 / 代币归属记录 | 7 年 | 符合代币经济审计要求 |
| 推荐佣金记录 | 7 年 | 符合财务审计及代理商结算要求 |
| DEX 交易记录 | 7 年 | 符合链上交易审计要求 |
| 已使用邀请码记录 | 30 天（失效后） | 防止重复使用，之后匿名化处理 |

超过保留期限的数据将被安全删除或不可逆地匿名化处理。

---

## 第五章 信息共享与披露

### 5.1 我们不出售您的个人信息

我们明确承诺：**不会将您的个人数据出售给任何第三方以换取商业利益。**

### 5.2 可能共享信息的情况

在以下特定情况下，我们可能与受限的第三方共享您的信息：

**（一）服务提供商**

我们委托以下类别的第三方服务提供商协助运营平台，这些提供商仅能在我们明确授权的范围内访问您的信息，且须遵守数据保密义务：

- 云基础设施提供商（服务器托管、数据库、对象存储）
- 安全服务提供商（DDoS 防护、WAF、漏洞扫描）
- 分析服务提供商（仅访问匿名化数据）
- 客户支持工具提供商

**（二）LLM 服务提供商（人工智能模型）**

当您使用 AI 分析功能时，我们将向您选择的 LLM 服务提供商（DeepSeek、OpenAI、Anthropic、Google、阿里云、xAI、Moonshot）发送必要的请求数据。

- **我们会发送的内容**：经过处理的市场数据（技术指标数值）、AI 分析请求文本、历史辩论上下文摘要
- **我们不会发送的内容**：您的姓名、邮箱、手机号、账户密码、交易所 API Key、DEX 私钥、钱包地址等直接可识别个人身份的信息
- **重要说明**：我们无法控制上述 LLM 提供商对收到数据的处理方式。各提供商的隐私政策和数据处理实践由其各自负责，我们建议您在选择使用特定 LLM 服务前，自行阅读相关提供商的隐私政策。

**（三）去中心化交易所（DEX）**

当您通过 Hoot 平台在 Lighter、Aster 等 DEX 执行交易时，相关交易信息将作为区块链交易数据**公开记录于区块链账本上**。区块链的技术特性决定了此类信息不可撤销、任何人均可查询。请在授权 DEX 交易前充分了解此特性。

**（四）Telegram 消息路由**

您通过 Telegram Bot 发送的消息将经由 Telegram 的服务器路由传输。Telegram 自有其独立的隐私政策，我们无法控制 Telegram 对其平台数据的处理方式。

**（五）法律要求**

在以下情况下，我们可能依法披露您的信息：
- 收到具有法律效力的法院命令、传票或监管机构的调查要求
- 为了防止欺诈、身份盗窃或其他非法活动
- 为了保护 Hoot、其他用户或公众的合法权益

在任何情况下，我们将仅披露法律要求范围内的最小必要信息，并在法律允许的情况下及时通知受影响的用户。

**（六）业务转让**

如 Hoot 发生合并、收购、资产出售或其他类似交易，您的个人数据可能作为交易资产的一部分被转让给新的经营主体。在此情况下，我们将提前通知您，并确保新经营主体承担与本政策同等级别的数据保护义务。

### 5.3 匿名化数据

在上述情况之外，我们可能将经充分匿名化处理、无法识别个人身份的聚合数据用于以下目的：
- 发布行业研究报告或平台运营数据
- 提升 AI 模型质量（仅使用聚合统计指标，不含个人轨迹数据）
- 与学术机构合作进行量化金融研究

---

## 第六章 Cookie 和追踪技术

### 6.1 我们使用的技术

**（一）Cookie**

我们在网页端使用 Cookie（小型文本文件存储于您的浏览器）实现以下功能：

| Cookie 类型 | 用途 | 是否必要 |
|------------|------|---------|
| 会话 Cookie | 维持您的登录状态 | 必要 |
| 安全 Cookie | 防范跨站请求伪造（CSRF） | 必要 |
| 偏好 Cookie | 记住您的语言、主题等界面偏好 | 功能性 |
| 分析 Cookie | 收集匿名的页面访问统计数据 | 可选 |

**（二）本地存储（LocalStorage / SessionStorage）**

我们使用浏览器本地存储保存非敏感的用户界面状态（如折叠/展开状态、列表排序偏好等）。我们不会在本地存储中保存您的账户密码、API Key 或任何敏感凭证。

**（三）Web Beacon / 像素点**

我们可能在平台内使用小型图像追踪器（Web Beacon）统计邮件打开率，仅收集匿名的统计数据。

### 6.2 管理 Cookie

您可以通过以下方式管理 Cookie：

- **浏览器设置**：在浏览器的隐私设置中管理或删除 Cookie（注意：禁用必要 Cookie 可能导致平台核心功能无法正常使用）
- **平台设置**：在账户设置页面中，您可以选择关闭非必要的分析 Cookie
- **清除数据**：在浏览器中清除 Cookie 将注销您的当前会话

---

## 第七章 您的权利

根据适用的数据保护法规，您对自己的个人数据享有以下权利。我们承诺在法律允许的范围内最大程度尊重并支持您行使这些权利。

### 7.1 访问权

您有权要求获取我们持有的关于您的个人数据副本，包括数据类别、处理目的及保留期限等信息。

### 7.2 更正权

如您发现我们持有的关于您的个人数据不准确或不完整，您有权要求我们进行更正。大部分账户基本信息可直接在"账户设置"页面自行修改。

### 7.3 删除权（被遗忘权）

在以下情况下，您可以要求我们删除您的个人数据：
- 数据已不再用于收集时的目的
- 您撤回了之前给予的同意，且我们没有其他合法依据继续处理
- 我们对数据的处理不合法

**注意**：对于依法须强制保留的数据（如交易记录、财务审计数据），我们将在法定保留期结束后执行删除，并在此之前限制对该数据的进一步处理。

### 7.4 限制处理权

在以下情况下，您可以要求我们暂停对您数据的主动处理：
- 您对数据的准确性提出异议，等待我们核实期间
- 我们对数据的处理是非法的，但您希望限制而非删除
- 我们不再需要该数据，但您因法律诉求需要保留

### 7.5 数据可携带权

您有权以结构化、通用机器可读格式（如 JSON 或 CSV）获取您提供给我们的个人数据，并可要求我们将其传输给其他服务提供商（在技术可行的情况下）。

### 7.6 反对权

您有权反对我们基于合法利益目的（而非合同或法律义务目的）处理您的个人数据。在您提出反对后，我们将停止该处理，除非我们能够证明存在压倒性的合法理由。

### 7.7 如何行使权利

请通过以下方式提交您的权利行使申请：
- **邮件**：privacy@hoot.trade
- **Telegram**：@hoot_support

我们将在收到申请后 **30 个自然日内** 做出回应。在某些复杂情况下，我们可能需要延长至最长 90 天，届时我们将提前通知您。

为保护您的账户安全，我们在处理权利行使申请前可能需要核实您的身份。

### 7.8 AI 特定权利

鉴于本平台使用人工智能技术处理您的数据，我们额外提供以下 AI 相关权利：

**AI 解释权**：您有权要求我们用通俗语言解释 AI 系统如何分析您的交易行为、生成交易建议，以及哪些因素影响了 AI 的分析结论。

**AI 退出权**：您有权选择不使用 AI 辅助分析功能。选择退出后，您仍可使用平台的手动交易功能，但 AI 信号生成、多智能体辩论及 AI 自动执行等功能将停用。

**AI 数据删除权**：您有权要求删除您的 AI 分析历史记录，包括辩论记录、研究会话及 AI 交互日志（在法定保留要求允许的范围内）。

**LLM 密钥撤销权**：您可以随时在账户设置中撤销或更换您提供的 LLM API 密钥。撤销后，平台将立即停止使用该密钥调用 AI 服务，且已加密存储的密钥将被安全删除。

### 7.9 DEX 特定权利

**私钥导出权**：若您曾委托平台管理 DEX 钱包私钥，您有权申请将加密的私钥以安全方式导出，以便迁移至其他钱包管理工具。

**钱包断开权**：您可以随时在账户设置中断开 DEX 钱包与平台的连接。断开后，平台将不再持有对该钱包私钥的访问权限，已存储的私钥将被安全删除。

---

## 第八章 未成年人保护

本平台的服务不面向 **18 岁以下的未成年人**。我们不会故意收集未成年人的个人信息。

如果您是未成年人的父母或监护人，并发现您的孩子向我们提供了个人信息，请立即通过 privacy@hoot.trade 与我们联系，我们将采取措施及时删除相关信息。

如我们发现用户为未成年人，我们有权立即暂停或终止其账户。

---

## 第九章 跨境数据传输

您的个人数据可能被传输至并存储于您所在国家/地区以外的服务器。

**主要数据流向**

| 数据类型 | 传输目的地 | 原因 |
|---------|---------|------|
| 账户及交易数据 | 新加坡、香港 | 主服务器位置 |
| AI 分析请求 | 美国（OpenAI、Anthropic、xAI） | LLM 服务提供商所在地 |
| AI 分析请求 | 中国大陆（DeepSeek、阿里云、Moonshot） | LLM 服务提供商所在地 |
| 区块链交易数据 | 全球分布式节点 | 区块链网络的去中心化特性 |
| Telegram 消息 | 美国、阿联酋（Telegram 数据中心） | Telegram 消息路由 |

在进行跨境数据传输时，我们依赖以下合规机制：
- 与数据接收方签署数据处理协议（DPA）
- 向具有充分数据保护水平的国家/地区传输
- 在用户知情同意的基础上传输

---

## 第十章 第三方链接与服务

本平台可能包含指向第三方网站或服务的链接，包括但不限于：
- 交易所官方网站（Binance、OKX、Bybit 等）
- LLM 服务提供商官方网站（OpenAI、Anthropic 等）
- 去中心化交易所（Lighter、Aster 等）
- Telegram 社区及频道
- 区块链浏览器（Etherscan 等）

**请注意**：点击这些链接后，您将进入第三方的平台环境。这些第三方有其独立的隐私政策，我们对第三方的数据处理行为不承担责任。我们建议您在使用任何第三方服务前，阅读该服务的隐私政策。

---

## 第十一章 AI 特定数据处理

作为一个深度集成人工智能技术的金融平台，我们认为有必要对 AI 相关的数据处理实践进行单独、透明的披露。

### 11.1 AI 处理的数据类别

本平台的 AI 系统主要处理以下类别的数据：

**市场数据**（非个人数据）：K 线数据（开高低收/成交量）、技术指标（RSI/MACD/BB/ATR/OBV）、市场深度数据、资金费率

**用户配置数据**（个人数据）：您设定的风险参数、仓位限制、偏好交易对、AI 模型选择

**交互数据**（个人数据）：AI 研究请求内容、AI 返回的分析结果、您对 AI 建议的接受/拒绝操作

**绩效数据**（个人数据）：AI 辅助交易的历史绩效、AI 预测准确率统计

### 11.2 人类监督机制

我们的 AI 系统设计遵循"人在回路"（Human-in-the-Loop）原则：

- **建议模式**：AI 生成分析和建议，最终交易决策由您确认
- **自动执行模式**：仅在您明确授权并设置参数边界后，AI 方可在边界内自动执行
- **紧急停止**：您可随时通过平台界面或 Telegram Bot 暂停所有 AI 自动执行
- **参数护栏**：AI 自动执行受到最大仓位比例、单笔止损比例、日亏损限额等硬性约束

### 11.3 AI 数据最小化

我们遵循数据最小化原则：

- 发送给 AI 模型的请求中不包含您的个人识别信息（姓名、邮箱、联系方式等）
- 市场数据请求以交易对符号（如 BTC/USDT）而非用户 ID 标识
- 必要时使用假名化技术替换用户标识符

### 11.4 AI 输出准确性说明

**重要风险披露**：AI 生成的交易分析和建议仅供参考，不构成投资建议。AI 模型存在以下固有局限性：

- 可能基于历史数据产生过拟合偏差
- 对突发事件（黑天鹅）的预测能力有限
- AI 输出存在"幻觉"（生成不准确信息）的可能性
- 市场条件变化可能导致历史训练数据失效

您应自行承担基于 AI 建议做出的投资决策的风险。

### 11.5 自动决策披露

在自动执行模式下，AI 系统可能在无需您实时确认的情况下执行以下操作：
- 开设或平仓网格仓位
- 调整网格参数（在您预设范围内）
- 触发止损操作

以上每一项自动操作均会被完整记录并展示在您的交易历史中。您可在事后查阅每笔自动操作的触发原因和 AI 分析依据。

---

## 第十二章 政策更新

我们可能不时更新本隐私政策以反映以下变化：
- 我们的业务实践或服务内容的变化
- 适用法律法规的变化
- 来自用户或监管机构的反馈

**重大变更通知方式**（满足以下任一方式）：
- 在平台首页或显著位置发布公告
- 向您的注册邮箱发送通知邮件
- 在您下次登录时通过应用内弹窗通知

**生效时间**：我们将在发布更新后的政策时注明新的生效日期。重大变更将在通知发出后 **30 天**生效，以给予您充分时间阅读和理解。

如您在新政策生效后继续使用本平台，即视为您接受更新后的政策内容。如您不同意更新内容，请在生效日期前停止使用本平台并联系我们注销账户。

---

## 第十三章 联系我们

如您对本隐私政策有任何疑问、意见或权利行使申请，请通过以下方式联系我们：

**数据保护联系邮箱**：privacy@hoot.trade

**客户支持**：@hoot_support（Telegram）

**响应时间承诺**：我们将在收到您的信息后 **5 个工作日**内确认收到，并在 **30 个自然日**内给出实质性回复。

如您认为我们对您个人数据的处理违反了适用的数据保护法律，您有权向您所在地区的数据保护监管机构提出投诉。

---

*© 2024-2026 Hoot. All rights reserved.*

*本文件为 Hoot 平台隐私政策正式文本。本政策的中文版本与英文版本具有同等法律效力。如两个语言版本之间存在任何差异，以中文版本为准（适用于中文用户）。*
`,
  contentEn: `
# Privacy Policy

**Version: 2.0.0**
**Effective Date: March 15, 2026**
**Last Updated: March 1, 2026**

---

## Chapter 1: Introduction

Welcome to the Hoot Platform (hereinafter referred to as "the Platform," "we," "us," or "Hoot").

Hoot is an AI-powered quantitative trading and asset management platform serving users worldwide. We recognize that your personal information is of utmost importance to you, and we regard protecting your privacy and personal data security as one of our highest priorities.

This Privacy Policy (hereinafter referred to as "this Policy") is intended to explain: what information we collect, how we use it, how we store and protect it, and what rights you have over your own data. This Policy is informed by and consistent with the fundamental principles of the following international standards and regulations:

- **EU Artificial Intelligence Act (EU AI Act)**: Transparency, accountability, and human oversight requirements for high-risk AI systems
- **Markets in Crypto-Assets Regulation (MiCA)**: Data handling standards for crypto-asset service providers
- **Singapore Personal Data Protection Act (PDPA)**: Rules governing the collection, use, and disclosure of personal data
- **General Data Protection Regulation (GDPR) Principles**: Data minimization, purpose limitation, and reasonable storage periods

**Important Notice**: Before using any services provided by the Hoot Platform (including but not limited to the website, mobile application, Telegram bot, API interfaces, and AI trading features), please read this Policy in its entirety. **By using or continuing to use the Platform's services, you acknowledge that you have read, understood, and agreed to all terms of this Policy.** If you do not agree to this Policy, please immediately cease using all services of the Platform.

If you have any questions about this Policy, please contact us through the contact information provided in Chapter 13.

---

## Chapter 2: Information We Collect

The information we collect comes from three categories of sources: information you actively provide, information automatically collected by the Platform, and information from third parties.

### 2.1 Information You Actively Provide

When you register an account, use Platform features, or communicate with us, you may actively provide us with the following information:

**Basic Account Information**
- Email address (for account registration and login identity verification)
- Username or nickname (for display within the Platform)
- Account password (stored as a one-way bcrypt hash — we cannot recover your plaintext password)
- Mobile phone number (for two-factor authentication and security notifications, optional)

**Identity Verification Information**
- Blockchain wallet addresses (for crypto asset deposits/withdrawals, on-chain identity verification, and DEX interactions)
- Telegram account ID and username (for Telegram Bot login, signal push notifications, and community interaction)

**Payment and Transaction Information**
- Deposit records (amount, timestamp, on-chain transaction hash)
- Withdrawal records (amount, timestamp, destination address, on-chain transaction hash)
- Subscription records (plan type, validity period, payment method)
- Trading history (trading pair, direction, quantity, price, execution time)

**Exchange API Information**
- Exchange API Key and API Secret (used to execute trades on Binance, OKX, Bybit, and other exchanges on your behalf)
- These credentials are encrypted using **AES-256-GCM** before storage; encryption keys are held only in server memory and are never written in plaintext to any database or log

**LLM API Keys**
- Large Language Model (LLM) API keys you provide for: DeepSeek, OpenAI, Anthropic, Google, Alibaba Cloud (Bailian), xAI (Grok), Moonshot
- These keys are also encrypted using **AES-256-GCM** before storage, used solely to call the corresponding AI services on your behalf, and for no other purpose

**AI Configuration Preferences**
- Selected AI model names and versions
- Model temperature and other inference parameters
- Monthly LLM cost budget ceiling settings
- AI trading risk control parameters (maximum position size, stop-loss thresholds, maximum drawdown tolerance, etc.)

**DEX Wallet Information**
- Blockchain wallet addresses for use on decentralized exchanges (DEX) such as Lighter and Aster
- Private keys you authorize the Platform to manage (stored encrypted using AES-256-GCM, used solely to execute DEX trading operations you have authorized)

**Membership Information**
- Current plan type (Basic, Professional, Institutional, etc.)
- Subscription start and expiration dates
- Historical subscription and renewal records

**Referral and Agent Information**
- Invitation codes you use or distribute
- Agent tier and promotion history
- List of invited users and their activity status
- Commission disbursement history and withdrawal records

**Communication Information**
- Your communications with our customer support team
- Feedback, suggestions, or complaints you submit
- Your responses to surveys

### 2.2 Information Automatically Collected

When you use the Platform, our systems automatically collect the following information:

**Device Information**
- Device type (PC, smartphone, tablet) and model
- Operating system name and version
- Browser type and version
- Screen resolution and color depth
- Device unique identifier (Device ID, for multi-device login management)

**Network Information**
- IP address (for security detection, abnormal login identification, and geographic location inference)
- Internet Service Provider (ISP)
- Approximate geographic location (country/region level; city level for risk control purposes)

**Usage Behavior Information**
- Login times, login frequency, and session duration
- Feature usage patterns (which features are used and how frequently)
- Page browsing paths and time spent on each page
- Click behavior and interaction sequences
- Search keywords (when searching for strategies or trading pairs within the Platform)

**System Log Information**
- System error logs (including error codes, error messages, and timestamps)
- API call logs (endpoint name, call time, response status code, request ID)
- Security event logs (login failures, abnormal access attempts, permission denials, etc.)

**AI Analysis Data**
- Technical indicator values used for AI-assisted analysis: RSI, MACD, Bollinger Bands (BB), ATR, OBV, and others
- AI analysis confidence scores and confidence intervals
- Multi-agent debate process records (arguments, rebuttals, and conclusions from each AI role)
- AI Chain-of-Thought reasoning content
- Multi-agent consensus results and voting records
- Inputs and outputs from AI Research Sessions

**Grid Trading Data**
- Grid strategy runtime state (price of each grid level, position status, pending order status)
- Market regime classification (trending market, ranging market, breakout signal, etc.)
- Real-time floating profit/loss and realized profit/loss
- Price breakout detection event records
- Daily profit/loss snapshots (Daily PnL Snapshots)

**LLM Usage Statistics**
- Token consumption per AI call (input tokens / output tokens)
- Estimated cost per AI call
- API call latency (response time)
- Model selection history
- Monthly budget utilization and alert trigger records

**Telegram Bot Data**
- Telegram user ID and username (obtained from the Telegram API)
- Bot command usage history (e.g., /start, /balance, /checkin)
- Check-in timestamps and consecutive check-in streak
- Interaction frequency and message types with the Bot

**Strategy Performance Data**
- Historical win rate
- Sharpe Ratio
- Maximum Drawdown and drawdown duration
- Complete trade history (including entry/exit signal sources)

### 2.3 Information from Third Parties

We may also obtain information related to your account from the following third-party sources:

- **Exchange APIs**: Using the API Key you provide, we obtain your account balance, current positions, and historical trade data from Binance, OKX, Bybit, and other exchanges
- **Blockchain Networks**: We read on-chain transaction records related to your wallet addresses from public blockchain ledgers (this information is publicly accessible and queryable by anyone)
- **AI Model Service Providers**: AI model responses to requests you submit (we display these to you and record them for performance analysis)
- **Decentralized Exchanges (DEX)**: Confirmation status of on-chain transactions executed on your behalf on Lighter, Aster, and other DEX platforms
- **Telegram API**: Interaction data from your use of the Telegram Bot (when you actively interact with the Bot)

---

## Chapter 3: How We Use Your Information

We use the information we collect solely for the following clearly defined purposes. We commit not to use your personal information for any purpose not described in this Policy.

### 3.1 Providing and Improving Services

- **Account Management**: Creating and maintaining your account, verifying your identity, and managing login and access permissions
- **Feature Delivery**: Providing core functionality including quantitative trading, AI analysis, strategy backtesting, and performance statistics
- **Personalized Experience**: Presenting a personalized interface and content based on your usage habits and preference settings
- **Product Optimization**: Analyzing overall platform usage data (after de-identification) to improve user experience and feature design

### 3.2 Security and Compliance

- **Account Security**: Detecting suspicious logins and preventing account compromise and unauthorized access
- **Anti-Fraud**: Identifying and blocking fraudulent transactions or money laundering activities
- **Risk Control**: Monitoring abnormal trading behavior and enforcing risk control measures such as stop-losses and forced liquidation
- **Legal Compliance**: Meeting applicable anti-money laundering (AML), know-your-customer (KYC), and other financial regulatory requirements
- **Audit Records**: Retaining transaction records to satisfy financial audit and regulatory inquiry requirements

### 3.3 Communication and Notifications

- **Service Notifications**: Sending account activity notifications (login confirmations, successful withdrawals, system maintenance announcements, etc.)
- **Trading Alerts**: Pushing real-time notifications for AI signals, position changes, stop-loss triggers, and similar events
- **Security Alerts**: Immediately notifying you when suspicious activity is detected
- **Product Updates**: Informing you of new Platform features, version updates, and policy changes (only where you have not unsubscribed)
- **Customer Support**: Responding to your questions, feedback, and complaints

### 3.4 Analytics and Research

- **Platform Analytics**: Tracking active user counts, feature utilization rates, retention rates, and other platform operational metrics
- **Strategy Research**: Performing statistical analysis on anonymized, aggregated trading data to improve AI strategy models
- **Risk Research**: Analyzing market risk events to improve risk management models

### 3.5 AI Service Delivery

- **AI-Assisted Analysis**: Submitting market data and technical indicators to AI models to generate trading analysis and recommendations
- **Multi-Agent Debate**: Conducting structured debates among multiple AI roles to produce comprehensive multi-perspective analysis
- **Automated Grid Execution**: Automatically executing grid trading operations within your authorized parameters based on AI analysis results
- **Prompt Engineering Optimization**: Using de-identified, aggregated interaction data (containing no personally identifiable information) to continuously improve AI prompt templates
- **Budget Monitoring**: Tracking your LLM API call costs and issuing warnings when you approach your budget ceiling

### 3.6 Token Economy Management

- **Airdrops and Rewards**: Calculating and distributing HOOT token rewards based on your holdings, staking amounts, and Platform activity
- **Commission Settlement**: Calculating agent referral commissions and executing automatic settlement on a periodic basis
- **Membership Benefits Management**: Unlocking or restricting access to features based on your plan type
- **Staking Management**: Recording and managing your HOOT token staking status, lock-up periods, and unlock schedules

---

## Chapter 4: Information Storage and Security

### 4.1 Storage Locations

Your personal data is primarily stored in the following regions:

- **Singapore**: Primary database, business application servers
- **Hong Kong**: Disaster recovery database, certain caching services

We selected these regions because of their robust legal systems, high data protection standards, excellent network connectivity, and proximity to our primary user base in the Asia-Pacific region.

### 4.2 Security Measures

**Technical Security Measures**

| Category | Implementation |
|---------|---------------|
| Transit Encryption | TLS 1.3 encrypts all network communications end-to-end |
| Encryption at Rest | AES-256-GCM encrypts all sensitive data including keys |
| Password Storage | bcrypt (work factor ≥ 12) one-way hash — irreversible |
| Database Encryption | Transparent Data Encryption (TDE) at the disk level |
| Access Control | Role-Based Access Control (RBAC) with least-privilege principle |
| Network Isolation | Database tier network-isolated, not directly exposed to the internet |
| DDoS Protection | DDoS protection at CDN and application layers |
| WAF Protection | Web Application Firewall filtering malicious requests |

**AI Data-Specific Security Measures**

- User data processed during AI inference is handled in memory and not additionally persisted as raw Prompt content
- LLM API keys are only stored in encrypted form; decryption occurs only in memory, and decrypted plaintext keys are never written to any log
- AI debate records and research session data are stored associated with accounts as described in Section 2.3, but are de-identified during statistical analysis

**DEX Wallet-Specific Security Measures**

- Custodied private keys are stored encrypted using AES-256-GCM; the master encryption key is managed via a Hardware Security Module (HSM) or equivalent Key Management Service (KMS)
- Private key decryption occurs only within a trusted execution environment (TEE) when executing DEX transactions
- Private keys never appear in any form in logs, debug output, or error reports
- You may revoke the Platform's access to your private keys at any time (see Chapter 7)

**Authentication and Access Protection**

- Two-factor authentication (2FA) is supported and strongly encouraged
- Accounts are automatically locked after excessive failed login attempts
- Suspicious logins (from new devices or new geographic regions) trigger secondary verification
- Active session management, with the ability to remotely sign out all devices

**Administrative Measures**

- Employee access to production data requires authentication and operation auditing
- Regular security training and awareness education
- Data access requests are subject to least-necessity principle approval
- Data Processing Agreements (DPAs) are signed with third-party service providers

### 4.3 Data Retention Periods

We retain your personal data only for as long as necessary to fulfill the purposes for which it was collected. Specific retention periods are as follows:

| Data Type | Retention Period | Notes |
|---------|----------------|-------|
| Basic Account Information | Duration of account + 30 days after closure | 30-day buffer for closure dispute handling |
| Transaction / Financial Records | 7 years | Satisfies financial audit and regulatory requirements |
| Login Logs | 1 year | For security audit and anomaly tracing |
| System Logs / API Call Logs | 90 days | For troubleshooting; periodically rotated |
| Customer Support Communications | 3 years | For dispute resolution and service improvement |
| AI Analysis Results | 1 year | For strategy performance evaluation |
| AI Debate Records / Research Sessions | 1 year | For model improvement reference |
| LLM Usage Logs | 90 days | For cost verification and budget management |
| Grid Strategy Runtime Data | Duration of strategy + 90 days | 90 days for post-strategy settlement reconciliation |
| Historical Strategy Performance | 3 years | For long-term performance retrospective analysis |
| Telegram Interaction Records | 1 year | For Bot feature improvement |
| Airdrop / Token Vesting Records | 7 years | Satisfies token economy audit requirements |
| Referral Commission Records | 7 years | Satisfies financial audit and agent settlement requirements |
| DEX Transaction Records | 7 years | Satisfies on-chain transaction audit requirements |
| Used Invitation Code Records | 30 days (after expiration) | Prevents reuse; anonymized thereafter |

Data exceeding retention periods will be securely deleted or irreversibly anonymized.

---

## Chapter 5: Information Sharing and Disclosure

### 5.1 We Do Not Sell Your Personal Information

We make an unambiguous commitment: **we will not sell your personal data to any third party for commercial gain.**

### 5.2 Circumstances Under Which We May Share Information

Under the following specific circumstances, we may share your information with a limited set of third parties:

**(I) Service Providers**

We engage the following categories of third-party service providers to assist in operating the Platform. These providers may only access your information within the scope we explicitly authorize and are subject to confidentiality obligations:

- Cloud infrastructure providers (server hosting, database, object storage)
- Security service providers (DDoS protection, WAF, vulnerability scanning)
- Analytics service providers (access only anonymized data)
- Customer support tooling providers

**(II) LLM Service Providers (Artificial Intelligence Models)**

When you use AI analysis features, we send necessary request data to the LLM service provider you select (DeepSeek, OpenAI, Anthropic, Google, Alibaba Cloud, xAI, Moonshot).

- **What we send**: Processed market data (technical indicator values), AI analysis request text, historical debate context summaries
- **What we do not send**: Your name, email, phone number, account password, exchange API Key, DEX private key, wallet address, or other directly personally identifiable information
- **Important Notice**: We cannot control how the above LLM providers process the data they receive. Each provider's privacy policies and data handling practices are their own responsibility. We recommend that you review the privacy policy of any LLM service you choose to use before enabling it.

**(III) Decentralized Exchanges (DEX)**

When you execute trades on Lighter, Aster, or other DEX platforms through the Hoot Platform, related transaction information is **publicly recorded on the blockchain ledger** as on-chain transaction data. The technical nature of blockchain means this information is irrevocable and queryable by anyone. Please ensure you understand this characteristic before authorizing DEX transactions.

**(IV) Telegram Message Routing**

Messages you send through the Telegram Bot are routed through Telegram's servers. Telegram has its own independent privacy policy, and we cannot control how Telegram handles data on its platform.

**(V) Legal Requirements**

Under the following circumstances, we may be required by law to disclose your information:
- Upon receipt of legally effective court orders, subpoenas, or regulatory investigation requests
- To prevent fraud, identity theft, or other illegal activities
- To protect the legitimate interests of Hoot, other users, or the general public

In all circumstances, we will disclose only the minimum information required by law and will notify affected users as promptly as legally permitted.

**(VI) Business Transfers**

In the event of a merger, acquisition, asset sale, or similar transaction involving Hoot, your personal data may be transferred to the new operating entity as part of the transaction assets. In such cases, we will notify you in advance and ensure the new operating entity assumes data protection obligations equivalent to those in this Policy.

### 5.3 Anonymized Data

Beyond the circumstances described above, we may use sufficiently anonymized, aggregated data that cannot identify individuals for the following purposes:
- Publishing industry research reports or platform operational statistics
- Improving AI model quality (using only aggregated statistical metrics, not individual user trajectory data)
- Collaborative quantitative finance research with academic institutions

---

## Chapter 6: Cookies and Tracking Technologies

### 6.1 Technologies We Use

**(I) Cookies**

We use cookies (small text files stored in your browser) on the web interface to provide the following functions:

| Cookie Type | Purpose | Necessity |
|------------|---------|-----------|
| Session Cookies | Maintaining your logged-in state | Required |
| Security Cookies | Preventing Cross-Site Request Forgery (CSRF) | Required |
| Preference Cookies | Remembering your language, theme, and other interface preferences | Functional |
| Analytics Cookies | Collecting anonymous page visit statistics | Optional |

**(II) Local Storage (LocalStorage / SessionStorage)**

We use browser local storage to save non-sensitive user interface state (such as collapsed/expanded states, list sort preferences, etc.). We do not store your account password, API Key, or any sensitive credentials in local storage.

**(III) Web Beacons / Pixel Tags**

We may use small image trackers (web beacons) within the Platform to measure email open rates, collecting only anonymous statistical data.

### 6.2 Managing Cookies

You may manage cookies through the following methods:

- **Browser Settings**: Manage or delete cookies in your browser's privacy settings (note: disabling required cookies may prevent core Platform features from functioning properly)
- **Platform Settings**: In the account settings page, you may opt out of non-essential analytics cookies
- **Clearing Data**: Clearing cookies in your browser will sign you out of your current session

---

## Chapter 7: Your Rights

Under applicable data protection regulations, you have the following rights regarding your personal data. We commit to respecting and supporting the exercise of these rights to the fullest extent permitted by law.

### 7.1 Right of Access

You have the right to request a copy of the personal data we hold about you, including the categories of data, the purposes of processing, and the retention periods.

### 7.2 Right to Rectification

If you find that personal data we hold about you is inaccurate or incomplete, you have the right to request that we correct it. Most basic account information can be directly modified in the "Account Settings" page.

### 7.3 Right to Erasure (Right to Be Forgotten)

You may request that we delete your personal data under the following circumstances:
- The data is no longer necessary for the purposes for which it was collected
- You withdraw the consent on which the processing is based, and there is no other legal basis for the processing
- Our processing of the data is unlawful

**Note**: For data that must be mandatorily retained by law (such as transaction records and financial audit data), we will execute deletion after the legally mandated retention period ends, and will restrict further active processing of that data in the interim.

### 7.4 Right to Restriction of Processing

You may request that we suspend active processing of your data under the following circumstances:
- You contest the accuracy of the data, during the period we take to verify it
- The processing is unlawful but you prefer restriction over deletion
- We no longer need the data but you require it for the establishment, exercise, or defense of legal claims

### 7.5 Right to Data Portability

You have the right to receive your personal data that you have provided to us in a structured, commonly used, machine-readable format (such as JSON or CSV), and to request that we transmit it to another service provider where technically feasible.

### 7.6 Right to Object

You have the right to object to our processing of your personal data where it is carried out on the basis of legitimate interests (rather than on the basis of a contract or legal obligation). After you raise an objection, we will cease such processing unless we can demonstrate compelling legitimate grounds that override your interests.

### 7.7 How to Exercise Your Rights

Please submit requests to exercise your rights through the following channels:
- **Email**: privacy@hoot.trade
- **Telegram**: @hoot_support

We will acknowledge receipt within **5 business days** of receiving your request and provide a substantive response within **30 calendar days**. In complex situations, we may need to extend this to a maximum of 90 days, in which case we will notify you in advance.

To protect your account security, we may need to verify your identity before processing rights exercise requests.

### 7.8 AI-Specific Rights

Given that this Platform uses artificial intelligence technology to process your data, we additionally provide the following AI-related rights:

**Right to AI Explanation**: You have the right to request that we explain in plain language how the AI system analyzes your trading behavior, generates trading recommendations, and what factors influenced the AI's analytical conclusions.

**Right to Opt Out of AI**: You have the right to choose not to use AI-assisted analysis features. After opting out, you may continue to use the Platform's manual trading features, but AI signal generation, multi-agent debates, and AI automated execution features will be disabled.

**Right to AI Data Deletion**: You have the right to request deletion of your AI analysis history, including debate records, research sessions, and AI interaction logs (to the extent permitted by mandatory retention requirements).

**Right to LLM Key Revocation**: You may revoke or replace the LLM API keys you have provided in account settings at any time. Upon revocation, the Platform will immediately cease using that key to call AI services, and the encrypted stored key will be securely deleted.

### 7.9 DEX-Specific Rights

**Right to Private Key Export**: If you have previously delegated management of a DEX wallet private key to the Platform, you have the right to request that the encrypted private key be exported to you securely, so that you may migrate it to another wallet management tool.

**Right to Wallet Disconnection**: You may disconnect a DEX wallet from the Platform in account settings at any time. After disconnection, the Platform will no longer hold access to that wallet's private key, and the stored private key will be securely deleted.

---

## Chapter 8: Protection of Minors

The services of this Platform are not directed to individuals **under the age of 18**. We do not knowingly collect personal information from minors.

If you are the parent or guardian of a minor and discover that your child has provided us with personal information, please contact us immediately at privacy@hoot.trade, and we will take steps to promptly delete the relevant information.

If we become aware that a user is a minor, we reserve the right to immediately suspend or terminate their account.

---

## Chapter 9: Cross-Border Data Transfers

Your personal data may be transferred to and stored on servers located outside your country or region of residence.

**Primary Data Flows**

| Data Type | Transfer Destination | Reason |
|---------|---------------------|--------|
| Account and Transaction Data | Singapore, Hong Kong | Primary server locations |
| AI Analysis Requests | United States (OpenAI, Anthropic, xAI) | LLM service provider locations |
| AI Analysis Requests | Mainland China (DeepSeek, Alibaba Cloud, Moonshot) | LLM service provider locations |
| Blockchain Transaction Data | Globally distributed nodes | Decentralized nature of blockchain networks |
| Telegram Messages | United States, UAE (Telegram data centers) | Telegram message routing |

When conducting cross-border data transfers, we rely on the following compliance mechanisms:
- Signing Data Processing Agreements (DPAs) with data recipients
- Transferring to countries/regions with adequate data protection levels
- Transferring on the basis of informed user consent

---

## Chapter 10: Third-Party Links and Services

The Platform may contain links to third-party websites or services, including but not limited to:
- Exchange official websites (Binance, OKX, Bybit, etc.)
- LLM service provider official websites (OpenAI, Anthropic, etc.)
- Decentralized exchanges (Lighter, Aster, etc.)
- Telegram communities and channels
- Blockchain explorers (Etherscan, etc.)

**Please note**: Following these links will take you into third-party platform environments. These third parties have their own independent privacy policies, and we are not responsible for their data handling practices. We recommend that you read the privacy policy of any third-party service before using it.

---

## Chapter 11: AI-Specific Data Processing

As a financial platform deeply integrated with artificial intelligence technology, we believe it is necessary to provide separate, transparent disclosure of our AI-related data processing practices.

### 11.1 Categories of Data Processed by AI

The Platform's AI systems primarily process the following categories of data:

**Market Data** (non-personal data): Candlestick data (OHLCV), technical indicators (RSI/MACD/BB/ATR/OBV), order book depth data, funding rates

**User Configuration Data** (personal data): Your configured risk parameters, position limits, preferred trading pairs, AI model selections

**Interaction Data** (personal data): AI research request content, AI-returned analysis results, your accept/reject actions on AI recommendations

**Performance Data** (personal data): Historical performance of AI-assisted trades, AI prediction accuracy statistics

### 11.2 Human Oversight Mechanisms

Our AI system design adheres to the "Human-in-the-Loop" principle:

- **Advisory Mode**: AI generates analysis and recommendations; the final trading decision is confirmed by you
- **Automated Execution Mode**: AI may automatically execute trades only after you explicitly authorize it and set parameter boundaries; execution is constrained within those boundaries
- **Emergency Stop**: You may pause all AI automated execution at any time through the Platform interface or the Telegram Bot
- **Parameter Guardrails**: AI automated execution is subject to hard constraints including maximum position size, per-trade stop-loss percentage, and daily loss limits

### 11.3 AI Data Minimization

We adhere to the data minimization principle:

- Requests sent to AI models do not include your personally identifying information (name, email, contact details, etc.)
- Market data requests are identified by trading pair symbols (e.g., BTC/USDT) rather than user IDs
- Pseudonymization techniques are applied to replace user identifiers where necessary

### 11.4 AI Output Accuracy Disclaimer

**Important Risk Disclosure**: AI-generated trading analysis and recommendations are for reference purposes only and do not constitute investment advice. AI models have the following inherent limitations:

- May produce overfitting bias based on historical data
- Has limited predictive capability for sudden events (black swans)
- AI outputs may contain "hallucinations" (generation of inaccurate information)
- Changes in market conditions may invalidate historical training data

You bear sole responsibility for investment decisions made based on AI recommendations.

### 11.5 Automated Decision Disclosure

In automated execution mode, the AI system may perform the following actions without your real-time confirmation:
- Opening or closing grid positions
- Adjusting grid parameters (within your preset ranges)
- Triggering stop-loss operations

Every such automated operation is fully logged and displayed in your trading history. You may review the trigger reason and AI analysis basis for each automated operation after the fact.

---

## Chapter 12: Policy Updates

We may update this Privacy Policy from time to time to reflect the following changes:
- Changes in our business practices or service offerings
- Changes in applicable laws and regulations
- Feedback from users or regulatory authorities

**Material Change Notification Methods** (satisfying at least one of the following):
- Posting an announcement on the Platform homepage or in a prominent location
- Sending a notification email to your registered email address
- Displaying an in-app pop-up notification on your next login

**Effective Date**: We will note the new effective date when publishing an updated policy. Material changes will take effect **30 days** after notice is issued, giving you adequate time to read and understand the changes.

If you continue to use the Platform after the new policy takes effect, you are deemed to have accepted the updated policy content. If you do not agree to the updates, please cease using the Platform before the effective date and contact us to close your account.

---

## Chapter 13: Contact Us

If you have any questions, comments, or rights exercise requests regarding this Privacy Policy, please contact us through the following channels:

**Data Protection Contact Email**: privacy@hoot.trade

**Customer Support**: @hoot_support (Telegram)

**Response Time Commitment**: We will confirm receipt of your message within **5 business days** and provide a substantive response within **30 calendar days**.

If you believe our processing of your personal data violates applicable data protection law, you have the right to lodge a complaint with the data protection supervisory authority in your jurisdiction.

---

*© 2024-2026 Hoot. All rights reserved.*

*This document is the official text of the Hoot Platform Privacy Policy. The Chinese and English versions of this Policy have equal legal effect. In the event of any discrepancy between the two language versions, the English version shall prevail for English-language users.*
`
}

// ============================================
// 风险提示 / Risk Disclosure
// ============================================
export const riskDisclosure: LegalDocumentContent = {
  slug: 'risk',
  titleZh: '风险提示',
  titleEn: 'Risk Disclosure',
  version: '2.0.0',
  effectiveDate: '2026-03-15',
  contentZh: `# HOOT 平台风险提示

**版本：2.0.0**
**生效日期：2026年3月15日**
**最后更新：2026年3月1日**

---

## ⚠️ 重要声明

**在使用 HOOT 平台任何服务之前，请仔细阅读以下全部内容。**

数字资产交易，尤其是结合人工智能自动化策略的数字资产交易，涉及极高风险，可能导致您损失全部投入资金。AI 交易系统并不能保证盈利——AI 模型可能产生错误分析、幻觉输出或在特定市场环境下完全失效。

佛经中的无常观提示我们：**市场结果具有内在不确定性，任何技术（包括人工智能）都无法消除这一根本不确定性。请在充分了解所有风险后，审慎决定是否使用本平台服务。**

本平台服务仅面向完全理解并能够承担相关风险的成年用户。如果您对任何风险存有疑问，请在使用前咨询专业金融或法律顾问。

---

## 第一章 市场风险

### 1.1 价格波动风险

数字资产市场以极端波动著称，价格可能在极短时间内发生剧烈变化：

- **极端波动**：数字资产价格可能在数分钟甚至数秒内下跌 50% 以上，历史上曾有资产单日跌幅超过 90%
- **闪崩风险**：市场流动性突然枯竭时，价格可能出现"闪崩"（Flash Crash），在极短时间内暴跌后迅速反弹，期间可能触发大量止损和强制平仓
- **归零风险**：部分数字资产可能因项目失败、监管打压、市场情绪崩塌等原因导致价格归零，投资人损失全部本金
- **24/7 不间断市场**：与传统金融市场不同，数字资产市场全天候运行，包括周末、节假日，风险事件可能在任何时间发生，您可能无法及时响应

### 1.2 流动性风险

市场流动性不足可能严重影响您的交易执行：

- **买卖价差扩大**：在流动性差的市场环境下，买入价与卖出价之间的差距（点差）可能大幅扩大，增加实际交易成本
- **市场深度不足**：当市场深度不足时，大额订单可能无法在期望价格全部成交，导致部分成交或完全无法成交
- **滑点风险**：实际成交价格可能与下单时的预期价格存在较大偏差，在市场剧烈波动期间尤为突出
- **无法平仓**：极端市场条件下，您可能无法在合理价格平仓，被迫承受更大损失，甚至完全无法退出持仓

### 1.3 杠杆风险

使用杠杆交易将显著放大您的盈亏，风险极高：

- **损失放大**：杠杆在放大潜在收益的同时，同等比例放大潜在损失。例如，10倍杠杆意味着价格仅需向不利方向移动 10% 即可导致本金归零
- **强制平仓（爆仓）**：当您的账户净值低于维持保证金要求时，交易所将自动强制平仓您的头寸，您可能在最不利的时机被平仓
- **穿仓风险**：在极端行情下，强制平仓后账户净值可能仍为负值（穿仓），您可能需要向交易所补缴差额
- **资金费率**：永续合约等杠杆产品通常收取资金费率，在持仓方向不利时，长期持有将持续产生额外费用，进一步侵蚀资金

---

## 第二章 策略风险

### 2.1 历史表现不代表未来

任何策略的历史表现，无论多么出色，均不构成对未来表现的保证或承诺：

- 历史回测数据通常基于已知的市场条件，存在过拟合风险
- 回测环境无法完整模拟真实交易中的滑点、手续费、流动性限制等成本
- 过去盈利的策略可能因市场环境变化而在未来持续亏损
- 平台展示的任何历史收益率均为参考信息，不构成投资建议

### 2.2 策略失效风险

量化策略存在随时失效的风险：

- **市场结构变化**：市场参与者结构、监管环境、宏观经济条件的变化可能使原本有效的策略彻底失效
- **策略拥挤**：当过多资金追逐相同的交易信号时，策略的边际收益会迅速衰减，甚至转为负收益
- **黑天鹅事件**：无法预料的极端事件（如重大监管公告、交易所破产、市场操纵、技术故障）可能导致任何策略在短时间内遭受巨大损失
- **规则变更**：交易所可能变更交易规则、手续费标准、杠杆限制等，直接影响策略表现
- **流动性变化**：某些交易对的流动性可能因市场环境变化而急剧下降，使策略无法正常执行

### 2.3 信号延迟风险

从信号生成到订单执行存在不可避免的延迟：

- **网络延迟**：信号从服务器传输到交易所的过程中存在网络延迟，在高度时效性的交易中可能导致错失最优入场时机
- **交易所响应**：交易所在高并发时期可能出现 API 响应延迟，影响订单的及时提交
- **执行延迟**：系统处理信号、生成订单、提交执行的整个链路均存在延迟，累计延迟可能在快速行情中造成实质性不利影响
- **价格变化**：由于上述各类延迟，实际执行价格可能与信号生成时的目标价格存在显著差异

### 2.4 单一策略风险

依赖单一策略或单一交易对存在集中风险：

- 单一策略在特定市场环境下可能连续失效
- 未做分散化投资的资金面临更高的整体风险

### 2.5 网格交易特定风险

网格交易是一种在特定价格区间内自动买低卖高的策略，存在以下特有风险：

#### 2.5.1 区间假设风险

网格交易的盈利依赖于价格在设定区间内震荡的假设：

- 网格策略在震荡市场中表现良好，但在明显趋势行情（持续上涨或持续下跌）中可能大幅亏损
- 若价格突破网格上界持续上涨，策略将持有大量空仓头寸而错失涨幅收益
- 若价格跌破网格下界持续下跌，策略将持有大量多仓头寸并持续浮亏，直至触及安全限制

#### 2.5.2 网格配置风险

不当的参数设置会显著加剧损失：

- **上下界设置不当**：设定的价格区间过窄（行情频繁突破）或过宽（格线之间距离过大，交易频率过低）均会影响策略表现
- **格数配置风险**：格数过多导致每格资金过少，可能触及交易所最小下单金额限制；格数过少则交易频率降低
- **杠杆设置不当**：网格交易中使用高杠杆会成倍放大潜在损失，强烈建议保守使用杠杆

#### 2.5.3 资金效率

网格策略中资金并非全部同时活跃：

- 资金被分散分配在各格线层级，等待触发对应价位的订单
- 在大幅单边行情中，大部分资金可能长期处于等待状态，未被充分利用
- 持有的未平仓头寸可能产生资金费率等持续成本

#### 2.5.4 突破风险

价格突破网格范围时，策略的行为可能不符合预期：

- 价格突破上界时，已卖出的头寸错失后续上涨
- 价格突破下界时，已买入的头寸持续承受浮亏压力
- 突破后策略可能选择继续持仓等待回归或触发止损，两种结果均可能带来损失

#### 2.5.5 市场状态误判风险

HOOT 平台使用 AI 自动分类市场状态以调整网格参数，此分类过程本身存在错误风险：

- AI 对市场状态的分类（如窄幅震荡、标准震荡、宽幅震荡、剧烈波动）可能与实际市场情况不符
- 错误的市场状态分类将导致不适用的网格参数被采用，可能加剧损失
- AI 市场状态判断基于历史数据特征，在市场结构突变时尤其可能失准

#### 2.5.6 最小名义值拒绝风险

各交易所对单笔订单有最小名义价值要求：

- 当网格格线资金分配后，单格资金低于交易所最小下单金额（例如 Binance 合约最低 $20 名义值）时，该格的订单将被系统静默跳过，不会执行
- 静默跳过的订单会在网格中留下"缺口"，导致该价位区间的行情无法被策略捕捉
- 总资金量偏少时此问题更为突出，建议根据格数合理配置总资金

---

## 第三章 AI 特定风险

本章描述使用人工智能系统进行交易分析和自动化执行所特有的风险，是所有用户必须充分理解的核心风险类别。

### 3.1 AI 模型局限性

#### 3.1.1 幻觉风险

大型语言模型（LLM）存在"幻觉"风险，即模型可能生成看似合理但实际错误的输出：

- AI 可能编造并不存在的价格支撑/压力位，或描述实际上未发生的图表形态
- AI 可能错误读取技术指标数值，给出与实际数据相悖的分析结论
- AI 生成的市场叙事可能听起来合理但完全基于错误的前提假设
- **幻觉输出的置信度可能与真实输出完全相同，无法从输出本身识别**

#### 3.1.2 训练数据偏差

AI 模型的训练数据和训练方式内嵌了系统性偏差：

- **近因偏差**：模型可能过度重视近期数据中的模式，而忽视更长周期的历史规律
- **幸存者偏差**：训练数据往往更多包含成功案例，对失败情形的学习不充分
- 这些偏差可能导致模型在某些市场条件下系统性地产生倾向性错误分析

#### 3.1.3 上下文窗口限制

所有 LLM 模型均存在有限的上下文窗口（可处理的文本长度）：

- 当输入的市场数据、历史信号、多智能体辩论记录超过上下文窗口限制时，早期信息可能被截断或降级处理
- 丢失的信息可能恰好包含对当前市场判断至关重要的历史背景
- 不同 LLM 提供商的上下文窗口大小不同，切换模型可能改变哪些信息被处理

#### 3.1.4 Prompt 敏感性

AI 模型的输出对输入格式高度敏感：

- 输入数据格式的细微变化（例如数字精度、时间格式、指标排列顺序）可能导致截然不同的分析结论
- 市场数据的预处理方式改变可能在无任何明显异常的情况下悄然改变分析质量
- 不同时刻相同的市场数据可能因随机性（Temperature 参数）产生不同分析结果

#### 3.1.5 模型退化

AI 模型性能并非在所有市场条件下保持恒定：

- 当市场条件与模型训练数据的分布出现显著偏离时（如极端事件、新型市场结构），模型分析质量可能大幅下降
- 模型退化可能是渐进的，难以被及时察觉
- 历史上表现良好的 AI 配置，在未来不同的市场环境中可能表现欠佳

### 3.2 多智能体系统风险

HOOT 平台采用多 AI 智能体辩论投票机制，此机制本身存在以下风险：

#### 3.2.1 伪共识风险

多个 AI 智能体可能因底层模型相似或输入数据相同而产生伪共识：

- 多个智能体以高一致性收敛于同一错误结论，误导性地表现为高置信度信号
- 表面上的"辩论"可能实际上只是对相同偏差的不同表述，缺乏真实的观点多样性
- 高一致性投票并不等同于高准确度

#### 3.2.2 角色局限性

AI "角色"是 Prompt 工程的模拟人设，而非具备真实知识和经验的独立分析师：

- 多头智能体、空头智能体、分析师智能体等角色定义均来自 Prompt 指令，而非不同的知识背景
- 所有角色共用同一底层 LLM 模型，其"对立"观点实质上来自同一个模型对不同 Prompt 的响应
- 角色设定无法赋予 AI 真实的市场经验、直觉或跨周期的判断能力

#### 3.2.3 辩论质量不稳定

多智能体辩论的质量取决于所使用的 LLM 模型质量：

- 使用低成本、低能力的 LLM 模型可能产生低质量的辩论过程和分析输出
- 辩论质量的下降可能不会在输出格式上明显体现，难以被用户识别
- 模型能力的差异可能导致辩论结果产生实质性差异

#### 3.2.4 置信度分数不可靠

数值化的置信度分数（0-100）是模型自评结果，不具备统计校准保证：

- 80分置信度并不意味着 80% 的准确率
- 模型可能在高置信度打分时同样发生错误
- 置信度分数应作为参考而非决策依据，**高置信度分数不等于高准确度**

### 3.3 自动化交易风险

HOOT 平台的自动化交易功能带来特有的执行风险：

#### 3.3.1 无人审核执行

自动调度器和网格交易引擎可能在无实时人工审核的情况下持续执行交易：

- 错误的 AI 分析可能在您不知情的情况下触发真实的买卖操作
- 睡眠、离线、网络中断等情况下，系统仍可能自动执行交易
- 您有责任定期检查自动化交易的执行情况

#### 3.3.2 级联错误风险

自动化系统中，一个错误可能引发连锁反应：

- 一次错误的 AI 分析可能在问题被发现并干预之前，已触发多笔自动交易
- 每笔自动交易产生的亏损头寸可能进一步影响后续的 AI 判断
- 快速行情下，级联错误的速度可能超过人工干预的响应速度

#### 3.3.3 调度时机风险

固定时间表的自动运行存在时机风险：

- AI 分析任务可能恰好在重要经济数据发布、重大新闻事件或交易所计划维护期间触发
- 此类高波动时刻生成的 AI 分析可能质量更低，但仍会被自动执行
- 系统无法预知并主动规避所有高风险时间窗口

#### 3.3.4 安全限制缺口

平台的安全保护措施（最大回撤限制、日损限额等）存在固有的检测间隔：

- 安全限制按照周期性检查（而非逐笔实时检查），在检测间隔内的快速行情可能在限制触发前已造成超过预期的损失
- 极端闪崩行情可能在极短时间内穿透安全限制设定的阈值
- 安全限制是辅助工具，而非损失零容忍保证

### 3.4 LLM 提供商风险

HOOT 平台依赖多家第三方 LLM 服务提供商，相关风险包括：

#### 3.4.1 提供商宕机

平台整合的 7 家以上 LLM 提供商中任何一家均可能发生服务中断：

- 提供商宕机将导致依赖该提供商的 AI 分析功能无法正常运行
- 大规模互联网事故可能同时影响多家提供商
- 提供商的服务中断时间不可预测，可能恰好发生在关键市场时刻

#### 3.4.2 API 变更

LLM 提供商可能在未提前充分通知用户的情况下变更其服务：

- API 接口变更可能导致平台 AI 功能临时中断
- 提供商可能调整模型定价，导致 AI 使用成本意外上涨
- 模型能力调整可能改变 AI 分析的质量，而平台可能无法立即察觉

#### 3.4.3 限流风险

高频率的 AI 分析请求可能触发 LLM 提供商的速率限制（Rate Limit）：

- 在多用户高并发使用时期，AI 请求可能被排队延迟或直接拒绝
- 关键市场时刻的 AI 分析延迟可能导致错过最优决策时机
- 限流触发后，平台将尝试降级处理，但无法保证 AI 功能的完整可用性

#### 3.4.4 数据隐私风险

使用 AI 功能时，市场数据和分析输入将被传输至第三方 LLM 提供商：

- 您的交易品种偏好、持仓情况等信息将作为 AI 分析的输入上传至第三方服务器
- 平台无法完全控制 LLM 提供商对接收数据的处理方式和存储政策
- 请在使用前查阅各 LLM 提供商的隐私政策

#### 3.4.5 模型退役风险

LLM 提供商可能退役、降级或替换其提供的特定模型：

- 您配置的特定 AI 模型可能在未来某时刻被停止服务
- 替换为新模型可能改变 AI 分析的风格、质量或倾向，影响策略表现
- 平台将在模型退役时通知用户，但无法控制提供商的模型生命周期决策

### 3.5 AI 成本风险

#### 3.5.1 意外成本

AI 分析功能按 API 调用计费，高频使用可能带来意外成本：

- 高频 AI 分析周期（如每 5 分钟运行一次）会比低频周期（如每小时运行一次）消耗更多 API 额度
- 多智能体辩论等复杂分析流程的 Token 消耗可能高于预期
- 监控您的 AI 费用使用情况是您的责任

#### 3.5.2 预算耗尽风险

当月度 AI 预算耗尽时，AI 分析功能将自动停止运行：

- 正在运行的自动化策略（包括网格交易）将失去 AI 指导，可能继续以上一次 AI 判断结果运行或进入保守模式
- 已开仓的头寸在 AI 功能停止后将依赖其他机制管理风险
- 建议根据使用频率合理设置 AI 月度预算上限

#### 3.5.3 成本波动

不同 LLM 模型的 API 调用成本差异显著：

- 高能力模型（如 GPT-4o、Claude Opus）每 Token 成本远高于低成本模型（如 Gemini Flash、DeepSeek）
- 您对模型的选择直接决定月度 AI 费用，高端模型配置下费用可能超出预期
- LLM 提供商可能调整定价，导致成本意外变化

---

## 第四章 DEX 特定风险

本章适用于使用 HOOT 平台接入去中心化交易所（DEX）功能的用户。

### 4.1 智能合约风险

去中心化交易依赖智能合约运行，存在以下不可忽视的风险：

- **代码漏洞**：即使经过审计的智能合约也可能存在未被发现的代码漏洞，黑客可以通过利用漏洞盗取合约中锁定的资产，历史上已有多起亿级美元的 DEX 被攻击事件
- **审计局限**：智能合约安全审计无法保证合约完全无漏洞，审计覆盖范围有限，且新型攻击向量持续涌现
- **协议升级风险**：某些 DEX 协议保留管理员升级合约的权限，协议升级可能改变合约行为，在极端情况下可能对用户资产产生不利影响
- **交互链路风险**：与 DEX 交互需要经过多个合约调用，任何一个环节出现问题都可能导致交易失败或资产损失

### 4.2 私钥与托管风险

DEX 交易涉及私钥管理，平台的托管机制存在以下风险：

- **平台托管风险**：若您通过平台托管方式接入 DEX，平台对您的私钥的加密保管存在被攻击、内部操作失误等风险
- **加密密钥丢失**：平台内部的加密主密钥若丢失或损坏，相关用户资产可能无法恢复访问
- **交易不可逆性**：区块链上的交易一旦确认，除非存在合约层面的回滚机制，否则无法撤销。错误操作（如发送到错误地址）造成的损失通常无法找回

### 4.3 Layer 2 与侧链风险

通过 Layer 2 网络或侧链接入的 DEX 存在额外风险：

- **跨链桥漏洞**：资产从主链跨越至 Layer 2 或侧链需要使用跨链桥，历史上跨链桥漏洞已导致数亿美元损失
- **排序器停机**：部分 Layer 2 依赖中心化排序器（Sequencer）处理交易，排序器停机将导致交易无法提交
- **最终性延迟**：Layer 2 交易的主链最终确认可能存在数分钟至数天的延迟，期间资产处于过渡状态

### 4.4 DEX 流动性风险

DEX 的流动性通常低于中心化交易所（CEX）：

- DEX 的交易对流动性深度通常远低于主流 CEX，大额交易可能面临显著更大的滑点
- 流动性提供者可能随时从流动性池中撤出资金，导致流动性突然下降
- 在市场恐慌期间，DEX 流动性可能急剧萎缩，进一步加大交易难度

---

## 第五章 技术风险

### 5.1 系统故障风险

HOOT 平台作为软件系统，可能面临各类技术故障：

- 服务器硬件故障、软件 Bug、数据库异常等可能导致平台服务中断
- 系统故障期间，正在进行的自动化交易可能无法正常管理
- 平台维护或升级期间，部分功能可能暂时不可用
- 尽管平台力求高可用性，但无法对 100% 的正常运行时间作出承诺

### 5.2 网络安全风险

数字资产平台是网络攻击的高价值目标：

- 平台可能遭受 DDoS 攻击、SQL 注入、API 密钥盗取等各类网络攻击
- 用户端的安全弱点（如弱密码、钓鱼攻击、恶意软件）也可能导致账户被盗
- 请使用强密码、启用双因素认证，并妥善保管您的账户凭据

### 5.3 第三方服务风险

平台依赖多类第三方服务，任何一方的故障均可能影响平台功能：

- **LLM 服务提供商**：OpenAI、Anthropic、DeepSeek、Google Gemini 等 7 家以上 LLM 提供商的服务状态直接影响平台 AI 功能
- **DEX 协议**：Hyperliquid、Lighter 等 DEX 协议的技术状态和流动性直接影响去中心化交易功能
- **Telegram 服务**：平台 Telegram Bot 依赖 Telegram 服务可用性，Telegram 服务中断将导致 Bot 无法使用
- **交易所 API**：币安等中心化交易所的 API 服务中断将影响相关用户的自动交易功能
- 平台无法控制第三方服务的可用性，对第三方服务故障导致的损失不承担责任

### 5.4 API 风险

平台通过 API 接入交易所，相关风险包括：

- 交易所可能临时或永久撤销 API 访问权限
- API 接口变更可能导致自动交易功能临时失效
- API 密钥若泄露，攻击者可能利用其对您的交易账户进行未授权操作

### 5.5 网络连接风险

平台服务的访问可能受到网络环境的限制：

- 在部分国家或地区，数字资产相关服务可能被网络防火墙封锁
- 使用代理或 VPN 访问平台可能在某些情况下影响连接稳定性
- 网络中断期间，自动化交易可能无法正常接收服务器指令

---

## 第六章 监管与法律风险

### 6.1 监管政策风险

数字资产领域的监管环境持续快速演变：

- 各国监管机构（包括美国 SEC/CFTC、欧盟 MiCA 框架下的监管机构、亚太各国监管机构）可能出台新规，对数字资产交易、AI 辅助交易、自动化交易机器人等作出限制性规定
- 欧盟《人工智能法案》（EU AI Act）正逐步生效，未来可能对 AI 辅助金融服务提出更严格的合规要求
- 欧盟《加密资产市场监管法规》（MiCA）的实施将对加密资产服务提供商提出新的许可证和运营要求
- 泰国、印度尼西亚等亚太地区国家（PDPA 适用地区）的数据保护法规可能影响 AI 系统对用户数据的处理方式
- 监管政策的突然变化可能导致平台服务需要调整或暂停，您的资金可能在调整期间受到影响

### 6.2 法律不确定性

数字资产和 AI 交易领域存在广泛的法律不确定性：

- 量化交易机器人的法律地位在不同司法管辖区存在差异
- AI 生成的交易决策的法律责任归属尚未在大多数司法管辖区得到明确界定
- 跨境数字资产交易可能触及多个国家的法律法规，产生复杂的法律责任

### 6.3 账户冻结风险

在以下情况下，您的交易账户可能被冻结：

- 监管机构要求交易所配合调查时，您的账户可能被冻结，资金暂时无法提取
- 您的资金若被认定与非法活动相关（即使是无意的），可能面临冻结或没收
- 交易所根据其内部反洗钱（AML）和了解客户（KYC）政策可能对账户施加限制

### 6.4 代币监管风险

HOOT 代币面临特定的监管风险：

- **证券认定风险**：HOOT 代币在某些司法管辖区（尤其是美国）可能被监管机构认定为证券，如果被认定为未注册证券，持有或交易可能面临法律风险
- **税务义务**：参与代币空投、质押获得的 HOOT 代币收益，在您所在国家/地区可能被认定为应税收入，空投和质押行为可能触发相应的税务申报和缴税义务，建议咨询当地税务顾问
- **法律地位变化**：代币的法律地位可能随监管政策变化而改变，原本合法持有或交易的代币可能在未来受到限制

---

## 第七章 操作风险

### 7.1 用户操作失误

人为操作失误是数字资产交易损失的重要原因之一：

- **错误的 AI 模型选择**：为自动化策略选择能力不匹配或成本过高的 AI 模型，可能导致分析质量下降或意外高额 AI 费用
- **不当网格参数**：设置不合理的网格上下界、格数、杠杆倍数或资金分配，可能显著增加策略风险
- **Telegram Bot 误操作**：Telegram Bot 命令（如 \`/closeall\` 一键平仓、\`/stop\` 停止策略）会立即执行，无二次确认环节，误触可能导致非预期的仓位管理操作
- **AI 预算配置不当**：将 AI 月度预算设置过低，可能在关键时刻导致 AI 分析中断；设置过高则可能产生意外高额费用
- 发送错误金额、填写错误地址、配置错误参数均可能导致资金损失，且在区块链交易场景下通常不可撤销

### 7.2 资金管理风险

不当的资金管理是导致交易者重大损失的常见原因：

- 将全部可支配资产集中投入单一平台或策略，一旦出现极端情况，损失将无法分散
- 使用借来的资金（借贷、信用卡）进行高风险投资，可能导致超出本金的债务
- 频繁加仓摊平亏损仓位（"补仓"策略）在持续下跌市场中可能加速资金耗尽
- 缺乏明确止损计划，在亏损情况下情绪化持仓，可能导致小损失滚雪球式扩大

---

## 第八章 平台特有风险

### 8.1 信号执行风险

平台分发的交易信号从生成到执行存在多个环节，每个环节均可能引入风险：

- 网络延迟可能导致信号到达时市场价格已经发生变化
- 多用户同时接收相同信号时，执行时机的细微差异可能导致成交价格不同
- 信号的执行需要您的交易所账户有足够余额和持仓权限，配置不当可能导致信号无法执行

### 8.2 费用影响

使用平台服务涉及多类费用，这些费用将直接影响您的净收益：

- **会员服务费**：平台订阅费用是固定成本，无论盈亏均需支付，在亏损期间会进一步加重负担
- **AI API 成本**：AI 分析功能的费用取决于您选择的模型和使用频率，实际费用可能高于预期
- **代理商佣金**：若您通过代理商注册，代理商佣金将从您的交易利润中抽取，降低实际净收益
- **交易所手续费**：每笔执行的买卖订单均需向交易所支付手续费，高频策略的累计手续费可能显著影响整体收益
- 所有费用在计算实际收益率时均应被纳入考量

### 8.3 策略容量限制

平台的策略和信号系统存在容量上限：

- 当过多用户订阅同一策略时，集体执行相同信号可能影响市场价格，形成自我破坏效应
- 策略在小资金规模下可能表现良好，在大资金规模下因流动性限制而无法复现相同表现

### 8.4 代币经济风险

HOOT 代币经济体系存在以下特有风险：

- **空投规则变更**：HOOT 代币空投的规则（包括资格条件、分配比例、兑换条件、锁仓期）可以随时由平台修改或终止，已记录的积分或待释放的代币不构成平台的法律债务
- **代币没收风险**：在违规行为（包括刷量、操纵系统、违反服务条款等）被认定的情况下，未释放的 HOOT 代币可能被平台没收，已释放代币不受此影响
- **代币价值风险**：HOOT 代币没有法定货币的支撑，其市场价值完全由市场供需决定，可能降至零，平台不对代币价值作任何形式的保证
- **代理商分红池风险**：代理商分红池的回购机制为酌情行为，不构成平台的法定义务。分红池的来源（平台收入）可能因业务情况而波动，分红回购不保证持续执行或保持当前规模

---

## 第九章 风险管理建议

以下建议仅供参考，不构成投资建议。您应根据自身情况制定适合的风险管理策略。

### 9.1 资金管理

- **只投入您可以承受全部损失的资金**：数字资产交易的资金应视为风险资本，而非必须保全的储蓄
- **分散投资**：不要将全部资金集中在单一平台、单一策略或单一数字资产上
- **设定明确的亏损上限**：预先确定您可以接受的最大亏损金额，并严格执行止损
- **不使用借贷资金投资**：避免使用借来的资金参与高风险数字资产交易
- **保留充足的紧急储备资金**：投入交易的资金外，应保有足够应对日常生活需求的现金储备

### 9.2 安全措施

- 使用强密码并定期更换，为账户启用双因素认证（2FA）
- 妥善保管 API 密钥，避免将其暴露给不可信的第三方
- 定期检查账户活动记录，及时发现未授权的访问或交易
- 警惕钓鱼网站、假冒客服、诈骗空投等社会工程学攻击
- 定期检查已授权的 API 权限，删除不再使用的 API 密钥

### 9.3 心理准备

- 接受亏损是数字资产交易的正常组成部分，培养健康的风险承受心态
- 避免在情绪激动时做出重大交易决策，尤其是在大幅亏损后急于"追回"的冲动
- 设定合理的收益预期，警惕任何声称保证高额回报的承诺
- 定期休息，不要因过度关注市场而影响正常生活和工作
- 如果发现自己因交易亏损而产生严重焦虑或影响日常生活，请考虑暂停交易并寻求专业帮助

### 9.4 AI 专项风控建议

以下是针对 HOOT 平台 AI 功能的专项风险管理建议：

- **切勿仅依赖 AI 分析做交易决策**：AI 分析应作为辅助参考，而非唯一依据。您应结合自己的判断和研究综合评估
- **用自己的研究交叉验证 AI 输出**：在执行重要交易前，用其他信息渠道核实 AI 的关键分析结论
- **测试新 AI 配置时先用小仓位**：在为新的 AI 模型、新的辩论配置或新的网格参数投入较大资金前，先以小仓位测试观察实际表现
- **定期监控 AI 费用使用情况**：检查 AI API 的 Token 消耗情况，及时发现异常高额费用
- **保守设置安全限制**：将最大回撤百分比和日损限额设置在较为保守的水平，为 AI 系统可能的判断失误留出缓冲空间
- **理解高置信度分数不等于高准确度**：AI 系统自评的高置信度分数不等同于该次分析的实际准确性，请保持独立判断
- **理解网格策略的前提条件**：仅在您理解并接受震荡市场假设和区间突破风险的情况下使用网格交易功能
- **定期人工审查自动化策略**：即使是全自动运行的策略，也应定期进行人工检查，确认策略按预期执行

---

## 第十章 免责声明

1. **Hoot 仅提供技术工具和信息服务，不提供任何形式的投资、财务或法律建议。** 平台的任何功能（包括 AI 分析、量化策略、信号分发）均不构成投资建议，也不应被理解为对任何投资结果的保证。

2. **您应独立评估所有投资风险，并对您的所有投资决策和操作负完全责任。** Hoot 不会替代您的独立判断。

3. **Hoot 不保证任何量化策略、AI 分析或自动化交易系统的盈利性。** 历史表现不代表未来业绩，任何技术系统都可能在特定市场条件下失效。

4. **Hoot 不对以下原因直接或间接导致的任何损失承担责任：**
   - 数字资产市场价格波动、流动性变化或极端行情事件
   - 量化策略失效、参数设置不当或策略在特定市场环境下表现欠佳
   - AI 模型错误、幻觉输出、偏差判断或其他 AI 系统固有局限性导致的分析失误
   - LLM 提供商服务中断、API 变更、限流或模型退役
   - DEX 智能合约漏洞、协议升级风险或跨链桥安全事故
   - 平台技术故障、服务器宕机、网络中断或系统维护
   - 第三方服务（包括但不限于交易所、LLM 提供商、Telegram、DEX 协议）的故障或变更
   - HOOT 代币价值下跌、归零或代币经济规则调整
   - 空投规则变更或代币分配计划修改
   - 用户操作失误、账户安全疏忽或 Telegram Bot 命令误操作
   - 监管政策变化导致的服务限制或资产冻结

5. **在适用法律允许的最大范围内，Hoot 的全部责任限额不超过您在过去三个月内支付给平台的服务费总额。**

---

## 第十一章 风险承受能力评估

在开始使用 HOOT 平台前，请认真审视以下各项。只有在您能够诚实地确认所有项目后，才建议您继续使用本平台服务。

请在心中逐项确认：

□ 我了解数字资产交易的基本原理，包括买卖交易、价格形成机制和市场风险

□ 我了解量化交易策略的工作方式，理解自动化系统执行交易的基本逻辑

□ 我能够承受将全部投入本平台资金损失，这不会对我的基本生活造成实质影响

□ 我使用的是闲置资金，这些资金在可预见的未来不用于其他重要用途

□ 我没有借款或贷款用于本次投资，不存在因投资亏损而无法偿还债务的风险

□ 我有足够的心理准备面对投资亏损，不会因亏损做出非理性的紧急决策

□ 我不位于禁止使用此类数字资产交易或 AI 辅助交易服务的国家或地区

□ 我理解 AI 生成的交易信号和市场分析可能是错误的，包括看似合理的错误

□ 我理解自动化网格交易在趋势市场（持续上涨或持续下跌）中可能产生显著亏损

□ 我理解通过 DEX 进行的区块链交易涉及智能合约风险，且交易一旦确认通常不可撤销

□ 我理解 HOOT 代币没有价值保证，其市场价值可能大幅下跌乃至归零

□ 我理解我提供的 LLM API 密钥将由平台以加密方式存储，并用于调用 AI 分析服务

□ 我理解 Telegram Bot 命令（包括一键平仓、停止策略等）会立即执行，不存在二次确认

**如果以上任何一项您无法诚实确认，请不要使用本平台的相关功能。**

---

## 第十二章 最终确认

通过点击"我已阅读并理解"或继续使用 HOOT 平台服务，您确认：

1. **您已完整阅读并理解**本风险提示文件的全部内容（共十二章）

2. **您已充分理解**使用本平台所涉及的所有风险类别，包括但不限于：
   - 市场风险（价格波动、流动性、杠杆）
   - 策略风险（历史失效、网格特定风险）
   - AI 特定风险（模型局限性、幻觉、自动化风险）
   - DEX 特定风险（智能合约、私钥管理）
   - 代币经济风险（HOOT 代币价值不确定性、空投规则变更）
   - 监管与法律风险（政策变化、税务义务）

3. **您自愿承担**使用本平台服务所涉及的全部风险，并对您的所有交易决策和操作结果负完全责任

4. **您同意**本风险提示的全部条款，以及平台服务协议的相关条款

5. **您确认**您已年满 18 岁（或您所在司法管辖区规定的合法成年年龄），且在您所在的国家或地区使用本平台服务是合法的

---

© 2024-2026 Hoot. All rights reserved.

**投资有风险，入市需谨慎。**
**请只投入您能承受损失的资金。**`,
  contentEn: `# HOOT Platform Risk Disclosure

**Version: 2.0.0**
**Effective Date: March 15, 2026**
**Last Updated: March 1, 2026**

---

## ⚠️ Important Notice

**Please read the entire content below carefully before using any services on the HOOT platform.**

Digital asset trading, especially combined with AI-powered automated strategies, involves extremely high risk and may result in the total loss of your invested capital. AI trading systems do not guarantee profitability — AI models may produce incorrect analysis, hallucinated outputs, or fail completely under certain market conditions.

As the Buddhist concept of impermanence reminds us: **market outcomes carry inherent uncertainty, and no technology — including artificial intelligence — can eliminate this fundamental uncertainty. Please make an informed and prudent decision about whether to use this platform's services after fully understanding all the risks involved.**

This platform's services are intended solely for adult users who fully understand and are able to bear the associated risks. If you have any questions about any risk, please consult a professional financial or legal advisor before using the platform.

---

## Chapter 1: Market Risks

### 1.1 Price Volatility Risk

Digital asset markets are known for extreme volatility, with prices potentially changing dramatically within very short timeframes:

- **Extreme Volatility**: Digital asset prices can fall by more than 50% within minutes or even seconds. Historically, assets have experienced single-day declines exceeding 90%
- **Flash Crash Risk**: When market liquidity suddenly dries up, prices may experience a "flash crash" — a rapid plunge followed by a quick recovery — during which large numbers of stop-losses and forced liquidations may be triggered
- **Zero-Value Risk**: Some digital assets may drop to zero due to project failure, regulatory crackdowns, or market sentiment collapse, resulting in a total loss of the investor's principal
- **24/7 Markets**: Unlike traditional financial markets, digital asset markets operate continuously, including weekends and holidays. Risk events can occur at any time, and you may not be able to respond in time

### 1.2 Liquidity Risk

Insufficient market liquidity may seriously impair your ability to execute trades:

- **Widening Bid-Ask Spread**: In low-liquidity market conditions, the gap between the buy and sell price (the spread) may widen significantly, increasing actual trading costs
- **Insufficient Market Depth**: When market depth is inadequate, large orders may not be fully filled at the desired price, resulting in partial fills or no fill at all
- **Slippage Risk**: The actual execution price may deviate significantly from the intended price at the time of order placement, particularly during periods of extreme market volatility
- **Inability to Exit**: Under extreme market conditions, you may be unable to close positions at a reasonable price, forcing you to absorb larger losses or becoming entirely unable to exit a position

### 1.3 Leverage Risk

Using leverage significantly amplifies both your gains and losses, and the risks are extreme:

- **Loss Amplification**: Leverage magnifies potential gains but equally magnifies potential losses. For example, 10x leverage means a price move of only 10% against your position can wipe out your entire principal
- **Forced Liquidation**: When your account equity falls below the maintenance margin requirement, the exchange will automatically force-liquidate your positions, potentially at the worst possible moment
- **Negative Equity Risk**: In extreme market conditions, after forced liquidation your account balance may still be negative, and you may be required to pay the shortfall to the exchange
- **Funding Rates**: Leveraged products such as perpetual contracts typically charge funding rates. When held in an unfavorable direction over time, these rates continuously erode your capital

---

## Chapter 2: Strategy Risks

### 2.1 Past Performance Does Not Guarantee Future Results

The historical performance of any strategy, however impressive, does not constitute a guarantee or promise of future performance:

- Historical backtesting data is typically based on known market conditions and may suffer from overfitting
- Backtesting environments cannot fully replicate real-world trading costs such as slippage, commissions, and liquidity constraints
- Strategies that were profitable in the past may suffer continuous losses in the future due to changes in market conditions
- Any historical return figures displayed on the platform are for reference only and do not constitute investment advice

### 2.2 Strategy Invalidation Risk

Quantitative strategies carry the risk of sudden invalidation:

- **Market Structure Changes**: Changes in the composition of market participants, regulatory environment, or macroeconomic conditions may render previously effective strategies completely ineffective
- **Strategy Crowding**: When too much capital chases the same trading signals, the marginal return of the strategy declines rapidly and may turn negative
- **Black Swan Events**: Unpredictable extreme events (such as major regulatory announcements, exchange bankruptcies, market manipulation, or technical failures) can cause any strategy to suffer massive losses in a short period
- **Rule Changes**: Exchanges may change their trading rules, fee structures, or leverage limits, directly impacting strategy performance
- **Liquidity Changes**: The liquidity of certain trading pairs may deteriorate sharply due to changing market conditions, preventing the strategy from executing normally

### 2.3 Signal Delay Risk

There is an unavoidable delay from signal generation to order execution:

- **Network Latency**: The transmission of signals from the server to the exchange involves network latency, which in highly time-sensitive trades may cause missed optimal entry opportunities
- **Exchange Response Time**: Exchanges may experience API response delays during periods of high concurrency, affecting the timely submission of orders
- **Execution Delay**: The entire chain of processing a signal, generating an order, and submitting it for execution involves latency. Cumulative delays can have a material adverse impact in fast-moving markets
- **Price Change**: Due to all the above delays, the actual execution price may differ significantly from the target price at the time the signal was generated

### 2.4 Single Strategy Risk

Relying on a single strategy or single trading pair creates concentration risk:

- A single strategy may fail continuously in specific market environments
- Capital not diversified across multiple strategies faces higher overall risk

### 2.5 Grid Trading Specific Risks

Grid trading is a strategy that automatically buys low and sells high within a defined price range. It carries the following specific risks:

#### 2.5.1 Range Assumption Risk

Grid trading profits depend on the assumption that prices will oscillate within a set range:

- Grid strategies perform well in ranging markets but may suffer significant losses in strong trending markets (sustained uptrends or downtrends)
- If prices break out above the grid's upper bound and continue rising, the strategy will hold large short positions and miss the upside gains
- If prices break below the grid's lower bound and continue falling, the strategy will hold large long positions with growing unrealized losses until safety limits are triggered

#### 2.5.2 Grid Configuration Risk

Improper parameter settings can significantly amplify losses:

- **Improper Bounds**: A price range that is too narrow (prices frequently break out) or too wide (grid levels are too far apart, resulting in very low trading frequency) will negatively impact strategy performance
- **Grid Count Configuration**: Too many grid levels result in too little capital per level, potentially triggering minimum order size requirements; too few grid levels reduce trading frequency
- **Improper Leverage**: Using high leverage with grid trading multiplies potential losses. Conservative use of leverage is strongly recommended

#### 2.5.3 Capital Efficiency

Not all capital is actively deployed at any given time in a grid strategy:

- Capital is distributed across grid levels, waiting to be triggered at corresponding price points
- During large one-directional moves, a significant portion of capital may remain in a waiting state for an extended period, not being fully utilized
- Open positions held by the strategy may incur ongoing costs such as funding rates

#### 2.5.4 Breakout Risk

When prices break out of the grid range, the strategy's behavior may not align with expectations:

- When prices break above the upper bound, positions already sold miss subsequent gains
- When prices break below the lower bound, positions already bought face sustained unrealized loss pressure
- After a breakout, the strategy may choose to hold positions and wait for a return, or trigger stop-loss. Both outcomes may result in losses

#### 2.5.5 Market Regime Misclassification Risk

The HOOT platform uses AI to automatically classify market conditions and adjust grid parameters. This classification process is itself subject to error:

- The AI's classification of market conditions (e.g., narrow range, standard range, wide range, highly volatile) may not accurately reflect actual market conditions
- An incorrect market regime classification will cause inappropriate grid parameters to be applied, potentially amplifying losses
- AI market regime judgments are based on historical data patterns and may be especially inaccurate during sudden structural shifts in the market

#### 2.5.6 Minimum Notional Value Rejection Risk

Exchanges have minimum notional value requirements for individual orders:

- When capital allocated to a grid level falls below the exchange's minimum order size (e.g., Binance futures minimum $20 notional value), that level's order will be silently skipped and not executed
- Silently skipped orders create "gaps" in the grid, meaning price movements in those zones will not be captured by the strategy
- This issue is more pronounced when total capital is relatively small. It is recommended to allocate total capital appropriately based on the number of grid levels

---

## Chapter 3: AI-Specific Risks

This chapter describes risks unique to the use of artificial intelligence systems for trading analysis and automated execution. This is a core risk category that all users must fully understand.

### 3.1 AI Model Limitations

#### 3.1.1 Hallucination Risk

Large Language Models (LLMs) are subject to "hallucinations" — where the model may generate outputs that appear plausible but are factually incorrect:

- The AI may fabricate non-existent support or resistance levels, or describe chart patterns that did not actually occur
- The AI may misread technical indicator values and provide analysis conclusions that contradict actual data
- The market narrative generated by the AI may sound reasonable but be based entirely on incorrect premises
- **The confidence level of hallucinated outputs can be identical to that of correct outputs — they cannot be identified from the output alone**

#### 3.1.2 Training Data Bias

AI models have systematic biases embedded in their training data and training methodology:

- **Recency Bias**: Models may over-weight patterns from recent data while overlooking longer-term historical regularities
- **Survivorship Bias**: Training data typically includes more successful cases, resulting in insufficient learning from failure scenarios
- These biases may cause the model to systematically produce directionally biased analysis under certain market conditions

#### 3.1.3 Context Window Limitations

All LLM models have a finite context window (the amount of text they can process at once):

- When market data, historical signals, and multi-agent debate records exceed the context window limit, earlier information may be truncated or downgraded in processing
- The discarded information may be precisely the historical context most critical to the current market judgment
- Context window sizes vary across LLM providers; switching models may change which information is included in processing

#### 3.1.4 Prompt Sensitivity

AI model outputs are highly sensitive to input format:

- Minor changes in input data format (e.g., numeric precision, time format, indicator ordering) may lead to substantially different analytical conclusions
- Changes in how market data is preprocessed may quietly alter analysis quality without any obvious anomalies in the output
- At different times, the same market data may produce different analytical results due to randomness (Temperature parameter)

#### 3.1.5 Model Degradation

AI model performance is not constant across all market conditions:

- When market conditions diverge significantly from the distribution of the model's training data (e.g., extreme events, novel market structures), model analysis quality may decline sharply
- Model degradation can be gradual and difficult to detect in a timely manner
- AI configurations that have performed well historically may underperform in different future market environments

### 3.2 Multi-Agent System Risks

The HOOT platform uses a multi-AI-agent debate and voting mechanism, which itself carries the following risks:

#### 3.2.1 False Consensus Risk

Multiple AI agents may produce false consensus due to similar underlying models or identical input data:

- Multiple agents converge with high consistency on the same incorrect conclusion, misleadingly manifesting as a high-confidence signal
- The apparent "debate" may in practice be different expressions of the same bias, lacking genuine diversity of viewpoints
- High consistency in voting does not equate to high accuracy

#### 3.2.2 Role Limitations

AI "roles" are simulated personas created through prompt engineering, not independent analysts with real knowledge and experience:

- Bullish agent, bearish agent, analyst agent, and other role definitions all originate from prompt instructions, not from different knowledge backgrounds
- All roles share the same underlying LLM model; their "opposing" viewpoints are in essence the same model's responses to different prompts
- Role definitions cannot endow the AI with real market experience, intuition, or multi-cycle judgment capability

#### 3.2.3 Variable Debate Quality

The quality of multi-agent debate depends on the quality of the LLM model used:

- Using a low-cost, low-capability LLM model may produce a poor-quality debate process and analysis output
- A decline in debate quality may not be visibly reflected in the output format, making it difficult for users to identify
- Differences in model capability may lead to substantially different debate outcomes

#### 3.2.4 Unreliable Confidence Scores

Numerical confidence scores (0-100) are self-assessments by the model and carry no statistical calibration guarantee:

- A confidence score of 80 does not mean an 80% accuracy rate
- The model may make errors even when self-assigning high confidence scores
- Confidence scores should be treated as a reference, not as a decision basis. **A high confidence score does not equal high accuracy**

### 3.3 Automated Trading Risks

HOOT platform's automated trading features carry specific execution risks:

#### 3.3.1 Execution Without Human Review

The automated scheduler and grid trading engine may continuously execute trades without real-time human oversight:

- Incorrect AI analysis may trigger real buy and sell orders without your knowledge
- During sleep, offline periods, or network interruptions, the system may continue to execute trades automatically
- You are responsible for periodically reviewing the execution status of automated trades

#### 3.3.2 Cascading Error Risk

In automated systems, a single error may trigger a chain reaction:

- One incorrect AI analysis may trigger multiple automated trades before the problem is discovered and intervention is possible
- Loss positions generated by each automated trade may further influence subsequent AI judgments
- In fast-moving markets, the speed of cascading errors may exceed the response speed of human intervention

#### 3.3.3 Scheduling Timing Risk

Automated runs on a fixed schedule carry timing risk:

- AI analysis tasks may happen to be triggered during major economic data releases, significant news events, or scheduled exchange maintenance
- AI analysis generated during such high-volatility moments may be of lower quality but will still be automatically executed
- The system cannot predict and actively avoid all high-risk time windows

#### 3.3.4 Safety Limit Gaps

The platform's safety protection mechanisms (maximum drawdown limits, daily loss caps, etc.) have inherent detection intervals:

- Safety limits are checked periodically (not in real-time per trade). Rapid market moves within detection intervals may cause losses exceeding expectations before the limits are triggered
- Extreme flash crash events may breach safety limit thresholds within an extremely short timeframe
- Safety limits are auxiliary tools, not zero-tolerance loss guarantees

### 3.4 LLM Provider Risks

The HOOT platform relies on multiple third-party LLM service providers, with associated risks including:

#### 3.4.1 Provider Outages

Any of the 7+ LLM providers integrated by the platform may experience service interruptions:

- A provider outage will prevent AI analysis features that depend on that provider from functioning normally
- Large-scale internet incidents may simultaneously affect multiple providers
- Provider service interruption time is unpredictable and may occur precisely during critical market moments

#### 3.4.2 API Changes

LLM providers may modify their services without adequate advance notice to users:

- API interface changes may cause temporary disruption to platform AI features
- Providers may adjust model pricing, leading to unexpected increases in AI usage costs
- Model capability adjustments may change the quality of AI analysis, which the platform may not be able to detect immediately

#### 3.4.3 Rate Limiting

High-frequency AI analysis requests may trigger LLM provider rate limits:

- During periods of high concurrent usage, AI requests may be queued, delayed, or outright rejected
- AI analysis delays at critical market moments may cause missed optimal decision opportunities
- When rate limiting is triggered, the platform will attempt to degrade gracefully, but cannot guarantee full availability of AI features

#### 3.4.4 Data Privacy Risk

When using AI features, market data and analysis inputs are transmitted to third-party LLM providers:

- Information about your trading preferences, positions, and other details is uploaded to third-party servers as input for AI analysis
- The platform has limited control over how LLM providers handle and store the data they receive
- Please review the privacy policies of each LLM provider before use

#### 3.4.5 Model Deprecation Risk

LLM providers may retire, downgrade, or replace specific models they offer:

- A specific AI model you have configured may be discontinued at some future point
- Replacement with a new model may change the style, quality, or tendency of AI analysis, affecting strategy performance
- The platform will notify users when a model is retired but cannot control providers' model lifecycle decisions

### 3.5 AI Cost Risks

#### 3.5.1 Unexpected Costs

AI analysis features are billed based on API usage, and high-frequency use may result in unexpected costs:

- High-frequency AI analysis cycles (e.g., every 5 minutes) will consume API quota much faster than lower-frequency cycles (e.g., every hour)
- Complex analysis workflows such as multi-agent debates may consume more tokens than expected
- Monitoring your AI cost usage is your responsibility

#### 3.5.2 Budget Exhaustion Risk

When the monthly AI budget is exhausted, AI analysis features will automatically stop running:

- Automated strategies currently running (including grid trading) will lose AI guidance and may continue operating based on the last AI judgment result or enter a conservative mode
- Open positions will rely on other mechanisms for risk management after AI features stop
- It is recommended to set a reasonable monthly AI budget cap based on your usage frequency

#### 3.5.3 Cost Volatility

The API call cost per model varies significantly across different LLM models:

- High-capability models (e.g., GPT-4o, Claude Opus) have a much higher cost per token than low-cost models (e.g., Gemini Flash, DeepSeek)
- Your choice of model directly determines your monthly AI costs. Premium model configurations may result in costs exceeding expectations
- LLM providers may adjust pricing, causing unexpected cost changes

---

## Chapter 4: DEX-Specific Risks

This chapter applies to users who use the HOOT platform's functionality to access decentralized exchanges (DEX).

### 4.1 Smart Contract Risk

Decentralized trading relies on smart contracts, which carry the following non-negligible risks:

- **Code Vulnerabilities**: Even audited smart contracts may contain undiscovered code vulnerabilities. Hackers can exploit these vulnerabilities to steal assets locked in contracts. History has seen multiple attacks on DEXs involving hundreds of millions of dollars
- **Audit Limitations**: Smart contract security audits cannot guarantee that a contract is completely free of vulnerabilities. Audit coverage is limited, and new attack vectors continue to emerge
- **Protocol Upgrade Risk**: Some DEX protocols reserve admin rights to upgrade contracts. Protocol upgrades may change contract behavior and in extreme cases may have adverse effects on user assets
- **Interaction Chain Risk**: Interacting with a DEX requires multiple contract calls. A problem at any step may result in a failed transaction or asset loss

### 4.2 Private Key and Custody Risk

DEX trading involves private key management, and the platform's custody mechanism carries the following risks:

- **Platform Custody Risk**: If you access DEXs through a platform-custodied approach, the platform's encrypted storage of your private keys is subject to risks of attack or internal operational errors
- **Encryption Key Loss**: If the platform's internal master encryption key is lost or corrupted, affected users may be unable to access their assets
- **Transaction Irreversibility**: Once a blockchain transaction is confirmed, it typically cannot be reversed except through a contract-level rollback mechanism. Losses from erroneous operations (such as sending to the wrong address) are generally unrecoverable

### 4.3 Layer 2 and Sidechain Risks

DEXs accessed through Layer 2 networks or sidechains carry additional risks:

- **Bridge Vulnerabilities**: Moving assets from the mainchain to a Layer 2 or sidechain requires using a cross-chain bridge. Historically, bridge vulnerabilities have led to hundreds of millions of dollars in losses
- **Sequencer Downtime**: Some Layer 2 networks rely on a centralized sequencer to process transactions. Sequencer downtime will prevent transaction submission
- **Finality Delay**: The mainchain final confirmation of Layer 2 transactions may involve delays ranging from minutes to days, during which assets are in a transitional state

### 4.4 DEX Liquidity Risk

DEX liquidity is generally lower than that of centralized exchanges (CEX):

- The liquidity depth of DEX trading pairs is typically far below that of major CEXs. Large trades may face significantly greater slippage
- Liquidity providers may withdraw their funds from liquidity pools at any time, causing a sudden drop in liquidity
- During market panic, DEX liquidity may shrink dramatically, further increasing the difficulty of trading

---

## Chapter 5: Technical Risks

### 5.1 System Failure Risk

As a software system, the HOOT platform may face various types of technical failures:

- Server hardware failures, software bugs, database anomalies, and other issues may cause service interruptions
- Automated trades in progress may not be managed properly during system outages
- Certain features may be temporarily unavailable during platform maintenance or upgrades
- While the platform strives for high availability, it cannot guarantee 100% uptime

### 5.2 Cybersecurity Risk

Digital asset platforms are high-value targets for cyberattacks:

- The platform may be subject to DDoS attacks, SQL injection, API key theft, and other types of cyberattacks
- Security weaknesses on the user's end (such as weak passwords, phishing attacks, malware) can also lead to account compromise
- Please use strong passwords, enable two-factor authentication (2FA), and keep your account credentials secure

### 5.3 Third-Party Service Risk

The platform relies on several types of third-party services, and a failure by any of them may affect platform functionality:

- **LLM Service Providers**: The service status of 7+ LLM providers including OpenAI, Anthropic, DeepSeek, Google Gemini, and others directly affects platform AI features
- **DEX Protocols**: The technical status and liquidity of DEX protocols such as Hyperliquid and Lighter directly affect decentralized trading functionality
- **Telegram Service**: The platform's Telegram Bot depends on Telegram's availability. A Telegram service outage will prevent the Bot from functioning
- **Exchange APIs**: Outages of the API services of centralized exchanges such as Binance will affect automated trading for affected users
- The platform cannot control the availability of third-party services and is not responsible for losses caused by third-party service failures

### 5.4 API Risk

The platform accesses exchanges via APIs, with associated risks including:

- Exchanges may temporarily or permanently revoke API access
- API interface changes may cause automated trading features to temporarily fail
- If API keys are leaked, attackers may use them to conduct unauthorized operations on your trading account

### 5.5 Network Connectivity Risk

Access to platform services may be restricted by network environment conditions:

- In some countries or regions, digital asset-related services may be blocked by network firewalls
- Using a proxy or VPN to access the platform may in some cases affect connection stability
- During network interruptions, automated trading may be unable to receive server instructions normally

---

## Chapter 6: Regulatory and Legal Risks

### 6.1 Regulatory Policy Risk

The regulatory environment for digital assets continues to evolve rapidly:

- Regulatory authorities in various jurisdictions (including the U.S. SEC/CFTC, regulators operating under the EU MiCA framework, and regulatory bodies across the Asia-Pacific region) may issue new regulations imposing restrictions on digital asset trading, AI-assisted trading, and automated trading bots
- The EU Artificial Intelligence Act (EU AI Act) is gradually coming into effect and may impose stricter compliance requirements on AI-assisted financial services in the future
- The implementation of the EU Markets in Crypto-Assets Regulation (MiCA) will impose new licensing and operational requirements on crypto-asset service providers
- Data protection regulations in Asia-Pacific countries such as Thailand and Indonesia (where PDPA applies) may affect how AI systems handle user data
- Sudden changes in regulatory policy may require the platform to adjust or suspend certain services, and your funds may be affected during the adjustment period

### 6.2 Legal Uncertainty

There is widespread legal uncertainty in the fields of digital assets and AI trading:

- The legal status of quantitative trading bots varies across jurisdictions
- The attribution of legal liability for trading decisions generated by AI has not been clearly defined in most jurisdictions
- Cross-border digital asset transactions may implicate laws and regulations of multiple countries, creating complex legal liability

### 6.3 Account Freeze Risk

Your trading account may be frozen in the following circumstances:

- When regulatory authorities require exchanges to cooperate with investigations, your account may be frozen and funds temporarily inaccessible
- If your funds are found to be associated with illegal activities (even inadvertently), they may be subject to freezing or confiscation
- Exchanges may impose restrictions on accounts based on their internal Anti-Money Laundering (AML) and Know Your Customer (KYC) policies

### 6.4 Token Regulatory Risk

The HOOT token faces specific regulatory risks:

- **Securities Classification Risk**: The HOOT token may be classified as a security by regulators in certain jurisdictions (particularly the United States). If classified as an unregistered security, holding or trading it may carry legal risks
- **Tax Obligations**: HOOT token proceeds received through participation in airdrops or staking may be classified as taxable income in your country or region. Airdrop and staking activities may trigger corresponding tax reporting and payment obligations. Consulting a local tax advisor is recommended
- **Changing Legal Status**: The legal status of the token may change as regulatory policy evolves. Tokens that are currently legal to hold or trade may be subject to restrictions in the future

---

## Chapter 7: Operational Risks

### 7.1 User Operational Errors

Human operational errors are a significant source of losses in digital asset trading:

- **Incorrect AI Model Selection**: Selecting an AI model with mismatched capability or excessive cost for an automated strategy may result in reduced analysis quality or unexpectedly high AI costs
- **Improper Grid Parameters**: Setting unreasonable grid bounds, number of levels, leverage multiplier, or capital allocation can significantly increase strategy risk
- **Telegram Bot Misoperation**: Telegram Bot commands (such as \`/closeall\` for one-click position closing or \`/stop\` for strategy termination) execute immediately with no secondary confirmation. An accidental trigger may result in unintended position management actions
- **Improper AI Budget Configuration**: Setting the monthly AI budget too low may cause AI analysis to stop at a critical moment; setting it too high may result in unexpectedly high costs
- Sending an incorrect amount, entering a wrong address, or configuring incorrect parameters can all lead to asset losses and are generally irreversible in blockchain transaction scenarios

### 7.2 Capital Management Risk

Improper capital management is a common cause of significant losses among traders:

- Concentrating all available assets in a single platform or strategy means that an extreme event could result in non-diversifiable losses
- Using borrowed funds (loans, credit cards) for high-risk investments may result in debt exceeding the original principal
- Repeatedly adding to losing positions ("averaging down") in a sustained downtrend can accelerate capital depletion
- Lacking a clear stop-loss plan and holding positions emotionally during losses may allow small losses to snowball into much larger ones

---

## Chapter 8: Platform-Specific Risks

### 8.1 Signal Execution Risk

Trading signals distributed by the platform pass through multiple stages from generation to execution, and each stage may introduce risk:

- Network latency may cause market prices to change by the time a signal is received
- When multiple users simultaneously receive the same signal, minor differences in execution timing may result in different fill prices
- Signal execution requires your exchange account to have sufficient balance and position permissions; improper configuration may prevent signals from being executed

### 8.2 Fee Impact

Using the platform involves multiple types of fees that will directly affect your net returns:

- **Membership Service Fee**: Platform subscription fees are a fixed cost payable regardless of trading outcomes. During losing periods, these fees add further burden
- **AI API Costs**: The fees for AI analysis features depend on your chosen models and usage frequency; actual costs may exceed expectations
- **Agent Commissions**: If you registered through an agent, agent commissions will be deducted from your trading profits, reducing actual net returns
- **Exchange Trading Fees**: Each executed buy or sell order incurs exchange trading fees. For high-frequency strategies, cumulative fees can significantly impact overall returns
- All fees should be factored in when calculating actual return rates

### 8.3 Strategy Capacity Limits

The platform's strategy and signal systems have capacity ceilings:

- When too many users subscribe to the same strategy, the collective execution of the same signals may impact market prices, creating a self-undermining effect
- A strategy may perform well at small capital scales but be unable to replicate the same performance at large capital scales due to liquidity constraints

### 8.4 Token Economy Risks

The HOOT token economic system carries the following specific risks:

- **Airdrop Rule Changes**: The rules of the HOOT token airdrop (including eligibility criteria, allocation proportions, redemption conditions, and lock-up periods) may be modified or terminated by the platform at any time. Recorded points or pending token releases do not constitute a legal debt of the platform
- **Token Confiscation Risk**: In cases where violations are identified (including wash trading, system manipulation, or breaches of the terms of service), unreleased HOOT tokens may be confiscated by the platform. Already-released tokens are not affected
- **Token Value Risk**: HOOT tokens have no fiat currency backing. Their market value is entirely determined by market supply and demand and may decline to zero. The platform makes no guarantee of any kind regarding token value
- **Agent Dividend Pool Risk**: The buyback mechanism for the agent dividend pool is discretionary and does not constitute a statutory obligation of the platform. The source of the dividend pool (platform revenue) may fluctuate based on business conditions. Dividend buybacks are not guaranteed to continue or be maintained at their current scale

---

## Chapter 9: Risk Management Recommendations

The following recommendations are provided for reference only and do not constitute investment advice. You should develop a risk management strategy appropriate to your own circumstances.

### 9.1 Capital Management

- **Only invest capital you can afford to lose entirely**: Funds allocated to digital asset trading should be treated as risk capital, not savings that must be preserved
- **Diversify**: Do not concentrate all your capital in a single platform, single strategy, or single digital asset
- **Set a clear loss ceiling**: Pre-determine the maximum loss amount you can accept and strictly enforce stop-losses
- **Do not invest borrowed funds**: Avoid using borrowed capital to participate in high-risk digital asset trading
- **Maintain adequate emergency reserves**: Outside of funds invested in trading, maintain sufficient cash to meet everyday living needs

### 9.2 Security Measures

- Use strong passwords and change them regularly; enable two-factor authentication (2FA) on your account
- Keep your API keys secure and avoid exposing them to untrusted third parties
- Regularly review account activity records to detect unauthorized access or trades in a timely manner
- Be vigilant against phishing websites, fake customer service representatives, fraudulent airdrops, and other social engineering attacks
- Periodically review authorized API permissions and delete API keys that are no longer in use

### 9.3 Psychological Preparedness

- Accept that losses are a normal part of digital asset trading; cultivate a healthy risk tolerance mindset
- Avoid making major trading decisions when emotional, especially the impulse to "recover" losses immediately after a large loss
- Set realistic return expectations and be wary of any promises of guaranteed high returns
- Take regular breaks; do not allow excessive market monitoring to interfere with normal life and work
- If you find that trading losses are causing severe anxiety or affecting your daily life, consider pausing trading and seeking professional help

### 9.4 AI-Specific Risk Control Recommendations

The following are specific risk management recommendations for the HOOT platform's AI features:

- **Never rely solely on AI analysis for trading decisions**: AI analysis should serve as a supplementary reference, not the sole basis for decisions. You should integrate your own judgment and research in your overall assessment
- **Cross-validate AI outputs with your own research**: Before executing important trades, verify the AI's key analytical conclusions using other information sources
- **Use small positions when testing new AI configurations**: Before committing significant capital to a new AI model, new debate configuration, or new grid parameters, first test with a small position and observe actual performance
- **Regularly monitor AI cost usage**: Check the token consumption of your AI API usage and promptly identify any abnormally high costs
- **Set safety limits conservatively**: Set maximum drawdown percentages and daily loss caps at conservative levels, providing a buffer for potential errors in AI system judgment
- **Understand that a high confidence score does not equal high accuracy**: A high confidence score self-assigned by the AI system does not equate to the actual accuracy of that analysis. Maintain independent judgment
- **Understand the prerequisite conditions of grid strategy**: Only use the grid trading feature if you understand and accept the ranging market assumption and the risks of range breakouts
- **Periodically conduct human review of automated strategies**: Even for fully automated strategies, conduct regular human inspections to confirm that the strategy is executing as intended

---

## Chapter 10: Disclaimer

1. **Hoot provides only technical tools and information services and does not provide any form of investment, financial, or legal advice.** Any features of the platform (including AI analysis, quantitative strategies, and signal distribution) do not constitute investment advice and should not be interpreted as a guarantee of any investment outcome.

2. **You should independently assess all investment risks and bear full responsibility for all your investment decisions and actions.** Hoot does not substitute for your independent judgment.

3. **Hoot does not guarantee the profitability of any quantitative strategy, AI analysis, or automated trading system.** Past performance does not represent future results, and any technical system may fail under specific market conditions.

4. **Hoot is not responsible for any losses, direct or indirect, caused by the following:**
   - Digital asset market price fluctuations, liquidity changes, or extreme market events
   - Strategy invalidation, improper parameter settings, or poor strategy performance in specific market environments
   - AI model errors, hallucinated outputs, biased judgments, or other analysis failures inherent to AI system limitations
   - LLM provider service outages, API changes, rate limiting, or model deprecation
   - DEX smart contract vulnerabilities, protocol upgrade risks, or cross-chain bridge security incidents
   - Platform technical failures, server outages, network interruptions, or system maintenance
   - Failures or changes by third-party services (including but not limited to exchanges, LLM providers, Telegram, and DEX protocols)
   - HOOT token value decline, token reaching zero value, or changes to token economy rules
   - Airdrop rule changes or modifications to token distribution plans
   - User operational errors, account security negligence, or inadvertent Telegram Bot command execution
   - Service restrictions or asset freezes resulting from changes in regulatory policy

5. **To the maximum extent permitted by applicable law, the total liability of Hoot shall not exceed the total service fees paid by you to the platform in the preceding three months.**

---

## Chapter 11: Risk Tolerance Assessment

Before beginning to use the HOOT platform, please carefully consider each of the following items. Only proceed with using this platform's services if you can honestly confirm all items.

Please confirm each item in your mind:

□ I understand the basic principles of digital asset trading, including buy and sell transactions, price formation mechanisms, and market risks

□ I understand how quantitative trading strategies work and the basic logic of automated systems executing trades

□ I am able to bear the total loss of all capital invested in this platform; such a loss would not materially affect my basic livelihood

□ I am using discretionary funds that are not needed for other important purposes in the foreseeable future

□ I have not borrowed or taken out loans for this investment, and there is no risk of being unable to repay debts due to investment losses

□ I am psychologically prepared to face investment losses and will not make irrational emergency decisions as a result of losses

□ I am not located in a country or region where the use of this type of digital asset trading or AI-assisted trading service is prohibited

□ I understand that AI-generated trading signals and market analysis may be incorrect, including plausible-sounding errors

□ I understand that automated grid trading may generate significant losses in trending markets (sustained uptrends or downtrends)

□ I understand that blockchain transactions conducted through DEXs involve smart contract risks and that confirmed transactions are typically irreversible

□ I understand that HOOT tokens have no value guarantee and their market value may fall significantly or reach zero

□ I understand that the LLM API keys I provide will be stored in encrypted form by the platform and used to invoke AI analysis services

□ I understand that Telegram Bot commands (including one-click position closing, strategy termination, and others) execute immediately without a secondary confirmation step

**If you cannot honestly confirm any of the above items, please do not use the relevant features of this platform.**

---

## Chapter 12: Final Confirmation

By clicking "I have read and understood" or by continuing to use the HOOT platform's services, you confirm that:

1. **You have read and understood** the entire content of this Risk Disclosure document (all twelve chapters)

2. **You have sufficiently understood** all categories of risks associated with using this platform, including but not limited to:
   - Market risks (price volatility, liquidity, leverage)
   - Strategy risks (historical invalidation, grid-specific risks)
   - AI-specific risks (model limitations, hallucinations, automation risks)
   - DEX-specific risks (smart contracts, private key management)
   - Token economy risks (HOOT token value uncertainty, airdrop rule changes)
   - Regulatory and legal risks (policy changes, tax obligations)

3. **You voluntarily assume** all risks associated with using this platform's services and take full responsibility for all your trading decisions and the outcomes of your operations

4. **You agree** to all terms of this Risk Disclosure and the relevant terms of the platform's Terms of Service

5. **You confirm** that you are at least 18 years of age (or the legal age of majority in your jurisdiction) and that using this platform's services is lawful in your country or region

---

© 2024-2026 Hoot. All rights reserved.

**Trading involves risk. Enter the market with caution.**
**Please only invest what you can afford to lose.**`
}

// 导出所有法律文档
export const legalDocuments: Record<string, LegalDocumentContent> = {
  terms: termsOfService,
  privacy: privacyPolicy,
  risk: riskDisclosure
}
