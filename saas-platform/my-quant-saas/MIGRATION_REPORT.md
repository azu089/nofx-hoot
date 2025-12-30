# QuantFi 迁移报告

> 从原项目迁移到 next-forge 脚手架

**迁移日期**: 2025-12-25
**迁移状态**: 进行中

---

## 1. 项目结构变化

### 原项目结构
```
主QuantFi/
├── apps/
│   ├── api/           # NestJS 后端
│   └── web/           # Next.js 14 前端
├── packages/          # 共享包
└── 文档/              # 项目文档
```

### 新项目结构 (next-forge)
```
saas-platform/my-quant-saas/
├── apps/
│   ├── api/           # Express API (next-forge)
│   ├── app/           # 主应用 (迁移目标) ← Dashboard/Wallet/Instances
│   ├── docs/          # 文档站点
│   ├── email/         # 邮件模板
│   ├── storybook/     # 组件文档
│   ├── studio/        # CMS Studio
│   └── web/           # 营销网站
├── packages/
│   ├── ai/            # AI 集成
│   ├── analytics/     # 分析
│   ├── auth/          # Clerk 认证
│   ├── database/      # Prisma (已合并 QuantFi Schema)
│   ├── design-system/ # Shadcn UI
│   └── ...
└── turbo.json
```

---

## 2. 已迁移文件清单

### 页面迁移

| 原路径 | 新路径 | 状态 |
|--------|--------|------|
| `apps/web/src/app/(dashboard)/dashboard/page.tsx` | `apps/app/app/(authenticated)/(dashboard)/dashboard/page.tsx` | ✅ 已迁移 |
| `apps/web/src/app/(dashboard)/wallet/page.tsx` | `apps/app/app/(authenticated)/(dashboard)/wallet/page.tsx` | ✅ 已迁移 |
| `apps/web/src/app/(dashboard)/instances/page.tsx` | `apps/app/app/(authenticated)/(dashboard)/instances/page.tsx` | ✅ 已迁移 |
| `apps/web/src/app/(auth)/login/page.tsx` | 使用 Clerk SignIn | ⏭️ 跳过 (使用 next-forge 内置) |
| `apps/web/src/app/(auth)/register/page.tsx` | 使用 Clerk SignUp | ⏭️ 跳过 (使用 next-forge 内置) |

### 数据库 Schema

| 原路径 | 新路径 | 状态 |
|--------|--------|------|
| `apps/api/prisma/schema.prisma` | `packages/database/prisma/schema.prisma` | ✅ 已合并 |

**合并的数据表**:
- users, wallets, deposits, withdrawals, billing_logs
- instances, instance_backups
- strategies, user_strategy_configs, backtests, trade_history
- api_keys, stakes, token_orders, token_burns
- agents, agent_commissions
- admin_audit_logs, announcements, revenue_distributions

---

## 3. 导入路径变化

### UI 组件导入

```typescript
// 原导入
import { Card, Button } from '@/components/ui';

// 新导入
import { Card } from '@repo/design-system/components/ui/card';
import { Button } from '@repo/design-system/components/ui/button';
```

### 样式类变化

| 原类名 | 新类名 |
|--------|--------|
| `text-primary-400` | `text-primary` |
| `bg-success-500/20` | `bg-green-500/20` |
| `text-success-500` | `text-green-500` |
| `bg-gray-800` | `bg-muted` |
| `text-gray-400` | `text-muted-foreground` |

---

## 4. 需要的环境变量

### 数据库 (必需)
```env
DATABASE_URL="postgresql://user:password@localhost:5432/quantfi"
```

### 认证 - Clerk (必需)
```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
CLERK_SECRET_KEY="sk_test_..."
```

### 分析 (可选)
```env
NEXT_PUBLIC_POSTHOG_KEY=""
NEXT_PUBLIC_POSTHOG_HOST=""
```

### 支付 - Stripe (可选)
```env
STRIPE_SECRET_KEY=""
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=""
```

### 存储 - S3 (VPS 备份需要)
```env
AWS_ACCESS_KEY_ID=""
AWS_SECRET_ACCESS_KEY=""
AWS_S3_BUCKET=""
AWS_REGION=""
```

### DigitalOcean (VPS 管理需要)
```env
DIGITALOCEAN_API_TOKEN=""
```

---

## 5. 待完成任务

### 高优先级
- [ ] 配置 `.env.local` 环境变量
- [ ] 运行 `pnpm prisma generate` 生成 Prisma Client
- [ ] 创建 API 服务层连接后端
- [ ] 测试 Dashboard 页面功能

### 中优先级
- [ ] 迁移 Trading 页面
- [ ] 迁移 GameFi 页面
- [ ] 实现 API 路由层 (如需前端直接调用)
- [ ] 配置 Clerk 用户同步到 users 表

### 低优先级
- [ ] 迁移 Admin 后台页面
- [ ] 迁移 Agent 代理商页面
- [ ] 配置邮件模板 (apps/email)
- [ ] 配置分析工具 (PostHog/Vercel Analytics)

---

## 6. 架构决策

### 认证方案
- **选择**: Clerk (next-forge 内置)
- **原因**: 开箱即用，支持 OAuth、MFA、组织管理
- **注意**: 需要将 Clerk 用户 ID 与 QuantFi users 表关联

### API 通信
- **选择**: 保持原 NestJS 后端，前端通过 axios 调用
- **原因**: 后端业务逻辑复杂，迁移成本高
- **路径**: 前端 → axios → NestJS API (apps/api 在原项目)

### 状态管理
- **选择**: Zustand + React Query
- **原因**: 轻量、类型安全、与原项目保持一致

---

## 7. 回滚方案

如需回滚到原项目：

1. 原项目代码完整保留在 `/Users/azu/主QuantFi/apps/`
2. 新项目独立存放在 `/Users/azu/主QuantFi/saas-platform/`
3. 可随时切换回原项目，无破坏性变更

---

## 8. 验证步骤

```bash
# 1. 进入新项目目录
cd /Users/azu/主QuantFi/saas-platform/my-quant-saas

# 2. 安装依赖 (如未完成)
pnpm install

# 3. 配置环境变量
cp .env.example .env.local
# 编辑 .env.local 填入必要配置

# 4. 生成 Prisma Client
pnpm --filter @repo/database prisma generate

# 5. 启动开发服务器
pnpm dev --filter app

# 6. 打开浏览器验证
# http://localhost:3000
```

---

**报告生成时间**: 2025-12-25
**生成者**: Claude Code
