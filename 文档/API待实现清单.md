# QuantFi UI 优化 - 后端 API 待实现清单

> 本次前端 UI 优化新增了 2 个 API 调用，需要后端实现后才能完整运行

---

## 🔴 P0 - 充值地址获取 API

### 接口信息

**Endpoint**: `GET /api/wallet/deposit-address`

**Query 参数**:
```typescript
{
  chain: 'TRC20' | 'ERC20' | 'BEP20'  // 必填，链类型
}
```

**响应格式**:
```typescript
{
  code: 0,
  message: "success",
  data: {
    address: string;      // 充值地址，例如 "TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE"
    chain: string;        // 返回对应的链，例如 "TRC20"
    qrCode?: string;      // 可选：二维码图片的 base64 或 URL
  },
  request_id: "uuid"
}
```

**错误响应**:
```typescript
{
  code: 43001,
  message: "不支持的链类型",
  data: null,
  request_id: "uuid"
}
```

### 业务逻辑

1. 根据用户 ID 和链类型生成或查询对应的充值地址
2. 建议：每个用户 + 每条链 = 固定唯一地址（方便追踪）
3. 返回地址时可同时返回二维码（可选）

### 前端调用示例

```typescript
// 在 apps/web/src/lib/api.ts 中已定义
depositsApi.getDepositAddress('TRC20')
  .then(res => {
    console.log('充值地址:', res.data.address);
  })
  .catch(err => {
    console.error('获取失败:', err);
  });
```

---

## 🟡 P1 - K 线数据 API

### 接口信息

**Endpoint**: `GET /api/market/kline`

**Query 参数**:
```typescript
{
  symbol: string;      // 必填，交易对，例如 "BTC/USDT"
  interval: string;    // 必填，时间周期 "1m" | "5m" | "15m" | "1h" | "4h" | "1d"
  limit?: number;      // 可选，返回数量，默认 500，最大 1000
}
```

**响应格式**:
```typescript
{
  code: 0,
  message: "success",
  data: [
    {
      time: number;      // Unix timestamp（秒）
      open: number;      // 开盘价
      high: number;      // 最高价
      low: number;       // 最低价
      close: number;     // 收盘价
      volume: number;    // 成交量
    },
    // ... 更多 K 线数据
  ],
  request_id: "uuid"
}
```

### 业务逻辑

1. 可以从交易所 API 获取真实 K 线数据（如 Binance、OKX）
2. 建议缓存数据，避免频繁调用交易所 API
3. 数据按时间升序排列

### 前端调用示例

```typescript
// 在 apps/web/src/lib/api.ts 中已定义
klineApi.get('BTC/USDT', '1h', 500)
  .then(res => {
    console.log('K 线数据:', res.data);
  })
  .catch(err => {
    console.error('获取失败，使用模拟数据');
  });
```

### 降级策略

✅ **前端已实现降级保护**：当 API 失败时，自动切换到模拟数据，不影响用户体验。

---

## 📌 实现优先级

| API | 优先级 | 理由 |
|-----|--------|------|
| `/api/wallet/deposit-address` | 🔴 P0 | 充值功能必需，直接影响资金流转 |
| `/api/market/kline` | 🟡 P1 | 有模拟数据降级方案，不阻塞上线 |

---

## ✅ 验证方式

### 1. 充值地址 API

```bash
# 测试请求（需要 JWT Token）
curl -X GET "http://localhost:4001/api/wallet/deposit-address?chain=TRC20" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# 预期响应
{
  "code": 0,
  "message": "success",
  "data": {
    "address": "TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE",
    "chain": "TRC20"
  },
  "request_id": "..."
}
```

### 2. K 线数据 API

```bash
# 测试请求
curl -X GET "http://localhost:4001/api/market/kline?symbol=BTC/USDT&interval=1h&limit=100"

# 预期响应
{
  "code": 0,
  "message": "success",
  "data": [
    {
      "time": 1704067200,
      "open": 42150.5,
      "high": 42280.0,
      "low": 42100.0,
      "close": 42220.3,
      "volume": 1250.5
    },
    // ...
  ],
  "request_id": "..."
}
```

---

## 📝 备注

1. **前端已完成所有集成工作**，后端实现 API 后可立即使用
2. **降级保护完整**：所有 API 调用都有 try-catch 和失败处理
3. **用户体验不受影响**：API 未实现时，使用模拟数据或错误提示
4. **建议实现顺序**：先实现充值地址 API（P0），再实现 K 线 API（P1）

---

**文档生成时间**: 2025-12-31
**对应前端版本**: v1.15.0（UI 全局优化版本）
