# QuantFi 前端配色迁移指南

> 版本: v1.0
> 更新日期: 2025-12-29
> 状态: 配色系统已统一，逐步迁移中

---

## 一、配色系统概览

### 1.1 新配色规范（华尔街风格）

QuantFi 前端采用**统一的 CSS 变量配色系统**，所有颜色值定义在 `globals.css` 中，通过 Tailwind 扩展类使用。

**核心原则**：
- **禁止硬编码颜色值**（如 `#0B0E11`, `#131722`）
- **禁止使用 Tailwind 内置灰色**（如 `bg-gray-900`, `bg-gray-800`）
- **必须使用语义化 CSS 变量或 Tailwind 扩展类**

---

## 二、配色映射表

### 2.1 背景色映射

| 旧写法（禁止） | 新写法（推荐） | 说明 |
|--------------|--------------|------|
| `#0B0E11` | `bg-bg-primary` 或 `bg-[var(--bg-primary)]` | 主背景 |
| `#131722` | `bg-bg-secondary` | 卡片背景 |
| `#1E222D` | `bg-bg-tertiary` | 输入框/悬浮 |
| `bg-gray-900` | `bg-bg-primary` | 主背景 |
| `bg-gray-800` | `bg-bg-secondary` | 卡片背景 |
| `bg-gray-700` | `bg-bg-tertiary` | 输入框 |

**示例**：
```tsx
// ❌ 错误写法
<div className="bg-gray-900 border border-gray-800">

// ✅ 正确写法
<div className="bg-bg-primary border border-border-primary">
```

---

### 2.2 品牌色映射

| 旧写法（禁止） | 新写法（推荐） | 说明 |
|--------------|--------------|------|
| `#3772FF` | `bg-brand-primary` 或 `text-brand-primary` | 主品牌色 |
| `#2962FF` | `bg-brand-secondary` | 悬浮态 |
| `bg-blue-600` | `bg-brand-primary` | 主按钮 |
| `bg-blue-500` | `bg-brand-primary` | 链接 |

**示例**：
```tsx
// ❌ 错误写法
<button className="bg-blue-600 hover:bg-blue-500">

// ✅ 正确写法
<button className="bg-brand-primary hover:bg-brand-secondary">
```

---

### 2.3 语义色映射

| 旧写法（禁止） | 新写法（推荐） | 说明 |
|--------------|--------------|------|
| `#00C087` | `text-success` | 盈利/涨 |
| `#F23645` | `text-danger` | 亏损/跌 |
| `#F7931A` | `text-warning` | 警告 |
| `bg-green-500` | `bg-success` | 成功背景 |
| `bg-red-500` | `bg-danger` | 错误背景 |
| `text-green-500` | `text-success` | 盈利文字 |
| `text-red-500` | `text-danger` | 亏损文字 |

**示例**：
```tsx
// ❌ 错误写法
<span className="text-green-500">+$123.45</span>

// ✅ 正确写法
<span className="text-success">+$123.45</span>
```

---

### 2.4 文字色映射

| 旧写法（禁止） | 新写法（推荐） | 说明 |
|--------------|--------------|------|
| `text-white` | `text-text-primary` | 主文字 |
| `text-gray-400` | `text-text-secondary` | 次要文字 |
| `text-gray-500` | `text-text-tertiary` | 辅助文字 |
| `text-gray-600` | `text-text-disabled` | 禁用文字 |

**示例**：
```tsx
// ❌ 错误写法
<p className="text-white">总资产</p>
<span className="text-gray-400">USD</span>

// ✅ 正确写法
<p className="text-text-primary">总资产</p>
<span className="text-text-secondary">USD</span>
```

---

### 2.5 边框色映射

| 旧写法（禁止） | 新写法（推荐） | 说明 |
|--------------|--------------|------|
| `border-gray-800` | `border-border-primary` | 主边框 |
| `border-gray-700` | `border-border-secondary` | 次级边框 |
| `focus:border-blue-500` | `focus:border-border-focus` | 聚焦边框 |

**示例**：
```tsx
// ❌ 错误写法
<input className="border border-gray-800 focus:border-blue-500" />

// ✅ 正确写法
<input className="border border-border-primary focus:border-border-focus" />
```

---

## 三、常见场景迁移示例

### 3.1 卡片组件

```tsx
// ❌ 旧写法
<div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
  <h3 className="text-white text-lg mb-4">标题</h3>
  <p className="text-gray-400">内容</p>
</div>

// ✅ 新写法
<div className="bg-bg-secondary border border-border-primary rounded-lg p-6">
  <h3 className="text-text-primary text-lg mb-4">标题</h3>
  <p className="text-text-secondary">内容</p>
</div>
```

---

### 3.2 按钮组件

```tsx
// ❌ 旧写法
<button className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded">
  提交
</button>

// ✅ 新写法
<button className="bg-brand-primary hover:bg-brand-secondary text-white px-4 py-2 rounded-sm">
  提交
</button>
```

---

### 3.3 盈亏显示

