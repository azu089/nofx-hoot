'use client';

import { useState } from 'react';
import Link from 'next/link';

interface TosCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  error?: string;
}

/**
 * 用户协议勾选组件
 * 注册时必须勾选
 */
export function TosCheckbox({ checked, onChange, error }: TosCheckboxProps) {
  const [showModal, setShowModal] = useState(false);

  return (
    <div className="space-y-2">
      <label className="flex items-start gap-3 cursor-pointer group">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-1 w-4 h-4 rounded border-[var(--border-primary)] bg-[var(--bg-tertiary)]
                     text-[var(--brand-primary)] focus:ring-[var(--brand-primary)] focus:ring-offset-0
                     cursor-pointer"
        />
        <span className="text-sm text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">
          我已阅读并同意{' '}
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="text-[var(--brand-primary)] hover:underline"
          >
            《用户服务协议》
          </button>
          {' '}和{' '}
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="text-[var(--brand-primary)] hover:underline"
          >
            《隐私政策》
          </button>
        </span>
      </label>

      {error && (
        <p className="text-sm text-[var(--danger)] ml-7">{error}</p>
      )}

      {/* 协议弹窗 */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-[var(--bg-secondary)] rounded-xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col">
            {/* 头部 */}
            <div className="flex items-center justify-between p-4 border-b border-[var(--border-primary)]">
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                用户服务协议
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* 内容 */}
            <div className="p-4 overflow-y-auto flex-1 text-sm text-[var(--text-secondary)] space-y-4">
              <h4 className="font-semibold text-[var(--text-primary)]">1. 服务说明</h4>
              <p>
                QuantFi 是一个量化交易 SaaS 平台，提供策略托管、自动交易等技术服务。
                本平台仅提供工具和技术支持，不构成任何投资建议。
              </p>

              <h4 className="font-semibold text-[var(--text-primary)]">2. 用户责任</h4>
              <p>
                用户应自行承担使用本平台进行交易的全部风险。
                用户应确保提供的 API Key 具有适当的权限设置，并妥善保管。
              </p>

              <h4 className="font-semibold text-[var(--text-primary)]">3. 风险提示</h4>
              <p>
                加密货币交易具有高度风险，可能导致本金全部损失。
                历史收益不代表未来表现，请根据自身风险承受能力谨慎投资。
              </p>

              <h4 className="font-semibold text-[var(--text-primary)]">4. 免责声明</h4>
              <p>
                本平台不对用户因使用本服务而产生的任何直接或间接损失承担责任。
                策略运行结果受市场行情、网络延迟等多种因素影响。
              </p>

              <h4 className="font-semibold text-[var(--text-primary)]">5. 费用说明</h4>
              <p>
                订阅费：$25/月，按月计费<br/>
                燃油费：从盈利中收取 20% 作为平台服务费（Gas Fee）
              </p>

              <h4 className="font-semibold text-[var(--text-primary)]">6. 隐私保护</h4>
              <p>
                用户的 API Key 采用 AES-256-GCM 加密存储，仅在策略运行时解密使用。
                我们不会向任何第三方出售或分享用户数据。
              </p>

              <h4 className="font-semibold text-[var(--text-primary)]">7. 协议更新</h4>
              <p>
                本平台有权随时修改本协议，修改后的协议将在平台公告。
                继续使用本服务即表示同意接受修改后的协议。
              </p>
            </div>

            {/* 底部 */}
            <div className="p-4 border-t border-[var(--border-primary)] flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                关闭
              </button>
              <button
                onClick={() => {
                  onChange(true);
                  setShowModal(false);
                }}
                className="px-4 py-2 text-sm bg-[var(--brand-primary)] text-white rounded-md hover:bg-[var(--brand-secondary)] transition-colors"
              >
                同意并继续
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
