/**
 * GameFi 模块 E2E 测试
 *
 * 测试范围：
 * 1. 积分系统 - 获取余额、历史记录
 * 2. 质押系统 - 创建质押、解除质押、领取收益
 * 3. 代币系统 - 兑换代币、查看释放进度
 * 4. 排行榜 - 获取排名
 *
 * 验算公式：
 * - 积分获取：profit * vip_multiplier
 * - 质押权重：A类=1.0x，B类=1.0+(锁定天数/180)，最高3.0x
 * - 代币兑换标准：20%立即+80%线性90天
 * - 代币兑换急速：50%立即+50%销毁
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/services/prisma.service';
import Decimal from 'decimal.js';

// 使用 describe.skip 默认跳过，手动启用时改为 describe
describe.skip('GameFi E2E 测试', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let testUserId: string;
  let testUserToken: string;

  const TEST_EMAIL = 'test-gamefi@example.com';
  const TEST_PASSWORD = 'password123';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();

    prisma = app.get(PrismaService);

    // 清理测试数据
    await prisma.pointLog.deleteMany({ where: { user: { email: TEST_EMAIL } } });
    await prisma.stake.deleteMany({ where: { user: { email: TEST_EMAIL } } });
    await prisma.tokenRelease.deleteMany({ where: { user: { email: TEST_EMAIL } } });
    await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });

    // 创建测试用户
    const registerRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD });

    if (registerRes.body.code === 0) {
      testUserId = registerRes.body.data.id;
    }

    // 登录获取 Token
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD });

    testUserToken = loginRes.body.data.accessToken;

    // 给测试用户一些初始积分和代币
    await prisma.user.update({
      where: { id: testUserId },
      data: {
        pointBalance: new Decimal(1000),
        tokenBalance: new Decimal(500),
        balance: new Decimal(100),
      },
    });
  });

  afterAll(async () => {
    // 清理测试数据
    await prisma.pointLog.deleteMany({ where: { userId: testUserId } });
    await prisma.stake.deleteMany({ where: { userId: testUserId } });
    await prisma.tokenRelease.deleteMany({ where: { userId: testUserId } });
    await prisma.user.deleteMany({ where: { id: testUserId } });

    await app.close();
  });

  // ==================== 1. GameFi 概览 ====================

  describe('GET /gamefi/overview', () => {
    it('应该返回 GameFi 概览数据', async () => {
      const res = await request(app.getHttpServer())
        .get('/gamefi/overview')
        .set('Authorization', `Bearer ${testUserToken}`);

      expect(res.body.code).toBe(0);
      expect(res.body.data).toHaveProperty('points');
      expect(res.body.data).toHaveProperty('stakes');
      expect(res.body.data).toHaveProperty('tokens');
      expect(res.body.data).toHaveProperty('rewards');
    });

    it('未登录应该返回 401', async () => {
      const res = await request(app.getHttpServer())
        .get('/gamefi/overview');

      expect(res.status).toBe(401);
    });
  });

  // ==================== 2. 积分系统 ====================

  describe('GET /gamefi/points', () => {
    it('应该返回积分余额', async () => {
      const res = await request(app.getHttpServer())
        .get('/gamefi/points')
        .set('Authorization', `Bearer ${testUserToken}`);

      expect(res.body.code).toBe(0);
      expect(res.body.data).toHaveProperty('balance');
      expect(new Decimal(res.body.data.balance).equals(1000)).toBe(true);
    });
  });

  describe('GET /gamefi/points/history', () => {
    it('应该返回积分历史记录', async () => {
      const res = await request(app.getHttpServer())
        .get('/gamefi/points/history')
        .set('Authorization', `Bearer ${testUserToken}`);

      expect(res.body.code).toBe(0);
      expect(res.body.data).toHaveProperty('history');
      expect(Array.isArray(res.body.data.history)).toBe(true);
    });

    it('应该支持分页参数', async () => {
      const res = await request(app.getHttpServer())
        .get('/gamefi/points/history?limit=10')
        .set('Authorization', `Bearer ${testUserToken}`);

      expect(res.body.code).toBe(0);
    });
  });

  // ==================== 3. 质押系统 ====================

  describe('质押全流程', () => {
    let stakeId: string;

    it('POST /gamefi/stake - 创建 A 类质押', async () => {
      const res = await request(app.getHttpServer())
        .post('/gamefi/stake')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({
          stake_type: 'A',
          amount: '100',
        });

      expect(res.body.code).toBe(0);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.stake_type).toBe('A');
      expect(res.body.data.weight).toBe('1.0'); // A 类权重固定 1.0x
      stakeId = res.body.data.id;
    });

    it('GET /gamefi/stakes - 获取质押列表', async () => {
      const res = await request(app.getHttpServer())
        .get('/gamefi/stakes')
        .set('Authorization', `Bearer ${testUserToken}`);

      expect(res.body.code).toBe(0);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('GET /gamefi/stakes/stats - 获取质押统计', async () => {
      const res = await request(app.getHttpServer())
        .get('/gamefi/stakes/stats')
        .set('Authorization', `Bearer ${testUserToken}`);

      expect(res.body.code).toBe(0);
      expect(res.body.data).toHaveProperty('totalStaked');
      expect(res.body.data).toHaveProperty('totalWeight');
      expect(res.body.data).toHaveProperty('pendingRewards');
    });

    it('POST /gamefi/unstake/:id - 解除质押', async () => {
      const res = await request(app.getHttpServer())
        .post(`/gamefi/unstake/${stakeId}`)
        .set('Authorization', `Bearer ${testUserToken}`);

      expect(res.body.code).toBe(0);
      expect(res.body.data.status).toBe('unstaked');
    });

    it('POST /gamefi/stake - 余额不足应失败', async () => {
      const res = await request(app.getHttpServer())
        .post('/gamefi/stake')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({
          stake_type: 'A',
          amount: '999999', // 超过余额
        });

      expect(res.body.code).not.toBe(0);
    });
  });

  describe('B 类质押权重计算', () => {
    it('B 类质押锁定 90 天，权重应为 1.5x', async () => {
      const res = await request(app.getHttpServer())
        .post('/gamefi/stake')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({
          stake_type: 'B',
          amount: '50',
          lock_days: 90,
        });

      expect(res.body.code).toBe(0);
      // 权重 = 1.0 + (90/180) = 1.5
      expect(parseFloat(res.body.data.weight)).toBeCloseTo(1.5, 1);
    });

    it('B 类质押锁定 180 天，权重应为 2.0x', async () => {
      const res = await request(app.getHttpServer())
        .post('/gamefi/stake')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({
          stake_type: 'B',
          amount: '50',
          lock_days: 180,
        });

      expect(res.body.code).toBe(0);
      // 权重 = 1.0 + (180/180) = 2.0
      expect(parseFloat(res.body.data.weight)).toBeCloseTo(2.0, 1);
    });

    it('B 类质押权重最高 3.0x', async () => {
      const res = await request(app.getHttpServer())
        .post('/gamefi/stake')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({
          stake_type: 'B',
          amount: '50',
          lock_days: 720, // 超过上限
        });

      expect(res.body.code).toBe(0);
      // 权重上限 3.0x
      expect(parseFloat(res.body.data.weight)).toBeLessThanOrEqual(3.0);
    });
  });

  // ==================== 4. 代币系统 ====================

  describe('代币兑换', () => {
    it('GET /gamefi/tokens/balance - 获取代币余额', async () => {
      const res = await request(app.getHttpServer())
        .get('/gamefi/tokens/balance')
        .set('Authorization', `Bearer ${testUserToken}`);

      expect(res.body.code).toBe(0);
      expect(res.body.data).toHaveProperty('balance');
    });

    it('POST /gamefi/tokens/exchange - 标准模式兑换', async () => {
      // 先恢复一些积分
      await prisma.user.update({
        where: { id: testUserId },
        data: { pointBalance: new Decimal(500) },
      });

      const res = await request(app.getHttpServer())
        .post('/gamefi/tokens/exchange')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({
          points: 100,
          mode: 'standard',
        });

      expect(res.body.code).toBe(0);
      expect(res.body.data).toHaveProperty('immediate');
      expect(res.body.data).toHaveProperty('vesting');

      // 标准模式：20% 立即释放
      expect(parseFloat(res.body.data.immediate)).toBeCloseTo(20, 0);
      // 80% 进入释放计划
      expect(parseFloat(res.body.data.vesting)).toBeCloseTo(80, 0);
    });

    it('POST /gamefi/tokens/exchange - 急速模式兑换', async () => {
      const res = await request(app.getHttpServer())
        .post('/gamefi/tokens/exchange')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({
          points: 100,
          mode: 'fast',
        });

      expect(res.body.code).toBe(0);
      expect(res.body.data).toHaveProperty('immediate');
      expect(res.body.data).toHaveProperty('burned');

      // 急速模式：50% 立即释放
      expect(parseFloat(res.body.data.immediate)).toBeCloseTo(50, 0);
      // 50% 销毁
      expect(parseFloat(res.body.data.burned)).toBeCloseTo(50, 0);
    });

    it('POST /gamefi/tokens/exchange - 积分不足应失败', async () => {
      const res = await request(app.getHttpServer())
        .post('/gamefi/tokens/exchange')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({
          points: 999999, // 超过余额
          mode: 'standard',
        });

      expect(res.body.code).not.toBe(0);
    });

    it('GET /gamefi/tokens/vesting - 获取释放进度', async () => {
      const res = await request(app.getHttpServer())
        .get('/gamefi/tokens/vesting')
        .set('Authorization', `Bearer ${testUserToken}`);

      expect(res.body.code).toBe(0);
      expect(res.body.data).toHaveProperty('orders');
      expect(res.body.data).toHaveProperty('totalPending');
      expect(res.body.data).toHaveProperty('totalReleased');
    });

    it('GET /gamefi/tokens/orders - 获取兑换订单', async () => {
      const res = await request(app.getHttpServer())
        .get('/gamefi/tokens/orders')
        .set('Authorization', `Bearer ${testUserToken}`);

      expect(res.body.code).toBe(0);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  // ==================== 5. 排行榜 ====================

  describe('GET /gamefi/leaderboard', () => {
    it('应该返回排行榜数据', async () => {
      const res = await request(app.getHttpServer())
        .get('/gamefi/leaderboard')
        .set('Authorization', `Bearer ${testUserToken}`);

      expect(res.body.code).toBe(0);
      expect(res.body.data).toHaveProperty('leaderboard');
      expect(res.body.data).toHaveProperty('myRank');
      expect(Array.isArray(res.body.data.leaderboard)).toBe(true);
    });

    it('应该支持时间范围筛选', async () => {
      const res = await request(app.getHttpServer())
        .get('/gamefi/leaderboard?period=week')
        .set('Authorization', `Bearer ${testUserToken}`);

      expect(res.body.code).toBe(0);
    });

    it('应该支持分页', async () => {
      const res = await request(app.getHttpServer())
        .get('/gamefi/leaderboard?limit=10&offset=0')
        .set('Authorization', `Bearer ${testUserToken}`);

      expect(res.body.code).toBe(0);
      expect(res.body.data.leaderboard.length).toBeLessThanOrEqual(10);
    });
  });

  // ==================== 6. 领取收益 ====================

  describe('POST /gamefi/claim', () => {
    it('应该能领取质押收益', async () => {
      const res = await request(app.getHttpServer())
        .post('/gamefi/claim')
        .set('Authorization', `Bearer ${testUserToken}`);

      expect(res.body.code).toBe(0);
      expect(res.body.data).toHaveProperty('claimed');
    });

    it('无收益时应返回 0', async () => {
      // 第二次领取应该返回 0
      const res = await request(app.getHttpServer())
        .post('/gamefi/claim')
        .set('Authorization', `Bearer ${testUserToken}`);

      expect(res.body.code).toBe(0);
      expect(parseFloat(res.body.data.claimed)).toBe(0);
    });
  });
});
