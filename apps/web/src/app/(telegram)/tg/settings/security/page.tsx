'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTelegramContext } from '@/components/providers/TelegramProvider';
import { authApi } from '@/lib/api';
import {
  ArrowLeft,
  Shield,
  Key,
  Smartphone,
  History,
  ChevronRight,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';

export default function TgSecurityPage() {
  const router = useRouter();
  const { haptic } = useTelegramContext();
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwords, setPasswords] = useState({
    current: '',
    new: '',
    confirm: '',
  });
  const [changing, setChanging] = useState(false);

  const handleChangePassword = async () => {
    if (passwords.new !== passwords.confirm) {
      haptic('notification_error');
      alert('两次密码输入不一致');
      return;
    }

    if (passwords.new.length < 8) {
      haptic('notification_error');
      alert('新密码至少需要 8 位');
      return;
    }

    setChanging(true);
    haptic('impact_medium');
    try {
      await authApi.changePassword({
        currentPassword: passwords.current,
        newPassword: passwords.new,
      });
      haptic('notification_success');
      alert('密码修改成功');
      setShowPasswordModal(false);
      setPasswords({ current: '', new: '', confirm: '' });
    } catch (error: any) {
      haptic('notification_error');
      alert(error?.message || '修改失败');
    } finally {
      setChanging(false);
    }
  };

  const securityItems = [
    {
      icon: Key,
      label: '修改密码',
      desc: '定期更换密码更安全',
      action: () => { haptic('selection'); setShowPasswordModal(true); },
    },
    {
      icon: Smartphone,
      label: '两步验证',
      desc: twoFactorEnabled ? '已开启' : '未开启',
      status: twoFactorEnabled,
      action: () => { haptic('selection'); alert('即将支持'); },
    },
    {
      icon: History,
      label: '登录历史',
      desc: '查看最近登录记录',
      action: () => { haptic('selection'); router.push('/tg/settings/security/login-history'); },
    },
  ];

  return (
    <div className="space-y-4 pb-24">
      {/* 顶部 */}
      <button
        onClick={() => { haptic('selection'); router.back(); }}
        className="flex items-center gap-2 text-text-secondary"
      >
        <ArrowLeft size={20} />
        <span className="text-lg font-medium text-white">安全设置</span>
      </button>

      {/* 安全状态 */}
      <div className="bg-success/10 border border-success/30 rounded-xl p-4">
        <div className="flex items-center gap-3">
          <CheckCircle className="w-8 h-8 text-success" />
          <div>
            <p className="text-white font-medium">账户安全</p>
            <p className="text-text-tertiary text-sm">您的账户已受保护</p>
          </div>
        </div>
      </div>

      {/* 安全设置项 */}
      <div className="bg-bg-secondary border border-border-primary rounded-xl divide-y divide-border-primary">
        {securityItems.map((item, idx) => {
          const Icon = item.icon;
          return (
            <button
              key={idx}
              onClick={item.action}
              className="w-full flex items-center justify-between p-4 text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-bg-tertiary flex items-center justify-center">
                  <Icon className="w-4 h-4 text-brand-primary" />
                </div>
                <div>
                  <p className="text-white text-sm font-medium">{item.label}</p>
                  <p className="text-text-tertiary text-xs">{item.desc}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {item.status !== undefined && (
                  <span className={`text-xs ${item.status ? 'text-success' : 'text-text-tertiary'}`}>
                    {item.status ? '已开启' : '未开启'}
                  </span>
                )}
                <ChevronRight className="w-4 h-4 text-text-tertiary" />
              </div>
            </button>
          );
        })}
      </div>

      {/* 安全提示 */}
      <div className="bg-bg-secondary border border-border-primary rounded-xl p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-warning flex-shrink-0" />
          <div className="text-sm">
            <p className="text-white font-medium mb-1">安全建议</p>
            <ul className="text-text-tertiary space-y-1">
              <li>• 使用强密码，包含字母、数字和符号</li>
              <li>• 开启两步验证增强安全性</li>
              <li>• 不要在公共场所登录账户</li>
              <li>• 定期检查登录历史</li>
            </ul>
          </div>
        </div>
      </div>

      {/* 修改密码弹窗 */}
      {showPasswordModal && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
          onClick={() => setShowPasswordModal(false)}
        >
          <div
            className="w-full bg-bg-secondary rounded-t-2xl p-6 pb-10"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-white mb-4">修改密码</h3>

            <div className="space-y-4">
              <div>
                <label className="text-sm text-text-secondary mb-1 block">当前密码</label>
                <input
                  type="password"
                  value={passwords.current}
                  onChange={(e) => setPasswords(p => ({ ...p, current: e.target.value }))}
                  placeholder="请输入当前密码"
                  className="w-full bg-bg-tertiary border border-border-primary rounded-lg px-4 py-3 text-white placeholder:text-text-tertiary focus:outline-none focus:border-brand-primary"
                />
              </div>
              <div>
                <label className="text-sm text-text-secondary mb-1 block">新密码</label>
                <input
                  type="password"
                  value={passwords.new}
                  onChange={(e) => setPasswords(p => ({ ...p, new: e.target.value }))}
                  placeholder="至少 8 位"
                  className="w-full bg-bg-tertiary border border-border-primary rounded-lg px-4 py-3 text-white placeholder:text-text-tertiary focus:outline-none focus:border-brand-primary"
                />
              </div>
              <div>
                <label className="text-sm text-text-secondary mb-1 block">确认新密码</label>
                <input
                  type="password"
                  value={passwords.confirm}
                  onChange={(e) => setPasswords(p => ({ ...p, confirm: e.target.value }))}
                  placeholder="再次输入新密码"
                  className="w-full bg-bg-tertiary border border-border-primary rounded-lg px-4 py-3 text-white placeholder:text-text-tertiary focus:outline-none focus:border-brand-primary"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setShowPasswordModal(false); haptic('selection'); }}
                className="flex-1 py-3 bg-bg-tertiary text-white rounded-xl font-medium"
              >
                取消
              </button>
              <button
                onClick={handleChangePassword}
                disabled={changing || !passwords.current || !passwords.new || !passwords.confirm}
                className="flex-1 py-3 bg-brand-primary text-white rounded-xl font-medium disabled:opacity-50"
              >
                {changing ? '修改中...' : '确认修改'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
