'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTelegramContext } from '@/components/providers/TelegramProvider';
import {
  ArrowLeft,
  Bell,
  TrendingUp,
  Wallet,
  Gift,
  MessageSquare,
  Shield,
  RefreshCw,
} from 'lucide-react';
import { api } from '@/lib/api';

interface NotificationSettings {
  // 交易类
  trade_open: boolean;
  trade_close: boolean;
  stop_loss: boolean;
  large_profit: boolean;
  profit_threshold: number;
  strategy_error: boolean;

  // 资金类
  deposit_confirm: boolean;
  withdraw_complete: boolean;

  // 生态类
  stake_expiry: boolean;
  vesting_release: boolean;
  dividend_receive: boolean;

  // 运营类
  checkin_reminder: boolean;
  checkin_reminder_time: string;
  invite_success: boolean;
  rank_change: boolean;
  rank_change_threshold: number;

  // 系统类
  daily_report: boolean;
  daily_report_time: string;
  vip_expiry: boolean;
  system_announcement: boolean;
}

const DEFAULT_SETTINGS: NotificationSettings = {
  trade_open: true,
  trade_close: true,
  stop_loss: true,
  large_profit: true,
  profit_threshold: 100,
  strategy_error: true,
  deposit_confirm: true,
  withdraw_complete: true,
  stake_expiry: true,
  vesting_release: false,
  dividend_receive: true,
  checkin_reminder: false,
  checkin_reminder_time: '09:00',
  invite_success: true,
  rank_change: false,
  rank_change_threshold: 5,
  daily_report: true,
  daily_report_time: '20:00',
  vip_expiry: true,
  system_announcement: true,
};

