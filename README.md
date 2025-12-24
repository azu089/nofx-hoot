# QuantFi - Web3 智能化量化 SaaS 平台

> Web3 内核 (Real Yield) + Web2 外壳 (SaaS) + 单租户隔离 (Security)

---

## 项目概述

QuantFi 是一个基于 Freqtrade 引擎的 Web3 量化 SaaS 平台，通过"单租户隔离"技术解决小白用户的量化门槛问题。

### 核心特性

- **单租户隔离**: 1 VIP 用户 = 1 独立 VPS
- **AES-256 加密**: API Key 安全存储
- **双轨质押系统**: A 类（空投）/ B 类（本金）不同惩罚机制
- **幂等计费**: unique_order_id 物理杜绝重复扣费

---

## 技术栈

| 类别 | 技术 | 版本 |
|------|------|------|
| 后端 | NestJS | 10.x |
| 前端 | Next.js (App Router) | 14.x |
| 语言 | TypeScript | 5.x |
| 数据库 | PostgreSQL | 15.x |
| 缓存 | Redis | 7.x |
| 容器化 | Docker Compose | - |
| 云服务 | DigitalOcean | - |
| 对象存储 | S3 | - |

---

## 目录结构

```
主QuantFi/
├── CLAUDE.md                 # AI 行为规范（必读）
├── README.md                 # 本文件
├── DEV_Log.md               # 开发日志
│
├── .claude/                  # Claude Code 配置
│   ├── settings.json         # 权限配置
│   ├── agents/               # 子代理定义
│   ├── skills/               # 技能定义
│   ├── commands/             # 命令定义
│   ├── hooks/                # 钩子脚本
│   ├── rules/                # 规则文件
│   └── templates/            # 模板文件
│
├── 数据库/
│   ├── 数据库结构.sql        # PostgreSQL Schema
│   └── ER关系图.md          # 实体关系图
│
├── 文档/
│   ├── 核心文档/
│   │   ├── 项目需求.md      # 白皮书 v4.0 + UI 设计
│   │   ├── 开发顺序.md      # 开发计划
│   │   └── 开发助手.md      # AI 协作规则
│   ├── 参考模板/            # 模板文件
│   └── 夜间日志/            # 夜间任务日志
│
├── apps/                    # 应用代码（待创建）
│   ├── api/                 # 后端 NestJS
│   └── web/                 # 前端 Next.js
│
├── packages/                # 共享包（待创建）
│   ├── shared/              # 共享类型/工具
│   └── ui/                  # UI 组件库
│
├── scripts/                 # 脚本（待创建）
│
└── docker-compose.yml       # Docker 配置（待创建）
```

---

## 快速开始

### 环境要求

- Node.js 20.x (LTS)
- pnpm 9.x
- Docker & Docker Compose
- PostgreSQL 15.x
- Redis 7.x

### 安装步骤

```bash
# 1. 克隆项目
cd 主QuantFi

# 2. 安装依赖
pnpm install

# 3. 启动基础服务
docker compose up -d

# 4. 初始化数据库
pnpm db:migrate

# 5. 启动开发服务
pnpm dev
```

### 验证安装

```bash
# 检查服务状态
docker compose ps

# 检查 API 健康
curl http://localhost:4000/api/health

# 检查前端
open http://localhost:3000
```

---

## 开发规范

### 必读文档

1. [CLAUDE.md](CLAUDE.md) - AI 行为规范
2. [文档/核心文档/项目需求.md](文档/核心文档/项目需求.md) - 白皮书
3. [文档/核心文档/开发顺序.md](文档/核心文档/开发顺序.md) - 开发计划

### 提交规范

```
[类型] 简短描述（≤50字符）

详细说明:
- 改了什么
- 为什么改
- 影响范围
- 如何验证
- 如何回滚
```

类型: `[feat]` `[fix]` `[docs]` `[refactor]` `[test]` `[chore]`

### 资金安全规则

- 所有金额使用 `DECIMAL(18,8)`，禁止 FLOAT
- 计费必须幂等（unique_order_id）
- API Key 必须 AES-256-GCM 加密

---

## 开发阶段

| 阶段 | 内容 | 状态 |
|------|------|------|
| Phase 1 | 地基与云端验证 | 进行中 |
| Phase 2 | SaaS 业务闭环 | 待开始 |
| Phase 3 | GameFi 与代理系统 | 待开始 |
| Phase 4 | 测试与上线 | 待开始 |

---

## 联系方式

- 项目负责人: PM
- 技术支持: AI Assistant

---

## 版本记录

| 版本 | 日期 | 说明 |
|------|------|------|
| v0.1 | 2025-12-23 | 项目初始化，完成配置框架 |
