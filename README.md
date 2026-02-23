# HOOT — AI 量化交易 SaaS 平台

> Web3 智能化量化 SaaS 平台，AI 驱动 + 7×24h 自动交易
>
> **核心哲学**：Web3 内核 (Real Yield) + Web2 外壳 (SaaS) + 中央引擎 (Shared Computing) + 社区策略生态 (UGC)

---

## 项目简介

HOOT 是以猫头鹰为品牌的 AI 量化交易平台，主打 Telegram 生态与 TON 链，为散户提供机构级量化交易能力。

核心特点：
- **AI 多模型辩论决策系统**：多个 AI 角色（多头/空头/分析师/风控）辩论，共识驱动交易
- **双产品设计**：产品A（深度研究）+ 产品B（7×24h 自动交易）
- **双轨接入**：CEX（Binance 等）+ DEX（Hyperliquid/Lighter/Aster）
- **中央引擎架构**：单一信号引擎服务所有用户，成本降低 96%
- **HOOT 代币经济**：质押分红 + 治理 + 生态激励

---

## 技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| 后端框架 | NestJS + TypeScript | 11.x / 5.x |
| ORM | Prisma | 5.x |
| 数据库 | PostgreSQL | 16 |
| 缓存/队列 | Redis + BullMQ | 7 / 5.x |
| 前端框架 | Next.js (App Router) + React | 16.x / 19.x |
| 样式 | TailwindCSS + shadcn/ui | 3.x |
| 数据请求 | TanStack Query | 5.x |
| 图表 | lightweight-charts + recharts | 5.x / 3.x |
| Web3 | wagmi + viem | 3.x / 2.x |
| 实时通信 | Socket.io | 4.x |
| 交易所 | CCXT | 4.x |
| AI 模型 | OpenAI / DeepSeek / OpenRouter / Qwen / Grok | — |
| 国际化 | next-intl | 4.x |
| 容器化 | Docker Compose | — |

---

## Monorepo 结构

```
HOOT/
├── apps/
│   ├── api/              # NestJS 后端 API（端口 4001）
│   ├── web/              # Next.js 前端（端口 3001）
│   ├── admin/            # 管理后台独立前端
│   ├── telegram-bot/     # Telegram 用户 Bot
│   └── admin-bot/        # Telegram 管理员 Bot
├── packages/
│   ├── shared/           # 共享类型与工具函数
│   └── ui/               # 共享 UI 组件库
├── contracts/            # 智能合约（HOOT 代币）
├── docs/                 # 文档
├── freqtrade/            # 策略引擎（源码方式运行）
├── nginx/                # Nginx 反向代理配置
├── scripts/              # 部署、验算、V0 UI 生成等脚本
├── 文档/                  # 核心开发文档
├── docker-compose.yml    # 本地开发基础设施
├── docker-compose.prod.yml # 生产环境编排（7 服务）
└── pnpm-workspace.yaml   # Monorepo 工作区配置
```

---

## 端口分配

| 服务 | 端口 | 说明 |
|------|------|------|
| 前端 Next.js | **3001** | Next.js 开发服务器 |
| 后端 NestJS API | **4001** | NestJS 后端 |
| PostgreSQL | **5433** | 数据库（映射到宿主机 5433） |
| Redis | **6379** | 缓存与任务队列 |

---

## 快速启动

### 环境要求

| 工具 | 最低版本 | 推荐版本 |
|------|---------|---------|
| Node.js | 20.0.0 | 20.x LTS |
| pnpm | 9.0.0 | 10.x |
| Docker | 24.0 | 最新稳定版 |
| Docker Compose | v2.20 | v2.23+ |

### 启动步骤

```bash
# 1. 克隆项目后，安装全部依赖
pnpm install

# 2. 配置环境变量（不要提交 .env 文件）
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env

# 3. 启动基础设施（PostgreSQL + Redis）
docker compose up -d

# 4. 初始化数据库（首次运行）
cd apps/api
npx prisma migrate dev
npx prisma generate

# 5. 启动所有开发服务（前端 3001 + 后端 4001）
pnpm dev
```

