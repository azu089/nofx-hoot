'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, Button } from '@/components/ui';
import {
  Users,
  TrendingUp,
  Gift,
  ChevronLeft,
  CheckCircle,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

export default function AgentApplyPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isApplied, setIsApplied] = useState(false);

  const handleApply = async () => {
    setIsSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/agents/apply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      if (data.code === 0) {
        setIsApplied(true);
        toast.success('申请已提交，请等待审核');
      } else {
        toast.error(data.message || '申请失败');
      }
    } catch (error) {
      toast.error('网络错误，请稍后重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isApplied) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="p-8">
            <div className="w-16 h-16 bg-success/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-success" />
            </div>
            <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">
              申请已提交
            </h2>
            <p className="text-[var(--text-secondary)] mb-6">
              我们将在 1-3 个工作日内审核您的申请，审核结果将通过邮件通知。
            </p>
            <Button
              variant="primary"
              className="w-full"
              onClick={() => router.push('/dashboard')}
            >
              返回首页
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] p-4 lg:p-6">
      {/* 返回按钮 */}
      <div className="mb-6">
        <Link
          href="/me"
          className="inline-flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          返回
        </Link>
      </div>

      <div className="max-w-2xl mx-auto">
        {/* 标题 */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
            成为代理商
          </h1>
          <p className="text-[var(--text-secondary)]">
            加入 QuantFi 代理商计划，推广赚取丰厚佣金
          </p>
        </div>

        {/* 权益介绍 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-[var(--brand-primary)]/20 rounded-xl flex items-center justify-center mx-auto mb-3">
                <TrendingUp className="w-6 h-6 text-[var(--brand-primary)]" />
              </div>
              <h3 className="font-medium text-[var(--text-primary)] mb-1">
                高额返佣
              </h3>
              <p className="text-sm text-[var(--text-secondary)]">
                最高 30% 交易返佣
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-success/20 rounded-xl flex items-center justify-center mx-auto mb-3">
                <Users className="w-6 h-6 text-success" />
              </div>
              <h3 className="font-medium text-[var(--text-primary)] mb-1">
                多级分销
              </h3>
              <p className="text-sm text-[var(--text-secondary)]">
                支持二级下线返佣
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-warning/20 rounded-xl flex items-center justify-center mx-auto mb-3">
                <Gift className="w-6 h-6 text-warning" />
              </div>
              <h3 className="font-medium text-[var(--text-primary)] mb-1">
                专属权益
              </h3>
              <p className="text-sm text-[var(--text-secondary)]">
                推广素材、数据报表
              </p>
            </CardContent>
          </Card>
        </div>

        {/* 申请要求 */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <h3 className="font-medium text-[var(--text-primary)] mb-4">
              申请要求
            </h3>
            <ul className="space-y-3 text-sm text-[var(--text-secondary)]">
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                <span>完成账户实名认证</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                <span>账户余额 ≥ 100 USDT 或已有 VIP 订阅</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                <span>拥有社群、媒体或其他推广渠道</span>
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* 申请按钮 */}
        <Button
          variant="gradient"
          className="w-full"
          onClick={handleApply}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              提交中...
            </>
          ) : (
            '立即申请'
          )}
        </Button>

        <p className="text-center text-xs text-[var(--text-tertiary)] mt-4">
          提交申请即表示您同意
          <Link href="/terms" className="text-[var(--brand-primary)] hover:underline mx-1">
            代理商协议
          </Link>
        </p>
      </div>
    </div>
  );
}
