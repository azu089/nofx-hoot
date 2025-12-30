# 积分模块 (Points Module)

## 功能说明

积分系统（Q-Points）用于激励用户交易，提供交易挖矿和订阅费抵扣功能。

## 核心功能

### 1. 交易挖矿
- **规则**: 每 100 USDT 交易量 = 1 积分
- **VIP 加成**:
  - 普通用户: 1.0x
  - VIP1: 1.2x
  - VIP2: 1.5x
  - VIP3: 2.0x

**示例**:
- 普通用户交易 1000 USDT → 获得 10 积分
- VIP1 交易 1000 USDT → 获得 12 积分
- VIP2 交易 1000 USDT → 获得 15 积分
- VIP3 交易 1000 USDT → 获得 20 积分

### 2. 积分抵扣
- 积分可用于抵扣 VIP 订阅费
- 抵扣比例由管理员设定

### 3. 积分查询
- 查询可用积分余额
- 查询积分流水历史

## API 接口

### GET /api/points/balance
查询用户积分余额

**请求头**:
```
Authorization: Bearer <jwt-token>
```

**响应**:
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "available": "100.00000000",
    "frozen": "0.00000000",
    "total": "100.00000000"
  }
}
```

### GET /api/points/history?limit=50
查询用户积分流水

**请求头**:
```
Authorization: Bearer <jwt-token>
```

**响应**:
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "history": [
      {
        "id": "uuid",
        "userId": "user-uuid",
        "uniqueOrderId": "points_earn_...",
        "billingType": "points_earn",
        "amount": "10.00000000",
        "referenceType": "trade_history",
        "referenceId": "trade-uuid",
        "description": "交易挖矿：1000 USDT x 1.0 (VIP0)",
        "status": "completed",
        "createdAt": "2025-12-26T14:21:00.000Z"
      }
    ],
    "total": 1
  }
}
```

### POST /api/points/deduct
抵扣积分（管理员接口）

**请求头**:
```
Authorization: Bearer <jwt-token>
```

**请求体**:
```json
{
  "userId": "user-uuid",
  "points": "50.00000000",
  "description": "抵扣 VIP 订阅费"
}
```

**响应**:
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "deductedPoints": "50.00000000"
  }
}
```

## 数据库表

### wallets
- `points_balance` - 可用积分 (DECIMAL 18,8)
- `points_frozen` - 冻结积分 (DECIMAL 18,8)

### billing_logs
- `billing_type` - 'points_earn' | 'points_deduct'
- `currency` - 'POINTS'
- `amount` - 积分数量（正数=获得，负数=扣除）
- `reference_type` - 'trade_history'（用于关联交易）
- `reference_id` - 交易 ID
- `unique_order_id` - 幂等性保证

## 使用示例

### 在交易模块中调用（交易挖矿）

```typescript
import { PointsService } from '../points/points.service';

@Injectable()
export class TradesService {
  constructor(
    private readonly pointsService: PointsService,
  ) {}

  async afterTradeCompleted(tradeId: string, userId: string, volume: string) {
    // 交易完成后，自动获取积分
    try {
      await this.pointsService.earnFromTrade(userId, volume, tradeId);
    } catch (error) {
      this.logger.error(`积分获取失败: ${error.message}`);
      // 不影响交易主流程
    }
  }
}
```

### 在订阅模块中调用（积分抵扣）

```typescript
import { PointsService } from '../points/points.service';

@Injectable()
export class SubscriptionService {
  constructor(
    private readonly pointsService: PointsService,
  ) {}

  async subscribeWithPoints(userId: string, points: string) {
    // 使用积分抵扣订阅费
    await this.pointsService.deductForSubscription(
      userId,
      points,
      'VIP 订阅抵扣',
    );
  }
}
```

## 技术特性

### 精度保证
- 所有积分计算使用 `decimal.js`，精确到 8 位小数
- 禁止使用 JavaScript 原生运算（避免浮点数精度问题）

### 幂等性
- 使用 `unique_order_id` 确保每笔交易只能获取一次积分
- 格式: `points_earn_{user_id}_{timestamp}_{nonce}`

### 事务保证
- 所有积分操作使用数据库事务
- 确保钱包更新和日志记录的原子性

### 审计日志
- 所有积分操作记录到 `billing_logs` 表
- 包含操作时间、金额、来源、状态等完整信息

## 注意事项

1. **VIP 等级**: 必须在用户表中正确维护 `vip_level` 字段
2. **交易量**: 必须传入 USDT 标价的交易量
3. **管理员接口**: `/api/points/deduct` 需要添加管理员权限验证（后续实现）
4. **错误处理**: 积分获取失败不应影响交易主流程

## 未来扩展

- [ ] 积分过期机制
- [ ] 积分转让功能
- [ ] 积分兑换商城
- [ ] 积分排行榜
- [ ] 积分活动（双倍积分等）
