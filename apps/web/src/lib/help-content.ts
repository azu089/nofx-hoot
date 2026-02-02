/**
 * 帮助文档内容
 * 商用级完整帮助文章
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
// 快速入门 / Getting Started
// ============================================
export const gettingStarted: HelpArticle = {
  slug: 'getting-started',
  titleZh: '快速入门指南',
  titleEn: 'Getting Started Guide',
  descriptionZh: '从零开始，快速掌握 Hoot 量化交易平台',
  descriptionEn: 'Start from scratch, quickly master the Hoot quantitative trading platform',
  sections: [
    {
      titleZh: '欢迎使用 Hoot',
      titleEn: 'Welcome to Hoot',
      contentZh: `Hoot 是一个革命性的 AI 驱动量化交易平台，让每个人都能享受专业级的量化交易服务。

**我们的优势：**
• AI 智能策略：由顶尖量化团队打造的交易策略
• 一键跟单：无需编程，订阅即用
• 资金安全：您的资金始终在自己的交易所账户
• 透明计费：只在盈利时收取费用

**本指南将帮助您：**
1. 创建并设置 Hoot 账户
2. 绑定交易所 API（安全连接）
3. 选择并订阅适合的策略
4. 配置交易参数开始跟单`,
      contentEn: `Hoot is a revolutionary AI-powered quantitative trading platform that brings professional-grade quant trading to everyone.

**Our Advantages:**
• AI Smart Strategies: Trading strategies built by top quant teams
• One-click Copy Trading: No coding needed, subscribe and use
• Fund Security: Your funds always stay in your own exchange account
• Transparent Pricing: Fees only charged on profits

**This guide will help you:**
1. Create and set up your Hoot account
2. Connect exchange API (secure connection)
3. Choose and subscribe to suitable strategies
4. Configure trading parameters to start copy trading`
    },
    {
      titleZh: '第一步：创建 Hoot 账户',
      titleEn: 'Step 1: Create Your Hoot Account',
      contentZh: `**注册方式**

Hoot 支持三种注册方式，选择最适合您的：

**方式一：邮箱注册（推荐）**
1. 访问 hoot.trade 或打开 App
2. 点击"注册"按钮
3. 输入您的邮箱地址
4. 设置登录密码（至少 8 位，包含字母和数字）
5. 点击"发送验证码"
6. 查收邮件，输入 6 位验证码
7. 完成注册

**方式二：钱包登录**
1. 点击"钱包连接"
2. 选择您的钱包（MetaMask、WalletConnect 等）
3. 确认钱包签名
4. 自动创建账户

**方式三：Telegram 登录**
1. 点击"Telegram 登录"
2. 跳转到 Telegram 确认
3. 授权后自动完成注册

**完善个人资料**
注册成功后，建议您：
• 设置昵称（用于社区交流）
• 绑定 Telegram（接收交易通知）
• 开启两步验证（账户安全必备）`,
      contentEn: `**Registration Methods**

Hoot supports three registration methods, choose what suits you best:

**Method 1: Email Registration (Recommended)**
1. Visit hoot.trade or open the App
2. Click "Register" button
3. Enter your email address
4. Set login password (at least 8 characters, including letters and numbers)
5. Click "Send Verification Code"
6. Check email, enter 6-digit code
7. Complete registration

**Method 2: Wallet Login**
1. Click "Connect Wallet"
2. Select your wallet (MetaMask, WalletConnect, etc.)
3. Confirm wallet signature
4. Account created automatically

**Method 3: Telegram Login**
1. Click "Telegram Login"
2. Redirect to Telegram for confirmation
3. Auto-complete registration after authorization

**Complete Your Profile**
After registration, we recommend:
• Set nickname (for community interaction)
• Link Telegram (receive trading notifications)
• Enable 2FA (essential for account security)`
    },
    {
      titleZh: '第二步：绑定交易所 API',
      titleEn: 'Step 2: Connect Exchange API',
      contentZh: `**为什么需要绑定 API？**

API Key 是您授权 Hoot 代您在交易所执行交易的凭证。绑定后：
• Hoot 可以读取您的账户余额
• 在收到策略信号时自动下单
• 您的资金始终留在交易所账户

**支持的交易所**
• Binance（币安）- 全球最大交易所
• OKX（欧易）- 合约交易领先
• Bybit - 衍生品专业平台
• 更多交易所即将支持...

**绑定步骤**

1. 进入 Hoot「钱包」>「API 密钥管理」
2. 点击「添加 API Key」
3. 选择您的交易所
4. 按照页面指引，在交易所创建 API Key：
   - 登录交易所账户
   - 进入 API 管理页面
   - 创建新的 API Key
   - 设置权限：只开启"现货交易"和"合约交易"
   - 重要：不要开启"提现"权限！
5. 复制 API Key 和 Secret Key
6. 粘贴到 Hoot
7. 点击"测试连接"确认配置正确
8. 保存完成绑定`,
      contentEn: `**Why Connect API?**

API Key is your authorization for Hoot to execute trades on your behalf. After connecting:
• Hoot can read your account balance
• Automatically place orders when receiving strategy signals
• Your funds always stay in your exchange account

**Supported Exchanges**
• Binance - World's largest exchange
• OKX - Leading in futures trading
• Bybit - Professional derivatives platform
• More exchanges coming soon...

**Connection Steps**

1. Go to Hoot "Wallet" > "API Key Management"
2. Click "Add API Key"
3. Select your exchange
4. Follow the guide to create API Key on exchange:
   - Log in to exchange account
   - Go to API Management page
   - Create new API Key
   - Set permissions: Only enable "Spot Trading" and "Futures Trading"
   - Important: Do NOT enable "Withdrawal" permission!
5. Copy API Key and Secret Key
6. Paste into Hoot
7. Click "Test Connection" to confirm setup
8. Save to complete binding`
    },
    {
      titleZh: '第三步：充值 USDT',
      titleEn: 'Step 3: Deposit USDT',
      contentZh: `**为什么需要充值？**

Hoot 平台使用 USDT 作为结算货币，用于：
• 支付策略订阅费
• 支付盈利交易的燃油费
• 购买点卡享受优惠

**充值步骤**

1. 进入「钱包」>「充值」
2. 选择充值网络：
   - BNB Smart Chain (BSC) - 推荐，手续费最低
   - Tron (TRC20) - 手续费低
   - Ethereum (ERC20) - 手续费较高
3. 复制您的专属充值地址
4. 从您的钱包或交易所转账 USDT
5. 等待区块确认（通常 1-5 分钟）
6. 到账后会收到通知

**充值须知**
• 最低充值金额：10 USDT
• 只能充值 USDT，其他币种可能丢失
• 请确认网络一致，选错网络会导致资金丢失
• 首次充值建议小额测试`,
      contentEn: `**Why Deposit?**

Hoot platform uses USDT as settlement currency for:
• Paying strategy subscription fees
• Paying gas fees on profitable trades
• Purchasing point cards for discounts

**Deposit Steps**

1. Go to "Wallet" > "Deposit"
2. Select deposit network:
   - BNB Smart Chain (BSC) - Recommended, lowest fees
   - Tron (TRC20) - Low fees
   - Ethereum (ERC20) - Higher fees
3. Copy your unique deposit address
4. Transfer USDT from your wallet or exchange
5. Wait for block confirmation (usually 1-5 minutes)
6. You'll be notified when credited

**Deposit Notes**
• Minimum deposit: 10 USDT
• Only deposit USDT, other tokens may be lost
• Confirm network match, wrong network causes fund loss
• First deposit: recommend small test amount`
    },
    {
      titleZh: '第四步：订阅策略开始跟单',
      titleEn: 'Step 4: Subscribe and Start Copy Trading',
      contentZh: `**浏览策略市场**

1. 进入「策略」页面
2. 查看各策略的关键指标：
   - 收益率：7天/30天/90天累计收益
   - 最大回撤：历史最大亏损幅度
   - 胜率：盈利交易占比
   - 风险等级：低/中/高
3. 点击策略卡片查看详情

**选择策略的建议**
• 新手建议从低风险策略开始
• 不要只看收益率，也要看回撤
• 查看策略的历史交易记录
• 阅读策略说明了解交易逻辑

**订阅配置**

1. 点击「订阅」按钮
2. 选择要使用的 API Key（交易所账户）
3. 设置每单金额：
   - 建议：账户总资金的 5%-10%
   - 例如：账户 1000 USDT，每单 50-100 USDT
4. 设置最大持仓数：
   - 建议：3-5 个仓位
   - 控制同时持有的交易数量
5. 确认订阅费用
6. 点击「确认订阅」

**开始跟单**
订阅成功后，Hoot 会：
• 实时接收策略信号
• 自动在您的交易所账户下单
• 实时同步持仓和收益
• 发送交易通知到 Telegram`,
      contentEn: `**Browse Strategy Market**

1. Go to "Strategies" page
2. View key metrics for each strategy:
   - Returns: 7d/30d/90d cumulative returns
   - Max Drawdown: Historical maximum loss
   - Win Rate: Percentage of profitable trades
   - Risk Level: Low/Medium/High
3. Click strategy card for details

**Strategy Selection Tips**
• Beginners should start with low-risk strategies
• Don't only look at returns, also check drawdown
• Review strategy's historical trades
• Read strategy description to understand trading logic

**Subscription Configuration**

1. Click "Subscribe" button
2. Select API Key to use (exchange account)
3. Set amount per trade:
   - Recommended: 5%-10% of total account
   - Example: 1000 USDT account, 50-100 USDT per trade
4. Set max positions:
   - Recommended: 3-5 positions
   - Controls concurrent trades
5. Confirm subscription fee
6. Click "Confirm Subscription"

**Start Copy Trading**
After subscribing, Hoot will:
• Receive strategy signals in real-time
• Automatically place orders on your exchange
• Sync positions and P&L in real-time
• Send trade notifications to Telegram`
    },
    {
      titleZh: '重要安全提示',
      titleEn: 'Important Security Tips',
      contentZh: `在使用 Hoot 过程中，请务必注意以下安全事项：

**API Key 安全**
• 绝对不要开启提现权限
• 只在 Hoot 官方平台输入 API Key
• 定期检查 API Key 使用记录
• 如发现异常，立即删除 API Key

**账户安全**
• 开启两步验证（2FA）
• 使用强密码，不要与其他平台相同
• 不要在公共设备登录账户
• 定期检查账户活动

**资金安全**
• 只投入可承受损失的资金
• 不要将全部资金投入单一策略
• 保持合理的仓位大小
• 定期提取盈利

**防骗提示**
• Hoot 官方不会主动联系您索要密码或 API Key
• 警惕任何承诺高额固定收益的信息
• 只通过官方渠道下载 App`,
      contentEn: `Please pay attention to the following security matters when using Hoot:

**API Key Security**
• NEVER enable withdrawal permission
• Only enter API Key on official Hoot platform
• Regularly check API Key usage records
• Delete API Key immediately if suspicious activity

**Account Security**
• Enable two-factor authentication (2FA)
• Use strong password, different from other platforms
• Don't log in on public devices
• Regularly check account activity

**Fund Security**
• Only invest what you can afford to lose
• Don't put all funds in a single strategy
• Maintain reasonable position sizes
• Regularly withdraw profits

**Anti-Scam Tips**
• Hoot officials will never ask for passwords or API Keys
• Beware of promises of high fixed returns
• Only download App from official channels`,
      type: 'warning'
    }
  ]
}

// ============================================
// API 密钥管理 / API Key Management
// ============================================
export const apiKeys: HelpArticle = {
  slug: 'api-keys',
  titleZh: 'API 密钥管理',
  titleEn: 'API Key Management',
  descriptionZh: '安全绑定交易所，开始自动化交易',
  descriptionEn: 'Securely connect your exchange and start automated trading',
  sections: [
    {
      titleZh: '什么是 API Key？',
      titleEn: 'What is an API Key?',
      contentZh: `**API Key 基础知识**

API Key（应用程序接口密钥）是一组特殊的密码，允许第三方应用（如 Hoot）与您的交易所账户进行安全通信。

**API Key 的组成**
• API Key：公开标识符，类似用户名
• Secret Key：私密密钥，类似密码
• （部分交易所）Passphrase：额外的安全短语

**API Key 的权限类型**
• 只读权限：只能查看账户信息
• 交易权限：可以进行买卖操作
• 提现权限：可以提取资金（危险！不要开启）

**为什么 Hoot 需要 API Key？**
通过 API Key，Hoot 可以：
1. 读取您的交易所余额和持仓
2. 在收到策略信号时代您下单
3. 监控订单执行状态
4. 同步交易历史和收益

**您的资金安全吗？**
• 您的资金始终在交易所账户中
• Hoot 无法提取您的资金
• 您随时可以删除 API Key 终止授权`,
      contentEn: `**API Key Basics**

An API Key (Application Programming Interface Key) is a special set of credentials that allows third-party applications (like Hoot) to securely communicate with your exchange account.

**API Key Components**
• API Key: Public identifier, like a username
• Secret Key: Private key, like a password
• (Some exchanges) Passphrase: Additional security phrase

**API Key Permission Types**
• Read-only: Can only view account info
• Trading: Can execute buy/sell orders
• Withdrawal: Can withdraw funds (Dangerous! Don't enable)

**Why Does Hoot Need API Key?**
With API Key, Hoot can:
1. Read your exchange balance and positions
2. Place orders on your behalf when receiving signals
3. Monitor order execution status
4. Sync trade history and P&L

**Is Your Money Safe?**
• Your funds always stay in your exchange account
• Hoot cannot withdraw your funds
• You can delete API Key anytime to revoke access`
    },
    {
      titleZh: 'Binance API Key 创建教程',
      titleEn: 'Binance API Key Tutorial',
      contentZh: `**步骤一：登录 Binance**
1. 访问 www.binance.com
2. 登录您的账户
3. 完成安全验证

**步骤二：进入 API 管理**
1. 点击右上角头像
2. 选择「API 管理」
3. 或直接访问：binance.com/zh-CN/my/settings/api-management

**步骤三：创建 API Key**
1. 点击「创建 API」
2. 选择「系统生成」
3. 输入 API 标签（如：Hoot Trading）
4. 完成安全验证（邮箱+手机/2FA）

**步骤四：设置权限**
1. 勾选「启用现货和杠杆交易」
2. 勾选「启用合约」（如需要）
3. ❌ 不要勾选「启用提现」
4. 可选：设置 IP 白名单增加安全性

**步骤五：保存密钥**
1. 复制 API Key（页面上可见）
2. 复制 Secret Key（只显示一次！）
3. 安全保存，不要截图分享

**步骤六：绑定到 Hoot**
1. 打开 Hoot「钱包」>「API 密钥管理」
2. 点击「添加 API Key」
3. 选择 Binance
4. 粘贴 API Key 和 Secret Key
5. 点击「测试连接」
6. 显示成功后保存`,
      contentEn: `**Step 1: Login to Binance**
1. Visit www.binance.com
2. Login to your account
3. Complete security verification

**Step 2: Go to API Management**
1. Click profile icon top-right
2. Select "API Management"
3. Or visit: binance.com/en/my/settings/api-management

**Step 3: Create API Key**
1. Click "Create API"
2. Select "System Generated"
3. Enter API label (e.g., Hoot Trading)
4. Complete security verification (email + phone/2FA)

**Step 4: Set Permissions**
1. Check "Enable Spot & Margin Trading"
2. Check "Enable Futures" (if needed)
3. ❌ Do NOT check "Enable Withdrawals"
4. Optional: Set IP whitelist for extra security

**Step 5: Save Keys**
1. Copy API Key (visible on page)
2. Copy Secret Key (shown only once!)
3. Save securely, don't screenshot and share

**Step 6: Bind to Hoot**
1. Open Hoot "Wallet" > "API Key Management"
2. Click "Add API Key"
3. Select Binance
4. Paste API Key and Secret Key
5. Click "Test Connection"
6. Save after showing success`
    },
    {
      titleZh: 'OKX API Key 创建教程',
      titleEn: 'OKX API Key Tutorial',
      contentZh: `**步骤一：登录 OKX**
1. 访问 www.okx.com
2. 登录您的账户

**步骤二：进入 API 管理**
1. 点击右上角头像
2. 选择「API」
3. 进入 API 管理页面

**步骤三：创建 API Key**
1. 点击「创建 V5 API 密钥」
2. 输入 API 名称（如：Hoot Trading）
3. 设置密码（Passphrase）- 请记住！
4. 完成安全验证

**步骤四：设置权限**
1. 勾选「交易」权限
2. 在交易权限下勾选需要的：
   - 现货交易
   - 合约交易
   - 杠杆交易（如需要）
3. ❌ 不要勾选「提币」权限

**步骤五：保存密钥**
1. 复制 API Key
2. 复制 Secret Key
3. 记住 Passphrase
4. 三个都要保存好！

**步骤六：绑定到 Hoot**
1. 打开 Hoot「钱包」>「API 密钥管理」
2. 点击「添加 API Key」
3. 选择 OKX
4. 填入 API Key、Secret Key、Passphrase
5. 测试连接并保存`,
      contentEn: `**Step 1: Login to OKX**
1. Visit www.okx.com
2. Login to your account

**Step 2: Go to API Management**
1. Click profile icon top-right
2. Select "API"
3. Enter API management page

**Step 3: Create API Key**
1. Click "Create V5 API Key"
2. Enter API name (e.g., Hoot Trading)
3. Set Passphrase - remember it!
4. Complete security verification

**Step 4: Set Permissions**
1. Check "Trade" permission
2. Under trade permission, check:
   - Spot trading
   - Futures trading
   - Margin trading (if needed)
3. ❌ Do NOT check "Withdraw" permission

**Step 5: Save Keys**
1. Copy API Key
2. Copy Secret Key
3. Remember Passphrase
4. Save all three!

**Step 6: Bind to Hoot**
1. Open Hoot "Wallet" > "API Key Management"
2. Click "Add API Key"
3. Select OKX
4. Enter API Key, Secret Key, Passphrase
5. Test connection and save`
    },
    {
      titleZh: 'Bybit API Key 创建教程',
      titleEn: 'Bybit API Key Tutorial',
      contentZh: `**步骤一：登录 Bybit**
1. 访问 www.bybit.com
2. 登录您的账户

**步骤二：进入 API 管理**
1. 点击右上角头像
2. 选择「API」
3. 进入 API 管理页面

**步骤三：创建 API Key**
1. 点击「创建新密钥」
2. 选择「系统生成 API 密钥」
3. 输入 API 名称
4. 完成安全验证

**步骤四：设置权限**
1. API 交易类型选择「合约」和/或「现货」
2. 权限选择「读写」（可交易）
3. ❌ 不要选择「提币」权限
4. 可选：绑定 IP 地址

**步骤五：保存密钥**
1. 查看并复制 API Key
2. 查看并复制 Secret Key
3. 妥善保存

**步骤六：绑定到 Hoot**
1. 打开 Hoot「钱包」>「API 密钥管理」
2. 点击「添加 API Key」
3. 选择 Bybit
4. 填入 API Key 和 Secret Key
5. 测试连接并保存`,
      contentEn: `**Step 1: Login to Bybit**
1. Visit www.bybit.com
2. Login to your account

**Step 2: Go to API Management**
1. Click profile icon top-right
2. Select "API"
3. Enter API management page

**Step 3: Create API Key**
1. Click "Create New Key"
2. Select "System-generated API Keys"
3. Enter API name
4. Complete security verification

**Step 4: Set Permissions**
1. API Transaction: Select "Contract" and/or "Spot"
2. Permission: Select "Read-Write" (tradeable)
3. ❌ Do NOT select "Withdraw"
4. Optional: Bind IP address

**Step 5: Save Keys**
1. View and copy API Key
2. View and copy Secret Key
3. Save securely

**Step 6: Bind to Hoot**
1. Open Hoot "Wallet" > "API Key Management"
2. Click "Add API Key"
3. Select Bybit
4. Enter API Key and Secret Key
5. Test connection and save`
    },
    {
      titleZh: 'API Key 安全存储',
      titleEn: 'API Key Security Storage',
      contentZh: `**Hoot 的安全措施**

您的 API Key 在 Hoot 平台享受最高级别的安全保护：

**传输安全**
• 所有数据传输使用 HTTPS/TLS 1.3 加密
• 端到端加密，中间人无法截取

**存储安全**
• 使用 AES-256-GCM 军用级加密算法
• 加密密钥通过硬件安全模块（HSM）管理
• 每个用户的密钥独立加密

**访问控制**
• 多层身份验证
• 操作日志全程记录
• 异常访问实时告警

**合规审计**
• 定期第三方安全审计
• 渗透测试
• 漏洞扫描

即使是 Hoot 的工程师也无法查看您的原始 API Key。`,
      contentEn: `**Hoot's Security Measures**

Your API Key enjoys the highest level of security protection on Hoot platform:

**Transmission Security**
• All data transmission uses HTTPS/TLS 1.3 encryption
• End-to-end encryption, man-in-the-middle attacks prevented

**Storage Security**
• Uses AES-256-GCM military-grade encryption
• Encryption keys managed by Hardware Security Module (HSM)
• Each user's key encrypted independently

**Access Control**
• Multi-layer authentication
• Full operation logging
• Real-time abnormal access alerts

**Compliance Audit**
• Regular third-party security audits
• Penetration testing
• Vulnerability scanning

Even Hoot engineers cannot view your raw API Keys.`,
      type: 'success'
    },
    {
      titleZh: '常见问题排查',
      titleEn: 'Troubleshooting',
      contentZh: `**连接测试失败？**

1. 检查 API Key 和 Secret Key 是否复制完整
2. 确认没有多余的空格
3. 检查权限是否正确开启
4. 如有 Passphrase（OKX），确认输入正确

**提示"权限不足"？**

交易所可能需要额外开启权限：
• 确认勾选了"现货交易"
• 合约交易需单独开启
• 某些交易所需要完成 KYC

**API Key 被禁用？**

可能的原因：
• 输入错误次数过多
• 交易所检测到异常
• API Key 过期

解决方案：删除旧 API Key，重新创建

**如何删除 API Key？**

在 Hoot：
1. 进入「API 密钥管理」
2. 找到要删除的 API Key
3. 点击「删除」并确认

在交易所：
1. 进入 API 管理页面
2. 找到对应 API Key
3. 点击「删除」并完成验证`,
      contentEn: `**Connection Test Failed?**

1. Check if API Key and Secret Key copied completely
2. Confirm no extra spaces
3. Check if permissions are correctly enabled
4. If Passphrase exists (OKX), confirm correct input

**"Insufficient Permission" Error?**

Exchange may need additional permissions:
• Confirm "Spot Trading" is checked
• Futures trading needs separate enabling
• Some exchanges require KYC completion

**API Key Disabled?**

Possible reasons:
• Too many incorrect inputs
• Exchange detected anomaly
• API Key expired

Solution: Delete old API Key, create new one

**How to Delete API Key?**

On Hoot:
1. Go to "API Key Management"
2. Find the API Key to delete
3. Click "Delete" and confirm

On Exchange:
1. Go to API management page
2. Find corresponding API Key
3. Click "Delete" and complete verification`,
      type: 'info'
    }
  ]
}

// ============================================
// 策略使用指南 / Strategy Guide
// ============================================
export const strategies: HelpArticle = {
  slug: 'strategies',
  titleZh: '策略使用指南',
  titleEn: 'Strategy Guide',
  descriptionZh: '了解如何选择和配置量化交易策略',
  descriptionEn: 'Learn how to choose and configure quantitative trading strategies',
  sections: [
    {
      titleZh: '策略市场介绍',
      titleEn: 'Strategy Market Introduction',
      contentZh: `**什么是量化策略？**

量化策略是基于数学模型和算法的交易系统，通过分析市场数据自动生成买卖信号。与人工交易相比，量化策略具有：

• 纪律性：严格执行交易规则，不受情绪影响
• 及时性：毫秒级响应市场变化
• 一致性：相同条件下做出相同决策
• 可回测：历史数据验证策略有效性

**Hoot 策略特点**

Hoot 平台上的策略都经过严格筛选：

1. **专业团队打造**：由资深量化交易员和 AI 研究员开发
2. **严格回测验证**：至少 2 年历史数据回测
3. **实盘验证**：上线前经过真实资金测试
4. **持续优化**：根据市场变化动态调整
5. **风控机制**：内置止损止盈逻辑`,
      contentEn: `**What is a Quantitative Strategy?**

A quantitative strategy is a trading system based on mathematical models and algorithms that automatically generates buy/sell signals by analyzing market data. Compared to manual trading, quantitative strategies have:

• Discipline: Strictly follow trading rules, not affected by emotions
• Timeliness: Millisecond response to market changes
• Consistency: Same decisions under same conditions
• Backtestable: Historical data validates strategy effectiveness

**Hoot Strategy Features**

Strategies on Hoot platform are strictly selected:

1. **Built by Professional Teams**: Developed by senior quant traders and AI researchers
2. **Rigorous Backtesting**: At least 2 years of historical data backtest
3. **Live Verification**: Tested with real funds before launch
4. **Continuous Optimization**: Dynamically adjusted to market changes
5. **Risk Control**: Built-in stop-loss and take-profit logic`
    },
    {
      titleZh: '理解策略指标',
      titleEn: 'Understanding Strategy Metrics',
      contentZh: `**收益率指标**

• **7天收益率**：近7天累计收益百分比
• **30天收益率**：近30天累计收益
• **90天收益率**：近90天累计收益
• **总收益率**：策略运行以来总收益

**风险指标**

• **最大回撤**：历史上从峰值到谷底的最大跌幅
  - 例如：最大回撤 15% 表示最多亏损过本金的 15%
  - 回撤越小，策略越稳健

• **夏普比率**：风险调整后收益
  - >1 良好，>2 优秀，>3 卓越
  - 越高表示单位风险获得的回报越高

• **风险等级**：
  - 低风险：回撤 <10%，适合保守投资者
  - 中风险：回撤 10-20%，适合一般投资者
  - 高风险：回撤 >20%，适合激进投资者

**交易指标**

• **胜率**：盈利交易占比
  - 60% 表示 10 笔交易中 6 笔盈利

• **盈亏比**：平均盈利/平均亏损
  - >1.5 表示赚的比亏的多

• **交易频率**：每天/每周平均交易次数

• **平均持仓时间**：每笔交易持续时长`,
      contentEn: `**Return Metrics**

• **7-Day Return**: Cumulative return percentage in past 7 days
• **30-Day Return**: Cumulative return in past 30 days
• **90-Day Return**: Cumulative return in past 90 days
• **Total Return**: Total return since strategy inception

**Risk Metrics**

• **Max Drawdown**: Maximum drop from peak to trough historically
  - E.g., 15% max drawdown means lost up to 15% of principal
  - Lower drawdown = more stable strategy

• **Sharpe Ratio**: Risk-adjusted return
  - >1 Good, >2 Excellent, >3 Outstanding
  - Higher means better return per unit of risk

• **Risk Level**:
  - Low Risk: Drawdown <10%, for conservative investors
  - Medium Risk: Drawdown 10-20%, for general investors
  - High Risk: Drawdown >20%, for aggressive investors

**Trading Metrics**

• **Win Rate**: Percentage of profitable trades
  - 60% means 6 out of 10 trades profitable

• **Profit/Loss Ratio**: Average profit / Average loss
  - >1.5 means earning more than losing

• **Trade Frequency**: Average trades per day/week

• **Avg Holding Time**: Duration of each trade`
    },
    {
      titleZh: '如何选择适合的策略',
      titleEn: 'How to Choose the Right Strategy',
      contentZh: `**根据风险偏好选择**

**保守型投资者**（本金安全第一）
• 选择低风险策略
• 最大回撤 <10%
• 收益稳定但可能不高
• 适合大资金、长期持有

**稳健型投资者**（追求稳定收益）
• 选择中低风险策略
• 最大回撤 10-15%
• 收益和风险平衡
• 适合大多数投资者

**进取型投资者**（追求高收益）
• 可选择中高风险策略
• 能承受 15-25% 回撤
• 潜在收益较高
• 需要更多关注和调整

**策略组合建议**

不要把所有资金投入单一策略！建议：

1. **核心配置（60-70%）**：1-2 个稳健型策略
2. **卫星配置（20-30%）**：1 个进取型策略
3. **现金储备（10%）**：应对市场波动

**选策略的注意事项**

• 新策略观察期：先小额订阅观察 1-2 周
• 避免追涨：不要只看近期高收益
• 分散投资：至少订阅 2-3 个不相关策略
• 定期评估：每月检查策略表现`,
      contentEn: `**Choose Based on Risk Preference**

**Conservative Investors** (Principal safety first)
• Choose low-risk strategies
• Max drawdown <10%
• Stable but potentially lower returns
• Suitable for large funds, long-term holding

**Balanced Investors** (Pursuing stable returns)
• Choose low-medium risk strategies
• Max drawdown 10-15%
• Balanced risk and return
• Suitable for most investors

**Aggressive Investors** (Pursuing high returns)
• Can choose medium-high risk strategies
• Can tolerate 15-25% drawdown
• Higher potential returns
• Requires more attention and adjustment

**Portfolio Recommendations**

Don't put all funds in a single strategy! Suggest:

1. **Core Allocation (60-70%)**: 1-2 stable strategies
2. **Satellite Allocation (20-30%)**: 1 aggressive strategy
3. **Cash Reserve (10%)**: Handle market volatility

**Strategy Selection Notes**

• New Strategy: Small subscription to observe 1-2 weeks first
• Avoid Chasing: Don't only look at recent high returns
• Diversify: Subscribe to at least 2-3 uncorrelated strategies
• Regular Review: Check strategy performance monthly`
    },
    {
      titleZh: '订阅配置详解',
      titleEn: 'Subscription Configuration Details',
      contentZh: `**选择 API Key**

选择要用于该策略的交易所账户：
• 一个策略只能绑定一个 API Key
• 同一 API Key 可以订阅多个策略
• 建议不同策略使用不同账户便于管理

**设置每单金额**

每单金额是每次交易投入的 USDT 数量：

• **建议设置**：账户总资金的 5-10%
• **最小金额**：10 USDT
• **示例**：账户 1000 USDT → 每单 50-100 USDT

**计算公式**：
\`\`\`
每单金额 = 账户资金 × 风险系数
保守：5%，稳健：7-8%，激进：10%
\`\`\`

**设置最大持仓**

最大持仓是同时允许的最大仓位数：

• **建议设置**：3-5 个
• **作用**：控制风险暴露
• **示例**：最大 5 仓，每单 100 USDT = 最大占用 500 USDT

**注意**：
• 持仓数越多，资金占用越大
• 市场波动大时建议减少持仓数

**高级设置（可选）**

• **止损比例**：亏损达到多少自动平仓
• **止盈比例**：盈利达到多少自动平仓
• **跟随倍数**：相对策略放大或缩小交易量`,
      contentEn: `**Select API Key**

Choose exchange account for this strategy:
• One strategy binds to one API Key
• Same API Key can subscribe to multiple strategies
• Recommend different accounts for different strategies for management

**Set Amount Per Trade**

Amount per trade is USDT invested in each trade:

• **Recommended**: 5-10% of total account
• **Minimum**: 10 USDT
• **Example**: 1000 USDT account → 50-100 USDT per trade

**Formula**:
\`\`\`
Amount per trade = Account funds × Risk factor
Conservative: 5%, Balanced: 7-8%, Aggressive: 10%
\`\`\`

**Set Max Positions**

Max positions is maximum concurrent positions allowed:

• **Recommended**: 3-5
• **Purpose**: Control risk exposure
• **Example**: Max 5 positions, 100 USDT each = Max 500 USDT used

**Notes**:
• More positions = more capital tied up
• Reduce positions during high volatility

**Advanced Settings (Optional)**

• **Stop Loss %**: Auto-close when loss reaches threshold
• **Take Profit %**: Auto-close when profit reaches threshold
• **Follow Multiplier**: Scale trade size relative to strategy`
    },
    {
      titleZh: '实用小贴士',
      titleEn: 'Practical Tips',
      contentZh: `**新手建议**

1. 从小额开始：先用 10-20% 资金测试
2. 选择成熟策略：运行超过 3 个月的
3. 保持耐心：不要因为短期波动退订
4. 多学习：了解策略的交易逻辑

**资金管理**

• 只用闲钱投资
• 预留 20% 资金作为安全边际
• 盈利后定期提取部分利润
• 亏损后不要冲动加仓

**监控与调整**

• 每天查看持仓和收益
• 每周评估策略表现
• 连续亏损时考虑减少仓位
• 市场剧烈波动时谨慎操作

**常见误区**

❌ 频繁订阅/退订策略
❌ 只看收益率不看回撤
❌ 把全部资金投入单一策略
❌ 忽视止损设置`,
      contentEn: `**Beginner Recommendations**

1. Start Small: Test with 10-20% of funds first
2. Choose Mature Strategies: Running for over 3 months
3. Be Patient: Don't unsubscribe due to short-term volatility
4. Keep Learning: Understand strategy trading logic

**Capital Management**

• Only invest discretionary funds
• Reserve 20% as safety margin
• Periodically withdraw some profits
• Don't impulsively add positions after losses

**Monitoring & Adjustment**

• Check positions and P&L daily
• Evaluate strategy performance weekly
• Consider reducing positions during consecutive losses
• Be cautious during market volatility

**Common Mistakes**

❌ Frequently subscribe/unsubscribe strategies
❌ Only looking at returns, ignoring drawdown
❌ Putting all funds in single strategy
❌ Ignoring stop-loss settings`,
      type: 'tip'
    }
  ]
}

// ============================================
// 安全设置 / Security Settings
// ============================================
export const security: HelpArticle = {
  slug: 'security',
  titleZh: '安全设置指南',
  titleEn: 'Security Settings Guide',
  descriptionZh: '保护您的账户和资产安全',
  descriptionEn: 'Protect your account and asset security',
  sections: [
    {
      titleZh: '账户安全概述',
      titleEn: 'Account Security Overview',
      contentZh: `**Hoot 安全架构**

Hoot 采用银行级安全架构，多层保护您的账户和资产：

**身份验证层**
• 密码验证
• 两步验证（2FA）
• 登录行为分析
• 异常登录告警

**数据安全层**
• AES-256-GCM 加密存储
• TLS 1.3 传输加密
• 密钥分离存储
• 定期安全审计

**API 安全层**
• 只读/交易权限分离
• 禁止提现操作
• IP 白名单支持
• 操作日志记录

**运营安全**
• 7×24 安全监控
• DDoS 防护
• 入侵检测系统
• 灾难恢复机制

**您的责任**

安全是双向的，您也需要：
• 设置强密码
• 开启两步验证
• 保护好 API Key
• 定期检查账户`,
      contentEn: `**Hoot Security Architecture**

Hoot employs bank-grade security architecture with multiple layers protecting your account and assets:

**Identity Verification Layer**
• Password verification
• Two-factor authentication (2FA)
• Login behavior analysis
• Abnormal login alerts

**Data Security Layer**
• AES-256-GCM encrypted storage
• TLS 1.3 transport encryption
• Key separation storage
• Regular security audits

**API Security Layer**
• Read-only/Trading permission separation
• Withdrawal operations prohibited
• IP whitelist support
• Operation logging

**Operational Security**
• 24/7 security monitoring
• DDoS protection
• Intrusion detection system
• Disaster recovery mechanism

**Your Responsibility**

Security is two-way, you also need to:
• Set strong password
• Enable two-factor authentication
• Protect your API Keys
• Regularly check account`
    },
    {
      titleZh: '两步验证（2FA）设置',
      titleEn: 'Two-Factor Authentication (2FA) Setup',
      contentZh: `**什么是两步验证？**

两步验证（2FA）是除密码外的第二层安全验证。即使密码泄露，没有 2FA 验证码也无法登录账户。

**支持的 2FA 方式**

1. **Google Authenticator（推荐）**
   - 动态 6 位验证码
   - 离线可用
   - 最安全

2. **短信验证**
   - 发送到手机的验证码
   - 备用方案

**开启步骤**

1. 下载 Google Authenticator App
   - iOS: App Store 搜索
   - Android: Google Play 或应用商店

2. 进入 Hoot 安全设置
   - 点击「设置」>「安全设置」
   - 选择「两步验证」

3. 扫描二维码
   - 用 Authenticator 扫描页面二维码
   - 或手动输入密钥

4. 输入验证码确认
   - 输入 App 显示的 6 位数字
   - 验证成功即开启

**重要：备份恢复码**

开启 2FA 时会显示恢复码：
• 截图或抄写保存
• 用于手机丢失时恢复账户
• 不要告诉任何人`,
      contentEn: `**What is Two-Factor Authentication?**

Two-factor authentication (2FA) is a second layer of security beyond your password. Even if password is leaked, account cannot be accessed without 2FA code.

**Supported 2FA Methods**

1. **Google Authenticator (Recommended)**
   - Dynamic 6-digit code
   - Works offline
   - Most secure

2. **SMS Verification**
   - Code sent to phone
   - Backup option

**Setup Steps**

1. Download Google Authenticator App
   - iOS: Search in App Store
   - Android: Google Play or app store

2. Go to Hoot Security Settings
   - Click "Settings" > "Security Settings"
   - Select "Two-Factor Authentication"

3. Scan QR Code
   - Scan page QR code with Authenticator
   - Or manually enter secret key

4. Enter Code to Confirm
   - Enter 6-digit number from App
   - Successfully enabled after verification

**Important: Backup Recovery Codes**

Recovery codes shown when enabling 2FA:
• Screenshot or write down to save
• Used to recover account if phone is lost
• Don't tell anyone`,
      type: 'info'
    },
    {
      titleZh: '密码安全最佳实践',
      titleEn: 'Password Security Best Practices',
      contentZh: `**强密码标准**

一个安全的密码应该：
• 长度：至少 12 位（越长越好）
• 复杂度：包含大写字母、小写字母、数字、符号
• 独特性：不要与其他平台使用相同密码
• 随机性：避免使用个人信息

**密码生成建议**

好的密码示例：
✅ Hk9#mP2x$vL5nQ8
✅ Blue-Mountain-7492!
✅ 使用密码管理器生成

避免使用：
❌ 123456, password
❌ 生日、电话号码
❌ 连续键盘字符（qwerty）
❌ 与用户名相似

**密码管理建议**

• 使用密码管理器（1Password, Bitwarden 等）
• 定期更换密码（建议 3-6 个月）
• 不同平台使用不同密码
• 启用登录提醒功能

**密码泄露怎么办？**

1. 立即修改 Hoot 密码
2. 检查并修改其他使用相同密码的平台
3. 检查账户是否有异常操作
4. 联系客服报告情况`,
      contentEn: `**Strong Password Standards**

A secure password should:
• Length: At least 12 characters (longer is better)
• Complexity: Include uppercase, lowercase, numbers, symbols
• Uniqueness: Don't reuse passwords across platforms
• Randomness: Avoid using personal information

**Password Generation Tips**

Good password examples:
✅ Hk9#mP2x$vL5nQ8
✅ Blue-Mountain-7492!
✅ Use password manager to generate

Avoid using:
❌ 123456, password
❌ Birthday, phone number
❌ Sequential keyboard chars (qwerty)
❌ Similar to username

**Password Management Tips**

• Use password manager (1Password, Bitwarden, etc.)
• Change password regularly (recommend 3-6 months)
• Different passwords for different platforms
• Enable login notifications

**What If Password Is Leaked?**

1. Change Hoot password immediately
2. Check and change other platforms with same password
3. Check account for abnormal activities
4. Contact support to report`
    },
    {
      titleZh: 'API Key 安全管理',
      titleEn: 'API Key Security Management',
      contentZh: `**API Key 安全原则**

1. **最小权限原则**
   - 只开启必要的权限
   - 绝不开启提现权限
   - 按需开启现货/合约

2. **IP 限制（推荐）**
   - 在交易所设置 IP 白名单
   - 只允许 Hoot 服务器 IP
   - 联系客服获取 IP 列表

3. **定期轮换**
   - 建议每 3-6 个月更换
   - 删除不再使用的 API Key
   - 保持最少数量的活跃 Key

**安全检查清单**

定期检查以下事项：
□ API Key 权限是否最小化
□ 是否设置了 IP 白名单
□ 最近是否有异常交易
□ 是否有不认识的 API Key

**发现异常怎么办？**

1. 立即删除可疑 API Key
2. 检查交易所交易记录
3. 修改账户密码
4. 联系 Hoot 和交易所客服`,
      contentEn: `**API Key Security Principles**

1. **Least Privilege Principle**
   - Only enable necessary permissions
   - NEVER enable withdrawal permission
   - Enable spot/futures as needed

2. **IP Restriction (Recommended)**
   - Set IP whitelist on exchange
   - Only allow Hoot server IPs
   - Contact support for IP list

3. **Regular Rotation**
   - Recommend changing every 3-6 months
   - Delete unused API Keys
   - Keep minimum number of active Keys

**Security Checklist**

Regularly check:
□ Are API Key permissions minimized
□ Is IP whitelist configured
□ Any abnormal trades recently
□ Any unrecognized API Keys

**What If Anomaly Detected?**

1. Immediately delete suspicious API Key
2. Check exchange trade history
3. Change account password
4. Contact Hoot and exchange support`,
      type: 'warning'
    },
    {
      titleZh: '防骗指南',
      titleEn: 'Anti-Scam Guide',
      contentZh: `**常见骗局类型**

1. **假冒官方**
   - 假客服主动联系要密码/API Key
   - 假官方群发布钓鱼链接
   - 假 App 窃取信息

2. **高额回报诱惑**
   - 承诺固定高收益（每天 x%）
   - 内幕消息、稳赚策略
   - 拉人头返佣

3. **钓鱼网站**
   - 域名相似的假网站
   - 诱导输入账号密码
   - 诱导下载恶意软件

**如何识别诈骗？**

• Hoot 官方绝不会主动索要密码或 API Key
• 任何承诺 100% 赚钱的都是骗局
• 仔细检查网址是否正确
• 不要点击陌生链接

**官方渠道**

只信任以下官方渠道：
• 官网：hoot.trade
• Telegram：@hoot_official
• 邮箱：support@hoot.trade

**遭遇诈骗怎么办？**

1. 停止一切操作
2. 修改密码和 API Key
3. 保留证据（截图、记录）
4. 联系官方客服
5. 必要时报警处理`,
      contentEn: `**Common Scam Types**

1. **Impersonation**
   - Fake support asking for password/API Key
   - Fake official groups posting phishing links
   - Fake Apps stealing information

2. **High Return Lure**
   - Promise fixed high returns (x% daily)
   - Insider info, guaranteed strategies
   - Referral pyramid schemes

3. **Phishing Websites**
   - Fake websites with similar domains
   - Trick you into entering credentials
   - Trick you into downloading malware

**How to Identify Scams?**

• Hoot officials will NEVER ask for password or API Key
• Any promise of 100% profit is a scam
• Carefully check if URL is correct
• Don't click unknown links

**Official Channels**

Only trust these official channels:
• Website: hoot.trade
• Telegram: @hoot_official
• Email: support@hoot.trade

**What If Scammed?**

1. Stop all operations
2. Change password and API Keys
3. Save evidence (screenshots, records)
4. Contact official support
5. Report to police if necessary`,
      type: 'warning'
    }
  ]
}

// ============================================
// 充值与提现 / Deposits & Withdrawals
// ============================================
export const depositsWithdrawals: HelpArticle = {
  slug: 'deposits-withdrawals',
  titleZh: '充值与提现',
  titleEn: 'Deposits & Withdrawals',
  descriptionZh: '了解如何充值和提现资金',
  descriptionEn: 'Learn how to deposit and withdraw funds',
  sections: [
    {
      titleZh: '充值说明',
      titleEn: 'Deposit Instructions',
      contentZh: `**支持的币种**

目前 Hoot 仅支持 USDT 充值，用于：
• 支付策略订阅费
• 支付盈利交易的燃油费（Gas Fee）
• 购买点卡

**支持的区块链网络**

| 网络 | 确认时间 | 建议 |
|------|---------|------|
| BNB Smart Chain (BSC) | 1-3 分钟 | ⭐ 推荐，费用最低 |
| Tron (TRC20) | 1-3 分钟 | 费用较低 |
| Ethereum (ERC20) | 5-10 分钟 | 费用较高 |
| Polygon | 1-3 分钟 | 费用低 |

**充值限额**

• 最低充值：10 USDT
• 单次上限：100,000 USDT
• 每日上限：无限制

**到账时间**

• BSC/Tron：通常 1-5 分钟
• Ethereum：通常 5-15 分钟
• 网络拥堵时可能延迟`,
      contentEn: `**Supported Currencies**

Currently Hoot only supports USDT deposits, used for:
• Paying strategy subscription fees
• Paying gas fees on profitable trades
• Purchasing point cards

**Supported Blockchain Networks**

| Network | Confirmation Time | Recommendation |
|---------|------------------|----------------|
| BNB Smart Chain (BSC) | 1-3 min | ⭐ Recommended, lowest fees |
| Tron (TRC20) | 1-3 min | Low fees |
| Ethereum (ERC20) | 5-10 min | Higher fees |
| Polygon | 1-3 min | Low fees |

**Deposit Limits**

• Minimum deposit: 10 USDT
• Single limit: 100,000 USDT
• Daily limit: Unlimited

**Arrival Time**

• BSC/Tron: Usually 1-5 minutes
• Ethereum: Usually 5-15 minutes
• May delay during network congestion`
    },
    {
      titleZh: '充值操作步骤',
      titleEn: 'Deposit Steps',
      contentZh: `**步骤一：获取充值地址**

1. 登录 Hoot 账户
2. 进入「钱包」页面
3. 点击「充值」按钮
4. 选择充值网络（建议 BSC）
5. 复制显示的充值地址

**步骤二：从钱包/交易所转账**

**从 MetaMask 转账：**
1. 打开 MetaMask
2. 切换到对应网络（如 BSC）
3. 选择 USDT
4. 点击「发送」
5. 粘贴 Hoot 充值地址
6. 输入金额
7. 确认交易

**从交易所提现：**
1. 登录交易所
2. 进入提现页面
3. 选择 USDT
4. 选择对应网络（必须一致！）
5. 粘贴 Hoot 充值地址
6. 输入金额
7. 完成安全验证

**步骤三：等待到账**

• 转账成功后等待区块确认
• 可在「钱包」>「充值记录」查看状态
• 到账后会收到通知`,
      contentEn: `**Step 1: Get Deposit Address**

1. Login to Hoot account
2. Go to "Wallet" page
3. Click "Deposit" button
4. Select deposit network (BSC recommended)
5. Copy the displayed deposit address

**Step 2: Transfer from Wallet/Exchange**

**From MetaMask:**
1. Open MetaMask
2. Switch to corresponding network (e.g., BSC)
3. Select USDT
4. Click "Send"
5. Paste Hoot deposit address
6. Enter amount
7. Confirm transaction

**From Exchange:**
1. Login to exchange
2. Go to withdrawal page
3. Select USDT
4. Select corresponding network (must match!)
5. Paste Hoot deposit address
6. Enter amount
7. Complete security verification

**Step 3: Wait for Arrival**

• Wait for block confirmation after transfer
• Check status in "Wallet" > "Deposit History"
• Notification sent when credited`
    },
    {
      titleZh: '提现说明',
      titleEn: 'Withdrawal Instructions',
      contentZh: `**提现流程**

1. 提交提现申请
2. 系统审核（24 小时内）
3. 审核通过后自动发放
4. 区块确认后到账

**提现限额**

• 最低提现：20 USDT
• 单次上限：50,000 USDT
• 每日上限：100,000 USDT

**提现手续费**

| 网络 | 手续费 |
|------|--------|
| BSC | 1 USDT |
| Tron | 1 USDT |
| Ethereum | 5 USDT |
| Polygon | 0.5 USDT |

**审核时间**

• 普通提现：24 小时内
• 大额提现（>10,000 USDT）：可能需要额外审核
• 节假日可能延迟`,
      contentEn: `**Withdrawal Process**

1. Submit withdrawal request
2. System review (within 24 hours)
3. Auto-release after approval
4. Credited after block confirmation

**Withdrawal Limits**

• Minimum withdrawal: 20 USDT
• Single limit: 50,000 USDT
• Daily limit: 100,000 USDT

**Withdrawal Fees**

| Network | Fee |
|---------|-----|
| BSC | 1 USDT |
| Tron | 1 USDT |
| Ethereum | 5 USDT |
| Polygon | 0.5 USDT |

**Review Time**

• Normal withdrawal: Within 24 hours
• Large withdrawal (>10,000 USDT): May need extra review
• May delay on holidays`
    },
    {
      titleZh: '重要注意事项',
      titleEn: 'Important Notes',
      contentZh: `**充值注意**

⚠️ 务必确认网络一致
• 选择 BSC 网络就只能从 BSC 转账
• 网络不一致可能导致资金丢失
• 丢失的资金无法找回

⚠️ 只充值 USDT
• 充值其他代币可能丢失
• 只支持官方 USDT 合约地址

⚠️ 检查地址正确性
• 仔细核对充值地址
• 建议第一次小额测试

**提现注意**

⚠️ 地址务必正确
• 提现到错误地址无法追回
• 建议使用地址簿功能
• 大额提现前小额测试

⚠️ 网络选择
• 确保接收地址支持该网络
• 选错网络可能导致资金丢失`,
      contentEn: `**Deposit Notes**

⚠️ Ensure network matches
• BSC network only accepts BSC transfers
• Mismatched network may cause fund loss
• Lost funds cannot be recovered

⚠️ Only deposit USDT
• Other tokens may be lost
• Only supports official USDT contract address

⚠️ Verify address correctness
• Double-check deposit address
• Recommend small test amount first time

**Withdrawal Notes**

⚠️ Address must be correct
• Cannot recover funds sent to wrong address
• Recommend using address book feature
• Small test before large withdrawals

⚠️ Network selection
• Ensure receiving address supports the network
• Wrong network may cause fund loss`,
      type: 'warning'
    }
  ]
}

// ============================================
// 计费说明 / Billing Information
// ============================================
export const billing: HelpArticle = {
  slug: 'billing',
  titleZh: '计费说明',
  titleEn: 'Billing Information',
  descriptionZh: '了解 Hoot 的收费模式和费用计算',
  descriptionEn: 'Understand Hoot\'s pricing model and fee calculation',
  sections: [
    {
      titleZh: '收费模式概览',
      titleEn: 'Pricing Model Overview',
      contentZh: `**Hoot 的透明收费原则**

Hoot 采用简单透明的收费模式，让您清楚每一分钱花在哪里。

**两种收费类型**

1. **策略订阅费**
   - 按月收取的固定费用
   - 不同策略价格不同
   - 用于使用策略信号

2. **燃油费（Gas Fee）**
   - 只在盈利时收取
   - 费率：盈利的 20%
   - 亏损交易不收费

**没有的费用**

✓ 无充值手续费
✓ 无平台管理费
✓ 无隐藏费用
✓ 无最低消费`,
      contentEn: `**Hoot's Transparent Pricing Principle**

Hoot uses a simple and transparent pricing model so you know where every cent goes.

**Two Fee Types**

1. **Strategy Subscription Fee**
   - Fixed monthly fee
   - Different prices for different strategies
   - For using strategy signals

2. **Gas Fee**
   - Only charged on profits
   - Rate: 20% of profit
   - No charge for losing trades

**No Hidden Fees**

✓ No deposit fees
✓ No platform management fees
✓ No hidden charges
✓ No minimum spend`
    },
    {
      titleZh: '策略订阅费详解',
      titleEn: 'Strategy Subscription Fee Details',
      contentZh: `**订阅费计算**

每个策略有独立的月订阅费，通常在 10-100 USDT/月。

**订阅周期**
• 周期：30 天
• 起算：从订阅成功时刻开始
• 到期：30 天后的同一时刻

**示例**
订阅费：25 USDT/月
订阅时间：1月15日 14:00
有效期至：2月14日 14:00

**支付方式**

1. **USDT 余额**：直接扣除
2. **点卡余额**：1:1 抵扣
3. **优先级**：先扣点卡，不足部分扣 USDT

**续费方式**

• **自动续费**：到期前自动扣费续订
• **手动续费**：到期后手动订阅
• **取消订阅**：到期后停止跟单

**退订说明**

• 订阅期内可随时退订
• 退订后持续有效至周期结束
• 不支持按天退款`,
      contentEn: `**Subscription Fee Calculation**

Each strategy has independent monthly subscription fee, typically 10-100 USDT/month.

**Subscription Period**
• Period: 30 days
• Start: From successful subscription moment
• End: Same time 30 days later

**Example**
Subscription fee: 25 USDT/month
Subscribe time: Jan 15, 14:00
Valid until: Feb 14, 14:00

**Payment Methods**

1. **USDT Balance**: Direct deduction
2. **Point Card Balance**: 1:1 deduction
3. **Priority**: Points first, then USDT for remainder

**Renewal Options**

• **Auto-renew**: Auto-deduct before expiration
• **Manual renewal**: Manual subscribe after expiration
• **Unsubscribe**: Stop copy trading after expiration

**Unsubscribe Notes**

• Can unsubscribe anytime during subscription
• Remains active until period ends after unsubscribing
• No pro-rated refunds`
    },
    {
      titleZh: '燃油费（Gas Fee）详解',
      titleEn: 'Gas Fee Details',
      contentZh: `**什么是燃油费？**

燃油费是 Hoot 的核心收费机制，代表我们与您利益一致的承诺：

**只在您赚钱时，我们才收费。**

**计算方式**

燃油费 = 盈利金额 × 20%

**示例**
开仓金额：100 USDT
平仓金额：120 USDT
盈利：20 USDT
燃油费：20 × 20% = 4 USDT
您的实际盈利：20 - 4 = 16 USDT

**收取时机**

• 盈利交易平仓时自动扣除
• 从交易利润中扣除
• 不影响您的本金

**不收费的情况**

✓ 亏损交易：不收任何费用
✓ 持平交易：不收任何费用
✓ 未平仓交易：未结算不收费

**为什么这样收费？**

传统平台无论盈亏都收费，而 Hoot 只在您盈利时收费。这意味着：
• 我们有动力让策略更好
• 您亏损时我们也没收入
• 真正的利益共同体`,
      contentEn: `**What is Gas Fee?**

Gas fee is Hoot's core charging mechanism, representing our commitment to aligned interests:

**We only charge when you profit.**

**Calculation**

Gas Fee = Profit Amount × 20%

**Example**
Open position: 100 USDT
Close position: 120 USDT
Profit: 20 USDT
Gas fee: 20 × 20% = 4 USDT
Your actual profit: 20 - 4 = 16 USDT

**When Charged**

• Auto-deducted when closing profitable trade
• Deducted from trade profit
• Doesn't affect your principal

**No Charge Situations**

✓ Losing trades: No charge at all
✓ Break-even trades: No charge at all
✓ Open positions: Not settled, no charge

**Why This Model?**

Traditional platforms charge regardless of P&L, but Hoot only charges on profits. This means:
• We're motivated to improve strategies
• When you lose, we have no income either
• True partnership`,
      type: 'success'
    },
    {
      titleZh: '点卡系统',
      titleEn: 'Point Card System',
      contentZh: `**什么是点卡？**

点卡是 Hoot 的预付费积分系统，1 点卡 = 1 USDT。

**点卡用途**
• 支付策略订阅费
• 支付燃油费
• 参与平台活动

**如何获得点卡？**

1. **充值赠送**：不定期活动
2. **邀请返佣**：邀请好友获得点卡
3. **活动奖励**：参与平台活动

**点卡使用规则**

• 优先使用：消费时自动优先扣除点卡
• 不可提现：点卡只能消费，不能提现
• 无有效期：点卡永久有效
• 不可转让：不支持点卡转让

**查看点卡余额**

进入「钱包」页面，可以看到：
• USDT 余额
• 点卡余额
• 消费记录`,
      contentEn: `**What are Point Cards?**

Point cards are Hoot's prepaid credit system, 1 Point = 1 USDT.

**Point Card Uses**
• Pay strategy subscription fees
• Pay gas fees
• Participate in platform activities

**How to Get Points?**

1. **Deposit Bonus**: Periodic promotions
2. **Referral Commission**: Invite friends for points
3. **Activity Rewards**: Participate in events

**Point Card Rules**

• Priority Usage: Auto-deducted first when spending
• Non-withdrawable: Points for spending only, cannot withdraw
• No Expiration: Points are permanently valid
• Non-transferable: Cannot transfer points

**Check Point Balance**

Go to "Wallet" page to see:
• USDT Balance
• Point Card Balance
• Transaction History`,
      type: 'info'
    }
  ]
}

// 导出所有帮助文章
export const helpArticles: Record<string, HelpArticle> = {
  'getting-started': gettingStarted,
  'api-keys': apiKeys,
  'strategies': strategies,
  'security': security,
  'deposits-withdrawals': depositsWithdrawals,
  'billing': billing
}
