import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Telegraf, Context } from 'telegraf';
import { PrismaService } from '../../prisma/prisma.service';
import Decimal from 'decimal.js';

// ==================== 工具函数 ====================

/**
 * 数字格式化（千位分隔符）
 */
function formatNum(value: string | number | Decimal, decimals = 2): string {
  const num = value instanceof Decimal ? value.toNumber() : (typeof value === 'string' ? parseFloat(value) : value);
  if (isNaN(num)) return '0';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
}

/**
 * 整数格式化（无小数）
 */
function formatInt(value: string | number | Decimal): string {
  const num = value instanceof Decimal ? value.toNumber() : (typeof value === 'string' ? parseFloat(value) : value);
  if (isNaN(num)) return '0';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.floor(num));
}

/**
 * 盈亏格式化（带正负号和颜色提示）
 */
function formatPnl(value: string | number | Decimal, decimals = 2): string {
  const num = value instanceof Decimal ? value.toNumber() : (typeof value === 'string' ? parseFloat(value) : value);
  if (isNaN(num)) return '$0.00';
  const formatted = formatNum(Math.abs(num), decimals);
  return num >= 0 ? `+$${formatted}` : `-$${formatted}`;
}

/**
 * 多语言文案模板
 * 所有 Bot 交互文案统一管理，支持中英文切换
 */
const LANG = {
  // ==================== /start 命令 ====================
  welcome_back: {
    zh: (name: string) => `欢迎回来，${name}！

您的专属量化交易助手已就绪

📋 快捷指令
/balance - 查看余额
/pnl - 今日盈亏
/checkin - 每日签到
/invite - 邀请好友
/rank - 查看排名
/help - 所有命令

💡 点击左下角「打开应用」进入小程序`,
    en: (name: string) => `Welcome back, ${name}!

Your personal trading assistant is ready

📋 Quick Commands
/balance - Check balance
/pnl - Today's PnL
/checkin - Daily check-in
/invite - Invite friends
/rank - View ranking
/help - All commands

💡 Click "Open App" at bottom left to enter Mini App`,
  },
  welcome_new: {
    zh: (name: string) => `欢迎使用 TIZO，${name}！

您的专属量化交易助手

🚀 核心功能
• AI 智能策略 - 一键跟单
• 实时交易通知 - 不错过任何机会
• 每日盈亏报告 - 掌握账户动态

🎁 新用户福利
• 注册即送 1000 积分
• 首单盈利额外奖励

📋 快捷指令
/bind - 绑定账号
/help - 所有命令

💡 点击左下角「打开应用」进入小程序注册`,
    en: (name: string) => `Welcome to TIZO, ${name}!

Your personal trading assistant

🚀 Core Features
• AI Smart Strategies - One-click copy trading
• Real-time Notifications - Never miss an opportunity
• Daily PnL Reports - Track your performance

🎁 New User Benefits
• 1000 points on registration
• Bonus on first profitable trade

📋 Quick Commands
/bind - Bind account
/help - All commands

💡 Click "Open App" at bottom left to register`,
  },
  invite_code_detected: {
    zh: (code: string) => `\n\n检测到邀请码: ${code}`,
    en: (code: string) => `\n\nInvite code detected: ${code}`,
  },

  // ==================== /help 命令 ====================
  help_title: { zh: 'QuantFi Bot 命令帮助', en: 'QuantFi Bot Commands' },
  help_section_app: { zh: '应用', en: 'App' },
  help_section_account: { zh: '账号绑定', en: 'Account Binding' },
  help_section_assets: { zh: '资产查询', en: 'Assets' },
  help_section_trading: { zh: '交易相关', en: 'Trading' },
  help_section_ecosystem: { zh: '生态功能', en: 'Ecosystem' },
  help_section_settings: { zh: '设置', en: 'Settings' },

  // ==================== /bind 命令 ====================
  already_bound: {
    zh: (email: string, shortId: string) => `您已绑定账号\n\n邮箱: ${email || '未设置'}\n用户ID: ${shortId}\n\n如需解绑，请输入 /unbind`,
    en: (email: string, shortId: string) => `Account already bound\n\nEmail: ${email || 'Not set'}\nUser ID: ${shortId}\n\nTo unbind, type /unbind`,
  },
  bind_prompt: {
    zh: '绑定 Telegram\n\n请直接发送您的用户 ID（8位短码）\n\n获取方法：\n打开小程序 → 我的 → 点击 ID 复制\n\n请在 5 分钟内完成',
    en: 'Bind Telegram\n\nPlease send your User ID (8-character code)\n\nHow to get it:\nOpen Mini App → Profile → Click ID to copy\n\nPlease complete within 5 minutes',
  },
  bind_timeout: {
    zh: '绑定已超时，请重新输入 /bind 开始绑定',
    en: 'Binding timed out, please type /bind to start again',
  },
  bind_user_not_found: {
    zh: (id: string) => `用户ID不存在: ${id}\n\n请检查输入是否正确。\n\n获取用户ID：\n打开小程序 → 我的 → 点击 ID 复制`,
    en: (id: string) => `User ID not found: ${id}\n\nPlease check your input.\n\nHow to get User ID:\nOpen Mini App → Profile → Click ID to copy`,
  },
  bind_already_used: {
    zh: '该账号已被其他 Telegram 绑定\n\n如需更换绑定，请先在原 Telegram 账号解绑。',
    en: 'This account is already bound to another Telegram\n\nTo change binding, please unbind from the original Telegram first.',
  },
  bind_success: {
    zh: (email: string, shortId: string) => `绑定成功！\n\n邮箱: ${email || '未设置'}\n用户ID: ${shortId}\n\n现在您可以：\n• 接收交易通知\n• 使用 Bot 快捷命令查询余额、盈亏等\n• 通过 Bot 签到领取积分\n\n输入 /help 查看所有可用命令`,
    en: (email: string, shortId: string) => `Binding successful!\n\nEmail: ${email || 'Not set'}\nUser ID: ${shortId}\n\nNow you can:\n• Receive trade notifications\n• Use Bot commands to check balance, PnL, etc.\n• Check in via Bot to earn points\n\nType /help to see all available commands`,
  },
  bind_failed: {
    zh: '绑定失败，请稍后重试\n\n如持续失败，请联系客服',
    en: 'Binding failed, please try again later\n\nIf the problem persists, please contact support',
  },
  bind_cancelled: {
    zh: '已取消绑定\n\n如需重新绑定，请输入 /bind',
    en: 'Binding cancelled\n\nTo bind again, type /bind',
  },

  // ==================== /unbind 命令 ====================
  not_bound: {
    zh: '您尚未绑定任何账号',
    en: 'You have not bound any account',
  },
  unbind_success: {
    zh: '已解除账号绑定\n\n如需重新绑定，请输入 /bind',
    en: 'Account unbound successfully\n\nTo bind again, type /bind',
  },
  unbind_failed: {
    zh: '解绑失败，请稍后重试',
    en: 'Unbind failed, please try again later',
  },

  // ==================== /wallet 命令 ====================
  please_bind_first: {
    zh: '请先绑定账号\n\n输入 /bind 开始绑定',
    en: 'Please bind your account first\n\nType /bind to start binding',
  },
  wallet_title: { zh: '钱包余额', en: 'Wallet Balance' },
  wallet_fetch_failed: {
    zh: '钱包信息获取失败',
    en: 'Failed to fetch wallet info',
  },
  wallet_error: {
    zh: '获取钱包信息失败，请稍后重试',
    en: 'Failed to get wallet info, please try again later',
  },

  // ==================== /pnl 命令 ====================
  pnl_title: { zh: '今日交易报告', en: 'Today\'s Trading Report' },
  pnl_error: {
    zh: '获取盈亏信息失败，请稍后重试',
    en: 'Failed to get PnL info, please try again later',
  },

  // ==================== /checkin 命令 ====================
  checkin_already: {
    zh: '今日已签到\n\n明天继续保持！',
    en: 'Already checked in today\n\nKeep it up tomorrow!',
  },
  checkin_success: {
    zh: (points: number) => `签到成功！\n\n获得 ${points} 积分\n\n明天继续签到可获得更多奖励！`,
    en: (points: number) => `Check-in successful!\n\nEarned ${points} points\n\nCheck in tomorrow for more rewards!`,
  },
  checkin_error: {
    zh: '签到失败，请稍后重试',
    en: 'Check-in failed, please try again later',
  },

  // ==================== /invite 命令 ====================
  invite_title: { zh: '邀请好友', en: 'Invite Friends' },
  invite_error: {
    zh: '获取邀请信息失败，请稍后重试',
    en: 'Failed to get invite info, please try again later',
  },

  // ==================== /stake 命令 ====================
  stake_title: { zh: '质押概览', en: 'Staking Overview' },
  stake_empty: {
    zh: '暂无质押记录',
    en: 'No staking records',
  },
  stake_error: {
    zh: '获取质押信息失败，请稍后重试',
    en: 'Failed to get staking info, please try again later',
  },

  // ==================== /vesting 命令 ====================
  vesting_title: { zh: '代币释放进度', en: 'Token Vesting Progress' },
  vesting_empty: {
    zh: '暂无待释放订单',
    en: 'No pending vesting orders',
  },
  vesting_error: {
    zh: '获取释放进度失败，请稍后重试',
    en: 'Failed to get vesting info, please try again later',
  },

  // ==================== /rank 命令 ====================
  rank_title: { zh: '我的排名', en: 'My Ranking' },
  rank_error: {
    zh: '获取排名失败，请稍后重试',
    en: 'Failed to get ranking, please try again later',
  },

  // ==================== /strategies 命令 ====================
  strategies_title: { zh: '运行中策略', en: 'Running Strategies' },
  strategies_empty: {
    zh: '暂无运行中的策略',
    en: 'No running strategies',
  },
  strategies_error: {
    zh: '获取策略信息失败，请稍后重试',
    en: 'Failed to get strategies, please try again later',
  },

  // ==================== /settings 命令 ====================
  settings_title: { zh: '通知设置', en: 'Notification Settings' },
  settings_more: {
    zh: '更多设置请在 App 中操作',
    en: 'More settings available in App',
  },
  settings_error: {
    zh: '获取设置失败，请稍后重试',
    en: 'Failed to get settings, please try again later',
  },

  // ==================== 按钮文案 ====================
  btn_open_app: { zh: '打开小程序', en: 'Open Mini App' },
  btn_view_balance: { zh: '查看余额', en: 'View Balance' },
  btn_today_pnl: { zh: '今日盈亏', en: "Today's PnL" },
  btn_checkin: { zh: '每日签到', en: 'Daily Check-in' },
  btn_invite: { zh: '邀请好友', en: 'Invite Friends' },
  btn_bind: { zh: '绑定账号', en: 'Bind Account' },
  btn_rebind: { zh: '重新绑定', en: 'Rebind' },
  btn_cancel: { zh: '取消绑定', en: 'Cancel' },

  // ==================== 通用 ====================
  error_generic: {
    zh: '操作失败，请稍后重试',
    en: 'Operation failed, please try again later',
  },
};

