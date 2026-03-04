import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    // 连接池配置：连接上限 20，超时 20 秒，避免 worker 并发导致连接耗尽排队
    const dbUrl = process.env.DATABASE_URL || '';
    const hasParams = dbUrl.includes('?');
    const poolUrl = dbUrl.includes('connection_limit')
      ? dbUrl
      : `${dbUrl}${hasParams ? '&' : '?'}connection_limit=20&pool_timeout=20`;
    super({
      datasources: { db: { url: poolUrl } },
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
