/**
 * 分配历史查询参数 DTO
 */
export class DistributionHistoryQueryDto {
  /** 页码 */
  page?: number = 1;

  /** 每页数量 */
  limit?: number = 10;

  /** 状态筛选 */
  status?: 'pending' | 'completed' | 'failed';

  /** 开始日期 */
  startDate?: Date;

  /** 结束日期 */
  endDate?: Date;
}

/**
 * 分配历史响应 DTO
 */
export class DistributionHistoryResponseDto {
  /** 分配记录列表 */
  data: any[];

  /** 总数 */
  total: number;

  /** 当前页 */
  page: number;

  /** 每页数量 */
  limit: number;

  /** 总页数 */
  totalPages: number;
}
