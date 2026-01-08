/**
 * 收益分成定价服务集成测试脚本
 *
 * 使用方法：
 * npx ts-node scripts/test-revenue-pricing-integration.ts
 */

import { RevenuePricingService } from '../src/modules/strategies/revenue-pricing.service';
import { PrismaService } from '../src/prisma/prisma.service';
import Decimal from 'decimal.js';

async function main() {
  console.log('===== 收益分成定价服务集成测试 =====\n');

  const prisma = new PrismaService();
  const pricingService = new RevenuePricingService(prisma);

  // 测试用例 1：Bronze 等级策略（新策略，无数据）
  console.log('=== 测试用例 1：Bronze 等级策略 ===');
  const bronzeStrategy = await prisma.client.strategies.create({
    data: {
      name: '测试-Bronze策略',
      content: 'def populate_indicators(df): return df',
      owner_type: 'user',
      is_public: false,
      revenue_share_enabled: true,
      total_users: 0,
      total_profit: '0',
      avg_win_rate: new Decimal('0'),
    },
  });

  const tier1 = await pricingService.calculateStrategyTier(bronzeStrategy.id);
  console.log(`等级: ${tier1.tier.toUpperCase()}`);
  console.log(`分成比例: ${tier1.rate.times(100)}%`);
  if (tier1.nextTier) {
    console.log(`距离 ${tier1.nextTier.level} 还需要:`);
    console.log(`  - 用户数: ${tier1.nextTier.requiredUsers} 人`);
    console.log(`  - 累计盈利: ${tier1.nextTier.requiredProfit} USDT`);
    console.log(`  - 胜率: ${tier1.nextTier.requiredWinRate}%`);
  }
  console.log('');

  // 测试用例 2：Silver 等级策略（达到白银门槛）
  console.log('=== 测试用例 2：Silver 等级策略 ===');
  const silverStrategy = await prisma.client.strategies.create({
    data: {
      name: '测试-Silver策略',
      content: 'def populate_indicators(df): return df',
      owner_type: 'user',
      is_public: false,
      revenue_share_enabled: true,
      total_users: 15, // ≥ 10
      total_profit: '2500', // ≥ 1000
      avg_win_rate: new Decimal('55'), // ≥ 50
    },
  });

  const tier2 = await pricingService.calculateStrategyTier(silverStrategy.id);
  console.log(`等级: ${tier2.tier.toUpperCase()}`);
  console.log(`分成比例: ${tier2.rate.times(100)}%`);
  if (tier2.nextTier) {
    console.log(`距离 ${tier2.nextTier.level} 还需要:`);
    console.log(`  - 用户数: ${tier2.nextTier.requiredUsers} 人`);
    console.log(`  - 累计盈利: ${tier2.nextTier.requiredProfit} USDT`);
    console.log(`  - 胜率: ${tier2.nextTier.requiredWinRate}%`);
  }
  console.log('');

  // 测试用例 3：Gold 等级策略（达到黄金门槛）
  console.log('=== 测试用例 3：Gold 等级策略 ===');
  const goldStrategy = await prisma.client.strategies.create({
    data: {
      name: '测试-Gold策略',
      content: 'def populate_indicators(df): return df',
      owner_type: 'user',
      is_public: false,
      revenue_share_enabled: true,
      total_users: 100, // ≥ 50
      total_profit: '25000', // ≥ 10000
      avg_win_rate: new Decimal('65'), // ≥ 60
    },
  });

  const tier3 = await pricingService.calculateStrategyTier(goldStrategy.id);
  console.log(`等级: ${tier3.tier.toUpperCase()}`);
  console.log(`分成比例: ${tier3.rate.times(100)}%`);
  if (tier3.nextTier) {
    console.log(`距离 ${tier3.nextTier.level} 还需要:`);
    console.log(`  - 用户数: ${tier3.nextTier.requiredUsers} 人`);
    console.log(`  - 累计盈利: ${tier3.nextTier.requiredProfit} USDT`);
    console.log(`  - 胜率: ${tier3.nextTier.requiredWinRate}%`);
  } else {
    console.log('已达到最高等级！');
  }
  console.log('');

  // 测试用例 4：边界情况（刚好达到 Silver 门槛）
  console.log('=== 测试用例 4：边界情况（刚好达到 Silver）===');
  const borderStrategy = await prisma.client.strategies.create({
    data: {
      name: '测试-Border策略',
      content: 'def populate_indicators(df): return df',
      owner_type: 'user',
      is_public: false,
      revenue_share_enabled: true,
      total_users: 10, // 刚好 10
      total_profit: '1000', // 刚好 1000
      avg_win_rate: new Decimal('50'), // 刚好 50
    },
  });

  const tier4 = await pricingService.calculateStrategyTier(borderStrategy.id);
  console.log(`等级: ${tier4.tier.toUpperCase()}`);
  console.log(`分成比例: ${tier4.rate.times(100)}%`);
  console.log('');

  // 测试用例 5：更新策略等级到数据库
  console.log('=== 测试用例 5：更新策略等级到数据库 ===');
  await pricingService.updateStrategyRevenueTier(silverStrategy.id);

  const updatedStrategy = await prisma.client.strategies.findUnique({
    where: { id: silverStrategy.id },
    select: {
      tier: true,
      revenue_share_rate: true,
      last_performance_calc: true,
    },
  });

  console.log(`数据库中的等级: ${updatedStrategy?.tier}`);
  console.log(`数据库中的分成比例: ${updatedStrategy?.revenue_share_rate}`);
  console.log(`最后计算时间: ${updatedStrategy?.last_performance_calc}`);
  console.log('');

  // 测试用例 6：获取升级进度
  console.log('=== 测试用例 6：获取升级进度 ===');
  const progress = await pricingService.getUpgradeProgress(silverStrategy.id);
  console.log(`当前等级: ${progress.currentTier.toUpperCase()}`);
  console.log(`当前分成比例: ${new Decimal(progress.currentRate).times(100)}%`);
  if (progress.nextTier) {
    console.log(`\n距离 ${progress.nextTier.level.toUpperCase()} 还需要:`);
    console.log(`  - 用户数: ${progress.nextTier.requiredUsers} 人 (进度: ${progress.nextTier.progressUsers}%)`);
    console.log(`  - 累计盈利: ${progress.nextTier.requiredProfit} USDT (进度: ${progress.nextTier.progressProfit}%)`);
    console.log(`  - 胜率: ${progress.nextTier.requiredWinRate}% (进度: ${progress.nextTier.progressWinRate}%)`);
  }
  console.log('');

  // 测试用例 7：获取等级配置
  console.log('=== 测试用例 7：获取等级配置 ===');
  const configs = pricingService.getTierConfigs();
  configs.forEach((config) => {
    console.log(`${config.level.toUpperCase()}:`);
    console.log(`  - 最低用户数: ${config.minUsers}`);
    console.log(`  - 最低盈利: ${config.minProfit} USDT`);
    console.log(`  - 最低胜率: ${config.minWinRate}%`);
    console.log(`  - 分成比例: ${new Decimal(config.rate).times(100)}%`);
  });
  console.log('');

  // 清理测试数据
  console.log('=== 清理测试数据 ===');
  await prisma.client.strategies.deleteMany({
    where: {
      id: {
        in: [
          bronzeStrategy.id,
          silverStrategy.id,
          goldStrategy.id,
          borderStrategy.id,
        ],
      },
    },
  });
  console.log('测试数据已清理');
  console.log('');

  // 汇总结果
  console.log('===== 测试汇总 =====');
  console.log(`测试用例 1（Bronze）: ${tier1.tier === 'bronze' ? '✅ 通过' : '❌ 失败'}`);
  console.log(`测试用例 2（Silver）: ${tier2.tier === 'silver' ? '✅ 通过' : '❌ 失败'}`);
  console.log(`测试用例 3（Gold）: ${tier3.tier === 'gold' ? '✅ 通过' : '❌ 失败'}`);
  console.log(`测试用例 4（边界）: ${tier4.tier === 'silver' ? '✅ 通过' : '❌ 失败'}`);
  console.log(`测试用例 5（更新）: ${updatedStrategy?.tier === 'silver' ? '✅ 通过' : '❌ 失败'}`);
  console.log(`测试用例 6（进度）: ${progress.currentTier === 'silver' ? '✅ 通过' : '❌ 失败'}`);
  console.log(`测试用例 7（配置）: ${configs.length === 3 ? '✅ 通过' : '❌ 失败'}`);
  console.log('');

  const allPassed =
    tier1.tier === 'bronze' &&
    tier2.tier === 'silver' &&
    tier3.tier === 'gold' &&
    tier4.tier === 'silver' &&
    updatedStrategy?.tier === 'silver' &&
    progress.currentTier === 'silver' &&
    configs.length === 3;

  if (allPassed) {
    console.log('🎉 所有测试通过！收益分成定价服务工作正常。');
  } else {
    console.log('⚠️ 部分测试失败，请检查代码逻辑。');
  }

  await prisma.client.$disconnect();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('测试失败:', error);
    process.exit(1);
  });
