---
name: database
description: 数据库技能。用户说"设计表"、"数据库结构"、"建表"、"SQL"、"数据模型"时自动触发。设计数据库 Schema，编写迁移。
allowed-tools: Read, Edit, Write, Glob, Grep, Bash
---

# 数据库技能

你是数据库专家，负责设计数据模型和编写 SQL。

## QuantFi 数据库规范

### 表命名
- 使用 snake_case
- 表名用复数：`users`, `orders`, `transactions`
- 关联表：`user_roles`, `order_items`

### 字段命名
```sql
-- 必备审计字段
id           UUID PRIMARY KEY DEFAULT gen_random_uuid()
created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
updated_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW()

-- 软删除
deleted_at   TIMESTAMP WITH TIME ZONE

-- 外键命名
user_id      UUID REFERENCES users(id)
```

### 资金字段（强制）
```sql
-- 必须使用 DECIMAL(18,8)
balance      DECIMAL(18, 8) NOT NULL DEFAULT 0
amount       DECIMAL(18, 8) NOT NULL

-- 禁止使用 FLOAT/DOUBLE
-- 禁止使用 INTEGER 存储分为单位
```

### 索引规范
```sql
-- 主键自动有索引
-- 外键需要手动加索引
CREATE INDEX idx_orders_user_id ON orders(user_id);

-- 常用查询字段加索引
CREATE INDEX idx_users_email ON users(email);

-- 唯一约束
CREATE UNIQUE INDEX idx_users_email_unique ON users(email);
```

## Entity 模板（TypeORM）

```typescript
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  // 资金字段使用 decimal，返回 string
  @Column({ type: 'decimal', precision: 18, scale: 8, default: 0 })
  balance: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date;
}
```

## 常用 SQL 模板

### 分页查询
```sql
SELECT * FROM users
WHERE deleted_at IS NULL
ORDER BY created_at DESC
LIMIT $1 OFFSET $2;
```

### 聚合统计
```sql
SELECT
  DATE(created_at) as date,
  COUNT(*) as count,
  SUM(amount) as total
FROM transactions
WHERE created_at >= $1
GROUP BY DATE(created_at)
ORDER BY date;
```

### 事务处理
```typescript
await dataSource.transaction(async (manager) => {
  // 扣款
  await manager.decrement(User, { id: userId }, 'balance', amount);
  // 记录流水
  await manager.insert(Transaction, { userId, amount, type: 'debit' });
});
```

## 迁移规范

```bash
# 生成迁移
pnpm typeorm migration:generate -n CreateUsersTable

# 运行迁移
pnpm typeorm migration:run

# 回滚迁移
pnpm typeorm migration:revert
```
