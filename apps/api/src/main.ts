import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { RequestIdInterceptor } from './common/interceptors/request-id.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { SecurityHeadersMiddleware } from './common/middleware/security-headers.middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 获取配置服务
  const configService = app.get(ConfigService);

  // 全局前缀
  app.setGlobalPrefix('api');

  // 启用 CORS（支持用户前端和管理后台）
  const allowedOrigins = [
    'http://localhost:3001', // 用户前端
    'http://localhost:3002', // 管理后台
  ];
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  });

  // 应用安全头中间件
  const securityMiddleware = new SecurityHeadersMiddleware();
  app.use((req: any, res: any, next: any) => securityMiddleware.use(req, res, next));

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
    .setDescription(`
QuantFi Web3 量化 SaaS 平台 API 文档

## 功能模块

### 核心模块
- **Auth** - 用户认证（注册、登录、刷新 Token）
- **Users** - 用户管理（资料、设置）
- **Wallets** - 钱包系统（余额、API Key 管理）
- **Instances** - VPS 实例（创建、销毁、心跳）
- **Strategies** - 策略系统（市场、订阅、配置）
- **Billing** - 计费系统（账单、盈亏统计）

### GameFi 模块
- **GameFi** - 积分、质押、代币兑换、排行榜

### 代理商模块
- **Agents** - 代理商系统（邀请码、返佣、提现）

### 管理后台
- **Admin** - 平台管理（用户管理、财务审计、公告）

## 认证方式

所有需要认证的接口使用 Bearer Token：
\`\`\`
Authorization: Bearer <JWT_TOKEN>
\`\`\`

## 响应格式

**成功响应**
\`\`\`json
{
  "code": 0,
  "message": "success",
  "data": { ... },
  "request_id": "uuid"
}
\`\`\`

**错误响应**
\`\`\`json
{
  "code": 40001,
  "message": "错误描述",
  "data": null,
  "request_id": "uuid"
}
\`\`\`

## 错误码

| 范围 | 说明 |
|------|------|
| 0 | 成功 |
| 40000-40999 | 参数错误 |
| 41000-41999 | 认证错误 |
| 42000-42999 | 权限错误 |
| 43000-43999 | 业务错误 |
| 50000-50999 | 系统错误 |
    `)
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: '输入 JWT Token（从 /auth/login 获取）',
        in: 'header',
      },
      'JWT-auth',
    )
    // 核心模块
    .addTag('Auth', '认证模块 - 注册、登录、Token 刷新')
    .addTag('Users', '用户模块 - 资料、设置')
    .addTag('Wallets', '钱包模块 - 余额、API Key、充提')
    .addTag('Instances', 'VPS 实例 - 创建、销毁、心跳、策略控制')
    .addTag('Strategies', '策略模块 - 策略市场、订阅、配置')
    .addTag('Billing', '计费模块 - 账单、盈亏统计、燃油费')
    // GameFi 模块
    .addTag('GameFi', 'GameFi 系统 - 积分、质押、代币、排行榜')
    // 代理商模块
    .addTag('Agents', '代理商系统 - 邀请码、返佣、提现')
    // 管理后台
    .addTag('Admin', '管理后台 - 用户管理、财务审计、公告')
    .build();

  // Swagger 文档仅在非生产环境启用
  if (nodeEnv !== 'production') {
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  }

  await app.listen(port);

  console.log(`🚀 QuantFi API 服务已启动`);
  console.log(`   环境: ${nodeEnv}`);
  console.log(`   地址: http://localhost:${port}/api`);
  console.log(`   健康检查: http://localhost:${port}/api/health`);
  if (nodeEnv !== 'production') {
    console.log(`   API 文档: http://localhost:${port}/api/docs`);
  }
  console.log(`   CORS: localhost:3001, localhost:3002`);
}

bootstrap();
