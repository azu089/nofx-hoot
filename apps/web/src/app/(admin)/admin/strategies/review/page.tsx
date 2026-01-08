'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { CheckCircle2, XCircle, AlertTriangle, Eye, Clock } from 'lucide-react';

interface Strategy {
  id: string;
  name: string;
  description: string | null;
  owner_type: string;
  uploader_id: string | null;
  review_status: string;
  auto_check_passed: boolean;
  auto_check_warnings: string[] | null;
  created_at: string;
  updated_at: string;
}

interface PendingStrategiesResponse {
  strategies: Strategy[];
  total: number;
  page: number;
  totalPages: number;
}

export default function StrategyReviewPage() {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selectedStrategy, setSelectedStrategy] = useState<Strategy | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // 获取待审核策略列表
  const fetchPendingStrategies = async (currentPage = 1) => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/admin/strategies/pending-review?page=${currentPage}&limit=20`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        },
      );

      if (!response.ok) throw new Error('获取失败');

      const data: { code: number; data: PendingStrategiesResponse } = await response.json();

      if (data.code === 0) {
        setStrategies(data.data.strategies);
        setTotal(data.data.total);
        setPage(data.data.page);
        setTotalPages(data.data.totalPages);
      } else {
        toast.error('获取待审核策略列表失败');
      }
    } catch (error) {
      console.error('获取待审核策略失败:', error);
      toast.error('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  // 审核通过
  const handleApprove = async (strategyId: string) => {
    setActionLoading(true);
    try {
      const response = await fetch(`/api/admin/strategies/${strategyId}/approve`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) throw new Error('审核失败');

      const data = await response.json();

      if (data.code === 0) {
        toast.success('策略已通过审核并上架');
        setSelectedStrategy(null);
        fetchPendingStrategies(page); // 刷新列表
      } else {
        toast.error(data.message || '审核失败');
      }
    } catch (error) {
      console.error('审核通过失败:', error);
      toast.error('操作失败，请稍后重试');
    } finally {
      setActionLoading(false);
    }
  };

  // 拒绝策略
  const handleReject = async (strategyId: string) => {
    if (!rejectReason.trim()) {
      toast.error('请填写拒绝原因');
      return;
    }

    setActionLoading(true);
    try {
      const response = await fetch(`/api/admin/strategies/${strategyId}/reject`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason: rejectReason }),
      });

      if (!response.ok) throw new Error('拒绝失败');

      const data = await response.json();

      if (data.code === 0) {
        toast.success('策略已拒绝');
        setSelectedStrategy(null);
        setRejectReason('');
        fetchPendingStrategies(page); // 刷新列表
      } else {
        toast.error(data.message || '拒绝失败');
      }
    } catch (error) {
      console.error('拒绝策略失败:', error);
      toast.error('操作失败，请稍后重试');
    } finally {
      setActionLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingStrategies();
  }, []);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-text-primary">策略审核</h1>
          <p className="text-text-secondary mt-1">
            待审核策略：{total} 个 | 当前第 {page}/{totalPages} 页
          </p>
        </div>
      </div>

      {/* 待审核列表 */}
      {loading ? (
        <div className="text-center py-12 text-text-secondary">加载中...</div>
      ) : strategies.length === 0 ? (
        <Card className="bg-bg-secondary border-border-primary">
          <CardContent className="py-12 text-center text-text-secondary">
            <CheckCircle2 className="w-16 h-16 mx-auto mb-4 text-success" />
            <p className="text-lg">暂无待审核策略</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {strategies.map((strategy) => (
            <Card
              key={strategy.id}
              className={`bg-bg-secondary border ${
                strategy.review_status === 'flagged'
                  ? 'border-warning'
                  : 'border-border-primary'
              }`}
            >
              <CardHeader className="flex flex-row items-start justify-between space-y-0">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <CardTitle className="text-text-primary">{strategy.name}</CardTitle>
                    {strategy.review_status === 'flagged' ? (
                      <Badge className="bg-warning/20 text-warning border border-warning/50">
                        <AlertTriangle className="w-3 h-3 mr-1" />
                        需人工审核
                      </Badge>
                    ) : (
                      <Badge className="bg-brand-primary/20 text-brand-primary border border-brand-primary/50">
                        <Clock className="w-3 h-3 mr-1" />
                        待审核
                      </Badge>
                    )}
                    {strategy.auto_check_passed && (
                      <Badge className="bg-success/20 text-success border border-success/50">
                        ✓ 自动检测通过
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-text-secondary mb-2">
                    {strategy.description || '无描述'}
                  </p>
                  <p className="text-xs text-text-tertiary">
                    上传时间：{new Date(strategy.created_at).toLocaleString('zh-CN')}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedStrategy(strategy)}
                  className="ml-4"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  审核
                </Button>
              </CardHeader>

              {/* 自动检测警告 */}
              {strategy.auto_check_warnings && strategy.auto_check_warnings.length > 0 && (
                <CardContent className="pt-0">
                  <div className="bg-warning/10 border-l-4 border-warning px-4 py-3 rounded">
                    <p className="text-sm font-semibold text-warning mb-2">
                      ⚠️ 自动检测警告
                    </p>
                    <ul className="text-xs text-text-secondary space-y-1">
                      {strategy.auto_check_warnings.map((warning, index) => (
                        <li key={index}>• {warning}</li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            disabled={page === 1}
            onClick={() => fetchPendingStrategies(page - 1)}
          >
            上一页
          </Button>
          <span className="flex items-center px-4 text-text-secondary">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            disabled={page === totalPages}
            onClick={() => fetchPendingStrategies(page + 1)}
          >
            下一页
          </Button>
        </div>
      )}

      {/* 审核弹窗 */}
      {selectedStrategy && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <Card className="bg-bg-secondary border-border-primary w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle className="text-text-primary flex items-center justify-between">
                <span>审核策略：{selectedStrategy.name}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedStrategy(null);
                    setRejectReason('');
                  }}
                >
                  ✕
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* 基本信息 */}
              <div>
                <h3 className="text-sm font-semibold text-text-primary mb-2">基本信息</h3>
                <div className="bg-bg-tertiary rounded-lg p-4 space-y-2 text-sm">
                  <p className="text-text-secondary">
                    <span className="text-text-tertiary">策略 ID：</span>
                    {selectedStrategy.id}
                  </p>
                  <p className="text-text-secondary">
                    <span className="text-text-tertiary">上传者 ID：</span>
                    {selectedStrategy.uploader_id}
                  </p>
                  <p className="text-text-secondary">
                    <span className="text-text-tertiary">上传时间：</span>
                    {new Date(selectedStrategy.created_at).toLocaleString('zh-CN')}
                  </p>
                  <p className="text-text-secondary">
                    <span className="text-text-tertiary">描述：</span>
                    {selectedStrategy.description || '无'}
                  </p>
                </div>
              </div>

              {/* 自动检测结果 */}
              <div>
                <h3 className="text-sm font-semibold text-text-primary mb-2">
                  自动检测结果
                </h3>
                {selectedStrategy.auto_check_passed ? (
                  <div className="bg-success/10 border-l-4 border-success px-4 py-3 rounded">
                    <p className="text-sm text-success">
                      ✓ 自动检测通过，无致命问题
                    </p>
                  </div>
                ) : (
                  <div className="bg-danger/10 border-l-4 border-danger px-4 py-3 rounded">
                    <p className="text-sm text-danger">✕ 自动检测未通过，存在安全风险</p>
                  </div>
                )}

                {selectedStrategy.auto_check_warnings &&
                  selectedStrategy.auto_check_warnings.length > 0 && (
                    <div className="mt-3 bg-warning/10 border-l-4 border-warning px-4 py-3 rounded">
                      <p className="text-sm font-semibold text-warning mb-2">警告项：</p>
                      <ul className="text-xs text-text-secondary space-y-1">
                        {selectedStrategy.auto_check_warnings.map((warning, index) => (
                          <li key={index}>• {warning}</li>
                        ))}
                      </ul>
                    </div>
                  )}
              </div>

              {/* 拒绝原因输入 */}
              <div>
                <label className="text-sm font-semibold text-text-primary block mb-2">
                  拒绝原因（选填）
                </label>
                <Textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="请填写拒绝原因（如需拒绝）"
                  className="bg-bg-tertiary border-border-primary text-text-primary min-h-[100px]"
                  maxLength={500}
                />
                <p className="text-xs text-text-tertiary mt-1">
                  {rejectReason.length}/500 字符
                </p>
              </div>

              {/* 操作按钮 */}
              <div className="flex gap-3">
                <Button
                  onClick={() => handleApprove(selectedStrategy.id)}
                  disabled={actionLoading}
                  className="flex-1 bg-success hover:bg-success/80 text-white"
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  {actionLoading ? '处理中...' : '审核通过'}
                </Button>
                <Button
                  onClick={() => handleReject(selectedStrategy.id)}
                  disabled={actionLoading || !rejectReason.trim()}
                  variant="danger"
                  className="flex-1"
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  {actionLoading ? '处理中...' : '拒绝策略'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
