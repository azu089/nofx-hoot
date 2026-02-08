/**
 * HOOT Telegram Bot 多语言支持
 * 支持语言: 中文 (zh), English (en)
 */

export type Language = 'zh' | 'en';

// 语言模板类型
export interface LocaleMessages {
  // 通用
  error: string;
  retry: string;
  success: string;
  failed: string;

  // 主菜单按钮
  menu: {
    wallet: string;
    trade: string;
    checkin: string;
    invite: string;
    closeAll: string;
    joinGroup: string;
    channel: string;
    switchLang: string;
    help: string;
  };

  // /start 命令
  start: {
    welcomeNew: string;
    welcomeBack: string;
    loginFailed: string;
  };

  // /help 命令
  help: {
    title: string;
    commands: string;
    notifications: string;
  };

  // /checkin 命令
  checkin: {
    success: string;
    alreadyChecked: string;
    streak7: string;
    streakTip: string;
    failed: string;
  };

  // /invite 命令
  invite: {
    title: string;
    code: string;
    invited: string;
    totalReward: string;
    perInvite: string;
    inviteeGet: string;
    link: string;
    share: string;
    shareBot: string;
    copyCode: string;
    shareText: string;
    failed: string;
  };

  // /wallet 命令（合并 status + balance + exchange）
  wallet: {
    title: string;
    platformSection: string;
    usdt: string;
    hoot: string;
    point: string;
    hootNotice: string;
    exchangeSection: string;
    total: string;
    spot: string;
    futures: string;
    noApiKey: string;
    queryFailed: string;
    failed: string;
  };

  // /trade 命令（合并 positions + earnings + mystrategies）
  trade: {
    title: string;
    // 持仓区
    positionsSection: string;
    noPositions: string;
    positionEntry: string;
    positionAmount: string;
    // 收益区
    earningsSection: string;
    today: string;
    total: string;
    trades: string;
    winRate: string;
    // 策略区
    strategiesSection: string;
    noStrategies: string;
    active: string;
    paused: string;
    strategyAmount: string;
    // 子面板按钮
    btnHistory: string;
    btnLogs: string;
    btnManage: string;
    btnCloseAll: string;
    // 启停
    toggleOn: string;
    toggleOff: string;
    toggleSuccess: string;
    toggleFailed: string;
    failed: string;
  };

  // 交易记录（/trade 子面板）
  history: {
    title: string;
    empty: string;
    entry: string;
    close: string;
    pnl: string;
    reason: string;
    failed: string;
    btnBack: string;
  };

  // 执行日志（/trade 子面板）
  logs: {
    title: string;
    empty: string;
    failed: string;
    btnBack: string;
  };

  // /closeall 命令
  closeAll: {
    title: string;
    confirm: string;
    warning: string;
    selectKey: string;
    noApiKey: string;
    executing: string;
    success: string;
    noPositions: string;
    cancelled: string;
    failed: string;
    btnConfirm: string;
    btnCancel: string;
  };

  // /bind 命令
  bind: {
    alreadyBound: string;
    howTo: string;
    steps: string;
    success: string;
    nowCanUse: string;
    failed: string;
    newUserHint: string;
  };

  // /lang 命令
  lang: {
    current: string;
    switchTo: string;
    switched: string;
    chinese: string;
    english: string;
  };

  // 交易通知（HTTP 推送）
  tradeNotify: {
    openTitle: string;
    closeTitle: string;
    symbol: string;
    side: string;
    price: string;
    amount: string;
    pnl: string;
    strategy: string;
  };

  // 未知命令
  unknownCommand: string;
}

