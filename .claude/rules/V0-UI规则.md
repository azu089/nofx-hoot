# V0 UI 生成规则（强制执行）

> 高保真 UI 必须使用 V0.app API 生成

---

## 核心原则

**高保真 UI 必须通过 V0 API 生成，生成后可以修改调整。**

### 工作流
1. **V0 生成** → 高保真 UI 原型
2. **人工调整** → 修复问题、优化交互、添加业务逻辑

---

## V0 API 配置

```bash
# .env.local
V0_API_KEY=v1:26xzL1Fetn3agA3ROiaUNYTQ:fBw2Cwh8TiDyiUEL9EKM4thK
```

---

## 设计系统规范（传给 V0）

```
Design System:
- Background: #0A0A0F (primary), #12121A (cards), #1A1A24 (elevated)
- Border: #1E1E2E
- Accent: #06B6D4 (cyan)
- Success: #22C55E, Error: #EF4444
- Text: #FFFFFF (primary), #94A3B8 (secondary), #64748B (tertiary)

Requirements:
- React 19 with TypeScript
- TailwindCSS for styling (no shadcn/ui for mobile)
- Mobile-first responsive design (390px width)
- Dark theme only
- Use lucide-react for icons
- Include proper TypeScript types
- Use "use client" directive for client components
- All text in Chinese (中文)
```

---

## 工作流程

### 1. 需求分析
- 确定页面/组件功能
- 列出所需的交互
- 确定数据结构

### 2. 编写 Prompt
- 使用中文描述需求
- 包含具体的 UI 元素
- 指定交互行为

### 3. 调用 V0 API
```bash
pnpm v0:generate
```

### 4. 获取代码
```bash
pnpm v0:fetch <chat-id>
```

### 5. 集成到项目
- 复制到对应目录
- 调整导出名称
- 添加到 preview 页面

---

## Prompt 模板

```
创建一个 [组件类型] 组件，功能如下：

页面结构：
- [描述布局]

功能点：
1. [功能1]
2. [功能2]
3. [功能3]

交互：
- [交互说明]

样式要求：
- 深色主题，背景 #0A0A0F
- 卡片背景 #12121A
- 边框 #1E1E2E
- 强调色 #06B6D4 (cyan)
- 所有文字中文
```

---

## 目录结构

```
apps/web/src/components/
├── ui-v3/
│   ├── mobile/           # 移动端组件（V0 生成）
│   │   ├── mobile-dashboard-v3.tsx
│   │   ├── mobile-strategies-v3.tsx
│   │   └── ...
│   └── desktop/          # 桌面端组件
└── ui/                   # shadcn/ui 基础组件
```

---

## 命名规范

| 类型 | 命名格式 | 示例 |
|------|---------|------|
| 移动端页面 | mobile-{page}-v3.tsx | mobile-dashboard-v3.tsx |
| 移动端组件 | mobile-{component}.tsx | mobile-nav.tsx |
| 桌面端页面 | {page}-page-v3.tsx | dashboard-page-v3.tsx |

---

## 禁止事项

1. **禁止不经过 V0 直接写新页面** - 新页面必须先用 V0 生成高保真原型
2. **禁止使用非设计系统颜色**
3. **禁止使用英文文案（除技术术语）**

## 允许事项

1. **允许修改 V0 生成的代码** - 修复 bug、优化交互、添加业务逻辑
2. **允许拆分/重构组件** - 基于 V0 生成的代码进行重构
3. **允许添加状态管理** - 接入 API、添加 hooks

---

## V0 生成后检查清单

- [ ] 导出名称正确（named export）
- [ ] 使用 "use client" 指令
- [ ] 颜色符合设计系统
- [ ] 文字全部中文化
- [ ] 添加无障碍属性（title, aria-label）
- [ ] 在 preview 页面可预览
