'use client';

import { useState } from 'react';
import { DayPicker, DateRange } from 'react-day-picker';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { Calendar, X } from 'lucide-react';

interface DateRangePickerProps {
  /** 选中的日期范围 */
  value?: DateRange;
  /** 日期范围变化时的回调 */
  onChange: (range: DateRange | undefined) => void;
  /** 占位符文本 */
  placeholder?: string;
  /** 自定义类名 */
  className?: string;
}

/**
 * 日期范围选择器 - 弹窗版本
 * 使用居中弹窗 + 自定义年月选择器 + DayPicker
 * - 点击第一次选择起始日期
 * - 点击第二次选择结束日期
 * - 支持年月下拉选择（原生 select）
 * - 支持区间高亮显示
 */
export function DateRangePicker({
  value,
  onChange,
  placeholder = '选择日期范围',
  className = '',
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  // 内部暂存的选择（避免立即触发父组件更新导致重新渲染）
  const [tempSelection, setTempSelection] = useState<DateRange | undefined>(value);

  // 当前显示的月份（用于日历显示）
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // 计算年份范围：过去50年到今年
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 51 }, (_, i) => currentYear - 50 + i);
  const months = [
    '一月', '二月', '三月', '四月', '五月', '六月',
    '七月', '八月', '九月', '十月', '十一月', '十二月'
  ];

  const formatRange = (range: DateRange | undefined) => {
    if (!range?.from) return placeholder;
    if (!range.to) return format(range.from, 'MM-dd', { locale: zhCN });
    return `${format(range.from, 'MM-dd', { locale: zhCN })} ~ ${format(range.to, 'MM-dd', { locale: zhCN })}`;
  };

  return (
    <>
      {/* 触发按钮 */}
      <button
        type="button"
        onClick={() => {
          if (!isOpen) {
            // 打开时，用当前值初始化临时选择
            setTempSelection(value);
          }
          setIsOpen(!isOpen);
        }}
        className={`flex items-center justify-center gap-2 bg-bg-tertiary hover:bg-bg-tertiary/70 rounded-lg px-3 py-2 text-xs text-text-primary border border-border-primary hover:border-brand-primary focus:border-brand-primary outline-none transition-colors min-w-[120px] ${className}`}
      >
        <Calendar className="w-4 h-4 text-text-secondary flex-shrink-0" />
        <span className={value?.from ? 'text-text-primary' : 'text-text-secondary'}>
          {formatRange(value)}
        </span>
      </button>

      {/* 弹窗 */}
      {isOpen && (
        <>
          {/* 遮罩层 */}
          <div
            className="fixed inset-0 z-50 bg-black/60 animate-in fade-in duration-200"
            onClick={() => {
              setIsOpen(false);
              // 关闭时重置临时选择为当前值
              setTempSelection(value);
            }}
          />

          {/* 日历弹窗 - 居中显示 */}
          <div
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[90vw] max-w-md bg-bg-secondary border border-border-primary rounded-2xl shadow-2xl animate-in zoom-in-95 fade-in duration-200 max-h-[calc(100vh-120px)] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 标题栏 */}
            <div className="flex items-center justify-between p-4 border-b border-border-primary sticky top-0 bg-bg-secondary z-10">
              <h3 className="text-lg font-semibold text-text-primary">选择日期范围</h3>
              <button
                onClick={() => {
                  setIsOpen(false);
                  setTempSelection(value);
                }}
                className="p-1 hover:bg-bg-tertiary rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-text-tertiary" />
              </button>
            </div>

            {/* 内容区域 */}
            <div className="p-4">
              {/* 年月选择器 */}
              <div className="flex items-center justify-center gap-3 mb-4 pb-4 border-b border-border-primary">
                <select
                  className="bg-bg-tertiary rounded px-3 py-2 text-sm text-text-primary border border-border-primary focus:border-brand-primary outline-none cursor-pointer"
                  value={currentMonth.getFullYear()}
                  onChange={(e) => {
                    const newDate = new Date(currentMonth);
                    newDate.setFullYear(parseInt(e.target.value));
                    setCurrentMonth(newDate);
                  }}
                >
                  {years.map((year) => (
                    <option key={year} value={year}>
                      {year}年
                    </option>
                  ))}
                </select>

                <select
                  className="bg-bg-tertiary rounded px-3 py-2 text-sm text-text-primary border border-border-primary focus:border-brand-primary outline-none cursor-pointer"
                  value={currentMonth.getMonth()}
                  onChange={(e) => {
                    const newDate = new Date(currentMonth);
                    newDate.setMonth(parseInt(e.target.value));
                    setCurrentMonth(newDate);
                  }}
                >
                  {months.map((month, index) => (
                    <option key={index} value={index}>
                      {month}
                    </option>
                  ))}
                </select>
              </div>

              {/* 日历主体 */}
              <div className="flex justify-center">
                <DayPicker
                  mode="range"
                  selected={tempSelection}
                  onSelect={(range) => {
                    // 暂存选择，不立即通知父组件（避免触发重新渲染导致弹窗关闭）
                    setTempSelection(range);
                  }}
                  month={currentMonth}
                  onMonthChange={setCurrentMonth}
                  locale={zhCN}
                  disabled={{ after: new Date() }}
                  hideNavigation
                  classNames={{
                    root: 'text-text-primary',
                    months: '',
                    month: '',
                    month_caption: 'hidden',
                    month_grid: 'w-full',
                    day: 'w-10 h-10 text-sm rounded hover:bg-bg-tertiary transition-colors',
                    day_button: 'w-full h-full flex items-center justify-center',
                    selected: 'bg-brand-primary text-white hover:bg-brand-secondary',
                    range_start: 'bg-brand-primary text-white rounded-l',
                    range_end: 'bg-brand-primary text-white rounded-r',
                    range_middle: 'bg-brand-primary/30 text-text-primary',
                    today: 'font-bold text-brand-primary',
                    outside: 'text-text-disabled',
                    disabled: 'text-text-disabled opacity-50 cursor-not-allowed',
                    weekdays: 'flex text-text-tertiary text-xs font-medium mb-2',
                    weekday: 'w-10 text-center',
                    week: 'flex w-full',
                  }}
                />
              </div>

              {/* 选中状态显示 */}
              <div className="mt-4 pt-4 border-t border-border-primary">
                {!tempSelection?.from ? (
                  <p className="text-center text-text-tertiary text-sm">
                    👆 点击选择起始日期
                  </p>
                ) : !tempSelection.to ? (
                  <div className="space-y-2">
                    <p className="text-center text-brand-primary text-sm font-medium">
                      📅 起始：{format(tempSelection.from, 'yyyy年MM月dd日', { locale: zhCN })}
                    </p>
                    <p className="text-center text-text-tertiary text-sm">
                      👆 再点击选择结束日期
                    </p>
                  </div>
                ) : (
                  <div className="bg-success/10 border border-success/30 rounded-lg p-3">
                    <div className="flex items-center justify-between text-sm">
                      <div className="text-text-secondary">
                        <span className="text-success font-medium">起始：</span>
                        {format(tempSelection.from, 'yyyy-MM-dd', { locale: zhCN })}
                      </div>
                      <div className="text-text-secondary">
                        <span className="text-success font-medium">结束：</span>
                        {format(tempSelection.to, 'yyyy-MM-dd', { locale: zhCN })}
                      </div>
                    </div>
                    <p className="mt-2 text-center text-success text-xs font-medium">
                      ✓ 共 {Math.ceil((tempSelection.to.getTime() - tempSelection.from.getTime()) / (1000 * 60 * 60 * 24)) + 1} 天
                    </p>
                  </div>
                )}
              </div>

              {/* 底部按钮 */}
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => {
                    setTempSelection(undefined);
                    onChange(undefined);
                  }}
                  className="flex-1 py-2.5 bg-bg-tertiary hover:bg-bg-primary rounded-lg text-text-secondary font-medium transition-colors text-sm"
                >
                  清空
                </button>
                <button
                  onClick={() => {
                    // 确定时才通知父组件
                    onChange(tempSelection);
                    setIsOpen(false);
                  }}
                  className="flex-1 py-2.5 bg-brand-primary hover:bg-brand-secondary rounded-lg text-white font-medium transition-colors text-sm"
                >
                  确定
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
