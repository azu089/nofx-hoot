/**
 * HOOT Telegram Bot
 * 基于 grammY 框架 + Express HTTP API
 * 支持多语言 (中文/English)
 *
 * 7 核心命令: /start, /wallet, /trade, /checkin, /invite, /closeall, /help
 * 2 工具命令: /bind, /lang
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
  getEarningsByTelegramId,
  telegramLogin,
  checkinByTelegramId,
  getInviteInfo,
  getMySubscriptions,
  toggleSubscription,
  closeAllPositions,
  getApiKeys,
  getApiKeyBalance,
  getTradeHistory,
  getTradeLogs,
  getAiOverview,
  pauseAllAi,
  resumeAllAi,
} from './utils/api';

// 空投奖励配置 v4（与后端 airdrop.dto.ts 保持一致）
const AIRDROP_REWARDS = {
  register: 20,       // 注册 +20 HOOT
  invite: 15,         // 邀请 +15 HOOT（需被邀请人首次订阅策略后才发放）
  tradingMultiplier: 2, // 盈利 × 2 HOOT
  checkinMin: 2,      // 签到基础 2 HOOT
  checkinMax: 8,      // 签到最大 8 HOOT
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
  if (ctx.session?.language) {
    return ctx.session.language;
  }
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

// ==================== 主菜单 ====================

// 主菜单按钮面板 (5行)
function getMainMenu(lang: Language) {
  const msg = getLocale(lang);
  return new InlineKeyboard()
    .webApp(lang === 'zh' ? '🌐 打开 HOOT App' : '🌐 Open HOOT App', WEB_APP_URL + '/dashboard')
    .row()
    .text(msg.menu.wallet, 'menu_wallet')
    .text(msg.menu.trade, 'menu_trade')
    .row()
    .text(msg.menu.ai, 'menu_ai')
    .text(msg.menu.checkin, 'menu_checkin')
    .row()
    .text(msg.menu.invite, 'menu_invite')
    .text(msg.menu.closeAll, 'menu_closeall')
    .row()
    .text(msg.menu.help, 'menu_help')
    .text(msg.menu.switchLang, 'menu_lang')
    .row()
    .url(msg.menu.joinGroup, GROUP_URL)
    .url(msg.menu.channel, CHANNEL_URL);
}

// ==================== 功能面板构建 ====================

// 钱包面板消息
async function buildWalletMessage(telegramId: string, username: string | undefined, msg: LocaleMessages) {
  const result = await telegramLogin({ telegramId, telegramUsername: username });
  const user = result.user;

  const usdt = parseFloat(user.usdtBalance || '0').toFixed(2);
  const hoot = parseFloat(user.hootBalance || '0').toFixed(0);
  const point = parseFloat(user.pointBalance || '0').toFixed(2);

  let message =
    `${msg.wallet.title}\n` +
    `${msg.wallet.platformSection}\n` +
    `${t(msg.wallet.usdt, { amount: usdt })}\n` +
    `${t(msg.wallet.hoot, { amount: hoot })}\n` +
    `${t(msg.wallet.point, { amount: point })}\n` +
    `${msg.wallet.hootNotice}\n`;

  // 交易所余额
  try {
    const apiKeysResult = await getApiKeys(telegramId);

    if (!apiKeysResult.items || apiKeysResult.items.length === 0) {
      message += `${msg.wallet.exchangeSection}\n${msg.wallet.noApiKey}`;
    } else {
      message += `${msg.wallet.exchangeSection}\n`;
      for (const key of apiKeysResult.items) {
        try {
          const balance = await getApiKeyBalance(telegramId, key.id);
          message +=
            `\n💱 <b>${key.exchange.toUpperCase()}</b> (${key.label})\n` +
            `${t(msg.wallet.total, { amount: balance.balance.toFixed(2) })}\n` +
            `${t(msg.wallet.spot, { amount: balance.spotBalance.toFixed(2) })}\n` +
            `${t(msg.wallet.futures, { amount: balance.futuresBalance.toFixed(2) })}\n`;
        } catch {
          message += `${t(msg.wallet.queryFailed, { label: `${key.exchange.toUpperCase()} (${key.label})` })}\n`;
        }
      }
    }
  } catch {
    message += `${msg.wallet.exchangeSection}\n${msg.wallet.noApiKey}`;
  }

  return message;
}

// 交易面板消息
async function buildTradeMessage(telegramId: string, username: string | undefined, msg: LocaleMessages) {
  await telegramLogin({ telegramId, telegramUsername: username });

  let message = `${msg.trade.title}\n`;

  // 持仓区
  try {
    const positions = await getPositionsByTelegramId(telegramId);
    message += `${t(msg.trade.positionsSection, { count: positions.length })}\n`;

    if (positions.length === 0) {
      message += `${msg.trade.noPositions}\n`;
    } else {
      for (const pos of positions) {
        const pnlDisplay = pos.pnl
          ? (parseFloat(pos.pnl) >= 0 ? '📈 +' : '📉 ') + pos.pnl
          : '';
        message +=
          `  ${pos.symbol} ${pos.side.toUpperCase()}` +
          `  ${t(msg.trade.positionEntry, { price: pos.entryPrice })}` +
          `${pnlDisplay ? ` | ${pnlDisplay}` : ''}\n`;
      }
    }
  } catch {
    message += `${msg.trade.noPositions}\n`;
  }

  // 收益区
  try {
    const earnings = await getEarningsByTelegramId(telegramId);
    const todayPnl = parseFloat(earnings.todayPnl || '0');
    const totalPnl = parseFloat(earnings.totalPnl || '0');

    const formatPnl = (pnl: number) => {
      const sign = pnl >= 0 ? '+' : '';
      const emoji = pnl >= 0 ? '📈' : '📉';
      return `${emoji} ${sign}${pnl.toFixed(2)} USDT`;
    };

    message +=
      `${msg.trade.earningsSection}\n` +
      `${t(msg.trade.today, { pnl: formatPnl(todayPnl) })}\n` +
      `${t(msg.trade.total, { pnl: formatPnl(totalPnl) })}\n` +
      `${t(msg.trade.trades, { count: earnings.tradeCount || 0 })} | ${t(msg.trade.winRate, { rate: earnings.winRate || '0' })}\n`;
  } catch {
    // 收益查询失败，跳过
  }

  // 策略区
  try {
    const subscriptions = await getMySubscriptions(telegramId);
    message += `${msg.trade.strategiesSection}\n`;

    if (!subscriptions || subscriptions.length === 0) {
      message += `${msg.trade.noStrategies}\n`;
    } else {
      for (const sub of subscriptions) {
        const status = sub.isActive ? msg.trade.active : msg.trade.paused;
        message += `  ${status} ${sub.strategy.name} | ${t(msg.trade.strategyAmount, { amount: sub.amountPerTrade })}\n`;
      }
    }
  } catch {
    message += `${msg.trade.noStrategies}\n`;
  }

  return message;
}

// 交易面板子按钮
function getTradeKeyboard(msg: LocaleMessages) {
  return new InlineKeyboard()
    .text(msg.trade.btnHistory, 'trade_history')
    .text(msg.trade.btnLogs, 'trade_logs')
    .row()
    .text(msg.trade.btnManage, 'trade_strategies')
    .text(msg.trade.btnCloseAll, 'trade_closeall');
}

// AI 面板消息
async function buildAiMessage(telegramId: string, msg: LocaleMessages) {
  const overview = await getAiOverview(telegramId);

  const { solo, debate, research, todayPnl, budget } = overview;
  const hasAnything =
    solo.running + solo.paused + solo.stopped +
    debate.running + debate.paused + debate.stopped +
    research.cycling + research.stopped > 0;

  let message = `${msg.ai.title}\n`;

  if (!hasAnything) {
    message += `${msg.ai.noAi}\n`;
  } else {
    // 极速策略
    if (solo.running + solo.paused + solo.stopped > 0) {
      message +=
        `${msg.ai.soloSection}\n` +
        `${t(msg.ai.statusLine, { running: solo.running, paused: solo.paused, stopped: solo.stopped })}\n\n`;
    }

    // 共识策略
    if (debate.running + debate.paused + debate.stopped > 0) {
      message +=
        `${msg.ai.debateSection}\n` +
        `${t(msg.ai.statusLine, { running: debate.running, paused: debate.paused, stopped: debate.stopped })}\n\n`;
    }

    // 深度研究
    if (research.cycling + research.stopped > 0) {
      message +=
        `${msg.ai.researchSection}\n` +
        `${t(msg.ai.researchLine, { cycling: research.cycling, stopped: research.stopped })}\n\n`;
    }
  }

  // 今日 PnL
  const pnlSign = todayPnl >= 0 ? '+' : '';
  const pnlEmoji = todayPnl >= 0 ? '📈' : '📉';
  message +=
    `${msg.ai.todayPnl}\n` +
    `  ${pnlEmoji} ${pnlSign}${todayPnl.toFixed(2)} USDT\n\n`;

  // 预算
  message += `${t(msg.ai.budget, { used: budget.used.toFixed(2), limit: budget.limit.toFixed(0) })}\n`;

  return message;
}

// AI 面板按钮
function getAiKeyboard(msg: LocaleMessages, lang: Language) {
  return new InlineKeyboard()
    .text(msg.ai.btnPauseAll, 'ai_pause_all')
    .text(msg.ai.btnResumeAll, 'ai_resume_all')
    .row()
    .webApp(msg.ai.btnManageApp, WEB_APP_URL + '/ai');
}

// ==================== Bot 命令 ====================

// /start 命令 - 自动登录/注册 + 主菜单
bot.command('start', async (ctx) => {
  const telegramId = ctx.from?.id.toString();
  const username = ctx.from?.username;
  const firstName = ctx.from?.first_name;
  const lastName = ctx.from?.last_name;
  if (!telegramId) return;

  // 解析深度链接参数: /start ref_XXXXXXXX | /start login | /start register
  const args = ctx.message?.text?.split(' ').slice(1);
  const startParam = args?.[0];
  let referralCode: string | undefined;
  // 是否来自 Web App 登录/注册跳转（需要在登录成功后回传 token）
  const isWebLoginFlow = startParam === 'login' || startParam === 'register';
  if (startParam?.startsWith('ref_')) {
    referralCode = startParam.replace('ref_', '');
    console.log(`[TG Bot] 检测到邀请码: ${referralCode}`);
  }

  // 自动检测并设置语言
  if (!ctx.session.language || ctx.session.language === 'en') {
    ctx.session.language = getLanguageFromCode(ctx.from?.language_code);
  }
  const lang = getUserLang(ctx);
  const msg = getMsg(ctx);

  try {
    const result = await telegramLogin({
      telegramId,
      telegramUsername: username,
      firstName,
      lastName,
      referralCode,
    });

    ctx.session.isLoggedIn = true;
    ctx.session.userId = result.user.id;

    const nickname = result.user.nickname || username || (lang === 'zh' ? '用户' : 'User');

    // 如果是来自 Web App 登录跳转，发送 webApp 按钮打开 Mini App（确保 initData 注入自动登录）
    if (isWebLoginFlow) {
      const enterAppKeyboard = new InlineKeyboard()
        .webApp(lang === 'zh' ? '🚀 打开 HOOT App' : '🚀 Open HOOT App', WEB_APP_URL);

      const loginSuccessMsg = result.isNewUser
        ? (lang === 'zh'
            ? `✅ <b>注册成功！</b>\n\n欢迎 <b>${nickname}</b>，你已获得 <b>${AIRDROP_REWARDS.register} HOOT</b> 注册奖励！\n\n点击下方按钮进入应用 👇`
            : `✅ <b>Registered!</b>\n\nWelcome <b>${nickname}</b>! You received <b>${AIRDROP_REWARDS.register} HOOT</b> bonus!\n\nClick below to enter the app 👇`)
        : (lang === 'zh'
            ? `✅ <b>登录成功！</b>\n\n欢迎回来 <b>${nickname}</b>！\n\n点击下方按钮进入应用 👇`
            : `✅ <b>Login successful!</b>\n\nWelcome back <b>${nickname}</b>!\n\nClick below to enter the app 👇`);

      await ctx.reply(loginSuccessMsg, {
        parse_mode: 'HTML',
        reply_markup: enterAppKeyboard,
      });
      return;
    }

    if (result.isNewUser) {
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
      const usdt = parseFloat(result.user.usdtBalance || '0').toFixed(2);
      const hoot = parseFloat(result.user.hootBalance || '0').toFixed(0);
      const point = parseFloat(result.user.pointBalance || '0').toFixed(2);

      // 并行获取交易状态数据（不阻塞主流程）
      const [posResult, earningsResult, subsResult] = await Promise.allSettled([
        getPositionsByTelegramId(telegramId),
        getEarningsByTelegramId(telegramId),
        getMySubscriptions(telegramId),
      ]);

      const positions = posResult.status === 'fulfilled' ? posResult.value : [];
      const earnings = earningsResult.status === 'fulfilled' ? earningsResult.value : null;
      const subscriptions = subsResult.status === 'fulfilled' ? subsResult.value : [];

      const posCount = positions.length;
      const activeCount = subscriptions.filter(s => s.isActive).length;
      const todayPnl = parseFloat(earnings?.todayPnl || '0');
      const pnlSign = todayPnl >= 0 ? '+' : '';
      const pnlEmoji = todayPnl >= 0 ? '📈' : '📉';
      const pnlLabel = lang === 'zh' ? '今日盈亏' : "Today's PnL";
      const todayPnlStr = `${pnlEmoji} ${pnlLabel}: <b>${pnlSign}${todayPnl.toFixed(2)} USDT</b>`;

      await ctx.reply(
        t(msg.start.welcomeBack, {
          nickname, usdt, hoot, point,
          todayPnl: todayPnlStr,
          strategies: activeCount,
          positions: posCount,
        }),
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

// /wallet 命令 - 钱包总览（平台余额 + 交易所余额）
bot.command('wallet', async (ctx) => {
  const telegramId = ctx.from?.id.toString();
  if (!telegramId) return;

  const msg = getMsg(ctx);

  try {
    const message = await buildWalletMessage(telegramId, ctx.from?.username, msg);
    await ctx.reply(message, { parse_mode: 'HTML' });
  } catch (error) {
    console.error('钱包查询失败:', error);
    await ctx.reply(msg.wallet.failed);
  }
});

// /trade 命令 - 交易面板（持仓 + 收益 + 策略 + 子按钮）
bot.command('trade', async (ctx) => {
  const telegramId = ctx.from?.id.toString();
  if (!telegramId) return;

  const msg = getMsg(ctx);

  try {
    const message = await buildTradeMessage(telegramId, ctx.from?.username, msg);
    await ctx.reply(message, {
      parse_mode: 'HTML',
      reply_markup: getTradeKeyboard(msg),
    });
  } catch (error) {
    console.error('交易面板查询失败:', error);
    await ctx.reply(msg.trade.failed);
  }
});

// /ai 命令 - AI 交易总览
bot.command('ai', async (ctx) => {
  const telegramId = ctx.from?.id.toString();
  if (!telegramId) return;

  const msg = getMsg(ctx);
  const lang = getUserLang(ctx);

  try {
    const message = await buildAiMessage(telegramId, msg);
    await ctx.reply(message, {
      parse_mode: 'HTML',
      reply_markup: getAiKeyboard(msg, lang),
    });
  } catch (error) {
    console.error('AI 面板查询失败:', error);
    await ctx.reply(msg.ai.failed);
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
  const lang = getUserLang(ctx);

  try {
    const info = await getInviteInfo(telegramId);

    const botUsername = ctx.me?.username || 'HootBot';
    const botDeepLink = `https://t.me/${botUsername}?start=ref_${info.inviteCode}`;
    // 文字在上、链接在下（行业标准）：不用 url 参数，把文字+链接都放进 text 参数
    const botShareFullText = lang === 'zh'
      ? `🦉 加入 HOOT，通过 Bot 自动交易赚取收益！\n${botDeepLink}`
      : `🦉 Join HOOT — earn with automated trading!\n${botDeepLink}`;
    const inviteLinkShareText = lang === 'zh'
      ? `🦉 加入 HOOT，通过 Bot 自动交易赚取收益！\n${info.inviteLink}`
      : `🦉 Join HOOT — earn with automated trading!\n${info.inviteLink}`;

    const inviteKeyboard = new InlineKeyboard()
      .url(msg.invite.share, `https://t.me/share/url?text=${encodeURIComponent(inviteLinkShareText)}`)
      .row()
      .url(msg.invite.shareBot, `https://t.me/share/url?text=${encodeURIComponent(botShareFullText)}`)
      .row()
      .text(msg.invite.copyCode, `copy_invite_${info.inviteCode}`);

    await ctx.reply(
      `${msg.invite.title}\n` +
        `${t(msg.invite.code, { code: info.inviteCode })}\n` +
        `${t(msg.invite.invited, { count: info.inviteeCount })}\n` +
        `${t(msg.invite.totalReward, { amount: info.totalReward })}\n` +
        `━━━━━━━━━━━━━━━━\n\n` +
        `<b>${lang === 'zh' ? '邀请奖励:' : 'Rewards:'}</b>\n` +
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

// /closeall 命令 - 紧急全部平仓
bot.command('closeall', async (ctx) => {
  const telegramId = ctx.from?.id.toString();
  if (!telegramId) return;
  await handleCloseAll(ctx, telegramId);
});

// 紧急平仓处理函数
async function handleCloseAll(ctx: MyContext, telegramId: string) {
  const msg = getMsg(ctx);

  try {
    const apiKeysResult = await getApiKeys(telegramId);

    if (!apiKeysResult.items || apiKeysResult.items.length === 0) {
      await ctx.reply(msg.closeAll.noApiKey);
      return;
    }

    if (apiKeysResult.items.length === 1) {
      const key = apiKeysResult.items[0];
      const keyboard = new InlineKeyboard()
        .text(msg.closeAll.btnConfirm, `closeall_confirm_${key.id}`)
        .text(msg.closeAll.btnCancel, 'closeall_cancel');

      await ctx.reply(
        `${msg.closeAll.title}\n\n` +
        `${msg.closeAll.confirm}\n` +
        `${msg.closeAll.warning}\n\n` +
        `💱 ${key.exchange.toUpperCase()} (${key.label})`,
        {
          parse_mode: 'HTML',
          reply_markup: keyboard,
        }
      );
    } else {
      const keyboard = new InlineKeyboard();
      for (const key of apiKeysResult.items) {
        keyboard
          .text(`${key.exchange.toUpperCase()} - ${key.label}`, `closeall_select_${key.id}`)
          .row();
      }
      keyboard.text(msg.closeAll.btnCancel, 'closeall_cancel');

      await ctx.reply(
        `${msg.closeAll.title}\n\n` +
        `${msg.closeAll.selectKey}`,
        {
          parse_mode: 'HTML',
          reply_markup: keyboard,
        }
      );
    }
  } catch (error) {
    console.error('平仓命令失败:', error);
    await ctx.reply(msg.closeAll.failed);
  }
}

// /help 命令
bot.command('help', async (ctx) => {
  const msg = getMsg(ctx);

  await ctx.reply(
    `${msg.help.title}\n` +
      `${msg.help.commands}\n\n` +
      `${msg.help.notifications}`,
    { parse_mode: 'HTML' }
  );
});

// /bind 命令 - 绑定邮箱（合并已有邮箱账户）
bot.command('bind', async (ctx) => {
  const telegramId = ctx.from?.id.toString();
  const username = ctx.from?.username;
  if (!telegramId) return;

  const msg = getMsg(ctx);
  const lang = getUserLang(ctx);

  const existingUser = await getUserByTelegramId(telegramId);

  if (existingUser?.email) {
    await ctx.reply(t(msg.bind.alreadyBound, { email: existingUser.email }));
    return;
  }

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

    const nickname = user.nickname || (lang === 'zh' ? '未设置' : 'Not set');
    const emailLabel = lang === 'zh' ? '📧 邮箱' : '📧 Email';
    const nicknameLabel = lang === 'zh' ? '👤 昵称' : '👤 Nickname';

    await ctx.reply(
      `${msg.bind.success}\n\n` +
        `${emailLabel}: ${user.email}\n` +
        `${nicknameLabel}: ${nickname}\n\n` +
        `${msg.bind.nowCanUse}`
    );
  } catch (error) {
    await ctx.reply(t(msg.bind.failed, { error: error instanceof Error ? error.message : 'Unknown error' }));
  }
});

// /lang 命令 - 切换语言
bot.command('lang', async (ctx) => {
  await handleLangSwitch(ctx);
});

// 语言切换处理函数
async function handleLangSwitch(ctx: MyContext) {
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
}

// ==================== 主菜单按钮回调 ====================

// 钱包按钮
bot.callbackQuery('menu_wallet', async (ctx) => {
  const telegramId = ctx.from?.id.toString();
  if (!telegramId) return;

  await ctx.answerCallbackQuery();
  const msg = getMsg(ctx);

  try {
    const message = await buildWalletMessage(telegramId, ctx.from?.username, msg);
    const lang = getUserLang(ctx);
    const walletAppBtn = new InlineKeyboard()
      .webApp(lang === 'zh' ? '💰 充值/提现' : '💰 Deposit/Withdraw', WEB_APP_URL + '/wallet');
    await ctx.reply(message, { parse_mode: 'HTML', reply_markup: walletAppBtn });
  } catch (error) {
    console.error('钱包查询失败:', error);
    await ctx.reply(msg.wallet.failed);
  }
});

// 交易按钮
bot.callbackQuery('menu_trade', async (ctx) => {
  const telegramId = ctx.from?.id.toString();
  if (!telegramId) return;

  await ctx.answerCallbackQuery();
  const msg = getMsg(ctx);

  try {
    const message = await buildTradeMessage(telegramId, ctx.from?.username, msg);
    await ctx.reply(message, {
      parse_mode: 'HTML',
      reply_markup: getTradeKeyboard(msg),
    });
  } catch (error) {
    console.error('交易面板查询失败:', error);
    await ctx.reply(msg.trade.failed);
  }
});

// 签到按钮
bot.callbackQuery('menu_checkin', async (ctx) => {
  const telegramId = ctx.from?.id.toString();
  if (!telegramId) return;
  await ctx.answerCallbackQuery();
  await handleCheckin(ctx, telegramId);
});

// 邀请按钮
bot.callbackQuery('menu_invite', async (ctx) => {
  const telegramId = ctx.from?.id.toString();
  if (!telegramId) return;
  await ctx.answerCallbackQuery();
  await handleInvite(ctx, telegramId);
});

// 语言按钮
bot.callbackQuery('menu_lang', async (ctx) => {
  await ctx.answerCallbackQuery();
  await handleLangSwitch(ctx);
});

// 紧急平仓按钮
bot.callbackQuery('menu_closeall', async (ctx) => {
  const telegramId = ctx.from?.id.toString();
  if (!telegramId) return;
  await ctx.answerCallbackQuery();
  await handleCloseAll(ctx, telegramId);
});

// 帮助按钮
bot.callbackQuery('menu_help', async (ctx) => {
  await ctx.answerCallbackQuery();
  const msg = getMsg(ctx);

  await ctx.reply(
    `${msg.help.title}\n` +
      `${msg.help.commands}\n\n` +
      `${msg.help.notifications}`,
    { parse_mode: 'HTML' }
  );
});

// AI 按钮
bot.callbackQuery('menu_ai', async (ctx) => {
  const telegramId = ctx.from?.id.toString();
  if (!telegramId) return;

  await ctx.answerCallbackQuery();
  const msg = getMsg(ctx);
  const lang = getUserLang(ctx);

  try {
    const message = await buildAiMessage(telegramId, msg);
    await ctx.reply(message, {
      parse_mode: 'HTML',
      reply_markup: getAiKeyboard(msg, lang),
    });
  } catch (error) {
    console.error('AI 面板查询失败:', error);
    await ctx.reply(msg.ai.failed);
  }
});

// AI 暂停全部回调
bot.callbackQuery('ai_pause_all', async (ctx) => {
  const telegramId = ctx.from?.id.toString();
  if (!telegramId) return;

  const msg = getMsg(ctx);
  const lang = getUserLang(ctx);

  try {
    await ctx.answerCallbackQuery();
    const result = await pauseAllAi(telegramId);

    if (result.paused === 0) {
      await ctx.reply(msg.ai.pauseEmpty, { parse_mode: 'HTML' });
    } else {
      await ctx.reply(
        t(msg.ai.pauseSuccess, { count: result.paused }),
        { parse_mode: 'HTML' },
      );
    }

    // 刷新 AI 面板
    try {
      const message = await buildAiMessage(telegramId, msg);
      await ctx.reply(message, {
        parse_mode: 'HTML',
        reply_markup: getAiKeyboard(msg, lang),
      });
    } catch { /* 刷新失败不阻断 */ }
  } catch (error) {
    console.error('AI 暂停全部失败:', error);
    await ctx.answerCallbackQuery({ text: msg.ai.failed, show_alert: true });
  }
});

