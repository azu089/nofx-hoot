'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Filter,
  Calendar,
  User,
  Activity,
  Shield,
  DollarSign,
  Settings,
  FileText,
  AlertCircle,
  Clock,
  MapPin,
} from 'lucide-react';
import { adminApi } from '@/lib/api';

export default function AuditLogsPage() {
  const [filters, setFilters] = useState({
    type: '',
    startDate: '',
    endDate: '',
    page: 1,
  });

  const { data: logsRes, isLoading } = useQuery({
    queryKey: ['admin', 'audit-logs', filters],
    queryFn: () => adminApi.getAuditLogs(filters),
  });
  const logs = logsRes?.data;

  const getActionIcon = (action: string) => {
    if (action.includes('创建') || action.includes('新增')) {
      return <Activity className="w-5 h-5 text-[#00C087]" />;
    }
    if (action.includes('删除')) {
      return <AlertCircle className="w-5 h-5 text-[#F23645]" />;
    }
    if (action.includes('修改') || action.includes('更新')) {
      return <Settings className="w-5 h-5 text-[#3772FF]" />;
    }
    if (action.includes('封禁')) {
      return <Shield className="w-5 h-5 text-[#F7931A]" />;
    }
    return <FileText className="w-5 h-5 text-[#848E9C]" />;
  };

  const getActionBadge = (action: string) => {
    if (action.includes('创建') || action.includes('新增')) {
      return <span className="px-2 py-1 bg-[#00C087]/10 text-[#00C087] rounded text-xs">创建</span>;
    }
    if (action.includes('删除')) {
      return <span className="px-2 py-1 bg-[#F23645]/10 text-[#F23645] rounded text-xs">删除</span>;
    }
    if (action.includes('修改') || action.includes('更新')) {
      return <span className="px-2 py-1 bg-[#3772FF]/10 text-[#3772FF] rounded text-xs">修改</span>;
    }
    if (action.includes('封禁')) {
      return <span className="px-2 py-1 bg-[#F7931A]/10 text-[#F7931A] rounded text-xs">封禁</span>;
    }
    return <span className="px-2 py-1 bg-[#848E9C]/10 text-[#848E9C] rounded text-xs">操作</span>;
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-bold text-white">审计日志</h1>
        <p className="text-[#848E9C] mt-1">查看所有管理员操作记录</p>
      </div>

      {/* 筛选器 */}
      <div className="bg-[#131722] rounded-xl border border-[#2B3139] p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-[#848E9C] text-sm mb-2">操作类型</label>
            <select
              value={filters.type}
              onChange={(e) => setFilters({ ...filters, type: e.target.value, page: 1 })}
              className="w-full px-4 py-3 bg-[#1E222D] border border-[#2B3139] rounded-lg text-white focus:outline-none focus:border-[#3772FF]"
            >
              <option value="">全部</option>
              <option value="create">创建</option>
              <option value="update">修改</option>
              <option value="delete">删除</option>
              <option value="ban">封禁</option>
            </select>
          </div>
          <div>
            <label className="block text-[#848E9C] text-sm mb-2">开始日期</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#848E9C]" />
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value, page: 1 })}
                className="w-full pl-10 pr-4 py-3 bg-[#1E222D] border border-[#2B3139] rounded-lg text-white focus:outline-none focus:border-[#3772FF]"
              />
            </div>
          </div>
          <div>
            <label className="block text-[#848E9C] text-sm mb-2">结束日期</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#848E9C]" />
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value, page: 1 })}
                className="w-full pl-10 pr-4 py-3 bg-[#1E222D] border border-[#2B3139] rounded-lg text-white focus:outline-none focus:border-[#3772FF]"
              />
            </div>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => setFilters({ type: '', startDate: '', endDate: '', page: 1 })}
              className="w-full px-4 py-3 bg-[#1E222D] text-white rounded-lg flex items-center justify-center gap-2 hover:bg-[#2B3139]"
            >
              <Filter className="w-5 h-5" />
              重置筛选
            </button>
          </div>
        </div>
      </div>

      {/* 日志列表 */}
      <div className="bg-[#131722] rounded-xl border border-[#2B3139] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#2B3139]">
                <th className="px-6 py-4 text-left text-sm font-medium text-[#848E9C]">操作者</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-[#848E9C]">操作类型</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-[#848E9C]">目标</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-[#848E9C]">详情</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-[#848E9C]">IP 地址</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-[#848E9C]">时间</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-[#848E9C]">
                    加载中...
                  </td>
                </tr>
              ) : !logs?.data || logs.data.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-[#848E9C]">
                    暂无审计日志
                  </td>
                </tr>
              ) : (
                logs.data.map((log) => (
                  <tr key={log.id} className="border-b border-[#2B3139] hover:bg-[#1E222D]">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#3772FF]/10 rounded-full flex items-center justify-center">
                          <User className="w-5 h-5 text-[#3772FF]" />
                        </div>
                        <div>
                          <p className="text-white font-medium">{log.operator}</p>
                          <p className="text-[#848E9C] text-xs">{log.operatorEmail}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {getActionIcon(log.action)}
                        {getActionBadge(log.action)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-white text-sm">{log.target}</span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-[#848E9C] text-sm max-w-md truncate" title={log.details}>
                        {log.details}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-[#848E9C] text-sm flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        {log.ip}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-[#848E9C] text-sm flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {log.createdAt}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 分页 */}
        {logs?.data && logs.data.length > 0 && (
          <div className="px-6 py-4 border-t border-[#2B3139] flex items-center justify-between">
            <p className="text-[#848E9C] text-sm">共 {logs.total || 0} 条记录</p>
            <div className="flex gap-2">
              <button
                onClick={() => setFilters({ ...filters, page: Math.max(1, filters.page - 1) })}
                disabled={filters.page === 1}
                className="px-4 py-2 bg-[#1E222D] border border-[#2B3139] rounded-lg text-white disabled:opacity-50 hover:bg-[#2B3139]"
              >
                上一页
              </button>
              <span className="px-4 py-2 text-white">第 {filters.page} 页</span>
              <button
                onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
                disabled={logs.data.length < 20}
                className="px-4 py-2 bg-[#1E222D] border border-[#2B3139] rounded-lg text-white disabled:opacity-50 hover:bg-[#2B3139]"
              >
                下一页
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-[#131722] rounded-xl border border-[#2B3139] p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-[#00C087]/10 rounded-lg flex items-center justify-center">
              <Activity className="w-5 h-5 text-[#00C087]" />
            </div>
            <span className="text-[#848E9C] text-sm">今日操作</span>
          </div>
          <p className="text-2xl font-bold text-white">-</p>
        </div>
        <div className="bg-[#131722] rounded-xl border border-[#2B3139] p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-[#3772FF]/10 rounded-lg flex items-center justify-center">
              <User className="w-5 h-5 text-[#3772FF]" />
            </div>
            <span className="text-[#848E9C] text-sm">活跃管理员</span>
          </div>
          <p className="text-2xl font-bold text-white">-</p>
        </div>
        <div className="bg-[#131722] rounded-xl border border-[#2B3139] p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-[#F23645]/10 rounded-lg flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-[#F23645]" />
            </div>
            <span className="text-[#848E9C] text-sm">异常操作</span>
          </div>
          <p className="text-2xl font-bold text-white">-</p>
        </div>
        <div className="bg-[#131722] rounded-xl border border-[#2B3139] p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-[#F7931A]/10 rounded-lg flex items-center justify-center">
              <Shield className="w-5 h-5 text-[#F7931A]" />
            </div>
            <span className="text-[#848E9C] text-sm">安全事件</span>
          </div>
          <p className="text-2xl font-bold text-white">-</p>
        </div>
      </div>
    </div>
  );
}
