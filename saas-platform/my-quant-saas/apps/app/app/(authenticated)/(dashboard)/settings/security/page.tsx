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
  Shield,
  Key,
  Smartphone,
  History,
  Lock,
  Eye,
  EyeOff,
  CheckCircle,
  XCircle,
  AlertTriangle,
} from 'lucide-react';

export default function SecurityPage() {
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const [twoFAEnabled, setTwoFAEnabled] = useState(false);
  const [showQRCode, setShowQRCode] = useState(false);

  // 模拟登录历史
  const loginHistory = [
    { id: '1', device: 'Chrome on macOS', ip: '192.168.1.100', location: '上海', time: '2024-01-15 10:23:45', status: 'success' },
    { id: '2', device: 'Safari on iPhone', ip: '192.168.1.101', location: '上海', time: '2024-01-14 18:45:12', status: 'success' },
    { id: '3', device: 'Firefox on Windows', ip: '203.0.113.50', location: '北京', time: '2024-01-13 09:12:33', status: 'failed' },
    { id: '4', device: 'Chrome on macOS', ip: '192.168.1.100', location: '上海', time: '2024-01-12 14:56:22', status: 'success' },
  ];

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      alert('请填写完整信息');
      return;
    }
    if (newPassword !== confirmPassword) {
      alert('两次输入的密码不一致');
      return;
    }
    if (newPassword.length < 8) {
      alert('密码长度至少8位');
      return;
    }

    setSaving(true);
    // TODO: Implement API call
    setTimeout(() => {
      setSaving(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      alert('密码修改成功');
    }, 1000);
  };

  const handleToggle2FA = () => {
    if (twoFAEnabled) {
      if (confirm('确定要关闭两步验证吗？这会降低账户安全性。')) {
        setTwoFAEnabled(false);
      }
    } else {
      setShowQRCode(true);
    }
  };

  const handleVerify2FA = () => {
    // TODO: Implement 2FA verification
    setTwoFAEnabled(true);
    setShowQRCode(false);
    alert('两步验证已启用');
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">安全设置</h1>
        <p className="text-muted-foreground">管理您的账户安全和登录方式</p>
      </div>

      {/* 安全状态概览 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p className="font-medium">密码强度</p>
              <p className="text-sm text-green-500">强</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${twoFAEnabled ? 'bg-green-500/20' : 'bg-yellow-500/20'}`}>
              {twoFAEnabled ? (
                <CheckCircle className="w-5 h-5 text-green-500" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-yellow-500" />
              )}
            </div>
            <div>
              <p className="font-medium">两步验证</p>
              <p className={`text-sm ${twoFAEnabled ? 'text-green-500' : 'text-yellow-500'}`}>
                {twoFAEnabled ? '已启用' : '未启用'}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
              <History className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="font-medium">最近登录</p>
              <p className="text-sm text-muted-foreground">上海 • 今天</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 修改密码 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="w-5 h-5" />
            修改密码
          </CardTitle>
          <CardDescription>定期更换密码可以提高账户安全性</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm text-muted-foreground mb-2">
              当前密码
            </label>
            <div className="relative">
              <Input
                type={showCurrentPassword ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="输入当前密码"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-muted-foreground mb-2">
                新密码
              </label>
              <div className="relative">
                <Input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="输入新密码（至少8位）"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm text-muted-foreground mb-2">
                确认新密码
              </label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="再次输入新密码"
              />
            </div>
          </div>

          <Button onClick={handleChangePassword} disabled={saving}>
            <Lock className="w-4 h-4 mr-2" />
            {saving ? '保存中...' : '修改密码'}
          </Button>
        </CardContent>
      </Card>

      {/* 两步验证 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="w-5 h-5" />
            两步验证 (2FA)
          </CardTitle>
          <CardDescription>
            启用两步验证后，登录时需要输入手机验证码
          </CardDescription>
        </CardHeader>
        <CardContent>
          {showQRCode ? (
            <div className="space-y-4">
              <div className="p-4 bg-muted/50 rounded-lg text-center">
                <div className="w-48 h-48 mx-auto bg-white rounded-lg flex items-center justify-center mb-4">
                  <div className="text-muted-foreground text-sm">
                    [二维码占位]<br />
                    使用 Google Authenticator<br />
                    扫描此二维码
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  或手动输入密钥：<code className="bg-muted px-2 py-1 rounded">XXXX-XXXX-XXXX-XXXX</code>
                </p>
              </div>

              <div>
                <label className="block text-sm text-muted-foreground mb-2">
                  输入验证码
                </label>
                <div className="flex gap-2">
                  <Input placeholder="6位验证码" maxLength={6} className="flex-1" />
                  <Button onClick={handleVerify2FA}>验证并启用</Button>
                  <Button variant="outline" onClick={() => setShowQRCode(false)}>取消</Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-3">
                <Shield className={`w-8 h-8 ${twoFAEnabled ? 'text-green-500' : 'text-muted-foreground'}`} />
                <div>
                  <p className="font-medium">
                    两步验证{twoFAEnabled ? '已启用' : '未启用'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {twoFAEnabled
                      ? '您的账户受到两步验证保护'
                      : '启用两步验证以增强账户安全'}
                  </p>
                </div>
              </div>
              <Button
                variant={twoFAEnabled ? 'destructive' : 'default'}
                onClick={handleToggle2FA}
              >
                {twoFAEnabled ? '关闭' : '启用'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 登录历史 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="w-5 h-5" />
            登录历史
          </CardTitle>
          <CardDescription>查看您的账户登录记录</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {loginHistory.map((record) => (
              <div
                key={record.id}
                className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  {record.status === 'success' ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-500" />
                  )}
                  <div>
                    <p className="font-medium text-sm">{record.device}</p>
                    <p className="text-xs text-muted-foreground">
                      {record.location} • {record.ip}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-sm ${record.status === 'success' ? 'text-green-500' : 'text-red-500'}`}>
                    {record.status === 'success' ? '成功' : '失败'}
                  </p>
                  <p className="text-xs text-muted-foreground">{record.time}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
