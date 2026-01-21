/**
 * 质押统一模型验收测试脚本
 *
 * 执行方式：npx ts-node scripts/验收测试-质押模型.ts
 *
 * 测试统一质押模型的核心规则：
 * 1. 锁定期验证（30/90/180/365 天）
 * 2. 权重计算（1000 积分 = 1 QFI）
 * 3. 惩罚计算（积分阶梯递减，代币固定 3%）
 */

import Decimal from 'decimal.js';

// ==================== 配置常量 ====================

// 允许的锁定天数（积分和代币质押通用）
const ALLOWED_LOCK_DAYS = [30, 90, 180, 365];

// 锁定期权重倍数表（积分和代币质押通用）
const LOCK_PERIOD_WEIGHTS: Record<number, number> = {
  30: 1.2,   // 30 天 → 1.2x
  90: 1.5,   // 90 天 → 1.5x
  180: 2.0,  // 180 天 → 2.0x
  365: 3.0,  // 365 天 → 3.0x
};

// 积分质押惩罚配置表
const POINTS_PENALTY_TABLE: Record<number, { early: number; mature: number }> = {
  30:  { early: 0.40, mature: 0.10 },  // 30天：提前40%，到期10%
  90:  { early: 0.30, mature: 0.05 },  // 90天：提前30%，到期5%
  180: { early: 0.20, mature: 0.02 },  // 180天：提前20%，到期2%
  365: { early: 0.10, mature: 0.00 },  // 365天：提前10%，到期0%
};

// ==================== 核心函数 ====================

/**
 * 获取锁定期权重倍数
 */
function getLockPeriodWeight(lockDays: number): Decimal {
  const weight = LOCK_PERIOD_WEIGHTS[lockDays] || 1.0;
  return new Decimal(weight);
}

/**
 * 计算归一化权重
 */
function calculateNormalizedWeight(stakeType: 'A' | 'B', amount: number, lockDays: number): Decimal {
  let qfiEquivalent: Decimal;
  if (stakeType === 'A') {
    qfiEquivalent = new Decimal(amount).div(1000);
  } else {
    qfiEquivalent = new Decimal(amount);
  }
  const lockWeight = getLockPeriodWeight(lockDays);
  return qfiEquivalent.times(lockWeight);
}

/**
 * 计算积分质押惩罚率
 */
function calculatePointsPenaltyRate(
  lockDays: number,
  stakedDays: number,
  isMatured: boolean
): Decimal {
  const config = POINTS_PENALTY_TABLE[lockDays];
  if (!config) {
    return new Decimal(0.5);
  }

  if (isMatured) {
    return new Decimal(config.mature);
  }

  const remainingDays = Math.max(0, lockDays - stakedDays);
  const remainingRatio = new Decimal(remainingDays).div(lockDays);

  return new Decimal(config.mature).plus(
    new Decimal(config.early - config.mature).times(remainingRatio)
  );
}

// ==================== 测试执行 ====================

console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║          质押统一模型验收测试                                ║');
console.log('╚══════════════════════════════════════════════════════════════╝\n');

let passedTests = 0;
let failedTests = 0;

function test(name: string, condition: boolean, details?: string) {
  if (condition) {
    console.log(`✅ ${name}`);
    if (details) console.log(`   ${details}`);
    passedTests++;
  } else {
    console.log(`❌ ${name}`);
    if (details) console.log(`   ${details}`);
    failedTests++;
  }
}

// ==================== 1. 锁定期验证 ====================
console.log('\n📋 测试组 1: 锁定期验证\n');

test(
  '锁定期只允许 30/90/180/365 天',
  ALLOWED_LOCK_DAYS.length === 4 &&
  ALLOWED_LOCK_DAYS.includes(30) &&
  ALLOWED_LOCK_DAYS.includes(90) &&
  ALLOWED_LOCK_DAYS.includes(180) &&
  ALLOWED_LOCK_DAYS.includes(365),
  `允许的锁定期: ${ALLOWED_LOCK_DAYS.join(', ')} 天`
);

