import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  // 安全中间件 - 设置安全的 HTTP 头（XSS 防护、Content-Type 防护等）
  app.use(helmet());

  // 全局前缀
  app.setGlobalPrefix('api');

  // CORS 配置
  const allowedOrigins = [
    // 生产环境域名
    'https://hoot.cool',
    'https://www.hoot.cool',
    'https://admin.hoot.cool',
    'https://api.hoot.cool',
    // 开发环境
    ...(process.env.NODE_ENV !== 'production'
      ? [
          'http://localhost:3001',
          'http://localhost:3006',
          'http://127.0.0.1:3001',
          'http://127.0.0.1:3006',
        ]
      : []),
  ];

  app.enableCors({
    origin: (origin, callback) => {
      // 允许无 origin 的请求（如服务器间调用）
      if (!origin) {
        callback(null, true);
        return;
      }
      // 检查是否在允许列表中
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      // 开发环境允许所有 localhost
      if (
        process.env.NODE_ENV !== 'production' &&
        (origin.includes('localhost') || origin.includes('127.0.0.1'))
      ) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  });

  // 全局验证管道
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // 全局异常过滤器
  app.useGlobalFilters(new GlobalExceptionFilter());

  // 全局响应转换拦截器
  app.useGlobalInterceptors(new TransformInterceptor());

  const port = process.env.API_PORT || 4001;
  await app.listen(port);

  logger.log(`🚀 API 服务已启动: http://localhost:${port}/api`);
}
bootstrap();