### 验证服务正常

```bash
# 检查后端健康接口
curl http://localhost:4001/api/health
# 预期返回：{"status":"ok","timestamp":"..."}

# 检查前端页面
# 浏览器访问 http://localhost:3001
```

---

## 常用命令

```bash
pnpm dev              # 并行启动所有开发服务
pnpm build            # 构建所有子项目
pnpm lint             # 运行 ESLint 检查
pnpm test             # 运行测试套件
pnpm docker:up        # 启动 Docker 服务（后台）
pnpm docker:down      # 停止并移除 Docker 容器
pnpm docker:logs      # 实时查看 Docker 服务日志
```

---

## 后端模块（21 个）

位于 `apps/api/src/modules/`：

| 模块 | 说明 |
|------|------|
| `auth` | JWT 用户认证（注册/登录/2FA/邮箱验证） |
| `admin` | 管理员认证与后台功能 |
| `user` | 用户信息与资料管理 |
| `wallet` | USDT/HOOT 余额、充值、提现 |
| `trading` | 信号分发、持仓管理、交易历史 |
| `strategies` | 策略市场、订阅管理 |
| `ai` | AI 多模型辩论系统（双产品） |
| `exchange-adapters` | 交易所统一适配层（CEX + DEX） |
| `exchanges` | 用户交易所 API Key 管理（AES-256-GCM 加密） |
| `api-keys` | API Key 绑定与 DEX 凭证管理 |
| `staking` | HOOT 代币质押与分红 |
| `referral` | 代理商与推荐系统 |
| `agent` | 代理商后台接口 |
| `membership` | 会员订阅与计费 |
| `market` | 市场行情数据 |
| `blockchain` | 链上监听、充值确认、提现执行 |
| `notifications` | 站内通知、WebSocket 推送 |
| `signals` | 策略信号管理 |
| `airdrop` | 空投任务与发放 |
| `email` | 邮件发送（Resend） |
| `health` | 服务健康检查 |

---

## AI 交易系统

### 产品A — 深度研究（Research）

5 阶段分析管线：

```
市场数据采集 → 技术指标分析 → 多角色辩论（7角色） → 风控辩论 → Judge 裁决 → 执行决策
```

特点：
- 7 个 AI 角色：多头/空头/分析师/反向者/风控/Judge/反思者
- 每角色独立 BM25 历史记忆（盈利记忆优先保留）
- 恐惧贪婪指数注入情绪分析
- 深度模型 Judge 裁决（DeepSeek-R1/o3-mini 等）

### 产品B — 自动交易（Auto Trader）

3 种运行模式：

| 模式 | 说明 | LLM 调用次数 |
|------|------|-------------|
| Solo（极速） | 单模型快速决策 | 1 次 |
| Research（深研） | 走产品A研究管线 | ~12 次 |
| Debate（共识） | 5 角色投票共识 | ~20 次 |

### 网格交易

- 3 种价格分布：uniform（均匀）/ gaussian（高斯）/ pyramid（金字塔）
- ATR 自动边界设定（ATR14 × multiplier）
- Donchian 突破信号（3 级时间框架：72h / 240h / 504h）
- 4 级市场状态：narrow / standard / wide / volatile
- AI 每周期决策（7 种网格操作指令）

---

## 前端页面

### 用户端（`apps/web/src/app/(dashboard)/`）

| 页面 | 路由 |
|------|------|
| 仪表盘 | `/dashboard` |
| AI 研究（产品A） | `/ai-research` |
| AI 自动交易（产品B） | `/ai-trading` |
| 策略市场 | `/strategies` |
| 交易控制台 | `/trading` |
| 钱包 | `/wallet` |
| 质押 | `/ecosystem` |
| 交易所绑定 | `/exchanges` |
| 推荐返佣 | `/referral` |
| AI 设置 | `/settings/ai` |
| 通知 | `/notifications` |
| 个人资料 | `/profile` |