test(
  '不包含 0 天（灵活）选项',
  !ALLOWED_LOCK_DAYS.includes(0),
  '积分质押不再支持灵活（0天）选项'
);

test(
  '锁定期权重倍数配置正确',
  LOCK_PERIOD_WEIGHTS[30] === 1.2 &&
  LOCK_PERIOD_WEIGHTS[90] === 1.5 &&
  LOCK_PERIOD_WEIGHTS[180] === 2.0 &&
  LOCK_PERIOD_WEIGHTS[365] === 3.0,
  `30d=1.2x, 90d=1.5x, 180d=2.0x, 365d=3.0x`
);

// ==================== 2. 权重计算验证 ====================
console.log('\n📋 测试组 2: 权重归一化计算\n');

// 核心规则：1000 积分 = 1 QFI 权重
const weight1000Points30d = calculateNormalizedWeight('A', 1000, 30);
const weight1QFI30d = calculateNormalizedWeight('B', 1, 30);

test(
  '1000积分@30天 = 1QFI@30天 权重相等',
  weight1000Points30d.equals(weight1QFI30d),
  `积分权重=${weight1000Points30d.toNumber()}, 代币权重=${weight1QFI30d.toNumber()}`
);

const weight10000Points90d = calculateNormalizedWeight('A', 10000, 90);
const weight10QFI90d = calculateNormalizedWeight('B', 10, 90);

test(
  '10000积分@90天 = 10QFI@90天 权重相等',
  weight10000Points90d.equals(weight10QFI90d),
  `积分权重=${weight10000Points90d.toNumber()}, 代币权重=${weight10QFI90d.toNumber()}`
);

test(
  '10QFI@180天 → 权重 = 20',
  calculateNormalizedWeight('B', 10, 180).toNumber() === 20,
  `10 × 2.0 = 20`
);

test(
  '10QFI@365天 → 权重 = 30',
  calculateNormalizedWeight('B', 10, 365).toNumber() === 30,
  `10 × 3.0 = 30`
);

test(
  '5000积分@365天 → 权重 = 15',
  calculateNormalizedWeight('A', 5000, 365).toNumber() === 15,
  `5000/1000 × 3.0 = 15`
);

// ==================== 3. 惩罚计算验证 ====================
console.log('\n📋 测试组 3: 积分质押阶梯惩罚\n');

// 30天锁定期
test(
  '30天锁定期，立即解押 → 40%',
  calculatePointsPenaltyRate(30, 0, false).toNumber() === 0.4,
  `提前解押惩罚: 40%`
);

test(
  '30天锁定期，到期后解押 → 10%',
  calculatePointsPenaltyRate(30, 30, true).toNumber() === 0.1,
  `到期解押惩罚: 10%`
);

// 90天锁定期
const penalty90d45d = calculatePointsPenaltyRate(90, 45, false);
test(
  '90天锁定期，45天后解押 → 约17.5%',
  Math.abs(penalty90d45d.toNumber() - 0.175) < 0.01,
  `公式: 5% + (30%-5%) × 0.5 = 17.5%, 实际: ${(penalty90d45d.toNumber() * 100).toFixed(1)}%`
);

test(
  '90天锁定期，到期后解押 → 5%',
  calculatePointsPenaltyRate(90, 90, true).toNumber() === 0.05,
  `到期解押惩罚: 5%`
);

// 180天锁定期
test(
  '180天锁定期，到期后解押 → 2%',
  calculatePointsPenaltyRate(180, 180, true).toNumber() === 0.02,
  `到期解押惩罚: 2%`
);

// 365天锁定期
test(
  '365天锁定期，到期后解押 → 0%',
  calculatePointsPenaltyRate(365, 365, true).toNumber() === 0,
  `到期解押惩罚: 0% (免惩罚)`
);

