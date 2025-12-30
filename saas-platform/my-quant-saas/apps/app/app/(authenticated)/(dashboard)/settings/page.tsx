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
  User,
  Mail,
  Phone,
  Globe,
  Bell,
  Shield,
  Key,
  AlertTriangle,
  Save,
  ChevronRight,
} from 'lucide-react';
import Link from 'next/link';

export default function SettingsPage() {
  const [profile, setProfile] = useState({
    nickname: '量化交易者',
    email: 'trader@example.com',
    phone: '+86 138****8888',
    language: 'zh-CN',
    timezone: 'Asia/Shanghai',
  });

  const [notifications, setNotifications] = useState({
    tradeAlerts: true,
    profitAlerts: true,
    systemNotices: true,
    emailNotifications: false,
  });

  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    // TODO: Implement save API
    setTimeout(() => {
      setSaving(false);
      alert('设置已保存');
    }, 500);
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">账户设置</h1>
        <p className="text-muted-foreground">管理您的账户信息和偏好设置</p>
      </div>

      {/* 快速入口 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href="/settings/security">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                  <Shield className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <p className="font-medium">安全设置</p>
                  <p className="text-sm text-muted-foreground">密码、2FA</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>

        <Link href="/wallet/api-keys">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                  <Key className="w-5 h-5 text-purple-500" />
                </div>
                <div>
                  <p className="font-medium">API Key 管理</p>
                  <p className="text-sm text-muted-foreground">交易所绑定</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>

        <Link href="/settings/panic">
          <Card className="hover:border-red-500/50 transition-colors cursor-pointer">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-500/20 rounded-lg flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                </div>
                <div>
                  <p className="font-medium">紧急按钮</p>
                  <p className="text-sm text-muted-foreground">一键清仓</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* 个人资料 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            个人资料
          </CardTitle>
          <CardDescription>更新您的个人信息</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-muted-foreground mb-2">
                昵称
              </label>
              <Input
                value={profile.nickname}
                onChange={(e) => setProfile({ ...profile, nickname: e.target.value })}
                placeholder="输入昵称"
              />
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-2">
                邮箱
              </label>
              <div className="flex gap-2">
                <Input
                  value={profile.email}
                  disabled
                  className="flex-1"
                />
                <Button variant="outline" size="sm">
                  修改
                </Button>
              </div>
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-2">
                手机号
              </label>
              <div className="flex gap-2">
                <Input
                  value={profile.phone}
                  disabled
                  className="flex-1"
                />
                <Button variant="outline" size="sm">
                  绑定
                </Button>
              </div>
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-2">
                时区
              </label>
              <select
                value={profile.timezone}
                onChange={(e) => setProfile({ ...profile, timezone: e.target.value })}
                className="w-full px-4 py-2 bg-muted border border-border rounded-lg"
              >
                <option value="Asia/Shanghai">中国标准时间 (UTC+8)</option>
                <option value="Asia/Tokyo">日本标准时间 (UTC+9)</option>
                <option value="America/New_York">美国东部时间 (UTC-5)</option>
                <option value="Europe/London">英国标准时间 (UTC+0)</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 通知设置 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            通知设置
          </CardTitle>
          <CardDescription>管理您的通知偏好</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div>
                <p className="font-medium">交易提醒</p>
                <p className="text-sm text-muted-foreground">策略执行交易时通知</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifications.tradeAlerts}
                  onChange={(e) =>
                    setNotifications({ ...notifications, tradeAlerts: e.target.checked })
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-muted rounded-full peer peer-checked:bg-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5"></div>
              </label>
            </div>

            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div>
                <p className="font-medium">盈亏提醒</p>
                <p className="text-sm text-muted-foreground">每日盈亏汇总通知</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifications.profitAlerts}
                  onChange={(e) =>
                    setNotifications({ ...notifications, profitAlerts: e.target.checked })
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-muted rounded-full peer peer-checked:bg-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5"></div>
              </label>
            </div>

            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div>
                <p className="font-medium">系统通知</p>
                <p className="text-sm text-muted-foreground">平台公告和系统消息</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifications.systemNotices}
                  onChange={(e) =>
                    setNotifications({ ...notifications, systemNotices: e.target.checked })
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-muted rounded-full peer peer-checked:bg-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5"></div>
              </label>
            </div>

            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div>
                <p className="font-medium">邮件通知</p>
                <p className="text-sm text-muted-foreground">通过邮件接收重要通知</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifications.emailNotifications}
                  onChange={(e) =>
                    setNotifications({ ...notifications, emailNotifications: e.target.checked })
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-muted rounded-full peer peer-checked:bg-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5"></div>
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 保存按钮 */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          <Save className="w-4 h-4 mr-2" />
          {saving ? '保存中...' : '保存设置'}
        </Button>
      </div>
    </div>
  );
}
