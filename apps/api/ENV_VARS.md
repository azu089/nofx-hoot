# API 环境变量说明

> 本文档记录所有 API 服务需要的环境变量配置

---

## 必需配置

| 变量名 | 说明 | 示例值 | 生成方式 |
|--------|------|--------|----------|
| `DATABASE_URL` | PostgreSQL 连接字符串 | `postgresql://user:pass@host:port/db` | - |
| `JWT_SECRET` | JWT 签名密钥 | 32+ 字符随机字符串 | `openssl rand -hex 32` |
| `ENCRYPTION_KEY` | API Key 加密密钥 (AES-256) | 32 字节字符串 | `openssl rand -hex 16` |

---

## Redis 配置

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `REDIS_HOST` | Redis 主机地址 | `localhost` |
| `REDIS_PORT` | Redis 端口 | `6379` |

---

## Webhook 签名验证

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `WEBHOOK_SECRET` | Webhook HMAC-SHA256 签名密钥 | 无（开发环境可留空） |

### 签名验证规则

1. **开发环境** (`NODE_ENV=development`) 且 `WEBHOOK_SECRET` 为空时，签名验证会被**跳过**
2. **生产环境** 必须配置 `WEBHOOK_SECRET`，否则所有 Webhook 请求会被拒绝

### Freqtrade Webhook 配置

Freqtrade 发送信号时需要在请求头添加签名：

```
X-Webhook-Signature: sha256=<hmac_hex>
```

签名计算方式：
```python
import hmac
import hashlib
import json

payload = json.dumps(data)
signature = hmac.new(
    WEBHOOK_SECRET.encode(),
    payload.encode(),
    hashlib.sha256
).hexdigest()

headers = {
    'X-Webhook-Signature': f'sha256={signature}'
}
```

---

## Freqtrade 配置

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `FREQTRADE_API_URL` | Freqtrade API 地址 | `http://localhost:8080` |
| `FREQTRADE_JWT_SECRET` | Freqtrade JWT 密钥（预留） | - |

---

## 服务配置

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `API_PORT` | API 服务端口 | `4001` |
| `NODE_ENV` | 运行环境 | `development` |

---

## 生产环境密钥生成

```bash
# 生成 JWT_SECRET (64 字符)
openssl rand -hex 32

# 生成 ENCRYPTION_KEY (32 字符)
openssl rand -hex 16

# 生成 WEBHOOK_SECRET (64 字符)
openssl rand -hex 32

# 生成 FREQTRADE_JWT_SECRET (64 字符)
openssl rand -hex 32
```

---

## 完整 .env 示例

```bash
# 数据库
DATABASE_URL="postgresql://quantfi:PASSWORD@localhost:5433/quantfi?schema=public"

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# 安全密钥（生产环境必须更换）
JWT_SECRET="your-64-char-jwt-secret-here"
ENCRYPTION_KEY="your-32-char-encryption-key"
WEBHOOK_SECRET="your-64-char-webhook-secret"

# Freqtrade
FREQTRADE_API_URL=http://localhost:8080
FREQTRADE_JWT_SECRET="your-freqtrade-jwt-secret"

# 服务
API_PORT=4001
NODE_ENV=production
```

---

## 注意事项

1. **永远不要**将 `.env` 文件提交到 Git
2. 生产环境的密钥必须使用强随机值
3. `ENCRYPTION_KEY` 变更后，已存储的 API Key 将无法解密
4. 开发环境可使用默认值，但生产环境必须全部配置

---

## 版本记录

| 日期 | 变更 |
|------|------|
| 2026-01-30 | 新增 WEBHOOK_SECRET 配置 |
| 2026-01-28 | 初始版本 |