// AI 恢复全部回调
bot.callbackQuery('ai_resume_all', async (ctx) => {
  const telegramId = ctx.from?.id.toString();
  if (!telegramId) return;

  const msg = getMsg(ctx);
  const lang = getUserLang(ctx);

  try {
    await ctx.answerCallbackQuery();
    const result = await resumeAllAi(telegramId);

    if (result.resumed === 0) {
      await ctx.reply(msg.ai.resumeEmpty, { parse_mode: 'HTML' });
    } else {
      await ctx.reply(
        t(msg.ai.resumeSuccess, { count: result.resumed }),
        { parse_mode: 'HTML' },
      );
    }

    // 刷新 AI 面板
    try {
      const message = await buildAiMessage(telegramId, msg);
      await ctx.reply(message, {
        parse_mode: 'HTML',
        reply_markup: getAiKeyboard(msg, lang),
      });
    } catch { /* 刷新失败不阻断 */ }
  } catch (error) {
    console.error('AI 恢复全部失败:', error);
    await ctx.answerCallbackQuery({ text: msg.ai.failed, show_alert: true });
  }
});

// ==================== 交易子面板回调 ====================

// 交易记录子面板
bot.callbackQuery('trade_history', async (ctx) => {
  const telegramId = ctx.from?.id.toString();
  if (!telegramId) return;

  await ctx.answerCallbackQuery();
  const msg = getMsg(ctx);
  const lang = getUserLang(ctx);

  try {
    const trades = await getTradeHistory(telegramId, 10);

    if (!trades || trades.length === 0) {
      const keyboard = new InlineKeyboard()
        .text(msg.history.btnBack, 'back_trade');
      await ctx.reply(msg.history.empty, { reply_markup: keyboard });
      return;
    }

    let message = `${msg.history.title}\n`;

    for (const trade of trades) {
      const pnl = parseFloat(trade.pnl || '0');
      const pnlEmoji = pnl >= 0 ? '📈' : '📉';
      const pnlSign = pnl >= 0 ? '+' : '';

      const reasonMap: Record<string, string> = lang === 'zh'
        ? { signal: '信号', stop_loss: '止损', take_profit: '止盈', manual: '手动' }
        : { signal: 'Signal', stop_loss: 'Stop Loss', take_profit: 'Take Profit', manual: 'Manual' };

      message +=
        `\n${pnlEmoji} <b>${trade.symbol}</b> ${trade.side.toUpperCase()}\n` +
        `${t(msg.history.entry, { price: trade.entryPrice })}\n` +
        `${t(msg.history.close, { price: trade.closePrice })}\n` +
        `${t(msg.history.pnl, { pnl: `${pnlSign}${pnl.toFixed(2)} USDT` })}\n` +
        (trade.closeReason ? `${t(msg.history.reason, { reason: reasonMap[trade.closeReason] || trade.closeReason })}\n` : '');
    }

    const keyboard = new InlineKeyboard()
      .text(msg.history.btnBack, 'back_trade');

    await ctx.reply(message, {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    });
  } catch (error) {
    console.error('获取交易记录失败:', error);
    await ctx.reply(msg.history.failed);
  }
});

