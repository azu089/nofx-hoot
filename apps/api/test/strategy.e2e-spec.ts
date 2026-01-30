import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('StrategyController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const testUser = {
    email: `strategy-test-${Date.now()}@example.com`,
    password: 'Test123456!',
  };
  let accessToken: string;
  let userId: string;
  let strategyId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);

    // 注册测试用户
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send(testUser);

    accessToken = response.body.accessToken;
    userId = response.body.user.id;

    // 创建测试策略
    const strategy = await prisma.strategy.create({
      data: {
        name: 'Test Strategy',
        description: 'A test strategy for e2e testing',
        author: userId,
        type: 'grid',
        riskLevel: 'medium',
        minInvestment: '100',
        expectedReturn: '10',
        status: 'active',
        isPublic: true,
        config: {},
      },
    });
    strategyId = strategy.id;
  });

  afterAll(async () => {
    // 清理测试数据
    await prisma.strategySubscription.deleteMany({
      where: { userId },
    });
    await prisma.strategy.deleteMany({
      where: { id: strategyId },
    });
    await prisma.user.deleteMany({
      where: { email: testUser.email },
    });
    await app.close();
  });

  describe('策略市场', () => {
    // 正常路径
    it('GET /strategies - 获取策略列表', async () => {
      const response = await request(app.getHttpServer())
        .get('/strategies')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    // 正常路径 - 策略详情
    it('GET /strategies/:id - 获取策略详情', async () => {
      const response = await request(app.getHttpServer())
        .get(`/strategies/${strategyId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.id).toBe(strategyId);
      expect(response.body.name).toBe('Test Strategy');
    });

    // 异常路径 - 策略不存在
    it('GET /strategies/:id - 策略不存在', async () => {
      await request(app.getHttpServer())
        .get('/strategies/nonexistent-id')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });
  });

  describe('策略订阅', () => {
    // 正常路径
    it('POST /strategies/:id/subscribe - 订阅策略', async () => {
      const response = await request(app.getHttpServer())
        .post(`/strategies/${strategyId}/subscribe`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          investmentAmount: '100',
        })
        .expect(201);

      expect(response.body.strategyId).toBe(strategyId);
      expect(response.body.status).toBe('active');
    });

    // 异常路径 - 重复订阅
    it('POST /strategies/:id/subscribe - 重复订阅', async () => {
      await request(app.getHttpServer())
        .post(`/strategies/${strategyId}/subscribe`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          investmentAmount: '100',
        })
        .expect(409);
    });

    // 正常路径 - 查询我的订阅
    it('GET /strategies/my - 获取我的策略订阅', async () => {
      const response = await request(app.getHttpServer())
        .get('/strategies/my')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });

    // 正常路径 - 取消订阅
    it('DELETE /strategies/:id/subscribe - 取消订阅', async () => {
      await request(app.getHttpServer())
        .delete(`/strategies/${strategyId}/subscribe`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
    });
  });

  describe('策略创建', () => {
    // 边界路径 - 无效风险等级
    it('POST /strategies - 无效风险等级', async () => {
      await request(app.getHttpServer())
        .post('/strategies')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Invalid Strategy',
          description: 'Test',
          type: 'grid',
          riskLevel: 'invalid',
          minInvestment: '100',
        })
        .expect(400);
    });

    // 边界路径 - 缺少必填字段
    it('POST /strategies - 缺少必填字段', async () => {
      await request(app.getHttpServer())
        .post('/strategies')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Incomplete Strategy',
        })
        .expect(400);
    });
  });
});
