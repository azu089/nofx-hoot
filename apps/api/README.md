# QuantFi 后端 API 服务

基于 NestJS 的后端 API 服务。

## 快速开始

### 1. 环境变量配置

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑 .env 文件，填写真实配置
```

### 2. 启动服务

```bash
# 开发模式
pnpm dev

# 生产构建
pnpm build
pnpm start:prod
```

### 3. 验证

```bash
# 健康检查
curl http://localhost:4001/api/health

# 数据库统计
curl http://localhost:4001/api/db/stats
```

## 环境变量说明

### 应用配置

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `NODE_ENV` | `development` | 运行环境 |
| `PORT` | `4001` | 服务端口 |
| `CORS_ORIGIN` | `http://localhost:3001` | CORS 允许来源 |

### 数据库配置

| 变量名 | 说明 |
|--------|------|
| `DATABASE_URL` | PostgreSQL 连接字符串 |
| `DB_POOL_MIN` | 连接池最小连接数（默认 2） |
| `DB_POOL_MAX` | 连接池最大连接数（默认 10） |

### Redis 配置

| 变量名 | 说明 |
|--------|------|
| `REDIS_HOST` | Redis 主机地址 |
| `REDIS_PORT` | Redis 端口 |
| `REDIS_PASSWORD` | Redis 密码 |
| `REDIS_DB` | Redis 数据库编号 |

### JWT 配置

| 变量名 | 说明 |
|--------|------|
| `JWT_SECRET` | JWT 签名密钥（生产环境必须修改） |
| `JWT_EXPIRES_IN` | JWT 过期时间 |
| `JWT_REFRESH_EXPIRES_IN` | 刷新 Token 过期时间 |

### 加密配置

| 变量名 | 说明 |
|--------|------|
| `ENCRYPTION_KEY` | AES-256-GCM 加密密钥（64 位十六进制字符串） |

生成方法：
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 配置模块使用

在代码中使用配置：

```typescript
import { ConfigService } from '@nestjs/config';

@Injectable()
export class YourService {
  constructor(private configService: ConfigService) {}

  someMethod() {
    // 读取应用配置
    const port = this.configService.get<number>('app.port');
    const nodeEnv = this.configService.get<string>('app.nodeEnv');

    // 读取数据库配置
    const databaseUrl = this.configService.get<string>('database.databaseUrl');

    // 读取 Redis 配置
    const redisHost = this.configService.get<string>('redis.host');
    const redisPort = this.configService.get<number>('redis.port');

    // 读取 JWT 配置
    const jwtSecret = this.configService.get<string>('jwt.secret');

    // 读取加密配置
    const encryptionKey = this.configService.get<string>('encryption.key');
  }
}
```

## 目录结构

```
apps/api/
├── src/
│   ├── config/              # 配置模块
│   │   ├── app.config.ts    # 应用配置
│   │   ├── database.config.ts # 数据库配置
│   │   ├── redis.config.ts  # Redis 配置
│   │   ├── jwt.config.ts    # JWT 配置
│   │   ├── encryption.config.ts # 加密配置
│   │   └── config.module.ts # 配置模块
│   ├── prisma/              # Prisma 模块
│   ├── app.module.ts        # 根模块
│   └── main.ts              # 入口文件
├── .env                     # 环境变量（不提交）
├── .env.example             # 环境变量模板
└── package.json
```

## 安全注意事项

### 开发环境

- 可以使用默认配置
- `.env` 文件不提交到 git

### 生产环境

**必须修改以下配置：**

1. `JWT_SECRET` - 使用强随机密钥
2. `ENCRYPTION_KEY` - 使用 64 位十六进制字符串（32 字节）
3. `DATABASE_URL` - 使用生产数据库
4. `REDIS_PASSWORD` - 使用强密码

**验证检查：**

- JWT_SECRET：生产环境自动检查，禁止包含 "default"、"change"
- ENCRYPTION_KEY：生产环境自动检查，必须是 64 位十六进制
- DATABASE_URL：自动验证格式，必须以 `postgresql://` 开头

## API 接口

### 健康检查

```
GET /api/health
```

响应示例：
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "status": "healthy",
    "service": "quantfi-api",
    "version": "0.1.0",
    "database": "connected",
    "timestamp": "2025-12-24T00:00:00.000Z"
  }
}
```

### 数据库统计

```
GET /api/db/stats
```

响应示例：
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "tables": ["users", "wallets", ...],
    "count": 10
  }
}
```

## 故障排查

### 端口被占用

```bash
# 查看占用 4001 端口的进程
lsof -ti:4001

# 杀掉进程
lsof -ti:4001 | xargs kill -9
```

### 配置验证失败

- 检查 `.env` 文件是否存在
- 检查环境变量格式是否正确
- 查看错误日志确定具体缺失的配置项

### 数据库连接失败

- 检查 `DATABASE_URL` 格式是否正确
- 确认 PostgreSQL 服务是否运行
- 检查用户名、密码、端口是否正确
