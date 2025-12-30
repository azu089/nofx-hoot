# 质押模块 (StakingModule)

## 功能概述

双轨质押系统，支持 A 类（灵活）和 B 类（锁定）质押。

### 质押类型

| 类型 | 锁定期 | 权重 | 提前解押惩罚 | 适用场景 |
|------|--------|------|-------------|----------|
| **A 类** | 无 | 固定 1.0x | 无 | 短期资金周转 |
| **B 类** | 自定义（如 180 天） | 1.0x - 3.0x（随时间递增） | 20% | 长期质押获取更高收益 |

### 权重计算公式（B 类）

```
weight = min(1.0 + (已质押天数 / 180), 3.0)
```

- 第 0 天：1.0x
- 第 90 天：1.5x
- 第 180 天及以上：3.0x（最高）

---

## API 接口

### 1. 质押

```http
POST /api/staking/stake
Content-Type: application/json

{
  "amount": "1000.00000000",
  "stake_type": "A",  // 或 "B"
  "lock_days": 0      // B 类必填，A 类可选（自动为 0）
}
```

**响应：**

```json
{
  "code": 0,
  "message": "质押成功",
  "data": {
    "id": "uuid",
    "stake_type": "A",
    "amount": "1000.00000000",
    "start_time": "2025-12-26T06:00:00.000Z",
    "lock_period_days": 0,
    "end_time": "2025-12-26T06:00:00.000Z",
    "weight_multiplier": "1.00",
    "accumulated_reward": "0.00000000",
    "status": "active",
    "can_unstake": true,
    "created_at": "2025-12-26T06:00:00.000Z"
  }
}
```

---

### 2. 解押

```http
POST /api/staking/unstake/:id
```

**响应：**

```json
{
  "code": 0,
  "message": "解押成功",
  "data": {
    "stake": {
      "id": "uuid",
      "status": "unstaked",
      "penalty_amount": "0.00000000"  // A 类无惩罚，B 类提前解押为 20%
    },
    "penalty": "0.00000000"
  }
}
```

---

### 3. 查询质押列表

```http
GET /api/staking/list
```

**响应：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "stakes": [
      {
        "id": "uuid",
        "stake_type": "A",
        "amount": "1000.00000000",
        "weight_multiplier": "1.00",
        "accumulated_reward": "0.00000000",
        "status": "active",
        "can_unstake": true,
        "early_penalty": null
      }
    ],
    "total_staked": "1000.00000000",
    "total_reward": "0.00000000"
  }
}
```

---

### 4. 获取收益统计

```http
GET /api/staking/rewards
```

**响应：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "total_accumulated": "0.00000000",
    "claimable": "0.00000000",
    "claimed": "0.00000000",
    "staked_amount": "1000.00000000",
    "average_weight": "1.00"
  }
}
```

---

### 5. 领取收益

```http
POST /api/staking/claim
```

**响应：**

```json
{
  "code": 0,
  "message": "领取成功",
  "data": {
    "amount": "0.00000000"
  }
}
```

> **注意：** 收益分配逻辑暂未实现，当前返回占位符。

---

## 数据流

### 质押流程

1. 用户提交质押请求（金额 + 类型 + 锁定天数）
2. 检查钱包 `token_balance` 是否足够
3. 扣除 `token_balance`，增加 `token_locked`
4. 创建 `stakes` 记录（状态：active）
5. 返回质押记录

### 解押流程

1. 用户提交解押请求（质押记录 ID）
2. 检查质押记录状态（必须为 active）
3. 判断是否提前解押（B 类）
   - 是：计算 20% 惩罚金额
   - 否：无惩罚
4. 更新钱包：
   - `token_locked` 减少（质押金额）
   - `token_balance` 增加（质押金额 - 惩罚）
5. 更新质押记录状态为 `unstaked`

---

## 测试

### 运行测试脚本

```bash
cd /Users/azu/主QuantFi/apps/api
./test-staking.sh
```

### 测试用例

| 测试项 | 说明 | 预期结果 |
|--------|------|----------|
| A 类质押 | 质押 1000 Token | 成功，权重 1.0x |
| B 类质押 | 质押 2000 Token，锁定 180 天 | 成功，权重 1.0x（初始） |
| A 类解押 | 立即解押 | 成功，无惩罚 |
| B 类提前解押 | 未满 180 天解押 | 成功，扣除 20% 惩罚 |
| 余额不足 | 质押金额超过余额 | 失败，返回错误 |

---

## 待实现功能

- [ ] 收益分配逻辑（calculateRewards 定时任务）
- [ ] 领取收益功能（claimRewards）
- [ ] 质押权重实时更新（定时任务）
- [ ] 集成 JWT 认证（当前使用 mock-user-id）
- [ ] 事件推送（WebSocket）
- [ ] 质押挖矿奖励池

---

## 依赖模块

- `PrismaModule` - 数据库操作
- `WalletsModule` - 钱包服务
- `decimal.js` - 精确计算

---

## 安全规则

1. 所有金额计算使用 `Decimal.js`，禁止 JavaScript 原生运算
2. 质押/解押操作必须使用事务
3. 钱包余额验证在事务内部进行
4. B 类提前解押惩罚金额固定为 20%
5. 解押后更新 `wallets.token_balance`
