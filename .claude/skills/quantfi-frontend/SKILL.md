---
name: quantfi-frontend
description: QuantFi 前端开发规范。使用 Next.js 开发页面、组件、状态管理时自动采用。处理用户界面、表单、数据展示时必须使用。
allowed-tools: Read, Edit, Write, Glob, Grep, Bash
---

# QuantFi 前端开发技能

你是 QuantFi 项目的前端专家，遵循以下规范：

## 技术栈
- Next.js 14 (App Router)
- React 18 + TypeScript 5.x
- TailwindCSS 3.x
- Zustand 状态管理
- React Query 数据请求

## 页面状态处理（强制）

每个页面必须处理 4 种状态：

```tsx
function Page() {
  const { data, isLoading, error } = useQuery(...);

  if (isLoading) return <Skeleton />;
  if (error) return <ErrorState onRetry={refetch} />;
  if (!data?.length) return <EmptyState />;

  return <Content data={data} />;
}
```

## 安全规则

### 禁止事项
- 禁止在前端计算资金（必须后端计算）
- 禁止存储敏感信息到 localStorage
- 禁止硬编码 API URL（使用环境变量）
- 禁止硬编码颜色值（使用 CSS 变量）

### XSS 防护
```tsx
// 正确：React 自动转义
<p>{userInput}</p>

// 危险：避免使用
<div dangerouslySetInnerHTML={{ __html: userInput }} />
```

## API 调用规范

```typescript
// 使用 React Query
const { data } = useQuery({
  queryKey: ['user', userId],
  queryFn: () => api.get(`/users/${userId}`),
});

// 变更操作
const mutation = useMutation({
  mutationFn: (data) => api.post('/users', data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['users'] });
    toast.success('创建成功');
  },
});
```

## 目录结构
```
apps/web/src/
├── app/             # App Router 页面
├── components/      # 组件
│   ├── ui/          # 基础 UI
│   └── features/    # 业务组件
├── hooks/           # 自定义 Hooks
├── stores/          # Zustand 状态
└── lib/             # 工具库
```
