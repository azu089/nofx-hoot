import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { SignalsService } from '../src/modules/signals/signals.service';

describe('并发交易测试 (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let signalsService: SignalsService;

  const testUsers = Array.from({ length: 5 }, (_, i) => ({
    email: `concurrent-test-${Date.now()}-${i}@example.com`,
    password: 'Test123456!',
  }));

  let accessTokens: string[] = [];
  let userIds: string[] = [];
  let strategyId: string;
  let testApiKeyIds: string[] = [];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
    signalsService = app.get<SignalsService>(SignalsService);

    // 步骤 1: 创建 5 个测试用户
    console.log('创建 5 个测试用户...');
    for (const user of testUsers) {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(user);

      accessTokens.push(response.body.accessToken);
      userIds.push(response.body.user.id);

      // 给每个用户充值 USDT
      await prisma.user.update({
        where: { id: response.body.user.id },
        data: { usdtBalance: '10000' },
      });
    }

    console.log(`创建用户成功: ${userIds.length} 个用户`);

    // 步骤 2: 创建一个测试策略
    console.log('创建测试策略...');
    const strategy = await prisma.strategy.create({
      data: {
        name: '并发测试策略',
        description: '用于测试多用户并发接收信号',
        author: userIds[0],
        type: 'grid',
        riskLevel: 'medium',
        minInvestment: '100',
        expectedReturn: '10',
        status: 'active',
        isPublic: true,
        freqtradeId: `concurrent-test-${Date.now()}`,
        config: {},
      },
    });
    strategyId = strategy.id;
    console.log(`策略创建成功: ${strategyId}`);

    // 步骤 3: 为每个用户创建测试用的 API Key
    console.log('为用户创建 API Key...');
    for (const userId of userIds) {
      const apiKey = await prisma.apiKey.create({
        data: {
          userId,
          exchange: 'binance',
          label: '测试 API Key',
          encryptedKey: Buffer.from('test-key'),
          encryptedSecret: Buffer.from('test-secret'),
          iv: Buffer.from('test-iv'),
          authTag: Buffer.from('test-tag'),
          isActive: true,
        },
      });
      testApiKeyIds.push(apiKey.id);
    }
    console.log(`API Key 创建成功: ${testApiKeyIds.length} 个`);
  });

  afterAll(async () => {
    console.log('清理测试数据...');

    // 清理信号执行记录
    await prisma.signalExecution.deleteMany({
      where: { userId: { in: userIds } },
    });

    // 清理订阅
    await prisma.strategySubscription.deleteMany({
      where: { userId: { in: userIds } },
    });

    // 清理信号
    await prisma.signal.deleteMany({
      where: { strategyId },
    });

    // 清理策略
    await prisma.strategy.deleteMany({
      where: { id: strategyId },
    });

    // 清理 API Keys
    await prisma.apiKey.deleteMany({
      where: { id: { in: testApiKeyIds } },
    });

    // 清理用户
    await prisma.user.deleteMany({
      where: { id: { in: userIds } },
    });

    await app.close();
    console.log('清理完成');
  });

  describe('多用户并发交易场景', () => {
    let signalId: string;

    beforeEach(async () => {
      // 清理之前的信号和执行记录
      await prisma.signalExecution.deleteMany({
        where: { userId: { in: userIds } },
      });
      await prisma.signal.deleteMany({
        where: { strategyId },
      });
    });

    // 正常路径 - 多个用户订阅同一策略
    it('应该允许多个用户订阅同一策略', async () => {
      console.log('测试: 多用户订阅策略');

      const subscribePromises = userIds.map((userId, index) =>
        request(app.getHttpServer())
          .post(`/strategies/${strategyId}/subscribe`)
          .set('Authorization', `Bearer ${accessTokens[index]}`)
          .send({
            investmentAmount: '100',
            apiKeyId: testApiKeyIds[index],
            amountPerTrade: '50',
          }),
      );

      const responses = await Promise.all(subscribePromises);

      // 验证所有订阅都成功
      responses.forEach((response, index) => {
        expect(response.status).toBe(201);
        expect(response.body.strategyId).toBe(strategyId);
        expect(response.body.userId).toBe(userIds[index]);
        expect(response.body.status).toBe('active');
      });

      // 验证数据库中的订阅记录
      const subscriptions = await prisma.strategySubscription.findMany({
        where: { strategyId },
      });
      expect(subscriptions.length).toBe(5);

      console.log(`✓ ${subscriptions.length} 个用户成功订阅`);
    });

    // 正常路径 - 发送信号并验证所有用户都收到
    it('应该将信号分发给所有订阅用户', async () => {
      console.log('测试: 信号分发');

      // 先确保所有用户已订阅
      await Promise.all(
        userIds.map((userId, index) =>
          prisma.strategySubscription.create({
            data: {
              userId,
              strategyId,
              apiKeyId: testApiKeyIds[index],
              amountPerTrade: '50',
              maxPositions: 3,
              status: 'active',
            },
          }),
        ),
      );

      // 模拟发送信号
      const signal = await prisma.signal.create({
        data: {
          strategyId,
          symbol: 'BTC/USDT',
          side: 'buy',
          price: '50000',
        },
      });
      signalId = signal.id;

      console.log(`信号已创建: ${signalId}`);

      // 为每个用户创建执行记录（模拟信号分发）
      await Promise.all(
        userIds.map((userId) =>
          signalsService.markExecutionQueued(signalId, userId),
        ),
      );

      // 验证所有用户都有执行记录
      const executions = await prisma.signalExecution.findMany({
        where: { signalId },
      });

      expect(executions.length).toBe(5);
      executions.forEach((execution) => {
        expect(execution.status).toBe('queued');
        expect(userIds).toContain(execution.userId);
      });

      console.log(`✓ 信号成功分发给 ${executions.length} 个用户`);
    });

    // 并发路径 - 验证并发执行没有数据竞争
    it('应该正确处理并发执行，无数据竞争', async () => {
      console.log('测试: 并发执行');

      // 创建订阅
      await Promise.all(
        userIds.map((userId, index) =>
          prisma.strategySubscription.create({
            data: {
              userId,
              strategyId,
              apiKeyId: testApiKeyIds[index],
              amountPerTrade: '50',
              maxPositions: 3,
              status: 'active',
            },
          }),
        ),
      );

      // 创建信号
      const signal = await prisma.signal.create({
        data: {
          strategyId,
          symbol: 'ETH/USDT',
          side: 'buy',
          price: '3000',
        },
      });
      signalId = signal.id;

      // 并发标记执行状态（模拟多个用户同时执行）
      const markStartedPromises = userIds.map((userId) =>
        signalsService.markExecutionStarted(signalId, userId, 'binance'),
      );

      await Promise.all(markStartedPromises);

      // 验证所有执行记录状态正确
      const executionsAfterStart = await prisma.signalExecution.findMany({
        where: { signalId },
      });

      expect(executionsAfterStart.length).toBe(5);
      executionsAfterStart.forEach((execution) => {
        expect(execution.status).toBe('executing');
        expect(execution.exchange).toBe('binance');
        expect(execution.startedAt).toBeDefined();
      });

      console.log(`✓ ${executionsAfterStart.length} 个执行记录状态正确`);

      // 并发标记为成功（模拟交易完成）
      const markSuccessPromises = userIds.map((userId, index) =>
        signalsService.markExecutionSuccess(
          signalId,
          userId,
          `order-${index}`,
          '3000.5',
          '0.0166',
        ),
      );

      await Promise.all(markSuccessPromises);

      // 验证最终状态
      const executionsAfterSuccess = await prisma.signalExecution.findMany({
        where: { signalId },
      });

      expect(executionsAfterSuccess.length).toBe(5);
      executionsAfterSuccess.forEach((execution) => {
        expect(execution.status).toBe('success');
        expect(execution.orderId).toBeDefined();
        expect(execution.executedPrice).toBe('3000.5');
        expect(execution.completedAt).toBeDefined();
      });

      // 验证信号的执行计数
      const updatedSignal = await prisma.signal.findUnique({
        where: { id: signalId },
      });

      expect(updatedSignal?.executedCount).toBe(5);
      expect(updatedSignal?.failedCount).toBe(0);

      console.log(`✓ 信号执行计数正确: ${updatedSignal?.executedCount}`);
    });

    // 异常路径 - 部分用户成功，部分用户失败
    it('应该正确处理部分成功部分失败的情况', async () => {
      console.log('测试: 部分成功部分失败');

      // 创建订阅
      await Promise.all(
        userIds.map((userId, index) =>
          prisma.strategySubscription.create({
            data: {
              userId,
              strategyId,
              apiKeyId: testApiKeyIds[index],
              amountPerTrade: '50',
              maxPositions: 3,
              status: 'active',
            },
          }),
        ),
      );

      // 创建信号
      const signal = await prisma.signal.create({
        data: {
          strategyId,
          symbol: 'BNB/USDT',
          side: 'sell',
          price: '300',
        },
      });
      signalId = signal.id;

      // 为所有用户创建执行记录
      await Promise.all(
        userIds.map((userId) =>
          signalsService.markExecutionQueued(signalId, userId),
        ),
      );

      // 前 3 个用户成功，后 2 个用户失败
      const successPromises = userIds.slice(0, 3).map((userId, index) =>
        signalsService.markExecutionSuccess(
          signalId,
          userId,
          `order-success-${index}`,
          '300.1',
          '0.166',
        ),
      );

      const failedPromises = userIds.slice(3, 5).map((userId, index) =>
        signalsService.markExecutionFailed(
          signalId,
          userId,
          'INSUFFICIENT_BALANCE',
          '余额不足',
        ),
      );

      await Promise.all([...successPromises, ...failedPromises]);

      // 验证结果
      const allExecutions = await prisma.signalExecution.findMany({
        where: { signalId },
      });

      const successExecutions = allExecutions.filter(
        (e) => e.status === 'success',
      );
      const failedExecutions = allExecutions.filter(
        (e) => e.status === 'failed',
      );

      expect(successExecutions.length).toBe(3);
      expect(failedExecutions.length).toBe(2);

      // 验证信号计数
      const updatedSignal = await prisma.signal.findUnique({
        where: { id: signalId },
      });

      expect(updatedSignal?.executedCount).toBe(3);
      expect(updatedSignal?.failedCount).toBe(2);

      console.log(
        `✓ 成功: ${updatedSignal?.executedCount}, 失败: ${updatedSignal?.failedCount}`,
      );
    });

    // 边界路径 - 验证唯一约束（同一用户不能重复执行同一信号）
    it('应该防止同一用户重复执行同一信号', async () => {
      console.log('测试: 防止重复执行');

      const userId = userIds[0];

      // 创建订阅
      await prisma.strategySubscription.create({
        data: {
          userId,
          strategyId,
          apiKeyId: testApiKeyIds[0],
          amountPerTrade: '50',
          maxPositions: 3,
          status: 'active',
        },
      });

      // 创建信号
      const signal = await prisma.signal.create({
        data: {
          strategyId,
          symbol: 'SOL/USDT',
          side: 'buy',
          price: '100',
        },
      });
      signalId = signal.id;

      // 第一次创建执行记录
      await signalsService.markExecutionQueued(signalId, userId);

      // 尝试第二次创建（应该更新而不是创建新记录）
      await signalsService.markExecutionQueued(signalId, userId);

      // 验证只有一条记录
      const executions = await prisma.signalExecution.findMany({
        where: { signalId, userId },
      });

      expect(executions.length).toBe(1);

      console.log('✓ 唯一约束生效，防止重复执行');
    });

    // 性能路径 - 测试信号统计
    it('应该正确统计信号执行情况', async () => {
      console.log('测试: 信号统计');

      // 创建订阅
      await Promise.all(
        userIds.map((userId, index) =>
          prisma.strategySubscription.create({
            data: {
              userId,
              strategyId,
              apiKeyId: testApiKeyIds[index],
              amountPerTrade: '50',
              maxPositions: 3,
              status: 'active',
            },
          }),
        ),
      );

      // 创建多个信号并执行
      const signals = await Promise.all([
        prisma.signal.create({
          data: { strategyId, symbol: 'BTC/USDT', side: 'buy', price: '50000' },
        }),
        prisma.signal.create({
          data: { strategyId, symbol: 'ETH/USDT', side: 'sell', price: '3000' },
        }),
      ]);

      // 为每个信号创建执行记录
      for (const signal of signals) {
        for (const userId of userIds) {
          await signalsService.markExecutionQueued(signal.id, userId);
          await signalsService.markExecutionSuccess(
            signal.id,
            userId,
            `order-${signal.id}-${userId}`,
            '50000',
            '0.001',
          );
        }
      }

      // 获取统计
      const stats = await signalsService.getSignalStats(24);

      expect(stats.totalSignals).toBeGreaterThanOrEqual(2);
      expect(stats.totalExecutions).toBeGreaterThanOrEqual(10);
      expect(stats.successCount).toBeGreaterThanOrEqual(10);

      console.log('✓ 统计结果:', stats);
    });
  });
});
