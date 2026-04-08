import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown } from 'lucide-react'

export interface NexoraSelectOption {
  value: string
  label: string
  hint?: string
}

interface NexoraSelectProps {
  value: string
  options: NexoraSelectOption[]
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
}

/**
 * Nexora 风格自定义下拉：
 * - 触发器：nexora-input 玻璃风格
 * - 下拉浮层：fixed 定位，悬空盖住后面内容，不挤压布局
 * - 跟随滚动 / 窗口 resize 实时重算位置
 */
export function NexoraSelect({
  value,
  options,
  onChange,
  placeholder,
  disabled,
}: NexoraSelectProps) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null)

  // 计算浮层位置（紧贴触发器下方）
  const updatePos = () => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    setPos({
      top: rect.bottom + 6,
      left: rect.left,
      width: rect.width,
    })
  }

  useLayoutEffect(() => {
    if (!open) return
    updatePos()
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = () => updatePos()
    window.addEventListener('scroll', handler, true)
    window.addEventListener('resize', handler)
    return () => {
      window.removeEventListener('scroll', handler, true)
      window.removeEventListener('resize', handler)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      const t = e.target as Node
      if (
        triggerRef.current && !triggerRef.current.contains(t) &&
        popoverRef.current && !popoverRef.current.contains(t)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const selected = options.find((o) => o.value === value)

  return (
    <>
      {/* 触发器 */}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className="nexora-input flex items-center justify-between gap-2 text-left disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className={`truncate ${selected ? 'text-white' : 'text-zinc-500'}`}>
          {selected ? selected.label : placeholder || ''}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-zinc-500 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* 下拉浮层 —— Portal 到 body，完全脱离任何祖先 transform */}
      {open && pos && createPortal(
        <div
          ref={popoverRef}
          className="bubble-card py-1 max-h-64 overflow-y-auto"
          style={{
            position: 'fixed',
            top: pos.top,
            left: pos.left,
            width: pos.width,
            zIndex: 9999,
          }}
        >
          {options.length === 0 ? (
            <div className="px-3 py-2 text-xs text-zinc-500">无选项</div>
          ) : (
            options.map((opt) => {
              const isActive = opt.value === value
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value)
                    setOpen(false)
                  }}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-xs text-left transition-colors ${
                    isActive
                      ? 'text-emerald-300 bg-emerald-400/10'
                      : 'text-white hover:bg-white/5'
                  }`}
                >
                  <span className="truncate">{opt.label}</span>
                  {isActive && <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" strokeWidth={3} />}
                </button>
              )
            })
          )}
        </div>,
        document.body
      )}
    </>
  )
}