// 执行日志子面板
bot.callbackQuery('trade_logs', async (ctx) => {
  const telegramId = ctx.from?.id.toString();
  if (!telegramId) return;

  await ctx.answerCallbackQuery();
  const msg = getMsg(ctx);

  try {
    const logs = await getTradeLogs(telegramId, 15);

    if (!logs || logs.length === 0) {
      const keyboard = new InlineKeyboard()
        .text(msg.logs.btnBack, 'back_trade');
      await ctx.reply(msg.logs.empty, { reply_markup: keyboard });
      return;
    }

    let message = `${msg.logs.title}\n`;

    const statusEmoji: Record<string, string> = {
      success: '✅',
      warning: '⚠️',
      error: '❌',
    };

    for (const log of logs) {
      const time = new Date(log.time);
      const timeStr = `${(time.getMonth() + 1).toString().padStart(2, '0')}-${time.getDate().toString().padStart(2, '0')} ${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`;
      const emoji = statusEmoji[log.status] || '📝';

      message +=
        `\n${emoji} <code>${timeStr}</code> ${log.symbol || ''}\n` +
        `   ${log.strategy} | ${log.action}\n` +
        `   ${log.message}\n`;
    }

    const keyboard = new InlineKeyboard()
      .text(msg.logs.btnBack, 'back_trade');

    await ctx.reply(message, {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    });
  } catch (error) {
    console.error('获取执行日志失败:', error);
    await ctx.reply(msg.logs.failed);
  }
});

