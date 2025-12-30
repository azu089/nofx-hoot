# E2E 测试快速开始

## 一键安装依赖

```bash
cd /Users/azu/主QuantFi/apps/api
pnpm add -D supertest @types/supertest
```

## 启用测试

打开测试文件，将 `describe.skip` 改为 `describe`：

```typescript
// 修改前
describe.skip('Billing (e2e)', () => {

// 修改后
describe('Billing (e2e)', () => {
```

## 快速运行

```bash
# 1. 确保数据库运行中
docker compose ps

# 2. 运行测试
pnpm test test/billing.e2e-spec.ts
```

## 预期输出

```
PASS test/billing.e2e-spec.ts
  Billing (e2e)
    充值流程
      ✓ 创建充值申请 - 成功 (100ms)
      ✓ 创建充值申请 - 金额格式错误 (50ms)
      ✓ 管理员审核通过 - 余额增加 (150ms)
      ✓ 管理员审核通过 - 幂等性检查 (80ms)
    扣费流程
      ✓ VPS 订阅扣费 - 成功 (200ms)
      ✓ VPS 订阅扣费 - 余额不足 (100ms)
      ✓ 燃油费抽成 - 盈利交易 (120ms)
      ✓ 燃油费抽成 - 亏损交易跳过 (80ms)
      ✓ 燃油费抽成 - 幂等性检查 (60ms)
    查询接口
      ✓ 获取今日盈亏 - 成功 (90ms)
      ✓ 获取计费日志 - 全部 (70ms)
      ✓ 获取计费日志 - 按类型筛选 (80ms)
      ✓ 获取收益曲线 - 30 天 (110ms)
    欠费处理
      ✓ 余额不足时燃油费记为欠费 (130ms)
    按实例分组盈亏
      ✓ 获取按实例分组的盈亏统计 (100ms)

Tests: 15 passed, 15 total
```

## 注意事项

1. **数据库要求**：需要真实 PostgreSQL 数据库连接
2. **数据清理**：测试会自动清理数据，不会影响其他数据
3. **Mock 服务**：部分测试需要 mock DigitalOcean API（已在代码中处理）
4. **测试时间**：完整测试大约需要 2-3 分钟

## 故障排查

### 问题：supertest 未安装

**错误信息**：
```
Cannot find module 'supertest'
```

**解决方案**：
```bash
pnpm add -D supertest @types/supertest
```

### 问题：数据库连接失败

**错误信息**：
```
Error: connect ECONNREFUSED 127.0.0.1:5433
```

**解决方案**：
```bash
# 检查数据库是否运行
docker compose ps

# 如果未运行，启动服务
docker compose up -d
```

### 问题：表不存在

**错误信息**：
```
relation "users" does not exist
```

**解决方案**：
```bash
# 运行数据库迁移
pnpm migration:run
```

### 问题：端口冲突

**错误信息**：
```
Port 5433 is already in use
```

**解决方案**：
```bash
# 查看占用端口的进程
lsof -i :5433

# 停止现有服务
docker compose down
```

## 验算示例

### 充值验算

```typescript
// 原余额：0 USDT
// 充值金额：100 USDT
// 预期新余额：100 USDT
const balanceBefore = new Decimal('0');
const depositAmount = new Decimal('100.00000000');
const expectedBalance = balanceBefore.plus(depositAmount);
// expectedBalance = 100.00000000
```

### VPS 订阅扣费验算

```typescript
// 原余额：100 USDT
// 订阅费：25 USDT
// 预期新余额：75 USDT
const balanceBefore = new Decimal('100.00000000');
const subscriptionFee = new Decimal('25.00000000');
const expectedBalance = balanceBefore.minus(subscriptionFee);
// expectedBalance = 75.00000000
```

### 燃油费验算

```typescript
// 盈利：100 USDT
// 燃油费率：20%
// 预期燃油费：20 USDT
const pnl = new Decimal('100.00000000');
const gasFeeRate = new Decimal('0.20');
const expectedGasFee = pnl.times(gasFeeRate);
// expectedGasFee = 20.00000000
```

## 相关文件

- `/test/billing.e2e-spec.ts` - 测试代码
- `/test/README.md` - 完整测试文档
- `/src/modules/billing/billing.service.ts` - 计费服务实现
- `/src/modules/deposits/deposits.service.ts` - 充值服务实现
