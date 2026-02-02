# HOOT 管理后台目录结构

## 整体架构

```
apps/admin/
├── src/
│   ├── main.tsx                    # 应用入口
│   ├── App.tsx                     # 路由配置 + Provider
│   ├── vite-env.d.ts              # Vite 类型声明
│   │
│   ├── components/                 # 全局公共组件
│   │   ├── Layout.tsx             # 管理后台布局（侧边栏+Header）
│   │   └── Header.tsx             # 顶部导航栏
│   │
│   ├── contexts/                   # React Context
│   │   └── AuthContext.tsx        # 管理员认证上下文
│   │
│   ├── lib/                        # 工具库
│   │   └── api.ts                 # API 请求封装
│   │
│   ├── styles/                     # 全局样式
│   │   └── global.css
│   │
│   └── pages/                      # 页面模块
│       ├── index.ts               # 统一导出
│       └── [模块]/                # 各功能模块
│
├── public/                         # 静态资源
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

---

## 页面模块结构

### 1. 登录模块
```
pages/login/
└── index.tsx                      # 管理员登录页
```
**路由**: `/login`

---

### 2. 数据看板
```
pages/dashboard/
└── index.tsx                      # 数据概览仪表盘
```
**路由**: `/`

---

### 3. 用户管理
```
pages/users/
├── list.tsx                       # 用户列表
├── show.tsx                       # 用户详情
└── edit.tsx                       # 用户编辑
```
**路由**: `/users`, `/users/:id`, `/users/:id/edit`

---

### 4. 策略管理
```
pages/strategies/
├── list.tsx                       # 策略列表
├── show.tsx                       # 策略详情
├── edit.tsx                       # 策略编辑
└── create.tsx                     # 创建策略
```
**路由**: `/strategies`, `/strategies/:id`, `/strategies/:id/edit`, `/strategies/create`

---

### 5. 交易中心
```
pages/trading/
├── orders.tsx                     # 订单管理
└── positions.tsx                  # 持仓管理
```
**路由**: `/trading/orders`, `/trading/positions`

---

### 6. 信号监控
```
pages/signals/
├── index.tsx                      # 信号监控
└── kill-switch.tsx                # 紧急开关
```
**路由**: `/trading/signals`, `/trading/kill-switch`

---

### 7. 风控管理
```
pages/risk/
└── index.tsx                      # 风控设置
```
**路由**: `/trading/risk`

---

### 8. 财务中心
```
pages/finance/
├── index.tsx                      # 财务概览
├── bills.tsx                      # 账单记录
├── deposits.tsx                   # 充值记录
├── withdrawals.tsx                # 提现审核
└── reports.tsx                    # 财务报表
```
**路由**: `/finance`, `/finance/bills`, `/finance/deposits`, `/finance/withdrawals`, `/finance/reports`

---

### 9. 生态中心
```
pages/ecosystem/
├── staking.tsx                    # 质押管理
├── weights.tsx                    # 权重明细
├── dividends.tsx                  # 分红管理（用户分红）
└── config.tsx                     # 生态配置
```
**路由**: `/ecosystem/staking`, `/ecosystem/weights`, `/ecosystem/dividends`, `/ecosystem/config`

---

### 10. 运营管理
```
pages/announcements/
├── list.tsx                       # 公告管理
└── marquee.tsx                    # 跑马灯

pages/agents/
├── index.tsx                      # 代理商与推荐管理
└── token-management.tsx           # 代理商代币管理（配额+分红池）
```
**路由**:
- `/operation/announcements`, `/operation/marquee`
- `/operation/agents`, `/operation/agents/token`

---

### 11. 内容管理
```
pages/content/
├── banners.tsx                    # Banner 管理
├── texts.tsx                      # 文案配置
├── config.tsx                     # 系统配置
├── help-articles.tsx              # 帮助文章
├── legal-docs.tsx                 # 法律文档
└── faq.tsx                        # FAQ 问答
```
**路由**: `/operation/banners`, `/operation/texts`, `/content/help-articles`, `/content/legal-docs`, `/content/faq`

---

### 12. 用户统计
```
pages/stats/
└── users.tsx                      # 用户统计
```
**路由**: `/stats/users`

---

### 13. 系统管理
```
pages/settings/
├── index.tsx                      # 基本设置
├── admins.tsx                     # 管理员管理
├── roles.tsx                      # 角色权限
├── security.tsx                   # 安全设置
└── monitor.tsx                    # 系统监控

