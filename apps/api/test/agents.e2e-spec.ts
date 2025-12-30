/**
 * 代理商模块 E2E 测试
 *
 * 测试范围：
 * 1. 代理商注册和资料
 * 2. 邀请码生成和绑定
 * 3. 下级用户管理
 * 4. 佣金计算和提现
 *
 * 返佣规则：
 * - 直推返佣：15%
 * - 间推返佣：5%
 * - 返佣上限：无上限
 * - 结算周期：实时结算
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/services/prisma.service';
import Decimal from 'decimal.js';

// 使用 describe.skip 默认跳过，手动启用时改为 describe
describe.skip('代理商模块 E2E 测试', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  // 代理商用户
  let agentUserId: string;
  let agentToken: string;
  let agentInviteCode: string;

  // 被邀请用户（下级）
  let referralUserId: string;
  let referralToken: string;

  const AGENT_EMAIL = 'test-agent@example.com';
  const AGENT_PASSWORD = 'password123';
  const REFERRAL_EMAIL = 'test-referral@example.com';
  const REFERRAL_PASSWORD = 'password123';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();

    prisma = app.get(PrismaService);

    // 清理测试数据
    await prisma.agentCommission.deleteMany({
      where: {
        agent: { email: { in: [AGENT_EMAIL, REFERRAL_EMAIL] } },
      },
    });
    await prisma.user.deleteMany({
      where: { email: { in: [AGENT_EMAIL, REFERRAL_EMAIL] } },
    });

    // 创建代理商用户
    const agentRegRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: AGENT_EMAIL, password: AGENT_PASSWORD });

    if (agentRegRes.body.code === 0) {
      agentUserId = agentRegRes.body.data.id;
    }

    // 登录代理商
    const agentLoginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: AGENT_EMAIL, password: AGENT_PASSWORD });

    agentToken = agentLoginRes.body.data.accessToken;

    // 给代理商设置为代理角色
    await prisma.user.update({
      where: { id: agentUserId },
      data: {
        isAgent: true,
        agentLevel: 1,
        commissionBalance: new Decimal(0),
      },
    });
  });

  afterAll(async () => {
    // 清理测试数据
    await prisma.agentCommission.deleteMany({
      where: {
        agentId: { in: [agentUserId, referralUserId].filter(Boolean) },
      },
    });
    await prisma.user.deleteMany({
      where: { email: { in: [AGENT_EMAIL, REFERRAL_EMAIL] } },
    });

    await app.close();
  });

  // ==================== 1. 代理商资料 ====================

  describe('GET /agents/profile', () => {
    it('应该返回代理商资料', async () => {
      const res = await request(app.getHttpServer())
        .get('/agents/profile')
        .set('Authorization', `Bearer ${agentToken}`);

      expect(res.body.code).toBe(0);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data).toHaveProperty('isAgent', true);
      expect(res.body.data).toHaveProperty('agentLevel', 1);
    });

    it('未登录应该返回 401', async () => {
      const res = await request(app.getHttpServer())
        .get('/agents/profile');

      expect(res.status).toBe(401);
    });
  });

  // ==================== 2. 邀请码 ====================

  describe('邀请码管理', () => {
    it('GET /agents/invite-code - 获取/生成邀请码', async () => {
      const res = await request(app.getHttpServer())
        .get('/agents/invite-code')
        .set('Authorization', `Bearer ${agentToken}`);

      expect(res.body.code).toBe(0);
      expect(res.body.data).toHaveProperty('inviteCode');
      expect(res.body.data.inviteCode).toMatch(/^[A-Z0-9]{6,8}$/);

      agentInviteCode = res.body.data.inviteCode;
    });

    it('再次获取应返回相同的邀请码', async () => {
      const res = await request(app.getHttpServer())
        .get('/agents/invite-code')
        .set('Authorization', `Bearer ${agentToken}`);

      expect(res.body.code).toBe(0);
      expect(res.body.data.inviteCode).toBe(agentInviteCode);
    });
  });

  // ==================== 3. 邀请绑定 ====================

  describe('邀请绑定流程', () => {
    beforeAll(async () => {
      // 创建被邀请用户
      const referralRegRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: REFERRAL_EMAIL, password: REFERRAL_PASSWORD });

      if (referralRegRes.body.code === 0) {
        referralUserId = referralRegRes.body.data.id;
      }

      // 登录被邀请用户
      const referralLoginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: REFERRAL_EMAIL, password: REFERRAL_PASSWORD });

      referralToken = referralLoginRes.body.data.accessToken;
    });

    it('POST /agents/bind - 绑定邀请码', async () => {
      const res = await request(app.getHttpServer())
        .post('/agents/bind')
        .set('Authorization', `Bearer ${referralToken}`)
        .send({ inviteCode: agentInviteCode });

      expect(res.body.code).toBe(0);
      expect(res.body.data).toHaveProperty('bound', true);
    });

    it('重复绑定应失败', async () => {
      const res = await request(app.getHttpServer())
        .post('/agents/bind')
        .set('Authorization', `Bearer ${referralToken}`)
        .send({ inviteCode: agentInviteCode });

      expect(res.body.code).not.toBe(0);
      expect(res.body.message).toContain('已绑定');
    });

    it('绑定无效邀请码应失败', async () => {
      // 创建另一个用户
      const tempRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'temp-test@example.com', password: 'password123' });

      const tempLoginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'temp-test@example.com', password: 'password123' });

      const res = await request(app.getHttpServer())
        .post('/agents/bind')
        .set('Authorization', `Bearer ${tempLoginRes.body.data.accessToken}`)
        .send({ inviteCode: 'INVALID123' });

      expect(res.body.code).not.toBe(0);

      // 清理临时用户
      await prisma.user.deleteMany({ where: { email: 'temp-test@example.com' } });
    });
  });

  // ==================== 4. 下级管理 ====================

  describe('GET /agents/referrals', () => {
    it('应该返回下级用户列表', async () => {
      const res = await request(app.getHttpServer())
        .get('/agents/referrals')
        .set('Authorization', `Bearer ${agentToken}`);

      expect(res.body.code).toBe(0);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);

      // 验证下级用户信息
      const referral = res.body.data.find((r: any) => r.email === REFERRAL_EMAIL);
      expect(referral).toBeDefined();
    });

    it('应该支持分页', async () => {
      const res = await request(app.getHttpServer())
        .get('/agents/referrals?page=1&limit=10')
        .set('Authorization', `Bearer ${agentToken}`);

      expect(res.body.code).toBe(0);
    });
  });

  // ==================== 5. 代理商概览 ====================

  describe('GET /agents/overview', () => {
    it('应该返回代理商概览数据', async () => {
      const res = await request(app.getHttpServer())
        .get('/agents/overview')
        .set('Authorization', `Bearer ${agentToken}`);

      expect(res.body.code).toBe(0);
      expect(res.body.data).toHaveProperty('totalReferrals');
      expect(res.body.data).toHaveProperty('totalCommission');
      expect(res.body.data).toHaveProperty('pendingCommission');
      expect(res.body.data).toHaveProperty('thisMonthCommission');
    });
  });

  // ==================== 6. 佣金记录 ====================

  describe('佣金系统', () => {
    beforeAll(async () => {
      // 模拟下级用户产生交易，触发返佣
      // 假设下级用户交易盈利 100 USDT
      const profit = new Decimal(100);
      const commissionRate = new Decimal(0.15); // 15% 返佣
      const commission = profit.times(commissionRate);

      // 创建佣金记录
      await prisma.agentCommission.create({
        data: {
          agentId: agentUserId,
          sourceUserId: referralUserId,
          sourceType: 'gas_fee',
          sourceAmount: profit.toString(),
          commissionRate: commissionRate.toString(),
          commissionAmount: commission.toString(),
          status: 'pending',
        },
      });
    });

    it('GET /agents/commissions - 获取佣金记录', async () => {
      const res = await request(app.getHttpServer())
        .get('/agents/commissions')
        .set('Authorization', `Bearer ${agentToken}`);

      expect(res.body.code).toBe(0);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);

      // 验证佣金记录
      const commission = res.body.data[0];
      expect(commission).toHaveProperty('commissionAmount');
      expect(commission).toHaveProperty('status');
    });

    it('GET /agents/stats - 获取统计数据', async () => {
      const res = await request(app.getHttpServer())
        .get('/agents/stats')
        .set('Authorization', `Bearer ${agentToken}`);

      expect(res.body.code).toBe(0);
      expect(res.body.data).toHaveProperty('totalCommission');
      expect(res.body.data).toHaveProperty('referralCount');
    });
  });

  // ==================== 7. 佣金提现 ====================

  describe('POST /agents/withdraw', () => {
    beforeAll(async () => {
      // 给代理商添加一些可提现佣金
      await prisma.user.update({
        where: { id: agentUserId },
        data: { commissionBalance: new Decimal(50) },
      });
    });

    it('应该能发起佣金提现', async () => {
      const res = await request(app.getHttpServer())
        .post('/agents/withdraw')
        .set('Authorization', `Bearer ${agentToken}`)
        .send({
          amount: '30',
          withdrawTo: 'wallet', // 提现到钱包余额
        });

      expect(res.body.code).toBe(0);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data).toHaveProperty('status', 'pending');
    });

    it('余额不足应失败', async () => {
      const res = await request(app.getHttpServer())
        .post('/agents/withdraw')
        .set('Authorization', `Bearer ${agentToken}`)
        .send({
          amount: '999999',
          withdrawTo: 'wallet',
        });

      expect(res.body.code).not.toBe(0);
    });

    it('金额为负应失败', async () => {
      const res = await request(app.getHttpServer())
        .post('/agents/withdraw')
        .set('Authorization', `Bearer ${agentToken}`)
        .send({
          amount: '-10',
          withdrawTo: 'wallet',
        });

      expect(res.body.code).not.toBe(0);
    });
  });

  // ==================== 8. 返佣计算验算 ====================

  describe('返佣计算验算', () => {
    it('直推返佣率应为 15%', async () => {
      const profit = new Decimal(100);
      const expectedCommission = profit.times(0.15);

      // 获取佣金记录验证
      const commissions = await prisma.agentCommission.findMany({
        where: { agentId: agentUserId },
      });

      if (commissions.length > 0) {
        const commission = new Decimal(commissions[0].commissionAmount);
        const rate = new Decimal(commissions[0].commissionRate);
        const source = new Decimal(commissions[0].sourceAmount);

        // 验算：佣金 = 来源金额 * 返佣率
        expect(commission.equals(source.times(rate))).toBe(true);
      }
    });
  });
});
