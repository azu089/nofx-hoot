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

  // 主菜单
  menu: {
    openApp: string;
    checkin: string;
    invite: string;
    joinGroup: string;
    channel: string;
  };

  // /start 命令
  start: {
    welcomeNew: string;
    welcomeBack: string;
    quickStart: string;
    loginFailed: string;
  };

  // /help 命令
  help: {
    title: string;
    account: string;
    trading: string;
    other: string;
    notifications: string;
  };

  // /checkin 命令
  checkin: {
    success: string;
    alreadyChecked: string;
    streak7: string;
    streakTip: string;
    failed: string;
    capReached: string;
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
    copyCode: string;
    shareText: string;
    failed: string;
  };

  // /balance 命令
  balance: {
    title: string;
    current: string;
    chainNotice: string;
    howToGet: string;
    register: string;
    invite: string;
    trading: string;
    checkin: string;
    failed: string;
  };

  // /status 命令
  status: {
    title: string;
    nickname: string;
    email: string;
    notBound: string;
    assets: string;
    failed: string;
  };

  // /positions 命令
  positions: {
    title: string;
    noPosition: string;
    subscribeHint: string;
    entry: string;
    amount: string;
    failed: string;
  };

  // /strategies 命令
  strategies: {
    title: string;
    empty: string;
    visitWeb: string;
    failed: string;
  };

  // /earnings 命令
  earnings: {
    title: string;
    today: string;
    week: string;
    month: string;
    total: string;
    trades: string;
    winRate: string;
    failed: string;
  };

  // /app 命令
  app: {
    title: string;
    features: string;
    clickBelow: string;
  };

  // /group 命令
  group: {
    title: string;
    community: string;
    channel: string;
    clickBelow: string;
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

  // /unbind 命令
  unbind: {
    info: string;
    noNeed: string;
    goWeb: string;
  };

  // 未知命令
  unknownCommand: string;
}

