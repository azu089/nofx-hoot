import { IsEnum, IsOptional, IsDateString, ValidateIf } from 'class-validator';

/**
 * 时间段类型
 */
export enum PeriodType {
  TODAY = 'today',
  WEEK = 'week',
  MONTH = 'month',
  CUSTOM = 'custom',
}

/**
 * 按时间段查询盈利统计的请求 DTO
 */
export class PeriodStatsQueryDto {
  @IsEnum(PeriodType, { message: '时间段类型必须是 today、week、month 或 custom' })
  period: PeriodType = PeriodType.TODAY;

  @ValidateIf((o) => o.period === PeriodType.CUSTOM)
  @IsDateString({}, { message: '开始日期格式不正确，应为 YYYY-MM-DD' })
  start_date?: string;

  @ValidateIf((o) => o.period === PeriodType.CUSTOM)
  @IsDateString({}, { message: '结束日期格式不正确，应为 YYYY-MM-DD' })
  end_date?: string;
}

/**
 * 时间段盈利统计响应 DTO
 */
export class PeriodStatsResponseDto {
  /** 时间段类型 */
  period: string;

  /** 开始日期 */
  start_date: string;

  /** 结束日期 */
  end_date: string;

  /** 总交易次数 */
  total_trades: number;

  /** 盈利交易次数 */
  win_trades: number;

  /** 亏损交易次数 */
  loss_trades: number;

  /** 胜率 (0-1) */
  win_rate: string;

  /** 总盈亏 */
  total_pnl: string;

  /** 总盈利 */
  total_profit: string;

  /** 总亏损 */
  total_loss: string;

  /** 最佳交易盈亏 */
  best_trade: string;

  /** 最差交易盈亏 */
  worst_trade: string;

  /** 平均每笔盈亏 */
  avg_pnl_per_trade: string;

  /** 总燃油费 */
  total_gas_fee: string;
}
