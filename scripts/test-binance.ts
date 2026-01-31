// 测试币安 API Key 是否能正常工作
import * as ccxt from 'ccxt';

const apiKey = 'QAw4bOjGeozx0HH88reDuATdw8O9XblFVedae8bfiTfgjXiuu2yg61PEN9IkM2s8';
const apiSecret = 'h3dEs2tL4caFcgr31lYbyR92LPRjdzcaxZ7bJVW4XgAzZo2ItmRRizPr1iUH5ID9';

async function test() {
  console.log('测试币安 API...');
  console.log('API Key:', apiKey.slice(0, 8) + '...');

  const exchange = new ccxt.binance({
    apiKey,
    secret: apiSecret,
    enableRateLimit: true,
    options: {
      defaultType: 'future',
    },
  });

  try {
    console.log('\n1. 加载市场...');
    await exchange.loadMarkets();
    console.log('✅ 市场加载成功');

    console.log('\n2. 查询余额...');
    const balance = await exchange.fetchBalance();
    console.log('✅ 余额查询成功');
    console.log('USDT:', balance.free?.USDT || 0);

    console.log('\n测试通过！API Key 正常工作');
  } catch (error: any) {
    console.log('\n❌ 错误:', error.message);
  }
}

test();
