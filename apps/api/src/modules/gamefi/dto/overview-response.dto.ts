/**
 * GameFi 概览响应 DTO
 */

export class PointsSummaryDto {
  available: string;
  frozen: string;
  total: string;
  todayEarned: string;
}

export class StakingSummaryDto {
  totalStaked: string;
  totalReward: string;
  activeCount: number;
  averageWeight: string;
}

export class TokensSummaryDto {
  available: string;
  locked: string;
  vesting: string;
  total: string;
}

export class RewardsSummaryDto {
  claimable: string;
  claimed: string;
  nextReleaseAmount: string;
  nextReleaseDate: Date | null;
}

export class GamefiOverviewDto {
  points: PointsSummaryDto;
  staking: StakingSummaryDto;
  tokens: TokensSummaryDto;
  rewards: RewardsSummaryDto;
}

export class LeaderboardEntryDto {
  rank: number;
  userId: string;
  email: string;
  totalPoints: string;
  todayPoints: string;
  vipLevel: number;
}

export class LeaderboardResponseDto {
  entries: LeaderboardEntryDto[];
  total: number;
  myRank: number | null;
  myPoints: string;
  period: 'day' | 'week' | 'month' | 'all';
}
