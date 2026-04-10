import { useState, useEffect } from 'react'

interface NumericInputProps {
  value: number
  onCommit: (value: number) => void
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  placeholder?: string
  className?: string
  integer?: boolean // 整数模式
}

/**
 * 受控数字输入框 — 解决以下问题：
 * 1. 允许清空（不会立即被 parseInt 回退）
 * 2. 允许输入 0
 * 3. 光标不会因 re-render 跳动
 * 4. 失焦时空值提交为 0
 * 5. 外部 value 改变时（如重置按钮）非聚焦状态会同步
 * 6. 左对齐
 */
export function NumericInput({
  value,
  onCommit,
  min,
  max,
  step,
  disabled,
  placeholder,
  className = '',
  integer = false,
}: NumericInputProps) {
  const [raw, setRaw] = useState<string>(() => String(value))
  const [focused, setFocused] = useState(false)

  // 外部 value 变化时，如果没聚焦就同步；聚焦中不打扰用户
  useEffect(() => {
    if (!focused && String(value) !== raw) {
      setRaw(String(value))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, focused])

  const parse = (v: string) => (integer ? parseInt(v, 10) : parseFloat(v))

  return (
    <input
      type="number"
      value={raw}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false)
        if (raw === '' || isNaN(parse(raw))) {
          setRaw('0')
          onCommit(0)
        }
      }}
      onChange={(e) => {
        const v = e.target.value
        setRaw(v)
        if (v === '') return // 允许清空，不立即提交
        const n = parse(v)
        if (!isNaN(n)) onCommit(n)
      }}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      placeholder={placeholder}
      className={`text-left ${className}`}
    />
  )
}
