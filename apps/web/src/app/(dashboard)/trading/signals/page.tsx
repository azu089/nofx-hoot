'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Zap,
  Clock,
  AlertCircle,
} from 'lucide-react';

export default function SignalsPage() {
  return (
    <div className="min-h-screen bg-bg-primary p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* 页面标题 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">信号中心</h1>
            <p className="text-text-secondary mt-1">
              实时交易信号与 K 线分析
            </p>
          </div>
          <Badge className="bg-warning/20 text-warning">
            功能开发中
          </Badge>
        </div>

        {/* 功能开发中占位 */}
        <div className="flex items-center justify-center min-h-[600px]">
          <Card className="p-12 max-w-2xl w-full">
            <div className="text-center space-y-6">
              {/* 图标 */}
              <div className="flex justify-center">
                <div className="relative">
                  <div className="w-24 h-24 bg-brand-primary/10 rounded-full flex items-center justify-center">
                    <Zap className="w-12 h-12 text-brand-primary" />
                  </div>
                  <div className="absolute -top-1 -right-1 w-8 h-8 bg-warning/20 rounded-full flex items-center justify-center">
                    <Clock className="w-4 h-4 text-warning" />
                  </div>
                </div>
              </div>

              {/* 标题 */}
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-text-primary">
                  信号中心功能开发中
                </h2>
                <p className="text-text-secondary text-lg">
                  我们正在为您打造智能交易信号系统
                </p>
              </div>

              {/* 功能说明 */}
              <div className="bg-bg-secondary/50 rounded-lg p-6 space-y-4">
                <h3 className="font-semibold text-text-primary text-left">
                  即将上线的功能
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                  <div className="flex items-start gap-3">
                    <div className="w-5 h-5 bg-brand-primary/20 rounded flex items-center justify-center flex-shrink-0 mt-0.5">
                      <div className="w-2 h-2 bg-brand-primary rounded-full" />
                    </div>
                    <div>
                      <p className="font-medium text-text-primary">实时交易信号</p>
                      <p className="text-sm text-text-secondary">基于多指标分析的买卖信号推送</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-5 h-5 bg-brand-primary/20 rounded flex items-center justify-center flex-shrink-0 mt-0.5">
                      <div className="w-2 h-2 bg-brand-primary rounded-full" />
                    </div>
                    <div>
                      <p className="font-medium text-text-primary">K 线图表分析</p>
                      <p className="text-sm text-text-secondary">专业的技术分析图表工具</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-5 h-5 bg-brand-primary/20 rounded flex items-center justify-center flex-shrink-0 mt-0.5">
                      <div className="w-2 h-2 bg-brand-primary rounded-full" />
                    </div>
                    <div>
                      <p className="font-medium text-text-primary">智能策略参数</p>
                      <p className="text-sm text-text-secondary">可自定义的策略参数配置</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-5 h-5 bg-brand-primary/20 rounded flex items-center justify-center flex-shrink-0 mt-0.5">
                      <div className="w-2 h-2 bg-brand-primary rounded-full" />
                    </div>
                    <div>
                      <p className="font-medium text-text-primary">信号统计分析</p>
                      <p className="text-sm text-text-secondary">信号成功率与收益统计</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 提示信息 */}
              <div className="flex items-start gap-3 bg-brand-primary/5 rounded-lg p-4 text-left">
                <AlertCircle className="w-5 h-5 text-brand-primary flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-medium text-text-primary">
                    开发进度说明
                  </p>
                  <p className="text-sm text-text-secondary">
                    信号中心功能需要接入实时行情数据源和策略分析引擎，我们正在努力开发中。
                    在此期间，您可以使用交易控制台进行手动交易。
                  </p>
                </div>
              </div>

              {/* 操作按钮 */}
              <div className="flex items-center justify-center gap-4 pt-4">
                <Button
                  variant="outline"
                  onClick={() => window.location.href = '/trading'}
                >
                  前往交易控制台
                </Button>
                <Button
                  variant="primary"
                  onClick={() => window.location.href = '/strategies'}
                >
                  浏览策略市场
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
