import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsOptional, IsString, IsNotEmpty } from 'class-validator';

/**
 * 手动触发燃油费计算 DTO
 */
export class CalculateGasFeeDto {
  @ApiProperty({ description: '交易 ID（可选，不填则计算所有未处理交易）', required: false })
  @IsOptional()
  @IsUUID()
  tradeId?: string;

  @ApiProperty({ description: '实例 ID（可选，只处理指定实例的交易）', required: false })
  @IsOptional()
  @IsUUID()
  instanceId?: string;
}

/**
 * 燃油费计算结果 DTO
 */
export class GasFeeResultDto {
  @ApiProperty({ description: '处理的交易数量' })
  processed: number;

  @ApiProperty({ description: '成功抽成数量' })
  charged: number;

  @ApiProperty({ description: '跳过数量（亏损或已处理）' })
  skipped: number;

  @ApiProperty({ description: '失败数量' })
  failed: number;

  @ApiProperty({ description: '总抽成金额' })
  totalGasFee: string;

  @ApiProperty({ description: '处理详情' })
  details: GasFeeDetailDto[];
}

/**
 * 单笔燃油费详情
 */
export class GasFeeDetailDto {
  @ApiProperty({ description: '交易 ID' })
  tradeId: string;

  @ApiProperty({ description: '交易对' })
  symbol: string;

  @ApiProperty({ description: '盈亏金额' })
  pnl: string;

  @ApiProperty({ description: '燃油费金额' })
  gasFee: string;

  @ApiProperty({ description: '状态', enum: ['charged', 'skipped', 'failed'] })
  status: string;

  @ApiProperty({ description: '原因（跳过或失败时）', nullable: true })
  reason?: string;
}

/**
 * 今日盈亏统计 DTO
 */
export class TodayPnLDto {
  @ApiProperty({ description: '今日总盈亏' })
  todayPnl: string;

  @ApiProperty({ description: '今日总盈利' })
  todayProfit: string;

  @ApiProperty({ description: '今日总亏损' })
  todayLoss: string;

  @ApiProperty({ description: '今日交易数' })
  todayTrades: number;

  @ApiProperty({ description: '今日胜率' })
  todayWinRate: string;

  @ApiProperty({ description: '今日燃油费' })
  todayGasFee: string;
}

/**
 * 收益曲线数据点
 */
export class PnLCurvePointDto {
  @ApiProperty({ description: '日期 (YYYY-MM-DD)' })
  date: string;

  @ApiProperty({ description: '当日盈亏' })
  pnl: string;

  @ApiProperty({ description: '累计盈亏' })
  cumulativePnl: string;

  @ApiProperty({ description: '当日交易数' })
  trades: number;
}

/**
 * 收益曲线响应 DTO
 */
export class PnLCurveResponseDto {
  @ApiProperty({ type: [PnLCurvePointDto] })
  curve: PnLCurvePointDto[];

  @ApiProperty({ description: '总盈亏' })
  totalPnl: string;

  @ApiProperty({ description: '最大回撤' })
  maxDrawdown: string;

  @ApiProperty({ description: '开始日期' })
  startDate: string;

  @ApiProperty({ description: '结束日期' })
  endDate: string;
}

/**
 * 查询计费日志 DTO
 */
export class QueryBillingLogsDto {
  @ApiProperty({ description: '计费类型', required: false })
  @IsOptional()
  billingType?: string;

  @ApiProperty({ description: '开始日期', required: false })
  @IsOptional()
  startDate?: string;

  @ApiProperty({ description: '结束日期', required: false })
  @IsOptional()
  endDate?: string;
}

/**
 * 订阅扣费 DTO
 */
export class ChargeSubscriptionDto {
  @ApiProperty({ description: '用户 ID（可选，不填则对当前用户扣费）', required: false })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiProperty({ description: '扣费金额 (USDT)' })
  @IsNotEmpty({ message: '金额不能为空' })
  @IsString()
  amount: string;

  @ApiProperty({ description: '订阅周期描述', required: false })
  @IsOptional()
  @IsString()
  period?: string;
}
