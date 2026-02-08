/**
 * HOOT Admin Telegram Bot
 * 管理员专用 Bot（与用户 Bot 完全独立）
 *
 * 功能：
 * 1. 提现审核（审批/拒绝 + InlineKeyboard）
 * 2. 系统状态监控
 * 3. 钱包余额查询
 * 4. 资金归集触发
 *
 * 安全：
 * - 独立的 Bot Token（ADMIN_TELEGRAM_BOT_TOKEN）
 * - 白名单管理员 TG ID（ADMIN_TG_IDS，逗号分隔）
 * - 所有命令和回调都验证管理员身份
 */
import { Bot, Context, InlineKeyboard } from 'grammy';
import express, { Request, Response } from 'express';
import cors from 'cors';
import { config } from 'dotenv';
import { resolve } from 'path';

// 加载根目录 .env（本地开发时从 apps/admin-bot 目录运行）
config({ path: resolve(__dirname, '../../../.env') });
// 也尝试加载当前目录 .env（Docker 环境变量直接注入）
config();

// ==================== 配置 ====================

const ADMIN_BOT_TOKEN = process.env.ADMIN_TELEGRAM_BOT_TOKEN;
if (!ADMIN_BOT_TOKEN) {
  console.error('❌ ADMIN_TELEGRAM_BOT_TOKEN 未设置');
  process.exit(1);
}

// 支持多个管理员（逗号分隔）
const ADMIN_TG_IDS = (process.env.ADMIN_TG_IDS || process.env.ADMIN_TG_ID || '')
  .split(',')
  .map((id) => id.trim())
  .filter(Boolean);

if (ADMIN_TG_IDS.length === 0) {
  console.warn('⚠️ 未配置管理员 TG ID（ADMIN_TG_IDS），Bot 将无法接受任何命令');
}

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:4001/api';
const BOT_API_SECRET = process.env.TELEGRAM_BOT_API_SECRET || '';
const HTTP_PORT = parseInt(process.env.ADMIN_BOT_HTTP_PORT || '4003', 10);

// ==================== 管理员鉴权 ====================

function isAdmin(telegramId: string | undefined): boolean {
  if (!telegramId) return false;
  return ADMIN_TG_IDS.includes(telegramId);
}

// 调用后端 API 的通用方法
async function callApi(path: string, method = 'GET', body?: any): Promise<any> {
  const url = `${API_BASE_URL}${path}`;
  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-bot-secret': BOT_API_SECRET,
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  return response.json();
}

// ==================== Bot 实例 ====================

const bot = new Bot(ADMIN_BOT_TOKEN);

// 全局管理员鉴权中间件
bot.use(async (ctx, next) => {
  const telegramId = ctx.from?.id.toString();

  if (!isAdmin(telegramId)) {
    // 非管理员，直接忽略（不回复，避免暴露 Bot 存在）
    return;
  }

  await next();
});

// ==================== 命令 ====================

// /start - 管理员面板
bot.command('start', async (ctx) => {
  const keyboard = new InlineKeyboard()
    .text('📊 系统状态', 'admin_status')
    .text('💰 钱包余额', 'admin_balance')
    .row()
    .text('📋 待审核提现', 'admin_pending_withdraws')
    .text('🔄 资金归集', 'admin_sweep_scan')
    .row()
    .text('🔧 区块链监听', 'admin_blockchain');

  await ctx.reply(
    `🦉 <b>HOOT 管理员控制台</b>\n\n` +
      `管理员: ${ctx.from?.username || ctx.from?.first_name}\n` +
      `时间: ${new Date().toLocaleString('zh-CN')}\n\n` +
      `请选择操作:`,
    {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    },
  );
});

// /status - 系统状态
bot.command('status', async (ctx) => {
  await handleStatus(ctx);
});

// /pending - 待审核提现
bot.command('pending', async (ctx) => {
  await handlePendingWithdraws(ctx);
});

// /balance - 热钱包余额
bot.command('balance', async (ctx) => {
  await handleWalletBalance(ctx);
});

// /sweep - 归集扫描
bot.command('sweep', async (ctx) => {
  await handleSweepScan(ctx);
});

// ==================== 功能处理 ====================

