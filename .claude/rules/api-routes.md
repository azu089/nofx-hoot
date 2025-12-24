---
paths: apps/api/**/*.ts
---

# API 路由开发规则

当编辑 `apps/api/` 下的 TypeScript 文件时，自动应用以下规则：

## 必须包含

1. **请求验证**
   - 使用 class-validator 验证输入
   - 所有 DTO 必须有类型定义

2. **响应格式**
   ```typescript
   {
     code: 0,
     message: 'success',
     data: { ... },
     request_id: 'uuid'
   }
   ```

3. **错误处理**
   - 使用全局异常过滤器
   - 错误码范围：40000-50999

4. **日志记录**
   - 使用 NestJS Logger
   - 包含 request_id
   - 敏感信息脱敏

## 资金相关接口

- 金额字段使用 string（对应 DECIMAL）
- 使用 decimal.js 计算
- 计费操作必须幂等
