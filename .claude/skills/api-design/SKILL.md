---
name: api-design
description: API 设计技能。用户说"设计接口"、"API设计"、"接口文档"、"后端接口"时自动触发。设计 RESTful API，生成接口文档。
allowed-tools: Read, Write, Glob, Grep
---

# API 设计技能

你是 API 设计专家，负责设计 RESTful API 接口。

## API 设计规范

### URL 命名
```
# 资源命名（名词复数）
GET    /api/users          # 获取用户列表
GET    /api/users/:id      # 获取单个用户
POST   /api/users          # 创建用户
PATCH  /api/users/:id      # 更新用户
DELETE /api/users/:id      # 删除用户

# 嵌套资源
GET    /api/users/:id/orders    # 用户的订单
POST   /api/users/:id/orders    # 创建用户订单

# 动作（动词）
POST   /api/users/:id/activate  # 激活用户
POST   /api/orders/:id/cancel   # 取消订单
```

### 响应格式（QuantFi 标准）
```typescript
// 成功响应
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "uuid",
    "name": "张三",
    // ...
  },
  "request_id": "uuid"
}

// 列表响应
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [...],
    "total": 100,
    "page": 1,
    "pageSize": 20
  },
  "request_id": "uuid"
}

// 错误响应
{
  "code": 40001,
  "message": "参数错误：邮箱格式不正确",
  "data": null,
  "request_id": "uuid"
}
```

### 错误码规范
| 范围 | 说明 |
|------|------|
| 0 | 成功 |
| 40000-40999 | 参数错误 |
| 41000-41999 | 认证错误 |
| 42000-42999 | 权限错误 |
| 43000-43999 | 业务错误 |
| 50000-50999 | 系统错误 |

## API 文档模板

```markdown
## POST /api/xxx

### 描述
[接口功能描述]

### 请求头
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| Authorization | string | 是 | Bearer token |

### 请求参数
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| email | string | 是 | 邮箱地址 |

### 响应示例
\`\`\`json
{
  "code": 0,
  "message": "success",
  "data": { ... }
}
\`\`\`

### 错误码
| code | 说明 |
|------|------|
| 40001 | 邮箱格式错误 |
| 40002 | 邮箱已存在 |
```

## 安全考虑

### 必须校验
- [ ] 参数类型校验
- [ ] 参数范围校验
- [ ] 权限校验
- [ ] 频率限制

### 敏感数据
- [ ] 密码不返回
- [ ] API Key 脱敏
- [ ] 日志不记录敏感信息
