/**
 * 简单的数据库种子脚本
 * 使用 Node.js 原生代码直接插入数据
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const exchanges = [
  {
    exchange_id: 'binance',
    name: 'Binance',
    logo: '🟡',
    rebate: '20%',
    link: 'https://www.binance.com/zh-CN/register?ref=QUANTFI',
    description: '全球最大的加密货币交易所',
    features: ['现货交易', '合约交易', '流动性最高', 'API 稳定'],
    is_active: true,
    sort_order: 1,
  },
  {
    exchange_id: 'okx',
    name: 'OKX',
    logo: '⚫',
    rebate: '20%',
    link: 'https://www.okx.com/join/QUANTFI',
    description: '优质的综合性交易平台',
    features: ['现货交易', '合约交易', '手续费低', 'API 完善'],
    is_active: true,
    sort_order: 2,
  },
  {
    exchange_id: 'bybit',
    name: 'Bybit',
    logo: '🔶',
    rebate: '20%',
    link: 'https://www.bybit.com/invite?ref=QUANTFI',
    description: '专注衍生品的新兴交易所',
    features: ['合约交易', '杠杆交易', '新手友好', '体验流畅'],
    is_active: true,
    sort_order: 3,
  },
];

async function main() {
  console.log('开始插入交易所推广链接数据...\n');

  for (const ex of exchanges) {
    try {
      // 检查是否已存在
      const existing = await prisma.exchange_links.findUnique({
        where: { exchange_id: ex.exchange_id },
      });

      if (existing) {
        console.log(`⏩ 跳过: ${ex.name} (${ex.exchange_id}) - 已存在`);
        continue;
      }

      // 创建新记录
      const created = await prisma.exchange_links.create({
        data: ex,
      });

      console.log(`✅ 创建成功: ${created.name} (${created.exchange_id})`);
    } catch (error) {
      console.error(`❌ 创建失败: ${ex.name}`, error.message);
    }
  }

  console.log('\n✅ 数据初始化完成！');
}

main()
  .catch((error) => {
    console.error('❌ 脚本执行失败:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
