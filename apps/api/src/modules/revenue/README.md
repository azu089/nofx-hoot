# Revenue 收入分配模块

## 功能概述

实现 QuantFi 平台收入分配飞轮：
- **40%** 运营费用（团队/服务器/营销）
- **40%** DEX 回购 $QFI 代币
- **20%** 风险储备金

回购后的 $QFI 代币分配：
- **50%** 销毁（通缩机制）
- **50%** 分配给质押者

---

## 目录结构

```
revenue/
├── revenue.module.ts          # 模块定义
├── revenue.service.ts         # 业务逻辑
├── revenue.controller.ts      # HTTP 接口
├── dto/
│   ├── revenue-response.dto.ts
│   └── distribution-history.dto.ts
└── README.md                  # 本文档
```

---

## API 接口

### 1. 获取当前周期收入

```bash
GET /api/revenue/current
```

**响应：**
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "periodStart": "2024-01-01T00:00:00Z",
    "periodEnd": "2024-02-01T00:00:00Z",
    "currentRevenue": "12345.67890000",
    "projectedDistribution": {
      "operations": "4938.27156000",
      "buyback": "4938.27156000",
      "reserve": "2469.13578000"
    }
  }
}
```

---

### 2. 获取分配历史

```bash
GET /api/revenue/history?page=1&limit=10&status=completed
```

**参数：**
- `page` - 页码（默认 1）
- `limit` - 每页数量（默认 10）
- `status` - 状态筛选（可选）

**响应：**
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "data": [ ... ],
    "total": 100,
    "page": 1,
    "limit": 10,
    "totalPages": 10
  }
}
```

---

### 3. 执行收入分配（管理员）

```bash
POST /api/revenue/distribute
Content-Type: application/json

{
  "periodStart": "2024-01-01T00:00:00Z",
  "periodEnd": "2024-02-01T00:00:00Z"
}
```

**权限：** 管理员

**响应：**
```json
{
  "code": 0,
  "message": "分配成功",
  "data": {
    "id": "uuid",
    "period_start": "2024-01-01T00:00:00Z",
    "period_end": "2024-02-01T00:00:00Z",
    "total_revenue": "10000.00000000",
    "operations_amount": "4000.00000000",
    "buyback_amount": "4000.00000000",
    "reserve_amount": "2000.00000000",
    "status": "pending"
  }
}
```

---

### 4. 获取统计数据

```bash
GET /api/revenue/stats
```

**响应：**
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "totalRevenue": "123456.78900000",
    "totalBuyback": "49382.71560000",
    "totalBurned": "24691.35780000",
    "totalDistributed": "24691.35780000",
    "distributionCount": 12
  }
}
```

---

### 5. 模拟回购（沙盒）

```bash
POST /api/revenue/simulate-buyback
Content-Type: application/json

{
  "amount": "1000.00000000"
}
```

**响应：**
```json
{
  "code": 0,
  "message": "模拟成功",
  "data": {
    "tokensBought": "10000.00000000",
    "tokensBurned": "5000.00000000",
    "tokensDistributed": "5000.00000000"
  }
}
```

---

## 数据表

### revenue_distributions

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| period_start | TIMESTAMP | 周期开始 |
| period_end | TIMESTAMP | 周期结束 |
| total_revenue | DECIMAL(18,8) | 总收入 |
| operations_amount | DECIMAL(18,8) | 运营费用 40% |
| buyback_amount | DECIMAL(18,8) | 回购费用 40% |
| reserve_amount | DECIMAL(18,8) | 储备金 20% |
| tokens_bought | DECIMAL(18,8) | 回购代币数 |
| tokens_burned | DECIMAL(18,8) | 销毁代币数 |
| tokens_distributed | DECIMAL(18,8) | 分配代币数 |
| buyback_executed | BOOLEAN | 是否已回购 |
| buyback_tx_hash | VARCHAR | DEX 交易哈希 |
| status | VARCHAR | pending/processing/completed |

---

## 验算公式

### 分配验算

```
operations_amount + buyback_amount + reserve_amount = total_revenue

验证：
4000 + 4000 + 2000 = 10000 ✅
```

### 回购验算

```
tokens_burned + tokens_distributed = tokens_bought

验证：
5000 + 5000 = 10000 ✅
```

---

## 测试

### 验收测试

```bash
# 执行验收测试脚本
./test-revenue.sh
```

### 验算测试

```bash
# 执行验算脚本（需要 Node.js）
node scripts/verify-revenue-distribution.js
```

---

## 注意事项

### 资金安全

1. 所有金额使用 `DECIMAL(18,8)` 类型
2. 计算使用 `Decimal.js` 保证精度
3. 分配操作必须在事务中执行
4. 分配前验算总和 = 总收入

### 回购限制

1. V1 阶段使用沙盒模拟回购
2. 实际回购需对接 DEX（V2）
3. 回购价格从 DEX 获取（目前使用固定价格 1 QFI = 0.1 USDT）

### 权限控制

1. `POST /api/revenue/distribute` 仅管理员可用
2. 需添加 `@UseGuards(AdminGuard)`（TODO）

---

## 依赖

- `decimal.js` - 资金精确计算
- `pg` - PostgreSQL 数据库

---

## 待办

- [ ] 添加管理员权限守卫
- [ ] 对接真实 DEX 回购（V2）
- [ ] 实现代币销毁上链（V2）
- [ ] 实现质押者分配逻辑
- [ ] 添加定时任务（每月自动分配）
