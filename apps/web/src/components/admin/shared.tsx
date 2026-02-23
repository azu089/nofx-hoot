'use client';

import React from 'react';
import {
  RefreshCw,
  AlertTriangle,
  Search,
  ChevronLeft,
  ChevronRight,
  Inbox,
  Loader2,
  X,
} from 'lucide-react';

// ─────────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────────

export interface AdminColumn<T> {
  key: string;
  title: string;
  align?: 'left' | 'center' | 'right';
  width?: string;
  render: (row: T) => React.ReactNode;
}

// ─────────────────────────────────────────────
// 1. AdminPageHeader
// ─────────────────────────────────────────────

export function AdminPageHeader({
  title,
  icon: Icon,
  subtitle,
  onRefresh,
  actions,
}: {
  title: string;
  icon: React.ElementType;
  subtitle?: string;
  onRefresh?: () => void;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Icon size={20} className="text-cyan-400" />
        <div>
          <h1 className="text-xl font-bold text-white">{title}</h1>
          {subtitle && (
            <p className="text-xs text-[#9090A0] mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {actions}
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1E1E2E] hover:bg-[#2A2A3A] text-sm text-[#9090A0] hover:text-white rounded-lg transition-colors"
          >
            <RefreshCw size={14} />
            刷新
          </button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 2. AdminSkeleton
// ─────────────────────────────────────────────

export function AdminSkeleton({
  mode = 'grid',
  count = 4,
  cols = 4,
}: {
  mode?: 'grid' | 'table' | 'detail';
  count?: number;
  cols?: number;
}) {
  // 网格模式：用于统计卡片
  if (mode === 'grid') {
    return (
      <div className="p-6 space-y-6 animate-pulse">
        <div className="h-8 w-48 bg-[#1E1E2E] rounded" />
        <div
          className={`grid gap-4`}
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: count }).map((_, i) => (
            <div
              key={i}
              className="bg-[#12121A] border border-[#1E1E2E] rounded-xl p-4 h-28"
            >
              <div className="h-4 w-20 bg-[#1E1E2E] rounded mb-3" />
              <div className="h-7 w-16 bg-[#1E1E2E] rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 表格模式：用于列表页
  if (mode === 'table') {
    return (
      <div className="p-6 space-y-4 animate-pulse">
        <div className="h-8 w-48 bg-[#1E1E2E] rounded" />
        <div className="h-10 bg-[#1E1E2E] rounded-lg" />
        <div className="space-y-2">
          {Array.from({ length: count }).map((_, i) => (
            <div
              key={i}
              className="h-14 bg-[#12121A] border border-[#1E1E2E] rounded-lg"
            />
          ))}
        </div>
      </div>
    );
  }

  // 详情模式：用于详情页
  return (
    <div className="p-6 space-y-4 animate-pulse">
      <div className="h-8 w-48 bg-[#1E1E2E] rounded" />
      <div className="bg-[#12121A] border border-[#1E1E2E] rounded-xl p-6 space-y-4">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="flex gap-4">
            <div className="h-4 w-24 bg-[#1E1E2E] rounded" />
            <div className="h-4 w-48 bg-[#1E1E2E] rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 3. AdminErrorState
// ─────────────────────────────────────────────

export function AdminErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="p-6 flex flex-col items-center justify-center min-h-[60vh]">
      <AlertTriangle size={48} className="text-red-400 mb-4" />
      <h2 className="text-lg font-medium text-white mb-2">加载失败</h2>
      <p className="text-sm text-[#9090A0] mb-4">{message}</p>
      <button
        onClick={onRetry}
        className="flex items-center gap-2 px-4 py-2 bg-[#1E1E2E] hover:bg-[#2A2A3A] text-white rounded-lg transition-colors"
      >
        <RefreshCw size={16} />
        重试
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────
// 4. AdminEmptyState
// ─────────────────────────────────────────────

export function AdminEmptyState({
  icon: Icon = Inbox,
  title = '暂无数据',
  description,
}: {
  icon?: React.ElementType;
  title?: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Icon size={40} className="text-[#9090A0] mb-3" />
      <p className="text-white font-medium mb-1">{title}</p>
      {description && (
        <p className="text-sm text-[#9090A0]">{description}</p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// 5. AdminTable
// ─────────────────────────────────────────────

export function AdminTable<T>({
  columns,
  data,
  rowKey,
  loading,
}: {
  columns: AdminColumn<T>[];
  data: T[];
  rowKey: string | ((row: T) => string);
  loading?: boolean;
}) {
  const getKey = (row: T): string =>
    typeof rowKey === 'function'
      ? rowKey(row)
      : String((row as Record<string, unknown>)[rowKey]);

  const alignClass: Record<string, string> = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
  };

  return (
    <div className="relative overflow-x-auto rounded-xl border border-[#1E1E2E]">
      {/* 加载遮罩 */}
      {loading && (
        <div className="absolute inset-0 bg-[#0A0A0F]/60 flex items-center justify-center z-10 rounded-xl">
          <Loader2 size={24} className="text-cyan-400 animate-spin" />
        </div>
      )}

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#1E1E2E] bg-[#12121A]">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-4 py-3 font-medium text-[#9090A0] ${alignClass[col.align ?? 'left']}`}
                style={col.width ? { width: col.width } : undefined}
              >
                {col.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#1E1E2E]">
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-12 bg-[#12121A]"
              >
                <AdminEmptyState />
              </td>
            </tr>
          ) : (
            data.map((row) => (
              <tr
                key={getKey(row)}
                className="bg-[#12121A] hover:bg-[#16161F] transition-colors"
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-4 py-3 text-white ${alignClass[col.align ?? 'left']}`}
                  >
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

// ─────────────────────────────────────────────
// 6. AdminPagination
// ─────────────────────────────────────────────

export function AdminPagination({
  page,
  totalPages,
  total,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between text-sm text-[#9090A0]">
      <span>共 {total} 条</span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="p-1.5 rounded-lg hover:bg-[#1E1E2E] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          aria-label="上一页"
        >
          <ChevronLeft size={16} />
        </button>

        {/* 页码按钮：最多显示 5 个 */}
        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
          let pageNum = i + 1;
          // 当总页数 > 5 时，动态计算显示的页码范围
          if (totalPages > 5) {
            const start = Math.max(1, Math.min(page - 2, totalPages - 4));
            pageNum = start + i;
          }
          return (
            <button
              key={pageNum}
              onClick={() => onPageChange(pageNum)}
              className={`w-8 h-8 rounded-lg text-sm transition-colors ${
                pageNum === page
                  ? 'bg-cyan-500/20 text-cyan-400 font-medium'
                  : 'hover:bg-[#1E1E2E] text-[#9090A0] hover:text-white'
              }`}
            >
              {pageNum}
            </button>
          );
        })}

        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="p-1.5 rounded-lg hover:bg-[#1E1E2E] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          aria-label="下一页"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 7. AdminStatCard
// ─────────────────────────────────────────────

export function AdminStatCard({
  title,
  value,
  sub,
  icon: Icon,
  color,
}: {
  title: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="bg-[#12121A] border border-[#1E1E2E] rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-[#9090A0]">{title}</span>
        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}
        >
          <Icon size={16} />
        </div>
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
      {sub && <div className="text-xs text-[#9090A0] mt-1">{sub}</div>}
    </div>
  );
}

// ─────────────────────────────────────────────
// 8. AdminSearchBar
// ─────────────────────────────────────────────

export function AdminSearchBar({
  value,
  onChange,
  onSearch,
  placeholder = '搜索...',
  filters,
}: {
  value: string;
  onChange: (v: string) => void;
  onSearch: () => void;
  placeholder?: string;
  filters?: React.ReactNode;
}) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') onSearch();
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="relative flex-1 min-w-[200px]">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9090A0] pointer-events-none"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full pl-9 pr-4 py-2 bg-[#12121A] border border-[#1E1E2E] rounded-lg text-sm text-white placeholder-[#9090A0] focus:outline-none focus:border-cyan-500/50 transition-colors"
        />
        {value && (
          <button
            onClick={() => { onChange(''); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9090A0] hover:text-white transition-colors"
            aria-label="清除搜索"
          >
            <X size={14} />
          </button>
        )}
      </div>
      {filters}
      <button
        onClick={onSearch}
        className="px-4 py-2 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 text-sm rounded-lg border border-cyan-500/20 transition-colors"
      >
        搜索
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────
// 9. AdminConfirmDialog
// ─────────────────────────────────────────────

export function AdminConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = '确认',
  variant = 'default',
  loading = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string;
  variant?: 'danger' | 'default';
  loading?: boolean;
}) {
  if (!open) return null;

  const confirmStyle =
    variant === 'danger'
      ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20'
      : 'bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/20';

  return (
    // 遮罩层
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      {/* 对话框 */}
      <div
        className="bg-[#12121A] border border-[#1E1E2E] rounded-xl p-6 w-full max-w-md shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 mb-4">
          {variant === 'danger' && (
            <AlertTriangle size={20} className="text-red-400 mt-0.5 shrink-0" />
          )}
          <div>
            <h3 className="text-base font-semibold text-white">{title}</h3>
            <p className="text-sm text-[#9090A0] mt-1">{description}</p>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm text-[#9090A0] hover:text-white bg-[#1E1E2E] hover:bg-[#2A2A3A] rounded-lg transition-colors disabled:opacity-50"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition-colors disabled:opacity-50 ${confirmStyle}`}
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 10. AdminTabs
// ─────────────────────────────────────────────

export function AdminTabs({
  tabs,
  activeTab,
  onChange,
}: {
  tabs: { key: string; label: string; icon?: React.ElementType }[];
  activeTab: string;
  onChange: (key: string) => void;
}) {
  return (
    <div className="flex items-center gap-1 bg-[#12121A] border border-[#1E1E2E] rounded-xl p-1">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = tab.key === activeTab;
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              isActive
                ? 'bg-[#1E1E2E] text-white'
                : 'text-[#9090A0] hover:text-white hover:bg-[#1A1A2A]'
            }`}
          >
            {Icon && <Icon size={14} />}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────
// 11. AdminStatusBadge
// ─────────────────────────────────────────────

const DEFAULT_STATUS_MAP: Record<string, { label: string; color: string }> = {
  // 用户状态
  active:      { label: '正常',   color: 'bg-green-500/10 text-green-400 border-green-500/20' },
  suspended:   { label: '封禁',   color: 'bg-red-500/10 text-red-400 border-red-500/20' },
  // 通用状态
  pending:     { label: '待处理', color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
  completed:   { label: '已完成', color: 'bg-green-500/10 text-green-400 border-green-500/20' },
  failed:      { label: '失败',   color: 'bg-red-500/10 text-red-400 border-red-500/20' },
  // 策略状态
  running:     { label: '运行中', color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' },
  paused:      { label: '已暂停', color: 'bg-[#9090A0]/10 text-[#9090A0] border-[#9090A0]/20' },
  stopped:     { label: '已停止', color: 'bg-[#9090A0]/10 text-[#9090A0] border-[#9090A0]/20' },
  // 提现状态
  approved:    { label: '已批准', color: 'bg-green-500/10 text-green-400 border-green-500/20' },
  rejected:    { label: '已拒绝', color: 'bg-red-500/10 text-red-400 border-red-500/20' },
  processing:  { label: '处理中', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
};

export function AdminStatusBadge({
  status,
  map,
}: {
  status: string;
  map?: Record<string, { label: string; color: string }>;
}) {
  const statusMap = { ...DEFAULT_STATUS_MAP, ...map };
  const config = statusMap[status] ?? {
    label: status,
    color: 'bg-[#1E1E2E] text-[#9090A0] border-[#1E1E2E]',
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${config.color}`}
    >
      {config.label}
    </span>
  );
}
