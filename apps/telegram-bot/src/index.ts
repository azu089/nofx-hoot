/**
 * QuantFi Telegram Bot
 * 基于 grammY 框架
 */
import { Bot, Context, session, SessionFlavor } from 'grammy';
import 'dotenv/config';

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

// 创建 Bot 实例（带类型）
const bot = new Bot<MyContext>(BOT_TOKEN);

// 初始化 Session
bot.use(
  session({
    initial: (): SessionData => ({
      isLoggedIn: false,
    }),
  })
);

// 命令处理器
bot.command('start', async (ctx) => {
  await ctx.reply(
    `👋 欢迎使用 QuantFi 机器人!\n\n` +
      `可用命令:\n` +
      `/bind - 绑定 QuantFi 账户\n` +
      `/status - 查看账户状态\n` +
      `/positions - 查看当前持仓\n` +
      `/subscribe - 订阅策略\n` +
      `/help - 获取帮助`
  );
});

bot.command('help', async (ctx) => {
  await ctx.reply(
    `📖 QuantFi 机器人帮助\n\n` +
      `账户相关:\n` +
      `/bind - 绑定账户\n` +
      `/unbind - 解绑账户\n` +
      `/status - 账户状态\n\n` +
      `交易相关:\n` +
      `/positions - 当前持仓\n` +
      `/history - 交易历史\n` +
      `/subscribe - 订阅策略\n\n` +
      `通知设置:\n` +
      `/notify on - 开启通知\n` +
      `/notify off - 关闭通知`
  );
});

bot.command('status', async (ctx) => {
  // TODO: 从 API 获取用户状态
  await ctx.reply('🔄 获取账户状态中...\n\n' + '(功能开发中)');
});

bot.command('positions', async (ctx) => {
  // TODO: 从 API 获取持仓
  await ctx.reply('📊 获取持仓信息中...\n\n' + '(功能开发中)');
});

bot.command('bind', async (ctx) => {
  // TODO: 实现账户绑定流程
  await ctx.reply(
    '🔗 账户绑定\n\n' +
      '请在 QuantFi 网站上获取绑定码，然后发送给我:\n' +
      '/bind <绑定码>\n\n' +
      '(功能开发中)'
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
console.log('🤖 QuantFi Telegram Bot 启动中...');
bot.start({
  onStart: (botInfo) => {
    console.log(`✅ Bot 已启动: @${botInfo.username}`);
  },
});