export default function TgNotificationSettingsPage() {
  const router = useRouter();
  const { haptic } = useTelegramContext();
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await api.get('/telegram/notification-settings');
      if (res.data?.code === 0 && res.data?.data) {
        setSettings({ ...DEFAULT_SETTINGS, ...res.data.data });
      }
    } catch (error) {
      console.error('获取通知设置失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = async (key: keyof NotificationSettings, value: any) => {
    haptic('selection');

    // 止损和策略异常通知强制开启
    if ((key === 'stop_loss' || key === 'strategy_error') && !value) {
      return;
    }

    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);

    setSaving(true);
    try {
      await api.post('/telegram/notification-settings', { [key]: value });
    } catch (error) {
      console.error('保存设置失败:', error);
      // 回滚
      setSettings(settings);
    } finally {
      setSaving(false);
    }
  };

  const ToggleSwitch = ({
    checked,
    onChange,
    disabled = false,
  }: {
    checked: boolean;
    onChange: (v: boolean) => void;
    disabled?: boolean;
  }) => (
    <button
      onClick={() => !disabled && onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition-colors ${
        checked ? 'bg-brand-primary' : 'bg-bg-tertiary'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <span
        className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );

  const SettingItem = ({
    label,
    desc,
    checked,
    onChange,
    disabled = false,
    forced = false,
  }: {
    label: string;
    desc?: string;
    checked: boolean;
    onChange: (v: boolean) => void;
    disabled?: boolean;
    forced?: boolean;
  }) => (
    <div className="flex items-center justify-between py-3">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <p className="text-white text-sm font-medium">{label}</p>
          {forced && (
            <span className="px-1.5 py-0.5 bg-danger/20 text-danger text-[10px] rounded">
              强制
            </span>
          )}
        </div>
        {desc && <p className="text-text-tertiary text-xs mt-0.5">{desc}</p>}
      </div>
      <ToggleSwitch checked={checked} onChange={onChange} disabled={disabled || forced} />
    </div>
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <RefreshCw className="w-6 h-6 animate-spin text-text-tertiary" />
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-24">
      {/* 顶部导航 */}
      <button
        onClick={() => {
          haptic('selection');
          router.back();
        }}
        className="flex items-center gap-2 text-text-secondary"
      >
        <ArrowLeft size={20} />
        <span className="text-lg font-medium text-white">通知设置</span>
      </button>

      {/* 说明 */}
      <div className="bg-brand-primary/10 border border-brand-primary/30 rounded-xl p-3">
        <div className="flex items-start gap-2">
          <Bell className="w-5 h-5 text-brand-primary flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-white font-medium">Telegram 推送通知</p>
            <p className="text-xs text-text-tertiary mt-1">
              开启后，当有重要事件发生时，Bot 会向您发送消息通知
            </p>
          </div>
        </div>
      </div>

      {/* 交易通知 */}
      <div className="bg-bg-secondary border border-border-primary rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border-primary">
          <TrendingUp className="w-4 h-4 text-success" />
          <h3 className="text-white font-medium text-sm">交易通知</h3>
        </div>

        <SettingItem
          label="策略开仓"
          desc="策略执行买入/做多时通知"
          checked={settings.trade_open}
          onChange={(v) => updateSetting('trade_open', v)}
        />

        <SettingItem
          label="策略平仓"
          desc="策略执行卖出/平仓时通知"
          checked={settings.trade_close}
          onChange={(v) => updateSetting('trade_close', v)}
        />

        <SettingItem
          label="止损触发"
          desc="止损单执行时立即通知"
          checked={settings.stop_loss}
          onChange={(v) => updateSetting('stop_loss', v)}
          forced
        />

        <SettingItem
          label="大额盈利"
          desc={`单笔盈利超过 $${settings.profit_threshold} 时通知`}
          checked={settings.large_profit}
          onChange={(v) => updateSetting('large_profit', v)}
        />

        <SettingItem
          label="策略异常"
          desc="VPS 断线、API 失效时立即通知"
          checked={settings.strategy_error}
          onChange={(v) => updateSetting('strategy_error', v)}
          forced
        />
      </div>

      {/* 资金通知 */}
      <div className="bg-bg-secondary border border-border-primary rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border-primary">
          <Wallet className="w-4 h-4 text-warning" />
          <h3 className="text-white font-medium text-sm">资金通知</h3>
        </div>

        <SettingItem
          label="充值到账"
          desc="USDT 充值确认后通知"
          checked={settings.deposit_confirm}
          onChange={(v) => updateSetting('deposit_confirm', v)}
        />

        <SettingItem
          label="提现完成"
          desc="提现处理完成后通知"
          checked={settings.withdraw_complete}
          onChange={(v) => updateSetting('withdraw_complete', v)}
        />
      </div>

      {/* 生态通知 */}
      <div className="bg-bg-secondary border border-border-primary rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border-primary">
          <Gift className="w-4 h-4 text-purple-400" />
          <h3 className="text-white font-medium text-sm">生态通知</h3>
        </div>

        <SettingItem
          label="质押到期提醒"
          desc="质押即将到期前 3 天提醒"
          checked={settings.stake_expiry}
          onChange={(v) => updateSetting('stake_expiry', v)}
        />

        <SettingItem
          label="释放到账"
          desc="代币释放到账时通知"
          checked={settings.vesting_release}
          onChange={(v) => updateSetting('vesting_release', v)}
        />

        <SettingItem
          label="分红到账"
          desc="周分红发放时通知"
          checked={settings.dividend_receive}
          onChange={(v) => updateSetting('dividend_receive', v)}
        />
      </div>

      {/* 运营通知 */}
      <div className="bg-bg-secondary border border-border-primary rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border-primary">
          <MessageSquare className="w-4 h-4 text-brand-primary" />
          <h3 className="text-white font-medium text-sm">运营通知</h3>
        </div>

        <SettingItem
          label="签到提醒"
          desc="每日固定时间提醒签到"
          checked={settings.checkin_reminder}
          onChange={(v) => updateSetting('checkin_reminder', v)}
        />

        <SettingItem
          label="邀请成功"
          desc="新用户通过您的邀请注册时通知"
          checked={settings.invite_success}
          onChange={(v) => updateSetting('invite_success', v)}
        />

        <SettingItem
          label="排名变化"
          desc={`排名上升或下降 ${settings.rank_change_threshold} 名以上时通知`}
          checked={settings.rank_change}
          onChange={(v) => updateSetting('rank_change', v)}
        />
      </div>

      {/* 系统通知 */}
      <div className="bg-bg-secondary border border-border-primary rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border-primary">
          <Shield className="w-4 h-4 text-text-secondary" />
          <h3 className="text-white font-medium text-sm">系统通知</h3>
        </div>

        <SettingItem
          label="每日盈亏报告"
          desc="每日 20:00 发送交易日报"
          checked={settings.daily_report}
          onChange={(v) => updateSetting('daily_report', v)}
        />

        <SettingItem
          label="VIP 到期提醒"
          desc="VIP 会员即将到期前 3 天提醒"
          checked={settings.vip_expiry}
          onChange={(v) => updateSetting('vip_expiry', v)}
        />

        <SettingItem
          label="系统公告"
          desc="重要系统公告和维护通知"
          checked={settings.system_announcement}
          onChange={(v) => updateSetting('system_announcement', v)}
        />
      </div>

      {/* 保存状态 */}
      {saving && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-bg-tertiary px-4 py-2 rounded-full text-sm text-text-secondary flex items-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin" />
          保存中...
        </div>
      )}
    </div>
  );
}
