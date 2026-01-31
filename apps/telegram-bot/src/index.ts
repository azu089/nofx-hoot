/**
 * HOOT Telegram Bot
 * 基于 grammY 框架 + Express HTTP API
 * 支持多语言 (中文/English)
 */
import { Bot, Context, session, SessionFlavor, InlineKeyboard } from 'grammy';
import express, { Request, Response } from 'express';
import cors from 'cors';
import 'dotenv/config';
import {
  Language,
  getLanguageFromCode,
  getLocale,
  t,
  LocaleMessages,
} from './i18n/locales';

// 配置
const WEB_APP_URL = process.env.WEB_APP_URL || 'https://hoot.cool';
const GROUP_URL = process.env.GROUP_URL || 'https://t.me/hoot_community';
const CHANNEL_URL = process.env.CHANNEL_URL || 'https://t.me/hoot_ann';
import {
  getUserByTelegramId,
  bindTelegram,
  getPositionsByTelegramId,
  getStrategies,
  getEarningsByTelegramId,
  telegramLogin,
  checkinByTelegramId,
  getCheckinStatus,
  getInviteInfo,
} from './utils/api';

// 空投奖励配置（与后端保持一致）
const AIRDROP_REWARDS = {
  register: 50,
  invite: 50,
  tradingMultiplier: 5,
  checkinMin: 5,
  checkinMax: 30,
};

// Session 类型
interface SessionData {
  userId?: string;
  isLoggedIn: boolean;
  language: Language;
}

// 扩展 Context 类型
type MyContext = Context & SessionFlavor<SessionData>;

// 获取用户语言设置
function getUserLang(ctx: MyContext): Language {
  // 优先使用 session 中保存的语言
  if (ctx.session?.language) {
    return ctx.session.language;
  }
  // 其次根据 Telegram 语言自动检测
  return getLanguageFromCode(ctx.from?.language_code);
}

// 获取本地化消息
function getMsg(ctx: MyContext): LocaleMessages {
  return getLocale(getUserLang(ctx));
}

// 检查环境变量
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!BOT_TOKEN) {
  throw new Error('TELEGRAM_BOT_TOKEN 环境变量未设置');
}

const HTTP_PORT = parseInt(process.env.HTTP_PORT || '4002', 10);

// 创建 Bot 实例
const bot = new Bot<MyContext>(BOT_TOKEN);

// 初始化 Session
bot.use(
  session({
    initial: (): SessionData => ({
      isLoggedIn: false,
      language: 'en', // 默认英文，首次命令时根据 TG 语言自动设置
    }),
  })
);

// ==================== Bot 命令 ====================

// 主菜单按钮
function getMainMenu(lang: Language) {
  const msg = getLocale(lang);
  return new InlineKeyboard()
    .webApp(msg.menu.openApp, WEB_APP_URL)
    .row()
    .text(msg.menu.checkin, 'checkin')
    .text(msg.menu.invite, 'invite')
    .row()
    .url(msg.menu.joinGroup, GROUP_URL)
    .url(msg.menu.channel, CHANNEL_URL);
}

// /start 命令 - 自动登录/注册
bot.command('start', async (ctx) => {
  const telegramId = ctx.from?.id.toString();
  const username = ctx.from?.username;
  const firstName = ctx.from?.first_name;
  const lastName = ctx.from?.last_name;
  if (!telegramId) return;

  // 自动检测并设置语言
  if (!ctx.session.language || ctx.session.language === 'en') {
    ctx.session.language = getLanguageFromCode(ctx.from?.language_code);
  }
  const lang = getUserLang(ctx);
  const msg = getMsg(ctx);

  try {
    // 调用自动登录 API（不存在会自动注册）
    const result = await telegramLogin({
      telegramId,
      telegramUsername: username,
      firstName,
      lastName,
    });

    ctx.session.isLoggedIn = true;
    ctx.session.userId = result.user.id;

    const nickname = result.user.nickname || username || (lang === 'zh' ? '用户' : 'User');

    if (result.isNewUser) {
      // 新用户欢迎
      await ctx.reply(
        t(msg.start.welcomeNew, {
          nickname,
          reward: AIRDROP_REWARDS.register,
        }),
        {
          parse_mode: 'HTML',
          reply_markup: getMainMenu(lang),
        }
      );
    } else {
      // 老用户欢迎
      const usdt = parseFloat(result.user.usdtBalance || '0').toFixed(2);
      const hoot = parseFloat(result.user.hootBalance || '0').toFixed(0);

      await ctx.reply(
        t(msg.start.welcomeBack, { nickname, usdt, hoot }),
        {
          parse_mode: 'HTML',
          reply_markup: getMainMenu(lang),
        }
      );
    }
  } catch (error) {
    console.error('TG 自动登录失败:', error);
    await ctx.reply(msg.start.loginFailed, { parse_mode: 'HTML' });
  }
});

