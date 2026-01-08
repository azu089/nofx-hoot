'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { MobileHeader } from '@/components/ui';
import {
  Shield,
  Key,
  Smartphone,
  Monitor,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
} from 'lucide-react';
import { authApi, userApi } from '@/lib/api';
import { toast } from 'sonner';

interface TotpStatus {
  enabled: boolean;
  enabledAt?: string;
}

interface TotpSetup {
  secret: string;
  uri: string;
  qrCode: string;
}

interface LoginLog {
  id: string;
  ip: string;
  device: string;
  location: string;
  time: string;
  status: string;
}

interface Device {
  hash: string;
  createdAt: string;
  lastSeenAt: string;
  loginCount: number;
  browser: string;
  os: string;
}

export default function SecurityPage() {
  // 加载状态
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // 表单状态
  const [passwordForm, setPasswordForm] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  // 2FA 状态
  const [totpStatus, setTotpStatus] = useState<TotpStatus>({ enabled: false });
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [totpSetup, setTotpSetup] = useState<TotpSetup | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [disablePassword, setDisablePassword] = useState('');
  const [showDisableModal, setShowDisableModal] = useState(false);

  // 登录日志状态
  const [loginLogs, setLoginLogs] = useState<LoginLog[]>([]);

  // 已登录设备
  const [devices, setDevices] = useState<Device[]>([]);

  // 加载数据
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [statusRes, logsRes, devicesRes] = await Promise.all([
        authApi.getTotpStatus(),
        userApi.getLoginLogs(),
        authApi.getDevices(),
      ]);

      if (statusRes.code === 0) {
        setTotpStatus(statusRes.data);
      }
      if (logsRes.code === 0) {
        setLoginLogs(logsRes.data);
      }
      if (devicesRes.code === 0) {
        setDevices(devicesRes.data);
      }
    } catch (error) {
      console.error('Failed to fetch security data:', error);
      toast.error('获取安全信息失败');
    } finally {
      setLoading(false);
    }
  };

  // 修改密码
  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('两次输入的新密码不一致');
      return;
    }

    if (passwordForm.newPassword.length < 8) {
      toast.error('新密码至少需要 8 位字符');
      return;
    }

    try {
      setSubmitting(true);
      await userApi.updateProfile({ password: passwordForm.newPassword });
      toast.success('密码修改成功');
      setPasswordForm({
        oldPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch (error) {
      console.error('修改密码失败:', error);
      toast.error('修改密码失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  // 启用 2FA - 获取 QR Code
  const handleEnable2FA = async () => {
    try {
      setSubmitting(true);
      const res = await authApi.setupTotp();
      if (res.code === 0) {
        setTotpSetup(res.data);
        setShow2FAModal(true);
      } else {
        toast.error(res.message || '获取二维码失败');
      }
    } catch (error) {
      console.error('获取 2FA 设置失败:', error);
      toast.error('获取二维码失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  // 验证并启用 2FA
  const handleVerify2FA = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      toast.error('请输入 6 位验证码');
      return;
    }

    if (!totpSetup?.secret) {
      toast.error('缺少密钥信息，请重新获取');
      return;
    }

    try {
      setSubmitting(true);
      const res = await authApi.enableTotp(verificationCode, totpSetup.secret);
      if (res.code === 0) {
        setTotpStatus({ enabled: true, enabledAt: new Date().toISOString() });
        setShow2FAModal(false);
        setVerificationCode('');
        setTotpSetup(null);
        toast.success('2FA 启用成功');
      } else {
        toast.error(res.message || '验证码错误');
      }
    } catch (error) {
      console.error('启用 2FA 失败:', error);
      toast.error('验证码错误，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  // 禁用 2FA
  const handleDisable2FA = async () => {
    if (!disableCode || disableCode.length !== 6) {
      toast.error('请输入 6 位验证码');
      return;
    }

    if (!disablePassword) {
      toast.error('请输入密码');
      return;
    }

    try {
      setSubmitting(true);
      const res = await authApi.disableTotp(disableCode, disablePassword);
      if (res.code === 0) {
        setTotpStatus({ enabled: false });
        setShowDisableModal(false);
        setDisableCode('');
        setDisablePassword('');
        toast.success('2FA 已关闭');
      } else {
        toast.error(res.message || '操作失败');
      }
    } catch (error) {
      console.error('禁用 2FA 失败:', error);
      toast.error('操作失败，请检查验证码和密码');
    } finally {
      setSubmitting(false);
    }
  };

  // 远程登出设备
  const handleLogoutDevice = async (deviceHash: string) => {
    if (!confirm('确定要登出该设备吗？')) {
      return;
    }

    try {
      const res = await authApi.removeDevice(deviceHash);
      if (res.code === 0) {
        setDevices(devices.filter((d) => d.hash !== deviceHash));
        toast.success('设备已登出');
      } else {
        toast.error(res.message || '操作失败');
      }
    } catch (error) {
      console.error('登出失败:', error);
      toast.error('操作失败，请稍后重试');
    }
  };

  // 格式化时间
  const formatTime = (timeStr: string) => {
    try {
      return new Date(timeStr).toLocaleString('zh-CN');
    } catch {
      return timeStr;
    }
  };

  // 计算相对时间
  const getRelativeTime = (timeStr: string) => {
    try {
      const now = new Date();
      const time = new Date(timeStr);
      const diffMs = now.getTime() - time.getTime();
      const diffMinutes = Math.floor(diffMs / 60000);

      if (diffMinutes < 1) return '刚刚';
      if (diffMinutes < 60) return `${diffMinutes} 分钟前`;
      const diffHours = Math.floor(diffMinutes / 60);
      if (diffHours < 24) return `${diffHours} 小时前`;
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays} 天前`;
    } catch {
      return '未知';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 pb-20 lg:pb-6">
      <MobileHeader title="安全设置" subtitle="保护您的账户安全" />

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
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  处理中...
                </>
              ) : (
                '修改密码'
              )}
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
                {totpStatus.enabled ? (
                  <CheckCircle className="w-5 h-5 text-success" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-warning" />
                )}
                <div>
                  <p className="font-medium text-white">
                    {totpStatus.enabled ? '已启用' : '未启用'}
                  </p>
                  <p className="text-sm text-text-secondary">
                    {totpStatus.enabled
                      ? '您的账户受 Google Authenticator 保护'
                      : '建议启用 2FA 以提高账户安全性'}
                  </p>
                  {totpStatus.enabled && totpStatus.enabledAt && (
                    <p className="text-xs text-text-tertiary mt-1">
                      启用于：{formatTime(totpStatus.enabledAt)}
                    </p>
                  )}
                </div>
              </div>
              {totpStatus.enabled ? (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => setShowDisableModal(true)}
                  disabled={submitting}
                >
                  关闭 2FA
                </Button>
              ) : (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleEnable2FA}
                  disabled={submitting}
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    '启用 2FA'
                  )}
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
          {loginLogs.length === 0 ? (
            <div className="text-center py-8">
              <Clock className="w-12 h-12 mx-auto text-text-tertiary opacity-50 mb-3" />
              <p className="text-text-secondary">暂无登录记录</p>
            </div>
          ) : (
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
                    <p className="text-sm text-text-secondary">{formatTime(log.time)}</p>
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
          )}
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
          {devices.length === 0 ? (
            <div className="text-center py-8">
              <Monitor className="w-12 h-12 mx-auto text-text-tertiary opacity-50 mb-3" />
              <p className="text-text-secondary">暂无设备记录</p>
            </div>
          ) : (
            <div className="space-y-2">
              {devices.map((device, index) => (
                <div
                  key={device.hash}
                  className="flex items-center justify-between p-4 bg-bg-tertiary/50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <Monitor className="w-5 h-5 text-text-secondary" />
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-white">{device.os}</p>
                        {index === 0 && (
                          <span className="px-2 py-0.5 text-xs bg-brand-primary/20 text-brand-primary rounded">
                            当前设备
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-text-secondary">
                        {device.browser} · 登录 {device.loginCount} 次
                      </p>
                      <p className="text-xs text-text-tertiary mt-1">
                        上次活跃：{getRelativeTime(device.lastSeenAt)}
                      </p>
                    </div>
                  </div>
                  {index !== 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleLogoutDevice(device.hash)}
                    >
                      登出
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2FA 启用弹窗 */}
      <Modal
        open={show2FAModal}
        onClose={() => {
          setShow2FAModal(false);
          setVerificationCode('');
          setTotpSetup(null);
        }}
        title="启用双因素认证"
        size="md"
      >
        <div className="space-y-4">
          <div className="text-center">
            <p className="text-text-secondary mb-4">
              使用 Google Authenticator 或其他 TOTP 应用扫描二维码
            </p>
            {totpSetup?.qrCode && (
              <div className="inline-block p-4 bg-white rounded-lg">
                <img src={totpSetup.qrCode} alt="QR Code" className="w-48 h-48" />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-sm text-text-secondary">手动输入密钥：</p>
            <code className="block p-3 bg-bg-tertiary rounded-lg text-sm font-mono text-white break-all">
              {totpSetup?.secret || '加载中...'}
            </code>
          </div>

          <Input
            label="验证码"
            placeholder="输入 6 位验证码"
            value={verificationCode}
            onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
            maxLength={6}
          />

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setShow2FAModal(false);
                setVerificationCode('');
                setTotpSetup(null);
              }}
            >
              取消
            </Button>
            <Button
              variant="primary"
              className="flex-1"
              onClick={handleVerify2FA}
              disabled={submitting || verificationCode.length !== 6}
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                '验证并启用'
              )}
            </Button>
          </div>
        </div>
      </Modal>

      {/* 2FA 禁用弹窗 */}
      <Modal
        open={showDisableModal}
        onClose={() => {
          setShowDisableModal(false);
          setDisableCode('');
          setDisablePassword('');
        }}
        title="关闭双因素认证"
        size="md"
      >
        <div className="space-y-4">
          <div className="p-4 bg-danger/10 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-danger flex-shrink-0 mt-0.5" />
              <div className="text-sm text-danger">
                <p className="font-medium">安全警告</p>
                <p className="mt-1 text-danger/80">
                  关闭双因素认证会降低您账户的安全性。建议仅在必要时关闭。
                </p>
              </div>
            </div>
          </div>

          <Input
            label="当前 2FA 验证码"
            placeholder="输入 6 位验证码"
            value={disableCode}
            onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, ''))}
            maxLength={6}
          />

          <Input
            label="账户密码"
            type="password"
            placeholder="输入您的账户密码"
            value={disablePassword}
            onChange={(e) => setDisablePassword(e.target.value)}
          />

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setShowDisableModal(false);
                setDisableCode('');
                setDisablePassword('');
              }}
            >
              取消
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              onClick={handleDisable2FA}
              disabled={submitting || disableCode.length !== 6 || !disablePassword}
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                '确认关闭'
              )}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