// 全局语言偏好缓存（模块级别，供 getUserLang 使用）
const globalLangPrefs = new Map<number, 'zh' | 'en'>();

/**
 * 获取用户语言偏好
 * 优先级：用户手动设置 > Telegram 系统语言 > 默认中文
 */
function getUserLang(ctx: Context): 'zh' | 'en' {
  const telegramId = ctx.from?.id;

  // 1. 优先使用用户手动设置的语言
  if (telegramId && globalLangPrefs.has(telegramId)) {
    return globalLangPrefs.get(telegramId)!;
  }

  // 2. 使用 Telegram 系统语言
  const langCode = ctx.from?.language_code || 'zh';
  return langCode.startsWith('en') ? 'en' : 'zh';
}

/**
 * 设置用户语言偏好（供 handleLang 调用）
 */
function setUserLang(telegramId: number, lang: 'zh' | 'en') {
  globalLangPrefs.set(telegramId, lang);
}

/**
 * 获取多语言文本
 */
function t(key: keyof typeof LANG, lang: 'zh' | 'en'): any {
  return LANG[key]?.[lang] || LANG[key]?.['zh'];
}

/**
 * Telegram Bot 服务
 * 负责：
 * 1. Bot 命令处理（/start, /wallet, /pnl 等）
 * 2. 推送通知发送
 * 3. 用户账号绑定（telegram_id -> user）
 * 4. 多语言支持（中英文自动切换）
 */
