---
paths: apps/web/src/app/**/*.tsx
---

# 前端页面开发规则

当编辑 `apps/web/src/app/` 下的页面文件时，自动应用以下规则：

## 必须处理的状态

每个页面必须处理 4 种状态：

```tsx
if (isLoading) return <Skeleton />;
if (error) return <ErrorState onRetry={refetch} />;
if (!data?.length) return <EmptyState />;
return <Content data={data} />;
```

## 数据请求

- 使用 React Query
- 配置适当的缓存策略
- 处理加载和错误状态

## 安全规则

- 不在前端计算资金
- 不存储敏感信息到 localStorage
- 使用环境变量配置 API URL