// 中文语言包
export const zh: LocaleMessages = {
  error: '❌ 发生错误',
  retry: '请稍后重试',
  success: '成功',
  failed: '失败',

  menu: {
    openApp: '📱 打开应用',
    checkin: '✅ 每日签到',
    invite: '🎁 邀请好友',
    joinGroup: '💬 加入社群',
    channel: '📢 官方频道',
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
      `点击下方按钮开始使用 👇`,
    welcomeBack:
      `👋 <b>欢迎回来，{nickname}!</b>\n\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `💰 USDT: <b>{usdt}</b>\n` +
      `🪙 HOOT: <b>{hoot}</b>\n` +
      `━━━━━━━━━━━━━━━━\n\n` +
      `点击下方按钮继续 👇`,
    quickStart: '快速开始',
    loginFailed: `❌ <b>登录失败</b>\n\n请稍后重试，或联系客服`,
  },

  help: {
    title: `📖 <b>HOOT 机器人帮助</b>\n\n━━━━━━━━━━━━━━━━`,
    account:
      `<b>💰 账户相关</b>\n` +
      `/status - 账户状态\n` +
      `/balance - HOOT 余额\n` +
      `/checkin - 每日签到\n` +
      `/invite - 邀请好友\n`,
    trading:
      `<b>📊 交易相关</b>\n` +
      `/positions - 当前持仓\n` +
      `/strategies - 策略列表\n` +
      `/earnings - 收益统计\n`,
    other:
      `<b>🔧 其他</b>\n` +
      `/app - 打开应用\n` +
      `/group - 加入社群\n` +
      `/bind - 绑定邮箱\n` +
      `/lang - 切换语言\n` +
      `━━━━━━━━━━━━━━━━`,
    notifications:
      `🔔 <b>通知会自动推送:</b>\n` +
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
    capReached: '已达签到奖励上限',
  },

  invite: {
    title: `🎁 <b>邀请好友赚 HOOT</b>\n\n━━━━━━━━━━━━━━━━`,
    code: `📎 邀请码: <code>{code}</code>`,
    invited: `👥 已邀请: <b>{count} 人</b>`,
    totalReward: `💰 累计奖励: <b>{amount} HOOT</b>`,
    perInvite: `• 每邀请 1 人: +{amount} HOOT`,
    inviteeGet: `• 被邀请人也得: +{amount} HOOT`,
    link: `🔗 邀请链接:\n<code>{link}</code>`,
    share: '📤 分享邀请链接',
    copyCode: '📋 复制邀请码',
    shareText: '加入 HOOT，一起赚 HOOT 代币！',
    failed: '❌ 获取邀请信息失败，请稍后重试',
  },

  balance: {
    title: `🪙 <b>HOOT 代币余额</b>\n\n━━━━━━━━━━━━━━━━`,
    current: `当前余额: <b>{amount} HOOT</b>`,
    chainNotice: `📢 代币将在 3 个月后上链\n届时可提取到您的钱包`,
    howToGet: `<b>获取 HOOT 的方式:</b>`,
    register: `• 注册奖励: +{amount} HOOT`,
    invite: `• 邀请好友: +{amount} HOOT`,
    trading: `• 盈利交易: 盈利×{multiplier} HOOT`,
    checkin: `• 每日签到: +{min}~{max} HOOT`,
    failed: '❌ 获取余额失败，请稍后重试',
  },

  status: {
    title: `📊 账户状态\n`,
    nickname: `👤 昵称: {name}`,
    email: `📧 邮箱: {email}`,
    notBound: '未绑定',
    assets: `💰 资产:\n• USDT: {usdt}\n• HOOT: {hoot}`,
    failed: '❌ 获取状态失败，请稍后重试',
  },

  positions: {
    title: `📊 当前持仓 ({count})`,
    noPosition: '📊 当前无持仓\n\n订阅策略后会自动开仓',
    subscribeHint: '订阅策略后会自动开仓',
    entry: '• 入场: {price}',
    amount: '• 数量: {amount}',
    failed: '❌ 获取持仓失败，请稍后重试',
  },

  strategies: {
    title: `📋 策略列表`,
    empty: '📋 暂无可用策略',
    visitWeb: '访问 HOOT 网站订阅策略',
    failed: '❌ 获取策略失败，请稍后重试',
  },

  earnings: {
    title: `📊 收益统计`,
    today: `今日收益: {pnl}`,
    week: `本周收益: {pnl}`,
    month: `本月收益: {pnl}`,
    total: `累计收益: {pnl}`,
    trades: `交易次数: {count}`,
    winRate: `胜率: {rate}%`,
    failed: '❌ 获取收益失败，请稍后重试',
  },

  app: {
    title: `📱 <b>打开 HOOT 应用</b>`,
    features:
      `在应用中您可以:\n` +
      `• 查看完整资产信息\n` +
      `• 订阅交易策略\n` +
      `• 管理 API Key\n` +
      `• 绑定邮箱/钱包`,
    clickBelow: `点击下方按钮打开 👇`,
  },

  group: {
    title: `🌐 <b>加入 HOOT 社区</b>`,
    community: `• 💬 社群: 交流讨论、获取帮助`,
    channel: `• 📢 频道: 官方公告、最新动态`,
    clickBelow: `点击下方按钮加入 👇`,
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

  unbind: {
    info: `ℹ️ <b>关于账户解绑</b>`,
    noNeed: `TG 账户无需解绑，您的账户已自动关联`,
    goWeb: `如果需要解绑邮箱：\n请在 HOOT 网站的设置页面操作`,
  },

  unknownCommand: '❌ 未知命令，请使用 /help 查看可用命令',
};

// 英文语言包
export const en: LocaleMessages = {
  error: '❌ An error occurred',
  retry: 'Please try again later',
  success: 'Success',
  failed: 'Failed',

  menu: {
    openApp: '📱 Open App',
    checkin: '✅ Daily Check-in',
    invite: '🎁 Invite Friends',
    joinGroup: '💬 Join Community',
    channel: '📢 Official Channel',
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
      `💰 USDT: <b>{usdt}</b>\n` +
      `🪙 HOOT: <b>{hoot}</b>\n` +
      `━━━━━━━━━━━━━━━━\n\n` +
      `Click buttons below to continue 👇`,
    quickStart: 'Quick Start',
    loginFailed: `❌ <b>Login failed</b>\n\nPlease try again later or contact support`,
  },

  help: {
    title: `📖 <b>HOOT Bot Help</b>\n\n━━━━━━━━━━━━━━━━`,
    account:
      `<b>💰 Account</b>\n` +
      `/status - Account status\n` +
      `/balance - HOOT balance\n` +
      `/checkin - Daily check-in\n` +
      `/invite - Invite friends\n`,
    trading:
      `<b>📊 Trading</b>\n` +
      `/positions - Current positions\n` +
      `/strategies - Strategy list\n` +
      `/earnings - Earnings stats\n`,
    other:
      `<b>🔧 Other</b>\n` +
      `/app - Open app\n` +
      `/group - Join community\n` +
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
    capReached: 'Check-in reward cap reached',
  },

  invite: {
    title: `🎁 <b>Invite Friends, Earn HOOT</b>\n\n━━━━━━━━━━━━━━━━`,
    code: `📎 Invite Code: <code>{code}</code>`,
    invited: `👥 Invited: <b>{count} people</b>`,
    totalReward: `💰 Total Rewards: <b>{amount} HOOT</b>`,
    perInvite: `• Per invite: +{amount} HOOT`,
    inviteeGet: `• Invitee also gets: +{amount} HOOT`,
    link: `🔗 Invite Link:\n<code>{link}</code>`,
    share: '📤 Share Invite Link',
    copyCode: '📋 Copy Invite Code',
    shareText: 'Join HOOT and earn HOOT tokens together!',
    failed: '❌ Failed to get invite info, please try again later',
  },

  balance: {
    title: `🪙 <b>HOOT Token Balance</b>\n\n━━━━━━━━━━━━━━━━`,
    current: `Current Balance: <b>{amount} HOOT</b>`,
    chainNotice: `📢 Tokens will be on-chain in 3 months\nWithdraw to your wallet then`,
    howToGet: `<b>How to get HOOT:</b>`,
    register: `• Signup bonus: +{amount} HOOT`,
    invite: `• Invite friend: +{amount} HOOT`,
    trading: `• Profitable trade: profit×{multiplier} HOOT`,
    checkin: `• Daily check-in: +{min}~{max} HOOT`,
    failed: '❌ Failed to get balance, please try again later',
  },

  status: {
    title: `📊 Account Status\n`,
    nickname: `👤 Nickname: {name}`,
    email: `📧 Email: {email}`,
    notBound: 'Not bound',
    assets: `💰 Assets:\n• USDT: {usdt}\n• HOOT: {hoot}`,
    failed: '❌ Failed to get status, please try again later',
  },

  positions: {
    title: `📊 Current Positions ({count})`,
    noPosition: '📊 No positions\n\nSubscribe to a strategy to start trading',
    subscribeHint: 'Subscribe to a strategy to start trading',
    entry: '• Entry: {price}',
    amount: '• Amount: {amount}',
    failed: '❌ Failed to get positions, please try again later',
  },

  strategies: {
    title: `📋 Strategy List`,
    empty: '📋 No strategies available',
    visitWeb: 'Visit HOOT website to subscribe',
    failed: '❌ Failed to get strategies, please try again later',
  },

  earnings: {
    title: `📊 Earnings Stats`,
    today: `Today: {pnl}`,
    week: `This Week: {pnl}`,
    month: `This Month: {pnl}`,
    total: `Total: {pnl}`,
    trades: `Trades: {count}`,
    winRate: `Win Rate: {rate}%`,
    failed: '❌ Failed to get earnings, please try again later',
  },

  app: {
    title: `📱 <b>Open HOOT App</b>`,
    features:
      `In the app you can:\n` +
      `• View complete asset info\n` +
      `• Subscribe to strategies\n` +
      `• Manage API Keys\n` +
      `• Bind email/wallet`,
    clickBelow: `Click button below to open 👇`,
  },

  group: {
    title: `🌐 <b>Join HOOT Community</b>`,
    community: `• 💬 Group: Chat, discuss, get help`,
    channel: `• 📢 Channel: Official announcements`,
    clickBelow: `Click buttons below to join 👇`,
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

  unbind: {
    info: `ℹ️ <b>About Unbinding</b>`,
    noNeed: `TG account doesn't need unbinding, already linked`,
    goWeb: `To unbind email:\nPlease do it in HOOT website settings`,
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
  // 中文：zh, zh-hans, zh-hant, zh-cn, zh-tw, etc.
  if (languageCode.startsWith('zh')) return 'zh';
  // 其他默认英文
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