// /help 命令
bot.command('help', async (ctx) => {
  const msg = getMsg(ctx);
  const lang = getUserLang(ctx);

  const helpKeyboard = new InlineKeyboard()
    .webApp(msg.menu.openApp, WEB_APP_URL)
    .url(msg.menu.joinGroup, GROUP_URL);

  await ctx.reply(
    `${msg.help.title}\n` +
      `${msg.help.account}\n` +
      `${msg.help.trading}\n` +
      `${msg.help.other}\n\n` +
      `${msg.help.notifications}`,
    {
      parse_mode: 'HTML',
      reply_markup: helpKeyboard,
    }
  );
});

// /bind 命令 - 绑定邮箱（合并已有邮箱账户）
bot.command('bind', async (ctx) => {
  const telegramId = ctx.from?.id.toString();
  const username = ctx.from?.username;
  if (!telegramId) return;

  const msg = getMsg(ctx);

  // 检查是否已绑定
  const existingUser = await getUserByTelegramId(telegramId);

  if (existingUser?.email) {
    await ctx.reply(t(msg.bind.alreadyBound, { email: existingUser.email }));
    return;
  }

  // 获取绑定码（用于合并已有邮箱账户）
  const args = ctx.message?.text?.split(' ').slice(1);
  const bindCode = args?.[0];

  if (!bindCode) {
    await ctx.reply(
      `${msg.bind.howTo}\n\n` +
        `${msg.bind.steps}\n\n` +
        `${msg.bind.newUserHint}`
    );
    return;
  }

  try {
    const user = await bindTelegram({
      telegramId,
      telegramUsername: username,
      bindCode,
    });

    ctx.session.isLoggedIn = true;
    ctx.session.userId = user.id;

    const lang = getUserLang(ctx);
    const nickname = user.nickname || (lang === 'zh' ? '未设置' : 'Not set');

    await ctx.reply(
      `${msg.bind.success}\n\n` +
        `${t(msg.status.email, { email: user.email })}\n` +
        `${t(msg.status.nickname, { name: nickname })}\n\n` +
        `${msg.bind.nowCanUse}`
    );
  } catch (error) {
    await ctx.reply(t(msg.bind.failed, { error: error instanceof Error ? error.message : 'Unknown error' }));
  }
});

// /status 命令 - 账户状态
bot.command('status', async (ctx) => {
  const telegramId = ctx.from?.id.toString();
  const username = ctx.from?.username;
  if (!telegramId) return;

  const msg = getMsg(ctx);

  // 自动登录获取用户信息
  try {
    const result = await telegramLogin({
      telegramId,
      telegramUsername: username,
    });

    const user = result.user;

    await ctx.reply(
      `${msg.status.title}\n` +
        `${t(msg.status.nickname, { name: user.nickname || username || msg.status.notBound })}\n` +
        `${t(msg.status.email, { email: user.email || msg.status.notBound })}\n\n` +
        `${t(msg.status.assets, { usdt: user.usdtBalance || '0', hoot: user.hootBalance || '0' })}`
    );
  } catch (error) {
    await ctx.reply(msg.status.failed);
  }
});

// /positions 命令 - 查看持仓
bot.command('positions', async (ctx) => {
  const telegramId = ctx.from?.id.toString();
  if (!telegramId) return;

  const msg = getMsg(ctx);

  try {
    // 确保用户已登录
    await telegramLogin({ telegramId, telegramUsername: ctx.from?.username });

    const positions = await getPositionsByTelegramId(telegramId);

    if (positions.length === 0) {
      await ctx.reply(msg.positions.noPosition);
      return;
    }

    let message = `${t(msg.positions.title, { count: positions.length })}\n\n`;

    for (const pos of positions) {
      const pnlDisplay = pos.pnl
        ? (parseFloat(pos.pnl) >= 0 ? '📈 +' : '📉 ') + pos.pnl
        : '';

      message +=
        `${pos.symbol} ${pos.side.toUpperCase()}\n` +
        `${t(msg.positions.entry, { price: pos.entryPrice })}\n` +
        `${t(msg.positions.amount, { amount: pos.amount })}\n` +
        `${pnlDisplay ? `• PnL: ${pnlDisplay}\n` : ''}` +
        `\n`;
    }

    await ctx.reply(message);
  } catch (error) {
    await ctx.reply(msg.positions.failed);
  }
});

