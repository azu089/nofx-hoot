'use client';

import { useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@repo/design-system/components/ui/card';
import { Button } from '@repo/design-system/components/ui/button';
import { Input } from '@repo/design-system/components/ui/input';
import {
  AlertTriangle,
  ShieldAlert,
  Power,
  Trash2,
  Lock,
  AlertOctagon,
  CheckCircle,
} from 'lucide-react';

export default function PanicPage() {
  const [confirmText, setConfirmText] = useState('');
  const [password, setPassword] = useState('');
  const [executing, setExecuting] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState<string | null>(null);

  const panicActions = [
    {
      id: 'stop_all',
      title: '停止所有策略',
      description: '立即停止所有正在运行的交易策略，保留持仓不动',
      icon: Power,
      color: 'yellow',
      confirmText: '停止策略',
      danger: false,
    },
    {
      id: 'close_positions',
      title: '市价平仓',
      description: '以市价卖出所有持仓，可能会有滑点损失',
      icon: AlertTriangle,
      color: 'orange',
      confirmText: '确认平仓',
      danger: true,
    },
    {
      id: 'revoke_api',
      title: '撤销 API 权限',
      description: '撤销所有交易所 API Key 的交易权限',
      icon: Lock,
      color: 'red',
      confirmText: '撤销权限',
      danger: true,
    },
    {
      id: 'destroy_vps',
      title: '销毁所有 VPS',
      description: '立即销毁所有 VPS 实例，数据将自动备份到 S3',
      icon: Trash2,
      color: 'red',
      confirmText: '销毁VPS',
      danger: true,
    },
  ];

  const handleAction = async (actionId: string) => {
    const action = panicActions.find((a) => a.id === actionId);
    if (!action) return;

    if (action.danger && confirmText !== action.confirmText) {
      alert(`请输入"${action.confirmText}"以确认操作`);
      return;
    }

    if (!password) {
      alert('请输入密码');
      return;
    }

    setExecuting(true);
    // TODO: Implement API call
    setTimeout(() => {
      setExecuting(false);
      setShowConfirmDialog(null);
      setConfirmText('');
      setPassword('');
      alert(`${action.title}指令已发送`);
    }, 1500);
  };

  const getColorClasses = (color: string) => {
    const colors: Record<string, { bg: string; text: string; border: string }> = {
      yellow: { bg: 'bg-yellow-500/20', text: 'text-yellow-500', border: 'border-yellow-500/50' },
      orange: { bg: 'bg-orange-500/20', text: 'text-orange-500', border: 'border-orange-500/50' },
      red: { bg: 'bg-red-500/20', text: 'text-red-500', border: 'border-red-500/50' },
    };
    return colors[color] || colors.yellow;
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ShieldAlert className="w-7 h-7 text-red-500" />
          紧急按钮
        </h1>
        <p className="text-muted-foreground">
          当发生紧急情况时，使用以下按钮快速采取行动
        </p>
      </div>

      {/* 警告提示 */}
      <Card className="border-red-500/50 bg-red-500/10">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertOctagon className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-red-500">请谨慎操作</p>
              <p className="text-sm text-muted-foreground">
                以下操作不可撤销，执行前请确保您已了解操作的影响。
                建议在非紧急情况下使用常规方式管理您的交易和资产。
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 紧急操作列表 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {panicActions.map((action) => {
          const colors = getColorClasses(action.color);
          const Icon = action.icon;

          return (
            <Card key={action.id} className={`border ${colors.border}`}>
              <CardHeader>
                <div className="flex items-start gap-3">
                  <div className={`w-12 h-12 ${colors.bg} rounded-lg flex items-center justify-center`}>
                    <Icon className={`w-6 h-6 ${colors.text}`} />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-lg">{action.title}</CardTitle>
                    <CardDescription>{action.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {showConfirmDialog === action.id ? (
                  <div className="space-y-4">
                    {action.danger && (
                      <div>
                        <label className="block text-sm text-muted-foreground mb-2">
                          输入「{action.confirmText}」以确认
                        </label>
                        <Input
                          value={confirmText}
                          onChange={(e) => setConfirmText(e.target.value)}
                          placeholder={action.confirmText}
                        />
                      </div>
                    )}
                    <div>
                      <label className="block text-sm text-muted-foreground mb-2">
                        输入密码验证身份
                      </label>
                      <Input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="输入登录密码"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="destructive"
                        onClick={() => handleAction(action.id)}
                        disabled={executing || (action.danger && confirmText !== action.confirmText)}
                        className="flex-1"
                      >
                        {executing ? '执行中...' : '确认执行'}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowConfirmDialog(null);
                          setConfirmText('');
                          setPassword('');
                        }}
                      >
                        取消
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant={action.danger ? 'destructive' : 'outline'}
                    className="w-full"
                    onClick={() => setShowConfirmDialog(action.id)}
                  >
                    <Icon className="w-4 h-4 mr-2" />
                    {action.title}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* 最近操作记录 */}
      <Card>
        <CardHeader>
          <CardTitle>操作记录</CardTitle>
          <CardDescription>最近的紧急操作执行记录</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <CheckCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>暂无紧急操作记录</p>
            <p className="text-sm mt-1">这是好事 - 说明一切运行正常</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
