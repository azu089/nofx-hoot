---
name: performance
description: 性能优化技能。用户说"性能优化"、"加载慢"、"卡顿"、"优化速度"、"提升性能"时自动触发。分析性能瓶颈，提供优化方案。
allowed-tools: Read, Glob, Grep, Bash
---

# 性能优化技能

你是性能优化专家，负责分析和优化系统性能。

## 前端性能优化

### React 优化清单

| 问题 | 检查方式 | 解决方案 |
|------|----------|----------|
| 不必要的重渲染 | React DevTools | `useMemo`, `useCallback`, `React.memo` |
| 大列表渲染慢 | 滚动卡顿 | 虚拟滚动 `react-window` |
| 图片加载慢 | Network 面板 | `next/image` 懒加载 |
| 首屏加载慢 | Lighthouse | 代码分割 `dynamic import` |
| Bundle 过大 | `next build` 分析 | Tree shaking, 按需引入 |

### 常用优化代码

```tsx
// 1. 避免不必要的重渲染
const MemoizedComponent = React.memo(Component);

// 2. 缓存计算结果
const expensiveValue = useMemo(() =>
  computeExpensive(data), [data]
);

// 3. 缓存回调函数
const handleClick = useCallback(() => {
  doSomething(id);
}, [id]);

// 4. 虚拟列表
import { FixedSizeList } from 'react-window';

<FixedSizeList
  height={400}
  itemCount={1000}
  itemSize={50}
>
  {Row}
</FixedSizeList>

// 5. 动态导入
const HeavyComponent = dynamic(
  () => import('./HeavyComponent'),
  { loading: () => <Skeleton /> }
);
```

## 后端性能优化

### 数据库优化

| 问题 | 检查方式 | 解决方案 |
|------|----------|----------|
| N+1 查询 | 日志分析 | `eager loading`, `join` |
| 慢查询 | `EXPLAIN ANALYZE` | 添加索引 |
| 大数据量 | 响应时间 | 分页、游标分页 |
| 频繁读取 | 数据库负载 | Redis 缓存 |

### 常用优化代码

```typescript
// 1. 避免 N+1 查询
const users = await userRepo.find({
  relations: ['orders', 'profile'],
});

// 2. 使用缓存
const cached = await redis.get(`user:${id}`);
if (cached) return JSON.parse(cached);

const user = await userRepo.findOne({ where: { id } });
await redis.setex(`user:${id}`, 3600, JSON.stringify(user));
return user;

// 3. 游标分页（大数据量）
const items = await repo.find({
  where: { id: MoreThan(cursor) },
  take: 20,
  order: { id: 'ASC' },
});

// 4. 批量操作
await repo.insert(items); // 而不是循环 save
```

## 性能检查清单

### 前端
- [ ] 首屏加载 < 3s
- [ ] LCP < 2.5s
- [ ] FID < 100ms
- [ ] CLS < 0.1
- [ ] Bundle 大小合理

### 后端
- [ ] API 响应 < 200ms
- [ ] 数据库查询 < 50ms
- [ ] 无 N+1 查询
- [ ] 有适当缓存
- [ ] 有适当索引