// 管理策略子面板
bot.callbackQuery('trade_strategies', async (ctx) => {
  const telegramId = ctx.from?.id.toString();
  if (!telegramId) return;

  await ctx.answerCallbackQuery();
  const msg = getMsg(ctx);

  try {
    const subscriptions = await getMySubscriptions(telegramId);

    if (!subscriptions || subscriptions.length === 0) {
      const keyboard = new InlineKeyboard()
        .text(msg.logs.btnBack, 'back_trade');
      await ctx.reply(msg.trade.noStrategies, { reply_markup: keyboard });
      return;
    }

    let message = `${msg.trade.strategiesSection}\n`;

    const keyboard = new InlineKeyboard();

    for (const sub of subscriptions) {
      const status = sub.isActive ? msg.trade.active : msg.trade.paused;
      message +=
        `\n${status} <b>${sub.strategy.name}</b>\n` +
        `${t(msg.trade.strategyAmount, { amount: sub.amountPerTrade })}\n`;

      const btnText = sub.isActive
        ? `${msg.trade.toggleOff} ${sub.strategy.name}`
        : `${msg.trade.toggleOn} ${sub.strategy.name}`;
      const callbackData = `toggle_sub_${sub.id}_${sub.isActive ? '0' : '1'}`;
      keyboard.text(btnText, callbackData).row();
    }

    keyboard.text(msg.logs.btnBack, 'back_trade');

    await ctx.reply(message, {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    });
  } catch (error) {
    console.error('获取订阅列表失败:', error);
    await ctx.reply(msg.trade.failed);
  }
});