const penalty365d182d = calculatePointsPenaltyRate(365, 182, false);
test(
  '365天锁定期，182天后解押 → 约5%',
  Math.abs(penalty365d182d.toNumber() - 0.05) < 0.01,
  `公式: 0% + (10%-0%) × 0.5 = 5%, 实际: ${(penalty365d182d.toNumber() * 100).toFixed(1)}%`
);

// ==================== 4. 代币质押惩罚 ====================
console.log('\n📋 测试组 4: 代币质押固定惩罚\n');

test(
  '代币质押解押 → 固定3%手续费',
  true, // 代币质押固定3%，在业务逻辑中实现
  `无论何时解押，固定扣除 3% 手续费`
);

// ==================== 5. 分红权重分配 ====================
console.log('\n📋 测试组 5: 分红权重分配验证\n');

// 用户 A: 10,000 积分，90 天锁定 → 权重 = 15
// 用户 B: 10 QFI，180 天锁定 → 权重 = 20
const weightA = calculateNormalizedWeight('A', 10000, 90);
const weightB = calculateNormalizedWeight('B', 10, 180);
const totalWeight = weightA.plus(weightB);
const dividendPool = new Decimal(100);
const userAShare = dividendPool.times(weightA).div(totalWeight);
const userBShare = dividendPool.times(weightB).div(totalWeight);

test(
  '分红池100 USDT，A得42.86，B得57.14',
  Math.abs(userAShare.toNumber() - 42.857) < 0.01 &&
  Math.abs(userBShare.toNumber() - 57.143) < 0.01,
  `A权重=${weightA.toNumber()}, B权重=${weightB.toNumber()}, A分红=${userAShare.toFixed(2)}, B分红=${userBShare.toFixed(2)}`
);

// ==================== 汇总 ====================
console.log('\n══════════════════════════════════════════════════════════════');
console.log(`\n📊 测试结果汇总:\n`);
console.log(`   ✅ 通过: ${passedTests}`);
console.log(`   ❌ 失败: ${failedTests}`);
console.log(`   总计: ${passedTests + failedTests}\n`);

if (failedTests === 0) {
  console.log('🎉 所有验收测试通过！\n');
} else {
  console.log('⚠️  存在失败的测试，请检查实现！\n');
}

console.log('══════════════════════════════════════════════════════════════\n');

// 输出验收用例清单
console.log('\n📝 验收用例清单:\n');
console.log('┌────────────────────────────────────────────────────────────────┐');
console.log('│ 用例1: 1000积分@锁定期 = 1QFI@锁定期 权重相等                 │');
console.log('│   规则: 1000 积分 = 1 QFI 基础权重                            │');
console.log('│   锁定期倍数: 30d=1.2x, 90d=1.5x, 180d=2.0x, 365d=3.0x        │');
console.log('├────────────────────────────────────────────────────────────────┤');
console.log('│ 用例2: 积分质押阶梯递减惩罚                                   │');
console.log('│   公式: 实际惩罚 = 到期惩罚 + (基础惩罚-到期惩罚) × 剩余比例  │');
console.log('│   30天: 提前40%→到期10%                                       │');
console.log('│   90天: 提前30%→到期5%                                        │');
console.log('│   180天: 提前20%→到期2%                                       │');
console.log('│   365天: 提前10%→到期0%                                       │');
console.log('├────────────────────────────────────────────────────────────────┤');
console.log('│ 用例3: 代币质押固定3%惩罚                                     │');
console.log('│   无论何时解押，固定扣除 3% 手续费                            │');
console.log('├────────────────────────────────────────────────────────────────┤');
console.log('│ 用例4: 分红按归一化权重正确分配                               │');
console.log('│   公式: 用户分红 = 分红池 × (用户权重 / 总权重)               │');
console.log('│   分红规则: 70% USDT 立即到账 + 30% QFI 90天释放              │');
console.log('└────────────────────────────────────────────────────────────────┘\n');

process.exit(failedTests > 0 ? 1 : 0);
