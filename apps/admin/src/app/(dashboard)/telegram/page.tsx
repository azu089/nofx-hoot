'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Bot, Save, RefreshCw, Eye, MessageSquare, Link2, Gift, Bell, Command, MousePointer } from 'lucide-react';

interface TelegramConfig {
  welcome_message_zh: string;
  welcome_message_en: string;
  community_url: string;
  checkin_reward: number;
  default_notify_time: string;
  commands_config: Record<string, boolean>;
  button_texts_zh: Record<string, string>;
  button_texts_en: Record<string, string>;
}

const DEFAULT_COMMANDS = [
  { key: 'start', label: '/start', desc: '主菜单' },
  { key: 'help', label: '/help', desc: '帮助信息' },
  { key: 'bind', label: '/bind', desc: '绑定账号' },
  { key: 'wallet', label: '/wallet', desc: '查看钱包' },
  { key: 'pnl', label: '/pnl', desc: '今日盈亏' },
  { key: 'checkin', label: '/checkin', desc: '每日签到' },
  { key: 'invite', label: '/invite', desc: '邀请好友' },
  { key: 'stake', label: '/stake', desc: '质押概览' },
  { key: 'vesting', label: '/vesting', desc: '释放进度' },
  { key: 'rank', label: '/rank', desc: '我的排名' },
  { key: 'strategies', label: '/strategies', desc: '运行中策略' },
  { key: 'settings', label: '/settings', desc: '通知设置' },
  { key: 'lang', label: '/lang', desc: '切换语言' },
];

const DEFAULT_BUTTONS = [
  { key: 'open_app', label: '打开小程序' },
  { key: 'view_balance', label: '查看余额' },
  { key: 'today_pnl', label: '今日盈亏' },
  { key: 'checkin', label: '每日签到' },
  { key: 'invite', label: '邀请好友' },
  { key: 'bind', label: '绑定账号' },
  { key: 'community', label: '加入社群' },
];

