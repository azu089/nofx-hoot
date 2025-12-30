import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateStrategyConfigDto } from './create-strategy-config.dto';

/**
 * 更新策略配置 DTO
 * 所有字段可选，不包含 strategy_id（不允许更改）
 */
export class UpdateStrategyConfigDto extends PartialType(
  OmitType(CreateStrategyConfigDto, ['strategy_id'] as const),
) {}
