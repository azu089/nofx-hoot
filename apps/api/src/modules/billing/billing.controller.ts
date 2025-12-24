import { Controller } from '@nestjs/common';
import { BillingService } from './billing.service';

/**
 * 计费控制器
 * 路由前缀: /api/billing
 */
@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  // TODO: 实现订阅扣费接口 POST /api/billing/subscription
  // TODO: 实现 Gas 费抽成接口 POST /api/billing/gas-fee
  // TODO: 实现代理商返佣接口 POST /api/billing/commission
  // TODO: 实现计费记录查询接口 GET /api/billing/records
}
