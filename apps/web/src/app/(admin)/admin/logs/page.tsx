'use client';

import { useState } from 'react';
import {
  FileText,
  LogIn,
  Activity,
  Monitor,
  CheckCircle,
  XCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  AdminPageHeader,
  AdminSkeleton,
  AdminErrorState,
  AdminTable,
  AdminPagination,
  AdminTabs,
  AdminSearchBar,
  AdminStatCard,
  AdminStatusBadge,
  type AdminColumn,
} from '@/components/admin/shared';
import { useAdminApi, useAdminList } from '@/hooks/useAdminApi';

// ─── 类型 ────────────────────────────────────────────────────────

interface OperationLog {
  id: string;
  adminId: string;
  admin?: { id: string; username: string; role: string };
  action: string;
  module: string;
  targetId?: string | null;
  targetType?: string | null;
  description?: string | null;
  ipAddress?: string | null;
  result: string;
  createdAt: string;
}

interface LoginLog {
  id: string;
  userId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: string;
  revokedAt?: string | null;
  user?: { id: string; email: string; nickname?: string | null };
}

interface SystemLog {
  id: string;
  actorId: string;
  actorType: string;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  details?: string | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
  createdAt: string;
}

// ─── 工具 ────────────────────────────────────────────────────────

const MODULE_LABEL: Record<string, string> = {
  user: '用户管理',
  strategy: '策略管理',
  withdraw: '提现审核',
  announcement: '公告管理',
  config: '系统设置',
  ai: 'AI管理',
  ecosystem: '生态管理',
};

const ACTION_LABEL: Record<string, string> = {
  login: '登录',
  create: '创建',
  update: '更新',
  delete: '删除',
  approve: '审批通过',
  reject: '审批拒绝',
  execute: '执行',
  pause: '暂停',
  resume: '恢复',
  cancel: '取消',
};

