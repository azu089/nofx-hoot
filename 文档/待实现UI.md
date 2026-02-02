# 待实现 UI 列表

> 记录后端已实现但前端缺失 UI 的功能，防止功能上线后用户看不到

---

## 区块链模块（Blockchain）

| 后端接口 | 方法 | 前端页面 | 状态 | 备注 |
|---------|------|---------|------|------|
| /blockchain/status | GET | /admin/blockchain | ❌ 缺失 | 区块链监听状态查看 |
| /blockchain/block-number | GET | /admin/blockchain | ❌ 缺失 | 当前区块高度 |
| /blockchain/scan | POST | /admin/blockchain | ❌ 缺失 | 历史区块扫描 |
| /blockchain/start | POST | /admin/blockchain | ❌ 缺失 | 启动监听 |
| /blockchain/stop | POST | /admin/blockchain | ❌ 缺失 | 停止监听 |
| /blockchain/withdraw-wallet/balance | GET | /admin/withdraws | ❌ 缺失 | 提现钱包余额 |
| /blockchain/withdraw/:id/execute | POST | /admin/withdraws | ❌ 缺失 | 执行单个提现 |
| /blockchain/withdraw/batch-execute | POST | /admin/withdraws | ❌ 缺失 | 批量执行提现 |

---

## 管理后台模块（Admin）

| 后端接口 | 方法 | 前端页面 | 状态 | 备注 |
|---------|------|---------|------|------|
| /admin/users | GET | /admin/users | ❌ 缺失 | 用户列表管理 |
| /admin/strategies | GET | /admin/strategies | ❌ 缺失 | 策略审核管理 |
| /admin/withdraws | GET | /admin/withdraws | ❌ 缺失 | 提现审核列表 |
| /admin/withdraws/:id/approve | POST | /admin/withdraws | ❌ 缺失 | 审批提现 |
| /admin/withdraws/:id/reject | POST | /admin/withdraws | ❌ 缺失 | 拒绝提现 |

---

## 交易模块（Trading）

| 后端接口 | 方法 | 前端页面 | 状态 | 备注 |
|---------|------|---------|------|------|
| /positions | GET | /trading | ✅ 已接入 | 持仓列表（部分字段缺失） |
| /positions/:id/close | POST | /trading | ✅ 已接入 | 手动平仓 |
| /positions/open | GET | /trading | ⚠️ 未使用 | 仅获取活跃持仓 |

### 后端 API 字段缺失问题

| 字段 | 前端需求 | 后端当前状态 | 影响 |
|-----|---------|------------|------|
| strategyId | 策略 ID | ❌ 缺失 | 无法关联到具体策略 |
| strategyName | 策略名称 | ❌ 缺失 | 只能用交易所名称代替 |
| currentPrice | 当前价格 | ❌ 未计算 | 无法显示实时浮动盈亏 |
| pnlPercent | PnL 百分比 | ❌ 未计算 | 无法显示收益率 |
| liquidationPrice | 强平价格 | ❌ 缺失 | 无法显示风险警告 |
| stopLoss | 止损价 | ❌ 缺失 | 无法显示风控设置 |
| takeProfit | 止盈价 | ❌ 缺失 | 无法显示风控设置 |
| marketType | 市场类型 | ❌ 缺失 | 无法区分现货/合约 |

**需要后端补充以上字段，以提供完整的持仓信息展示。**

---

## 用户端已实现

| 后端接口 | 方法 | 前端页面 | 状态 | 备注 |
|---------|------|---------|------|------|
| /auth/register | POST | /register | ✅ 已有 | 注册页 |
| /auth/login | POST | /login | ✅ 已有 | 登录页 |
| /wallet/balance | GET | /wallet | ✅ 已有 | 钱包余额 |
| /wallet/deposit-address | GET | /wallet/deposit | ✅ 已有 | 充值地址 |
| /wallet/withdraw | POST | /wallet/withdraw | ✅ 已有 | 提现申请 |
| /strategies | GET | /strategies | ✅ 已有 | 策略市场 |
| /dashboard | GET | /dashboard | ✅ 已有 | 仪表盘 |

---

## 生态模块（Ecosystem）- 后续改进

| 功能 | 类型 | 当前状态 | 后续计划 | 优先级 |
|------|------|---------|---------|--------|
| 空投管理页面 | 管理后台 | ✅ 已实现 | - | 已完成 |
| 空投分页验证 | 测试 | ⚠️ 待验证 | 添加更多测试数据验证分页功能 | P2 |
| 空投链上查看 | 链上集成 | 📋 已规划 | 部署 Vesting 合约后添加「查看合约」链接 | P3 |
| 空投批量发放 | 管理后台 | ❌ 未实现 | 后期按需添加批量导入/发放功能 | P3 |
| 空投数据导出 | 管理后台 | ❌ 未实现 | 添加 CSV/Excel 导出功能 | P3 |

### 链上升级路径（详见 文档/核心文档/HOOT生态规划.md）

- **阶段1（当前）**：链下数据库管理，释放数据从数据库读取
- **阶段2（未来）**：部署 Vesting 合约到 TON/BSC，UI 添加「查看链上合约」链接
- **升级触发条件**：环境变量 `VESTING_CONTRACT_ADDRESS` 配置后启用

---

## 优先级说明

- **P0 - 用户核心流程**：充值、提现、策略订阅（已完成）
- **P1 - 管理后台**：用户管理、提现审核、区块链监控（待实现）
- **P2 - 高级功能**：数据统计、报表导出、分页验证（待规划）
- **P3 - 远期功能**：链上集成、批量操作、数据导出（待规划）

---

## 更新记录

| 日期 | 更新内容 |
|------|---------|
| 2026-02-02 | 添加生态模块（Ecosystem）后续改进计划，记录空投链上升级路径 |
| 2026-02-01 | 添加交易模块（Trading）字段缺失问题记录 |
| 2025-01-30 | 初始化列表，记录 Blockchain 模块缺失 UI |