pages/logs/
├── index.tsx                      # 日志中心
├── operations.tsx                 # 操作日志
├── trades.tsx                     # 交易日志
├── logins.tsx                     # 登录日志
└── system.tsx                     # 系统日志
```
**路由**:
- `/system/settings`, `/system/config`, `/system/admins`, `/system/roles`, `/system/security`, `/system/monitor`
- `/system/logs`

---

### 14. 代理商后台（独立入口）
```
pages/agent-portal/
├── index.ts                       # 模块导出
├── login.tsx                      # 代理商登录
├── layout.tsx                     # 代理商布局
├── dashboard.tsx                  # 业绩概览
├── users.tsx                      # 推广用户
├── commissions.tsx                # 佣金记录
├── token-assets.tsx               # 代币资产（私募配额+分红）
├── withdrawals.tsx                # 提现管理
├── agent-dark-theme.css           # 深色主题
│
├── components/                    # 代理商专用组件
│   ├── index.ts
│   ├── PageHeader.tsx
│   ├── StatCard.tsx
│   └── SectionCard.tsx
│
├── hooks/                         # 代理商专用 Hooks
│   ├── index.ts
│   └── useAgentApi.ts
│
└── constants/                     # 代理商专用常量
    ├── index.ts
    └── styles.ts
```
**路由**: `/agent/login`, `/agent/dashboard`, `/agent/users`, `/agent/commissions`, `/agent/token-assets`, `/agent/withdrawals`

---

## 侧边栏菜单结构

```
├── 数据看板           /
├── 用户管理           /users
├── 策略管理           /strategies
├── 交易中心
│   ├── 订单管理       /trading/orders
│   ├── 持仓管理       /trading/positions
│   ├── 信号监控       /trading/signals
│   ├── 风控管理       /trading/risk
│   └── 紧急开关       /trading/kill-switch
├── 财务中心
│   ├── 账单记录       /finance/bills
│   ├── 充值记录       /finance/deposits
│   ├── 提现审核       /finance/withdrawals
│   └── 财务报表       /finance/reports
├── 生态中心
│   ├── 质押管理       /ecosystem/staking
│   ├── 权重明细       /ecosystem/weights
│   ├── 分红管理       /ecosystem/dividends
│   └── 生态配置       /ecosystem/config
├── 运营管理
│   ├── 公告管理       /operation/announcements
│   ├── 跑马灯         /operation/marquee
│   ├── Banner         /operation/banners
│   ├── 文案配置       /operation/texts
│   ├── 代理商         /operation/agents
│   └── 代币管理       /operation/agents/token
├── 内容管理
│   ├── 帮助文章       /content/help-articles
│   ├── 法律文档       /content/legal-docs
│   └── FAQ 问答       /content/faq
└── 系统管理
    ├── 基本设置       /system/settings
    ├── 系统配置       /system/config
    ├── 管理员         /system/admins
    ├── 角色权限       /system/roles
    ├── 安全设置       /system/security
    ├── 日志中心       /system/logs
    └── 系统监控       /system/monitor
```

---

## 命名规范

### 文件命名
| 类型 | 命名规则 | 示例 |
|------|---------|------|
| 页面组件 | `kebab-case.tsx` | `token-management.tsx` |
| 公共组件 | `PascalCase.tsx` | `PageHeader.tsx` |
| Hooks | `use*.ts` | `useAgentApi.ts` |
| 工具函数 | `camelCase.ts` | `api.ts` |
| 常量 | `camelCase.ts` | `styles.ts` |
| 模块导出 | `index.ts` | `index.ts` |

### 导出命名
| 类型 | 命名规则 | 示例 |
|------|---------|------|
| 页面组件 | `*Page` / `*List` / `*Show` / `*Edit` | `DashboardPage`, `UserList` |
| 布局组件 | `*Layout` | `AdminLayout`, `AgentLayout` |
| 表单组件 | `*Form` | `LoginForm` |

---

## 技术栈

- **框架**: React 18 + TypeScript
- **路由**: React Router v6
- **状态管理**: Refine (数据层) + React Context (认证)
- **UI 库**: Ant Design 5.x
- **构建工具**: Vite
- **样式**: CSS + Ant Design 主题定制

---

## 开发指南

### 添加新页面
1. 在 `pages/` 下创建对应模块目录
2. 编写页面组件
3. 在 `pages/index.ts` 添加导出
4. 在 `App.tsx` 添加路由
5. 在 `components/Layout.tsx` 添加菜单项

### 添加代理商后台页面
1. 在 `pages/agent-portal/` 下创建页面
2. 在 `pages/agent-portal/index.ts` 添加导出
3. 在 `pages/agent-portal/layout.tsx` 添加菜单项
4. 在 `App.tsx` 的代理商路由区域添加路由