// /strategies 命令 - 策略列表
bot.command('strategies', async (ctx) => {
  const msg = getMsg(ctx);

  try {
    const strategies = await getStrategies();

    if (strategies.length === 0) {
      await ctx.reply(msg.strategies.empty);
      return;
    }

    let message = `${msg.strategies.title}\n\n`;

    for (const strategy of strategies) {
      message += `🎯 ${strategy.name}\n${strategy.description}\n\n`;
    }

    message += msg.strategies.visitWeb;

    await ctx.reply(message);
  } catch (error) {
    await ctx.reply(msg.strategies.failed);
  }
});

// /earnings 命令 - 收益统计
bot.command('earnings', async (ctx) => {
  const telegramId = ctx.from?.id.toString();
  if (!telegramId) return;

  const msg = getMsg(ctx);

  try {
    // 确保用户已登录
    await telegramLogin({ telegramId, telegramUsername: ctx.from?.username });

    const earnings = await getEarningsByTelegramId(telegramId);

    const todayPnl = parseFloat(earnings.todayPnl || '0');
    const weekPnl = parseFloat(earnings.weekPnl || '0');
    const monthPnl = parseFloat(earnings.monthPnl || '0');
    const totalPnl = parseFloat(earnings.totalPnl || '0');

    const formatPnl = (pnl: number) => {
      const sign = pnl >= 0 ? '+' : '';
      const emoji = pnl >= 0 ? '📈' : '📉';
      return `${emoji} ${sign}${pnl.toFixed(2)} USDT`;
    };

    await ctx.reply(
      `${msg.earnings.title}\n\n` +
        `${t(msg.earnings.today, { pnl: formatPnl(todayPnl) })}\n` +
        `${t(msg.earnings.week, { pnl: formatPnl(weekPnl) })}\n` +
        `${t(msg.earnings.month, { pnl: formatPnl(monthPnl) })}\n` +
        `${t(msg.earnings.total, { pnl: formatPnl(totalPnl) })}\n\n` +
        `${t(msg.earnings.trades, { count: earnings.tradeCount || 0 })}\n` +
        `${t(msg.earnings.winRate, { rate: earnings.winRate || '0' })}`
    );
  } catch (error) {
    await ctx.reply(msg.earnings.failed);
  }
});

// /balance 命令 - HOOT 余额查询
bot.command('balance', async (ctx) => {
  const telegramId = ctx.from?.id.toString();
  if (!telegramId) return;

  const msg = getMsg(ctx);

  try {
    const result = await telegramLogin({
      telegramId,
      telegramUsername: ctx.from?.username,
    });

    const hoot = parseFloat(result.user.hootBalance || '0').toFixed(0);

    await ctx.reply(
      `${msg.balance.title}\n` +
        `${t(msg.balance.current, { amount: hoot })}\n` +
        `━━━━━━━━━━━━━━━━\n\n` +
        `${msg.balance.chainNotice}\n\n` +
        `${msg.balance.howToGet}\n` +
        `${t(msg.balance.register, { amount: AIRDROP_REWARDS.register })}\n` +
        `${t(msg.balance.invite, { amount: AIRDROP_REWARDS.invite })}\n` +
        `${t(msg.balance.trading, { multiplier: AIRDROP_REWARDS.tradingMultiplier })}\n` +
        `${t(msg.balance.checkin, { min: AIRDROP_REWARDS.checkinMin, max: AIRDROP_REWARDS.checkinMax })}`,
      { parse_mode: 'HTML' }
    );
  } catch (error) {
    await ctx.reply(msg.balance.failed);
  }
});

// /checkin 命令 - 每日签到
bot.command('checkin', async (ctx) => {
  const telegramId = ctx.from?.id.toString();
  if (!telegramId) return;

  await handleCheckin(ctx, telegramId);
});

