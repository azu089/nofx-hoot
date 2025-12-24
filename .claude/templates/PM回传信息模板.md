# PM 回传信息模板

> 遇到报错/问题时，PM 复制此模板填写并发送给 AI

---

## 排错信息模板

```
## 我做了什么
1. [操作步骤1]
2. [操作步骤2]
3. [操作步骤3]

## 预期结果
[应该看到什么]

## 实际结果
[实际看到什么 - 截图/日志/响应]

## 完整报错
```
[粘贴完整报错文本，不要截断]
```

## 环境信息
- OS: [macOS/Windows/Linux + 版本]
- Node: [v20.x]
- pnpm: [9.x]
- Docker: [是/否 + 版本]
- 代理/镜像: [是/否]
```

---

## 示例：npm install 报错

```
## 我做了什么
1. 进入项目目录 cd 主QuantFi
2. 执行 pnpm install

## 预期结果
应该看到依赖安装成功

## 实际结果
安装卡住很久后报错

## 完整报错
```
ERR_PNPM_FETCH_404  GET https://registry.npmjs.org/@nestjs%2fcore: Not Found - 404

 @nestjs/core@^10.0.0: Not found

FetchError: request to https://registry.npmjs.org/@nestjs%2fcore failed, reason: connect ETIMEDOUT 104.16.1.35:443
```

## 环境信息
- OS: macOS 14.0
- Node: v20.10.0
- pnpm: 9.0.0
- Docker: 是 v24.0.7
- 代理/镜像: 否
```

---

## 示例：服务启动报错

```
## 我做了什么
1. 执行 docker compose up -d
2. 等待服务启动

## 预期结果
应该看到所有容器 running

## 实际结果
api 容器不断重启

## 完整报错
```
quantfi-api-1  | Error: Cannot find module '@nestjs/common'
quantfi-api-1  | Require stack:
quantfi-api-1  | - /app/dist/main.js
quantfi-api-1  |     at Module._resolveFilename (node:internal/modules/cjs/loader:1144:15)
quantfi-api-1  |     at Module._load (node:internal/modules/cjs/loader:985:27)
quantfi-api-1 exited with code 1
```

## 环境信息
- OS: macOS 14.0
- Node: v20.10.0
- pnpm: 9.0.0
- Docker: 是 v24.0.7
- 代理/镜像: 否
```

---

## 示例：页面报错

```
## 我做了什么
1. 打开 http://localhost:3000/dashboard
2. 等待页面加载

## 预期结果
应该看到 Dashboard 页面

## 实际结果
页面白屏

## 完整报错
```
浏览器控制台：
Uncaught TypeError: Cannot read properties of undefined (reading 'user')
    at Dashboard (dashboard.tsx:15:23)
    at renderWithHooks (react-dom.development.js:14985:18)
```

## 环境信息
- OS: macOS 14.0
- 浏览器: Chrome 120
```

---

## AI 收到后的处理流程

1. 按《Bug修复流程.md》的报错翻译模板输出
2. 给出大白话解释
3. 列出最可能 3 个原因
4. 每个原因给检查步骤
5. 给出最小修复方案
