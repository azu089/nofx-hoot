/**
 * 独立 Telegram Bot 测试脚本
 * 不依赖 NestJS 和 Prisma，直接验证 Bot 功能
 *
 * 使用: npx ts-node scripts/standalone-bot.ts
 */

import { Telegraf } from 'telegraf';

const BOT_TOKEN = '8328612196:AAEDw1-RFFuAEo0-n_gm6dbXCONHkxKOM34';
// Mini App URL 必须是 HTTPS 的实际网址，不能是 t.me 链接
const WEB_APP_URL = 'https://quantfi.app/tg';

console.log('🚀 启动独立 Telegram Bot...');

const bot = new Telegraf(BOT_TOKEN);

// 消息日志中间件
bot.use(async (ctx, next) => {
  console.log(`[${new Date().toISOString()}] 收到消息: type=${ctx.updateType} from=${ctx.from?.id}`);
  if (ctx.message && 'text' in ctx.message) {
    console.log(`  内容: ${ctx.message.text}`);
  }
  await next();
});

// /start 命令
bot.command('start', async (ctx) => {
  console.log('[/start] 处理中...');
  const firstName = ctx.from?.first_name || '用户';

  await ctx.reply(`👋 欢迎使用 QuantFi，${firstName}！

🤖 您的专属量化交易助手已就绪

✨ 核心功能：
• AI 智能策略 - 一键跟单
• 实时交易通知 - 不错过任何机会
• 每日盈亏报告 - 掌握账户动态

🎁 新用户福利：
• 注册即送 1000 积分
• 首单盈利额外奖励

💡 输入 /help 查看所有命令`, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [
          { text: '💰 查看余额', callback_data: 'cmd_wallet' },
          { text: '📊 今日盈亏', callback_data: 'cmd_pnl' },
        ],
        [
          { text: '✅ 每日签到', callback_data: 'cmd_checkin' },
          { text: '🎁 邀请好友', callback_data: 'cmd_invite' },
        ],
      ],
    },
  });
  console.log('[/start] 完成');
});

// /help 命令
bot.command('help', async (ctx) => {
  console.log('[/help] 处理中...');
  await ctx.reply(`📚 <b>QuantFi Bot 命令帮助</b>

<b>💰 资产查询</b>
/wallet - 查看钱包余额
/pnl - 查看今日盈亏
/stake - 查看质押概览
/vesting - 查看释放进度

<b>🤖 交易相关</b>
/strategies - 查看运行中策略

<b>🎮 生态功能</b>
/checkin - 每日签到
/invite - 获取邀请链接
/rank - 查看我的排名

<b>⚙️ 设置</b>
/settings - 通知设置`, {
    parse_mode: 'HTML',
  });
  console.log('[/help] 完成');
});

// /wallet 命令 (模拟数据)
bot.command('wallet', async (ctx) => {
  console.log('[/wallet] 处理中...');
  await ctx.reply(`💰 <b>钱包余额</b>

💵 USDT: <b>1,234.56</b>
⭐ 积分: <b>5,680</b>
🪙 QFI: <b>125.50</b> (待释放: 45.20)

📊 总资产约: <b>$1,359.06</b>

<i>（示例数据）</i>`, {
    parse_mode: 'HTML',
  });
  console.log('[/wallet] 完成');
});

// /pnl 命令 (模拟数据)
bot.command('pnl', async (ctx) => {
  console.log('[/pnl] 处理中...');
  await ctx.reply(`📊 <b>今日交易报告</b>

💰 今日盈亏: <b>+$523.45</b>
📈 交易次数: <b>15</b> 笔
✅ 胜率: <b>73%</b>

<i>（示例数据）</i>`, {
    parse_mode: 'HTML',
  });
  console.log('[/pnl] 完成');
});

// /checkin 命令
bot.command('checkin', async (ctx) => {
  console.log('[/checkin] 处理中...');
  await ctx.reply(`🎉 签到成功！

⭐ 获得 <b>10</b> 积分

明天继续签到可获得更多奖励！

<i>（请在 App 中完成实际签到）</i>`, {
    parse_mode: 'HTML',
  });
  console.log('[/checkin] 完成');
});

// /invite 命令
bot.command('invite', async (ctx) => {
  console.log('[/invite] 处理中...');
  const inviteCode = 'DEMO1234';
  const inviteLink = `https://t.me/TIZOCCBot?start=${inviteCode}`;

  await ctx.reply(`🎁 <b>邀请好友</b>

📋 我的邀请码: <code>${inviteCode}</code>

🔗 邀请链接:
${inviteLink}

👥 已邀请: <b>0</b> 人

💰 <b>返佣规则</b>
• 一级返佣 30%
• 二级返佣 10%`, {
    parse_mode: 'HTML',
  });
  console.log('[/invite] 完成');
});

// /stake 命令
bot.command('stake', async (ctx) => {
  console.log('[/stake] 处理中...');
  await ctx.reply(`📊 <b>质押概览</b>

🔐 活跃质押: <b>2</b> 笔

📍 A 类质押 (积分): <b>10,000</b>
📍 B 类质押 (代币): <b>50.00 QFI</b>

<i>（示例数据）</i>`, {
    parse_mode: 'HTML',
  });
  console.log('[/stake] 完成');
});

