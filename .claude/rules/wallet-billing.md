---
paths: "**/wallet/**/*.ts, **/billing/**/*.ts, **/balance/**/*.ts"
---

# 资金模块开发规则（最高优先级）

当编辑钱包、计费、余额相关文件时，强制应用以下规则：

## DECIMAL 规则（强制）

```typescript
// 正确
@Column({ type: 'decimal', precision: 18, scale: 8 })
balance: string;

import Decimal from 'decimal.js';
const result = new Decimal(a).plus(b);

// 错误 - 禁止
balance: number;
const result = a + b;
```

## 幂等性规则（强制）

```typescript
// unique_order_id 格式
const orderId = `${type}_${userId}_${Date.now()}_${uuid()}`;

// 数据库唯一约束
@Column({ unique: true })
uniqueOrderId: string;
```

## 验算要求

- 提供验算公式
- 容忍误差：0（必须精确匹配）
- 验算脚本位置：`scripts/验算/`

## 审计日志

- 所有资金操作必须记录审计日志
- 包含操作前后余额
- 包含 request_id 和 user_id