// 签到处理函数
async function handleCheckin(ctx: MyContext, telegramId: string) {
  const msg = getMsg(ctx);

  try {
    const result = await checkinByTelegramId(telegramId);

    if (result.success) {
      const streakTip = result.streak >= 7 ? msg.checkin.streak7 : msg.checkin.streakTip;
      await ctx.reply(
        t(msg.checkin.success, { reward: result.reward, streak: result.streak }) + streakTip,
        { parse_mode: 'HTML' }
      );
    } else {
      await ctx.reply(
        t(msg.checkin.alreadyChecked, { streak: result.streak }),
        { parse_mode: 'HTML' }
      );
    }
  } catch (error) {
    console.error('签到失败:', error);
    await ctx.reply(msg.checkin.failed);
  }
}

// /invite 命令 - 邀请好友
bot.command('invite', async (ctx) => {
  const telegramId = ctx.from?.id.toString();
  if (!telegramId) return;

  await handleInvite(ctx, telegramId);
});

// 邀请处理函数
async function handleInvite(ctx: MyContext, telegramId: string) {
  const msg = getMsg(ctx);

  try {
    const info = await getInviteInfo(telegramId);

    const inviteKeyboard = new InlineKeyboard()
      .url(msg.invite.share, `https://t.me/share/url?url=${encodeURIComponent(info.inviteLink)}&text=${encodeURIComponent(msg.invite.shareText)}`)
      .row()
      .text(msg.invite.copyCode, `copy_invite_${info.inviteCode}`);

    await ctx.reply(
      `${msg.invite.title}\n` +
        `${t(msg.invite.code, { code: info.inviteCode })}\n` +
        `${t(msg.invite.invited, { count: info.inviteeCount })}\n` +
        `${t(msg.invite.totalReward, { amount: info.totalReward })}\n` +
        `━━━━━━━━━━━━━━━━\n\n` +
        `<b>${getUserLang(ctx) === 'zh' ? '邀请奖励:' : 'Rewards:'}</b>\n` +
        `${t(msg.invite.perInvite, { amount: AIRDROP_REWARDS.invite })}\n` +
        `${t(msg.invite.inviteeGet, { amount: AIRDROP_REWARDS.register })}\n\n` +
        `${t(msg.invite.link, { link: info.inviteLink })}`,
      {
        parse_mode: 'HTML',
        reply_markup: inviteKeyboard,
      }
    );
  } catch (error) {
    console.error('获取邀请信息失败:', error);
    await ctx.reply(msg.invite.failed);
  }
}

// /app 命令 - 打开应用
bot.command('app', async (ctx) => {
  const msg = getMsg(ctx);

  const keyboard = new InlineKeyboard()
    .webApp(msg.menu.openApp, WEB_APP_URL);

  await ctx.reply(
    `${msg.app.title}\n\n` +
      `${msg.app.features}\n\n` +
      `${msg.app.clickBelow}`,
    {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    }
  );
});

// /group 命令 - 加入社群
bot.command('group', async (ctx) => {
  const msg = getMsg(ctx);

  const keyboard = new InlineKeyboard()
    .url(msg.menu.joinGroup, GROUP_URL)
    .url(msg.menu.channel, CHANNEL_URL);

  await ctx.reply(
    `${msg.group.title}\n\n` +
      `${msg.group.community}\n` +
      `${msg.group.channel}\n\n` +
      `${msg.group.clickBelow}`,
    {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    }
  );
});

// ===== 回调按钮处理 =====

// 签到按钮回调
bot.callbackQuery('checkin', async (ctx) => {
  const telegramId = ctx.from?.id.toString();
  if (!telegramId) return;

  await ctx.answerCallbackQuery();
  await handleCheckin(ctx, telegramId);
});

// 邀请按钮回调
bot.callbackQuery('invite', async (ctx) => {
  const telegramId = ctx.from?.id.toString();
  if (!telegramId) return;

  await ctx.answerCallbackQuery();
  await handleInvite(ctx, telegramId);
});

// 复制邀请码回调
bot.callbackQuery(/^copy_invite_/, async (ctx) => {
  const inviteCode = ctx.callbackQuery.data.replace('copy_invite_', '');
  await ctx.answerCallbackQuery({
    text: `邀请码: ${inviteCode} (点击上方消息复制)`,
    show_alert: true,
  });
});

