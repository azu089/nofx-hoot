import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Mini App 仪表盘数据
 */
export class TelegramDashboardDto {
  @ApiProperty({ description: '用户信息' })
  user: {
    id: string;
    email?: string;
    telegramUsername?: string;
    telegramFirstName?: string;
    vipLevel: number;
  };

  @ApiProperty({ description: '资产概览' })
  wallet: {
    usdtBalance: string;
    pointsBalance: string;
    tokenBalance: string;
  };

  @ApiProperty({ description: '今日盈亏' })
  todayPnl: {
    amount: string;
    percentage: string;
    trades: number;
  };

  @ApiProperty({ description: '活跃策略数量' })
  activeStrategies: number;

  @ApiProperty({ description: 'VPS 实例状态' })
  instanceStatus: 'running' | 'stopped' | 'none';

  @ApiProperty({ description: '最近公告' })
  latestAnnouncement?: {
    id: string;
    title: string;
    type: string;
  };
}

/**
 * Mini App 策略列表项
 */
export class TelegramStrategyItemDto {
  @ApiProperty({ description: '策略 ID' })
  id: string;

  @ApiProperty({ description: '策略名称' })
  name: string;

  @ApiProperty({ description: '策略描述' })
  description?: string;

  @ApiProperty({ description: '胜率' })
  winRate: string;

  @ApiProperty({ description: '夏普比率' })
  sharpeRatio: string;

  @ApiProperty({ description: '最大回撤' })
  maxDrawdown: string;

  @ApiProperty({ description: '等级' })
  tier: string;

  @ApiProperty({ description: '是否已订阅' })
  isSubscribed: boolean;

  @ApiProperty({ description: '使用人数' })
  totalUsers: number;
}

/**
 * Mini App 策略列表响应
 */
export class TelegramStrategiesResponseDto {
  @ApiProperty({ description: '策略列表', type: [TelegramStrategyItemDto] })
  strategies: TelegramStrategyItemDto[];

  @ApiProperty({ description: '总数' })
  total: number;

  @ApiProperty({ description: '当前页' })
  page: number;

  @ApiProperty({ description: '每页数量' })
  limit: number;
}

/**
 * Mini App 钱包概览
 */
export class TelegramWalletDto {
  @ApiProperty({ description: 'USDT 余额' })
  usdtBalance: string;

  @ApiProperty({ description: 'USDT 冻结' })
  usdtFrozen: string;

  @ApiProperty({ description: '点卡余额' })
  cardBalance: string;

  @ApiProperty({ description: '积分余额' })
  pointsBalance: string;

  @ApiProperty({ description: '代币余额' })
  tokenBalance: string;

  @ApiProperty({ description: '代币锁定' })
  tokenLocked: string;

  @ApiProperty({ description: '充值地址' })
  depositAddresses: {
    chain: string;
    address: string;
  }[];
}

/**
 * 签到响应
 */
export class TelegramCheckinResponseDto {
  @ApiProperty({ description: '是否成功' })
  success: boolean;

  @ApiProperty({ description: '获得积分' })
  pointsEarned: string;

  @ApiProperty({ description: '连续签到天数' })
  streakDays: number;

  @ApiProperty({ description: '今日是否已签到' })
  alreadyCheckedIn: boolean;

  @ApiPropertyOptional({ description: '下次签到时间' })
  nextCheckinAt?: Date;
}

/**
 * 邀请信息
 */
export class TelegramInviteDto {
  @ApiProperty({ description: '邀请码' })
  inviteCode: string;

  @ApiProperty({ description: '邀请链接' })
  inviteLink: string;

  @ApiProperty({ description: 'Telegram 分享链接' })
  telegramShareLink: string;

  @ApiProperty({ description: '邀请人数' })
  totalInvited: number;

  @ApiProperty({ description: '累计返佣' })
  totalCommission: string;
}

/**
 * 交易控制请求
 */
export class TelegramTradeControlDto {
  @ApiProperty({ description: '策略配置 ID' })
  configId: string;
}

/**
 * 紧急平仓请求
 */
export class TelegramPanicDto {
  @ApiPropertyOptional({ description: '指定实例 ID，不传则平仓所有' })
  instanceId?: string;

  @ApiProperty({ description: '确认平仓' })
  confirm: boolean;
}

/**
 * 紧急平仓响应
 */
export class TelegramPanicResponseDto {
  @ApiProperty({ description: '是否成功' })
  success: boolean;

  @ApiProperty({ description: '关闭的持仓数量' })
  closedPositions: number;

  @ApiProperty({ description: '停止的策略数量' })
  stoppedStrategies: number;

  @ApiPropertyOptional({ description: '错误信息' })
  error?: string;
}