// 紧急平仓子面板（从交易面板触发）
bot.callbackQuery('trade_closeall', async (ctx) => {
  const telegramId = ctx.from?.id.toString();
  if (!telegramId) return;
  await ctx.answerCallbackQuery();
  await handleCloseAll(ctx, telegramId);
});

// 返回交易面板
bot.callbackQuery('back_trade', async (ctx) => {
  const telegramId = ctx.from?.id.toString();
  if (!telegramId) return;

  await ctx.answerCallbackQuery();
  const msg = getMsg(ctx);

  try {
    const message = await buildTradeMessage(telegramId, ctx.from?.username, msg);
    await ctx.reply(message, {
      parse_mode: 'HTML',
      reply_markup: getTradeKeyboard(msg),
    });
  } catch (error) {
    console.error('返回交易面板失败:', error);
    await ctx.reply(msg.trade.failed);
  }
});

// ==================== 其他回调处理 ====================

// 复制邀请码回调
bot.callbackQuery(/^copy_invite_/, async (ctx) => {
  const inviteCode = ctx.callbackQuery.data.replace('copy_invite_', '');
  const lang = getUserLang(ctx);
  const text = lang === 'zh'
    ? `邀请码: ${inviteCode} (点击上方消息复制)`
    : `Invite code: ${inviteCode} (Copy from message above)`;
  await ctx.answerCallbackQuery({
    text,
    show_alert: true,
  });
});

