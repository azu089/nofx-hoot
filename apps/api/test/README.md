# E2E 测试说明

## 安装依赖

E2E 测试需要安装 `supertest` 和 `@types/supertest`：

```bash
cd /Users/azu/主QuantFi/apps/api
npm install --save-dev supertest @types/supertest
```

或使用 pnpm：

```bash
cd /Users/azu/主QuantFi/apps/api
pnpm add -D supertest @types/supertest
```

## 测试文件

- `instances.e2e-spec.ts` - VPS 实例生命周期测试
- `billing.e2e-spec.ts` - 计费模块完整流程测试

## 运行测试

### 前置条件

1. **配置测试数据库**

创建 `.env.test` 文件：

```bash
# 数据库
DATABASE_HOST=localhost
DATABASE_PORT=5433
DATABASE_USER=quantfi_test
DATABASE_PASSWORD=test_password
DATABASE_NAME=quantfi_test

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_SECRET=test-secret-key
JWT_EXPIRES_IN=1d

# S3（可使用 LocalStack）
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
AWS_S3_BUCKET=quantfi-test

# DigitalOcean（Mock）
DO_API_KEY=test-key
```

2. **启动测试数据库**

```bash
# 使用 Docker 启动测试数据库
docker run -d \
  --name quantfi-test-db \
  -e POSTGRES_USER=quantfi_test \
  -e POSTGRES_PASSWORD=test_password \
  -e POSTGRES_DB=quantfi_test \
  -p 5433:5432 \
  postgres:15

# 或使用 docker-compose.test.yml（需创建）
docker compose -f docker-compose.test.yml up -d
```

3. **运行数据库迁移**

```bash
pnpm migration:run:test
```

### 运行测试

```bash
# 运行所有 E2E 测试
pnpm test:e2e

# 运行单个测试文件
pnpm test:e2e instances

# 运行并查看覆盖率
pnpm test:e2e:cov
```

### 清理测试数据

```bash
# 停止并删除测试数据库
docker stop quantfi-test-db
docker rm quantfi-test-db
```

## 测试覆盖范围

### instances.e2e-spec.ts

测试 VPS 实例的完整生命周期：

1. **创建实例**
   - 正常路径：余额充足 → 创建成功 → 扣费
   - 异常路径：余额不足 → 返回错误
   - 边界路径：未登录、无效 region

2. **获取实例状态**
   - 正常路径：返回详情
   - 异常路径：访问他人实例 → 403
   - 边界路径：实例不存在 → 404

3. **获取实例列表**
   - 正常路径：返回列表
   - 边界路径：分页查询

4. **实例心跳**
   - 正常路径：更新时间戳
   - 异常路径：已销毁实例

5. **启动策略**
   - 正常路径：状态变为 running
   - 异常路径：实例未就绪
   - 边界路径：缺少参数

6. **停止策略**
   - 正常路径：状态变为 stopped
   - 异常路径：实例未运行

7. **销毁实例**
   - 正常路径：S3 备份 → destroyed
   - 异常路径：重复销毁

8. **完整生命周期**
   - 创建 → 启动 → 停止 → 销毁

9. **并发安全**
   - 多个心跳请求
   - 并发创建实例（余额检查）

### billing.e2e-spec.ts

测试计费模块完整流程：

1. **充值流程**
   - ✅ 创建充值申请（正常路径）
   - ✅ 创建充值申请（参数错误）
   - ✅ 管理员审核通过 → 余额增加
   - ✅ 幂等性检查（重复审核失败）

2. **扣费流程**
   - ✅ VPS 订阅扣费（25 USDT）
   - ✅ VPS 订阅扣费（余额不足）
   - ✅ 燃油费抽成（盈利交易 20%）
   - ✅ 燃油费抽成（亏损交易跳过）
   - ✅ 燃油费幂等性检查

3. **查询接口**
   - ✅ 获取今日盈亏统计
   - ✅ 获取计费日志（全部）
   - ✅ 获取计费日志（按类型筛选）
   - ✅ 获取收益曲线（30 天）

