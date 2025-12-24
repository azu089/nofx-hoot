import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '../../node_modules/.prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

/**
 * Prisma 数据库服务
 * 提供全局数据库连接管理
 */
@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  public client: PrismaClient;
  private pool: Pool;

  constructor() {
    // 数据库连接字符串
    const databaseUrl = process.env.DATABASE_URL ||
      'postgresql://quantfi:quantfi_dev_password@localhost:5433/quantfi';

    // 创建 PostgreSQL 连接池
    this.pool = new Pool({
      connectionString: databaseUrl,
    });

    // 创建 Prisma adapter
    const adapter = new PrismaPg(this.pool);

    // 初始化 Prisma Client
    this.client = new PrismaClient({
      adapter,
    } as any);
  }

  /**
   * 模块初始化时连接数据库
   */
  async onModuleInit() {
    try {
      await this.client.$connect();
      this.logger.log('✅ Prisma 数据库连接成功');
    } catch (error) {
      this.logger.error('❌ Prisma 数据库连接失败:', error);
      throw error;
    }
  }

  /**
   * 模块销毁时断开数据库连接
   */
  async onModuleDestroy() {
    await this.client.$disconnect();
    await this.pool.end();
    this.logger.log('🔌 Prisma 数据库连接已断开');
  }

  /**
   * 获取 Prisma Client 实例
   */
  get prisma(): PrismaClient {
    return this.client;
  }

  /**
   * 清理数据库（仅用于测试环境）
   */
  async cleanDatabase() {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('禁止在生产环境清理数据库');
    }

    // 按依赖关系逆序删除
    const tables = [
      'admin_audit_logs',
      'agent_commissions',
      'instance_backups',
      'trade_history',
      'user_strategy_configs',
      'backtests',
      'api_keys',
      'withdrawals',
      'deposits',
      'billing_logs',
      'stakes',
      'token_orders',
      'token_burns',
      'wallets',
      'instances',
      'revenue_distributions',
      'announcements',
      'users',
      'agents',
      'strategies',
    ];

    for (const table of tables) {
      await this.client.$executeRawUnsafe(`TRUNCATE TABLE "${table}" CASCADE;`);
    }

    this.logger.log('🧹 测试数据库已清理');
  }
}
