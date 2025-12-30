import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import Decimal from 'decimal.js';

/**
 * 计费模块 E2E 测试
 *
 * 测试流程：
 * 1. 充值申请 → 管理员审核 → 余额增加
 * 2. VPS 订阅扣费
 * 3. 燃油费抽成
 * 4. 今日盈亏查询
 * 5. 计费日志查询
 *
 * 注意：
 * - 需要真实数据库环境（使用 describe.skip 标记）
 * - 测试使用独立的测试用户，避免影响生产数据
 * - 所有金额使用 DECIMAL 类型和 decimal.js 计算
 */
describe.skip('Billing (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  // 测试用户
  let testUser: any;
  let testAdmin: any;
  let userToken: string;
  let adminToken: string;

  // 测试数据 ID
  let depositId: string;
  let instanceId: string;
  let tradeId: string;

  beforeAll(async () => {
    // 创建测试模块
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // 应用全局管道
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();

    // 获取 Prisma 服务
    prisma = app.get<PrismaService>(PrismaService);

    // 创建测试用户和管理员
    await setupTestUsers();
  });

  afterAll(async () => {
    // 清理测试数据
    await cleanupTestData();

    await app.close();
  });

  /**
   * 初始化测试用户
   */
  async function setupTestUsers() {
    // 创建普通用户
    testUser = await prisma.client.users.create({
      data: {
        email: 'test-billing@example.com',
        password_hash: 'hashed_password', // 实际应使用 bcrypt
        role: 'user',
      },
    });

    // 创建用户钱包（初始余额 0）
    await prisma.client.wallets.create({
      data: {
        user_id: testUser.id,
        usdt_balance: '0',
      },
    });

    // 创建管理员用户
    testAdmin = await prisma.client.users.create({
      data: {
        email: 'admin-billing@example.com',
        password_hash: 'hashed_password',
        role: 'admin',
      },
    });

    // 注：实际项目中应通过 /auth/login 获取真实 token
    // 这里简化处理，直接使用用户 ID 作为 token 模拟
    userToken = `mock_token_${testUser.id}`;
    adminToken = `mock_token_${testAdmin.id}`;
  }

  /**
   * 清理测试数据
   */
  async function cleanupTestData() {
    if (!testUser?.id) return;

    // 删除顺序：子表 → 父表
    await prisma.client.billing_logs.deleteMany({ where: { user_id: testUser.id } });
    await prisma.client.deposits.deleteMany({ where: { user_id: testUser.id } });
    await prisma.client.trade_history.deleteMany({ where: { user_id: testUser.id } });
    await prisma.client.instances.deleteMany({ where: { user_id: testUser.id } });
    await prisma.client.wallets.deleteMany({ where: { user_id: testUser.id } });
    await prisma.client.users.deleteMany({ where: { id: testUser.id } });

    if (testAdmin?.id) {
      await prisma.client.users.deleteMany({ where: { id: testAdmin.id } });
    }
  }

  describe('充值流程', () => {
    it('创建充值申请 - 成功', async () => {
      const dto = {
        amount: '100.00000000',
        method: 'crypto',
        chain: 'TRC20',
        fromAddress: 'TTest123456789',
        txHash: '0xtest123',
        proofImageUrl: 'https://example.com/proof.jpg',
      };

      const response = await request(app.getHttpServer())
        .post('/api/deposits')
        .set('Authorization', `Bearer ${userToken}`)
        .send(dto)
        .expect(201);

      expect(response.body.code).toBe(0);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.amount).toBe('100.00000000');
      expect(response.body.data.status).toBe('pending');

      depositId = response.body.data.id;
    });

    it('创建充值申请 - 金额格式错误', async () => {
      const dto = {
        amount: 'invalid',
        method: 'crypto',
        chain: 'TRC20',
      };

      await request(app.getHttpServer())
        .post('/api/deposits')
        .set('Authorization', `Bearer ${userToken}`)
        .send(dto)
        .expect(400);
    });

    it('管理员审核通过 - 余额增加', async () => {
      // 审核前余额
      const walletBefore = await prisma.client.wallets.findUnique({
        where: { user_id: testUser.id },
      });
      const balanceBefore = new Decimal(walletBefore!.usdt_balance);

      // 管理员审核通过
      await request(app.getHttpServer())
        .post(`/api/deposits/admin/${depositId}/review`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ action: 'approve' })
        .expect(200);

      // 审核后余额
      const walletAfter = await prisma.client.wallets.findUnique({
        where: { user_id: testUser.id },
      });
      const balanceAfter = new Decimal(walletAfter!.usdt_balance);

      // 验算：新余额 = 原余额 + 充值金额
      const expectedBalance = balanceBefore.plus(new Decimal('100.00000000'));
      expect(balanceAfter.toString()).toBe(expectedBalance.toString());

      // 验证充值状态已更新
      const deposit = await prisma.client.deposits.findUnique({
        where: { id: depositId },
      });
      expect(deposit!.status).toBe('approved');
      expect(deposit!.reviewed_by).toBe(testAdmin.id);
    });

    it('管理员审核通过 - 幂等性检查', async () => {
      // 重复审核应失败
      await request(app.getHttpServer())
        .post(`/api/deposits/admin/${depositId}/review`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ action: 'approve' })
        .expect(400);
    });
  });

  describe('扣费流程', () => {
    it('VPS 订阅扣费 - 成功', async () => {
      // 扣费前余额
      const walletBefore = await prisma.client.wallets.findUnique({
        where: { user_id: testUser.id },
      });
      const balanceBefore = new Decimal(walletBefore!.usdt_balance);

      // 创建 VPS 实例（自动扣费 25 USDT）
      const dto = {
        region: 'sgp1',
        size: 's-1vcpu-1gb',
      };

      // 注：实际测试需要 mock DigitalOcean API
      // 这里假设创建成功，只测试扣费逻辑
      const response = await request(app.getHttpServer())
        .post('/api/instances')
        .set('Authorization', `Bearer ${userToken}`)
        .send(dto)
        .expect(201);

      instanceId = response.body.data.id;

      // 扣费后余额
      const walletAfter = await prisma.client.wallets.findUnique({
        where: { user_id: testUser.id },
      });
      const balanceAfter = new Decimal(walletAfter!.usdt_balance);

      // 验算：新余额 = 原余额 - 订阅费（25 USDT）
      const expectedBalance = balanceBefore.minus(new Decimal('25.00000000'));
      expect(balanceAfter.toString()).toBe(expectedBalance.toString());

      // 验证计费日志
      const billingLog = await prisma.client.billing_logs.findFirst({
        where: {
          user_id: testUser.id,
          billing_type: 'subscription',
        },
      });
      expect(billingLog).not.toBeNull();
      expect(billingLog!.amount.toString()).toBe('25.00000000');
      expect(billingLog!.status).toBe('completed');
    });

    it('VPS 订阅扣费 - 余额不足', async () => {
      // 先扣除余额，使其不足 25 USDT
      await prisma.client.wallets.update({
        where: { user_id: testUser.id },
        data: { usdt_balance: '10.00000000' },
      });

      const dto = {
        region: 'sgp1',
        size: 's-1vcpu-1gb',
      };

      const response = await request(app.getHttpServer())
        .post('/api/instances')
        .set('Authorization', `Bearer ${userToken}`)
        .send(dto)
        .expect(400);

      expect(response.body.message).toContain('余额不足');

      // 恢复余额
      await prisma.client.wallets.update({
        where: { user_id: testUser.id },
        data: { usdt_balance: '100.00000000' },
      });
    });

    it('燃油费抽成 - 盈利交易', async () => {
      // 模拟一笔盈利交易
      const trade = await prisma.client.trade_history.create({
        data: {
          user_id: testUser.id,
          instance_id: instanceId,
          symbol: 'BTC/USDT',
          side: 'long',
          entry_price: '50000.00000000',
          exit_price: '51000.00000000',
          amount: '0.10000000',
          pnl: '100.00000000', // 盈利 100 USDT
          gas_fee: '0.00000000', // 初始未抽成
          status: 'closed',
          closed_at: new Date(),
        },
      });

      tradeId = trade.id;

      // 调用燃油费计算接口
      const response = await request(app.getHttpServer())
        .post('/api/billing/calculate-gas-fee')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ tradeId })
        .expect(200);

      expect(response.body.code).toBe(0);
      expect(response.body.data.charged).toBe(1);
      expect(response.body.data.failed).toBe(0);

      // 验算：燃油费 = 盈利 * 20%
      const expectedGasFee = new Decimal('100.00000000').times(new Decimal('0.20'));
      expect(response.body.data.totalGasFee).toBe(expectedGasFee.toString());

      // 验证交易记录已更新
      const updatedTrade = await prisma.client.trade_history.findUnique({
        where: { id: tradeId },
      });
      expect(updatedTrade!.gas_fee).toBe(expectedGasFee.toString());

      // 验证计费日志
      const billingLog = await prisma.client.billing_logs.findFirst({
        where: {
          user_id: testUser.id,
          billing_type: 'gas_fee',
          reference_id: tradeId,
        },
      });
      expect(billingLog).not.toBeNull();
      expect(billingLog!.amount.toString()).toBe(expectedGasFee.toString());
    });

    it('燃油费抽成 - 亏损交易跳过', async () => {
      // 模拟一笔亏损交易
      const trade = await prisma.client.trade_history.create({
        data: {
          user_id: testUser.id,
          instance_id: instanceId,
          symbol: 'ETH/USDT',
          side: 'short',
          entry_price: '3000.00000000',
          exit_price: '3100.00000000',
          amount: '1.00000000',
          pnl: '-100.00000000', // 亏损 100 USDT
          gas_fee: '0.00000000',
          status: 'closed',
          closed_at: new Date(),
        },
      });

      // 调用燃油费计算接口
      const response = await request(app.getHttpServer())
        .post('/api/billing/calculate-gas-fee')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ tradeId: trade.id })
        .expect(200);

      // 亏损交易不抽成
      expect(response.body.data.processed).toBe(0);
      expect(response.body.data.charged).toBe(0);
    });

    it('燃油费抽成 - 幂等性检查', async () => {
      // 重复调用抽成接口
      const response = await request(app.getHttpServer())
        .post('/api/billing/calculate-gas-fee')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ tradeId })
        .expect(200);

      // 应该跳过（已处理）
      expect(response.body.data.skipped).toBe(1);
      expect(response.body.data.charged).toBe(0);
    });
  });

  describe('查询接口', () => {
    it('获取今日盈亏 - 成功', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/billing/today-pnl')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.code).toBe(0);
      expect(response.body.data).toHaveProperty('todayPnl');
      expect(response.body.data).toHaveProperty('todayProfit');
      expect(response.body.data).toHaveProperty('todayLoss');
      expect(response.body.data).toHaveProperty('todayTrades');
      expect(response.body.data).toHaveProperty('todayWinRate');
      expect(response.body.data).toHaveProperty('todayGasFee');

      // 验证数据类型
      expect(typeof response.body.data.todayPnl).toBe('string');
      expect(typeof response.body.data.todayTrades).toBe('number');
    });

    it('获取计费日志 - 全部', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/billing/logs')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.code).toBe(0);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);

      // 验证日志结构
      const log = response.body.data[0];
      expect(log).toHaveProperty('id');
      expect(log).toHaveProperty('userId');
      expect(log).toHaveProperty('uniqueOrderId');
      expect(log).toHaveProperty('billingType');
      expect(log).toHaveProperty('amount');
      expect(log).toHaveProperty('status');
      expect(log).toHaveProperty('createdAt');
    });

    it('获取计费日志 - 按类型筛选', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/billing/logs?billingType=gas_fee')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.code).toBe(0);
      expect(Array.isArray(response.body.data)).toBe(true);

      // 验证所有日志都是 gas_fee 类型
      response.body.data.forEach((log: any) => {
        expect(log.billingType).toBe('gas_fee');
      });
    });

    it('获取收益曲线 - 30 天', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/billing/pnl-curve?days=30')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.code).toBe(0);
      expect(response.body.data).toHaveProperty('curve');
      expect(response.body.data).toHaveProperty('totalPnl');
      expect(response.body.data).toHaveProperty('maxDrawdown');
      expect(response.body.data).toHaveProperty('startDate');
      expect(response.body.data).toHaveProperty('endDate');

      expect(Array.isArray(response.body.data.curve)).toBe(true);
    });
  });

  describe('欠费处理', () => {
    it('余额不足时燃油费记为欠费', async () => {
      // 模拟盈利交易
      const trade = await prisma.client.trade_history.create({
        data: {
          user_id: testUser.id,
          instance_id: instanceId,
          symbol: 'BTC/USDT',
          side: 'long',
          entry_price: '50000.00000000',
          exit_price: '55000.00000000',
          amount: '0.10000000',
          pnl: '500.00000000', // 盈利 500 USDT
          gas_fee: '0.00000000',
          status: 'closed',
          closed_at: new Date(),
        },
      });

      // 扣除余额，使其不足以支付燃油费
      await prisma.client.wallets.update({
        where: { user_id: testUser.id },
        data: { usdt_balance: '50.00000000' }, // 少于燃油费 100 USDT
      });

      // 调用燃油费计算
      const response = await request(app.getHttpServer())
        .post('/api/billing/calculate-gas-fee')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ tradeId: trade.id })
        .expect(200);

      expect(response.body.data.charged).toBe(1);

      // 验证计费日志状态为 pending（欠费）
      const billingLog = await prisma.client.billing_logs.findFirst({
        where: {
          user_id: testUser.id,
          billing_type: 'gas_fee',
          reference_id: trade.id,
        },
      });
      expect(billingLog!.status).toBe('pending');

      // 验证余额未扣除（因为不足）
      const wallet = await prisma.client.wallets.findUnique({
        where: { user_id: testUser.id },
      });
      expect(wallet!.usdt_balance).toBe('50.00000000');
    });
  });

  describe('按实例分组盈亏', () => {
    it('获取按实例分组的盈亏统计', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/billing/pnl-by-instance')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.code).toBe(0);
      expect(Array.isArray(response.body.data)).toBe(true);

      if (response.body.data.length > 0) {
        const instancePnl = response.body.data[0];
        expect(instancePnl).toHaveProperty('instanceId');
        expect(instancePnl).toHaveProperty('instanceIp');
        expect(instancePnl).toHaveProperty('totalPnl');
        expect(instancePnl).toHaveProperty('totalGasFee');
        expect(instancePnl).toHaveProperty('netPnl');
        expect(instancePnl).toHaveProperty('trades');
      }
    });
  });
});
