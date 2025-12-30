import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import Decimal from 'decimal.js';

/**
 * VPS 实例 E2E 测试
 *
 * 测试完整生命周期：创建 → 运行 → 销毁
 *
 * 注意：此测试需要真实数据库环境才能运行
 * - 需要配置测试数据库（PostgreSQL）
 * - 需要 S3 配置（可使用 LocalStack 模拟）
 * - 需要 DigitalOcean API Mock
 *
 * 运行方式：
 * 1. 配置 .env.test 文件
 * 2. 启动测试数据库：docker compose -f docker-compose.test.yml up -d
 * 3. 运行测试：pnpm test:e2e instances
 */
describe.skip('Instances (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authToken: string;
  let userId: string;
  let instanceId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);

    // 清理测试数据
    await prisma.instance.deleteMany({});
    await prisma.wallet.deleteMany({});
    await prisma.user.deleteMany({});

    // 创建测试用户
    const testUser = await prisma.user.create({
      data: {
        email: 'e2e-test@quantfi.com',
        passwordHash: '$2b$10$XYZ...', // bcrypt hash of 'password123'
        role: 'user',
        isActive: true,
      },
    });
    userId = testUser.id;

    // 创建测试钱包（余额充足）
    await prisma.wallet.create({
      data: {
        userId: testUser.id,
        balance: new Decimal(1000).toString(), // 1000 USDT
      },
    });

    // 登录获取 token
    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: 'e2e-test@quantfi.com',
        password: 'password123',
      })
      .expect(200);

    authToken = loginRes.body.data.accessToken;
  });

  afterAll(async () => {
    // 清理测试数据
    await prisma.instance.deleteMany({});
    await prisma.wallet.deleteMany({});
    await prisma.user.deleteMany({});

    await app.close();
  });

  describe('1. 创建实例 (POST /api/instances)', () => {
    it('正常路径：余额充足 → 实例创建成功 → 扣费 25 USDT', async () => {
      const createDto = {
        region: 'nyc1',
        planType: 'basic', // 25 USDT/月
      };

      const res = await request(app.getHttpServer())
        .post('/api/instances')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createDto)
        .expect(201);

      // 验证响应
      expect(res.body.code).toBe(0);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.status).toBe('pending');
      expect(res.body.data.region).toBe('nyc1');
      expect(res.body.data.monthlyFee).toBe('25.00000000');

      instanceId = res.body.data.id;

      // 验证扣费
      const wallet = await prisma.wallet.findUnique({ where: { userId } });
      const expectedBalance = new Decimal(1000).minus(25).toString();
      expect(wallet.balance).toBe(expectedBalance);
    });

    it('异常路径：余额不足 → 返回错误', async () => {
      // 先清空余额
      await prisma.wallet.update({
        where: { userId },
        data: { balance: '10.00000000' },
      });

      const createDto = {
        region: 'nyc1',
        planType: 'basic',
      };

      const res = await request(app.getHttpServer())
        .post('/api/instances')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createDto)
        .expect(400);

      expect(res.body.code).toBeGreaterThan(0);
      expect(res.body.message).toContain('余额不足');

      // 恢复余额
      await prisma.wallet.update({
        where: { userId },
        data: { balance: '1000.00000000' },
      });
    });

    it('边界路径：未登录 → 返回 401', async () => {
      const createDto = {
        region: 'nyc1',
        planType: 'basic',
      };

      await request(app.getHttpServer())
        .post('/api/instances')
        .send(createDto)
        .expect(401);
    });

    it('边界路径：无效的 region → 返回 400', async () => {
      const createDto = {
        region: 'invalid-region',
        planType: 'basic',
      };

      const res = await request(app.getHttpServer())
        .post('/api/instances')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createDto)
        .expect(400);

      expect(res.body.message).toContain('region');
    });
  });

  describe('2. 获取实例状态 (GET /api/instances/:id)', () => {
    it('正常路径：返回实例详情', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/instances/${instanceId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.code).toBe(0);
      expect(res.body.data.id).toBe(instanceId);
      expect(res.body.data).toHaveProperty('status');
      expect(res.body.data).toHaveProperty('region');
      expect(res.body.data).toHaveProperty('ipAddress');
      expect(res.body.data).toHaveProperty('monthlyFee');
      expect(res.body.data).toHaveProperty('lastHeartbeat');
    });

    it('异常路径：访问他人实例 → 返回 403', async () => {
      // 创建另一个用户
      const otherUser = await prisma.user.create({
        data: {
          email: 'other@quantfi.com',
          passwordHash: '$2b$10$XYZ...',
          role: 'user',
          isActive: true,
        },
      });

      const loginRes = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: 'other@quantfi.com',
          password: 'password123',
        });

      const otherToken = loginRes.body.data.accessToken;

      await request(app.getHttpServer())
        .get(`/api/instances/${instanceId}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(403);

      // 清理
      await prisma.user.delete({ where: { id: otherUser.id } });
    });

    it('边界路径：实例不存在 → 返回 404', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';

      await request(app.getHttpServer())
        .get(`/api/instances/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('3. 获取用户所有实例 (GET /api/instances)', () => {
    it('正常路径：返回实例列表', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/instances')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.code).toBe(0);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0]).toHaveProperty('id');
      expect(res.body.data[0]).toHaveProperty('status');
    });

    it('边界路径：分页查询', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/instances?page=1&limit=10')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.code).toBe(0);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('4. 实例心跳 (POST /api/instances/:id/heartbeat)', () => {
    it('正常路径：更新 last_heartbeat', async () => {
      const beforeHeartbeat = await prisma.instance.findUnique({
        where: { id: instanceId },
      });
      const beforeTime = beforeHeartbeat.lastHeartbeat;

      // 等待 1 秒确保时间不同
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const res = await request(app.getHttpServer())
        .post(`/api/instances/${instanceId}/heartbeat`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.code).toBe(0);

      const afterHeartbeat = await prisma.instance.findUnique({
        where: { id: instanceId },
      });
      const afterTime = afterHeartbeat.lastHeartbeat;

      expect(afterTime.getTime()).toBeGreaterThan(beforeTime.getTime());
    });

    it('异常路径：已销毁的实例 → 返回错误', async () => {
      // 创建一个已销毁的实例
      const destroyedInstance = await prisma.instance.create({
        data: {
          userId,
          region: 'nyc1',
          status: 'destroyed',
          monthlyFee: '25.00000000',
        },
      });

      const res = await request(app.getHttpServer())
        .post(`/api/instances/${destroyedInstance.id}/heartbeat`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(res.body.message).toContain('销毁');

      // 清理
      await prisma.instance.delete({ where: { id: destroyedInstance.id } });
    });
  });

  describe('5. 启动策略 (POST /api/instances/:id/start)', () => {
    it('正常路径：状态变为 running', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/instances/${instanceId}/start`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          strategyId: 'test-strategy-id',
        })
        .expect(200);

      expect(res.body.code).toBe(0);
      expect(res.body.data.status).toBe('running');

      // 验证数据库
      const instance = await prisma.instance.findUnique({
        where: { id: instanceId },
      });
      expect(instance.status).toBe('running');
      expect(instance.strategyId).toBe('test-strategy-id');
    });

    it('异常路径：实例未就绪 → 返回错误', async () => {
      // 创建一个 pending 状态的实例
      const pendingInstance = await prisma.instance.create({
        data: {
          userId,
          region: 'nyc1',
          status: 'pending',
          monthlyFee: '25.00000000',
        },
      });

      const res = await request(app.getHttpServer())
        .post(`/api/instances/${pendingInstance.id}/start`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          strategyId: 'test-strategy-id',
        })
        .expect(400);

      expect(res.body.message).toContain('未就绪');

      // 清理
      await prisma.instance.delete({ where: { id: pendingInstance.id } });
    });

    it('边界路径：缺少 strategyId → 返回 400', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/instances/${instanceId}/start`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);

      expect(res.body.message).toContain('strategyId');
    });
  });

  describe('6. 停止策略 (POST /api/instances/:id/stop)', () => {
    it('正常路径：状态变为 stopped', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/instances/${instanceId}/stop`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.code).toBe(0);
      expect(res.body.data.status).toBe('stopped');

      // 验证数据库
      const instance = await prisma.instance.findUnique({
        where: { id: instanceId },
      });
      expect(instance.status).toBe('stopped');
    });

    it('异常路径：实例未运行 → 返回错误', async () => {
      // 再次停止（已经是 stopped 状态）
      const res = await request(app.getHttpServer())
        .post(`/api/instances/${instanceId}/stop`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(res.body.message).toContain('未运行');
    });
  });

  describe('7. 销毁实例 (DELETE /api/instances/:id)', () => {
    it('正常路径：S3 备份 → 状态变为 destroyed', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/instances/${instanceId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.code).toBe(0);
      expect(res.body.data.status).toBe('destroyed');

      // 验证数据库
      const instance = await prisma.instance.findUnique({
        where: { id: instanceId },
      });
      expect(instance.status).toBe('destroyed');

      // 验证 S3 备份记录（假设有 backups 表）
      // const backup = await prisma.backup.findFirst({ where: { instanceId } });
      // expect(backup).toBeDefined();
    });

    it('异常路径：重复销毁 → 返回错误', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/instances/${instanceId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(res.body.message).toContain('已销毁');
    });
  });

  describe('8. 完整生命周期测试', () => {
    it('创建 → 启动 → 停止 → 销毁', async () => {
      // 1. 创建实例
      const createRes = await request(app.getHttpServer())
        .post('/api/instances')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          region: 'nyc1',
          planType: 'basic',
        })
        .expect(201);

      const testInstanceId = createRes.body.data.id;

      // 2. 模拟实例就绪（手动更新状态）
      await prisma.instance.update({
        where: { id: testInstanceId },
        data: { status: 'running', ipAddress: '1.2.3.4' },
      });

      // 3. 启动策略
      await request(app.getHttpServer())
        .post(`/api/instances/${testInstanceId}/start`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ strategyId: 'test-strategy' })
        .expect(200);

      // 4. 心跳
      await request(app.getHttpServer())
        .post(`/api/instances/${testInstanceId}/heartbeat`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // 5. 停止策略
      await request(app.getHttpServer())
        .post(`/api/instances/${testInstanceId}/stop`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // 6. 销毁实例
      await request(app.getHttpServer())
        .delete(`/api/instances/${testInstanceId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // 验证最终状态
      const finalInstance = await prisma.instance.findUnique({
        where: { id: testInstanceId },
      });
      expect(finalInstance.status).toBe('destroyed');
    });
  });

  describe('9. 并发安全测试', () => {
    it('多个心跳请求不会冲突', async () => {
      // 创建一个测试实例
      const instance = await prisma.instance.create({
        data: {
          userId,
          region: 'nyc1',
          status: 'running',
          monthlyFee: '25.00000000',
        },
      });

      // 并发发送 10 个心跳请求
      const promises = Array(10)
        .fill(null)
        .map(() =>
          request(app.getHttpServer())
            .post(`/api/instances/${instance.id}/heartbeat`)
            .set('Authorization', `Bearer ${authToken}`),
        );

      const results = await Promise.all(promises);

      // 所有请求都应该成功
      results.forEach((res) => {
        expect(res.status).toBe(200);
        expect(res.body.code).toBe(0);
      });

      // 清理
      await prisma.instance.delete({ where: { id: instance.id } });
    });

    it('余额不足时不允许创建多个实例', async () => {
      // 设置余额为 30 USDT（只够创建 1 个实例）
      await prisma.wallet.update({
        where: { userId },
        data: { balance: '30.00000000' },
      });

      // 并发创建 2 个实例
      const promises = Array(2)
        .fill(null)
        .map(() =>
          request(app.getHttpServer())
            .post('/api/instances')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              region: 'nyc1',
              planType: 'basic',
            }),
        );

      const results = await Promise.all(promises);

      // 只有一个成功，另一个失败
      const successCount = results.filter((r) => r.status === 201).length;
      const failCount = results.filter((r) => r.status === 400).length;

      expect(successCount).toBe(1);
      expect(failCount).toBe(1);

      // 清理并恢复余额
      const createdInstances = await prisma.instance.findMany({
        where: { userId, status: 'pending' },
      });
      await prisma.instance.deleteMany({
        where: {
          id: { in: createdInstances.map((i) => i.id) },
        },
      });
      await prisma.wallet.update({
        where: { userId },
        data: { balance: '1000.00000000' },
      });
    });
  });
});
