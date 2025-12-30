'use client';

import { useState, useEffect } from 'react';

export default function AgentPromotionPage() {
  const [inviteCode, setInviteCode] = useState('');
  const [inviteLink, setInviteLink] = useState('');
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);

  useEffect(() => {
    const fetchInviteCode = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/agents/invite-code', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.code === 0) {
          setInviteCode(data.data.code);
          setInviteLink(`${window.location.origin}/register?ref=${data.data.code}`);
        }
      } catch (error) {
        console.error('获取邀请码失败:', error);
      }
    };

    fetchInviteCode();
  }, []);

  const copyToClipboard = async (text: string, type: 'code' | 'link') => {
    await navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">推广工具</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          分享您的邀请链接，邀请好友注册即可获得返佣
        </p>
      </div>

      {/* 邀请码和链接 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 邀请码 */}
        <div className="bg-[var(--bg-secondary)] rounded-xl p-6 border border-[var(--border-primary)]">
          <h3 className="text-lg font-medium text-[var(--text-primary)] mb-4">邀请码</h3>
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-[var(--bg-tertiary)] rounded-lg px-4 py-3">
              <span className="text-xl font-mono text-[var(--brand-primary)]">{inviteCode}</span>
            </div>
            <button
              onClick={() => copyToClipboard(inviteCode, 'code')}
              className="px-4 py-3 bg-[var(--brand-primary)] text-white rounded-lg hover:bg-[var(--brand-secondary)] transition-colors"
            >
              {copied === 'code' ? '已复制' : '复制'}
            </button>
          </div>
        </div>

        {/* 邀请链接 */}
        <div className="bg-[var(--bg-secondary)] rounded-xl p-6 border border-[var(--border-primary)]">
          <h3 className="text-lg font-medium text-[var(--text-primary)] mb-4">邀请链接</h3>
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-[var(--bg-tertiary)] rounded-lg px-4 py-3 truncate">
              <span className="text-sm text-[var(--text-secondary)]">{inviteLink}</span>
            </div>
            <button
              onClick={() => copyToClipboard(inviteLink, 'link')}
              className="px-4 py-3 bg-[var(--brand-primary)] text-white rounded-lg hover:bg-[var(--brand-secondary)] transition-colors"
            >
              {copied === 'link' ? '已复制' : '复制'}
            </button>
          </div>
        </div>
      </div>

      {/* 推广海报 */}
      <div className="bg-[var(--bg-secondary)] rounded-xl p-6 border border-[var(--border-primary)]">
        <h3 className="text-lg font-medium text-[var(--text-primary)] mb-4">推广海报</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="aspect-[3/4] bg-gradient-to-br from-[var(--brand-primary)] to-[var(--brand-secondary)] rounded-xl flex items-center justify-center cursor-pointer hover:opacity-90 transition-opacity"
            >
              <div className="text-center text-white p-4">
                <div className="text-2xl font-bold mb-2">QuantFi</div>
                <div className="text-sm opacity-80">智能量化交易</div>
                <div className="mt-4 text-xs opacity-60">海报 {i}</div>
              </div>
            </div>
          ))}
        </div>
        <p className="text-sm text-[var(--text-tertiary)] mt-4">
          点击海报下载，您的邀请码已嵌入二维码中
        </p>
      </div>

      {/* 推广规则 */}
      <div className="bg-[var(--bg-secondary)] rounded-xl p-6 border border-[var(--border-primary)]">
        <h3 className="text-lg font-medium text-[var(--text-primary)] mb-4">推广规则</h3>
        <div className="space-y-3 text-sm text-[var(--text-secondary)]">
          <p>1. 通过您的邀请链接注册的用户，将永久绑定为您的下级</p>
          <p>2. 下级用户每笔交易产生的燃油费，您可获得 {10}% 返佣</p>
          <p>3. 返佣实时到账，可随时提现</p>
          <p>4. 禁止自充自返、刷单套利等违规行为</p>
        </div>
      </div>
    </div>
  );
}