// ==================== 中文语言包 ====================
export const zh: LocaleMessages = {
  error: '❌ 发生错误',
  retry: '请稍后重试',
  success: '成功',
  failed: '失败',

  menu: {
    wallet: '💰 钱包',
    trade: '📊 交易',
    checkin: '✅ 签到',
    invite: '🎁 邀请',
    closeAll: '🚨 紧急平仓',
    joinGroup: '💬 社群',
    channel: '📢 频道',
    switchLang: '🌐 语言',
    help: '❓ 帮助',
  },

  start: {
    welcomeNew:
      `🎉 <b>欢迎加入 HOOT!</b>\n\n` +
      `👤 昵称: {nickname}\n` +
      `🎁 <b>获得 {reward} HOOT 注册奖励!</b>\n\n` +
      `━━━━━━━━━━━━━━━━\n\n` +
      `🚀 <b>快速开始</b>\n` +
      `• 每日签到领 HOOT\n` +
      `• 邀请好友赚更多\n` +
      `• 订阅策略自动交易\n\n` +
      `点击下方按钮开始 👇`,
    welcomeBack:
      `👋 <b>欢迎回来，{nickname}!</b>\n\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `💵 <b>{usdt}</b> USDT | 🪙 <b>{hoot}</b> HOOT\n` +
      `⛽ <b>{point}</b> 点卡\n\n` +
      `{todayPnl}\n` +
      `🎯 策略: <b>{strategies}</b> | 📊 持仓: <b>{positions}</b>\n` +
      `━━━━━━━━━━━━━━━━\n\n` +
      `点击下方按钮操作 👇`,
    loginFailed: `❌ <b>登录失败</b>\n\n请稍后重试，或联系客服`,
  },

  help: {
    title: `📖 <b>HOOT 机器人帮助</b>\n\n━━━━━━━━━━━━━━━━`,
    commands:
      `<b>📌 快捷命令</b>\n` +
      `/start - 主菜单\n` +
      `/wallet - 钱包总览\n` +
      `/trade - 交易面板\n` +
      `/checkin - 每日签到\n` +
      `/invite - 邀请好友\n` +
      `/closeall - 紧急平仓\n` +
      `/help - 帮助\n\n` +
      `<b>🔧 其他</b>\n` +
      `/bind - 绑定邮箱\n` +
      `/lang - 切换语言\n` +
      `━━━━━━━━━━━━━━━━`,
    notifications:
      `🔔 <b>自动推送通知:</b>\n` +
      `• 开仓/平仓通知\n` +
      `• 空投到账通知`,
  },

  checkin: {
    success:
      `✅ <b>签到成功!</b>\n\n` +
      `🎁 获得: <b>+{reward} HOOT</b>\n` +
      `🔥 连续签到: <b>{streak} 天</b>\n\n`,
    alreadyChecked:
      `⏰ <b>今日已签到</b>\n\n` +
      `🔥 当前连续: <b>{streak} 天</b>\n\n` +
      `明天再来领取更多 HOOT!`,
    streak7: '🏆 连续签到 7 天以上，奖励加成中!',
    streakTip: '💡 连续签到天数越多，奖励越高哦~',
    failed: '❌ 签到失败，请稍后重试',
  },

  invite: {
    title: `🎁 <b>邀请好友赚 HOOT</b>\n\n━━━━━━━━━━━━━━━━`,
    code: `📎 邀请码: <code>{code}</code>`,
    invited: `👥 已邀请: <b>{count} 人</b>`,
    totalReward: `💰 累计奖励: <b>{amount} HOOT</b>`,
    perInvite: `• 每邀请 1 人: +{amount} HOOT`,
    inviteeGet: `• 被邀请人也得: +{amount} HOOT`,
    link: `🔗 邀请链接:\n<code>{link}</code>`,
    share: '📤 分享链接',
    shareBot: '🤖 分享 Bot',
    copyCode: '📋 复制邀请码',
    shareText: '加入 HOOT，一起赚 HOOT 代币！',
    failed: '❌ 获取邀请信息失败，请稍后重试',
  },

  wallet: {
    title: `💰 <b>钱包总览</b>\n\n━━━━━━━━━━━━━━━━`,
    platformSection: `<b>📦 平台账户</b>`,
    usdt: `💵 USDT: <b>{amount}</b>`,
    hoot: `🪙 HOOT: <b>{amount}</b>`,
    point: `⛽ 点卡: <b>{amount}</b>`,
    hootNotice: `📢 代币上链计划进行中，请关注官方公告`,
    exchangeSection: `\n<b>💱 交易所</b>`,
    total: `💰 总资产: <b>{amount} USD</b>`,
    spot: `  • 现货: {amount} USD`,
    futures: `  • 合约: {amount} USD`,
    noApiKey: `未绑定交易所，请在 HOOT 网站绑定`,
    queryFailed: `⚠️ {label}: 查询失败`,
    failed: '❌ 获取钱包信息失败，请稍后重试',
  },

  trade: {
    title: `📊 <b>交易面板</b>\n\n━━━━━━━━━━━━━━━━`,
    positionsSection: `<b>📈 当前持仓</b> ({count})`,
    noPositions: `暂无持仓`,
    positionEntry: `开仓: {price}`,
    positionAmount: `数量: {amount}`,
    earningsSection: `\n<b>💹 今日收益</b>`,
    today: `{pnl}`,
    total: `累计: {pnl}`,
    trades: `交易: {count} 次`,
    winRate: `胜率: {rate}%`,
    strategiesSection: `\n<b>🎯 运行中策略</b>`,
    noStrategies: `暂无订阅策略`,
    active: '🟢',
    paused: '⏸️',
    strategyAmount: `单笔 {amount} USDT`,
    btnHistory: '📜 交易记录',
    btnLogs: '📝 执行日志',
    btnManage: '⚙️ 管理策略',
    btnCloseAll: '🚨 紧急平仓',
    toggleOn: '▶️ 启动',
    toggleOff: '⏸ 暂停',
    toggleSuccess: '✅ 策略已{action}: {name}',
    toggleFailed: '❌ 操作失败，请稍后重试',
    failed: '❌ 获取交易信息失败，请稍后重试',
  },

  history: {
    title: `📜 <b>最近交易记录</b>\n\n━━━━━━━━━━━━━━━━`,
    empty: '📜 暂无交易记录',
    entry: '开仓: {price}',
    close: '平仓: {price}',
    pnl: '盈亏: {pnl}',
    reason: '原因: {reason}',
    failed: '❌ 获取交易记录失败，请稍后重试',
    btnBack: '⬅️ 返回交易面板',
  },

  logs: {
    title: `📝 <b>执行日志</b>\n\n━━━━━━━━━━━━━━━━`,
    empty: '📝 暂无执行日志',
    failed: '❌ 获取日志失败，请稍后重试',
    btnBack: '⬅️ 返回交易面板',
  },

  closeAll: {
    title: `🚨 <b>紧急全部平仓</b>`,
    confirm: `确定要平掉所有持仓吗？`,
    warning: `⚠️ 此操作不可撤销，将按市价平仓所有持仓`,
    selectKey: '请选择要平仓的交易所账户:',
    noApiKey: '❌ 未绑定交易所 API Key\n\n请先在 HOOT 网站绑定交易所',
    executing: '⏳ 正在执行平仓...',
    success: '✅ 平仓完成\n\n• 已平仓: {count} 个\n• 总盈亏: {profit} USDT',
    noPositions: '📊 当前无持仓，无需平仓',
    cancelled: '✅ 已取消平仓操作',
    failed: '❌ 平仓失败，请稍后重试',
    btnConfirm: '⚠️ 确认平仓',
    btnCancel: '❌ 取消',
  },

  bind: {
    alreadyBound: `✅ 您已绑定邮箱: {email}`,
    howTo: `🔗 账户合并\n\n如果您已有邮箱注册的 HOOT 账户，可以合并:`,
    steps:
      `1. 登录 HOOT 网站（邮箱账户）\n` +
      `2. 进入 设置 > Telegram 绑定\n` +
      `3. 点击"生成绑定码"\n` +
      `4. 发送: /bind <绑定码>`,
    success: `✅ 账户合并成功!`,
    nowCanUse: `现在您可以使用邮箱或 TG 登录同一账户`,
    failed: `❌ 绑定失败: {error}`,
    newUserHint: `💡 如果是新用户，无需绑定\n您的 TG 账户已自动登录`,
  },

  lang: {
    current: `🌐 当前语言: {lang}`,
    switchTo: '切换语言:',
    switched: `✅ 语言已切换为: {lang}`,
    chinese: '🇨🇳 中文',
    english: '🇬🇧 English',
  },

  tradeNotify: {
    openTitle: '🟢 <b>开仓通知</b>',
    closeTitle: '🔴 <b>平仓通知</b>',
    symbol: '交易对: {symbol}',
    side: '方向: {side}',
    price: '价格: {price}',
    amount: '数量: {amount}',
    pnl: '盈亏: {pnl} USDT',
    strategy: '策略: {name}',
  },

  unknownCommand: '❌ 未知命令，请使用 /help 查看可用命令',
};

// ==================== 英文语言包 ====================
export const en: LocaleMessages = {
  error: '❌ An error occurred',
  retry: 'Please try again later',
  success: 'Success',
  failed: 'Failed',

  menu: {
    wallet: '💰 Wallet',
    trade: '📊 Trade',
    checkin: '✅ Check-in',
    invite: '🎁 Invite',
    closeAll: '🚨 Close All',
    joinGroup: '💬 Community',
    channel: '📢 Channel',
    switchLang: '🌐 Language',
    help: '❓ Help',
  },

  start: {
    welcomeNew:
      `🎉 <b>Welcome to HOOT!</b>\n\n` +
      `👤 Nickname: {nickname}\n` +
      `🎁 <b>Got {reward} HOOT signup bonus!</b>\n\n` +
      `━━━━━━━━━━━━━━━━\n\n` +
      `🚀 <b>Quick Start</b>\n` +
      `• Daily check-in for HOOT\n` +
      `• Invite friends to earn more\n` +
      `• Subscribe strategies for auto-trading\n\n` +
      `Click buttons below to start 👇`,
    welcomeBack:
      `👋 <b>Welcome back, {nickname}!</b>\n\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `💵 <b>{usdt}</b> USDT | 🪙 <b>{hoot}</b> HOOT\n` +
      `⛽ <b>{point}</b> Credits\n\n` +
      `{todayPnl}\n` +
      `🎯 Strategies: <b>{strategies}</b> | 📊 Positions: <b>{positions}</b>\n` +
      `━━━━━━━━━━━━━━━━\n\n` +
      `Click buttons below 👇`,
    loginFailed: `❌ <b>Login failed</b>\n\nPlease try again later or contact support`,
  },

  help: {
    title: `📖 <b>HOOT Bot Help</b>\n\n━━━━━━━━━━━━━━━━`,
    commands:
      `<b>📌 Commands</b>\n` +
      `/start - Main menu\n` +
      `/wallet - Wallet overview\n` +
      `/trade - Trading panel\n` +
      `/checkin - Daily check-in\n` +
      `/invite - Invite friends\n` +
      `/closeall - Emergency close\n` +
      `/help - Help\n\n` +
      `<b>🔧 Other</b>\n` +
      `/bind - Bind email\n` +
      `/lang - Switch language\n` +
      `━━━━━━━━━━━━━━━━`,
    notifications:
      `🔔 <b>Auto notifications:</b>\n` +
      `• Open/Close position alerts\n` +
      `• Airdrop received alerts`,
  },

  checkin: {
    success:
      `✅ <b>Check-in successful!</b>\n\n` +
      `🎁 Earned: <b>+{reward} HOOT</b>\n` +
      `🔥 Streak: <b>{streak} days</b>\n\n`,
    alreadyChecked:
      `⏰ <b>Already checked in today</b>\n\n` +
      `🔥 Current streak: <b>{streak} days</b>\n\n` +
      `Come back tomorrow for more HOOT!`,
    streak7: '🏆 7+ day streak bonus active!',
    streakTip: '💡 Longer streak = more rewards~',
    failed: '❌ Check-in failed, please try again later',
  },

  invite: {
    title: `🎁 <b>Invite Friends, Earn HOOT</b>\n\n━━━━━━━━━━━━━━━━`,
    code: `📎 Invite Code: <code>{code}</code>`,
    invited: `👥 Invited: <b>{count} people</b>`,
    totalReward: `💰 Total Rewards: <b>{amount} HOOT</b>`,
    perInvite: `• Per invite: +{amount} HOOT`,
    inviteeGet: `• Invitee also gets: +{amount} HOOT`,
    link: `🔗 Invite Link:\n<code>{link}</code>`,
    share: '📤 Share Link',
    shareBot: '🤖 Share Bot',
    copyCode: '📋 Copy Code',
    shareText: 'Join HOOT and earn HOOT tokens together!',
    failed: '❌ Failed to get invite info, please try again later',
  },

  wallet: {
    title: `💰 <b>Wallet Overview</b>\n\n━━━━━━━━━━━━━━━━`,
    platformSection: `<b>📦 Platform Account</b>`,
    usdt: `💵 USDT: <b>{amount}</b>`,
    hoot: `🪙 HOOT: <b>{amount}</b>`,
    point: `⛽ Credits: <b>{amount}</b>`,
    hootNotice: `📢 Token on-chain plan in progress, stay tuned!`,
    exchangeSection: `\n<b>💱 Exchange</b>`,
    total: `💰 Total: <b>{amount} USD</b>`,
    spot: `  • Spot: {amount} USD`,
    futures: `  • Futures: {amount} USD`,
    noApiKey: `No exchange bound, please bind on HOOT website`,
    queryFailed: `⚠️ {label}: Query failed`,
    failed: '❌ Failed to get wallet info, please try again later',
  },

  trade: {
    title: `📊 <b>Trading Panel</b>\n\n━━━━━━━━━━━━━━━━`,
    positionsSection: `<b>📈 Positions</b> ({count})`,
    noPositions: `No open positions`,
    positionEntry: `Entry: {price}`,
    positionAmount: `Amount: {amount}`,
    earningsSection: `\n<b>💹 Today's PnL</b>`,
    today: `{pnl}`,
    total: `Total: {pnl}`,
    trades: `Trades: {count}`,
    winRate: `Win Rate: {rate}%`,
    strategiesSection: `\n<b>🎯 Active Strategies</b>`,
    noStrategies: `No subscribed strategies`,
    active: '🟢',
    paused: '⏸️',
    strategyAmount: `{amount} USDT per trade`,
    btnHistory: '📜 History',
    btnLogs: '📝 Logs',
    btnManage: '⚙️ Strategies',
    btnCloseAll: '🚨 Close All',
    toggleOn: '▶️ Start',
    toggleOff: '⏸ Pause',
    toggleSuccess: '✅ Strategy {action}: {name}',
    toggleFailed: '❌ Operation failed, please try again later',
    failed: '❌ Failed to get trading info, please try again later',
  },

  history: {
    title: `📜 <b>Recent Trades</b>\n\n━━━━━━━━━━━━━━━━`,
    empty: '📜 No trade history',
    entry: 'Entry: {price}',
    close: 'Close: {price}',
    pnl: 'PnL: {pnl}',
    reason: 'Reason: {reason}',
    failed: '❌ Failed to get trade history, please try again later',
    btnBack: '⬅️ Back to Trading',
  },

  logs: {
    title: `📝 <b>Execution Logs</b>\n\n━━━━━━━━━━━━━━━━`,
    empty: '📝 No execution logs',
    failed: '❌ Failed to get logs, please try again later',
    btnBack: '⬅️ Back to Trading',
  },

  closeAll: {
    title: `🚨 <b>Emergency Close All</b>`,
    confirm: `Are you sure you want to close all positions?`,
    warning: `⚠️ This action is irreversible. All positions will be closed at market price`,
    selectKey: 'Select exchange account to close:',
    noApiKey: '❌ No exchange API Key bound\n\nPlease bind one on HOOT website first',
    executing: '⏳ Executing close all...',
    success: '✅ Close all completed\n\n• Closed: {count} positions\n• Total PnL: {profit} USDT',
    noPositions: '📊 No open positions to close',
    cancelled: '✅ Close all cancelled',
    failed: '❌ Close all failed, please try again later',
    btnConfirm: '⚠️ Confirm Close All',
    btnCancel: '❌ Cancel',
  },

  bind: {
    alreadyBound: `✅ Email already bound: {email}`,
    howTo: `🔗 Account Merge\n\nIf you have an existing HOOT account with email, you can merge:`,
    steps:
      `1. Login to HOOT website (email account)\n` +
      `2. Go to Settings > Telegram Binding\n` +
      `3. Click "Generate Bind Code"\n` +
      `4. Send: /bind <code>`,
    success: `✅ Account merged successfully!`,
    nowCanUse: `Now you can login with either email or TG`,
    failed: `❌ Binding failed: {error}`,
    newUserHint: `💡 New users don't need to bind\nYour TG account is auto-logged in`,
  },

  lang: {
    current: `🌐 Current language: {lang}`,
    switchTo: 'Switch language:',
    switched: `✅ Language switched to: {lang}`,
    chinese: '🇨🇳 中文',
    english: '🇬🇧 English',
  },

  tradeNotify: {
    openTitle: '🟢 <b>Position Opened</b>',
    closeTitle: '🔴 <b>Position Closed</b>',
    symbol: 'Pair: {symbol}',
    side: 'Side: {side}',
    price: 'Price: {price}',
    amount: 'Amount: {amount}',
    pnl: 'PnL: {pnl} USDT',
    strategy: 'Strategy: {name}',
  },

  unknownCommand: '❌ Unknown command, use /help to see available commands',
};

// 语言映射
export const locales: Record<Language, LocaleMessages> = {
  zh,
  en,
};

// 根据 Telegram language_code 获取语言
export function getLanguageFromCode(languageCode?: string): Language {
  if (!languageCode) return 'en';
  if (languageCode.startsWith('zh')) return 'zh';
  return 'en';
}

// 模板替换
export function t(
  template: string,
  params?: Record<string, string | number>
): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    return params[key]?.toString() ?? `{${key}}`;
  });
}

// 获取本地化消息
export function getLocale(lang: Language): LocaleMessages {
  return locales[lang] || locales.en;
}
