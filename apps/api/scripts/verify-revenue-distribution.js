#!/usr/bin/env node

/**
 * QuantFi - 收入分配验算脚本
 *
 * 验证规则：
 * 1. 40% 运营 + 40% 回购 + 20% 储备 = 100%
 * 2. 回购后：50% 销毁 + 50% 分配 = 100%
 * 3. 使用 Decimal.js 保证精度
 */

const Decimal = require('decimal.js');

// 配置精度
Decimal.set({ precision: 20, rounding: Decimal.ROUND_DOWN });

console.log('=== QuantFi 收入分配验算脚本 ===\n');

// 测试用例 1: 总收入 10000 USDT
const totalRevenue = new Decimal('10000.00000000');
console.log(`总收入: ${totalRevenue} USDT\n`);

// 分配比例
const OPERATIONS_RATE = new Decimal('0.4');
const BUYBACK_RATE = new Decimal('0.4');
const RESERVE_RATE = new Decimal('0.2');

// 计算分配
const operations = totalRevenue.times(OPERATIONS_RATE);
const buyback = totalRevenue.times(BUYBACK_RATE);
const reserve = totalRevenue.times(RESERVE_RATE);

console.log('📊 分配结果:');
console.log(`  运营费用 (40%): ${operations.toFixed(8)} USDT`);
console.log(`  回购费用 (40%): ${buyback.toFixed(8)} USDT`);
console.log(`  储备金   (20%): ${reserve.toFixed(8)} USDT`);

// 验算 1: 分配总和 = 总收入
const sum = operations.plus(buyback).plus(reserve);
console.log(`\n✅ 验算 1: 分配总和 = 总收入`);
console.log(`  ${operations.toFixed(8)} + ${buyback.toFixed(8)} + ${reserve.toFixed(8)} = ${sum.toFixed(8)}`);
console.log(`  期望: ${totalRevenue.toFixed(8)}`);
console.log(`  结果: ${sum.equals(totalRevenue) ? '✅ 通过' : '❌ 失败'}`);

// 测试用例 2: 回购分配
console.log('\n---\n');
const buybackAmount = new Decimal('4000.00000000');
console.log(`回购金额: ${buybackAmount} USDT`);

// 模拟 DEX 价格：1 USDT = 10 QFI
const mockPrice = new Decimal('0.1'); // 1 QFI = 0.1 USDT
const tokensBought = buybackAmount.div(mockPrice);
console.log(`回购价格: 1 QFI = ${mockPrice.toFixed(8)} USDT`);
console.log(`回购数量: ${tokensBought.toFixed(8)} QFI`);

// 回购后分配
const BURN_RATE = new Decimal('0.5');
const DISTRIBUTE_RATE = new Decimal('0.5');

const tokensBurned = tokensBought.times(BURN_RATE);
const tokensDistributed = tokensBought.times(DISTRIBUTE_RATE);

console.log(`\n📊 回购后分配:`);
console.log(`  销毁数量 (50%): ${tokensBurned.toFixed(8)} QFI`);
console.log(`  分配数量 (50%): ${tokensDistributed.toFixed(8)} QFI`);

// 验算 2: 销毁 + 分配 = 回购总量
const sumTokens = tokensBurned.plus(tokensDistributed);
console.log(`\n✅ 验算 2: 销毁 + 分配 = 回购总量`);
console.log(`  ${tokensBurned.toFixed(8)} + ${tokensDistributed.toFixed(8)} = ${sumTokens.toFixed(8)}`);
console.log(`  期望: ${tokensBought.toFixed(8)}`);
console.log(`  结果: ${sumTokens.equals(tokensBought) ? '✅ 通过' : '❌ 失败'}`);

// 测试用例 3: 边界测试（极小金额）
console.log('\n---\n');
const tinyRevenue = new Decimal('0.00000001');
console.log(`极小金额测试: ${tinyRevenue} USDT`);

const tinyOps = tinyRevenue.times(OPERATIONS_RATE);
const tinyBuyback = tinyRevenue.times(BUYBACK_RATE);
const tinyReserve = tinyRevenue.times(RESERVE_RATE);
const tinySum = tinyOps.plus(tinyBuyback).plus(tinyReserve);

console.log(`  运营: ${tinyOps.toFixed(8)}`);
console.log(`  回购: ${tinyBuyback.toFixed(8)}`);
console.log(`  储备: ${tinyReserve.toFixed(8)}`);
console.log(`  总和: ${tinySum.toFixed(8)}`);
console.log(`  结果: ${tinySum.equals(tinyRevenue) ? '✅ 通过' : '❌ 失败'}`);

console.log('\n=== 验算完成 ===');