@Injectable()
export class TelegramBotService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramBotService.name);
  private bot: Telegraf | null = null;
  private isLaunched = false;
  private readonly botToken: string;
  private readonly webAppUrl: string;
  private readonly webhookDomain: string;
  private readonly isProduction: boolean;

  // 绑定验证码缓存 (telegram_id -> { code, expires })
  private bindingCodes = new Map<number, { code: string; expires: Date }>();

  // 等待用户输入 ID 的状态缓存 (telegram_id -> { waitingForId, expires })
  private bindingWaitState = new Map<number, { waitingForId: boolean; expires: Date }>();

  // 用户语言偏好缓存 (telegram_id -> 'zh' | 'en')
  // 优先级：用户手动设置 > Telegram 系统语言
  private userLangPrefs = new Map<number, 'zh' | 'en'>();

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN') || '';
    this.webAppUrl = this.configService.get<string>('TELEGRAM_WEB_APP_URL') || '';
    this.webhookDomain = this.configService.get<string>('TELEGRAM_WEBHOOK_DOMAIN') || '';
    this.isProduction = this.configService.get<string>('NODE_ENV') === 'production';
  }

  async onModuleInit() {
    if (!this.botToken) {
      this.logger.warn('TELEGRAM_BOT_TOKEN 未配置，Bot 功能将不可用');
      return;
    }

    // 延迟 3 秒启动，确保 NestJS 和数据库完全就绪
    setTimeout(() => this.initBot(), 3000);
  }

  private async initBot() {
    if (this.isLaunched) {
      this.logger.warn('Bot 已启动，跳过重复初始化');
      return;
    }

    try {
      this.logger.log('🚀 开始初始化 Telegram Bot...');
      this.bot = new Telegraf(this.botToken);

      // 注册命令
      this.registerCommands();

      // 设置 Bot 命令菜单（输入框旁边的 / 按钮）
      await this.setupBotCommands();

      // 全局错误处理
      this.bot.catch((err, ctx) => {
        this.logger.error(`Bot 错误 [${ctx.updateType}]: ${err}`);
      });

      if (this.isProduction && this.webhookDomain) {
        // 生产环境使用 Webhook
        await this.bot.telegram.setWebhook(`${this.webhookDomain}/api/telegram/webhook`);
        this.logger.log(`✅ Bot Webhook 已设置: ${this.webhookDomain}/api/telegram/webhook`);
      } else {
        // 开发环境使用长轮询
        await this.bot.telegram.deleteWebhook({ drop_pending_updates: true });
        this.logger.log('Webhook 已清理，使用长轮询模式');

        // 优雅关闭
        process.once('SIGINT', () => this.bot?.stop('SIGINT'));
        process.once('SIGTERM', () => this.bot?.stop('SIGTERM'));

        // 启动长轮询（不等待 Promise，它在轮询模式下不会 resolve）
        this.bot.launch({ dropPendingUpdates: true });
        this.isLaunched = true;
        this.logger.log('✅ Bot 长轮询已启动，等待消息...');
      }
    } catch (error) {
      this.logger.error('❌ Bot 初始化失败', error);
    }
  }

  /**
   * 设置 Bot 命令菜单
   * 这是用户在输入框旁边点击 / 时看到的命令列表
   * 同时设置中文和英文版本
   */
  private async setupBotCommands() {
    if (!this.bot) return;

    try {
      // 中文命令菜单（默认）
      const zhCommands = [
        { command: 'start', description: '主菜单 / 快捷入口' },
        { command: 'help', description: '帮助信息' },
        { command: 'bind', description: '绑定 Telegram' },
        { command: 'wallet', description: '查看钱包余额' },
        { command: 'pnl', description: '查看今日盈亏' },
        { command: 'checkin', description: '每日签到' },
        { command: 'invite', description: '邀请好友' },
        { command: 'stake', description: '质押概览' },
        { command: 'vesting', description: '释放进度' },
        { command: 'rank', description: '我的排名' },
        { command: 'strategies', description: '运行中策略' },
        { command: 'settings', description: '通知设置' },
        { command: 'lang', description: '切换语言 🌐' },
      ];

      // 英文命令菜单
      const enCommands = [
        { command: 'start', description: 'Main Menu / Quick Access' },
        { command: 'help', description: 'Help' },
        { command: 'bind', description: 'Bind Telegram' },
        { command: 'wallet', description: 'View Wallet Balance' },
        { command: 'pnl', description: "Today's PnL" },
        { command: 'checkin', description: 'Daily Check-in' },
        { command: 'invite', description: 'Invite Friends' },
        { command: 'stake', description: 'Staking Overview' },
        { command: 'vesting', description: 'Vesting Progress' },
        { command: 'rank', description: 'My Ranking' },
        { command: 'strategies', description: 'Running Strategies' },
        { command: 'settings', description: 'Notification Settings' },
        { command: 'lang', description: 'Change Language 🌐' },
      ];

      // 设置默认命令（中文）
      await this.bot.telegram.setMyCommands(zhCommands);

      // 设置英语用户命令
      await this.bot.telegram.setMyCommands(enCommands, { language_code: 'en' });

      this.logger.log('Bot 命令菜单已设置（中英文）');
    } catch (error) {
      this.logger.warn('设置 Bot 命令菜单失败', error);
    }
  }

  async onModuleDestroy() {
    if (this.bot && this.isLaunched) {
      this.bot.stop('SIGTERM');
      this.isLaunched = false;
      this.logger.log('Bot 已停止');
    }
  }

  /**
   * 获取 Bot 实例（用于 Webhook 处理）
   */
  getBotInstance(): Telegraf | null {
    return this.bot;
  }

  /**
   * 注册 Bot 命令
   */
  private registerCommands() {
    if (!this.bot) return;

    this.logger.log('注册 Bot 命令...');

    // 日志中间件
    this.bot.use(async (ctx, next) => {
      const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
      this.logger.log(`[收到] ${ctx.updateType} from=${ctx.from?.id} ${text ? `内容: ${text}` : ''}`);
      await next();
    });

    // /start 命令 - 主入口
    this.bot.command('start', (ctx) => this.handleStart(ctx));

    // /help 命令 - 帮助信息
    this.bot.command('help', (ctx) => this.handleHelp(ctx));

    // /bind 命令 - 绑定账号
    this.bot.command('bind', (ctx) => this.handleBind(ctx));

    // /wallet 命令 - 钱包余额
    this.bot.command('wallet', (ctx) => this.handleWallet(ctx));

    // /pnl 命令 - 盈亏统计
    this.bot.command('pnl', (ctx) => this.handlePnl(ctx));

    // /checkin 命令 - 每日签到
    this.bot.command('checkin', (ctx) => this.handleCheckin(ctx));

    // /invite 命令 - 邀请链接
    this.bot.command('invite', (ctx) => this.handleInvite(ctx));

    // /stake 命令 - 质押概览
    this.bot.command('stake', (ctx) => this.handleStake(ctx));

    // /vesting 命令 - 释放进度
    this.bot.command('vesting', (ctx) => this.handleVesting(ctx));

    // /rank 命令 - 我的排名
    this.bot.command('rank', (ctx) => this.handleRank(ctx));

    // /strategies 命令 - 策略状态
    this.bot.command('strategies', (ctx) => this.handleStrategies(ctx));

    // /settings 命令 - 通知设置
    this.bot.command('settings', (ctx) => this.handleSettings(ctx));

    // /lang 命令 - 语言切换
    this.bot.command('lang', (ctx) => this.handleLang(ctx));

    // /unbind 命令 - 解绑账号
    this.bot.command('unbind', (ctx) => this.handleUnbind(ctx));

    // Callback Query 处理
    this.bot.on('callback_query', (ctx) => this.handleCallbackQuery(ctx));

    // 文本消息处理（用于两步式绑定）
    this.bot.on('text', (ctx) => this.handleTextMessage(ctx));

    this.logger.log('✅ Bot 命令已注册');
  }

  // ==================== 命令处理器 ====================

  /**
   * /start 命令处理 - 多语言支持
   */
  private async handleStart(ctx: Context) {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const lang = getUserLang(ctx);
    const firstName = ctx.from?.first_name || (lang === 'zh' ? '用户' : 'User');

    // 检查是否带有邀请码参数 /start INVITE_CODE
    const startPayload = ctx.message && 'text' in ctx.message
      ? ctx.message.text.split(' ')[1]
      : null;

    // 尝试获取已绑定用户
    let user = null;
    try {
      user = await this.getUserByTelegramId(telegramId);
    } catch (err) {
      this.logger.warn('数据库查询失败', err);
    }

    // 构建"打开小程序"按钮
    const appButton = this.webAppUrl
      ? [{ text: t('btn_open_app', lang), web_app: { url: this.webAppUrl } }]
      : [{ text: t('btn_open_app', lang), url: 'https://tizo.cc/tg' }];

    // 社群链接
    const communityUrl = 'https://t.me/QuantFiCommunity';

    if (user) {
      // 已绑定用户 - 快捷按钮（不再需要"打开小程序"按钮，用户可以点击左下角 Menu Button）
      const welcomeText = t('welcome_back', lang)(firstName);
      await ctx.reply(welcomeText, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            // 常用功能 3 列
            [
              { text: lang === 'zh' ? '💰 余额' : '💰 Balance', callback_data: 'cmd_wallet' },
              { text: lang === 'zh' ? '📊 盈亏' : '📊 PnL', callback_data: 'cmd_pnl' },
              { text: lang === 'zh' ? '✅ 签到' : '✅ Check-in', callback_data: 'cmd_checkin' },
            ],
            // 生态功能 3 列
            [
              { text: lang === 'zh' ? '🔐 质押' : '🔐 Stake', callback_data: 'cmd_stake' },
              { text: lang === 'zh' ? '👥 邀请' : '👥 Invite', callback_data: 'cmd_invite' },
              { text: lang === 'zh' ? '🏆 排名' : '🏆 Rank', callback_data: 'cmd_rank' },
            ],
            // 帮助 + 社群 + 语言
            [
              { text: lang === 'zh' ? '❓ 帮助' : '❓ Help', callback_data: 'cmd_help' },
              { text: lang === 'zh' ? '💬 社群' : '💬 Community', url: communityUrl },
              { text: lang === 'zh' ? '🌐 语言' : '🌐 Lang', callback_data: 'cmd_lang' },
            ],
          ],
        },
      });
    } else {
      // 未绑定用户
      let welcomeMsg = t('welcome_new', lang)(firstName);

      if (startPayload) {
        welcomeMsg += t('invite_code_detected', lang)(startPayload);
      }

      await ctx.reply(welcomeMsg, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            // 绑定 + 社群 + 语言
            [
              { text: t('btn_bind', lang), callback_data: 'cmd_bind' },
              { text: lang === 'zh' ? '💬 社群' : '💬 Community', url: communityUrl },
              { text: lang === 'zh' ? '🌐 语言' : '🌐 Lang', callback_data: 'cmd_lang' },
            ],
          ],
        },
      });
    }
  }

  /**
   * /help 命令处理 - 多语言支持
   */
  private async handleHelp(ctx: Context) {
    const lang = getUserLang(ctx);

    const helpText = lang === 'zh'
      ? `<b>QuantFi Bot 命令帮助</b>

<b>应用</b>
/start - 打开 QuantFi 小程序

<b>账号绑定</b>
/bind - 绑定 QuantFi 账号
/unbind - 解除绑定

<b>资产查询</b>
/wallet - 查看钱包余额
/pnl - 查看今日盈亏
/stake - 查看质押概览
/vesting - 查看释放进度

<b>交易相关</b>
/strategies - 查看运行中策略

<b>生态功能</b>
/checkin - 每日签到
/invite - 获取邀请链接
/rank - 查看我的排名

<b>设置</b>
/settings - 通知设置
/lang - 切换语言 🌐`
      : `<b>QuantFi Bot Commands</b>

<b>App</b>
/start - Open QuantFi Mini App

<b>Account Binding</b>
/bind - Bind QuantFi account
/unbind - Unbind account

<b>Assets</b>
/wallet - View wallet balance
/pnl - View today's PnL
/stake - View staking overview
/vesting - View vesting progress

<b>Trading</b>
/strategies - View running strategies

<b>Ecosystem</b>
/checkin - Daily check-in
/invite - Get invite link
/rank - View my ranking

<b>Settings</b>
/settings - Notification settings
/lang - Change language 🌐`;

    await ctx.reply(helpText, { parse_mode: 'HTML' });
  }

  /**
   * /bind 命令处理 - 两步式绑定，多语言支持
   * 第一步: 用户发送 /bind，Bot 提示输入用户 ID
   * 第二步: 用户单独发送用户 ID，Bot 完成绑定
   */
  private async handleBind(ctx: Context) {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const lang = getUserLang(ctx);

    // 检查是否已绑定
    try {
      const existingUser = await this.getUserByTelegramId(telegramId);
      if (existingUser) {
        const shortId = existingUser.id.split('-')[0].toUpperCase();
        const msg = t('already_bound', lang)(existingUser.email || '', shortId);
        return ctx.reply(msg, { parse_mode: 'HTML' });
      }
    } catch (err) {
      this.logger.warn('数据库查询失败', err);
    }

    // 检查是否在命令后直接带了用户ID（兼容旧的 /bind ID 方式）
    const messageText = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
    const parts = messageText.split(' ');
    const inputId = parts.length > 1 ? parts[1].trim() : null;

    if (inputId) {
      // 如果带了参数，直接执行绑定
      return this.executeBinding(ctx, telegramId, inputId, lang);
    }

    // 没有参数，进入两步式绑定流程
    // 设置等待状态（5分钟过期）
    const expires = new Date();
    expires.setMinutes(expires.getMinutes() + 5);
    this.bindingWaitState.set(telegramId, { waitingForId: true, expires });

    const bindPrompt = t('bind_prompt', lang);

    return ctx.reply(bindPrompt, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          this.webAppUrl
            ? [{ text: t('btn_open_app', lang), web_app: { url: this.webAppUrl } }]
            : [{ text: t('btn_open_app', lang), url: 'https://tizo.cc/tg' }],
          [{ text: t('btn_cancel', lang), callback_data: 'cancel_bind' }],
        ],
      },
    });
  }

  /**
   * 文本消息处理 - 用于两步式绑定，多语言支持
   */
  private async handleTextMessage(ctx: Context) {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const lang = getUserLang(ctx);
    const messageText = ctx.message && 'text' in ctx.message ? ctx.message.text : '';

    // 忽略命令消息（以 / 开头的）
    if (messageText.startsWith('/')) return;

    // 检查是否在等待绑定输入
    const waitState = this.bindingWaitState.get(telegramId);
    if (!waitState || !waitState.waitingForId) return;

    // 检查是否过期
    if (waitState.expires < new Date()) {
      this.bindingWaitState.delete(telegramId);
      return ctx.reply(t('bind_timeout', lang));
    }

    // 清除等待状态
    this.bindingWaitState.delete(telegramId);

    // 执行绑定
    await this.executeBinding(ctx, telegramId, messageText.trim(), lang);
  }

  /**
   * 执行绑定逻辑（供 handleBind 和 handleTextMessage 调用）- 多语言支持
   */
  private async executeBinding(ctx: Context, telegramId: number, inputId: string, lang: 'zh' | 'en' = 'zh') {
    // 标准化输入：去除空格，转大写用于显示
    const cleanId = inputId.trim().toUpperCase();

    this.logger.log(`尝试绑定: telegramId=${telegramId}, inputId=${cleanId}`);

    try {
      let user = null;

      // 判断是短ID还是完整ID
      if (cleanId.length === 8) {
        // 短ID：使用原生 SQL 进行不区分大小写的匹配
        const users = await this.prisma.client.$queryRaw<Array<{ id: string; email: string | null; telegram_id: bigint | null }>>`
          SELECT id, email, telegram_id
          FROM users
          WHERE id::text ILIKE ${cleanId.toLowerCase() + '%'}
          LIMIT 1
        `;
        user = users[0] || null;
      } else if (cleanId.length === 36 && cleanId.includes('-')) {
        // 完整UUID：直接查询（UUID 格式不区分大小写）
        user = await this.prisma.client.users.findUnique({
          where: { id: cleanId.toLowerCase() },
        });
      } else {
        // 尝试模糊匹配
        const users = await this.prisma.client.$queryRaw<Array<{ id: string; email: string | null; telegram_id: bigint | null }>>`
          SELECT id, email, telegram_id
          FROM users
          WHERE id::text ILIKE ${cleanId.toLowerCase() + '%'}
          LIMIT 1
        `;
        user = users[0] || null;
      }

      if (!user) {
        const errorMsg = t('bind_user_not_found', lang)(cleanId);
        return ctx.reply(errorMsg, {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              this.webAppUrl
                ? [{ text: t('btn_open_app', lang), web_app: { url: this.webAppUrl } }]
                : [{ text: t('btn_open_app', lang), url: 'https://tizo.cc/tg' }],
              [{ text: t('btn_rebind', lang), callback_data: 'cmd_bind' }],
            ],
          },
        });
      }

      // 检查该用户是否已被其他 Telegram 账号绑定
      if (user.telegram_id && user.telegram_id !== BigInt(telegramId)) {
        return ctx.reply(t('bind_already_used', lang));
      }

      // 执行绑定
      await this.prisma.client.users.update({
        where: { id: user.id },
        data: { telegram_id: BigInt(telegramId) },
      });

      // 生成短ID（UUID前8位大写）
      const shortId = user.id.split('-')[0].toUpperCase();

      const successMsg = t('bind_success', lang)(user.email || '', shortId);
      await ctx.reply(successMsg, { parse_mode: 'HTML' });

      this.logger.log(`用户绑定成功: userId=${user.id}, shortId=${shortId}, telegramId=${telegramId}`);
    } catch (err) {
      this.logger.error('绑定失败', err);
      await ctx.reply(t('bind_failed', lang));
    }
  }

  /**
   * 验证绑定码（供 API 调用）
   */
  async verifyBindingCode(code: string): Promise<number | null> {
    const entries = Array.from(this.bindingCodes.entries());
    for (const [telegramId, data] of entries) {
      if (data.code === code && data.expires > new Date()) {
        this.bindingCodes.delete(telegramId);
        return telegramId;
      }
    }
    return null;
  }

  /**
   * /unbind 命令处理 - 多语言支持
   */
  private async handleUnbind(ctx: Context) {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const lang = getUserLang(ctx);

    try {
      const user = await this.getUserByTelegramId(telegramId);
      if (!user) {
        return ctx.reply(t('not_bound', lang));
      }

      // 解除绑定
      await this.prisma.client.users.update({
        where: { id: user.id },
        data: { telegram_id: null },
      });

      await ctx.reply(t('unbind_success', lang));
    } catch (err) {
      this.logger.error('解绑失败', err);
      await ctx.reply(t('unbind_failed', lang));
    }
  }

  /**
   * /wallet 命令处理 - 多语言支持，包含点卡余额
   */
  private async handleWallet(ctx: Context) {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const lang = getUserLang(ctx);

    try {
      const user = await this.getUserByTelegramId(telegramId);
      if (!user) {
        return ctx.reply(t('please_bind_first', lang));
      }

      // 查询钱包（card_balance 字段暂不存在，默认为 0）
      const walletResult = await this.prisma.client.$queryRaw<Array<{
        usdt_balance: string;
        points_balance: string;
        token_balance: string;
        token_vesting: string;
      }>>`
        SELECT usdt_balance, points_balance, token_balance, token_vesting
        FROM wallets
        WHERE user_id = ${user.id}::uuid
        LIMIT 1
      `;

      const wallet = walletResult[0];
      if (!wallet) {
        return ctx.reply(t('wallet_fetch_failed', lang));
      }

      const usdtBalance = new Decimal(wallet.usdt_balance || '0');
      const cardBalance = new Decimal('0'); // card_balance 字段暂不存在
      const pointsBalance = new Decimal(wallet.points_balance || '0');
      const tokenBalance = new Decimal(wallet.token_balance || '0');
      const tokenVesting = new Decimal(wallet.token_vesting || '0');

      // 估算总资产（假设 QFI 价格 $0.5）
      const qfiPrice = 0.5;
      const totalAsset = usdtBalance.plus(cardBalance).plus(tokenBalance.times(qfiPrice)).plus(tokenVesting.times(qfiPrice));

      const walletText = lang === 'zh'
        ? `━━━━━━━━━━━━━━━━━
💰 <b>钱包余额</b>
━━━━━━━━━━━━━━━━━

💵 USDT      <b>${formatNum(usdtBalance)}</b>
💳 点卡       <b>${formatNum(cardBalance)}</b>
⭐ 积分       <b>${formatInt(pointsBalance)}</b>
🪙 QFI        <b>${formatNum(tokenBalance)}</b>
   └ 待释放   ${formatNum(tokenVesting)}

━━━━━━━━━━━━━━━━━
📊 总资产约: <b>$${formatNum(totalAsset)}</b>`
        : `━━━━━━━━━━━━━━━━━
💰 <b>Wallet Balance</b>
━━━━━━━━━━━━━━━━━

💵 USDT      <b>${formatNum(usdtBalance)}</b>
💳 Card       <b>${formatNum(cardBalance)}</b>
⭐ Points     <b>${formatInt(pointsBalance)}</b>
🪙 QFI        <b>${formatNum(tokenBalance)}</b>
   └ Vesting  ${formatNum(tokenVesting)}

━━━━━━━━━━━━━━━━━
📊 Total: <b>$${formatNum(totalAsset)}</b>`;

      // 构建操作按钮
      const walletButtons = this.webAppUrl
        ? {
            inline_keyboard: [
              [
                { text: lang === 'zh' ? '💳 充值' : '💳 Deposit', url: `${this.webAppUrl}/tg/wallet/deposit` },
                { text: lang === 'zh' ? '📤 提现' : '📤 Withdraw', url: `${this.webAppUrl}/tg/wallet/withdraw` },
              ],
              [
                { text: lang === 'zh' ? '🔄 刷新' : '🔄 Refresh', callback_data: 'cmd_wallet' },
                { text: lang === 'zh' ? '📊 账单' : '📊 Billing', url: `${this.webAppUrl}/tg/wallet/billing` },
              ],
            ],
          }
        : undefined;

      await ctx.reply(walletText, { parse_mode: 'HTML', reply_markup: walletButtons });
    } catch (err) {
      this.logger.error('获取钱包失败', err);
      await ctx.reply(t('wallet_error', lang));
    }
  }

  /**
   * /pnl 命令处理 - 多语言支持
   */
  private async handlePnl(ctx: Context) {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const lang = getUserLang(ctx);

    try {
      const user = await this.getUserByTelegramId(telegramId);
      if (!user) {
        return ctx.reply(t('please_bind_first', lang));
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const trades = await this.prisma.client.trade_history.findMany({
        where: {
          user_id: user.id,
          created_at: { gte: today },
        },
      });

      const totalPnl = trades.reduce((sum, t) => sum.plus(new Decimal(t.pnl?.toString() || '0')), new Decimal(0));
      const winCount = trades.filter((t) => new Decimal(t.pnl?.toString() || '0').gt(0)).length;
      const winRate = trades.length > 0 ? ((winCount / trades.length) * 100).toFixed(1) : '0';

      const pnlEmoji = totalPnl.gte(0) ? '📈' : '📉';

      const pnlText = lang === 'zh'
        ? `━━━━━━━━━━━━━━━━━
${pnlEmoji} <b>今日交易报告</b>
━━━━━━━━━━━━━━━━━

💰 今日盈亏   <b>${formatPnl(totalPnl)}</b>
📊 交易次数   <b>${trades.length}</b> 笔
✅ 胜率        <b>${winRate}%</b>
${trades.length > 0 ? `🏆 盈利笔数   <b>${winCount}</b> 笔` : ''}

━━━━━━━━━━━━━━━━━`
        : `━━━━━━━━━━━━━━━━━
${pnlEmoji} <b>Today's Report</b>
━━━━━━━━━━━━━━━━━

💰 PnL         <b>${formatPnl(totalPnl)}</b>
📊 Trades      <b>${trades.length}</b>
✅ Win Rate    <b>${winRate}%</b>
${trades.length > 0 ? `🏆 Wins        <b>${winCount}</b>` : ''}

━━━━━━━━━━━━━━━━━`;

      // 构建操作按钮
      const pnlButtons = this.webAppUrl
        ? {
            inline_keyboard: [
              [
                { text: lang === 'zh' ? '📜 交易历史' : '📜 History', url: `${this.webAppUrl}/tg/trading/history` },
                { text: lang === 'zh' ? '🤖 策略管理' : '🤖 Strategies', url: `${this.webAppUrl}/tg/strategies` },
              ],
              [{ text: lang === 'zh' ? '🔄 刷新' : '🔄 Refresh', callback_data: 'cmd_pnl' }],
            ],
          }
        : undefined;

      await ctx.reply(pnlText, { parse_mode: 'HTML', reply_markup: pnlButtons });
    } catch (err) {
      this.logger.error('获取盈亏失败', err);
      await ctx.reply(t('pnl_error', lang));
    }
  }

  /**
   * /checkin 命令处理 - 多语言支持
   */
  private async handleCheckin(ctx: Context) {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const lang = getUserLang(ctx);

    try {
      const user = await this.getUserByTelegramId(telegramId);
      if (!user) {
        return ctx.reply(t('please_bind_first', lang));
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // 检查今日是否已签到
      const existingCheckin = await this.prisma.client.billing_logs.findFirst({
        where: {
          user_id: user.id,
          billing_type: 'checkin',
          created_at: { gte: today, lt: tomorrow },
        },
      });

      if (existingCheckin) {
        return ctx.reply(t('checkin_already', lang));
      }

      // 执行签到
      const baseReward = 10;
      const orderId = `checkin_${user.id}_${Date.now()}`;

      await this.prisma.client.$transaction([
        this.prisma.client.billing_logs.create({
          data: {
            user_id: user.id,
            unique_order_id: orderId,
            billing_type: 'checkin',
            amount: new Decimal(baseReward),
            description: lang === 'zh' ? 'Telegram Bot 签到奖励' : 'Telegram Bot Check-in Reward',
            status: 'completed',
          },
        }),
        this.prisma.client.wallets.update({
          where: { user_id: user.id },
          data: { points_balance: { increment: baseReward } },
        }),
      ]);

      const successMsg = t('checkin_success', lang)(baseReward);
      await ctx.reply(successMsg, { parse_mode: 'HTML' });
    } catch (err) {
      this.logger.error('签到失败', err);
      await ctx.reply(t('checkin_error', lang));
    }
  }

  /**
   * /invite 命令处理 - 多语言支持
   */
  private async handleInvite(ctx: Context) {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const lang = getUserLang(ctx);

    try {
      const user = await this.getUserByTelegramId(telegramId);
      if (!user) {
        return ctx.reply(t('please_bind_first', lang));
      }

      const inviteCode = user.invite_code || '--------';
      const inviteLink = `https://t.me/TIZOCCBot?start=${inviteCode}`;

      const invitedCount = await this.prisma.client.users.count({
        where: { referred_by_user_id: user.id },
      });

      const inviteText = lang === 'zh'
        ? `<b>🎁 邀请好友赚收益</b>

📋 我的邀请码: <code>${inviteCode}</code>

🔗 邀请链接:
${inviteLink}

👥 已邀请: <b>${invitedCount}</b> 人

<b>💵 USDT 返佣（点卡燃烧）</b>
• 好友每次盈利，你从燃烧的点卡中获得 10%/5%

<b>🌟 积分返佣（购买/交易）</b>
• 好友购买点卡/订阅，你获得 10%/5% 积分
• 好友交易挖矿，你获得 5%/2.5% 积分

<b>📢 积分可质押赚取收益</b>`
        : `<b>🎁 Invite Friends & Earn</b>

📋 My Invite Code: <code>${inviteCode}</code>

🔗 Invite Link:
${inviteLink}

👥 Invited: <b>${invitedCount}</b> users

<b>💵 USDT Commission (Card Burning)</b>
• Earn 10%/5% from burned cards when friends profit

<b>🌟 Points Commission (Purchase/Trade)</b>
• Card/Subscription: 10%/5% points
• Trade Mining: 5%/2.5% points

<b>📢 Points can be staked to earn yields</b>`;

      await ctx.reply(inviteText, { parse_mode: 'HTML' });
    } catch (err) {
      this.logger.error('获取邀请信息失败', err);
      await ctx.reply(t('invite_error', lang));
    }
  }

  /**
   * /stake 命令处理 - 多语言支持
   */
  private async handleStake(ctx: Context) {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const lang = getUserLang(ctx);

    try {
      const user = await this.getUserByTelegramId(telegramId);
      if (!user) {
        return ctx.reply(t('please_bind_first', lang));
      }

      const stakes = await this.prisma.client.stakes.findMany({
        where: { user_id: user.id, status: 'active' },
      });

      if (stakes.length === 0) {
        const msg = lang === 'zh' ? '暂无质押记录' : 'No staking records';
        return ctx.reply(msg);
      }

      const stakeA = stakes.filter((s) => s.stake_type === 'A');
      const stakeB = stakes.filter((s) => s.stake_type === 'B');

      const totalPointsStaked = stakeA.reduce((sum, s) => sum.plus(new Decimal(s.amount.toString())), new Decimal(0));
      const totalTokenStaked = stakeB.reduce((sum, s) => sum.plus(new Decimal(s.amount.toString())), new Decimal(0));

      const stakeText = lang === 'zh'
        ? `<b>质押概览</b>

活跃质押: <b>${stakes.length}</b> 笔

A 类质押 (积分): <b>${totalPointsStaked.toFixed(0)}</b>
B 类质押 (代币): <b>${totalTokenStaked.toFixed(2)} QFI</b>`
        : `<b>Staking Overview</b>

Active Stakes: <b>${stakes.length}</b>

Type A (Points): <b>${totalPointsStaked.toFixed(0)}</b>
Type B (Token): <b>${totalTokenStaked.toFixed(2)} QFI</b>`;

      await ctx.reply(stakeText, { parse_mode: 'HTML' });
    } catch (err) {
      this.logger.error('获取质押失败', err);
      const errMsg = lang === 'zh' ? '获取质押信息失败，请稍后重试' : 'Failed to get staking info, please try again';
      await ctx.reply(errMsg);
    }
  }

  /**
   * /vesting 命令处理 - 多语言支持
   */
  private async handleVesting(ctx: Context) {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const lang = getUserLang(ctx);

    try {
      const user = await this.getUserByTelegramId(telegramId);
      if (!user) {
        return ctx.reply(t('please_bind_first', lang));
      }

      const vestingOrders = await this.prisma.client.token_orders.findMany({
        where: { user_id: user.id, status: 'vesting' },
        orderBy: { created_at: 'desc' },
        take: 5,
      });

      if (vestingOrders.length === 0) {
        const msg = lang === 'zh' ? '暂无待释放订单' : 'No pending vesting orders';
        return ctx.reply(msg);
      }

      const wallet = await this.prisma.client.wallets.findUnique({
        where: { user_id: user.id },
      });

      const totalVesting = new Decimal(wallet?.token_vesting?.toString() || '0');

      let msg = lang === 'zh'
        ? `<b>代币释放进度</b>\n\n待释放总量: <b>${totalVesting.toFixed(2)} QFI</b>\n\n释放中订单: ${vestingOrders.length} 个\n`
        : `<b>Token Vesting Progress</b>\n\nPending Total: <b>${totalVesting.toFixed(2)} QFI</b>\n\nVesting Orders: ${vestingOrders.length}\n`;

      vestingOrders.slice(0, 3).forEach((order, index) => {
        const total = new Decimal(order.tokens_total.toString());
        const released = new Decimal(order.tokens_released.toString());
        const progress = total.gt(0) ? released.div(total).times(100).toFixed(0) : '0';
        msg += `\n${index + 1}. #${order.id.slice(0, 8)}\n   ${released.toFixed(2)}/${total.toFixed(2)} QFI (${progress}%)`;
      });

      await ctx.reply(msg, { parse_mode: 'HTML' });
    } catch (err) {
      this.logger.error('获取释放进度失败', err);
      const errMsg = lang === 'zh' ? '获取释放进度失败，请稍后重试' : 'Failed to get vesting info, please try again';
      await ctx.reply(errMsg);
    }
  }

  /**
   * /rank 命令处理 - 多语言支持
   */
  private async handleRank(ctx: Context) {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const lang = getUserLang(ctx);

    try {
      const user = await this.getUserByTelegramId(telegramId);
      if (!user) {
        return ctx.reply(t('please_bind_first', lang));
      }

      const wallet = await this.prisma.client.wallets.findUnique({
        where: { user_id: user.id },
      });

      const points = new Decimal(wallet?.points_balance?.toString() || '0');

      const higherCount = await this.prisma.client.wallets.count({
        where: { points_balance: { gt: wallet?.points_balance || 0 } },
      });

      const totalUsers = await this.prisma.client.wallets.count();
      const rank = higherCount + 1;

      const rankText = lang === 'zh'
        ? `<b>我的排名</b>

积分排行
排名: <b>#${rank}</b> / ${totalUsers} 人
积分: <b>${points.toFixed(0)}</b>`
        : `<b>My Ranking</b>

Points Leaderboard
Rank: <b>#${rank}</b> / ${totalUsers} users
Points: <b>${points.toFixed(0)}</b>`;

      await ctx.reply(rankText, { parse_mode: 'HTML' });
    } catch (err) {
      this.logger.error('获取排名失败', err);
      const errMsg = lang === 'zh' ? '获取排名失败，请稍后重试' : 'Failed to get ranking, please try again';
      await ctx.reply(errMsg);
    }
  }

  /**
   * /strategies 命令处理 - 多语言支持
   */
  private async handleStrategies(ctx: Context) {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const lang = getUserLang(ctx);

    try {
      const user = await this.getUserByTelegramId(telegramId);
      if (!user) {
        return ctx.reply(t('please_bind_first', lang));
      }

      const activeConfigs = await this.prisma.client.user_strategy_configs.findMany({
        where: { user_id: user.id, is_active: true },
        include: { strategies: true },
      });

      if (activeConfigs.length === 0) {
        const msg = lang === 'zh' ? '暂无运行中的策略' : 'No active strategies';
        return ctx.reply(msg);
      }

      let msg = lang === 'zh'
        ? `<b>运行中策略</b> (${activeConfigs.length})\n`
        : `<b>Active Strategies</b> (${activeConfigs.length})\n`;

      activeConfigs.slice(0, 5).forEach((config, index) => {
        const unknownLabel = lang === 'zh' ? '未知策略' : 'Unknown Strategy';
        msg += `\n${index + 1}. ${config.strategies?.name || unknownLabel}`;
      });

      await ctx.reply(msg, { parse_mode: 'HTML' });
    } catch (err) {
      this.logger.error('获取策略失败', err);
      const errMsg = lang === 'zh' ? '获取策略信息失败，请稍后重试' : 'Failed to get strategies, please try again';
      await ctx.reply(errMsg);
    }
  }

  /**
   * /settings 命令处理 - 多语言支持
   */
  private async handleSettings(ctx: Context) {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const lang = getUserLang(ctx);

    try {
      const user = await this.getUserByTelegramId(telegramId);
      if (!user) {
        return ctx.reply(t('please_bind_first', lang));
      }

      const settingsText = lang === 'zh'
        ? `<b>通知设置</b>

当前状态:
交易通知: 开启
止损提醒: 开启
每日报告: 开启
系统公告: 开启

<i>更多设置请在 App 中操作</i>`
        : `<b>Notification Settings</b>

Current Status:
Trade Notifications: ON
Stop-Loss Alerts: ON
Daily Report: ON
System Announcements: ON

<i>More settings available in App</i>`;

      await ctx.reply(settingsText, { parse_mode: 'HTML' });
    } catch (err) {
      const errMsg = lang === 'zh' ? '获取设置失败，请稍后重试' : 'Failed to get settings, please try again';
      await ctx.reply(errMsg);
    }
  }

  /**
   * /lang 命令处理 - 语言切换
   * 用法: /lang 或 /lang zh 或 /lang en
   */
  private async handleLang(ctx: Context) {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const currentLang = getUserLang(ctx);

    // 检查是否带参数 /lang zh 或 /lang en
    const messageText = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
    const args = messageText.split(' ').slice(1);
    const targetLang = args[0]?.toLowerCase();

    if (targetLang === 'zh' || targetLang === 'cn' || targetLang === 'chinese') {
      setUserLang(telegramId, 'zh');
      await ctx.reply('✅ 语言已切换为中文\n\nLanguage switched to Chinese');
      return;
    }

    if (targetLang === 'en' || targetLang === 'english') {
      setUserLang(telegramId, 'en');
      await ctx.reply('✅ Language switched to English\n\n语言已切换为英文');
      return;
    }

    // 没有参数或参数无效，显示选择按钮
    const langText = currentLang === 'zh'
      ? `🌐 <b>语言设置</b>

当前语言: <b>中文</b>

选择你的语言 / Choose your language:`
      : `🌐 <b>Language Settings</b>

Current: <b>English</b>

选择你的语言 / Choose your language:`;

    await ctx.reply(langText, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🇨🇳 中文', callback_data: 'lang_zh' },
            { text: '🇬🇧 English', callback_data: 'lang_en' },
          ],
        ],
      },
    });
  }

  /**
   * Callback Query 处理 - 多语言支持
   */
  private async handleCallbackQuery(ctx: Context) {
    const callbackQuery = ctx.callbackQuery;
    if (!callbackQuery || !('data' in callbackQuery)) return;

    const data = callbackQuery.data;
    const telegramId = ctx.from?.id;
    const lang = getUserLang(ctx);

    switch (data) {
      case 'cmd_wallet':
        await this.handleWallet(ctx);
        break;
      case 'cmd_pnl':
        await this.handlePnl(ctx);
        break;
      case 'cmd_checkin':
        await this.handleCheckin(ctx);
        break;
      case 'cmd_invite':
        await this.handleInvite(ctx);
        break;
      case 'cmd_stake':
        await this.handleStake(ctx);
        break;
      case 'cmd_rank':
        await this.handleRank(ctx);
        break;
      case 'cmd_help':
        await this.handleHelp(ctx);
        break;
      case 'cmd_vesting':
        await this.handleVesting(ctx);
        break;
      case 'cmd_strategies':
        await this.handleStrategies(ctx);
        break;
      case 'cmd_bind':
        await this.handleBind(ctx);
        break;
      case 'cmd_lang':
        await this.handleLang(ctx);
        break;
      case 'cancel_bind':
        // 取消绑定等待状态
        if (telegramId) {
          this.bindingWaitState.delete(telegramId);
        }
        const cancelMsg = lang === 'zh'
          ? '已取消绑定\n\n如需重新绑定，请输入 /bind'
          : 'Binding cancelled\n\nTo rebind, type /bind';
        await ctx.reply(cancelMsg);
        break;
      case 'lang_zh':
        // 切换到中文
        if (telegramId) {
          setUserLang(telegramId, 'zh');
          await ctx.reply('✅ 语言已切换为中文');
        }
        break;
      case 'lang_en':
        // 切换到英文
        if (telegramId) {
          setUserLang(telegramId, 'en');
          await ctx.reply('✅ Language switched to English');
        }
        break;
      default:
        break;
    }

    await ctx.answerCbQuery();
  }

  /**
   * 根据 Telegram ID 获取用户
   */
  private async getUserByTelegramId(telegramId: number) {
    return this.prisma.client.users.findFirst({
      where: { telegram_id: BigInt(telegramId) },
    });
  }

  // ==================== 推送通知方法 ====================

  /**
   * 发送消息给用户（通用方法）
   */
  async sendMessage(
    telegramId: number | bigint,
    text: string,
    options?: { parseMode?: 'HTML' | 'Markdown'; replyMarkup?: any },
  ): Promise<boolean> {
    if (!this.bot) {
      this.logger.warn('Bot 未初始化，无法发送消息');
      return false;
    }

    try {
      const chatId = typeof telegramId === 'bigint' ? Number(telegramId) : telegramId;
      await this.bot.telegram.sendMessage(chatId, text, {
        parse_mode: options?.parseMode || 'HTML',
        reply_markup: options?.replyMarkup,
      });
      return true;
    } catch (error) {
      this.logger.error(`发送消息失败: ${error}`);
      return false;
    }
  }

  /**
   * 发送交易开仓通知
   */
  async sendTradeOpenNotification(
    userId: string,
    data: { strategyName: string; symbol: string; side: 'long' | 'short'; amount: string; price: string },
  ): Promise<boolean> {
    const user = await this.prisma.client.users.findUnique({
      where: { id: userId },
      select: { telegram_id: true },
    });

    if (!user?.telegram_id) return false;

    const sideText = data.side === 'long' ? '做多' : '做空';
    const timeStr = new Date().toLocaleString('zh-CN');

    const message = `📈 <b>策略开仓</b>

🤖 策略: ${data.strategyName}
📊 交易对: ${data.symbol}
📍 方向: ${sideText}
💰 数量: ${data.amount}
💵 价格: $${formatNum(data.price)}

⏰ ${timeStr}`;

    return this.sendMessage(user.telegram_id, message);
  }

  /**
   * 发送交易平仓通知
   */
  async sendTradeCloseNotification(
    userId: string,
    data: { strategyName: string; symbol: string; profit: string; profitPercent: string },
  ): Promise<boolean> {
    const user = await this.prisma.client.users.findUnique({
      where: { id: userId },
      select: { telegram_id: true },
    });

    if (!user?.telegram_id) return false;

    const profitNum = parseFloat(data.profit);
    const emoji = profitNum >= 0 ? '📈' : '📉';
    const profitText = formatPnl(profitNum);
    const timeStr = new Date().toLocaleString('zh-CN');

    const message = `${emoji} <b>策略平仓</b>

🤖 策略: ${data.strategyName}
📊 交易对: ${data.symbol}
💰 盈亏: <b>${profitText}</b> (${data.profitPercent}%)

⏰ ${timeStr}`;

    return this.sendMessage(user.telegram_id, message);
  }

  /**
   * 发送止损触发通知
   */
  async sendStopLossNotification(
    userId: string,
    data: { strategyName: string; symbol: string; loss: string; lossPercent: string; stopPrice: string },
  ): Promise<boolean> {
    const user = await this.prisma.client.users.findUnique({
      where: { id: userId },
      select: { telegram_id: true },
    });

    if (!user?.telegram_id) return false;

    const timeStr = new Date().toLocaleString('zh-CN');

    const message = `⚠️ <b>止损触发</b>

🤖 策略: ${data.strategyName}
📊 交易对: ${data.symbol}
📉 亏损: <b>-$${formatNum(data.loss)}</b> (${data.lossPercent}%)
💵 止损价: $${formatNum(data.stopPrice)}

⏰ ${timeStr}`;

    return this.sendMessage(user.telegram_id, message);
  }

  /**
   * 发送充值到账通知
   */
  async sendDepositNotification(
    userId: string,
    data: { amount: string; chain: string; txHash?: string },
  ): Promise<boolean> {
    const user = await this.prisma.client.users.findUnique({
      where: { id: userId },
      select: { telegram_id: true },
    });

    if (!user?.telegram_id) return false;

    const timeStr = new Date().toLocaleString('zh-CN');

    const message = `✅ <b>充值到账</b>

💰 金额: <b>$${formatNum(data.amount)} USDT</b>
🔗 链: ${data.chain}
${data.txHash ? `📋 TxHash: <code>${data.txHash.slice(0, 16)}...</code>` : ''}

⏰ ${timeStr}`;

    return this.sendMessage(user.telegram_id, message);
  }

  /**
   * 发送提现完成通知
   */
  async sendWithdrawNotification(
    userId: string,
    data: { amount: string; chain: string; address: string; txHash?: string },
  ): Promise<boolean> {
    const user = await this.prisma.client.users.findUnique({
      where: { id: userId },
      select: { telegram_id: true },
    });

    if (!user?.telegram_id) return false;

    const timeStr = new Date().toLocaleString('zh-CN');

    const message = `📤 <b>提现完成</b>

💰 金额: <b>$${formatNum(data.amount)} USDT</b>
🔗 链: ${data.chain}
📍 地址: <code>${data.address.slice(0, 10)}...${data.address.slice(-6)}</code>
${data.txHash ? `📋 TxHash: <code>${data.txHash.slice(0, 16)}...</code>` : ''}

⏰ ${timeStr}`;

    return this.sendMessage(user.telegram_id, message);
  }

  /**
   * 发送分红到账通知
   */
  async sendDividendNotification(
    userId: string,
    data: { usdtAmount: string; qfiAmount: string },
  ): Promise<boolean> {
    const user = await this.prisma.client.users.findUnique({
      where: { id: userId },
      select: { telegram_id: true },
    });

    if (!user?.telegram_id) return false;

    const timeStr = new Date().toLocaleString('zh-CN');

    const message = `🎁 <b>周分红到账</b>

💵 USDT: <b>+$${formatNum(data.usdtAmount)}</b> (已到账)
🪙 QFI: <b>+${formatNum(data.qfiAmount)}</b> (90天释放)

⏰ ${timeStr}`;

    return this.sendMessage(user.telegram_id, message);
  }

  /**
   * 发送每日报告
   */
  async sendDailyReport(
    userId: string,
    data: { totalPnl: string; tradeCount: number; winRate: string; bestTrade?: { symbol: string; profit: string }; activeStrategies: number },
  ): Promise<boolean> {
    const user = await this.prisma.client.users.findUnique({
      where: { id: userId },
      select: { telegram_id: true },
    });

    if (!user?.telegram_id) return false;

    const pnlNum = parseFloat(data.totalPnl);
    const pnlEmoji = pnlNum >= 0 ? '📈' : '📉';
    const pnlText = formatPnl(pnlNum);

    const message = `📊 <b>今日交易报告</b>

💰 今日盈亏: <b>${pnlText}</b>
${pnlEmoji} 交易次数: <b>${formatInt(data.tradeCount)}</b> 笔
✅ 胜率: <b>${data.winRate}%</b>
${data.bestTrade ? `🏆 最佳: ${data.bestTrade.symbol} +$${formatNum(data.bestTrade.profit)}` : ''}

🤖 运行策略: <b>${data.activeStrategies}</b> 个`;

    return this.sendMessage(user.telegram_id, message);
  }

  /**
   * 发送邀请成功通知
   */
  async sendInviteSuccessNotification(userId: string, data: { inviteeName: string }): Promise<boolean> {
    const user = await this.prisma.client.users.findUnique({
      where: { id: userId },
      select: { telegram_id: true },
    });

    if (!user?.telegram_id) return false;

    const message = `🎉 <b>邀请成功</b>

新用户 <b>${data.inviteeName}</b> 通过您的邀请加入了 QuantFi！

继续邀请好友，赚取更多返佣 💰`;

    return this.sendMessage(user.telegram_id, message);
  }

  /**
   * 发送质押到期提醒
   */
  async sendStakeExpiryNotification(
    userId: string,
    data: { stakeType: string; amount: string; expiryDate: string; daysRemaining: number },
  ): Promise<boolean> {
    const user = await this.prisma.client.users.findUnique({
      where: { id: userId },
      select: { telegram_id: true },
    });

    if (!user?.telegram_id) return false;

    const typeLabel = data.stakeType === 'A' ? '积分' : 'QFI';
    const typeStake = data.stakeType === 'A' ? '积分质押' : 'QFI 质押';

    const message = `⏰ <b>质押到期提醒</b>

🔐 质押类型: ${typeStake}
💰 金额: <b>${formatNum(data.amount)}</b> ${typeLabel}
📅 到期日: ${data.expiryDate}
⏳ 剩余: <b>${data.daysRemaining}</b> 天

到期后可解押或续押`;

    return this.sendMessage(user.telegram_id, message);
  }

  /**
   * 发送系统公告
   */
  async broadcastAnnouncement(
    title: string,
    content: string,
    targetUserIds?: string[],
  ): Promise<{ success: number; failed: number }> {
    let users;

    if (targetUserIds && targetUserIds.length > 0) {
      users = await this.prisma.client.users.findMany({
        where: { id: { in: targetUserIds }, telegram_id: { not: null } },
        select: { telegram_id: true },
      });
    } else {
      users = await this.prisma.client.users.findMany({
        where: { telegram_id: { not: null } },
        select: { telegram_id: true },
      });
    }

    const message = `📢 <b>${title}</b>\n\n${content}`;

    let success = 0;
    let failed = 0;

    for (const user of users) {
      if (user.telegram_id) {
        const result = await this.sendMessage(user.telegram_id, message);
        if (result) success++;
        else failed++;
        // 限速
        await new Promise((resolve) => setTimeout(resolve, 40));
      }
    }

    return { success, failed };
  }
}
