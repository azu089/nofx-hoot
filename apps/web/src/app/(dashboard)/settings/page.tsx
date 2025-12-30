'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Metadata } from 'next';

// Metadata for this page (will be defined in layout or parent server component)
// export const metadata: Metadata = {
//   title: '设置 | QuantFi',
//   description: '管理账户信息、安全设置、通知偏好、外观和语言设置',
// };
import { userApi, instancesApi, authApi } from '@/lib/api';
import {
  User,
  Shield,
  Bell,
  Palette,
  Globe,
  LogOut,
  ChevronRight,
  Check,
  AlertTriangle,
  X,
  Loader2,
} from 'lucide-react';

interface UserProfile {
  id: string;
  email: string;
  vip_level: number;
  created_at: string;
}

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState<string>('account');

  const { data: profileData, isLoading } = useQuery({
    queryKey: ['user', 'profile'],
    queryFn: () => userApi.getProfile(),
  });

  const profile = profileData?.data as UserProfile | undefined;

  const [isPanicConfirmOpen, setIsPanicConfirmOpen] = useState(false);
  const [isPanicLoading, setIsPanicLoading] = useState(false);
  const [panicConfirmInput, setPanicConfirmInput] = useState('');
  const [panicResult, setPanicResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // 2FA 状态
  const [totpEnabled, setTotpEnabled] = useState(false);
  const [totpLoading, setTotpLoading] = useState(true);
  const [show2FASetup, setShow2FASetup] = useState(false);
  const [show2FADisable, setShow2FADisable] = useState(false);
  const [totpSetup, setTotpSetup] = useState<{ secret: string; qrCode: string } | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [disablePassword, setDisablePassword] = useState('');
  const [totpActionLoading, setTotpActionLoading] = useState(false);

  // 获取 2FA 状态
  const fetchTotpStatus = async () => {
    try {
      const res = await authApi.getTotpStatus();
      setTotpEnabled(res.data?.enabled || false);
    } catch {
      setTotpEnabled(false);
    } finally {
      setTotpLoading(false);
    }
  };

  // 页面加载时获取 2FA 状态
  useEffect(() => {
    fetchTotpStatus();
  }, []);

  // 开始设置 2FA
  const startSetup2FA = async () => {
    setTotpActionLoading(true);
    try {
      const res = await authApi.setupTotp();
      setTotpSetup({
        secret: res.data.secret,
        qrCode: res.data.qrCode,
      });
      setShow2FASetup(true);
      setTotpCode('');
    } catch (error) {
      alert(error instanceof Error ? error.message : '获取二维码失败');
    } finally {
      setTotpActionLoading(false);
    }
  };

  // 确认启用 2FA
  const confirmEnable2FA = async () => {
    if (!totpSetup || totpCode.length !== 6) {
      alert('请输入6位验证码');
      return;
    }

    setTotpActionLoading(true);
    try {
      await authApi.enableTotp(totpCode, totpSetup.secret);
      setTotpEnabled(true);
      setShow2FASetup(false);
      setTotpCode('');
      setTotpSetup(null);
      alert('2FA 已成功启用');
    } catch (error) {
      alert(error instanceof Error ? error.message : '启用失败');
    } finally {
      setTotpActionLoading(false);
    }
  };

  // 确认禁用 2FA
  const confirmDisable2FA = async () => {
    if (totpCode.length !== 6 || !disablePassword) {
      alert('请输入验证码和密码');
      return;
    }

    setTotpActionLoading(true);
    try {
      await authApi.disableTotp(totpCode, disablePassword);
      setTotpEnabled(false);
      setShow2FADisable(false);
      setTotpCode('');
      setDisablePassword('');
      alert('2FA 已禁用');
    } catch (error) {
      alert(error instanceof Error ? error.message : '禁用失败');
    } finally {
      setTotpActionLoading(false);
    }
  };

  const menuItems = [
    { id: 'account', label: '账户信息', icon: User },
    { id: 'security', label: '安全设置', icon: Shield },
    { id: 'panic', label: '紧急按钮', icon: AlertTriangle, danger: true },
    { id: 'notifications', label: '通知设置', icon: Bell },
    { id: 'appearance', label: '外观设置', icon: Palette },
    { id: 'language', label: '语言设置', icon: Globe },
  ];

  const handlePanicSell = async () => {
    setIsPanicLoading(true);
    setPanicResult(null);

    try {
      const response = await instancesApi.panicSell();
      setPanicResult({
        success: response.data.success,
        message: response.data.message || '一键清仓已执行',
      });
    } catch (error) {
      setPanicResult({
        success: false,
        message: error instanceof Error ? error.message : '清仓失败，请稍后重试',
      });
    } finally {
      setIsPanicLoading(false);
      setIsPanicConfirmOpen(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getVipLevelName = (level: number) => {
    const names: Record<number, string> = {
      0: '普通用户',
      1: 'VIP 1',
      2: 'VIP 2',
      3: 'VIP 3',
    };
    return names[level] || `VIP ${level}`;
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] p-6">
      {/* 页面标题 */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">设置</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          管理您的账户和偏好设置
        </p>
      </div>

      <div className="flex gap-6">
        {/* 左侧菜单 */}
        <div className="w-64 flex-shrink-0">
          <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-primary)] overflow-hidden">
            {menuItems.map((item) => {
              const isDanger = 'danger' in item && item.danger;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                    activeSection === item.id
                      ? isDanger
                        ? 'bg-[var(--danger)]/10 text-[var(--danger)] border-l-2 border-[var(--danger)]'
                        : 'bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] border-l-2 border-[var(--brand-primary)]'
                      : isDanger
                        ? 'text-[var(--danger)] hover:bg-[var(--danger)]/5'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  <span>{item.label}</span>
                  {activeSection === item.id && (
                    <Check className="w-4 h-4 ml-auto" />
                  )}
                </button>
              );
            })}

            {/* 退出登录 */}
            <button className="w-full flex items-center gap-3 px-4 py-3 text-left text-[var(--danger)] hover:bg-[var(--danger)]/10 transition-colors border-t border-[var(--border-primary)]">
              <LogOut className="w-5 h-5" />
              <span>退出登录</span>
            </button>
          </div>
        </div>

        {/* 右侧内容 */}
        <div className="flex-1">
          {/* 账户信息 */}
          {activeSection === 'account' && (
            <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-primary)] p-6">
              <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-6">
                账户信息
              </h2>

              {isLoading ? (
                <div className="animate-pulse space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-16 bg-[var(--bg-tertiary)] rounded" />
                  ))}
                </div>
              ) : profile ? (
                <div className="space-y-4">
                  {/* 邮箱 */}
                  <div className="flex items-center justify-between py-4 border-b border-[var(--border-primary)]">
                    <div>
                      <p className="text-sm text-[var(--text-secondary)]">邮箱</p>
                      <p className="text-[var(--text-primary)] font-medium">
                        {profile.email}
                      </p>
                    </div>
                    <button className="text-[var(--brand-primary)] text-sm hover:underline">
                      修改
                    </button>
                  </div>

                  {/* VIP 等级 */}
                  <div className="flex items-center justify-between py-4 border-b border-[var(--border-primary)]">
                    <div>
                      <p className="text-sm text-[var(--text-secondary)]">会员等级</p>
                      <p className="text-[var(--text-primary)] font-medium">
                        {getVipLevelName(profile.vip_level)}
                      </p>
                    </div>
                    <button className="text-[var(--brand-primary)] text-sm hover:underline">
                      升级
                    </button>
                  </div>

                  {/* 注册时间 */}
                  <div className="flex items-center justify-between py-4 border-b border-[var(--border-primary)]">
                    <div>
                      <p className="text-sm text-[var(--text-secondary)]">注册时间</p>
                      <p className="text-[var(--text-primary)] font-medium">
                        {formatDate(profile.created_at)}
                      </p>
                    </div>
                  </div>

                  {/* 用户 ID */}
                  <div className="flex items-center justify-between py-4">
                    <div>
                      <p className="text-sm text-[var(--text-secondary)]">用户 ID</p>
                      <p className="text-[var(--text-primary)] font-mono text-sm">
                        {profile.id}
                      </p>
                    </div>
                    <button className="text-[var(--text-tertiary)] text-sm hover:text-[var(--text-secondary)]">
                      复制
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-[var(--text-secondary)]">加载失败</p>
              )}
            </div>
          )}

          {/* 安全设置 */}
          {activeSection === 'security' && (
            <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-primary)] p-6">
              <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-6">
                安全设置
              </h2>

              <div className="space-y-4">
                {/* 修改密码 */}
                <div className="flex items-center justify-between py-4 border-b border-[var(--border-primary)]">
                  <div>
                    <p className="text-[var(--text-primary)] font-medium">修改密码</p>
                    <p className="text-sm text-[var(--text-secondary)]">
                      定期修改密码以保护账户安全
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-[var(--text-tertiary)]" />
                </div>

                {/* 两步验证 (2FA) */}
                <div className="flex items-center justify-between py-4 border-b border-[var(--border-primary)]">
                  <div>
                    <p className="text-[var(--text-primary)] font-medium">两步验证 (2FA)</p>
                    <p className="text-sm text-[var(--text-secondary)]">
                      使用 Google Authenticator 增强账户安全
                    </p>
                  </div>
                  {totpLoading ? (
                    <Loader2 className="w-5 h-5 text-[var(--text-tertiary)] animate-spin" />
                  ) : totpEnabled ? (
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-[var(--success)] flex items-center gap-1">
                        <Check className="w-4 h-4" />
                        已启用
                      </span>
                      <button
                        onClick={() => {
                          setShow2FADisable(true);
                          setTotpCode('');
                          setDisablePassword('');
                        }}
                        className="text-sm text-[var(--danger)] hover:underline"
                      >
                        禁用
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={startSetup2FA}
                      disabled={totpActionLoading}
                      className="px-4 py-2 bg-[var(--brand-primary)] text-white text-sm rounded-lg hover:bg-[var(--brand-secondary)] transition-colors disabled:opacity-50"
                    >
                      {totpActionLoading ? '加载中...' : '启用'}
                    </button>
                  )}
                </div>

                {/* 登录历史 */}
                <div className="flex items-center justify-between py-4">
                  <div>
                    <p className="text-[var(--text-primary)] font-medium">登录历史</p>
                    <p className="text-sm text-[var(--text-secondary)]">
                      查看最近的登录记录
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-[var(--text-tertiary)]" />
                </div>
              </div>
            </div>
          )}

          {/* 通知设置 */}
          {activeSection === 'notifications' && (
            <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-primary)] p-6">
              <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-6">
                通知设置
              </h2>

              <div className="space-y-4">
                {[
                  { label: '交易通知', desc: '接收交易执行、止盈止损等通知' },
                  { label: '账户通知', desc: '接收充值、提现、余额变动等通知' },
                  { label: '系统公告', desc: '接收平台公告和维护通知' },
                  { label: '营销推送', desc: '接收优惠活动和新功能推送' },
                ].map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between py-4 border-b border-[var(--border-primary)] last:border-b-0"
                  >
                    <div>
                      <p className="text-[var(--text-primary)] font-medium">{item.label}</p>
                      <p className="text-sm text-[var(--text-secondary)]">{item.desc}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" defaultChecked />
                      <div className="w-11 h-6 bg-[var(--bg-tertiary)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--brand-primary)]"></div>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 外观设置 */}
          {activeSection === 'appearance' && (
            <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-primary)] p-6">
              <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-6">
                外观设置
              </h2>

              <div className="space-y-6">
                <div>
                  <p className="text-[var(--text-primary)] font-medium mb-3">主题</p>
                  <div className="flex gap-4">
                    {['暗黑模式', '浅色模式', '跟随系统'].map((theme, index) => (
                      <button
                        key={index}
                        className={`px-4 py-2 rounded-lg border ${
                          index === 0
                            ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]'
                            : 'border-[var(--border-primary)] text-[var(--text-secondary)] hover:border-[var(--text-tertiary)]'
                        }`}
                      >
                        {theme}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 语言设置 */}
          {activeSection === 'language' && (
            <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-primary)] p-6">
              <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-6">
                语言设置
              </h2>

              <div className="space-y-2">
                {['简体中文', 'English', '繁體中文', '日本語'].map((lang, index) => (
                  <button
                    key={index}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border ${
                      index === 0
                        ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/10'
                        : 'border-[var(--border-primary)] hover:border-[var(--text-tertiary)]'
                    }`}
                  >
                    <span
                      className={
                        index === 0
                          ? 'text-[var(--brand-primary)]'
                          : 'text-[var(--text-secondary)]'
                      }
                    >
                      {lang}
                    </span>
                    {index === 0 && <Check className="w-5 h-5 text-[var(--brand-primary)]" />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 紧急按钮 - Panic Sell */}
          {activeSection === 'panic' && (
            <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--danger)]/30 p-6">
              <h2 className="text-lg font-semibold text-[var(--danger)] mb-6 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                紧急按钮 - 一键清仓
              </h2>

              {/* 警告说明 */}
              <div className="bg-[var(--danger)]/10 border border-[var(--danger)]/30 rounded-lg p-4 mb-6">
                <p className="text-[var(--danger)] text-sm font-medium mb-2">
                  警告：此操作将立即清空所有持仓
                </p>
                <ul className="text-[var(--text-secondary)] text-sm space-y-1">
                  <li>• 所有运行中的实例将执行全部平仓</li>
                  <li>• 此操作不可撤销</li>
                  <li>• 平仓按市价执行，可能产生滑点</li>
                  <li>• 仅在紧急情况下使用</li>
                </ul>
              </div>

              {/* 执行结果显示 */}
              {panicResult && (
                <div
                  className={`rounded-lg p-4 mb-6 ${
                    panicResult.success
                      ? 'bg-[var(--success)]/10 border border-[var(--success)]/30'
                      : 'bg-[var(--danger)]/10 border border-[var(--danger)]/30'
                  }`}
                >
                  <p
                    className={`text-sm font-medium ${
                      panicResult.success ? 'text-[var(--success)]' : 'text-[var(--danger)]'
                    }`}
                  >
                    {panicResult.message}
                  </p>
                </div>
              )}

              {/* 确认对话框 */}
              {isPanicConfirmOpen ? (
                <div className="space-y-4">
                  <p className="text-[var(--text-primary)] font-medium">
                    确定要执行一键清仓吗？
                  </p>
                  <p className="text-[var(--text-secondary)] text-sm">
                    请输入 &quot;CONFIRM&quot; 确认操作：
                  </p>
                  <input
                    type="text"
                    value={panicConfirmInput}
                    onChange={(e) => setPanicConfirmInput(e.target.value)}
                    placeholder="输入 CONFIRM"
                    className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-lg px-4 py-2 text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--danger)]"
                  />
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        if (panicConfirmInput === 'CONFIRM') {
                          handlePanicSell();
                          setPanicConfirmInput('');
                        }
                      }}
                      disabled={isPanicLoading || panicConfirmInput !== 'CONFIRM'}
                      className="flex-1 bg-[var(--danger)] hover:bg-[var(--danger)]/80 text-white font-medium py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isPanicLoading ? '执行中...' : '确认清仓'}
                    </button>
                    <button
                      onClick={() => {
                        setIsPanicConfirmOpen(false);
                        setPanicConfirmInput('');
                      }}
                      disabled={isPanicLoading}
                      className="flex-1 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-tertiary)]/80 text-[var(--text-secondary)] font-medium py-3 rounded-lg transition-colors disabled:opacity-50"
                    >
                      取消
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setIsPanicConfirmOpen(true)}
                  className="w-full bg-[var(--danger)] hover:bg-[var(--danger)]/80 text-white font-bold py-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <AlertTriangle className="w-5 h-5" />
                  一键清仓
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 2FA 设置弹窗 */}
      {show2FASetup && totpSetup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[var(--bg-secondary)] rounded-xl p-6 w-full max-w-md mx-4 border border-[var(--border-primary)]">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
                <Shield className="w-5 h-5 text-[var(--brand-primary)]" />
                设置两步验证
              </h2>
              <button
                onClick={() => setShow2FASetup(false)}
                className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* 步骤1：扫描二维码 */}
              <div>
                <p className="text-[var(--text-secondary)] text-sm mb-3">
                  1. 使用 Google Authenticator 扫描二维码
                </p>
                <div className="flex justify-center p-4 bg-white rounded-lg">
                  <img
                    src={totpSetup.qrCode}
                    alt="2FA QR Code"
                    className="w-48 h-48"
                  />
                </div>
              </div>

              {/* 密钥备份 */}
              <div>
                <p className="text-[var(--text-secondary)] text-sm mb-2">
                  或手动输入密钥：
                </p>
                <div className="bg-[var(--bg-tertiary)] rounded-lg p-3">
                  <code className="text-[var(--brand-primary)] font-mono text-sm break-all">
                    {totpSetup.secret}
                  </code>
                </div>
                <p className="text-[var(--text-tertiary)] text-xs mt-2">
                  请妥善保存此密钥，用于恢复
                </p>
              </div>

              {/* 步骤2：输入验证码 */}
              <div>
                <p className="text-[var(--text-secondary)] text-sm mb-2">
                  2. 输入 App 显示的 6 位验证码
                </p>
                <input
                  type="text"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="输入验证码"
                  maxLength={6}
                  className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-lg px-4 py-3 text-[var(--text-primary)] text-center text-2xl tracking-widest font-mono placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--brand-primary)]"
                />
              </div>

              {/* 操作按钮 */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShow2FASetup(false)}
                  className="flex-1 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-tertiary)]/80 text-[var(--text-secondary)] font-medium py-3 rounded-lg transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={confirmEnable2FA}
                  disabled={totpActionLoading || totpCode.length !== 6}
                  className="flex-1 bg-[var(--brand-primary)] hover:bg-[var(--brand-secondary)] text-white font-medium py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {totpActionLoading ? '验证中...' : '确认启用'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2FA 禁用弹窗 */}
      {show2FADisable && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[var(--bg-secondary)] rounded-xl p-6 w-full max-w-sm mx-4 border border-[var(--border-primary)]">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-[var(--danger)] flex items-center gap-2">
                <Shield className="w-5 h-5" />
                禁用两步验证
              </h2>
              <button
                onClick={() => setShow2FADisable(false)}
                className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-[var(--danger)]/10 border border-[var(--danger)]/30 rounded-lg p-3">
                <p className="text-[var(--danger)] text-sm">
                  警告：禁用两步验证会降低账户安全性
                </p>
              </div>

              <div>
                <label className="block text-[var(--text-secondary)] text-sm mb-2">
                  验证码
                </label>
                <input
                  type="text"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="输入 6 位验证码"
                  maxLength={6}
                  className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-lg px-4 py-2 text-[var(--text-primary)] text-center tracking-widest font-mono placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--danger)]"
                />
              </div>

              <div>
                <label className="block text-[var(--text-secondary)] text-sm mb-2">
                  账户密码
                </label>
                <input
                  type="password"
                  value={disablePassword}
                  onChange={(e) => setDisablePassword(e.target.value)}
                  placeholder="输入账户密码"
                  className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-lg px-4 py-2 text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--danger)]"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShow2FADisable(false)}
                  className="flex-1 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-tertiary)]/80 text-[var(--text-secondary)] font-medium py-3 rounded-lg transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={confirmDisable2FA}
                  disabled={totpActionLoading || totpCode.length !== 6 || !disablePassword}
                  className="flex-1 bg-[var(--danger)] hover:bg-[var(--danger)]/80 text-white font-medium py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {totpActionLoading ? '验证中...' : '确认禁用'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