// /lang 命令 - 切换语言
bot.command('lang', async (ctx) => {
  const msg = getMsg(ctx);
  const currentLang = getUserLang(ctx);

  const langKeyboard = new InlineKeyboard()
    .text(msg.lang.chinese + (currentLang === 'zh' ? ' ✓' : ''), 'lang_zh')
    .text(msg.lang.english + (currentLang === 'en' ? ' ✓' : ''), 'lang_en');

  await ctx.reply(
    `${t(msg.lang.current, { lang: currentLang === 'zh' ? '中文' : 'English' })}\n\n` +
      `${msg.lang.switchTo}`,
    {
      parse_mode: 'HTML',
      reply_markup: langKeyboard,
    }
  );
});

// 语言切换回调
bot.callbackQuery(/^lang_/, async (ctx) => {
  const newLang = ctx.callbackQuery.data.replace('lang_', '') as Language;
  ctx.session.language = newLang;

  const msg = getLocale(newLang);
  await ctx.answerCallbackQuery({
    text: t(msg.lang.switched, { lang: newLang === 'zh' ? '中文' : 'English' }),
  });

  // 重新发送主菜单
  await ctx.editMessageText(
    t(msg.lang.switched, { lang: newLang === 'zh' ? '中文' : 'English' }),
    {
      parse_mode: 'HTML',
      reply_markup: getMainMenu(newLang),
    }
  );
});

// /unbind 命令 - 已废弃，给出说明
bot.command('unbind', async (ctx) => {
  const msg = getMsg(ctx);
  await ctx.reply(
    `${msg.unbind.info}\n\n` +
      `${msg.unbind.noNeed}\n\n` +
      `${msg.unbind.goWeb}`,
    { parse_mode: 'HTML' }
  );
});

// 处理未知命令
bot.on('message:text', async (ctx) => {
  if (ctx.message.text.startsWith('/')) {
    const msg = getMsg(ctx);
    await ctx.reply(msg.unknownCommand);
  }
});

// 错误处理
bot.catch((err) => {
  console.error('Bot 错误:', err);
});

// ==================== Express HTTP API ====================

const app = express();
app.use(cors());
app.use(express.json());

// 健康检查
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'hoot-telegram-bot' });
});

// 发送消息端点 - 供后端 API 调用
app.post('/send-message', async (req: Request, res: Response) => {
  try {
    const { telegramId, title, message, type } = req.body;

    if (!telegramId || !message) {
      return res.status(400).json({ error: '缺少必要参数: telegramId, message' });
    }

    // 格式化消息
    let formattedMessage = '';
    if (title) {
      formattedMessage = `${title}\n\n${message}`;
    } else {
      formattedMessage = message;
    }

    // 发送消息
    await bot.api.sendMessage(telegramId, formattedMessage, {
      parse_mode: 'HTML',
    });

    console.log(`✅ 消息已发送给 ${telegramId}: ${title || message.substring(0, 30)}`);
    res.json({ success: true });
  } catch (error) {
    console.error('发送消息失败:', error);
    res.status(500).json({
      error: '发送失败',
      message: error instanceof Error ? error.message : '未知错误'
    });
  }
});

// 批量发送消息
app.post('/send-bulk', async (req: Request, res: Response) => {
  try {
    const { messages } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: '缺少 messages 数组' });
    }

    const results = [];
    for (const msg of messages) {
      try {
        const { telegramId, title, message } = msg;
        const formattedMessage = title ? `${title}\n\n${message}` : message;

        await bot.api.sendMessage(telegramId, formattedMessage, {
          parse_mode: 'HTML',
        });

        results.push({ telegramId, success: true });
      } catch (err) {
        results.push({
          telegramId: msg.telegramId,
          success: false,
          error: err instanceof Error ? err.message : '未知错误'
        });
      }
    }

    res.json({ success: true, results });
  } catch (error) {
    console.error('批量发送失败:', error);
    res.status(500).json({ error: '批量发送失败' });
  }
});

// ==================== 启动服务 ====================

// 启动 Express HTTP 服务
app.listen(HTTP_PORT, () => {
  console.log(`🌐 HTTP API 服务已启动: http://localhost:${HTTP_PORT}`);
  console.log(`   - POST /send-message - 发送单条消息`);
  console.log(`   - POST /send-bulk - 批量发送消息`);
  console.log(`   - GET /health - 健康检查`);
});

// 启动 Bot
console.log('🤖 HOOT Telegram Bot 启动中...');
bot.start({
  onStart: (botInfo) => {
    console.log(`✅ Bot 已启动: @${botInfo.username}`);
  },
});
