'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Button, MobileHeader } from '@/components/ui';
import { CreditCard, Plus, AlertTriangle } from 'lucide-react';

export default function BankCardsPage() {
  const [cards] = useState<any[]>([]);

  return (
    <div className="space-y-6">
      <MobileHeader
        title="银行卡管理"
        rightAction={
          <Button disabled>
            <Plus className="w-4 h-4 mr-2" />
            添加
          </Button>
        }
      />

      {/* 功能提示 */}
      <Card className="border-warning/30 bg-warning/5">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
            <div className="text-sm text-text-secondary">
              <p className="font-medium text-warning mb-1">功能开发中</p>
              <p>银行卡绑定功能正在开发中，敬请期待。目前仅支持加密货币充值和提现。</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 空状态 */}
      <Card>
        <CardContent className="py-12 text-center">
          <CreditCard className="w-16 h-16 mx-auto mb-4 text-text-disabled" />
          <h3 className="text-lg font-medium text-white mb-2">暂无银行卡</h3>
          <p className="text-text-secondary mb-4">银行卡绑定功能即将上线</p>
          <Button disabled>
            <Plus className="w-4 h-4 mr-2" />
            添加银行卡
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
