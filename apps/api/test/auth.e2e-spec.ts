import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('AuthController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const testUser = {
    email: `test-${Date.now()}@example.com`,
    password: 'Test123456!',
  };
  let accessToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    // 清理测试数据
    await prisma.user.deleteMany({
      where: { email: testUser.email },
    });
    await app.close();
  });

  describe('注册流程', () => {
    // 正常路径
    it('POST /auth/register - 正常注册', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(testUser)
        .expect(201);

      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe(testUser.email);
      expect(response.body.accessToken).toBeDefined();
    });

    // 异常路径
    it('POST /auth/register - 重复邮箱', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send(testUser)
        .expect(409);
    });

    // 边界路径
    it('POST /auth/register - 无效邮箱格式', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'invalid-email', password: 'Test123456!' })
        .expect(400);
    });

    it('POST /auth/register - 密码过短', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'short@example.com', password: '123' })
        .expect(400);
    });
  });

  describe('登录流程', () => {
    // 正常路径
    it('POST /auth/login - 正常登录', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send(testUser)
        .expect(200);

      expect(response.body.accessToken).toBeDefined();
      accessToken = response.body.accessToken;
    });

    // 异常路径
    it('POST /auth/login - 错误密码', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: testUser.email, password: 'wrongpassword' })
        .expect(401);
    });

    it('POST /auth/login - 用户不存在', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'nonexistent@example.com', password: 'Test123456!' })
        .expect(401);
    });

    // 边界路径
    it('POST /auth/login - 空邮箱', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: '', password: 'Test123456!' })
        .expect(400);
    });
  });

  describe('认证保护', () => {
    // 正常路径
    it('GET /auth/me - 使用有效 Token', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.email).toBe(testUser.email);
    });

    // 异常路径
    it('GET /auth/me - 无 Token', async () => {
      await request(app.getHttpServer())
        .get('/auth/me')
        .expect(401);
    });

    it('GET /auth/me - 无效 Token', async () => {
      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });
});
