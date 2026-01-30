import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('HealthController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('健康检查', () => {
    // 正常路径 - 完整健康检查
    it('GET /health - 完整健康检查', async () => {
      const response = await request(app.getHttpServer())
        .get('/health')
        .expect(200);

      expect(response.body.status).toBeDefined();
      expect(response.body.timestamp).toBeDefined();
    });

    // 正常路径 - 存活探针
    it('GET /health/liveness - 存活探针', async () => {
      const response = await request(app.getHttpServer())
        .get('/health/liveness')
        .expect(200);

      expect(response.body.status).toBe('ok');
    });

    // 正常路径 - 就绪探针
    it('GET /health/readiness - 就绪探针', async () => {
      const response = await request(app.getHttpServer())
        .get('/health/readiness')
        .expect(200);

      expect(response.body.status).toBeDefined();
    });
  });

  describe('系统指标（需认证）', () => {
    // 异常路径 - 未认证访问
    it('GET /health/metrics - 未认证', async () => {
      await request(app.getHttpServer())
        .get('/health/metrics')
        .expect(401);
    });

    it('GET /health/stats - 未认证', async () => {
      await request(app.getHttpServer())
        .get('/health/stats')
        .expect(401);
    });
  });
});
