# Tokens 模块

代币（$QFI）兑换、线性释放、销毁管理模块。

---

## 功能概述

1. **积分兑换代币**
   - 标准模式：20% 立即到账 + 80% 线性 90 天释放
   - 急速模式：50% 立即到账 + 50% 销毁

2. **每日线性释放**
   - 定时任务：每天凌晨 1 点执行
   - 标准模式订单自动释放代币

3. **释放进度查询**
   - 查看待释放代币、已释放、下次释放时间

4. **兑换订单查询**
   - 查看历史兑换记录

---

## API 接口

### 1. POST /api/tokens/exchange - 积分兑换代币

**请求参数**:
```json
{
  "points": 10000,      // 兑换积分（最少 1000）
  "mode": "standard"    // 兑换模式：standard | fast
}
```

**响应示例**:
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "orderId": "uuid",
    "tokensReceived": "2.00000000",
    "tokensPending": "8.00000000",
    "tokensBurned": "0.00000000",
    "message": "已获得 2.00000000 $QFI，剩余 8.00000000 $QFI 将在 90 天内线性释放"
  }
}
```

---

### 2. GET /api/tokens/balance - 查询代币余额

**响应示例**:
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "available": "2.00000000",  // 可用余额
    "locked": "0.00000000",     // 锁定余额（质押）
    "vesting": "8.00000000",    // 待释放余额
    "total": "10.00000000"      // 总余额
  }
}
```

---

### 3. GET /api/tokens/vesting - 查询释放进度

**响应示例**:
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "totalVesting": "8.00000000",
    "released": "2.00000000",
    "pending": "6.00000000",
    "nextReleaseAmount": "0.08888888",
    "nextReleaseDate": "2025-12-27T01:00:00.000Z",
    "vestingOrders": [
      {
        "orderId": "uuid",
        "tokensTotal": "10.00000000",
        "tokensReleased": "4.00000000",
        "tokensPending": "6.00000000",
        "vestingMode": "standard",
        "vestingStartAt": "2025-12-01T00:00:00.000Z",
        "vestingEndAt": "2026-02-28T00:00:00.000Z",
        "lastReleaseAt": "2025-12-26T01:00:00.000Z",
        "progress": 40.00,
        "daysRemaining": 64
      }
    ]
  }
}
```

---

### 4. GET /api/tokens/orders - 查询兑换订单

**响应示例**:
```json
{
  "code": 0,
  "message": "success",
  "data": [
    {
      "id": "uuid",
      "userId": "uuid",
      "pointsSpent": "10000.00000000",
      "tokensTotal": "10.00000000",
      "exchangeRate": "1000.00000000",
      "vestingMode": "standard",
      "tokensReleased": "4.00000000",
      "tokensPending": "6.00000000",
      "tokensBurned": "0.00000000",
      "vestingStartAt": "2025-12-01T00:00:00.000Z",
      "vestingEndAt": "2026-02-28T00:00:00.000Z",
      "lastReleaseAt": "2025-12-26T01:00:00.000Z",
      "status": "vesting",
      "createdAt": "2025-12-01T00:00:00.000Z",
      "updatedAt": "2025-12-26T01:00:00.000Z"
    }
  ]
}
```

---

## 兑换模式详解

### 标准模式（Standard）

**特点**:
- 20% 立即到账
- 80% 线性 90 天释放
- 每天凌晨 1 点自动释放
- 适合长期持有用户

**计算公式**:
```typescript
总代币 = 积分 / 1000
立即到账 = 总代币 × 0.2
待释放 = 总代币 × 0.8
每日释放 = 待释放 / 90
```

**示例**:
```
10000 积分 → 10 QFI
立即获得：2 QFI
待释放：8 QFI
每日释放：0.08888888 QFI
```

---

### 急速模式（Fast）

**特点**:
- 50% 立即到账
- 50% 永久销毁（通缩机制）
- 无需等待释放
- 适合急需流动性用户

**计算公式**:
```typescript
总代币 = 积分 / 1000
立即到账 = 总代币 × 0.5
销毁 = 总代币 × 0.5
```

**示例**:
```
5000 积分 → 5 QFI
立即获得：2.5 QFI
销毁：2.5 QFI
```

---

## 定时任务

### 每日释放任务

**执行时间**: 每天凌晨 1:00

**逻辑**:
1. 查询所有 `status = 'vesting'` 的标准模式订单
2. 计算每日释放量：`(总代币 × 0.8) / 90`
3. 从 `wallets.token_vesting` 转到 `wallets.token_balance`
4. 更新 `token_orders.tokens_released` 和 `tokens_pending`
5. 释放完成后标记订单 `status = 'completed'`

**代码位置**: `tokens.service.ts` → `processVesting()`

---

## 数据库表

### token_orders - 兑换订单表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 订单 ID |
| user_id | UUID | 用户 ID |
| points_spent | DECIMAL(18,8) | 消耗积分 |
| tokens_total | DECIMAL(18,8) | 总代币数 |
| exchange_rate | DECIMAL(18,8) | 兑换率（1000） |
| vesting_mode | VARCHAR(20) | 兑换模式 |
| tokens_released | DECIMAL(18,8) | 已释放代币 |
| tokens_pending | DECIMAL(18,8) | 待释放代币 |
| tokens_burned | DECIMAL(18,8) | 销毁代币 |
| vesting_start_at | TIMESTAMPTZ | 释放开始时间 |
| vesting_end_at | TIMESTAMPTZ | 释放结束时间 |
| last_release_at | TIMESTAMPTZ | 最后释放时间 |
| status | VARCHAR(20) | 订单状态（vesting/completed） |

---

### token_burns - 代币销毁表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 记录 ID |
| source_type | VARCHAR(30) | 来源类型（fast_exchange） |
| source_id | UUID | 来源订单 ID |
| amount | DECIMAL(18,8) | 销毁数量 |
| tx_hash | VARCHAR(100) | 链上交易哈希（可选） |
| burn_address | VARCHAR(100) | 销毁地址（黑洞） |
| created_at | TIMESTAMPTZ | 创建时间 |

---

### wallets - 钱包表（相关字段）

| 字段 | 类型 | 说明 |
|------|------|------|
| token_balance | DECIMAL(18,8) | 可用代币余额 |
| token_locked | DECIMAL(18,8) | 锁定代币余额（质押） |
| token_vesting | DECIMAL(18,8) | 待释放代币余额 |

---

## 测试

### 测试脚本

位置：`/Users/azu/主QuantFi/test-tokens-api.sh`

```bash
# 赋予执行权限
chmod +x test-tokens-api.sh

# 运行测试
./test-tokens-api.sh
```

### 验算脚本

位置：`/Users/azu/主QuantFi/scripts/验算/tokens-calculation.md`

---

## 安全要点

1. **资金计算**
   - 所有代币计算使用 `decimal.js`
   - 数据库字段 `DECIMAL(18,8)`
   - 禁止使用 JavaScript 原生浮点数运算

2. **事务保证**
   - 兑换操作使用 Prisma 事务
   - 确保积分扣除、代币增加原子性

3. **精度控制**
   - 最后一天释放：释放全部剩余代币（避免精度损失）
   - `Decimal.min()` 确保不超额释放

4. **幂等性**
   - 定时任务可重复执行（检查 `status` 和 `tokens_pending`）

---

## 错误码

| 错误码 | 说明 |
|-------|------|
| 40401 | 钱包不存在 |
| 40001 | 积分余额不足 |
| 40002 | 兑换积分少于 1000 |
| 40003 | 兑换模式非法 |

---

## 维护日志

- 2025-12-26: 初始版本完成（标准模式、急速模式、每日释放）