4. **欠费处理**
   - ✅ 余额不足时燃油费记为欠费（status: pending）

5. **按实例分组**
   - ✅ 获取按实例分组的盈亏统计

#### 验算公式

**充值**
```
新余额 = 原余额 + 充值金额
```

**VPS 订阅扣费**
```
新余额 = 原余额 - 订阅费（25 USDT）
```

**燃油费抽成**
```
燃油费 = 盈利 * 20%
新余额 = 原余额 - 燃油费（余额足够时）
```

容忍误差：**0**（必须精确匹配）

#### 测试数据清理

测试会自动创建和清理测试用户：

- 测试用户：`test-billing@example.com`
- 管理员：`admin-billing@example.com`

测试结束后会自动删除所有相关数据。

## Mock 外部服务

测试中需要 Mock 的服务：

1. **DigitalOcean API**
   - createDroplet
   - destroyDroplet
   - getDroplet

2. **S3**
   - uploadBackup
   - 可使用 LocalStack

3. **Freqtrade API**
   - startStrategy
   - stopStrategy

## 注意事项

1. 测试默认使用 `describe.skip`，需要手动启用
2. 测试会清理数据，不要在生产数据库运行
3. 测试需要真实的 PostgreSQL 连接
4. 建议使用独立的测试数据库

### gamefi.e2e-spec.ts

测试 GameFi 模块完整流程：

1. **概览接口**
   - ✅ 获取 GameFi 概览数据
   - ✅ 未登录返回 401

2. **积分系统**
   - ✅ 获取积分余额
   - ✅ 获取积分历史记录
   - ✅ 分页查询

3. **质押系统**
   - ✅ 创建 A 类质押（权重 1.0x）
   - ✅ 创建 B 类质押（权重计算验证）
   - ✅ 获取质押列表
   - ✅ 获取质押统计
   - ✅ 解除质押
   - ✅ 余额不足失败

4. **代币兑换**
   - ✅ 标准模式（20%立即+80%释放）
   - ✅ 急速模式（50%立即+50%销毁）
   - ✅ 获取释放进度
   - ✅ 积分不足失败

5. **排行榜**
   - ✅ 获取排行榜数据
   - ✅ 时间范围筛选
   - ✅ 分页查询

6. **领取收益**
   - ✅ 领取质押收益
   - ✅ 无收益时返回 0

#### 验算公式

**质押权重**
```
A 类权重 = 1.0x
B 类权重 = 1.0 + (锁定天数 / 180)，最高 3.0x
```

**代币兑换**
```
标准模式：立即释放 = 积分 * 20%，释放计划 = 积分 * 80%
急速模式：立即释放 = 积分 * 50%，销毁 = 积分 * 50%
```

### agents.e2e-spec.ts

测试代理商模块完整流程：

1. **代理商资料**
   - ✅ 获取代理商资料
   - ✅ 未登录返回 401

2. **邀请码管理**
   - ✅ 生成邀请码
   - ✅ 获取现有邀请码

3. **邀请绑定**
   - ✅ 绑定邀请码
   - ✅ 重复绑定失败
   - ✅ 无效邀请码失败

4. **下级管理**
   - ✅ 获取下级用户列表
   - ✅ 分页查询

5. **概览数据**
   - ✅ 获取代理商概览

6. **佣金系统**
   - ✅ 获取佣金记录
   - ✅ 获取统计数据

7. **佣金提现**
   - ✅ 发起提现
   - ✅ 余额不足失败
   - ✅ 金额为负失败

8. **返佣验算**
   - ✅ 直推返佣率 15%

#### 返佣公式

```
直推返佣 = 下级交易盈利 * 15%
间推返佣 = 下下级交易盈利 * 5%
```

## TODO

- [x] 添加 GameFi E2E 测试
- [x] 添加代理商 E2E 测试
- [ ] 添加 docker-compose.test.yml 配置
- [ ] 添加 LocalStack 配置（S3 Mock）
- [ ] 添加 DigitalOcean API Mock
- [ ] 添加测试数据库迁移脚本
- [ ] 添加 CI/CD 集成
