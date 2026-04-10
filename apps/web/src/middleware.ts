/**
 * Next.js Middleware — 路由级认证守卫
 *
 * 逻辑:
 * 1. 公开路由直接放行
 * 2. /admin/* 检查 hoot_admin_token cookie，无则跳转 /admin-login
 * 3. 其余受保护路由检查 hoot_token cookie，无则跳转 /login
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// 公开路由前缀（完全放行，无需认证）
const PUBLIC_PREFIXES = [
  '/login',
  '/register',
  '/forgot-password',
  '/verify-email',
  '/admin-login',
  '/preview',
  '/legal',
  '/api',
  '/_next',
];

// 需要用户认证的路由前缀
const USER_PROTECTED_PREFIXES = [
  '/wallet',
  '/trading',
  '/settings',
  '/profile',
  '/referral',
  '/subscription',
  '/ecosystem',
  '/notifications',
  '/about',
  '/help',
  '/staking',
];

// 需要管理员认证的路由前缀
const ADMIN_PROTECTED_PREFIXES = ['/admin'];

const TOKEN_COOKIE = 'hoot_token';
const ADMIN_TOKEN_COOKIE = 'hoot_admin_token';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. 精确匹配根路由 — 公开放行
  if (pathname === '/') {
    return NextResponse.next();
  }

  // 2. 公开路由前缀 — 直接放行
  for (const prefix of PUBLIC_PREFIXES) {
    if (pathname.startsWith(prefix)) {
      return NextResponse.next();
    }
  }

  // 3. 管理员路由保护（优先于用户路由）
  for (const prefix of ADMIN_PROTECTED_PREFIXES) {
    if (pathname.startsWith(prefix)) {
      const adminToken = request.cookies.get(ADMIN_TOKEN_COOKIE)?.value;
      if (!adminToken) {
        const loginUrl = new URL('/admin-login', request.url);
        // 保存原始路径，登录后可跳回
        loginUrl.searchParams.set('redirect', pathname);
        return NextResponse.redirect(loginUrl);
      }
      return NextResponse.next();
    }
  }

  // 4. 用户受保护路由
  for (const prefix of USER_PROTECTED_PREFIXES) {
    if (pathname.startsWith(prefix)) {
      const userToken = request.cookies.get(TOKEN_COOKIE)?.value;
      if (!userToken) {
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('redirect', pathname);
        return NextResponse.redirect(loginUrl);
      }
      return NextResponse.next();
    }
  }

  // 5. 其余路径放行（静态资源等）
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * 匹配所有路径，排除:
     * - _next/static (静态文件)
     * - _next/image (图片优化)
     * - favicon.ico 及常见图片格式
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
