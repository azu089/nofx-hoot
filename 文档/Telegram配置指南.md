# Telegram Mini App 配置指南

## 一、BotFather 配置步骤

### 1. 创建机器人（如已创建可跳过）

1. 在 Telegram 中搜索 `@BotFather`
2. 发送 `/newbot`
3. 输入机器人名称（如：`QuantFi`）
4. 输入机器人用户名（如：`QuantFiBot`，必须以 Bot 结尾）
5. 保存返回的 Bot Token

### 2. 配置 Mini App

发送以下命令给 @BotFather：

```
/mybots
```

选择你的机器人，然后：

1. **设置 Web App URL**：
   ```
   Bot Settings → Menu Button → Configure menu button
   ```
   - 输入按钮文字：`打开 QuantFi`
   - 输入 Web App URL：`https://your-domain.com/tg`

2. **或者通过命令设置**：
   ```
   /setmenubutton
   ```
   选择机器人，然后输入 URL。

### 3. 设置机器人描述

```
/setdescription
```
输入机器人描述（用户点击机器人时看到）：
```
QuantFi - 专业量化交易平台

🚀 AI 量化策略
💰 安全资产管理
📊 实时交易监控
🎯 高胜率回测
```

### 4. 设置机器人头像

```
/setuserpic
```
上传机器人头像图片。

### 5. 设置 About 信息

```
/setabouttext
```
输入 About 信息：
```
QuantFi 量化交易 Mini App - 开启智能交易之旅
```

---

## 二、环境变量配置

在 `apps/api/.env` 中添加：

```bash
# Telegram Bot 配置
TELEGRAM_BOT_TOKEN=你的Bot Token
TELEGRAM_BOT_USERNAME=QuantFiBot
WEB_APP_URL=https://your-domain.com

# 开发环境
# WEB_APP_URL=http://localhost:3001
```

**重要**：
- `TELEGRAM_BOT_TOKEN` 必须保密，仅存于服务端
- 禁止将 Bot Token 提交到代码仓库
- 禁止在前端代码中使用 Bot Token

---

## 三、开发环境测试

### 方法 1：使用 ngrok 暴露本地服务

```bash
# 安装 ngrok
brew install ngrok

# 暴露前端服务
ngrok http 3001
```

获取 ngrok 生成的 HTTPS URL，配置到 BotFather。

### 方法 2：使用 Telegram Test Mode

1. 在 Telegram 设置中开启开发者模式
2. 选择 Test Mode 服务器
3. 在 Test Mode 下创建新机器人

---

## 四、Web App URL 设置步骤

### 1. 打开 BotFather

在 Telegram 搜索并打开 `@BotFather`。

### 2. 选择机器人

发送 `/mybots`，然后选择 `@QuantFiBot`。

### 3. 进入设置

点击 `Bot Settings`。

### 4. 配置菜单按钮

点击 `Menu Button` → `Configure menu button`。

### 5. 输入配置

- **Button text**: `打开 QuantFi`
- **Web App URL**: `https://your-domain.com/tg`

### 6. 确认设置

BotFather 会回复确认信息。

---

## 五、验证配置

### 1. 检查机器人响应

1. 在 Telegram 中搜索你的机器人
2. 点击 `START` 按钮
3. 应该看到左下角有「打开 QuantFi」按钮

### 2. 测试 Mini App 加载

1. 点击「打开 QuantFi」按钮
2. 应该看到 Mini App 界面加载
3. 检查是否能正常登录

### 3. 检查后端 API

```bash
# 测试后端是否能接收 Telegram 认证请求
curl -X POST http://localhost:4001/api/telegram/auth \
  -H "Content-Type: application/json" \
  -d '{"initData":"test"}'
```

应该返回错误（因为 initData 无效），但不应该是 500 错误。

---

## 六、常见问题

### Q1: Mini App 打不开

**可能原因**：
1. Web App URL 配置错误
2. HTTPS 证书问题
3. 服务器未启动

**解决方法**：
1. 确认 URL 正确且可访问
2. 使用有效的 HTTPS 证书
3. 检查服务是否正常运行

### Q2: 登录失败

**可能原因**：
1. Bot Token 配置错误
2. initData 签名验证失败
3. 认证数据过期

**解决方法**：
1. 检查 `.env` 中的 `TELEGRAM_BOT_TOKEN`
2. 查看后端日志定位具体错误
3. 确保客户端和服务器时间同步

### Q3: 开发时如何调试

1. 使用 ngrok 暴露本地服务
2. 在 Chrome DevTools 中查看 Console 日志
3. 使用 `console.log(window.Telegram?.WebApp)` 检查 SDK

---

## 七、安全检查清单

- [ ] Bot Token 仅存于服务端 `.env` 文件
- [ ] `.env` 文件已添加到 `.gitignore`
- [ ] initData 签名验证在后端进行
- [ ] 所有敏感操作都验证用户身份
- [ ] 设置了合理的 initData 过期时间（5分钟）
- [ ] 记录了登录日志（含 IP、时间、状态）

---

## 八、生产环境配置

### 1. 域名配置

```
WEB_APP_URL=https://app.quantfi.io
```

### 2. BotFather 设置

确保 Web App URL 指向生产环境域名。

### 3. 安全加固

- 使用 HTTPS
- 配置 CSP 头
- 设置 CORS 白名单
- 启用速率限制

### 4. 监控

- 监控登录成功/失败率
- 监控 API 响应时间
- 设置异常报警
