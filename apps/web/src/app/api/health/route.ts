import { NextResponse } from 'next/server';

// 健康检查 API
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'hoot-web',
    version: process.env.npm_package_version || '1.0.0',
  });
}