// 策略启停回调
bot.callbackQuery(/^toggle_sub_/, async (ctx) => {
  const telegramId = ctx.from?.id.toString();
  if (!telegramId) return;

  const msg = getMsg(ctx);
  const lang = getUserLang(ctx);

  // 解析 toggle_sub_{subscriptionId}_{0|1}
  const data = ctx.callbackQuery.data;
  const lastUnderscoreIdx = data.lastIndexOf('_');
  const newState = data.substring(lastUnderscoreIdx + 1) === '1';
  const subscriptionId = data.substring('toggle_sub_'.length, lastUnderscoreIdx);

  try {
    await ctx.answerCallbackQuery();
    await toggleSubscription(telegramId, subscriptionId, newState);

    // 获取策略名
    let strategyName = subscriptionId;
    try {
      const subs = await getMySubscriptions(telegramId);
      const sub = subs.find(s => s.id === subscriptionId);
      if (sub) strategyName = sub.strategy.name;
    } catch { /* 获取失败时使用 ID */ }

    const actionText = newState
      ? (lang === 'zh' ? '启动' : 'started')
      : (lang === 'zh' ? '暂停' : 'paused');

    await ctx.reply(
      t(msg.trade.toggleSuccess, { action: actionText, name: strategyName }),
      { parse_mode: 'HTML' }
    );
  } catch (error) {
    console.error('切换策略状态失败:', error);
    await ctx.answerCallbackQuery({ text: msg.trade.toggleFailed, show_alert: true });
  }
});