// /vesting 命令
bot.command('vesting', async (ctx) => {
  console.log('[/vesting] 处理中...');
  await ctx.reply(`⏳ <b>代币释放进度</b>

💎 待释放总量: <b>45.20 QFI</b>

📦 释放中订单: 1 个

1. #abc12345
   25.00/50.00 QFI (50%)

<i>（示例数据）</i>`, {
    parse_mode: 'HTML',
  });
  console.log('[/vesting] 完成');
});

// /rank 命令
bot.command('rank', async (ctx) => {
  console.log('[/rank] 处理中...');
  await ctx.reply(`🏆 <b>我的排名</b>

📊 积分排行
   排名: <b>#42</b> / 1,234 人
   积分: <b>5,680</b>

<i>（示例数据）</i>`, {
    parse_mode: 'HTML',
  });
  console.log('[/rank] 完成');
});

// /strategies 命令
bot.command('strategies', async (ctx) => {
  console.log('[/strategies] 处理中...');
  await ctx.reply(`🤖 <b>运行中策略</b> (3)

1. 网格套利 Pro
2. 趋势跟踪 V2
3. 马丁格尔 Safe

<i>（示例数据）</i>`, {
    parse_mode: 'HTML',
  });
  console.log('[/strategies] 完成');
});

// /settings 命令
bot.command('settings', async (ctx) => {
  console.log('[/settings] 处理中...');
  await ctx.reply(`⚙️ <b>通知设置</b>

当前通知状态:
✅ 交易通知: 开启
✅ 止损提醒: 开启
✅ 每日报告: 开启
✅ 系统公告: 开启`, {
    parse_mode: 'HTML',
  });
  console.log('[/settings] 完成');
});

// Callback Query 处理
bot.on('callback_query', async (ctx) => {
  const callbackQuery = ctx.callbackQuery;
  if (!callbackQuery || !('data' in callbackQuery)) return;

  const data = callbackQuery.data;
  console.log(`[callback] 收到: ${data}`);

  switch (data) {
    case 'cmd_wallet':
      await ctx.reply(`💰 <b>钱包余额</b>

💵 USDT: <b>1,234.56</b>
⭐ 积分: <b>5,680</b>
🪙 QFI: <b>125.50</b>`, { parse_mode: 'HTML' });
      break;
    case 'cmd_pnl':
      await ctx.reply(`📊 <b>今日盈亏</b>

💰 今日: <b>+$523.45</b>
📈 交易: <b>15</b> 笔
✅ 胜率: <b>73%</b>`, { parse_mode: 'HTML' });
      break;
    case 'cmd_checkin':
      await ctx.reply(`🎉 签到成功！

⭐ 获得 <b>10</b> 积分`, { parse_mode: 'HTML' });
      break;
    case 'cmd_invite':
      await ctx.reply(`🎁 <b>邀请链接</b>

https://t.me/TIZOCCBot?start=DEMO1234

复制分享给好友！`, { parse_mode: 'HTML' });
      break;
    default:
      break;
  }

  await ctx.answerCbQuery();
});

// 错误处理
bot.catch((err, ctx) => {
  console.error(`[错误] ${ctx.updateType}:`, err);
});

// 启动
async function main() {
  try {
    // 删除旧 webhook，确保长轮询可用
    await bot.telegram.deleteWebhook({ drop_pending_updates: true });
    console.log('✅ Webhook 已删除');

    // 获取 Bot 信息
    const me = await bot.telegram.getMe();
    console.log(`✅ Bot 信息: @${me.username} (${me.first_name})`);

    // 启动长轮询
    console.log('🔄 启动长轮询...');

    // 优雅关闭
    process.once('SIGINT', () => {
      console.log('收到 SIGINT，正在关闭...');
      bot.stop('SIGINT');
    });
    process.once('SIGTERM', () => {
      console.log('收到 SIGTERM，正在关闭...');
      bot.stop('SIGTERM');
    });

    await bot.launch({
      dropPendingUpdates: true,
      allowedUpdates: ['message', 'callback_query'],
    });

    console.log('');
    console.log('═══════════════════════════════════════════════════════');
    console.log('✅ Bot 已启动！现在可以发送消息到 @TIZOCCBot');
    console.log('');
    console.log('支持的命令:');
    console.log('  /start      - 开始使用');
    console.log('  /help       - 帮助信息');
    console.log('  /wallet     - 钱包余额');
    console.log('  /pnl        - 今日盈亏');
    console.log('  /checkin    - 每日签到');
    console.log('  /invite     - 邀请链接');
    console.log('  /stake      - 质押概览');
    console.log('  /vesting    - 释放进度');
    console.log('  /rank       - 我的排名');
    console.log('  /strategies - 运行中策略');
    console.log('  /settings   - 通知设置');
    console.log('');
    console.log('按 Ctrl+C 停止');
    console.log('═══════════════════════════════════════════════════════');

  } catch (error) {
    console.error('❌ 启动失败:', error);
    process.exit(1);
  }
}

main();