// 系统状态
async function handleStatus(ctx: Context) {
  try {
    const [healthResult, blockchainResult] = await Promise.allSettled([
      callApi('/health'),
      callApi('/blockchain/status'),
    ]);

    const health =
      healthResult.status === 'fulfilled' ? healthResult.value : null;
    const blockchain =
      blockchainResult.status === 'fulfilled'
        ? blockchainResult.value
        : null;

    const blockchainData = blockchain?.data || blockchain || {};

    let message =
      `📊 <b>系统状态</b>\n\n` +
      `🟢 API: ${health?.data?.status === 'ok' ? '运行中' : '⚠️ 异常'}\n`;

    if (blockchainData.isConnected !== undefined) {
      message +=
        `🔗 区块链连接: ${blockchainData.isConnected ? '✅ 已连接' : '❌ 未连接'}\n` +
        `👂 监听状态: ${blockchainData.isListening ? '✅ 运行中' : '⏸ 已停止'}\n` +
        `🪙 监控代币: ${(blockchainData.monitoredTokens || []).join(', ') || '无'}\n` +
        `📍 缓存地址: ${blockchainData.cachedAddresses || 0} 个\n` +
        `🔑 HD 钱包: ${blockchainData.hdWallet ? '✅ 已初始化' : '❌ 未初始化'}\n`;
    }

    message += `\n⏰ 查询时间: ${new Date().toLocaleString('zh-CN')}`;

    await ctx.reply(message, { parse_mode: 'HTML' });
  } catch (error) {
    await ctx.reply('❌ 获取系统状态失败');
  }
}

// 热钱包余额
async function handleWalletBalance(ctx: Context) {
  try {
    const result = await callApi('/blockchain/withdraw-wallet/balance');
    const data = result?.data || result;

    if (data?.error) {
      await ctx.reply(`⚠️ ${data.error}`);
      return;
    }

    if (!data?.address) {
      await ctx.reply('⚠️ 提现钱包未配置');
      return;
    }

    await ctx.reply(
      `💰 <b>热钱包余额</b>\n\n` +
        `📍 地址: <code>${data.address}</code>\n\n` +
        `💵 BNB: ${parseFloat(data.bnb || '0').toFixed(6)}\n` +
        `💵 USDT: ${parseFloat(data.usdt || '0').toFixed(2)}\n` +
        `🦉 HOOT: ${parseFloat(data.hoot || '0').toFixed(2)}\n\n` +
        `⏰ ${new Date().toLocaleString('zh-CN')}`,
      { parse_mode: 'HTML' },
    );
  } catch (error) {
    await ctx.reply('❌ 获取钱包余额失败');
  }
}

// 待审核提现列表
async function handlePendingWithdraws(ctx: Context) {
  try {
    // 通过数据库直接查询待审核提现（后端需要新增接口）
    // 暂时提示管理员使用 Web 管理后台
    await ctx.reply(
      `📋 <b>提现审核</b>\n\n` +
        `提现审核通知会自动推送到此 Bot。\n` +
        `收到通知后，点击按钮即可审批或拒绝。\n\n` +
        `<b>审核规则:</b>\n` +
        `• 小额 (<500 USDT) 自动执行\n` +
        `• 大额 (≥500 USDT) 推送到此处审核\n` +
        `• 风控拦截的也会推送审核\n\n` +
        `💡 如需查看历史记录，请登录管理后台`,
      { parse_mode: 'HTML' },
    );
  } catch (error) {
    await ctx.reply('❌ 获取提现列表失败');
  }
}

// 归集扫描
async function handleSweepScan(ctx: Context) {
  try {
    await ctx.reply('🔄 正在扫描派生地址余额...');

    const result = await callApi('/blockchain/sweep/scan');
    const data = result?.data || result;

    if (!data || (Array.isArray(data) && data.length === 0)) {
      await ctx.reply('✅ 所有派生地址余额为零或低于归集阈值，无需归集');
      return;
    }

    let message = `🔍 <b>归集扫描结果</b>\n\n`;
    const items = Array.isArray(data) ? data : [];

    for (const addr of items) {
      message += `📍 ${addr.address.slice(0, 10)}...${addr.address.slice(-6)}\n`;
      for (const bal of addr.balances || []) {
        message += `   ${bal.asset}: ${bal.amount}\n`;
      }
      message += `\n`;
    }

    const keyboard = new InlineKeyboard().text(
      '🚀 执行全量归集',
      'admin_sweep_execute',
    );

    await ctx.reply(message, {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    });
  } catch (error) {
    await ctx.reply('❌ 归集扫描失败');
  }
}

// ==================== 回调处理 ====================

// 系统状态按钮
bot.callbackQuery('admin_status', async (ctx) => {
  await ctx.answerCallbackQuery();
  await handleStatus(ctx);
});

// 钱包余额按钮
bot.callbackQuery('admin_balance', async (ctx) => {
  await ctx.answerCallbackQuery();
  await handleWalletBalance(ctx);
});

// 待审核提现按钮
bot.callbackQuery('admin_pending_withdraws', async (ctx) => {
  await ctx.answerCallbackQuery();
  await handlePendingWithdraws(ctx);
});