// 平仓选择交易所回调（多 API Key 时）
bot.callbackQuery(/^closeall_select_/, async (ctx) => {
  const telegramId = ctx.from?.id.toString();
  if (!telegramId) return;

  const msg = getMsg(ctx);
  const apiKeyId = ctx.callbackQuery.data.replace('closeall_select_', '');

  await ctx.answerCallbackQuery();

  const keyboard = new InlineKeyboard()
    .text(msg.closeAll.btnConfirm, `closeall_confirm_${apiKeyId}`)
    .text(msg.closeAll.btnCancel, 'closeall_cancel');

  await ctx.editMessageText(
    `${msg.closeAll.title}\n\n` +
    `${msg.closeAll.confirm}\n` +
    `${msg.closeAll.warning}`,
    {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    }
  );
});

// 平仓确认回调
bot.callbackQuery(/^closeall_confirm_/, async (ctx) => {
  const telegramId = ctx.from?.id.toString();
  if (!telegramId) return;

  const msg = getMsg(ctx);
  const apiKeyId = ctx.callbackQuery.data.replace('closeall_confirm_', '');

  await ctx.answerCallbackQuery();
  await ctx.editMessageText(msg.closeAll.executing, { parse_mode: 'HTML' });

  try {
    const result = await closeAllPositions(telegramId, apiKeyId);
    await ctx.editMessageText(
      t(msg.closeAll.success, {
        count: result.closedCount || 0,
        profit: result.totalProfit || '0',
      }),
      { parse_mode: 'HTML' }
    );
  } catch (error) {
    console.error('紧急平仓失败:', error);
    const errorMsg = error instanceof Error ? error.message : '';
    if (errorMsg.includes('无持仓') || errorMsg.includes('no position')) {
      await ctx.editMessageText(msg.closeAll.noPositions, { parse_mode: 'HTML' });
    } else {
      await ctx.editMessageText(msg.closeAll.failed, { parse_mode: 'HTML' });
    }
  }
});