export default function TelegramConfigPage() {
  const queryClient = useQueryClient();
  const [config, setConfig] = useState<TelegramConfig>({
    welcome_message_zh: '',
    welcome_message_en: '',
    community_url: '',
    checkin_reward: 10,
    default_notify_time: '08:00',
    commands_config: {},
    button_texts_zh: {},
    button_texts_en: {},
  });
  const [activeTab, setActiveTab] = useState<'welcome' | 'commands' | 'buttons' | 'settings'>('welcome');

  // 获取配置
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['telegram-config'],
    queryFn: async () => {
      const res = await api.get('/admin/telegram/config');
      return res.data;
    },
  });

  // 更新配置
  const updateMutation = useMutation({
    mutationFn: async (data: TelegramConfig) => {
      return api.put('/admin/telegram/config', data);
    },
    onSuccess: () => {
      toast.success('配置已保存');
      queryClient.invalidateQueries({ queryKey: ['telegram-config'] });
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || '保存失败');
    },
  });

  // 重载配置
  const reloadMutation = useMutation({
    mutationFn: async () => {
      return api.post('/admin/telegram/reload');
    },
    onSuccess: () => {
      toast.success('Bot 配置已重新加载');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || '重载失败');
    },
  });

  // 初始化配置
  useEffect(() => {
    if (data) {
      setConfig({
        welcome_message_zh: data.welcome_message_zh || getDefaultWelcomeZh(),
        welcome_message_en: data.welcome_message_en || getDefaultWelcomeEn(),
        community_url: data.community_url || 'https://t.me/QuantFiCommunity',
        checkin_reward: data.checkin_reward || 10,
        default_notify_time: data.default_notify_time || '08:00',
        commands_config: data.commands_config || getDefaultCommands(),
        button_texts_zh: data.button_texts_zh || getDefaultButtonsZh(),
        button_texts_en: data.button_texts_en || getDefaultButtonsEn(),
      });
    }
  }, [data]);

  const handleSave = () => {
    updateMutation.mutate(config);
  };

  const handleReload = () => {
    reloadMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-brand-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#0088CC]/10 rounded-lg flex items-center justify-center">
            <Bot className="w-5 h-5 text-[#0088CC]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Telegram Bot 配置</h1>
            <p className="text-sm text-text-secondary">配置 Bot 消息、命令、按钮等内容</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleReload}
            disabled={reloadMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-bg-tertiary hover:bg-bg-secondary text-text-primary rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${reloadMutation.isPending ? 'animate-spin' : ''}`} />
            重载配置
          </button>
          <button
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-brand-primary hover:bg-brand-secondary text-white rounded-lg transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            保存配置
          </button>
        </div>
      </div>

      {/* Tab 切换 */}
      <div className="flex gap-2 border-b border-border-primary pb-2">
        {[
          { key: 'welcome', label: '欢迎消息', icon: MessageSquare },
          { key: 'commands', label: '命令菜单', icon: Command },
          { key: 'buttons', label: '按钮文案', icon: MousePointer },
          { key: 'settings', label: '其他设置', icon: Bell },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              activeTab === tab.key
                ? 'bg-brand-primary/10 text-brand-primary'
                : 'text-text-secondary hover:bg-bg-tertiary hover:text-white'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* 欢迎消息 Tab */}
      {activeTab === 'welcome' && (
        <div className="grid grid-cols-2 gap-6">
          <div className="bg-bg-secondary rounded-xl p-6 border border-border-primary">
            <h3 className="text-white font-medium mb-4 flex items-center gap-2">
              <span className="text-xl">🇨🇳</span> 中文欢迎消息
            </h3>
            <textarea
              value={config.welcome_message_zh}
              onChange={(e) => setConfig({ ...config, welcome_message_zh: e.target.value })}
              className="w-full h-64 bg-bg-tertiary text-white rounded-lg p-4 border border-border-primary focus:border-brand-primary focus:outline-none resize-none font-mono text-sm"
              placeholder="支持 HTML 格式，如 <b>粗体</b>、<i>斜体</i>"
            />
            <p className="text-xs text-text-tertiary mt-2">
              支持变量: {'{name}'} = 用户名
            </p>
          </div>
          <div className="bg-bg-secondary rounded-xl p-6 border border-border-primary">
            <h3 className="text-white font-medium mb-4 flex items-center gap-2">
              <span className="text-xl">🇺🇸</span> English Welcome Message
            </h3>
            <textarea
              value={config.welcome_message_en}
              onChange={(e) => setConfig({ ...config, welcome_message_en: e.target.value })}
              className="w-full h-64 bg-bg-tertiary text-white rounded-lg p-4 border border-border-primary focus:border-brand-primary focus:outline-none resize-none font-mono text-sm"
              placeholder="Support HTML format, like <b>bold</b>, <i>italic</i>"
            />
            <p className="text-xs text-text-tertiary mt-2">
              Variables: {'{name}'} = username
            </p>
          </div>
        </div>
      )}

      {/* 命令菜单 Tab */}
      {activeTab === 'commands' && (
        <div className="bg-bg-secondary rounded-xl p-6 border border-border-primary">
          <h3 className="text-white font-medium mb-4">Bot 命令菜单</h3>
          <p className="text-sm text-text-secondary mb-6">
            选择在 Bot 菜单中显示的命令。取消勾选的命令仍可使用，但不会显示在命令菜单中。
          </p>
          <div className="grid grid-cols-2 gap-4">
            {DEFAULT_COMMANDS.map((cmd) => (
              <label
                key={cmd.key}
                className="flex items-center gap-3 p-3 bg-bg-tertiary rounded-lg cursor-pointer hover:bg-bg-primary transition-colors"
              >
                <input
                  type="checkbox"
                  checked={config.commands_config[cmd.key] !== false}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      commands_config: {
                        ...config.commands_config,
                        [cmd.key]: e.target.checked,
                      },
                    })
                  }
                  className="w-4 h-4 rounded border-border-primary text-brand-primary focus:ring-brand-primary"
                />
                <div>
                  <span className="text-white font-mono text-sm">{cmd.label}</span>
                  <span className="text-text-secondary text-sm ml-2">- {cmd.desc}</span>
                </div>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* 按钮文案 Tab */}
      {activeTab === 'buttons' && (
        <div className="grid grid-cols-2 gap-6">
          <div className="bg-bg-secondary rounded-xl p-6 border border-border-primary">
            <h3 className="text-white font-medium mb-4 flex items-center gap-2">
              <span className="text-xl">🇨🇳</span> 中文按钮文案
            </h3>
            <div className="space-y-3">
              {DEFAULT_BUTTONS.map((btn) => (
                <div key={btn.key} className="flex items-center gap-3">
                  <span className="text-text-secondary text-sm w-24 flex-shrink-0">{btn.label}:</span>
                  <input
                    type="text"
                    value={config.button_texts_zh[btn.key] || btn.label}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        button_texts_zh: {
                          ...config.button_texts_zh,
                          [btn.key]: e.target.value,
                        },
                      })
                    }
                    className="flex-1 bg-bg-tertiary text-white rounded-lg px-3 py-2 border border-border-primary focus:border-brand-primary focus:outline-none text-sm"
                  />
                </div>
              ))}
            </div>
          </div>
          <div className="bg-bg-secondary rounded-xl p-6 border border-border-primary">
            <h3 className="text-white font-medium mb-4 flex items-center gap-2">
              <span className="text-xl">🇺🇸</span> English Button Texts
            </h3>
            <div className="space-y-3">
              {DEFAULT_BUTTONS.map((btn) => (
                <div key={btn.key} className="flex items-center gap-3">
                  <span className="text-text-secondary text-sm w-24 flex-shrink-0">{btn.label}:</span>
                  <input
                    type="text"
                    value={config.button_texts_en[btn.key] || ''}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        button_texts_en: {
                          ...config.button_texts_en,
                          [btn.key]: e.target.value,
                        },
                      })
                    }
                    className="flex-1 bg-bg-tertiary text-white rounded-lg px-3 py-2 border border-border-primary focus:border-brand-primary focus:outline-none text-sm"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 其他设置 Tab */}
      {activeTab === 'settings' && (
        <div className="bg-bg-secondary rounded-xl p-6 border border-border-primary space-y-6">
          {/* 社区链接 */}
          <div>
            <h3 className="text-white font-medium mb-2 flex items-center gap-2">
              <Link2 className="w-4 h-4" />
              社区链接
            </h3>
            <input
              type="text"
              value={config.community_url}
              onChange={(e) => setConfig({ ...config, community_url: e.target.value })}
              className="w-full bg-bg-tertiary text-white rounded-lg px-4 py-3 border border-border-primary focus:border-brand-primary focus:outline-none"
              placeholder="https://t.me/xxx"
            />
            <p className="text-xs text-text-tertiary mt-2">
              Bot 中"加入社群"按钮跳转的链接
            </p>
          </div>

          {/* 签到奖励 */}
          <div>
            <h3 className="text-white font-medium mb-2 flex items-center gap-2">
              <Gift className="w-4 h-4" />
              每日签到奖励
            </h3>
            <div className="flex items-center gap-3">
              <input
                type="number"
                value={config.checkin_reward}
                onChange={(e) => setConfig({ ...config, checkin_reward: Number(e.target.value) })}
                className="w-32 bg-bg-tertiary text-white rounded-lg px-4 py-3 border border-border-primary focus:border-brand-primary focus:outline-none"
                min={1}
                max={1000}
              />
              <span className="text-text-secondary">积分</span>
            </div>
            <p className="text-xs text-text-tertiary mt-2">
              用户每日签到获得的积分数量
            </p>
          </div>

          {/* 默认提醒时间 */}
          <div>
            <h3 className="text-white font-medium mb-2 flex items-center gap-2">
              <Bell className="w-4 h-4" />
              默认提醒时间
            </h3>
            <input
              type="time"
              value={config.default_notify_time}
              onChange={(e) => setConfig({ ...config, default_notify_time: e.target.value })}
              className="w-32 bg-bg-tertiary text-white rounded-lg px-4 py-3 border border-border-primary focus:border-brand-primary focus:outline-none"
            />
            <p className="text-xs text-text-tertiary mt-2">
              新用户的默认通知提醒时间
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// 默认值函数
function getDefaultWelcomeZh() {
  return `欢迎回来，{name}！

您的专属量化交易助手已就绪。

━━━━━━━━━━━━━━━━━

<b>快捷功能</b>
💰 /wallet - 查看钱包余额
📊 /pnl - 今日交易盈亏
✅ /checkin - 每日签到领积分

<b>生态功能</b>
🔐 /stake - 质押管理
👥 /invite - 邀请好友
🏆 /rank - 我的排名

━━━━━━━━━━━━━━━━━

点击下方按钮快速操作 👇`;
}

function getDefaultWelcomeEn() {
  return `Welcome back, {name}!

Your personal quant trading assistant is ready.

━━━━━━━━━━━━━━━━━

<b>Quick Actions</b>
💰 /wallet - View balance
📊 /pnl - Today's PnL
✅ /checkin - Daily check-in

<b>Ecosystem</b>
🔐 /stake - Staking
👥 /invite - Invite friends
🏆 /rank - My ranking

━━━━━━━━━━━━━━━━━

Tap buttons below for quick access 👇`;
}

function getDefaultCommands() {
  return {
    start: true,
    help: true,
    bind: true,
    wallet: true,
    pnl: true,
    checkin: true,
    invite: true,
    stake: true,
    vesting: true,
    rank: true,
    strategies: true,
    settings: true,
    lang: true,
  };
}

function getDefaultButtonsZh() {
  return {
    open_app: '打开小程序',
    view_balance: '查看余额',
    today_pnl: '今日盈亏',
    checkin: '每日签到',
    invite: '邀请好友',
    bind: '绑定账号',
    community: '加入社群',
  };
}

function getDefaultButtonsEn() {
  return {
    open_app: 'Open Mini App',
    view_balance: 'View Balance',
    today_pnl: "Today's PnL",
    checkin: 'Daily Check-in',
    invite: 'Invite Friends',
    bind: 'Bind Account',
    community: 'Join Community',
  };
}
