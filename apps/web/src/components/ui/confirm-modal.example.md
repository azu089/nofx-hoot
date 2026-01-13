# ConfirmModal 组件使用示例

## 基本用法

### 1. 普通确认弹窗

```tsx
import { useState } from 'react';
import { ConfirmModal, useToast } from '@/components/ui';

function MyComponent() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const handleConfirm = async () => {
    setLoading(true);
    try {
      // 执行操作
      await someAsyncOperation();
      toast.success('操作成功');
      setOpen(false);
    } catch (error) {
      toast.error('操作失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button onClick={() => setOpen(true)}>删除</button>

      <ConfirmModal
        open={open}
        onOpenChange={setOpen}
        title="确认删除？"
        description="此操作不可撤销，请谨慎操作"
        confirmText="确认删除"
        cancelText="取消"
        variant="danger"
        loading={loading}
        onConfirm={handleConfirm}
      />
    </>
  );
}
```

### 2. 危险操作（平仓）

```tsx
import { useState } from 'react';
import { ConfirmModal, useToast } from '@/components/ui';

function TradingPanel() {
  const [showPanicSell, setShowPanicSell] = useState(false);
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const handlePanicSell = async () => {
    setLoading(true);
    try {
      await api.post(`/instances/${instanceId}/force-exit`);
      toast.success('已触发紧急平仓');
      setShowPanicSell(false);
    } catch (error) {
      toast.error('平仓失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        className="bg-danger text-white px-4 py-2 rounded-lg"
        onClick={() => setShowPanicSell(true)}
      >
        紧急平仓
      </button>

      <ConfirmModal
        open={showPanicSell}
        onOpenChange={setShowPanicSell}
        title="确认平仓？"
        description="此操作将关闭所有持仓，不可撤销"
        confirmText="确认平仓"
        cancelText="取消"
        variant="danger"
        loading={loading}
        onConfirm={handlePanicSell}
      />
    </>
  );
}
```

### 3. 普通操作（启动策略）

```tsx
import { useState } from 'react';
import { ConfirmModal, useToast } from '@/components/ui';

function StrategyCard() {
  const [showStart, setShowStart] = useState(false);
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const handleStart = async () => {
    setLoading(true);
    try {
      await api.post(`/instances/${instanceId}/start`);
      toast.success('策略已启动');
      setShowStart(false);
    } catch (error) {
      toast.error('启动失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button onClick={() => setShowStart(true)}>启动策略</button>

      <ConfirmModal
        open={showStart}
        onOpenChange={setShowStart}
        title="启动策略"
        description="确认启动该策略？系统将开始自动交易"
        confirmText="启动"
        cancelText="取消"
        variant="default"
        icon="info"
        loading={loading}
        onConfirm={handleStart}
      />
    </>
  );
}
```

### 4. 无图标样式

```tsx
<ConfirmModal
  open={open}
  onOpenChange={setOpen}
  title="确认提交？"
  description="请确认所有信息填写正确"
  confirmText="提交"
  cancelText="取消"
  variant="default"
  icon="none"
  loading={loading}
  onConfirm={handleSubmit}
/>
```

## Props 说明

| Prop | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `open` | `boolean` | - | 是否打开弹窗（必填） |
| `onOpenChange` | `(open: boolean) => void` | - | 打开/关闭回调（必填） |
| `title` | `string` | - | 标题（必填） |
| `description` | `string` | - | 描述文本（可选） |
| `confirmText` | `string` | `"确认"` | 确认按钮文字 |
| `cancelText` | `string` | `"取消"` | 取消按钮文字 |
| `variant` | `'default' \| 'danger'` | `'default'` | 确认按钮样式 |
| `loading` | `boolean` | `false` | 加载状态 |
| `onConfirm` | `() => void \| Promise<void>` | - | 确认回调（必填） |
| `icon` | `'warning' \| 'info' \| 'none'` | `'warning'` | 图标类型 |
| `className` | `string` | - | 自定义样式 |

## 特性

### 1. 键盘支持
- **ESC 键**：关闭弹窗（仅在非加载状态）
- 加载状态下禁止关闭（防止误操作）

### 2. 样式变体
- **default**：蓝色确认按钮，适用于普通操作
- **danger**：红色确认按钮，适用于危险操作（删除、平仓等）

### 3. 图标类型
- **warning**：黄色警告图标（默认，适用于需谨慎操作）
- **info**：蓝色信息图标（适用于普通提示）
- **none**：无图标（适用于简洁场景）

### 4. 加载状态
- 按钮显示 loading 动画
- 禁止关闭弹窗
- 禁止重复点击

### 5. 无障碍支持
- 语义化 HTML 结构
- 键盘导航支持
- ARIA 标签
- 焦点管理

## 注意事项

1. **状态管理**：父组件需要同时管理 `open` 和 `loading` 状态
2. **错误处理**：`onConfirm` 的错误应该在父组件捕获并通过 `useToast` 提示
3. **关闭逻辑**：成功后由父组件决定是否关闭弹窗（`setOpen(false)`）
4. **ESC 快捷键**：仅在 `loading=false` 时生效，防止误操作中断
