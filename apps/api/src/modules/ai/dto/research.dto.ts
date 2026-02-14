import {
  IsString,
  IsOptional,
  IsBoolean,
  IsEnum,
} from 'class-validator';

/**
 * 启动 AI 研究
 */
export class StartResearchDto {
  @IsString()
  symbol: string; // 如 'BTC/USDT'

  @IsOptional()
  @IsEnum(['quick', 'standard', 'deep'])
  depth?: 'quick' | 'standard' | 'deep' = 'standard';

  @IsOptional()
  @IsBoolean()
  autoExecute?: boolean = false; // 是否自动执行交易
}

/**
 * 手动执行研究结果
 */
export class ExecuteResearchDto {
  @IsString()
  sessionId: string;
}