// 归集扫描按钮
bot.callbackQuery('admin_sweep_scan', async (ctx) => {
  await ctx.answerCallbackQuery();
  await handleSweepScan(ctx);
});

// 区块链状态按钮
bot.callbackQuery('admin_blockchain', async (ctx) => {
  await ctx.answerCallbackQuery();

  const keyboard = new InlineKeyboard()
    .text('▶️ 启动监听', 'admin_blockchain_start')
    .text('⏸ 停止监听', 'admin_blockchain_stop')
    .row()
    .text('🔙 返回', 'admin_back');

  await ctx.reply(
    `🔧 <b>区块链监听管理</b>\n\n` +
      `使用下方按钮控制链上监听:`,
    {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    },
  );
});

// 启动链上监听
bot.callbackQuery('admin_blockchain_start', async (ctx) => {
  await ctx.answerCallbackQuery({ text: '正在启动...' });
  try {
    const result = await callApi('/blockchain/start', 'POST');
    await ctx.reply(`✅ ${result?.message || result?.data?.message || '监听已启动'}`);
  } catch {
    await ctx.reply('❌ 启动失败');
  }
});

// 停止链上监听
bot.callbackQuery('admin_blockchain_stop', async (ctx) => {
  await ctx.answerCallbackQuery({ text: '正在停止...' });
  try {
    const result = await callApi('/blockchain/stop', 'POST');
    await ctx.reply(`✅ ${result?.message || result?.data?.message || '监听已停止'}`);
  } catch {
    await ctx.reply('❌ 停止失败');
  }
});

// 执行全量归集
bot.callbackQuery('admin_sweep_execute', async (ctx) => {
  await ctx.answerCallbackQuery({ text: '正在执行归集...' });
  await ctx.reply('🔄 归集进行中，完成后会通知结果...');

  try {
    const result = await callApi('/blockchain/sweep/execute', 'POST');
    const data = result?.data || result;

    await ctx.reply(
      `✅ <b>归集完成</b>\n\n` +
        `成功: ${data?.totalSwept || 0} 笔\n` +
        `失败: ${data?.totalFailed || 0} 笔`,
      { parse_mode: 'HTML' },
    );
  } catch {
    await ctx.reply('❌ 归集执行失败');
  }
});

// 返回主菜单
bot.callbackQuery('admin_back', async (ctx) => {
  await ctx.answerCallbackQuery();

  const keyboard = new InlineKeyboard()
    .text('📊 系统状态', 'admin_status')
    .text('💰 钱包余额', 'admin_balance')
    .row()
    .text('📋 待审核提现', 'admin_pending_withdraws')
    .text('🔄 资金归集', 'admin_sweep_scan')
    .row()
    .text('🔧 区块链监听', 'admin_blockchain');

  await ctx.reply('🦉 <b>HOOT 管理员控制台</b>', {
    parse_mode: 'HTML',
    reply_markup: keyboard,
  });
});

// ==================== 提现审核回调 ====================

// 批准提现
bot.callbackQuery(/^withdraw_approve_/, async (ctx) => {
  const withdrawRequestId = ctx.callbackQuery.data.replace(
    'withdraw_approve_',
    '',
  );
  const telegramId = ctx.from?.id.toString();
  await ctx.answerCallbackQuery({ text: '正在审批...' });

  try {
    const result = await callApi(
      `/blockchain/withdraw/${withdrawRequestId}/approve`,
      'POST',
      { reviewedBy: `admin_${telegramId}` },
    );

    const data = result?.data || result;

    if (data?.success) {
      await ctx.editMessageText(
        (ctx.callbackQuery.message?.text || '') +
          `\n\n✅ 已批准并执行\nTx: ${data.txHash || '执行中...'}`,
        { parse_mode: 'HTML' },
      );
    } else {
      await ctx.editMessageText(
        (ctx.callbackQuery.message?.text || '') +
          `\n\n⚠️ 批准但执行失败: ${data?.error || '未知错误'}`,
        { parse_mode: 'HTML' },
      );
    }
  } catch {
    await ctx.editMessageText(
      (ctx.callbackQuery.message?.text || '') +
        '\n\n❌ 操作失败，请到管理后台处理',
      { parse_mode: 'HTML' },
    );
  }
});

