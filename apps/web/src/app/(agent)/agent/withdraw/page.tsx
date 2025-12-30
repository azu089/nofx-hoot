'use client';

import { useState, useEffect } from 'react';

export default function AgentWithdrawPage() {
  const [balance, setBalance] = useState('0');
  const [amount, setAmount] = useState('');
  const [address, setAddress] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const fetchBalance = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/agents/overview', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.code === 0) {
          setBalance(data.data.withdrawableCommission || '0');
        }
      } catch (error) {
        console.error('获取余额失败:', error);
      }
    };

    fetchBalance();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const amountNum = parseFloat(amount);
    const balanceNum = parseFloat(balance);

    if (!amount || amountNum <= 0) {
      setError('请输入有效的提现金额');
      return;
    }

    if (amountNum > balanceNum) {
      setError('提现金额超过可用余额');
      return;
    }

    if (amountNum < 10) {
      setError('最低提现金额为 10 USDT');
      return;
    }

    if (!address || !address.startsWith('T')) {
      setError('请输入有效的 TRC20 钱包地址');
      return;
    }

    setIsSubmitting(true);

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/agents/withdraw', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ amount: amountNum, address }),
      });

      const data = await res.json();

      if (data.code === 0) {
        setSuccess('提现申请已提交，请等待审核');
        setAmount('');
        setAddress('');
        setBalance((parseFloat(balance) - amountNum).toFixed(8));
      } else {
        setError(data.message || '提现失败，请稍后重试');
      }
    } catch (error) {
      setError('网络错误，请稍后重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">佣金提现</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          将您的佣金提现到 USDT (TRC20) 钱包
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 提现表单 */}
        <div className="bg-[var(--bg-secondary)] rounded-xl p-6 border border-[var(--border-primary)]">
          <h3 className="text-lg font-medium text-[var(--text-primary)] mb-6">发起提现</h3>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 可用余额 */}
            <div>
              <label className="block text-sm text-[var(--text-secondary)] mb-2">可提现余额</label>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-[var(--success)]">
                  ${parseFloat(balance).toFixed(2)}
                </span>
                <span className="text-sm text-[var(--text-tertiary)]">USDT</span>
              </div>
            </div>

            {/* 提现金额 */}
            <div>
              <label className="block text-sm text-[var(--text-secondary)] mb-2">提现金额</label>
              <div className="relative">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="最低 10 USDT"
                  className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-lg px-4 py-3 text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand-primary)]"
                />
                <button
                  type="button"
                  onClick={() => setAmount(balance)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[var(--brand-primary)] hover:underline"
                >
                  全部
                </button>
              </div>
            </div>

            {/* 提现地址 */}
            <div>
              <label className="block text-sm text-[var(--text-secondary)] mb-2">
                收款地址 <span className="text-[var(--text-tertiary)]">(TRC20)</span>
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="T..."
                className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-lg px-4 py-3 text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand-primary)] font-mono text-sm"
              />
            </div>

            {/* 错误/成功提示 */}
            {error && (
              <div className="p-3 bg-[var(--danger)]/10 border border-[var(--danger)]/20 rounded-lg text-sm text-[var(--danger)]">
                {error}
              </div>
            )}
            {success && (
              <div className="p-3 bg-[var(--success)]/10 border border-[var(--success)]/20 rounded-lg text-sm text-[var(--success)]">
                {success}
              </div>
            )}

            {/* 提交按钮 */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 bg-[var(--brand-primary)] text-white rounded-lg font-medium hover:bg-[var(--brand-secondary)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? '提交中...' : '确认提现'}
            </button>
          </form>
        </div>

        {/* 提现说明 */}
        <div className="bg-[var(--bg-secondary)] rounded-xl p-6 border border-[var(--border-primary)]">
          <h3 className="text-lg font-medium text-[var(--text-primary)] mb-4">提现说明</h3>
          <div className="space-y-4 text-sm text-[var(--text-secondary)]">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-[var(--brand-primary)]/10 rounded-full flex items-center justify-center text-xs text-[var(--brand-primary)] flex-shrink-0">
                1
              </div>
              <div>
                <div className="font-medium text-[var(--text-primary)]">提现限额</div>
                <div className="mt-1">单笔最低 10 USDT，最高 10000 USDT</div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-[var(--brand-primary)]/10 rounded-full flex items-center justify-center text-xs text-[var(--brand-primary)] flex-shrink-0">
                2
              </div>
              <div>
                <div className="font-medium text-[var(--text-primary)]">手续费</div>
                <div className="mt-1">平台收取 2% 提现手续费，最低 1 USDT</div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-[var(--brand-primary)]/10 rounded-full flex items-center justify-center text-xs text-[var(--brand-primary)] flex-shrink-0">
                3
              </div>
              <div>
                <div className="font-medium text-[var(--text-primary)]">到账时间</div>
                <div className="mt-1">人工审核通过后 24 小时内到账</div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-[var(--brand-primary)]/10 rounded-full flex items-center justify-center text-xs text-[var(--brand-primary)] flex-shrink-0">
                4
              </div>
              <div>
                <div className="font-medium text-[var(--text-primary)]">注意事项</div>
                <div className="mt-1">请确认收款地址为 TRC20 网络，填错地址导致的损失平台不负责</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
