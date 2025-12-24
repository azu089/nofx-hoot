---
name: testing
description: 测试技能。编写测试用例、运行测试、检查测试覆盖率时自动采用。确保正常/异常/边界三条路径覆盖。
allowed-tools: Read, Edit, Write, Glob, Grep, Bash
---

# 测试技能

你是测试专家，负责编写和运行测试用例。

## 测试用例最小集（强制）

每个原子任务至少提供 3 条测试用例：

| 类型 | 说明 | 示例 |
|------|------|------|
| 正常路径 | 成功场景 | 正确密码登录成功 |
| 异常路径 | 输入非法/权限不足 | 错误密码登录失败 |
| 边界路径 | 空值/极值/超时 | 空密码返回参数错误 |

## 单元测试模板

```typescript
describe('UserService', () => {
  let service: UserService;

  beforeEach(async () => {
    // 初始化
  });

  describe('createUser', () => {
    // 正常路径
    it('should create user with valid data', async () => {
      const result = await service.createUser(validData);
      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
    });

    // 异常路径
    it('should throw error when email exists', async () => {
      await expect(service.createUser(existingEmail))
        .rejects.toThrow('邮箱已存在');
    });

    // 边界路径
    it('should throw error when email is empty', async () => {
      await expect(service.createUser({ email: '' }))
        .rejects.toThrow('邮箱不能为空');
    });
  });
});
```

## 资金相关测试（特殊要求）

涉及资金/结算/计费，必须补充验算用例：

```typescript
describe('WalletService - 资金验算', () => {
  it('should calculate balance correctly', async () => {
    const initial = new Decimal('100.00000000');
    const deposit = new Decimal('50.00000000');

    const result = await service.deposit(userId, deposit.toString());

    // 验算：新余额 = 原余额 + 充值金额
    const expected = initial.plus(deposit);
    expect(result.balance).toBe(expected.toString());
  });
});

describe('BillingService - 幂等性', () => {
  it('should not charge twice with same order_id', async () => {
    const orderId = 'subscription_user1_1234567890_abc123';

    await service.charge(orderId, '25.00000000');

    // 重复扣费应失败
    await expect(service.charge(orderId, '25.00000000'))
      .rejects.toThrow('订单已处理');
  });
});
```

## 测试覆盖率要求

| 模块 | 最低覆盖率 |
|------|-----------|
| 资金相关 | 90% |
| 认证授权 | 80% |
| 核心业务 | 70% |
| 工具函数 | 60% |

## 运行命令

```bash
pnpm test           # 运行所有测试
pnpm test:unit      # 运行单元测试
pnpm test:e2e       # 运行 E2E 测试
pnpm test:cov       # 查看覆盖率
```