// 平仓取消回调
bot.callbackQuery('closeall_cancel', async (ctx) => {
  const msg = getMsg(ctx);
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(msg.closeAll.cancelled, { parse_mode: 'HTML' });
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

// 旧版按钮兼容（用户可能点击历史消息中的旧按钮）
bot.callbackQuery('checkin', async (ctx) => {
  const telegramId = ctx.from?.id.toString();
  if (!telegramId) return;
  await ctx.answerCallbackQuery();
  await handleCheckin(ctx, telegramId);
});

bot.callbackQuery('invite', async (ctx) => {
  const telegramId = ctx.from?.id.toString();
  if (!telegramId) return;
  await ctx.answerCallbackQuery();
  await handleInvite(ctx, telegramId);
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

    let formattedMessage = '';
    if (title) {
      formattedMessage = `${title}\n\n${message}`;
    } else {
      formattedMessage = message;
    }

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

// 交易通知端点 - 供后端 trade.processor 调用
app.post('/notify-trade', async (req: Request, res: Response) => {
  try {
    const { telegramId, type, symbol, side, price, amount, pnl, strategyName, language } = req.body;

    if (!telegramId || !type || !symbol) {
      return res.status(400).json({ error: '缺少必要参数: telegramId, type, symbol' });
    }

    const lang = (language === 'zh' ? 'zh' : 'en') as Language;
    const msg = getLocale(lang);

    let message = '';
    if (type === 'open') {
      message =
        `${msg.tradeNotify.openTitle}\n\n` +
        `${t(msg.tradeNotify.symbol, { symbol })}\n` +
        `${t(msg.tradeNotify.side, { side: side?.toUpperCase() || '' })}\n` +
        `${t(msg.tradeNotify.price, { price: price || '' })}\n` +
        `${t(msg.tradeNotify.amount, { amount: amount || '' })}` +
        (strategyName ? `\n${t(msg.tradeNotify.strategy, { name: strategyName })}` : '');
    } else if (type === 'close') {
      message =
        `${msg.tradeNotify.closeTitle}\n\n` +
        `${t(msg.tradeNotify.symbol, { symbol })}\n` +
        `${t(msg.tradeNotify.side, { side: side?.toUpperCase() || '' })}\n` +
        `${t(msg.tradeNotify.price, { price: price || '' })}\n` +
        `${t(msg.tradeNotify.amount, { amount: amount || '' })}` +
        (pnl ? `\n${t(msg.tradeNotify.pnl, { pnl })}` : '') +
        (strategyName ? `\n${t(msg.tradeNotify.strategy, { name: strategyName })}` : '');
    } else {
      return res.status(400).json({ error: '无效的 type，必须是 open 或 close' });
    }

    await bot.api.sendMessage(telegramId, message, { parse_mode: 'HTML' });
    console.log(`✅ 交易通知已推送: ${telegramId} ${type} ${symbol}`);
    res.json({ success: true });
  } catch (error) {
    console.error('推送交易通知失败:', error);
    res.status(500).json({
      error: '推送失败',
      message: error instanceof Error ? error.message : '未知错误',
    });
  }
});

// AI 通知端点 - 供后端 AI 模块调用（决策通知 + 风控告警）
app.post('/notify-ai', async (req: Request, res: Response) => {
  try {
    const { telegramId, type, language, ...data } = req.body;

    if (!telegramId || !type) {
      return res.status(400).json({ error: '缺少必要参数: telegramId, type' });
    }

    const lang = (language === 'zh' ? 'zh' : 'en') as Language;
    const msg = getLocale(lang);

    let message = '';

    if (type === 'decision_open' || type === 'decision_close') {
      // AI 决策通知（开仓/平仓）
      const title = type === 'decision_open' ? msg.aiNotify.decisionOpen : msg.aiNotify.decisionClose;
      message = `${title}\n\n`;

      if (data.symbol) message += `${t(msg.aiNotify.symbol, { symbol: data.symbol })}\n`;
      if (data.side) message += `${t(msg.aiNotify.side, { side: data.side.toUpperCase() })}\n`;
      if (data.leverage) message += `${t(msg.aiNotify.leverage, { leverage: data.leverage })}\n`;
      if (data.confidence) message += `${t(msg.aiNotify.confidence, { confidence: data.confidence })}\n`;
      if (data.strategyName) message += `${t(msg.aiNotify.strategy, { name: data.strategyName })}\n`;
      if (data.tradingMode) {
        const modeMap: Record<string, string> = lang === 'zh'
          ? { solo: '⚡ 极速', debate: '🤝 共识', research: '🔬 深研' }
          : { solo: '⚡ Solo', debate: '🤝 Debate', research: '🔬 Research' };
        message += `${t(msg.aiNotify.mode, { mode: modeMap[data.tradingMode] || data.tradingMode })}\n`;
      }
      if (data.pnl) message += `${t(msg.aiNotify.pnl, { pnl: data.pnl })}\n`;
    } else if (type === 'alert') {
      // 风控告警
      message = `${msg.aiNotify.alertTitle}\n\n`;
      if (data.strategyName) message += `${t(msg.aiNotify.alertStrategy, { name: data.strategyName })}\n`;
      if (data.drawdown) message += `${t(msg.aiNotify.alertDrawdown, { drawdown: data.drawdown })}\n`;
      if (data.action) {
        const actionMap: Record<string, string> = lang === 'zh'
          ? { paused: '自动暂停', stopped: '自动停止' }
          : { paused: 'Auto Paused', stopped: 'Auto Stopped' };
        message += `${t(msg.aiNotify.alertAction, { action: actionMap[data.action] || data.action })}\n`;
      }
    } else {
      return res.status(400).json({ error: '无效的 type，必须是 decision_open, decision_close 或 alert' });
    }

    await bot.api.sendMessage(telegramId, message, { parse_mode: 'HTML' });
    console.log(`✅ AI 通知已推送: ${telegramId} ${type}`);
    res.json({ success: true });
  } catch (error) {
    console.error('推送 AI 通知失败:', error);
    res.status(500).json({
      error: '推送失败',
      message: error instanceof Error ? error.message : '未知错误',
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
  console.log(`   - POST /notify-trade - 交易通知推送`);
  console.log(`   - POST /notify-ai - AI 决策/告警通知`);
  console.log(`   - POST /send-bulk - 批量发送消息`);
  console.log(`   - GET /health - 健康检查`);
});

// 设置 Bot 命令菜单
async function setupBotMenu() {
  try {
    // 中文命令（8 核心 + 2 工具）
    await bot.api.setMyCommands(
      [
        { command: 'start', description: '开始使用 / 主菜单' },
        { command: 'wallet', description: '钱包总览' },
        { command: 'trade', description: '交易面板' },
        { command: 'ai', description: 'AI 交易总览' },
        { command: 'checkin', description: '每日签到领取 HOOT' },
        { command: 'invite', description: '邀请好友赚取奖励' },
        { command: 'closeall', description: '紧急全部平仓' },
        { command: 'help', description: '帮助与命令列表' },
      ],
      { language_code: 'zh' }
    );

    // 英文命令
    await bot.api.setMyCommands(
      [
        { command: 'start', description: 'Start / Main Menu' },
        { command: 'wallet', description: 'Wallet overview' },
        { command: 'trade', description: 'Trading panel' },
        { command: 'ai', description: 'AI trading overview' },
        { command: 'checkin', description: 'Daily check-in for HOOT' },
        { command: 'invite', description: 'Invite friends for rewards' },
        { command: 'closeall', description: 'Emergency close all' },
        { command: 'help', description: 'Help & command list' },
      ],
      { language_code: 'en' }
    );

    // 默认命令
    await bot.api.setMyCommands([
      { command: 'start', description: 'Start / 开始' },
      { command: 'wallet', description: 'Wallet / 钱包' },
      { command: 'trade', description: 'Trade / 交易' },
      { command: 'ai', description: 'AI / AI 交易' },
      { command: 'checkin', description: 'Check-in / 签到' },
      { command: 'invite', description: 'Invite / 邀请' },
      { command: 'closeall', description: 'Close All / 紧急平仓' },
      { command: 'help', description: 'Help / 帮助' },
    ]);

    // 设置左下角菜单按钮为 WebApp（根页自动处理 TG 登录，用户直接进入 Dashboard）
    await bot.api.setChatMenuButton({
      menu_button: {
        type: 'web_app',
        text: '🦉 HOOT',
        web_app: { url: WEB_APP_URL },
      },
    });

    console.log('✅ Bot 菜单和命令已设置');
  } catch (error) {
    console.error('设置 Bot 菜单失败:', error);
  }
}

// 启动 Bot
console.log('🤖 HOOT Telegram Bot 启动中...');
bot.start({
  onStart: async (botInfo) => {
    console.log(`✅ Bot 已启动: @${botInfo.username}`);
    await setupBotMenu();
  },
});
