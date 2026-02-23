import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import helmet from 'helmet';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  // 信任反向代理（nginx），确保 req.ip 获取真实客户端 IP
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.set('trust proxy', 1);

  // 安全中间件 - 强化 HTTP 安全头
  app.use(
    helmet({
      // Content Security Policy - 限制资源加载来源
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
        },
      },
      // 禁止 iframe 嵌入（防止点击劫持）
      frameguard: { action: 'deny' },
      // 隐藏 X-Powered-By 头
      hidePoweredBy: true,
      // HSTS - 强制 HTTPS（1年）
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
      // 禁止 MIME 类型嗅探
      noSniff: true,
      // XSS 过滤
      xssFilter: true,
      // 禁止 DNS 预取（防止信息泄露）
      dnsPrefetchControl: { allow: false },
      // Referrer 策略
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      // 权限策略 - 禁用不需要的浏览器功能
      permittedCrossDomainPolicies: { permittedPolicies: 'none' },
    }),
  );

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

  // Swagger API 文档（仅非生产环境）
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('HOOT API')
      .setDescription('HOOT AI 量化交易平台 API 文档')
      .setVersion('1.0')
      .addBearerAuth()
      .addTag('auth', '认证')
      .addTag('wallet', '钱包')
      .addTag('trading', '交易')
      .addTag('ai', 'AI 智能交易')
      .addTag('strategies', '策略')
      .addTag('staking', '质押')
      .addTag('referral', '推荐')
      .addTag('membership', '会员')
      .addTag('market', '行情')
      .addTag('notifications', '通知')
      .addTag('airdrop', '空投')
      .addTag('api-keys', 'API Keys')
      .addTag('blockchain', '区块链')
      .addTag('health', '健康检查')
      .addTag('admin', '管理后台')
      .addTag('admin-auth', '管理员认证')
      .addTag('admin-content', '内容管理')
      .addTag('agent', '代理商')
      .addTag('agent-auth', '代理商认证')
      .addTag('signals', '信号')
      .addTag('exchanges', '交易所')
      .addTag('config', '配置')
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
    logger.log(`📄 Swagger 文档: http://localhost:${process.env.API_PORT || 4001}/api/docs`);
  }

  const port = process.env.API_PORT || 4001;
  await app.listen(port);

  // 配置 HTTP keep-alive 超时，防止连接复用导致间歇性 401
  const server = app.getHttpServer();
  server.keepAliveTimeout = 65000; // 65s（需大于反向代理的 keep-alive）
  server.headersTimeout = 66000;   // 需大于 keepAliveTimeout

  logger.log(`🚀 API 服务已启动: http://localhost:${port}/api`);
}
bootstrap();
