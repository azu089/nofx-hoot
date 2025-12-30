# WebSocket 测试指南

## 概述

QuantFi 后端已集成 Socket.io WebSocket 支持，用于实时推送交易日志、状态变更和新交易通知。

## 连接信息

- **URL**: `http://localhost:4001/events`
- **协议**: Socket.io
- **认证**: JWT Token（必须）

## 事件通道

| 通道 | 说明 | 数据格式 |
|------|------|----------|
| `connected` | 连接成功通知 | `{ message, userId, timestamp }` |
| `logs` | 交易日志流 | `{ instanceId, log: { message, level, meta }, timestamp }` |
| `status` | 状态变更通知 | `{ status: { type, instanceId, status, reason }, timestamp }` |
| `trades` | 新交易通知 | `{ trade, timestamp }` |
| `heartbeat` | 心跳数据 | `{ instanceId, heartbeat, timestamp }` |

## 测试方法

### 1. 使用 Socket.io 客户端（Node.js）

```bash
# 安装依赖
pnpm add socket.io-client

# 创建测试脚本 test-websocket.js
```

```javascript
const io = require('socket.io-client');

// 替换为实际的 JWT token
const TOKEN = 'your_jwt_token_here';

// 连接 WebSocket
const socket = io('http://localhost:4001/events', {
  auth: {
    token: TOKEN,
  },
});

// 监听连接成功
socket.on('connect', () => {
  console.log('✅ WebSocket 连接成功:', socket.id);
});

// 监听连接成功消息
socket.on('connected', (data) => {
  console.log('📩 收到欢迎消息:', data);

  // 订阅某个实例的日志流
  socket.emit('subscribe:logs', { instanceId: 'your_instance_id' }, (response) => {
    console.log('📝 订阅日志流响应:', response);
  });
});

// 监听日志流
socket.on('logs', (data) => {
  console.log('📄 日志:', data);
});

// 监听状态变更
socket.on('status', (data) => {
  console.log('🔔 状态变更:', data);
});

// 监听新交易
socket.on('trades', (data) => {
  console.log('💰 新交易:', data);
});

// 监听心跳
socket.on('heartbeat', (data) => {
  console.log('💓 心跳:', data);
});

// 监听断开连接
socket.on('disconnect', (reason) => {
  console.log('❌ WebSocket 断开:', reason);
});

// 监听错误
socket.on('error', (error) => {
  console.error('⚠️ WebSocket 错误:', error);
});

// 每 10 秒发送一次 ping
setInterval(() => {
  socket.emit('ping', {}, (response) => {
    console.log('🏓 Pong:', response);
  });
}, 10000);
```

```bash
# 运行测试
node test-websocket.js
```

### 2. 使用浏览器控制台（前端）

```html
<!-- 在 HTML 中引入 Socket.io -->
<script src="https://cdn.socket.io/4.8.1/socket.io.min.js"></script>
<script>
  // 替换为实际的 JWT token
  const TOKEN = 'your_jwt_token_here';

  // 连接 WebSocket
  const socket = io('http://localhost:4001/events', {
    auth: {
      token: TOKEN,
    },
  });

  // 监听连接成功
  socket.on('connect', () => {
    console.log('✅ WebSocket 连接成功:', socket.id);
  });

  // 监听连接成功消息
  socket.on('connected', (data) => {
    console.log('📩 收到欢迎消息:', data);

    // 订阅某个实例的日志流
    socket.emit('subscribe:logs', { instanceId: 'your_instance_id' }, (response) => {
      console.log('📝 订阅日志流响应:', response);
    });
  });

  // 监听日志流
  socket.on('logs', (data) => {
    console.log('📄 日志:', data);
  });

  // 监听状态变更
  socket.on('status', (data) => {
    console.log('🔔 状态变更:', data);
  });

  // 监听新交易
  socket.on('trades', (data) => {
    console.log('💰 新交易:', data);
  });

  // 监听心跳
  socket.on('heartbeat', (data) => {
    console.log('💓 心跳:', data);
  });
</script>
```