```tsx
// ❌ 旧写法
<span className={pnl > 0 ? 'text-green-500' : 'text-red-500'}>
  {pnl > 0 ? '+' : ''}{pnl}%
</span>

// ✅ 新写法
<span className={pnl > 0 ? 'text-success' : 'text-danger'}>
  {pnl > 0 ? '+' : ''}{pnl}%
</span>
```

---

### 3.4 输入框组件

```tsx
// ❌ 旧写法
<input
  className="bg-gray-900 border border-gray-700 text-white rounded px-3 py-2 focus:border-blue-500"
/>

// ✅ 新写法
<input
  className="bg-bg-tertiary border border-border-primary text-text-primary rounded-sm px-3 py-2 focus:border-border-focus"
/>
```

---

### 3.5 表格组件

```tsx
// ❌ 旧写法
<table className="w-full">
  <thead className="bg-gray-800">
    <tr className="border-b border-gray-700">
      <th className="text-gray-400 px-4 py-3">列名</th>
    </tr>
  </thead>
  <tbody>
    <tr className="border-b border-gray-700 hover:bg-gray-800/50">
      <td className="text-white px-4 py-3">数据</td>
    </tr>
  </tbody>
</table>

// ✅ 新写法
<table className="w-full">
  <thead className="bg-bg-secondary">
    <tr className="border-b border-border-primary">
      <th className="text-text-secondary px-4 py-3">列名</th>
    </tr>
  </thead>
  <tbody>
    <tr className="border-b border-border-primary hover:bg-bg-secondary/50">
      <td className="text-text-primary px-4 py-3">数据</td>
    </tr>
  </tbody>
</table>
```

---

## 四、特殊样式类

### 4.1 工具类

| 类名 | 用途 | 示例 |
|-----|------|------|
| `.profit` | 盈利文字 | `<span className="profit">+$123</span>` |
| `.loss` | 亏损文字 | `<span className="loss">-$45</span>` |
| `.glass` | 玻璃毛玻璃效果 | `<div className="glass">...</div>` |
| `.bg-gradient-dark` | 深色渐变背景 | `<div className="bg-gradient-dark">...</div>` |
| `.bg-gradient-brand` | 品牌渐变背景 | `<button className="bg-gradient-brand">...</button>` |
| `.font-numeric` | 等宽数字字体 | `<span className="font-numeric">$12,345.67</span>` |

---

### 4.2 金额显示规范

**所有金额必须使用 `font-numeric` 类**，确保数字等宽对齐：

```tsx
// ❌ 错误
<div className="text-4xl text-white">$12,345.67</div>

// ✅ 正确
<div className="text-4xl text-text-primary font-numeric">$12,345.67</div>
```

---

## 五、迁移检查清单

在修改组件时，按以下步骤检查：

- [ ] 背景色是否使用 `bg-bg-*` 系列
- [ ] 文字色是否使用 `text-text-*` 系列
- [ ] 边框色是否使用 `border-border-*` 系列
- [ ] 品牌色是否使用 `bg-brand-*` / `text-brand-*`
- [ ] 盈亏色是否使用 `text-success` / `text-danger`
- [ ] 金额是否使用 `font-numeric` 类
- [ ] 是否移除了硬编码的 HEX 颜色值
- [ ] 是否移除了 Tailwind 内置灰色（`bg-gray-*`）

---

## 六、渐进式迁移策略

### 6.1 优先级

1. **P0（立即修改）**：新开发的页面/组件
2. **P1（本周内）**：核心页面（Dashboard, Trading, Wallet）
3. **P2（本月内）**：其他用户页面
4. **P3（下月）**：管理后台、代理商后台

### 6.2 迁移流程

1. 读取要修改的文件
2. 按映射表替换颜色值
3. 本地验证视觉效果（`pnpm dev`）
4. 提交前检查清单全部通过
5. 提交时注明「配色迁移」

---

## 七、常见问题 FAQ

### Q1: 为什么不直接用 `bg-[#0B0E11]`？
**A**: 硬编码颜色值无法统一修改。使用 CSS 变量后，只需修改 `globals.css` 即可全局更新主题。

### Q2: Tailwind 内置的 `bg-gray-900` 为什么不能用？
**A**: Tailwind 的灰色是通用的，不符合 QuantFi 的华尔街风格。我们的 `--bg-primary` 是深黑蓝色，更专业。

### Q3: 如果找不到对应的 Tailwind 类怎么办？
**A**: 使用 `[var(--xxx)]` 语法，例如：`bg-[var(--bg-primary)]`

### Q4: 旧的 CSS 变量（`--background`、`--primary`）还能用吗？
**A**: 可以，但建议逐步迁移到新变量。旧变量会在 v2.0 移除。

---

## 八、技术支持

遇到问题时：
1. 查看 `UI_ARCHITECTURE.md` 第一章配色规范
2. 查看 `globals.css` 中的 CSS 变量定义
3. 查看 `tailwind.config.js` 中的 Tailwind 扩展

---

**最后更新**: 2025-12-29
**维护者**: QuantFi 前端团队
