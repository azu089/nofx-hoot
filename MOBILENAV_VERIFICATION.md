# MobileNav 组件验证说明

## 已完成

1. 创建 `/apps/web/src/components/layout/MobileNav.tsx` - 移动端底部导航组件
2. 更新 `/apps/web/src/components/layout/index.ts` - 导出 MobileNav
3. 更新 `/apps/web/src/app/(dashboard)/layout.tsx` - 集成 MobileNav

## 组件特性

### 5 个 Tab
| Tab | 图标 | 路由 | 说明 |
|-----|------|------|------|
| 首页 | Home | /dashboard | 仪表盘 |
| 交易 | TrendingUp | /trading | 交易控制台 |
| 策略 | Zap | /strategies | 策略市场 |
| 资产 | Wallet | /wallet | 资产钱包 |
| 我的 | User | /settings | 设置 |

### 设计规范
- 背景色：#131722 (--bg-secondary)
- 边框：1px solid #2B3139 (--border-primary)
- 高亮色：#3772FF (--brand-primary)
- 默认色：#848E9C (--text-secondary)
- 高度：64px (h-16)

### 响应式
- 移动端/平板（< 1024px）：显示底部导航
- 桌面端（>= 1024px）：隐藏（使用侧边栏）

### 布局调整
- main 元素添加 `pb-16 lg:pb-0` 确保移动端内容不被底部导航遮挡

## 验收方式

### 1. 桌面端（宽屏）
- 打开 http://localhost:3001/dashboard
- 调整浏览器宽度 > 1024px
- **预期**：底部导航隐藏，使用左侧边栏

### 2. 移动端（窄屏）
- 打开 http://localhost:3001/dashboard
- 调整浏览器宽度 < 768px（或使用开发者工具的移动设备模式）
- **预期**：
  - 底部显示 5 个 Tab
  - 当前页面 Tab 高亮为蓝色 (#3772FF)
  - 其他 Tab 为灰色 (#848E9C)
  - 点击 Tab 可跳转对应页面
  - 内容区域底部有足够的 padding（64px）不被导航遮挡

### 3. 切换测试
依次访问以下页面，观察底部导航高亮是否正确：
- /dashboard - 首页高亮
- /trading - 交易高亮
- /strategies - 策略高亮
- /wallet - 资产高亮
- /settings - 我的高亮

## 技术细节

### 图标来源
- lucide-react（已安装）
- 5 个图标：Home, TrendingUp, Zap, Wallet, User

### 路由匹配
使用正则表达式匹配当前路径：
- `/dashboard` 精确匹配
- `/trading*` 前缀匹配（包括子路由）
- `/strategies*` 前缀匹配
- `/wallet*` 前缩匹配
- `/settings*` 前缀匹配

### CSS 类
- `fixed bottom-0 left-0 right-0` - 固定在底部
- `z-50` - 确保在最上层
- `lg:hidden` - 大屏隐藏
- `flex items-center justify-around h-16` - Flexbox 布局

## 回滚方案

如需回滚：

```bash
# 删除 MobileNav 组件
rm /Users/azu/主QuantFi/apps/web/src/components/layout/MobileNav.tsx

# 还原 index.ts
git checkout apps/web/src/components/layout/index.ts

# 还原 layout.tsx
git checkout apps/web/src/app/(dashboard)/layout.tsx
```

## 状态
✅ 编译通过（开发服务器运行中）
✅ 组件已创建
✅ 布局已集成
⏳ 等待 PM 在浏览器中验收
