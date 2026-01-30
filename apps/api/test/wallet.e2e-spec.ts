import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('WalletController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const testUser = {
    email: `wallet-test-${Date.now()}@example.com`,
    password: 'Test123456!',
  };
  let accessToken: string;
  let userId: string;

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
  });

  afterAll(async () => {
    // 清理测试数据
    await prisma.user.deleteMany({
      where: { email: testUser.email },
    });
    await app.close();
  });

  describe('查询余额', () => {
    // 正常路径
    it('GET /wallet/balance - 查询余额', async () => {
      const response = await request(app.getHttpServer())
        .get('/wallet/balance')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.usdt).toBeDefined();
      expect(response.body.hoot).toBeDefined();
    });

    // 异常路径
    it('GET /wallet/balance - 未认证', async () => {
      await request(app.getHttpServer())
        .get('/wallet/balance')
        .expect(401);
    });
  });

  describe('充值地址', () => {
    // 正常路径
    it('GET /wallet/deposit/address - 获取充值地址', async () => {
      const response = await request(app.getHttpServer())
        .get('/wallet/deposit/address')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.address).toBeDefined();
      expect(response.body.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
    });

    // 正常路径 - 多次获取应返回相同地址
    it('GET /wallet/deposit/address - 多次获取返回相同地址', async () => {
      const response1 = await request(app.getHttpServer())
        .get('/wallet/deposit/address')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const response2 = await request(app.getHttpServer())
        .get('/wallet/deposit/address')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response1.body.address).toBe(response2.body.address);
    });
  });

  describe('交易记录', () => {
    // 正常路径
    it('GET /wallet/transactions - 查询交易记录', async () => {
      const response = await request(app.getHttpServer())
        .get('/wallet/transactions')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    // 边界路径 - 分页
    it('GET /wallet/transactions - 分页查询', async () => {
      const response = await request(app.getHttpServer())
        .get('/wallet/transactions?page=1&limit=10')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('提现申请', () => {
    // 异常路径 - 余额不足
    it('POST /wallet/withdraw - 余额不足', async () => {
      await request(app.getHttpServer())
        .post('/wallet/withdraw')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          asset: 'USDT',
          amount: '1000000',
          address: '0x1234567890123456789012345678901234567890',
        })
        .expect(400);
    });

    // 边界路径 - 无效地址格式
    it('POST /wallet/withdraw - 无效地址格式', async () => {
      await request(app.getHttpServer())
        .post('/wallet/withdraw')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          asset: 'USDT',
          amount: '10',
          address: 'invalid-address',
        })
        .expect(400);
    });

    // 边界路径 - 金额为0
    it('POST /wallet/withdraw - 金额为0', async () => {
      await request(app.getHttpServer())
        .post('/wallet/withdraw')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          asset: 'USDT',
          amount: '0',
          address: '0x1234567890123456789012345678901234567890',
        })
        .expect(400);
    });
  });
});
