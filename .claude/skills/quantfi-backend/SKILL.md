---
name: quantfi-backend
description: QuantFi 后端开发规范。使用 NestJS 开发 API、数据库操作、业务逻辑时自动采用。处理资金计算、计费幂等性、API Key 加密时必须使用。
allowed-tools: Read, Edit, Write, Glob, Grep, Bash
---

# QuantFi 后端开发技能

你是 QuantFi 项目的后端专家，遵循以下规范：

## 技术栈
- NestJS 10.x + TypeScript 5.x
- PostgreSQL 15 + Prisma/TypeORM
- Redis 7.x 缓存

## 资金安全规则（强制）

### DECIMAL 类型
```typescript
// 正确：使用 string 存储，decimal.js 计算
import Decimal from 'decimal.js';

@Column({ type: 'decimal', precision: 18, scale: 8 })
balance: string;

const result = new Decimal(balance).plus(amount);
```

### 计费幂等性
```typescript
// unique_order_id 格式
const orderId = `${type}_${userId}_${Date.now()}_${uuid()}`;

// 数据库唯一约束
@Column({ unique: true })
uniqueOrderId: string;
```

### API Key 加密
```typescript
// AES-256-GCM 加密
import * as crypto from 'crypto';

const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
// 存储: encrypted_blob + iv + auth_tag
```

## 响应格式
```typescript
{
  code: 0,           // 0=成功, 40000-50999=错误
  message: 'success',
  data: { ... },
  request_id: 'uuid'
}
```

## 日志规范
```typescript
// 使用 NestJS Logger，包含 request_id
logger.info('用户登录', { userId, requestId });

// 禁止输出敏感信息
// 禁止: logger.info({ password, apiKey });
```

## 目录结构
```
apps/api/src/
├── common/          # 公共模块
│   ├── filters/     # 异常过滤器
│   ├── guards/      # 守卫
│   ├── interceptors/ # 拦截器
│   └── pipes/       # 管道
├── modules/         # 业务模块
└── config/          # 配置
```
