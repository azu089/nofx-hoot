import { IsOptional, IsString } from 'class-validator';

export class AdminStatsQueryDto {
  @IsOptional()
  @IsString()
  period?: 'today' | 'week' | 'month' | 'year';
}

export class AdminStatsResponseDto {
  users: {
    total: number;
    activeToday: number;
    newThisWeek: number;
  };

  instances: {
    total: number;
    running: number;
    stopped: number;
  };

  revenue: {
    today: string;
    thisMonth: string;
    total: string;
  };

  trades: {
    today: number;
    successRate: number;
  };
}

export class FinanceStatsResponseDto {
  totalRevenue: string;
  totalExpense: string;
  netProfit: string;
  growthRate: number;
  breakdown: {
    subscription: string;
    gasFee: string;
    deposit: string;
    withdrawal: string;
  };
  revenueDistribution: {
    operations: string;
    buyback: string;
    reserve: string;
  };
}
