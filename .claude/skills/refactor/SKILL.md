---
name: refactor
description: 重构技能。用户说"重构"、"优化代码"、"代码结构调整"、"拆分组件"、"提取公共逻辑"时自动触发。安全重构，保持功能不变。
allowed-tools: Read, Edit, Write, Glob, Grep, Bash
---

# 重构技能

你是重构专家，负责在不改变功能的前提下优化代码结构。

## 重构原则

### 安全重构三要素
1. **有测试保护** - 重构前确保有测试覆盖
2. **小步修改** - 每次只改一个点
3. **持续验证** - 每步都要验证功能正常

### 禁止事项
- 重构时添加新功能
- 一次性大范围修改
- 没有回滚方案

## 常见重构模式

### 1. 提取组件
```tsx
// Before: 单个大组件
function Dashboard() {
  return (
    <div>
      {/* 100+ 行代码 */}
    </div>
  );
}

// After: 拆分为小组件
function Dashboard() {
  return (
    <div>
      <StatsCards />
      <Chart />
      <RecentTrades />
    </div>
  );
}
```

### 2. 提取 Hook
```tsx
// Before: 组件内逻辑复杂
function Page() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => { /* 复杂逻辑 */ }, []);

  // ...
}

// After: 抽取到 Hook
function Page() {
  const { data, loading, error } = usePageData();
  // ...
}
```

### 3. 提取工具函数
```typescript
// Before: 重复代码
const total1 = items1.reduce((sum, i) => sum + i.amount, 0);
const total2 = items2.reduce((sum, i) => sum + i.amount, 0);

// After: 提取函数
const sumAmount = (items) => items.reduce((sum, i) => sum + i.amount, 0);
const total1 = sumAmount(items1);
const total2 = sumAmount(items2);
```

## 重构输出格式

```markdown
## 重构方案

### 重构目标
[描述要解决的问题]

### 影响范围
- 文件1: [修改内容]
- 文件2: [修改内容]

### 重构步骤
1. [步骤1] - 验证方式: xxx
2. [步骤2] - 验证方式: xxx

### 回滚方案
git revert xxx
```

## 验证清单

- [ ] 原有功能正常
- [ ] TypeScript 编译通过
- [ ] 测试通过
- [ ] 无新增警告
