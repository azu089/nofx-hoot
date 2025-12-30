# QuantFi 配色系统使用示例

> 实际代码示例，展示如何使用新的配色系统

---

## 1. 页面布局示例

### 1.1 标准页面结构

```tsx
export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-bg-primary">
      {/* 页面容器 */}
      <div className="container mx-auto px-4 py-6">

        {/* 页面标题 */}
        <h1 className="text-3xl font-bold text-text-primary mb-6">
          仪表盘
        </h1>

        {/* 卡片网格 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 资产卡片 */}
          <div className="bg-bg-secondary border border-border-primary rounded-lg p-6">
            <p className="text-text-secondary text-sm mb-2">总资产</p>
            <h2 className="text-4xl font-bold text-text-primary font-numeric">
              $12,345.67
            </h2>
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

## 2. 卡片组件示例

### 2.1 基础卡片

```tsx
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-bg-secondary border border-border-primary rounded-lg p-6 shadow-md">
      <h3 className="text-text-primary text-lg font-semibold mb-4">
        {title}
      </h3>
      <div className="text-text-secondary">
        {children}
      </div>
    </div>
  );
}
```

### 2.2 带渐变的高亮卡片

```tsx
function HighlightCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="bg-gradient-brand rounded-lg p-6 shadow-lg">
      <p className="text-white/80 text-sm mb-2">{title}</p>
      <h2 className="text-4xl font-bold text-white font-numeric">
        {value}
      </h2>
    </div>
  );
}
```

### 2.3 玻璃毛玻璃卡片

```tsx
function GlassCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="glass rounded-lg p-6">
      {children}
    </div>
  );
}
```

---

## 3. 按钮组件示例

### 3.1 主按钮

```tsx
function PrimaryButton({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="bg-brand-primary hover:bg-brand-secondary text-white px-4 py-2 rounded-sm transition-colors"
    >
      {children}
    </button>
  );
}
```

### 3.2 次要按钮

```tsx
function SecondaryButton({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="bg-bg-tertiary hover:bg-bg-secondary border border-border-primary text-text-primary px-4 py-2 rounded-sm transition-colors"
    >
      {children}
    </button>
  );
}
```

### 3.3 危险按钮

```tsx
function DangerButton({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="bg-danger hover:bg-danger/80 text-white px-4 py-2 rounded-sm transition-colors"
    >
      {children}
    </button>
  );
}
```

---

## 4. 表单组件示例

### 4.1 输入框

```tsx
function Input({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="mb-4">
      <label className="block text-text-secondary text-sm mb-2">
        {label}
      </label>
      <input
        {...props}
        className="w-full bg-bg-tertiary border border-border-primary text-text-primary rounded-sm px-3 py-2 focus:border-border-focus focus:outline-none transition-colors"
      />
    </div>
  );
}
```

### 4.2 选择框

```tsx
function Select({ label, options }: { label: string; options: string[] }) {
  return (
    <div className="mb-4">
      <label className="block text-text-secondary text-sm mb-2">
        {label}
      </label>
      <select className="w-full bg-bg-tertiary border border-border-primary text-text-primary rounded-sm px-3 py-2 focus:border-border-focus focus:outline-none">
        {options.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    </div>
  );
}
```

---

## 5. 盈亏显示示例

### 5.1 动态颜色盈亏

```tsx
function PnLDisplay({ value }: { value: number }) {
  const isProfit = value >= 0;

  return (
    <span className={isProfit ? 'text-success' : 'text-danger'}>
      {isProfit ? '+' : ''}{value.toFixed(2)}%
    </span>
  );
}
```

### 5.2 带背景的盈亏标签

```tsx
function PnLBadge({ value }: { value: number }) {
  const isProfit = value >= 0;

  return (
    <div className={`inline-flex items-center px-2 py-1 rounded-full ${
      isProfit ? 'bg-success-bg text-success' : 'bg-danger-bg text-danger'
    }`}>
      {isProfit ? '↑' : '↓'} {Math.abs(value).toFixed(2)}%
    </div>
  );
}
```

---

## 6. 表格组件示例

### 6.1 标准表格

```tsx
function Table({ data }: { data: any[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-bg-secondary">
          <tr className="border-b border-border-primary">
            <th className="text-text-secondary text-left px-4 py-3 text-sm font-medium">
              币种
            </th>
            <th className="text-text-secondary text-right px-4 py-3 text-sm font-medium">
              数量
            </th>
            <th className="text-text-secondary text-right px-4 py-3 text-sm font-medium">
              盈亏
            </th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => (
            <tr
              key={idx}
              className="border-b border-border-primary hover:bg-bg-secondary/50 transition-colors"
            >
              <td className="text-text-primary px-4 py-3">
                {row.symbol}
              </td>
              <td className="text-text-primary text-right px-4 py-3 font-numeric">
                {row.amount}
              </td>
              <td className={`text-right px-4 py-3 font-numeric ${
                row.pnl >= 0 ? 'text-success' : 'text-danger'
              }`}>
                {row.pnl >= 0 ? '+' : ''}{row.pnl}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

---

## 7. 状态提示示例

### 7.1 成功提示

```tsx
function SuccessAlert({ message }: { message: string }) {
  return (
    <div className="bg-success-bg border border-success rounded-sm p-4 mb-4">
      <p className="text-success">{message}</p>
    </div>
  );
}
```

### 7.2 错误提示

```tsx
function ErrorAlert({ message }: { message: string }) {
  return (
    <div className="bg-danger-bg border border-danger rounded-sm p-4 mb-4">
      <p className="text-danger">{message}</p>
    </div>
  );
}
```

### 7.3 警告提示

```tsx
function WarningAlert({ message }: { message: string }) {
  return (
    <div className="bg-warning-bg border border-warning rounded-sm p-4 mb-4">
      <p className="text-warning">{message}</p>
    </div>
  );
}
```

---

## 8. 模态框示例

```tsx
function Modal({ isOpen, onClose, title, children }: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 遮罩层 */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* 模态框内容 */}
      <div className="relative bg-bg-secondary border border-border-primary rounded-xl p-6 max-w-md w-full mx-4 shadow-lg">
        <h2 className="text-text-primary text-xl font-semibold mb-4">
          {title}
        </h2>

        <div className="text-text-secondary mb-6">
          {children}
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="bg-bg-tertiary border border-border-primary text-text-primary px-4 py-2 rounded-sm hover:bg-bg-primary transition-colors"
          >
            取消
          </button>
          <button
            className="bg-brand-primary hover:bg-brand-secondary text-white px-4 py-2 rounded-sm transition-colors"
          >
            确认
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

## 9. 导航组件示例

### 9.1 侧边栏导航项

```tsx
function NavItem({ icon, label, active }: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
}) {
  return (
    <a
      href="#"
      className={`flex items-center gap-3 px-4 py-3 rounded-sm transition-colors ${
        active
          ? 'bg-brand-primary text-white'
          : 'text-text-secondary hover:bg-bg-tertiary hover:text-text-primary'
      }`}
    >
      {icon}
      <span>{label}</span>
    </a>
  );
}
```

---

## 10. 金额显示规范

**所有金额必须使用 `font-numeric` 类**：

```tsx
function BalanceCard({ balance }: { balance: string }) {
  return (
    <div className="bg-bg-secondary border border-border-primary rounded-lg p-6">
      <p className="text-text-secondary text-sm mb-2">可用余额</p>
      <h2 className="text-4xl font-bold text-text-primary font-numeric">
        ${balance}
      </h2>
      <p className="text-text-tertiary text-sm mt-2 font-numeric">
        ≈ {balance} USDT
      </p>
    </div>
  );
}
```

---

## 11. 响应式布局示例

```tsx
function ResponsiveGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {/* 卡片在移动端单列，平板双列，桌面三列 */}
      <div className="bg-bg-secondary border border-border-primary rounded-lg p-6">
        卡片 1
      </div>
      <div className="bg-bg-secondary border border-border-primary rounded-lg p-6">
        卡片 2
      </div>
      <div className="bg-bg-secondary border border-border-primary rounded-lg p-6">
        卡片 3
      </div>
    </div>
  );
}
```

---

## 12. 加载状态示例

### 12.1 骨架屏

```tsx
function Skeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-4 bg-bg-tertiary rounded mb-2"></div>
      <div className="h-8 bg-bg-tertiary rounded mb-4"></div>
      <div className="h-4 bg-bg-tertiary rounded w-2/3"></div>
    </div>
  );
}
```

### 12.2 加载中状态

```tsx
function LoadingButton({ loading, children }: { loading: boolean; children: React.ReactNode }) {
  return (
    <button
      disabled={loading}
      className="bg-brand-primary hover:bg-brand-secondary disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-sm transition-colors flex items-center gap-2"
    >
      {loading && (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      )}
      {children}
    </button>
  );
}
```

---

**提示**: 以上所有示例都遵循 QuantFi 华尔街风格配色规范，可直接复制使用。
