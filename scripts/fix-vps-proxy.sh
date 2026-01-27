#!/bin/bash
# ============================================================
# VPS 代理服务修复脚本
#
# 使用方法：
# 1. 通过 DigitalOcean 控制台登录 VPS
# 2. 执行此脚本
# ============================================================

echo "=========================================="
echo "QuantFi VPS 完整修复脚本"
echo "=========================================="

# ==================== 修复 SSH 配置 ====================
echo "[0/6] 修复 SSH 配置（启用密码登录）..."
sed -i 's/^#*PasswordAuthentication.*/PasswordAuthentication yes/' /etc/ssh/sshd_config
sed -i 's/^#*PermitRootLogin.*/PermitRootLogin yes/' /etc/ssh/sshd_config
systemctl restart sshd 2>/dev/null || service ssh restart 2>/dev/null || true
echo "✅ SSH 密码登录已启用"

# 停止现有服务
echo "[1/6] 停止现有代理服务..."
pm2 stop quantfi-proxy 2>/dev/null || true
pm2 delete quantfi-proxy 2>/dev/null || true

# 备份旧代码
echo "[2/6] 备份旧代码..."
if [ -f /opt/quantfi/proxy/server.js ]; then
  cp /opt/quantfi/proxy/server.js /opt/quantfi/proxy/server.js.backup.$(date +%Y%m%d%H%M%S)
fi

# 写入修复后的代理服务代码
echo "[3/6] 写入修复后的代理服务代码..."
cat > /opt/quantfi/proxy/server.js << 'PROXYEOF'
const express = require('express');
const ccxt = require('ccxt');
const fs = require('fs');

// 加载环境变量（修复 PM2 启动时环境变量丢失的问题）
const envPath = '/opt/quantfi/.env';
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    // 修复：正确处理值中包含 '=' 的情况（如 URL）
    const idx = line.indexOf('=');
    if (idx > 0) {
      const key = line.substring(0, idx).trim();
      const value = line.substring(idx + 1).trim();
      if (key && value && !process.env[key]) {
        process.env[key] = value;
      }
    }
  });
  console.log('✅ 环境变量已从 .env 文件加载');
  console.log('   INSTANCE_TOKEN 前8位:', process.env.INSTANCE_TOKEN?.substring(0, 8) || 'N/A');
} else {
  console.warn('⚠️ .env 文件不存在:', envPath);
}

const app = express();
app.use(express.json());

const PORT = 8081;

// 支持的交易所
const SUPPORTED_EXCHANGES = ['binance', 'okx', 'bybit', 'gate', 'huobi', 'kucoin'];

// 创建交易所实例
function createExchange(exchangeName, apiKey, secretKey, type = 'spot') {
  const exchangeId = exchangeName.toLowerCase();
  if (!SUPPORTED_EXCHANGES.includes(exchangeId)) {
    throw new Error(`不支持的交易所: ${exchangeName}`);
  }

  const ExchangeClass = ccxt[exchangeId];
  return new ExchangeClass({
    apiKey,
    secret: secretKey,
    enableRateLimit: true,
    timeout: 30000,
    options: { defaultType: type },
  });
}

// 验证 API Key
app.post('/api/verify', async (req, res) => {
  const { exchange, apiKey, secretKey } = req.body;

  if (!exchange || !apiKey || !secretKey) {
    return res.status(400).json({ valid: false, error: '缺少必要参数' });
  }

  try {
    // 1. 先验证现货权限
    const spotEx = createExchange(exchange, apiKey, secretKey, 'spot');
    const balanceData = await spotEx.fetchBalance();

    // 提取主要币种余额
    const mainCurrencies = ['USDT', 'USDC', 'BTC', 'ETH', 'BNB', 'SOL'];
    const balances = [];
    let totalUsdt = 0;

    for (const currency of mainCurrencies) {
      const balance = balanceData[currency];
      if (balance && (Number(balance.total) > 0 || currency === 'USDT')) {
        balances.push({
          currency,
          free: String(balance.free || 0),
          used: String(balance.used || 0),
          total: String(balance.total || 0),
        });
      }
    }

    const usdtBalance = balanceData['USDT'];
    if (usdtBalance) {
      totalUsdt = Number(usdtBalance.total) || 0;
    }

    // 2. 检测合约权限（尝试获取合约余额）
    const permissions = ['spot'];
    try {
      // 修复：正确获取 exchangeId
      const exchangeId = exchange.toLowerCase();
      // 币安使用 'future'（USDT-M 合约），其他交易所使用 'swap'（永续合约）
      const futuresType = exchangeId === 'binance' ? 'future' : 'swap';
      const futuresEx = createExchange(exchange, apiKey, secretKey, futuresType);
      await futuresEx.fetchBalance();
      permissions.push('futures');
      console.log('合约权限检测成功, 交易所:', exchangeId, '类型:', futuresType);
    } catch (futuresErr) {
      // 合约权限检测失败，可能没有开通或没有权限
      console.log('合约权限检测失败:', futuresErr.message);
    }

    res.json({
      valid: true,
      permissions,
      balances,
      totalBalanceUsdt: totalUsdt.toFixed(2),
    });
  } catch (error) {
    console.error('验证失败:', error.message);
    res.json({ valid: false, error: error.message });
  }
});

