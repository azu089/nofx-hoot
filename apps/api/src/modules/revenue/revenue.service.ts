import { Injectable, Logger } from '@nestjs/common';
import Decimal from 'decimal.js';
import { Pool } from 'pg';
import { RevenueDistribution } from '../../database/entities/revenue-distribution.entity';

/**
 * 收入分配服务
 *
 * 核心规则：
 * 1. 收入分配：40% 运营 + 40% 回购 + 20% 储备
 * 2. 回购后分配：50% 销毁 + 50% 分配给质押者
 * 3. 所有计算使用 Decimal.js 保证精度
 * 4. 分配操作必须使用事务
 */
@Injectable()
export class RevenueService {
  private readonly logger = new Logger(RevenueService.name);
  private readonly pool: Pool;

  // 分配比例常量
  private readonly OPERATIONS_RATE = new Decimal('0.4'); // 40%
  private readonly BUYBACK_RATE = new Decimal('0.4'); // 40%
  private readonly RESERVE_RATE = new Decimal('0.2'); // 20%
  private readonly BURN_RATE = new Decimal('0.5'); // 回购后 50% 销毁
  private readonly DISTRIBUTE_RATE = new Decimal('0.5'); // 回购后 50% 分配

  constructor() {
    // 初始化数据库连接池
    this.pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5433'),
      database: process.env.DB_NAME || 'quantfi',
      user: process.env.DB_USER || 'quantfi',
      password: process.env.DB_PASSWORD,
    });
  }

  /**
   * 计算周期收入
   * @param startDate 周期开始日期
   * @param endDate 周期结束日期
   * @returns 总收入金额（USDT）
   */
  async calculatePeriodRevenue(
    startDate: Date,
    endDate: Date,
  ): Promise<string> {
    this.logger.log(`计算周期收入: ${startDate} - ${endDate}`);

    const client = await this.pool.connect();
    try {
      // 查询周期内所有 gas_fee 收入（来自 billing_logs）
      const result = await client.query(
        `SELECT COALESCE(SUM(amount), 0) as total_revenue
         FROM billing_logs
         WHERE billing_type = 'gas_fee'
           AND status = 'completed'
           AND created_at >= $1
           AND created_at < $2`,
        [startDate, endDate],
      );

      const totalRevenue = result.rows[0]?.total_revenue || '0';
      this.logger.log(`周期总收入: ${totalRevenue} USDT`);

      return totalRevenue;
    } finally {
      client.release();
    }
  }

  /**
   * 执行收入分配
   * @param periodStart 周期开始时间
   * @param periodEnd 周期结束时间
   * @returns 分配记录
   */
  async distribute(
    periodStart: Date,
    periodEnd: Date,
  ): Promise<RevenueDistribution> {
    this.logger.log(`执行收入分配: ${periodStart} - ${periodEnd}`);

    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // 1. 计算周期收入
      const totalRevenueStr = await this.calculatePeriodRevenue(
        periodStart,
        periodEnd,
      );
      const totalRevenue = new Decimal(totalRevenueStr);

      if (totalRevenue.lte(0)) {
        throw new Error('周期收入为 0，无需分配');
      }

      // 2. 按比例分配
      const operationsAmount = totalRevenue.times(this.OPERATIONS_RATE);
      const buybackAmount = totalRevenue.times(this.BUYBACK_RATE);
      const reserveAmount = totalRevenue.times(this.RESERVE_RATE);

      // 验算：确保分配总和 = 总收入
      const sum = operationsAmount.plus(buybackAmount).plus(reserveAmount);
      if (!sum.equals(totalRevenue)) {
        throw new Error(
          `分配验算失败: ${operationsAmount} + ${buybackAmount} + ${reserveAmount} = ${sum} ≠ ${totalRevenue}`,
        );
      }

      // 3. 插入分配记录
      const insertResult = await client.query(
        `INSERT INTO revenue_distributions (
          period_start, period_end, total_revenue,
          operations_amount, buyback_amount, reserve_amount,
          tokens_bought, tokens_burned, tokens_distributed,
          buyback_executed, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *`,
        [
          periodStart,
          periodEnd,
          totalRevenue.toFixed(8),
          operationsAmount.toFixed(8),
          buybackAmount.toFixed(8),
          reserveAmount.toFixed(8),
          '0', // tokens_bought (待回购执行)
          '0', // tokens_burned
          '0', // tokens_distributed
          false, // buyback_executed
          'pending', // status
        ],
      );

      await client.query('COMMIT');

      const distribution = insertResult.rows[0];
      this.logger.log(
        `分配完成: 运营=${operationsAmount} 回购=${buybackAmount} 储备=${reserveAmount}`,
      );

      return distribution;
    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error(`分配失败: ${error.message}`, error.stack);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 模拟回购（沙盒环境）
   * @param amount 回购金额（USDT）
   * @returns 模拟回购的代币数量
   */
  async simulateBuyback(amount: string): Promise<{
    tokensBought: string;
    tokensBurned: string;
    tokensDistributed: string;
  }> {
    this.logger.log(`模拟回购: ${amount} USDT`);

    const buybackAmount = new Decimal(amount);

    // 模拟 DEX 价格：1 USDT = 10 QFI（实际需要对接 DEX 价格）
    const mockPrice = new Decimal('0.1'); // 1 QFI = 0.1 USDT
    const tokensBought = buybackAmount.div(mockPrice);

    // 回购后分配：50% 销毁 + 50% 分配
    const tokensBurned = tokensBought.times(this.BURN_RATE);
    const tokensDistributed = tokensBought.times(this.DISTRIBUTE_RATE);

    this.logger.log(
      `模拟结果: 回购=${tokensBought.toFixed(8)} 销毁=${tokensBurned.toFixed(8)} 分配=${tokensDistributed.toFixed(8)}`,
    );

    return {
      tokensBought: tokensBought.toFixed(8),
      tokensBurned: tokensBurned.toFixed(8),
      tokensDistributed: tokensDistributed.toFixed(8),
    };
  }

  /**
   * 获取分配历史
   * @param page 页码
   * @param limit 每页数量
   * @param status 状态筛选
   * @returns 分配历史列表
   */
  async getDistributionHistory(
    page: number = 1,
    limit: number = 10,
    status?: 'pending' | 'processing' | 'completed',
  ): Promise<{
    data: RevenueDistribution[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const client = await this.pool.connect();
    try {
      const offset = (page - 1) * limit;

      // 构建查询条件
      let whereClause = '';
      const params: any[] = [limit, offset];

      if (status) {
        whereClause = 'WHERE status = $3';
        params.push(status);
      }

      // 查询总数
      const countResult = await client.query(
        `SELECT COUNT(*) as total FROM revenue_distributions ${whereClause}`,
        params.slice(2), // 跳过 limit/offset
      );
      const total = parseInt(countResult.rows[0].total);

      // 查询分页数据
      const dataResult = await client.query(
        `SELECT * FROM revenue_distributions
         ${whereClause}
         ORDER BY created_at DESC
         LIMIT $1 OFFSET $2`,
        params,
      );

      return {
        data: dataResult.rows,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    } finally {
      client.release();
    }
  }

  /**
   * 获取当前周期统计
   * @returns 当前周期统计数据
   */
  async getCurrentPeriod(): Promise<{
    periodStart: Date;
    periodEnd: Date;
    currentRevenue: string;
    projectedDistribution: {
      operations: string;
      buyback: string;
      reserve: string;
    };
  }> {
    // 当前周期：本月 1 日 - 下月 1 日
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const currentRevenueStr = await this.calculatePeriodRevenue(
      periodStart,
      periodEnd,
    );
    const currentRevenue = new Decimal(currentRevenueStr);

    return {
      periodStart,
      periodEnd,
      currentRevenue: currentRevenue.toFixed(8),
      projectedDistribution: {
        operations: currentRevenue.times(this.OPERATIONS_RATE).toFixed(8),
        buyback: currentRevenue.times(this.BUYBACK_RATE).toFixed(8),
        reserve: currentRevenue.times(this.RESERVE_RATE).toFixed(8),
      },
    };
  }

  /**
   * 获取统计数据
   * @returns 全局统计数据
   */
  async getStats(): Promise<{
    totalRevenue: string;
    totalBuyback: string;
    totalBurned: string;
    totalDistributed: string;
    distributionCount: number;
  }> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(`
        SELECT
          COALESCE(SUM(total_revenue), 0) as total_revenue,
          COALESCE(SUM(buyback_amount), 0) as total_buyback,
          COALESCE(SUM(tokens_burned), 0) as total_burned,
          COALESCE(SUM(tokens_distributed), 0) as total_distributed,
          COUNT(*) as distribution_count
        FROM revenue_distributions
        WHERE status = 'completed'
      `);

      return {
        totalRevenue: result.rows[0].total_revenue,
        totalBuyback: result.rows[0].total_buyback,
        totalBurned: result.rows[0].total_burned,
        totalDistributed: result.rows[0].total_distributed,
        distributionCount: parseInt(result.rows[0].distribution_count),
      };
    } finally {
      client.release();
    }
  }
}
