import { Test, TestingModule } from '@nestjs/testing';
import { AutoReviewService } from './auto-review.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('AutoReviewService', () => {
  let service: AutoReviewService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AutoReviewService,
        {
          provide: PrismaService,
          useValue: {
            client: {
              strategies: {
                findUnique: jest.fn(),
              },
            },
          },
        },
      ],
    }).compile();

    service = module.get<AutoReviewService>(AutoReviewService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('应该被定义', () => {
    expect(service).toBeDefined();
  });

  describe('performAutoReview', () => {
    const strategyId = 'test-strategy-id';

    it('测试用例 1：检测恶意代码（import os）', async () => {
      // 准备：包含 import os 的策略代码
      const maliciousCode = `
import os
import subprocess

def populate_indicators(dataframe, metadata):
    os.system("ls -la")
    subprocess.run(["whoami"])
    return dataframe
`;

      jest.spyOn(prisma.client.strategies, 'findUnique').mockResolvedValue({
        id: strategyId,
        content: maliciousCode,
        name: '恶意策略',
      } as any);

      // 执行
      const result = await service.performAutoReview(strategyId);

      // 验证
      expect(result.passed).toBe(false);
      expect(result.criticalIssues.length).toBeGreaterThan(0);
      expect(result.criticalIssues.some((issue) => issue.includes('os 模块'))).toBe(true);
      expect(result.criticalIssues.some((issue) => issue.includes('subprocess 模块'))).toBe(true);
    });

    it('测试用例 2：检测硬编码 API Key', async () => {
      // 准备：包含硬编码 API Key 的策略代码
      const insecureCode = `
api_key = "abc123def456ghi789jkl012mno345pqr"
api_secret = "xyz987wvu654tsr321qpo098nml876kji"

def populate_indicators(dataframe, metadata):
    return dataframe
`;

      jest.spyOn(prisma.client.strategies, 'findUnique').mockResolvedValue({
        id: strategyId,
        content: insecureCode,
        name: '不安全策略',
      } as any);

      // 执行
      const result = await service.performAutoReview(strategyId);

      // 验证
      expect(result.passed).toBe(false);
      expect(result.criticalIssues.length).toBeGreaterThan(0);
      expect(result.criticalIssues.some((issue) => issue.includes('API Key'))).toBe(true);
      expect(result.criticalIssues.some((issue) => issue.includes('Secret'))).toBe(true);
    });

    it('测试用例 3：安全的策略代码通过审核', async () => {
      // 准备：安全的策略代码（包含所有必需元素）
      const safeCode = `
from freqtrade.strategy import IStrategy
import pandas as pd
import talib

class SafeStrategy(IStrategy):
    INTERFACE_VERSION = 3

    def populate_indicators(self, dataframe, metadata):
        dataframe['rsi'] = talib.RSI(dataframe['close'], timeperiod=14)
        dataframe['ema'] = talib.EMA(dataframe['close'], timeperiod=20)
        return dataframe

    def populate_entry_trend(self, dataframe, metadata):
        dataframe.loc[
            (dataframe['rsi'] < 30) &
            (dataframe['close'] > dataframe['ema']),
            'enter_long'] = 1
        return dataframe

    def populate_exit_trend(self, dataframe, metadata):
        dataframe.loc[
            (dataframe['rsi'] > 70),
            'exit_long'] = 1
        return dataframe
`;

      jest.spyOn(prisma.client.strategies, 'findUnique').mockResolvedValue({
        id: strategyId,
        content: safeCode,
        name: '安全策略',
      } as any);

      // 执行
      const result = await service.performAutoReview(strategyId);

      // 验证：应该完全通过，无警告无致命问题
      expect(result.passed).toBe(true);
      expect(result.criticalIssues.length).toBe(0);
      expect(result.warnings.length).toBe(0);
    });

    it('测试用例 4：检测 eval 和 exec', async () => {
      // 准备：包含 eval 和 exec 的代码
      const dangerousCode = `
def populate_indicators(dataframe, metadata):
    code = "print('hello')"
    eval(code)
    exec("import sys")
    return dataframe
`;

      jest.spyOn(prisma.client.strategies, 'findUnique').mockResolvedValue({
        id: strategyId,
        content: dangerousCode,
        name: '危险策略',
      } as any);

      // 执行
      const result = await service.performAutoReview(strategyId);

      // 验证
      expect(result.passed).toBe(false);
      expect(result.criticalIssues.some((issue) => issue.includes('eval'))).toBe(true);
      expect(result.criticalIssues.some((issue) => issue.includes('exec'))).toBe(true);
    });

    it('测试用例 5：注释中的密钥不应触发检测', async () => {
      // 准备：注释中包含密钥示例的代码
      const codeWithComments = `
# 示例配置（不要这样做）：
# api_key = "abc123def456ghi789jkl012mno345pqr"

def populate_indicators(dataframe, metadata):
    # 正确的做法是从环境变量读取
    # api_key = os.getenv('BINANCE_API_KEY')
    return dataframe
`;

      jest.spyOn(prisma.client.strategies, 'findUnique').mockResolvedValue({
        id: strategyId,
        content: codeWithComments,
        name: '带注释策略',
      } as any);

      // 执行
      const result = await service.performAutoReview(strategyId);

      // 验证（注释中的密钥应该被过滤掉）
      expect(result.passed).toBe(true);
      expect(result.criticalIssues.length).toBe(0);
    });

    it('测试用例 6：检测无限循环（资源滥用）', async () => {
      // 准备：包含无限循环的代码（无退出条件）
      const infiniteLoopCode = `
def populate_indicators(dataframe, metadata):
    while True:
        # 持续处理数据
        process_data()
    return dataframe
`;

      jest.spyOn(prisma.client.strategies, 'findUnique').mockResolvedValue({
        id: strategyId,
        content: infiniteLoopCode,
        name: '无限循环策略',
      } as any);

      // 执行
      const result = await service.performAutoReview(strategyId);

      // 验证：资源滥用检测应返回警告，但不阻止上架
      expect(result.passed).toBe(true);
      expect(result.warnings.some((w) => w.includes('无限循环'))).toBe(true);
    });

    it('测试用例 7：允许有 break 的 while True 循环', async () => {
      // 准备：包含有 break 的 while True 循环
      const validWhileLoopCode = `
def populate_indicators(dataframe, metadata):
    while True:
        data = fetch_data()
        if not data:
            break
        process(data)
    return dataframe
`;

      jest.spyOn(prisma.client.strategies, 'findUnique').mockResolvedValue({
        id: strategyId,
        content: validWhileLoopCode,
        name: '有效循环策略',
      } as any);

      // 执行
      const result = await service.performAutoReview(strategyId);

      // 验证：有 break 的循环不应触发警告
      expect(result.warnings.some((w) => w.includes('无限循环'))).toBe(false);
    });

    it('测试用例 8：检测大范围循环', async () => {
      // 准备：包含大范围循环的代码
      const largeRangeCode = `
def populate_indicators(dataframe, metadata):
    for i in range(10000000):
        calculate()
    return dataframe
`;

      jest.spyOn(prisma.client.strategies, 'findUnique').mockResolvedValue({
        id: strategyId,
        content: largeRangeCode,
        name: '大范围循环策略',
      } as any);

      // 执行
      const result = await service.performAutoReview(strategyId);

      // 验证
      expect(result.passed).toBe(true);
      expect(result.warnings.some((w) => w.includes('大范围循环'))).toBe(true);
    });

    it('测试用例 9：检测递归函数', async () => {
      // 准备：包含递归函数的代码
      const recursiveCode = `
def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n-1) + fibonacci(n-2)

def populate_indicators(dataframe, metadata):
    result = fibonacci(10)
    return dataframe
`;

      jest.spyOn(prisma.client.strategies, 'findUnique').mockResolvedValue({
        id: strategyId,
        content: recursiveCode,
        name: '递归策略',
      } as any);

      // 执行
      const result = await service.performAutoReview(strategyId);

      // 验证
      expect(result.passed).toBe(true);
      expect(result.warnings.some((w) => w.includes('递归函数'))).toBe(true);
    });

    it('测试用例 10：检测嵌套循环', async () => {
      // 准备：包含 3 层嵌套循环的代码
      const nestedLoopCode = `
def populate_indicators(dataframe, metadata):
    for i in range(10):
        for j in range(10):
            for k in range(10):
                calculate(i, j, k)
    return dataframe
`;

      jest.spyOn(prisma.client.strategies, 'findUnique').mockResolvedValue({
        id: strategyId,
        content: nestedLoopCode,
        name: '嵌套循环策略',
      } as any);

      // 执行
      const result = await service.performAutoReview(strategyId);

      // 验证
      expect(result.passed).toBe(true);
      expect(result.warnings.some((w) => w.includes('嵌套循环'))).toBe(true);
    });

    it('测试用例 11：检测缺少必需方法（性能问题）', async () => {
      // 准备：缺少必需方法的代码
      const incompleteStrategyCode = `
from freqtrade.strategy import IStrategy

class MyStrategy(IStrategy):
    INTERFACE_VERSION = 3

    def populate_indicators(self, dataframe, metadata):
        return dataframe

    # 缺少 populate_entry_trend
    # 缺少 populate_exit_trend
`;

      jest.spyOn(prisma.client.strategies, 'findUnique').mockResolvedValue({
        id: strategyId,
        content: incompleteStrategyCode,
        name: '不完整策略',
      } as any);

      // 执行
      const result = await service.performAutoReview(strategyId);

      // 验证
      expect(result.passed).toBe(true); // 性能问题只是警告
      expect(result.warnings.some((w) => w.includes('populate_entry_trend'))).toBe(true);
      expect(result.warnings.some((w) => w.includes('populate_exit_trend'))).toBe(true);
    });

    it('测试用例 12：检测缺少 INTERFACE_VERSION', async () => {
      // 准备：缺少 INTERFACE_VERSION 的代码
      const noVersionCode = `
from freqtrade.strategy import IStrategy

class MyStrategy(IStrategy):
    # 缺少 INTERFACE_VERSION

    def populate_indicators(self, dataframe, metadata):
        return dataframe
`;

      jest.spyOn(prisma.client.strategies, 'findUnique').mockResolvedValue({
        id: strategyId,
        content: noVersionCode,
        name: '无版本策略',
      } as any);

      // 执行
      const result = await service.performAutoReview(strategyId);

      // 验证
      expect(result.passed).toBe(true);
      expect(result.warnings.some((w) => w.includes('INTERFACE_VERSION'))).toBe(true);
    });

    it('测试用例 13：检测未继承 IStrategy', async () => {
      // 准备：未继承 IStrategy 的代码
      const noInheritanceCode = `
class MyStrategy:
    INTERFACE_VERSION = 3

    def populate_indicators(self, dataframe, metadata):
        return dataframe
`;

      jest.spyOn(prisma.client.strategies, 'findUnique').mockResolvedValue({
        id: strategyId,
        content: noInheritanceCode,
        name: '未继承策略',
      } as any);

      // 执行
      const result = await service.performAutoReview(strategyId);

      // 验证
      expect(result.passed).toBe(true);
      expect(result.warnings.some((w) => w.includes('IStrategy'))).toBe(true);
    });

    it('测试用例 14：检测循环中的计算（应使用向量化）', async () => {
      // 准备：在循环中执行计算的代码
      const loopCalcCode = `
def populate_indicators(self, dataframe, metadata):
    for i in range(len(dataframe)):
        dataframe['rsi'][i] = ta.RSI(dataframe['close'], timeperiod=14)[i]
    return dataframe
`;

      jest.spyOn(prisma.client.strategies, 'findUnique').mockResolvedValue({
        id: strategyId,
        content: loopCalcCode,
        name: '循环计算策略',
      } as any);

      // 执行
      const result = await service.performAutoReview(strategyId);

      // 验证
      expect(result.passed).toBe(true);
      expect(result.warnings.some((w) => w.includes('向量化'))).toBe(true);
    });

    it('测试用例 15：综合测试 - 多种问题同时存在', async () => {
      // 准备：包含多种问题的代码
      const multiIssueCode = `
import os  # 恶意代码
api_key = "abc123def456ghi789jkl012mno345pqr"  # 硬编码密钥

while True:
    pass  # 无限循环

class MyStrategy:
    # 缺少必需方法
    pass
`;

      jest.spyOn(prisma.client.strategies, 'findUnique').mockResolvedValue({
        id: strategyId,
        content: multiIssueCode,
        name: '多问题策略',
      } as any);

      // 执行
      const result = await service.performAutoReview(strategyId);

      // 验证
      expect(result.passed).toBe(false); // 因为有严重问题
      expect(result.criticalIssues.length).toBeGreaterThanOrEqual(2); // 至少 os + api_key
      expect(result.warnings.length).toBeGreaterThan(0); // 至少无限循环警告
    });

    it('测试用例 16：策略不存在时应抛出错误', async () => {
      // 准备：模拟策略不存在
      jest.spyOn(prisma.client.strategies, 'findUnique').mockResolvedValue(null);

      // 执行 & 验证
      await expect(service.performAutoReview('non-existent-id')).rejects.toThrow(
        '策略不存在',
      );
    });
  });
});
