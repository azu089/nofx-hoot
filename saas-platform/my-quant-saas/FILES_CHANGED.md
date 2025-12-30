# Dashboard API 对接 - 文件变更清单

## 新增文件 (6 个)

1. `apps/app/lib/api/index.ts` - API 统一导出
2. `apps/app/lib/api/wallet.ts` - 钱包 API 模块
3. `apps/app/lib/api/billing.ts` - 计费 API 模块
4. `apps/app/lib/api/instances.ts` - VPS 实例 API 模块
5. `apps/app/lib/api/trading.ts` - 交易 API 模块
6. `apps/app/lib/api/strategies.ts` - 策略 API 模块

## 修改文件 (1 个)

1. `apps/app/app/(authenticated)/(dashboard)/dashboard/page.tsx`
   - 导入 API 客户端模块
   - 重写 fetchData 函数调用真实 API
   - 添加错误状态和 fallback 机制
   - 添加错误提示 UI

## 文档文件 (2 个)

1. `DASHBOARD_INTEGRATION_SUMMARY.md` - 完整总结文档
2. `FILES_CHANGED.md` - 本文件

---

## Git 变更查看

```bash
# 查看变更文件列表
git status

# 查看具体改动
git diff apps/app/app/(authenticated)/(dashboard)/dashboard/page.tsx

# 查看新增文件
git diff --staged apps/app/lib/api/
```

---

## 回滚命令

### 回滚 Dashboard 页面
```bash
git checkout HEAD -- apps/app/app/(authenticated)/(dashboard)/dashboard/page.tsx
```

### 删除新增 API 模块（如果需要）
```bash
rm apps/app/lib/api/{index,wallet,billing,instances,trading,strategies}.ts
```

### 完整回滚（慎用）
```bash
git reset --hard HEAD
```
