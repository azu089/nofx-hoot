import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { RequestIdInterceptor } from './common/interceptors/request-id.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 获取配置服务
  const configService = app.get(ConfigService);

  // 全局前缀
  app.setGlobalPrefix('api');

  // 启用 CORS
  const corsOrigin = configService.get<string>('app.corsOrigin');
  app.enableCors({
    origin: corsOrigin,
    credentials: true,
  });

  // 全局拦截器（顺序很重要！）
  // 1. Request ID 拦截器 - 最先执行，生成 request_id
  app.useGlobalInterceptors(new RequestIdInterceptor());
  // 2. 日志拦截器 - 记录请求/响应
  app.useGlobalInterceptors(new LoggingInterceptor());
  // 3. 响应转换拦截器 - 统一成功响应格式
  app.useGlobalInterceptors(new TransformInterceptor());

  // 全局异常过滤器 - 统一错误响应格式
  app.useGlobalFilters(new HttpExceptionFilter());

  // 全局验证管道
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // 自动移除未定义的属性
      forbidNonWhitelisted: true, // 禁止未定义的属性
      transform: true, // 自动类型转换
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  const port = configService.get<number>('app.port') || 4001;
  const nodeEnv = configService.get<string>('app.nodeEnv') || 'development';

  // Swagger 文档配置
  const swaggerConfig = new DocumentBuilder()
    .setTitle('QuantFi API')
    .setDescription('QuantFi Web3 量化 SaaS 平台 API 文档')
    .setVersion('0.1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: '输入 JWT Token',
        in: 'header',
      },
      'JWT-auth',
    )
    .addTag('auth', '认证模块')
    .addTag('users', '用户模块')
    .addTag('wallets', '钱包模块')
    .addTag('instances', 'VPS 实例模块')
    .addTag('strategies', '策略模块')
    .addTag('billing', '计费模块')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(port);

  console.log(`🚀 QuantFi API 服务已启动`);
  console.log(`   环境: ${nodeEnv}`);
  console.log(`   地址: http://localhost:${port}/api`);
  console.log(`   健康检查: http://localhost:${port}/api/health`);
  console.log(`   API 文档: http://localhost:${port}/api/docs`);
  console.log(`   CORS: ${corsOrigin}`);
}

bootstrap();