### 3. 使用 Postman（需要 Postman 桌面版）

1. 打开 Postman
2. 创建新的 WebSocket 请求
3. URL: `ws://localhost:4001/socket.io/?EIO=4&transport=websocket`
4. 在 Headers 中添加认证（Socket.io 握手需要特殊处理）

**注意**: Socket.io 使用自定义协议，不是原生 WebSocket，推荐使用 Socket.io 客户端库测试。

## 获取 JWT Token

```bash
# 1. 先登录获取 token
curl -X POST http://localhost:4001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your_email@example.com",
    "password": "your_password"
  }'

# 响应中会包含 access_token，复制它
# {
#   "code": 0,
#   "message": "登录成功",
#   "data": {
#     "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
#     "user": { ... }
#   }
# }
```

## 触发 WebSocket 推送的操作

### 1. 触发日志推送

创建 VPS 实例时会自动推送日志：

```bash
curl -X POST http://localhost:4001/api/instances \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "region": "sgp1",
    "size": "s-1vcpu-1gb"
  }'
```

预期 WebSocket 收到：
```json
{
  "instanceId": "xxx",
  "log": {
    "message": "VPS 实例创建成功，IP: 1.2.3.4",
    "level": "info",
    "meta": { "dropletId": "123456" },
    "timestamp": "2025-12-26T12:00:00.000Z"
  },
  "timestamp": "2025-12-26T12:00:00.000Z"
}
```

### 2. 触发状态变更推送

销毁 VPS 实例时会推送状态变更：

```bash
curl -X DELETE http://localhost:4001/api/instances/{instanceId} \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "reason": "手动销毁测试"
  }'
```

预期 WebSocket 收到：
```json
{
  "status": {
    "type": "instance_status_change",
    "instanceId": "xxx",
    "status": "destroyed",
    "reason": "手动销毁测试",
    "timestamp": "2025-12-26T12:00:00.000Z"
  },
  "timestamp": "2025-12-26T12:00:00.000Z"
}
```

### 3. 触发僵尸节点告警

等待实例 15 分钟无心跳，自动触发僵尸节点检测任务（每 5 分钟运行一次）。

预期 WebSocket 收到：
```json
{
  "instanceId": "xxx",
  "log": {
    "message": "实例心跳超时（15分钟无响应），已标记为僵尸节点",
    "level": "error",
    "meta": { "lastHeartbeat": "2025-12-26T11:45:00.000Z" },
    "timestamp": "2025-12-26T12:00:00.000Z"
  },
  "timestamp": "2025-12-26T12:00:00.000Z"
}
```

## 常见问题

### Q1: 连接失败 "Connection refused"

**原因**: 后端服务未启动或端口错误

**解决**:
```bash
# 检查后端是否运行
cd /Users/azu/主QuantFi/apps/api
pnpm dev

# 确认监听端口 4001
```

### Q2: 连接被拒绝 "Authentication failed"

**原因**: JWT token 无效或过期

**解决**:
```bash
# 重新登录获取新的 token
curl -X POST http://localhost:4001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{ "email": "test@example.com", "password": "password123" }'
```

### Q3: 订阅日志流后收不到消息

**原因**: 实例 ID 错误或没有触发日志推送

**解决**:
```bash
# 1. 确认实例 ID 正确
curl http://localhost:4001/api/instances \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# 2. 触发一个操作（如创建/销毁实例）来产生日志
```

## 服务端日志查看

启动后端时，可以看到 WebSocket 连接日志：

```bash
cd /Users/azu/主QuantFi/apps/api
pnpm dev

# 预期日志：
# [EventsGateway] WebSocket Gateway 已初始化
# [EventsGateway] 用户 xxx 连接成功 (Socket: yyy), 当前连接数: 1
# [EventsGateway] 用户 xxx 订阅日志流: 实例 zzz
# [EventsGateway] 推送日志到实例 zzz: VPS 实例创建成功
```

## 下一步

1. 前端集成 Socket.io 客户端
2. 实现实时日志流展示
3. 实现状态变更通知 Toast
4. 实现新交易实时推送