// 获取余额
app.post('/api/balance', async (req, res) => {
  const { exchange, apiKey, secretKey } = req.body;

  if (!exchange || !apiKey || !secretKey) {
    return res.status(400).json({ error: '缺少必要参数' });
  }

  try {
    const ex = createExchange(exchange, apiKey, secretKey);
    const balanceData = await ex.fetchBalance();
    const usdtBalance = Number(balanceData['USDT']?.total || 0);

    res.json({ usdtBalance });
  } catch (error) {
    console.error('获取余额失败:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'quantfi-proxy', version: '1.1.0' });
});

// ==================== 配置更新端点（供主服务器调用）====================
const { exec } = require('child_process');

// 更新 Freqtrade 配置
app.post('/api/update-config', async (req, res) => {
  const { config, strategyName, strategyCode } = req.body;

  // 验证 Token（防止未授权访问）
  const instanceToken = process.env.INSTANCE_TOKEN;
  const requestToken = req.headers['x-instance-token'];

  if (!instanceToken || requestToken !== instanceToken) {
    return res.status(401).json({ error: '未授权访问' });
  }

  try {
    // 1. 如果有策略代码，保存策略文件
    if (strategyName && strategyCode) {
      const strategyPath = `/opt/quantfi/freqtrade/user_data/strategies/${strategyName}.py`;
      fs.writeFileSync(strategyPath, strategyCode, 'utf8');
      console.log(`策略文件已保存: ${strategyPath}`);
    }

    // 2. 保存配置文件
    if (config) {
      const configPath = '/opt/quantfi/freqtrade/user_data/config.json';
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
      console.log('配置文件已更新');
    }

    // 3. 重启 Freqtrade 容器
    exec('cd /opt/quantfi && docker-compose restart freqtrade', (error, stdout, stderr) => {
      if (error) {
        console.error(`重启失败: ${error.message}`);
        return res.status(500).json({ error: `重启失败: ${error.message}` });
      }
      console.log('Freqtrade 重启成功');
      res.json({
        success: true,
        message: '配置已更新，Freqtrade 正在重启',
        strategyName: strategyName || null
      });
    });
  } catch (error) {
    console.error('配置更新失败:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// 仅上传策略代码（不更新配置，不重启）- 用于回测前上传
app.post('/api/upload-strategy', (req, res) => {
  const { strategyName, strategyCode } = req.body;

  // 验证 Token
  const instanceToken = process.env.INSTANCE_TOKEN;
  const requestToken = req.headers['x-instance-token'];

  if (!instanceToken || requestToken !== instanceToken) {
    return res.status(401).json({ error: '未授权访问' });
  }

  if (!strategyName || !strategyCode) {
    return res.status(400).json({ error: '缺少策略名称或代码' });
  }

  try {
    const strategyPath = `/opt/quantfi/freqtrade/user_data/strategies/${strategyName}.py`;
    fs.writeFileSync(strategyPath, strategyCode, 'utf8');
    console.log(`策略文件已上传: ${strategyPath}`);
    res.json({ success: true, message: '策略已上传', strategyName });
  } catch (error) {
    console.error('策略上传失败:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// 重启 Freqtrade
app.post('/api/restart', (req, res) => {
  const instanceToken = process.env.INSTANCE_TOKEN;
  const requestToken = req.headers['x-instance-token'];

  if (!instanceToken || requestToken !== instanceToken) {
    return res.status(401).json({ error: '未授权访问' });
  }

  exec('cd /opt/quantfi && docker-compose restart freqtrade', (error, stdout, stderr) => {
    if (error) {
      return res.status(500).json({ error: `重启失败: ${error.message}` });
    }
    res.json({ success: true, message: 'Freqtrade 已重启' });
  });
});

// 全局错误处理
app.use((err, req, res, next) => {
  console.error('未捕获的错误:', err);
  res.status(500).json({ error: '服务器内部错误' });
});

// 启动服务
app.listen(PORT, '0.0.0.0', () => {
  console.log(`QuantFi 代理服务运行在端口 ${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/api/health`);
});
PROXYEOF

# 确保依赖已安装
echo "[4/6] 安装/更新依赖..."
cd /opt/quantfi/proxy
npm install --production 2>/dev/null || npm install

# 重启服务
echo "[5/6] 启动代理服务..."
pm2 start /opt/quantfi/proxy/server.js --name quantfi-proxy
pm2 save

# 等待服务启动
sleep 3

# 验证服务
echo ""
echo "=========================================="
echo "验证代理服务..."
if curl -sf http://localhost:8081/api/health > /dev/null 2>&1; then
  echo "✅ 代理服务启动成功！"
  curl -s http://localhost:8081/api/health | python3 -m json.tool 2>/dev/null || curl -s http://localhost:8081/api/health
else
  echo "❌ 代理服务启动失败，查看日志："
  pm2 logs quantfi-proxy --lines 20
fi

echo ""
echo "=========================================="
echo "修复脚本执行完成！"
echo ""
echo "下一步："
echo "1. 在前端重新点击「验证」按钮测试 API Key"
echo "2. 如果仍有问题，运行: pm2 logs quantfi-proxy"
echo "=========================================="
