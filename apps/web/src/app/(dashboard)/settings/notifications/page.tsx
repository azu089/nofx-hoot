'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Button } from '@/components/ui';
import { Bell, Mail, MessageSquare, CheckCircle, AlertTriangle } from 'lucide-react';

interface NotificationSettings {
  // 通知渠道
  emailEnabled: boolean;
  telegramEnabled: boolean;
  telegramBinded: boolean;

  // 通知类型
  tradingNotifications: boolean; // 交易通知（开仓/平仓）
  accountNotifications: boolean; // 账户通知（充值/提现）
  systemNotifications: boolean; // 系统通知（VPS 状态、维护）
  riskAlerts: boolean; // 风险预警（回撤、异常）

  // 免打扰时段
  dndEnabled: boolean;
  dndStartTime: string;
  dndEndTime: string;
}

export default function NotificationsPage() {
  const [settings, setSettings] = useState<NotificationSettings>({
    emailEnabled: true,
    telegramEnabled: false,
    telegramBinded: false,
    tradingNotifications: true,
    accountNotifications: true,
    systemNotifications: true,
    riskAlerts: true,
    dndEnabled: false,
    dndStartTime: '22:00',
    dndEndTime: '08:00',
  });

  const [saving, setSaving] = useState(false);

  const handleToggle = (key: keyof NotificationSettings) => {
    setSettings((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleTimeChange = (key: 'dndStartTime' | 'dndEndTime', value: string) => {
    setSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // 模拟保存
      await new Promise((resolve) => setTimeout(resolve, 1000));
      alert('保存成功');
    } catch (error) {
      alert('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleBindTelegram = () => {
    alert('请在 Telegram 中搜索 @QuantFiBot 并发送 /start 获取绑定码');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">通知设置</h1>
        <Button onClick={handleSave} isLoading={saving}>
          <CheckCircle className="w-4 h-4 mr-2" />
          保存设置
        </Button>
      </div>

      {/* 通知渠道 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-brand-primary" />
            通知渠道
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 邮件通知 */}
          <div className="flex items-center justify-between p-4 bg-bg-tertiary/50 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-brand-primary/20 rounded-lg flex items-center justify-center">
                <Mail className="w-5 h-5 text-brand-primary" />
              </div>
              <div>
                <h3 className="text-white font-medium">邮件通知</h3>
                <p className="text-text-secondary text-sm">接收邮件通知到您的注册邮箱</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.emailEnabled}
                onChange={() => handleToggle('emailEnabled')}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-border-secondary peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-brand-primary rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-border-primary after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-primary"></div>
            </label>
          </div>

          {/* Telegram 通知 */}
          <div className="flex items-center justify-between p-4 bg-bg-tertiary/50 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-brand-primary/20 rounded-lg flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-brand-primary" />
              </div>
              <div>
                <h3 className="text-white font-medium">Telegram 通知</h3>
                <p className="text-text-secondary text-sm">
                  {settings.telegramBinded ? (
                    <span className="text-success">已绑定</span>
                  ) : (
                    <span className="text-warning">未绑定</span>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {!settings.telegramBinded && (
                <Button variant="outline" size="sm" onClick={handleBindTelegram}>
                  绑定账号
                </Button>
              )}
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.telegramEnabled}
                  onChange={() => handleToggle('telegramEnabled')}
                  disabled={!settings.telegramBinded}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-border-secondary peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-brand-primary rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-border-primary after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-primary disabled:opacity-50 disabled:cursor-not-allowed"></div>
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 通知类型 */}
      <Card>
        <CardHeader>
          <CardTitle>通知类型</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* 交易通知 */}
          <div className="flex items-center justify-between p-4 bg-bg-tertiary/50 rounded-lg">
            <div>
              <h3 className="text-white font-medium mb-1">交易通知</h3>
              <p className="text-text-secondary text-sm">开仓、平仓、止损等交易操作</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.tradingNotifications}
                onChange={() => handleToggle('tradingNotifications')}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-border-secondary peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-brand-primary rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-border-primary after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-primary"></div>
            </label>
          </div>

          {/* 账户通知 */}
          <div className="flex items-center justify-between p-4 bg-bg-tertiary/50 rounded-lg">
            <div>
              <h3 className="text-white font-medium mb-1">账户通知</h3>
              <p className="text-text-secondary text-sm">充值、提现、账户余额变动</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.accountNotifications}
                onChange={() => handleToggle('accountNotifications')}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-border-secondary peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-brand-primary rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-border-primary after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-primary"></div>
            </label>
          </div>

          {/* 系统通知 */}
          <div className="flex items-center justify-between p-4 bg-bg-tertiary/50 rounded-lg">
            <div>
              <h3 className="text-white font-medium mb-1">系统通知</h3>
              <p className="text-text-secondary text-sm">VPS 状态、系统维护、功能更新</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.systemNotifications}
                onChange={() => handleToggle('systemNotifications')}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-border-secondary peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-brand-primary rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-border-primary after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-primary"></div>
            </label>
          </div>

          {/* 风险预警 */}
          <div className="flex items-center justify-between p-4 bg-bg-tertiary/50 rounded-lg border border-warning/20">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-warning mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="text-white font-medium mb-1">风险预警</h3>
                <p className="text-text-secondary text-sm">回撤过大、异常交易、爆仓风险</p>
                <p className="text-warning text-xs mt-1">建议保持开启</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.riskAlerts}
                onChange={() => handleToggle('riskAlerts')}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-border-secondary peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-warning rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-border-primary after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-warning"></div>
            </label>
          </div>
        </CardContent>
      </Card>

      {/* 免打扰时段 */}
      <Card>
        <CardHeader>
          <CardTitle>免打扰时段</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-bg-tertiary/50 rounded-lg">
            <div>
              <h3 className="text-white font-medium mb-1">启用免打扰</h3>
              <p className="text-text-secondary text-sm">在指定时段内不接收通知（风险预警除外）</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.dndEnabled}
                onChange={() => handleToggle('dndEnabled')}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-border-secondary peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-brand-primary rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-border-primary after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-primary"></div>
            </label>
          </div>

          {settings.dndEnabled && (
            <div className="grid grid-cols-2 gap-4 p-4 bg-bg-tertiary/50 rounded-lg">
              <div>
                <label className="text-text-secondary text-sm block mb-2">开始时间</label>
                <input
                  type="time"
                  value={settings.dndStartTime}
                  onChange={(e) => handleTimeChange('dndStartTime', e.target.value)}
                  className="w-full px-3 py-2 bg-bg-secondary border border-border-secondary rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-brand-primary"
                />
              </div>
              <div>
                <label className="text-text-secondary text-sm block mb-2">结束时间</label>
                <input
                  type="time"
                  value={settings.dndEndTime}
                  onChange={(e) => handleTimeChange('dndEndTime', e.target.value)}
                  className="w-full px-3 py-2 bg-bg-secondary border border-border-secondary rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-brand-primary"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 底部保存按钮（移动端） */}
      <div className="md:hidden">
        <Button onClick={handleSave} isLoading={saving} className="w-full">
          <CheckCircle className="w-4 h-4 mr-2" />
          保存设置
        </Button>
      </div>
    </div>
  );
}
