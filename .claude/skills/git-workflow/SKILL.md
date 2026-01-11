---
name: git-workflow
description: Git 工作流技能。用户说"提交代码"、"创建分支"、"合并"、"git操作"、"版本管理"时自动触发。处理 Git 操作和分支管理。
allowed-tools: Read, Glob, Bash
---

# Git 工作流技能

你是 Git 工作流专家，负责版本控制和分支管理。

## 分支策略

```
main          <- 生产分支（保护）
  └── develop <- 开发分支
        ├── feature/xxx  <- 功能分支
        ├── fix/xxx      <- 修复分支
        └── night-run/xxx <- 夜间任务分支
```

## 分支命名

| 类型 | 格式 | 示例 |
|------|------|------|
| 功能 | feature/{task-id}-{description} | feature/1.1-user-auth |
| 修复 | fix/{issue-id}-{description} | fix/42-login-error |
| 夜间 | night-run/{date}-{description} | night-run/20240101-cleanup |

## 提交规范

### 提交信息格式
```
[类型] 简短描述（≤50字符）

详细说明（可选）:
- 改了什么
- 为什么改
- 影响范围
```

### 类型
| 类型 | 说明 |
|------|------|
| `[feat]` | 新功能 |
| `[fix]` | 修复 bug |
| `[docs]` | 文档更新 |
| `[style]` | 代码格式 |
| `[refactor]` | 重构 |
| `[test]` | 测试 |
| `[chore]` | 杂项 |

### 示例
```
[feat] 添加用户注册接口

- 新增 POST /api/auth/register 接口
- 实现邮箱+密码注册
- 密码 bcrypt 加密存储

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

## 常用命令

### 日常操作
```bash
# 查看状态
git status

# 查看差异
git diff
git diff --staged

# 提交
git add .
git commit -m "[feat] xxx"

# 推送（需要权限确认）
git push origin branch-name
```

### 分支操作
```bash
# 创建并切换分支
git checkout -b feature/xxx

# 切换分支
git checkout develop

# 合并分支
git merge feature/xxx

# 删除分支
git branch -d feature/xxx
```

### 回滚操作
```bash
# 回滚最近一次提交
git revert HEAD

# 回滚到指定提交
git revert <commit-hash>

# 丢弃本地修改
git checkout -- <file>
git restore <file>
```

## 禁止操作

| 操作 | 说明 |
|------|------|
| `git push --force` | 禁止强推 |
| `git reset --hard` | 禁止在共享分支使用 |
| 直接提交 main | 必须通过 PR |
| 提交敏感信息 | 禁止提交 .env、密钥 |

## 提交前检查

```bash
# 1. 检查状态
git status

# 2. 检查差异
git diff

# 3. 运行测试
pnpm test

# 4. 检查编译
pnpm build
```
