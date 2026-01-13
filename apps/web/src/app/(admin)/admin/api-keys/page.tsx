'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  KeyRound,
  Search,
  Ban,
  Eye,
  EyeOff,
  Clock,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Shield,
} from 'lucide-react';
import { adminApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';

type ApiKey = {
  id: string;
  userId: string;
  userEmail: string;
  exchange: string;
  label: string;
  permissions: string[];
  isActive: boolean;
  lastUsedAt: string | null;
  createdAt: string;
  riskLevel: string;
};

const exchangeLogos: Record<string, string> = {
  binance: '🟡',
  okx: '⚫',
  bybit: '🟠',
  gate: '🔵',
  kucoin: '🟢',
};

export default function ApiKeysPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [exchangeFilter, setExchangeFilter] = useState('all');
  const [selectedKey, setSelectedKey] = useState<ApiKey | null>(null);
  const [showKeyId, setShowKeyId] = useState<string | null>(null);

  const { data: apiKeysRes, isLoading, refetch } = useQuery({
    queryKey: ['admin', 'api-keys', page, search, exchangeFilter],
    queryFn: () => adminApi.getAllApiKeys({
      page,
      userId: search || undefined,
      exchange: exchangeFilter === 'all' ? undefined : exchangeFilter,
    }),
  });
  const apiKeysData = apiKeysRes?.data;

  const revokeMutation = useMutation({
    mutationFn: (keyId: string) => adminApi.revokeApiKey(keyId),
    onSuccess: () => {
      toast.success('API Key 已禁用');
      queryClient.invalidateQueries({ queryKey: ['admin', 'api-keys'] });
      setSelectedKey(null);
    },
    onError: (err: Error) => {
      toast.error(err.message || '操作失败');
    },
  });

  const getRiskBadge = (level: string) => {
    switch (level) {
      case 'high':
        return <Badge variant="danger">高风险</Badge>;
      case 'medium':
        return <Badge variant="warning">中风险</Badge>;
      default:
        return <Badge variant="success">低风险</Badge>;
    }
  };

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return '从未使用';
    return new Date(dateStr).toLocaleString('zh-CN');
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <KeyRound className="w-7 h-7 text-warning" />
            API Key 监管
          </h1>
          <p className="text-text-secondary mt-1">查看和管理用户的交易所 API Key</p>
        </div>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="w-4 h-4 mr-2" />
          刷新
        </Button>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-brand-primary/10 rounded-lg flex items-center justify-center">
              <KeyRound className="w-5 h-5 text-brand-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{apiKeysData?.stats?.total || 0}</p>
              <p className="text-sm text-text-secondary">总 API Key</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-success/10 rounded-lg flex items-center justify-center">
              <Shield className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{apiKeysData?.stats?.active || 0}</p>
              <p className="text-sm text-text-secondary">启用中</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-warning/10 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{apiKeysData?.stats?.highRisk || 0}</p>
              <p className="text-sm text-text-secondary">高风险</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-danger/10 rounded-lg flex items-center justify-center">
              <Ban className="w-5 h-5 text-danger" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{apiKeysData?.stats?.revoked || 0}</p>
              <p className="text-sm text-text-secondary">已禁用</p>
            </div>
          </div>
        </Card>
      </div>

      {/* 搜索和筛选 */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary" />
          <input
            type="text"
            placeholder="搜索用户 ID 或邮箱..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-bg-tertiary border border-border-primary rounded-lg text-white placeholder-text-secondary focus:outline-none focus:border-brand-primary"
          />
        </div>
        <select
          value={exchangeFilter}
          onChange={(e) => setExchangeFilter(e.target.value)}
          className="px-4 py-3 bg-bg-tertiary border border-border-primary rounded-lg text-white focus:outline-none focus:border-brand-primary"
        >
          <option value="all">全部交易所</option>
          <option value="binance">Binance</option>
          <option value="okx">OKX</option>
          <option value="bybit">Bybit</option>
          <option value="gate">Gate.io</option>
          <option value="kucoin">KuCoin</option>
        </select>
      </div>

      {/* API Key 列表 */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border-primary">
                <th className="px-6 py-4 text-left text-sm font-medium text-text-secondary">用户</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-text-secondary">交易所</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-text-secondary">标签</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-text-secondary">权限</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-text-secondary">风险</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-text-secondary">状态</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-text-secondary">最后使用</th>
                <th className="px-6 py-4 text-right text-sm font-medium text-text-secondary">操作</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-text-secondary">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      加载中...
                    </div>
                  </td>
                </tr>
              ) : apiKeysData?.data?.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-text-secondary">
                    暂无数据
                  </td>
                </tr>
              ) : (
                apiKeysData?.data?.map((apiKey: ApiKey) => (
                  <tr key={apiKey.id} className="border-b border-border-primary hover:bg-bg-tertiary">
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-white font-medium">{apiKey.userEmail}</p>
                        <p className="text-text-secondary text-xs">{apiKey.userId.slice(0, 8)}...</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{exchangeLogos[apiKey.exchange] || '🔷'}</span>
                        <span className="text-white capitalize">{apiKey.exchange}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-white">{apiKey.label}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {apiKey.permissions?.map((perm) => (
                          <Badge key={perm} variant="secondary" size="sm">
                            {perm}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {getRiskBadge(apiKey.riskLevel)}
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={apiKey.isActive ? 'success' : 'danger'}>
                        {apiKey.isActive ? '启用' : '禁用'}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-text-secondary flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {formatTime(apiKey.lastUsedAt)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowKeyId(showKeyId === apiKey.id ? null : apiKey.id)}
                        >
                          {showKeyId === apiKey.id ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </Button>
                        {apiKey.isActive && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedKey(apiKey)}
                            className="text-danger hover:text-danger hover:bg-danger/10"
                          >
                            <Ban className="w-4 h-4 mr-1" />
                            禁用
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 分页 */}
        <div className="px-6 py-4 border-t border-border-primary flex items-center justify-between">
          <p className="text-text-secondary text-sm">
            共 {apiKeysData?.total || 0} 条记录
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="px-4 py-2 bg-bg-tertiary border border-border-primary rounded-lg text-white disabled:opacity-50"
            >
              上一页
            </button>
            <span className="px-4 py-2 text-white">
              {page} / {apiKeysData?.totalPages || 1}
            </span>
            <button
              onClick={() => setPage(page + 1)}
              disabled={page >= (apiKeysData?.totalPages || 1)}
              className="px-4 py-2 bg-bg-tertiary border border-border-primary rounded-lg text-white disabled:opacity-50"
            >
              下一页
            </button>
          </div>
        </div>
      </div>

      {/* 禁用确认对话框 */}
      <Dialog
        open={!!selectedKey}
        onClose={() => setSelectedKey(null)}
        title="确认禁用 API Key"
      >
        <div className="space-y-4">
          <p className="text-text-secondary">
            确定要禁用用户 <span className="text-white">{selectedKey?.userEmail}</span> 的此 API Key 吗？
          </p>
          <Card className="p-4 bg-bg-tertiary">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{exchangeLogos[selectedKey?.exchange || ''] || '🔷'}</span>
              <div>
                <p className="text-white capitalize">{selectedKey?.exchange}</p>
                <p className="text-text-secondary text-sm">{selectedKey?.label}</p>
              </div>
            </div>
          </Card>
          <div className="p-3 bg-danger/10 rounded-lg">
            <p className="text-sm text-danger">
              禁用后该 API Key 将无法用于交易，用户可能会受到影响
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setSelectedKey(null)}>
            取消
          </Button>
          <Button
            variant="danger"
            onClick={() => selectedKey && revokeMutation.mutate(selectedKey.id)}
            isLoading={revokeMutation.isPending}
          >
            <Ban className="w-4 h-4 mr-2" />
            确认禁用
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
