# Git 工作流规则

---

## 分支策略

```
main          <- 生产分支（保护）
  └── develop <- 开发分支
        ├── feature/xxx  <- 功能分支
        ├── fix/xxx      <- 修复分支
        └── night-run/xxx <- 夜间任务分支
```

### 分支命名

| 类型 | 格式 | 示例 |
|------|------|------|
| 功能 | feature/{task-id}-{description} | feature/1.1-database-schema |
| 修复 | fix/{issue-id}-{description} | fix/42-login-error |
| 夜间 | night-run/{date}-{description} | night-run/20231223-api-cleanup |

---

## 提交规范

### 提交信息格式

```
[类型] 简短描述（≤50字符）

详细说明（可选）:
- 改了什么
- 为什么改
- 影响范围
- 如何验证
- 如何回滚
```

### 提交类型

| 类型 | 说明 | 示例 |
|------|------|------|
| `[feat]` | 新功能 | [feat] 添加用户注册接口 |
| `[fix]` | 修复 bug | [fix] 修复登录密码校验错误 |
| `[docs]` | 文档更新 | [docs] 更新 API 文档 |
| `[style]` | 代码格式 | [style] 格式化代码 |
| `[refactor]` | 重构 | [refactor] 重构用户模块 |
| `[test]` | 测试 | [test] 添加钱包测试用例 |
| `[chore]` | 杂项 | [chore] 更新依赖版本 |

### 示例

```
[feat] 添加用户注册接口

详细说明:
- 新增 POST /api/auth/register 接口
- 实现邮箱+密码注册
- 密码 bcrypt 加密存储

影响范围: auth 模块

验证方式:
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

回滚方式: git revert HEAD
```

---

## 小步提交（强制）

- 单次提交 ≤ 5 个文件
- 每次提交只做一件事
- 提交前必须通过 lint 和 test

```bash
# 提交前检查
pnpm lint
pnpm test

# 然后提交
git add .
git commit -m "[feat] xxx"
```

---

## PR/MR 规范

### PR 标题

```
[类型] 简短描述 (#issue-number)
```

### PR 描述模板

```markdown
## 改动说明
-

## 验证方式
1.
2.

## 回滚方案
-

## 检查清单
- [ ] 代码已自测
- [ ] 文档已更新
- [ ] 测试已通过
- [ ] 无敏感信息
```

---

## 禁止操作

| 操作 | 说明 |
|------|------|
| `git push --force` | 禁止强制推送到 main/develop |
| `git reset --hard` | 禁止在共享分支使用 |
| 直接提交到 main | 必须通过 PR |
| 提交敏感信息 | 禁止提交 .env、密钥、Token |

---

## Git Hooks（建议）

### pre-commit

```bash
#!/bin/sh
# 运行 lint
pnpm lint-staged

# 检查敏感信息
if git diff --cached | grep -E "(API_KEY|SECRET|PASSWORD|TOKEN)="; then
  echo "检测到敏感信息，禁止提交"
  exit 1
fi
```

### commit-msg

```bash
#!/bin/sh
# 检查提交信息格式
commit_regex='^(\[feat\]|\[fix\]|\[docs\]|\[style\]|\[refactor\]|\[test\]|\[chore\]) .{1,50}$'
if ! head -1 "$1" | grep -qE "$commit_regex"; then
  echo "提交信息格式错误"
  echo "正确格式: [类型] 描述（≤50字符）"
  exit 1
fi
```

---

## 夜间任务分支

夜间模式必须在独立分支操作：

```bash
# 创建夜间分支
git checkout -b night-run/20231223-task-description

# 完成后等待晨间审核
# PM 确认后合并
git checkout develop
git merge night-run/20231223-task-description

# 删除夜间分支
git branch -d night-run/20231223-task-description
```

---

## 回滚操作

### 回滚最近一次提交

```bash
git revert HEAD
```

### 回滚到指定提交

```bash
# 查看历史
git log --oneline -10

# 回滚到指定提交（不包含该提交）
git revert <commit-hash>

# 或者回滚多个提交
git revert <commit-hash1>..<commit-hash2>
```

### 紧急回滚（生产环境）

```bash
# 1. 切换到 main
git checkout main

# 2. 创建回滚分支
git checkout -b hotfix/rollback-xxx

# 3. 回滚
git revert <problematic-commit>

# 4. 测试确认

# 5. 合并到 main
git checkout main
git merge hotfix/rollback-xxx

# 6. 部署
```

---

## .gitignore 规范

```gitignore
# 依赖
node_modules/

# 构建
dist/
.next/

# 环境变量（禁止提交）
.env
.env.*
!.env.example

# IDE
.idea/
.vscode/
*.swp

# 日志
*.log
logs/

# 敏感文件
*.pem
*.key
secrets/

# 系统文件
.DS_Store
Thumbs.db
```