### 管理后台（`apps/web/src/app/(admin)/admin/`）

| 页面 | 路由 |
|------|------|
| 概览 | `/admin` |
| 用户管理 | `/admin/users` |
| 财务管理 | `/admin/finance` |
| 风控管理 | `/admin/risk` |
| AI 管理 | `/admin/ai` |
| 交易管理 | `/admin/trading` |
| 提现审核 | `/admin/withdraws` |
| 生态系统 | `/admin/ecosystem` |
| 代理商管理 | `/admin/agents` |
| 推荐管理 | `/admin/referral` |
| 内容管理 | `/admin/content` |
| 系统设置 | `/admin/settings` |

---

## 国际化（i18n）

支持 10 种语言：

| 代码 | 语言 |
|------|------|
| `en` | 英文 |
| `zh-CN` | 简体中文 |
| `zh-TW` | 繁体中文 |
| `ja` | 日文 |
| `ko` | 韩文 |
| `vi` | 越南文 |
| `th` | 泰文 |
| `id` | 印尼文 |
| `ru` | 俄文 |
| `tr` | 土耳其文 |

翻译文件位于：`apps/web/src/i18n/messages/`

---

## 安全规范

- **API Key 加密**：AES-256-GCM，字段拆分存储（`encrypted_blob` + `iv` + `auth_tag`）
- **JWT 认证**：用户端与管理员端双轨独立 Token
- **限流保护**：3 级限流（10次/秒、50次/10秒、200次/分钟）
- **安全头**：Helmet（CSP / HSTS / XSS 防护）
- **CORS**：白名单域名限制
- **资金精度**：所有金额使用 `DECIMAL(18, 8)`，禁止 FLOAT
- **幂等计费**：所有扣费操作携带 `unique_order_id`，数据库唯一约束防重复

---

## 生产部署

生产编排文件：`docker-compose.prod.yml`（7 个服务）

```bash
# 一键部署（含 build + migrate + 健康检查）
bash scripts/deploy.sh

# 查看生产日志
docker compose -f docker-compose.prod.yml logs -f api

# 回滚到上一版本
bash scripts/deploy.sh rollback
```

Nginx 反向代理配置位于：`nginx/`

---

## 开发阶段状态

| 阶段 | 内容 | 状态 |
|------|------|------|
| Phase 1 | 环境准备 & Monorepo | 完成 |
| Phase 2 | 前端 UI 设计 | 完成 |
| Phase 3 | 核心交易系统 MVP | 完成 |
| Phase 4 | 钱包与资金管理 | 完成 |
| Phase 5 | TG Bot + 代理商 + 管理后台 | 完成 |
| Phase 6 | HOOT 代币经济 | 完成 |
| Phase 7 | 测试与部署 | 完成 |
| Phase 8.0 | AI 智能交易双产品 | 完成 |
| Phase 8.1 | DEX 接入（Hyperliquid/Lighter/Aster） | 完成 |
| Phase 8.2 | Debate Arena 4 阶段辩论 | 完成 |
| Phase 8.3 | AI 模块隔离 + 产品A优化 | 完成 |
| Phase 8.4 | 产品A TradingAgents 对齐修复 | 完成 |
| Phase 9.0 | 产品B多维度辩论 + Schema 增强 | 完成 |
| Phase 9.1 | 产品B辩论流水线对齐（4→2 阶段） | 完成 |
| Phase 9.2 | 产品B偏差修复（8 项） | 完成 |
| Phase 10 | NoFx 网格交易 + 监控 + 执行层 | 完成 |
| 实盘验收 | 3 种策略全流程端到端验收 | 通过（2026-02-21） |

---

## 许可证

UNLICENSED — 私有项目，未经授权禁止使用、复制或分发。
