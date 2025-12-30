# Phase 3 钱的闭环功能验证文档

## 已实现功能

### 3.1 钱包基础完善
- ✅ 用户注册时自动创建钱包（auth.service.ts 已实现）
- ✅ 余额变更事务处理方法
  - `increaseBalance()` - 增加余额（充值审核通过）
  - `freezeBalance()` - 冻结余额（提现申请）
  - `unfreezeAndDeduct()` - 解冻并扣除（提现审核通过）
  - `unfreezeBalance()` - 解冻余额（提现被拒绝）
- ✅ 余额非负约束（扣款前检查）

### 3.2 充值功能（手动审核）
- ✅ `POST /api/deposits` - 用户申请充值
- ✅ `GET /api/deposits` - 用户查询自己的充值记录
- ✅ `GET /api/deposits/admin` - 管理员查看所有待审核充值
- ✅ `POST /api/deposits/admin/:id/review` - 管理员审核充值

### 3.3 提现功能
- ✅ `POST /api/withdrawals` - 用户申请提现
- ✅ `GET /api/withdrawals` - 用户查询自己的提现记录
- ✅ `GET /api/withdrawals/admin` - 管理员查看所有待审核提现
- ✅ `POST /api/withdrawals/admin/:id/review` - 管理员审核提现

## 技术实现细节

### 资金安全
- ✅ 所有金额使用 `Decimal.js` 计算
- ✅ 余额变更使用 Prisma 事务
- ✅ 充值/提现需审核通过才生效
- ✅ 提现申请时立即冻结余额，审核拒绝后自动解冻

### 审计日志
- ✅ 充值审核通过记录到 `billing_logs`
- ✅ 提现审核通过记录到 `billing_logs`
- ✅ 提现手续费单独记录到 `billing_logs`

### 手续费计算
- 提现手续费：1%
- 最低手续费：1 USDT

## 验证步骤

### 前提条件
1. 数据库和 Redis 运行中：`docker compose ps`
2. API 服务运行中：`cd apps/api && pnpm start:dev`

### 自动测试
```bash
cd /Users/azu/主QuantFi/apps/api
./test-deposits-withdrawals.sh
```

### 手动测试

#### 1. 注册用户
```bash
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

#### 2. 登录获取 Token
```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```
保存返回的 `accessToken`。

#### 3. 查询初始余额（应该为 0）
```bash
curl -X GET http://localhost:4000/api/wallets/balance \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### 4. 申请充值 100 USDT
```bash
curl -X POST http://localhost:4000/api/deposits \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 100,
    "method": "usdt_trc20",
    "chain": "TRC20",
    "fromAddress": "TTestAddress123",
    "txHash": "0xtest123456"
  }'
```
保存返回的 `id`。

#### 5. 管理员审核通过充值
```bash
curl -X POST http://localhost:4000/api/deposits/admin/{DEPOSIT_ID}/review \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "approved"
  }'
```

#### 6. 查询余额（应该变成 100）
```bash
curl -X GET http://localhost:4000/api/wallets/balance \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### 7. 申请提现 50 USDT
```bash
curl -X POST http://localhost:4000/api/withdrawals \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 50,
    "chain": "TRC20",
    "toAddress": "TWithdrawAddress456"
  }'
```
保存返回的 `id`。

#### 8. 查询余额（应该看到冻结金额）
```bash
curl -X GET http://localhost:4000/api/wallets/balance \
  -H "Authorization: Bearer YOUR_TOKEN"
```
预期：
- `available`: 约 49 USDT（100 - 50 - 1% 手续费）
- `frozen`: 约 51 USDT（50 + 1% 手续费）

#### 9. 管理员审核通过提现
```bash
curl -X POST http://localhost:4000/api/withdrawals/admin/{WITHDRAWAL_ID}/review \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "approved",
    "txHash": "0xwithdrawal123456"
  }'
```

#### 10. 查询最终余额
```bash
curl -X GET http://localhost:4000/api/wallets/balance \
  -H "Authorization: Bearer YOUR_TOKEN"
```
预期：
- `available`: 约 49 USDT
- `frozen`: 0 USDT

## 测试用例

### 正常路径
- ✅ 充值申请 → 审核通过 → 余额增加
- ✅ 提现申请 → 余额冻结 → 审核通过 → 冻结扣除

### 异常路径
- ✅ 提现金额大于可用余额 → 返回"余额不足"
- ✅ 充值审核拒绝 → 余额不变
- ✅ 提现审核拒绝 → 冻结金额解冻

### 边界路径
- ✅ 充值最低金额：10 USDT
- ✅ 提现最低金额：50 USDT
- ✅ 提现手续费最低：1 USDT

## 风险点

### 已处理
- ✅ 余额非负约束（扣款前检查）
- ✅ 事务保证原子性（充值/提现 + 余额变更）
- ✅ 审核幂等性（重复审核会报错）

### 待处理（后续阶段）
- ⚠️ 2FA 验证（提现时）
- ⚠️ 管理员权限校验（暂用 JWT）
- ⚠️ 实际支付对接（链上转账）
- ⚠️ 提现每日限额
- ⚠️ 风控规则（大额提现人工审核）

## 回滚方案

如需回滚本次变更：

```bash
# 1. 从 app.module.ts 移除新模块
# 移除这两行：
#   DepositsModule,
#   WithdrawalsModule,

# 2. 删除新增模块
rm -rf apps/api/src/modules/deposits
rm -rf apps/api/src/modules/withdrawals

# 3. 恢复 wallets.service.ts
git checkout apps/api/src/modules/wallets/wallets.service.ts

# 4. 重启服务
cd apps/api && pnpm start:dev
```

## 文件清单

### 新增文件
- `apps/api/src/modules/deposits/` - 充值模块
  - `deposits.module.ts`
  - `deposits.controller.ts`
  - `deposits.service.ts`
  - `dto/create-deposit.dto.ts`
  - `dto/deposit-response.dto.ts`

- `apps/api/src/modules/withdrawals/` - 提现模块
  - `withdrawals.module.ts`
  - `withdrawals.controller.ts`
  - `withdrawals.service.ts`
  - `dto/create-withdrawal.dto.ts`
  - `dto/withdrawal-response.dto.ts`

- `apps/api/test-deposits-withdrawals.sh` - 自动测试脚本

### 修改文件
- `apps/api/src/modules/wallets/wallets.service.ts` - 新增余额操作方法
- `apps/api/src/app.module.ts` - 引入新模块

## 下一步

Phase 4 将实现：
- VPS 实例管理
- 交易策略配置
- Freqtrade 对接
