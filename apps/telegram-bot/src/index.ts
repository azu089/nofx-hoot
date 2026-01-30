/**
 * Hoot Telegram Bot
 * 基于 grammY 框架
 */
import { Bot, Context, session, SessionFlavor } from 'grammy';
import 'dotenv/config';
import {
  getUserByTelegramId,
  bindTelegram,
  getPositionsByTelegramId,
  getStrategies,
} from './utils/api';

// Session 类型
interface SessionData {
  userId?: string;
  isLoggedIn: boolean;
}

// 扩展 Context 类型
type MyContext = Context & SessionFlavor<SessionData>;

// 检查环境变量
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!BOT_TOKEN) {
  throw new Error('TELEGRAM_BOT_TOKEN 环境变量未设置');
}

// 创建 Bot 实例
const bot = new Bot<MyContext>(BOT_TOKEN);

// 初始化 Session
bot.use(
  session({
    initial: (): SessionData => ({
      isLoggedIn: false,
    }),
  })
);

// /start 命令
bot.command('start', async (ctx) => {
  const telegramId = ctx.from?.id.toString();
  if (!telegramId) return;

  // 检查是否已绑定
  const user = await getUserByTelegramId(telegramId);

  if (user) {
    ctx.session.isLoggedIn = true;
    ctx.session.userId = user.id;
    await ctx.reply(
      `👋 欢迎回来，${user.nickname || '用户'}!\n\n` +
        `💰 USDT 余额: ${user.usdtBalance}\n` +
        `🪙 HOOT 余额: ${user.hootBalance}\n\n` +
        `使用 /help 查看可用命令`
    );
  } else {
    await ctx.reply(
      `👋 欢迎使用 Hoot 机器人!\n\n` +
        `您还未绑定账户，请先绑定:\n` +
        `1. 登录 Hoot 网站\n` +
        `2. 在设置页面获取绑定码\n` +
        `3. 发送: /bind <绑定码>\n\n` +
        `使用 /help 查看所有命令`
    );
  }
});

// /help 命令
bot.command('help', async (ctx) => {
  await ctx.reply(
    `📖 Hoot 机器人帮助\n\n` +
      `📌 账户相关:\n` +
      `/bind <绑定码> - 绑定账户\n` +
      `/unbind - 解绑账户\n` +
      `/status - 账户状态\n\n` +
      `📊 交易相关:\n` +
      `/positions - 当前持仓\n` +
      `/strategies - 策略列表\n\n` +
      `🔔 通知会自动推送:\n` +
      `• 开仓成功通知\n` +
      `• 平仓结果通知\n` +
      `• 重要系统通知`
  );
});

// /bind 命令 - 绑定账户
bot.command('bind', async (ctx) => {
  const telegramId = ctx.from?.id.toString();
  const username = ctx.from?.username;
  if (!telegramId) return;

  // 检查是否已绑定
  const existingUser = await getUserByTelegramId(telegramId);
  if (existingUser) {
    await ctx.reply(`❌ 您已绑定账户: ${existingUser.email}\n\n如需更换，请先 /unbind`);
    return;
  }

  // 获取绑定码
  const args = ctx.message?.text?.split(' ').slice(1);
  const bindCode = args?.[0];

  if (!bindCode) {
    await ctx.reply(
      `🔗 账户绑定\n\n` +
        `请提供绑定码:\n` +
        `/bind <绑定码>\n\n` +
        `绑定码获取方式:\n` +
        `1. 登录 Hoot 网站\n` +
        `2. 进入 设置 > Telegram 绑定\n` +
        `3. 点击"生成绑定码"`
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

    await ctx.reply(
      `✅ 绑定成功!\n\n` +
        `账户: ${user.email}\n` +
        `昵称: ${user.nickname || '未设置'}\n\n` +
        `现在您可以:\n` +
        `• 使用 /status 查看状态\n` +
        `• 使用 /positions 查看持仓\n` +
        `• 收到交易通知`
    );
  } catch (error) {
    await ctx.reply(`❌ 绑定失败: ${error instanceof Error ? error.message : '未知错误'}`);
  }
});

// /status 命令 - 账户状态
bot.command('status', async (ctx) => {
  const telegramId = ctx.from?.id.toString();
  if (!telegramId) return;

  const user = await getUserByTelegramId(telegramId);

  if (!user) {
    await ctx.reply('❌ 您还未绑定账户，请先使用 /bind 绑定');
    return;
  }

  await ctx.reply(
    `📊 账户状态\n\n` +
      `👤 昵称: ${user.nickname || '未设置'}\n` +
      `📧 邮箱: ${user.email}\n\n` +
      `💰 资产:\n` +
      `• USDT: ${user.usdtBalance}\n` +
      `• HOOT: ${user.hootBalance}`
  );
});

// /positions 命令 - 查看持仓
bot.command('positions', async (ctx) => {
  const telegramId = ctx.from?.id.toString();
  if (!telegramId) return;

  const user = await getUserByTelegramId(telegramId);

  if (!user) {
    await ctx.reply('❌ 您还未绑定账户，请先使用 /bind 绑定');
    return;
  }

  try {
    const positions = await getPositionsByTelegramId(telegramId);

    if (positions.length === 0) {
      await ctx.reply('📊 当前无持仓');
      return;
    }

    let message = `📊 当前持仓 (${positions.length})\n\n`;

    for (const pos of positions) {
      const pnlDisplay = pos.pnl
        ? (parseFloat(pos.pnl) >= 0 ? '📈 +' : '📉 ') + pos.pnl
        : '';

      message +=
        `${pos.symbol} ${pos.side.toUpperCase()}\n` +
        `• 入场: ${pos.entryPrice}\n` +
        `• 数量: ${pos.amount}\n` +
        `${pnlDisplay ? `• PnL: ${pnlDisplay}\n` : ''}` +
        `\n`;
    }

    await ctx.reply(message);
  } catch (error) {
    await ctx.reply('❌ 获取持仓失败，请稍后重试');
  }
});

// /strategies 命令 - 策略列表
bot.command('strategies', async (ctx) => {
  try {
    const strategies = await getStrategies();

    if (strategies.length === 0) {
      await ctx.reply('📋 暂无可用策略');
      return;
    }

    let message = `📋 策略列表\n\n`;

    for (const strategy of strategies) {
      message += `🎯 ${strategy.name}\n${strategy.description}\n\n`;
    }

    message += `访问 Hoot 网站订阅策略`;

    await ctx.reply(message);
  } catch (error) {
    await ctx.reply('❌ 获取策略失败，请稍后重试');
  }
});

// /unbind 命令 - 解绑账户
bot.command('unbind', async (ctx) => {
  const telegramId = ctx.from?.id.toString();
  if (!telegramId) return;

  const user = await getUserByTelegramId(telegramId);

  if (!user) {
    await ctx.reply('❌ 您还未绑定账户');
    return;
  }

  // TODO: 调用 API 解绑
  await ctx.reply(
    `⚠️ 解绑功能\n\n` +
      `请在 Hoot 网站的设置页面解绑 Telegram\n` +
      `解绑后将无法收到交易通知`
  );
});

// 处理未知命令
bot.on('message:text', async (ctx) => {
  if (ctx.message.text.startsWith('/')) {
    await ctx.reply('❌ 未知命令，请使用 /help 查看可用命令');
  }
});

// 错误处理
bot.catch((err) => {
  console.error('Bot 错误:', err);
});

// 启动 Bot
console.log('🤖 Hoot Telegram Bot 启动中...');
bot.start({
  onStart: (botInfo) => {
    console.log(`✅ Bot 已启动: @${botInfo.username}`);
  },
});
