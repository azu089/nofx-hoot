/**
 * 自动审核服务集成测试脚本
 *
 * 使用方法：
 * npx ts-node scripts/test-auto-review-integration.ts
 */

import { AutoReviewService } from '../src/modules/strategies/auto-review.service';
import { PrismaService } from '../src/prisma/prisma.service';

async function main() {
  console.log('===== 自动审核服务集成测试 =====\n');

  const prisma = new PrismaService();
  const autoReviewService = new AutoReviewService(prisma);

  // 测试用例 1：恶意代码检测
  console.log('=== 测试用例 1：恶意代码检测 ===');
  const maliciousCode = `
import os  # 禁止的模块
import subprocess  # 禁止的模块

def populate_indicators(dataframe, metadata):
    os.system("ls -la")
    subprocess.run(["whoami"])
    return dataframe
`;

  // 创建临时策略
  const maliciousStrategy = await prisma.client.strategies.create({
    data: {
      name: '测试-恶意代码',
      content: maliciousCode,
      owner_type: 'user',
      is_public: false,
    },
  });

  const result1 = await autoReviewService.performAutoReview(maliciousStrategy.id);
  console.log(`审核结果: ${result1.passed ? '✅ 通过' : '❌ 失败'}`);
  console.log(`严重问题数: ${result1.criticalIssues.length}`);
  console.log(`问题列表:`);
  result1.criticalIssues.forEach((issue, idx) => {
    console.log(`  ${idx + 1}. ${issue}`);
  });
  console.log('');

  // 测试用例 2：硬编码 API Key 检测
  console.log('=== 测试用例 2：硬编码 API Key 检测 ===');
  const insecureCode = `
api_key = "abc123def456ghi789jkl012mno345pqr"
api_secret = "xyz987wvu654tsr321qpo098nml876kji"

def populate_indicators(dataframe, metadata):
    return dataframe
`;

  const insecureStrategy = await prisma.client.strategies.create({
    data: {
      name: '测试-硬编码密钥',
      content: insecureCode,
      owner_type: 'user',
      is_public: false,
    },
  });

  const result2 = await autoReviewService.performAutoReview(insecureStrategy.id);
  console.log(`审核结果: ${result2.passed ? '✅ 通过' : '❌ 失败'}`);
  console.log(`严重问题数: ${result2.criticalIssues.length}`);
  console.log(`问题列表:`);
  result2.criticalIssues.forEach((issue, idx) => {
    console.log(`  ${idx + 1}. ${issue}`);
  });
  console.log('');

  // 测试用例 3：安全的策略代码
  console.log('=== 测试用例 3：安全的策略代码 ===');
  const safeCode = `
import pandas as pd
import talib

def populate_indicators(dataframe, metadata):
    dataframe['rsi'] = talib.RSI(dataframe['close'], timeperiod=14)
    dataframe['ema'] = talib.EMA(dataframe['close'], timeperiod=20)
    return dataframe

def populate_entry_trend(dataframe, metadata):
    dataframe.loc[
        (dataframe['rsi'] < 30) &
        (dataframe['close'] > dataframe['ema']),
        'enter_long'] = 1
    return dataframe
`;

  const safeStrategy = await prisma.client.strategies.create({
    data: {
      name: '测试-安全策略',
      content: safeCode,
      owner_type: 'user',
      is_public: false,
    },
  });

  const result3 = await autoReviewService.performAutoReview(safeStrategy.id);
  console.log(`审核结果: ${result3.passed ? '✅ 通过' : '❌ 失败'}`);
  console.log(`严重问题数: ${result3.criticalIssues.length}`);
  console.log(`警告数: ${result3.warnings.length}`);
  console.log('');

  // 清理测试数据
  console.log('=== 清理测试数据 ===');
  await prisma.client.strategies.deleteMany({
    where: {
      id: {
        in: [maliciousStrategy.id, insecureStrategy.id, safeStrategy.id],
      },
    },
  });
  console.log('测试数据已清理');
  console.log('');

  // 汇总结果
  console.log('===== 测试汇总 =====');
  console.log(`测试用例 1（恶意代码）: ${result1.passed ? '❌ 未检测到' : '✅ 成功检测'}`);
  console.log(`测试用例 2（硬编码密钥）: ${result2.passed ? '❌ 未检测到' : '✅ 成功检测'}`);
  console.log(`测试用例 3（安全代码）: ${result3.passed ? '✅ 成功通过' : '❌ 误报'}`);
  console.log('');

  if (!result1.passed && !result2.passed && result3.passed) {
    console.log('🎉 所有测试通过！自动审核服务工作正常。');
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
