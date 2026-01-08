import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { BacktestRequestDto, BacktestResultDto } from './dto/backtest.dto';

/**
 * 回测服务
 *
 * 所有回测均通过用户 VPS 上的 Freqtrade 执行
 * 本服务仅负责验证参数和管理回测历史
 */
@Injectable()
export class BacktestService {
  private readonly logger = new Logger(BacktestService.name);

  constructor() {
    this.logger.log('回测服务已启动');
  }

  /**
   * 验证回测请求参数
   */
  validateBacktestRequest(dto: BacktestRequestDto): void {
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    const now = new Date();

    if (startDate >= endDate) {
      throw new BadRequestException('开始日期必须早于结束日期');
    }

    if (endDate > now) {
      throw new BadRequestException('结束日期不能晚于今天');
    }

    const daysDiff =
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysDiff > 365) {
      throw new BadRequestException('回测时间范围不能超过 365 天');
    }

    if (!dto.pairs || dto.pairs.length === 0) {
      throw new BadRequestException('请至少选择一个交易对');
    }

    if (dto.initialCapital <= 0) {
      throw new BadRequestException('初始资金必须大于 0');
    }
  }

  /**
   * 获取用户的回测历史（未来功能）
   */
  async getBacktestHistory(userId: string): Promise<BacktestResultDto[]> {
    this.logger.debug(`获取用户 ${userId} 的回测历史`);
    return [];
  }
}
