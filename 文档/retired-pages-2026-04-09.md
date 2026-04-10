# 下线页面记录 — 2026-04-09

> nofx 接通后，以下 HOOT 旧页面被替换/不再需要，本次批量删除。
> 需要找回任何文件，用下方 git commit hash 回溯即可。

## Git 版本基线

```
commit: d80e4af4378342edfa96b38eb93d8e56b52e474e
message: [docs] CLAUDE.md 新增 6.1 注释禁止事项 (开源前置硬规则)
date: 最后一个 clean commit (删除前)
```

恢复命令:
```bash
git show d80e4af4:apps/web/src/app/(dashboard)/ai-trading/page.tsx
# 或整个目录
git checkout d80e4af4 -- apps/web/src/app/(dashboard)/ai-trading/
```

## 删除清单

### 1. AI 交易相关（已被 nofx /ai 替换）
| 路由 | 目录 | 说明 |
|---|---|---|
| /ai-trading | `apps/web/src/app/(dashboard)/ai-trading/` | 旧 AI 策略列表 + 详情 + 创建 |
| /ai-research | `apps/web/src/app/(dashboard)/ai-research/` | AI 研究分析 |
| /ai/create | `apps/web/src/app/(dashboard)/ai/create/` | AI 策略创建子页 |
| /ai/strategy/[id] | `apps/web/src/app/(dashboard)/ai/strategy/` | AI 策略详情子页 |
| /ai/research/[id] | `apps/web/src/app/(dashboard)/ai/research/` | AI 研究详情子页 |
| /strategies | `apps/web/src/app/(dashboard)/strategies/` | 策略市场/配置（已被 nofx 策略替代） |

### 2. 交易所绑定（API Key 已归 nofx 管理）
| 路由 | 目录 | 说明 |
|---|---|---|
| /exchanges | `apps/web/src/app/(dashboard)/exchanges/` | CEX API Key 绑定页 |

### 3. 签到/空投（业务下线）
| 路由 | 目录 | 说明 |
|---|---|---|
| /airdrop | `apps/web/src/app/(dashboard)/airdrop/` | 签到 + 空投任务页 |

### 4. nofx-preview（已被 P6a/b/c 正式页面替代）
| 路由 | 目录 | 说明 |
|---|---|---|
| /nofx-preview | `apps/web/src/app/(dashboard)/nofx-preview/` | P4 临时验证页，已无用 |

## 保留的页面（不动）
- `/dashboard` — 已有 nofx flag 分支
- `/ai` — 已有 nofx flag 分支（page.tsx 保留，子路由删除）
- `/trading` — 已有 nofx flag 分支
- `/wallet` — HOOT 商业核心，不涉及 nofx
- `/profile` — HOOT 商业核心
- `/settings` — HOOT 商业核心
- `/subscription` — HOOT 商业核心
- `/referral` — HOOT 商业核心
- `/notifications` — HOOT 商业核心
- `/about` — 静态页
- `/help` — 静态页
- `/ecosystem` — 静态页

## /ai/page.tsx 处理

`/ai/page.tsx` 本身保留（它是 nofx flag 入口），但内部 `UnifiedAiList` import 会在删除后断掉。
处理方式：移除 legacy 分支，只保留 `NofxAiTrading`。
