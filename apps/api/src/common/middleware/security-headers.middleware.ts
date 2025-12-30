import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * 安全头中间件
 * 添加 HTTP 安全响应头
 */
@Injectable()
export class SecurityHeadersMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // 防止点击劫持
    res.setHeader('X-Frame-Options', 'DENY');

    // 防止 MIME 类型嗅探
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // XSS 保护
    res.setHeader('X-XSS-Protection', '1; mode=block');

    // 引用策略
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // 权限策略
    res.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=(), interest-cohort=()',
    );

    // 内容安全策略 (CSP)
    // 生产环境应根据实际需求调整
    if (process.env.NODE_ENV === 'production') {
      res.setHeader(
        'Content-Security-Policy',
        [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: https:",
          "font-src 'self' data:",
          "connect-src 'self' wss: https:",
          "frame-ancestors 'none'",
        ].join('; '),
      );

      // HSTS - 仅在 HTTPS 环境启用
      res.setHeader(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains; preload',
      );
    }

    next();
  }
}

/**
 * 安全头配置对象（用于 Helmet 库）
 */
export const securityHeadersConfig = {
  // 防止点击劫持
  frameguard: { action: 'deny' as const },

  // 禁用 MIME 嗅探
  noSniff: true,

  // XSS 过滤
  xssFilter: true,

  // 隐藏 X-Powered-By
  hidePoweredBy: true,

  // HSTS
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },

  // CSP
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      fontSrc: ["'self'", 'data:'],
      connectSrc: ["'self'", 'wss:', 'https:'],
      frameAncestors: ["'none'"],
    },
  },

  // 引用策略
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' as const },
};
