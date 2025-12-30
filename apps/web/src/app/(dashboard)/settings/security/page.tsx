'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import {
  Shield,
  Key,
  Smartphone,
  Monitor,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle
} from 'lucide-react';

export default function SecurityPage() {
  // 表单状态
  const [passwordForm, setPasswordForm] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  // 2FA 状态
  const [is2FAEnabled, setIs2FAEnabled] = useState(false);
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [qrCode, setQrCode] = useState('');
  const [verificationCode, setVerificationCode] = useState('');

  // 登录日志状态
  const [loginLogs, setLoginLogs] = useState([
    {
      id: 1,
      ip: '192.168.1.100',
      device: 'MacBook Pro (Chrome 120)',
      location: '中国 北京',
      time: '2025-12-28 10:30:25',
      status: 'success',
    },
    {
      id: 2,
      ip: '192.168.1.105',
      device: 'iPhone 15 Pro (Safari 17)',
      location: '中国 北京',
      time: '2025-12-28 08:15:10',
      status: 'success',
    },
    {
      id: 3,
      ip: '203.0.113.45',
      device: 'Windows PC (Firefox 121)',
      location: '未知',
      time: '2025-12-27 23:45:00',
      status: 'failed',
    },
  ]);

  // 已登录设备
  const [devices, setDevices] = useState([
    {
      id: 1,
      name: 'MacBook Pro',
      browser: 'Chrome 120',
      ip: '192.168.1.100',
      location: '中国 北京',
      lastActive: '刚刚',
      isCurrent: true,
    },
    {
      id: 2,
      name: 'iPhone 15 Pro',
      browser: 'Safari 17',
      ip: '192.168.1.105',
      location: '中国 北京',
      lastActive: '2 小时前',
      isCurrent: false,
    },
  ]);

  // 修改密码
  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      alert('两次输入的新密码不一致');
      return;
    }

    try {
      // TODO: 调用 API - PATCH /api/auth/password
      console.log('修改密码:', passwordForm);
      alert('密码修改成功，请重新登录');

      // 清空表单
      setPasswordForm({
        oldPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch (error) {
      console.error('修改密码失败:', error);
      alert('修改密码失败，请稍后重试');
    }
  };

  // 启用 2FA
  const handleEnable2FA = async () => {
    try {
      // TODO: 调用 API - POST /api/auth/totp/enable
      // 返回 QR Code
      setQrCode('https://via.placeholder.com/200x200?text=QR+Code');
      setShow2FAModal(true);
    } catch (error) {
      console.error('启用 2FA 失败:', error);
      alert('启用 2FA 失败，请稍后重试');
    }
  };

  // 验证 2FA 代码
  const handleVerify2FA = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      alert('请输入 6 位验证码');
      return;
    }

    try {
      // TODO: 调用 API 验证验证码
      console.log('验证 2FA 代码:', verificationCode);
      setIs2FAEnabled(true);
      setShow2FAModal(false);
      setVerificationCode('');
      alert('2FA 启用成功');
    } catch (error) {
      console.error('验证失败:', error);
      alert('验证码错误，请重试');
    }
  };

  // 禁用 2FA
  const handleDisable2FA = async () => {
    if (!confirm('确定要关闭双因素认证吗？这会降低账户安全性。')) {
      return;
    }

    try {
      // TODO: 调用 API - POST /api/auth/totp/disable
      console.log('禁用 2FA');
      setIs2FAEnabled(false);
      alert('2FA 已关闭');
    } catch (error) {
      console.error('禁用 2FA 失败:', error);
      alert('操作失败，请稍后重试');
    }
  };

  // 远程登出设备
  const handleLogoutDevice = async (deviceId: number) => {
    if (!confirm('确定要登出该设备吗？')) {
      return;
    }

    try {
      // TODO: 调用 API - POST /api/auth/logout-device
      console.log('登出设备:', deviceId);
      setDevices(devices.filter((d) => d.id !== deviceId));
      alert('设备已登出');
    } catch (error) {
      console.error('登出失败:', error);
      alert('操作失败，请稍后重试');
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center gap-3">
        <Shield className="w-8 h-8 text-brand-primary" />
        <div>
          <h1 className="text-2xl font-bold text-white">安全设置</h1>
          <p className="text-sm text-text-secondary">保护您的账户安全</p>
        </div>
      </div>

      {/* 修改密码 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="w-5 h-5" />
            修改密码
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordChange} className="space-y-4 max-w-md">
            <Input
              label="旧密码"
              type="password"
              placeholder="请输入旧密码"
              value={passwordForm.oldPassword}
              onChange={(e) =>
                setPasswordForm({ ...passwordForm, oldPassword: e.target.value })
              }
              required
            />
            <Input
              label="新密码"
              type="password"
              placeholder="至少 8 位字符"
              value={passwordForm.newPassword}
              onChange={(e) =>
                setPasswordForm({ ...passwordForm, newPassword: e.target.value })
              }
              required
            />
            <Input
              label="确认新密码"
              type="password"
              placeholder="再次输入新密码"
              value={passwordForm.confirmPassword}
              onChange={(e) =>
                setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })
              }
              required
            />
            <Button type="submit" variant="primary">
              修改密码
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* 双因素认证 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="w-5 h-5" />
            双因素认证 (2FA)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-bg-tertiary/50 rounded-lg">
              <div className="flex items-center gap-3">
                {is2FAEnabled ? (
                  <CheckCircle className="w-5 h-5 text-success" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-warning" />
                )}
                <div>
                  <p className="font-medium text-white">
                    {is2FAEnabled ? '已启用' : '未启用'}
                  </p>
                  <p className="text-sm text-text-secondary">
                    {is2FAEnabled
                      ? '您的账户受 Google Authenticator 保护'
                      : '建议启用 2FA 以提高账户安全性'}
                  </p>
                  {is2FAEnabled && (
                    <p className="text-xs text-text-tertiary mt-1">
                      上次验证：2 小时前
                    </p>
                  )}
                </div>
              </div>
              {is2FAEnabled ? (
                <Button variant="danger" size="sm" onClick={handleDisable2FA}>
                  关闭 2FA
                </Button>
              ) : (
                <Button variant="primary" size="sm" onClick={handleEnable2FA}>
                  启用 2FA
                </Button>
              )}
            </div>

            <div className="text-sm text-text-secondary space-y-1">
              <p>💡 什么是双因素认证？</p>
              <p className="text-xs text-text-tertiary">
                登录时除了密码，还需要输入手机 APP 生成的 6 位验证码，防止密码泄露导致账户被盗。
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 登录日志 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            登录日志
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {loginLogs.map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between p-4 bg-bg-tertiary/50 rounded-lg hover:bg-bg-tertiary transition-colors"
              >
                <div className="flex items-center gap-3">
                  {log.status === 'success' ? (
                    <CheckCircle className="w-5 h-5 text-success" />
                  ) : (
                    <XCircle className="w-5 h-5 text-danger" />
                  )}
                  <div>
                    <p className="font-medium text-white">{log.device}</p>
                    <p className="text-sm text-text-secondary">
                      {log.ip} · {log.location}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-text-secondary">{log.time}</p>
                  <p
                    className={`text-xs font-medium ${
                      log.status === 'success' ? 'text-success' : 'text-danger'
                    }`}
                  >
                    {log.status === 'success' ? '登录成功' : '登录失败'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 已登录设备 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Monitor className="w-5 h-5" />
            已登录设备
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {devices.map((device) => (
              <div
                key={device.id}
                className="flex items-center justify-between p-4 bg-bg-tertiary/50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <Monitor className="w-5 h-5 text-text-secondary" />
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-white">{device.name}</p>
                      {device.isCurrent && (
                        <span className="px-2 py-0.5 text-xs bg-brand-primary/20 text-brand-primary rounded">
                          当前设备
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-text-secondary">
                      {device.browser} · {device.ip} · {device.location}
                    </p>
                    <p className="text-xs text-text-tertiary mt-1">
                      上次活跃：{device.lastActive}
                    </p>
                  </div>
                </div>
                {!device.isCurrent && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleLogoutDevice(device.id)}
                  >
                    登出
                  </Button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 2FA 启用弹窗 */}
      <Modal
        open={show2FAModal}
        onClose={() => setShow2FAModal(false)}
        title="启用双因素认证"
        size="md"
      >
        <div className="space-y-4">
          <div className="text-center">
            <p className="text-text-secondary mb-4">
              使用 Google Authenticator 或其他 TOTP 应用扫描二维码
            </p>
            {qrCode && (
              <div className="inline-block p-4 bg-white rounded-lg">
                <img src={qrCode} alt="QR Code" className="w-48 h-48" />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-sm text-text-secondary">手动输入密钥：</p>
            <code className="block p-3 bg-bg-tertiary rounded-lg text-sm font-mono text-white">
              JBSWY3DPEHPK3PXP
            </code>
          </div>

          <Input
            label="验证码"
            placeholder="输入 6 位验证码"
            value={verificationCode}
            onChange={(e) => setVerificationCode(e.target.value)}
            maxLength={6}
          />

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setShow2FAModal(false)}
            >
              取消
            </Button>
            <Button
              variant="primary"
              className="flex-1"
              onClick={handleVerify2FA}
            >
              验证并启用
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
