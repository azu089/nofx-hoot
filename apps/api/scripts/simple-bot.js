const { Telegraf } = require('telegraf');
const bot = new Telegraf('8328612196:AAEDw1-RFFuAEo0-n_gm6dbXCONHkxKOM34');

bot.use((ctx, next) => {
  console.log('[收到]', new Date().toISOString(), ctx.updateType, 'from:', ctx.from?.id);
  return next();
});

bot.start((ctx) => {
  console.log('[/start] 执行');
  return ctx.reply('👋 欢迎使用 QuantFi！\n\n💡 /help 查看所有命令', {
    reply_markup: {
      inline_keyboard: [
        [{ text: '💰 余额', callback_data: 'wallet' }, { text: '📊 盈亏', callback_data: 'pnl' }]
      ]
    }
  });
});

bot.help((ctx) => ctx.reply('📚 命令帮助\n/wallet - 余额\n/pnl - 盈亏\n/checkin - 签到'));
bot.command('wallet', (ctx) => ctx.reply('💰 USDT: 1,234.56\n⭐ 积分: 5,680'));
bot.command('pnl', (ctx) => ctx.reply('📊 今日: +$523.45'));
bot.command('checkin', (ctx) => ctx.reply('🎉 签到成功！获得 10 积分'));
bot.command('invite', (ctx) => ctx.reply('🎁 邀请码: DEMO1234'));
bot.command('stake', (ctx) => ctx.reply('📊 质押: 10,000 积分'));
bot.command('vesting', (ctx) => ctx.reply('⏳ 待释放: 45.20 QFI'));
bot.command('rank', (ctx) => ctx.reply('🏆 排名: #42'));
bot.command('strategies', (ctx) => ctx.reply('🤖 运行中: 3 个策略'));
bot.command('settings', (ctx) => ctx.reply('⚙️ 通知: 全部开启'));

bot.on('callback_query', async (ctx) => {
  const data = ctx.callbackQuery.data;
  console.log('[callback]', data);
  if (data === 'wallet') await ctx.reply('💰 USDT: 1,234.56');
  if (data === 'pnl') await ctx.reply('📊 今日: +$523.45');
  await ctx.answerCbQuery();
});

bot.catch((err) => console.error('[错误]', err));

console.log('🚀 启动 Bot...');

// 不等待 launch 的 Promise，它在长轮询模式下不会 resolve
bot.launch({ dropPendingUpdates: true });
console.log('✅ Bot 长轮询已启动');
console.log('📱 现在发送 /start 到 @TIZOCCBot 测试');

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
