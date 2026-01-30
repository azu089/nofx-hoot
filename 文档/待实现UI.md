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

## 优先级说明

- **P0 - 用户核心流程**：充值、提现、策略订阅（已完成）
- **P1 - 管理后台**：用户管理、提现审核、区块链监控（待实现）
- **P2 - 高级功能**：数据统计、报表导出（待规划）

---

## 更新记录

| 日期 | 更新内容 |
|------|---------|
| 2025-01-30 | 初始化列表，记录 Blockchain 模块缺失 UI |