// 拒绝提现
bot.callbackQuery(/^withdraw_reject_/, async (ctx) => {
  const withdrawRequestId = ctx.callbackQuery.data.replace(
    'withdraw_reject_',
    '',
  );
  const telegramId = ctx.from?.id.toString();
  await ctx.answerCallbackQuery({ text: '正在拒绝...' });

  try {
    const result = await callApi(
      `/blockchain/withdraw/${withdrawRequestId}/reject`,
      'POST',
      {
        reviewedBy: `admin_${telegramId}`,
        reason: '管理员通过 TG 拒绝',
      },
    );

    const data = result?.data || result;

    if (data?.success) {
      await ctx.editMessageText(
        (ctx.callbackQuery.message?.text || '') +
          '\n\n❌ 已拒绝，余额已退回用户',
        { parse_mode: 'HTML' },
      );
    } else {
      await ctx.editMessageText(
        (ctx.callbackQuery.message?.text || '') +
          `\n\n⚠️ 拒绝失败: ${data?.error || '未知错误'}`,
        { parse_mode: 'HTML' },
      );
    }
  } catch {
    await ctx.editMessageText(
      (ctx.callbackQuery.message?.text || '') +
        '\n\n❌ 操作失败，请到管理后台处理',
      { parse_mode: 'HTML' },
    );
  }
});

// ==================== 错误处理 ====================

bot.catch((err) => {
  console.error('Admin Bot 错误:', err);
});

// ==================== Express HTTP API ====================

const app = express();
app.use(cors());
app.use(express.json());

// 健康检查
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'hoot-admin-bot' });
});

// 提现审核通知端点 - 供后端 WithdrawService 调用
app.post('/notify-withdraw', async (req: Request, res: Response) => {
  try {
    const { withdrawRequestId, message } = req.body;

    if (!withdrawRequestId || !message) {
      return res
        .status(400)
        .json({ error: '缺少必要参数: withdrawRequestId, message' });
    }

    // 发送给所有管理员
    const keyboard = new InlineKeyboard()
      .text('✅ 批准并执行', `withdraw_approve_${withdrawRequestId}`)
      .text('❌ 拒绝并退款', `withdraw_reject_${withdrawRequestId}`);

    const results = [];
    for (const adminId of ADMIN_TG_IDS) {
      try {
        await bot.api.sendMessage(adminId, message, {
          parse_mode: 'HTML',
          reply_markup: keyboard,
        });
        results.push({ adminId, success: true });
      } catch (err) {
        console.error(`发送给管理员 ${adminId} 失败:`, err);
        results.push({ adminId, success: false });
      }
    }

    console.log(
      `📨 提现审核通知已发送给 ${results.filter((r) => r.success).length}/${ADMIN_TG_IDS.length} 个管理员`,
    );
    res.json({ success: true, results });
  } catch (error) {
    console.error('提现审核通知发送失败:', error);
    res.status(500).json({
      error: '发送失败',
      message: error instanceof Error ? error.message : '未知错误',
    });
  }
});

// 通用消息端点 - 发送告警给管理员
app.post('/notify-admin', async (req: Request, res: Response) => {
  try {
    const { message, type } = req.body;

    if (!message) {
      return res.status(400).json({ error: '缺少 message 参数' });
    }

    const typeEmoji: Record<string, string> = {
      error: '🚨',
      warning: '⚠️',
      info: 'ℹ️',
      success: '✅',
    };

    const emoji = typeEmoji[type] || 'ℹ️';
    const formattedMessage = `${emoji} <b>系统通知</b>\n\n${message}`;

    for (const adminId of ADMIN_TG_IDS) {
      try {
        await bot.api.sendMessage(adminId, formattedMessage, {
          parse_mode: 'HTML',
        });
      } catch (err) {
        console.error(`发送给管理员 ${adminId} 失败:`, err);
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error('管理员通知发送失败:', error);
    res.status(500).json({ error: '发送失败' });
  }
});

// ==================== 启动服务 ====================

app.listen(HTTP_PORT, () => {
  console.log(`🌐 Admin Bot HTTP 服务已启动: http://localhost:${HTTP_PORT}`);
  console.log(`   - POST /notify-withdraw - 提现审核通知`);
  console.log(`   - POST /notify-admin - 管理员告警`);
  console.log(`   - GET /health - 健康检查`);
});

// 设置管理员 Bot 命令菜单
async function setupBotMenu() {
  try {
    await bot.api.setMyCommands([
      { command: 'start', description: '管理员控制台' },
      { command: 'status', description: '系统状态' },
      { command: 'balance', description: '热钱包余额' },
      { command: 'pending', description: '待审核提现' },
      { command: 'sweep', description: '归集扫描' },
    ]);
    console.log('✅ Admin Bot 命令菜单已设置');
  } catch (error) {
    console.error('设置命令菜单失败:', error);
  }
}

console.log('🔐 HOOT Admin Bot 启动中...');
console.log(`📋 授权管理员: ${ADMIN_TG_IDS.join(', ') || '无（请配置 ADMIN_TG_IDS）'}`);

bot.start({
  onStart: async (botInfo) => {
    console.log(`✅ Admin Bot 已启动: @${botInfo.username}`);
    await setupBotMenu();
  },
});