const ACTOR_TYPE_MAP = {
  admin: { label: '管理员', color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
  system: { label: '系统', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  user: { label: '用户', color: 'bg-green-500/10 text-green-400 border-green-500/20' },
};

const RESOURCE_LABEL: Record<string, string> = {
  user: '用户', strategy: '策略', withdrawal: '提现', config: '系统配置',
  staking: '质押', announcement: '公告', api_key: 'API密钥', position: '持仓',
};

function fmtTime(t: string) {
  return new Date(t).toLocaleString('zh-CN', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function parseUA(ua: string | null | undefined): string {
  if (!ua) return '未知';
  let os = '';
  if (/iPhone|iPad/.test(ua)) os = 'iOS';
  else if (/Android/.test(ua)) os = 'Android';
  else if (/Mac OS X/.test(ua)) os = 'macOS';
  else if (/Windows/.test(ua)) os = 'Windows';
  else if (/Linux/.test(ua)) os = 'Linux';
  let browser = '';
  if (/Edg\//.test(ua)) browser = 'Edge';
  else if (/Chrome\//.test(ua)) browser = 'Chrome';
  else if (/Firefox\//.test(ua)) browser = 'Firefox';
  else if (/Safari\//.test(ua)) browser = 'Safari';
  const parts = [os, browser].filter(Boolean);
  return parts.length ? parts.join(' / ') : ua.slice(0, 40);
}

// ─── Tab 1: 操作日志 ─────────────────────────────────────────────

function OperationLogsTab() {
  const {
    items, total, page, totalPages, loading, error, search,
    filters, setPage, setSearch, setFilter, refetch,
  } = useAdminList<OperationLog>('/admin/logs/operations', {
    defaultLimit: 20,
    defaultFilters: { module: '', result: '' },
  });

  const columns: AdminColumn<OperationLog>[] = [
    {
      key: 'admin', title: '操作人', width: '140px',
      render: (row) => (
        <div>
          <div className="text-sm text-white font-medium">{row.admin?.username ?? row.adminId.slice(0, 10)}</div>
          {row.admin?.role && (
            <span className="text-xs px-1.5 py-0.5 bg-purple-500/10 text-purple-400 rounded">
              {row.admin.role === 'super_admin' ? '超级管理员' : '管理员'}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'module', title: '模块', align: 'center', width: '110px',
      render: (row) => (
        <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 text-xs rounded-full">
          {MODULE_LABEL[row.module] ?? row.module}
        </span>
      ),
    },
    {
      key: 'action', title: '操作', align: 'center', width: '100px',
      render: (row) => (
        <span className="px-2 py-0.5 bg-[#1E1E2E] text-[#9090A0] text-xs rounded-full">
          {ACTION_LABEL[row.action] ?? row.action}
        </span>
      ),
    },
    {
      key: 'target', title: '目标', width: '140px',
      render: (row) => row.targetId ? (
        <div>
          <div className="text-xs text-[#9090A0]">{row.targetType ?? '—'}</div>
          <div className="text-xs text-[#4A4A5A] font-mono">{row.targetId.slice(0, 12)}...</div>
        </div>
      ) : <span className="text-xs text-[#4A4A5A]">—</span>,
    },
    {
      key: 'description', title: '描述',
      render: (row) => (
        <span className="text-xs text-[#9090A0] line-clamp-1" title={row.description ?? undefined}>
          {row.description ?? '—'}
        </span>
      ),
    },
    {
      key: 'ip', title: 'IP', width: '120px',
      render: (row) => <span className="text-xs text-[#9090A0] font-mono">{row.ipAddress ?? '—'}</span>,
    },
    {
      key: 'result', title: '结果', align: 'center', width: '80px',
      render: (row) => row.result === 'success'
        ? <CheckCircle size={14} className="text-green-400 mx-auto" />
        : <XCircle size={14} className="text-red-400 mx-auto" />,
    },
    {
      key: 'createdAt', title: '时间', width: '130px',
      render: (row) => <span className="text-xs text-[#9090A0]">{fmtTime(row.createdAt)}</span>,
    },
  ];

  if (error) return <AdminErrorState message={error} onRetry={refetch} />;

  return (
    <div className="space-y-4">
      <AdminSearchBar
        value={search}
        onChange={setSearch}
        onSearch={() => setPage(1)}
        placeholder="搜索操作人/描述..."
        filters={
          <>
            <select
              value={filters.module ?? ''}
              onChange={(e) => setFilter('module', e.target.value)}
              className="px-3 py-2 bg-[#12121A] border border-[#1E1E2E] rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500/50"
            >
              <option value="">全部模块</option>
              {Object.entries(MODULE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <select
              value={filters.result ?? ''}
              onChange={(e) => setFilter('result', e.target.value)}
              className="px-3 py-2 bg-[#12121A] border border-[#1E1E2E] rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500/50"
            >
              <option value="">全部结果</option>
              <option value="success">成功</option>
              <option value="failed">失败</option>
            </select>
          </>
        }
      />
      {loading && !items.length ? <AdminSkeleton mode="table" count={10} /> : (
        <>
          <AdminTable<OperationLog> columns={columns} data={items} rowKey="id" loading={loading} />
          <AdminPagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}

// ─── Tab 2: 登录日志 ─────────────────────────────────────────────

function LoginLogsTab() {
  const {
    items, total, page, totalPages, loading, error, search,
    setPage, setSearch, refetch,
  } = useAdminList<LoginLog>('/admin/logs/logins', { defaultLimit: 20 });

  const activeSessions = items.filter((l) => !l.revokedAt).length;
  const uniqueUsers = new Set(items.map((l) => l.userId)).size;

  const columns: AdminColumn<LoginLog>[] = [
    {
      key: 'user', title: '用户',
      render: (row) => (
        <div>
          <div className="text-sm text-white">{row.user?.nickname ?? row.user?.email ?? '—'}</div>
          <div className="text-xs text-[#9090A0]">{row.user?.email ?? row.userId.slice(0, 16)}</div>
        </div>
      ),
    },
    {
      key: 'ip', title: 'IP地址', width: '130px',
      render: (row) => <span className="text-xs text-[#9090A0] font-mono">{row.ipAddress ?? '—'}</span>,
    },
    {
      key: 'ua', title: '设备/浏览器',
      render: (row) => <span className="text-xs text-[#9090A0]">{parseUA(row.userAgent)}</span>,
    },
    {
      key: 'status', title: '会话状态', align: 'center', width: '90px',
      render: (row) => !row.revokedAt
        ? <span className="px-2 py-0.5 bg-green-500/10 text-green-400 text-xs rounded-full border border-green-500/20">活跃</span>
        : <span className="px-2 py-0.5 bg-[#9090A0]/10 text-[#9090A0] text-xs rounded-full border border-[#9090A0]/20">已注销</span>,
    },
    {
      key: 'createdAt', title: '登录时间', width: '130px',
      render: (row) => <span className="text-xs text-[#9090A0]">{fmtTime(row.createdAt)}</span>,
    },
  ];

  if (error) return <AdminErrorState message={error} onRetry={refetch} />;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <AdminStatCard title="总登录次数" value={total} icon={LogIn} color="bg-cyan-500/20 text-cyan-400" />
        <AdminStatCard title="活跃会话(当页)" value={activeSessions} icon={Activity} color="bg-green-500/20 text-green-400" />
        <AdminStatCard title="独立用户(当页)" value={uniqueUsers} icon={Monitor} color="bg-purple-500/20 text-purple-400" />
      </div>
      <AdminSearchBar
        value={search}
        onChange={setSearch}
        onSearch={() => setPage(1)}
        placeholder="搜索用户邮箱/昵称..."
      />
      {loading && !items.length ? <AdminSkeleton mode="table" count={10} /> : (
        <>
          <AdminTable<LoginLog> columns={columns} data={items} rowKey="id" loading={loading} />
          <AdminPagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}

// ─── Tab 3: 系统日志 ─────────────────────────────────────────────

function SystemLogsTab() {
  const {
    items, total, page, totalPages, loading, error, search,
    filters, setPage, setSearch, setFilter, refetch,
  } = useAdminList<SystemLog>('/admin/logs/system', {
    defaultLimit: 20,
    defaultFilters: { actorType: '', resourceType: '' },
  });

  const [expandedId, setExpandedId] = useState<string | null>(null);

  const ACTION_COLOR: Record<string, string> = {
    create: 'text-green-400', update: 'text-blue-400', delete: 'text-red-400',
    login: 'text-cyan-400', approve: 'text-green-400', reject: 'text-red-400',
    execute: 'text-orange-400', pause: 'text-orange-400', resume: 'text-blue-400',
  };

  const columns: AdminColumn<SystemLog>[] = [
    {
      key: 'actor', title: '操作者', width: '160px',
      render: (row) => (
        <div className="space-y-1">
          <AdminStatusBadge status={row.actorType} map={ACTOR_TYPE_MAP} />
          <div className="text-xs text-[#4A4A5A] font-mono">{row.actorId.slice(0, 12)}...</div>
        </div>
      ),
    },
    {
      key: 'action', title: '操作', align: 'center', width: '90px',
      render: (row) => (
        <span className={`text-xs font-medium ${ACTION_COLOR[row.action] ?? 'text-[#9090A0]'}`}>
          {ACTION_LABEL[row.action] ?? row.action}
        </span>
      ),
    },
    {
      key: 'resource', title: '资源', width: '140px',
      render: (row) => (
        <div>
          <div className="text-xs text-[#9090A0]">{RESOURCE_LABEL[row.resourceType] ?? row.resourceType}</div>
          {row.resourceId && <div className="text-xs text-[#4A4A5A] font-mono">{row.resourceId.slice(0, 12)}</div>}
        </div>
      ),
    },
    {
      key: 'details', title: '详情',
      render: (row) => {
        const hasExtra = row.details || row.metadata;
        const isExpanded = expandedId === row.id;
        return (
          <div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-[#9090A0] line-clamp-1">{row.details ?? '—'}</span>
              {hasExtra && (
                <button
                  onClick={() => setExpandedId(isExpanded ? null : row.id)}
                  className="shrink-0 text-[#9090A0] hover:text-white transition-colors"
                >
                  {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>
              )}
            </div>
            {isExpanded && row.metadata && (
              <pre className="mt-1 text-xs text-cyan-400 bg-[#0A0A0F] rounded p-2 overflow-x-auto max-h-32 font-mono">
                {JSON.stringify(row.metadata, null, 2)}
              </pre>
            )}
          </div>
        );
      },
    },
    {
      key: 'ip', title: 'IP', width: '120px',
      render: (row) => <span className="text-xs text-[#9090A0] font-mono">{row.ipAddress ?? '—'}</span>,
    },
    {
      key: 'createdAt', title: '时间', width: '130px',
      render: (row) => <span className="text-xs text-[#9090A0]">{fmtTime(row.createdAt)}</span>,
    },
  ];

  if (error) return <AdminErrorState message={error} onRetry={refetch} />;

  return (
    <div className="space-y-4">
      <AdminSearchBar
        value={search}
        onChange={setSearch}
        onSearch={() => setPage(1)}
        placeholder="搜索详情/资源ID..."
        filters={
          <>
            <select
              value={filters.actorType ?? ''}
              onChange={(e) => setFilter('actorType', e.target.value)}
              className="px-3 py-2 bg-[#12121A] border border-[#1E1E2E] rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500/50"
            >
              <option value="">全部操作者</option>
              <option value="admin">管理员</option>
              <option value="system">系统</option>
              <option value="user">用户</option>
            </select>
            <select
              value={filters.resourceType ?? ''}
              onChange={(e) => setFilter('resourceType', e.target.value)}
              className="px-3 py-2 bg-[#12121A] border border-[#1E1E2E] rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500/50"
            >
              <option value="">全部资源</option>
              {Object.entries(RESOURCE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </>
        }
      />
      {loading && !items.length ? <AdminSkeleton mode="table" count={10} /> : (
        <>
          <AdminTable<SystemLog> columns={columns} data={items} rowKey="id" loading={loading} />
          <AdminPagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}

// ─── 主页面 ─────────────────────────────────────────────────────

const TABS = [
  { key: 'operations', label: '操作日志' },
  { key: 'logins', label: '登录日志' },
  { key: 'system', label: '系统日志' },
];

export default function AdminLogsPage() {
  const [activeTab, setActiveTab] = useState('operations');

  return (
    <div className="p-6 space-y-6">
      <AdminPageHeader
        title="日志管理"
        icon={FileText}
        subtitle="管理员操作、用户登录、系统审计记录"
      />
      <AdminTabs tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />
      <div>
        {activeTab === 'operations' && <OperationLogsTab />}
        {activeTab === 'logins' && <LoginLogsTab />}
        {activeTab === 'system' && <SystemLogsTab />}
      </div>
    </div>
  );
}
