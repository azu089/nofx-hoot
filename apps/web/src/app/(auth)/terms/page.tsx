'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] py-12 px-4">
      <div className="max-w-3xl mx-auto">
        {/* 返回链接 */}
        <Link
          href="/register"
          className="inline-flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          返回注册
        </Link>

        {/* 标题 */}
        <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">
          服务条款
        </h1>
        <p className="text-[var(--text-secondary)] mb-8">
          最后更新日期：2024 年 12 月
        </p>

        {/* 内容 */}
        <div className="prose prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">
              1. 服务说明
            </h2>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              QuantFi 是一个加密货币量化交易平台，提供自动化交易策略执行服务。
              用户可以通过本平台连接自己的交易所账户，使用平台提供的量化策略进行自动交易。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">
              2. 用户资格
            </h2>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              使用本服务，您必须：
            </p>
            <ul className="list-disc list-inside text-[var(--text-secondary)] space-y-2 mt-2">
              <li>年满 18 周岁</li>
              <li>具有完全民事行为能力</li>
              <li>不是受限制国家或地区的居民</li>
              <li>同意本服务条款和隐私政策</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">
              3. 账户安全
            </h2>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              用户有责任保护其账户的安全性，包括但不限于：
            </p>
            <ul className="list-disc list-inside text-[var(--text-secondary)] space-y-2 mt-2">
              <li>妥善保管账户密码，不与他人共享</li>
              <li>启用两步验证等安全措施</li>
              <li>及时报告任何未经授权的账户使用</li>
              <li>确保交易所 API Key 的安全存储</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">
              4. 风险披露
            </h2>
            <div className="bg-[var(--warning)]/10 border border-[var(--warning)]/30 rounded-lg p-4">
              <p className="text-[var(--warning)] font-medium mb-2">重要风险提示</p>
              <p className="text-[var(--text-secondary)] leading-relaxed">
                加密货币交易具有高度投机性和风险性。价格波动剧烈，可能导致全部本金损失。
                量化策略的历史表现不代表未来收益。您应该只使用您可以承受损失的资金进行交易。
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">
              5. 服务费用
            </h2>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              平台将根据用户的交易盈利收取一定比例的服务费（Gas Fee）。
              具体费率将在策略订阅页面明确显示。用户需在账户中保持足够余额以支付相关费用。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">
              6. 免责声明
            </h2>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              本平台不对以下情况造成的损失承担责任：
            </p>
            <ul className="list-disc list-inside text-[var(--text-secondary)] space-y-2 mt-2">
              <li>市场波动导致的交易损失</li>
              <li>交易所系统故障或维护</li>
              <li>网络延迟或连接问题</li>
              <li>用户操作失误</li>
              <li>第三方服务的不可用</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">
              7. 知识产权
            </h2>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              平台上的所有内容，包括但不限于软件、策略代码、设计、商标等，
              均为 QuantFi 或其授权方所有。未经授权，不得复制、修改或分发。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">
              8. 服务终止
            </h2>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              QuantFi 保留在以下情况下暂停或终止用户账户的权利：
            </p>
            <ul className="list-disc list-inside text-[var(--text-secondary)] space-y-2 mt-2">
              <li>违反本服务条款</li>
              <li>涉嫌欺诈或其他非法活动</li>
              <li>长期未使用账户</li>
              <li>法律或监管要求</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">
              9. 条款修改
            </h2>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              QuantFi 保留随时修改本服务条款的权利。重大变更将通过邮件或平台公告通知用户。
              继续使用服务即表示您接受修改后的条款。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">
              10. 联系方式
            </h2>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              如有任何问题或建议，请通过以下方式联系我们：
            </p>
            <p className="text-[var(--brand-primary)] mt-2">
              support@quantfi.io
            </p>
          </section>
        </div>

        {/* 底部链接 */}
        <div className="mt-12 pt-8 border-t border-[var(--border-primary)] flex justify-between items-center">
          <Link
            href="/privacy"
            className="text-[var(--brand-primary)] hover:underline"
          >
            查看隐私政策
          </Link>
          <Link
            href="/register"
            className="bg-[var(--brand-primary)] hover:bg-[var(--brand-secondary)] text-white px-6 py-2 rounded-lg transition-colors"
          >
            返回注册
          </Link>
        </div>
      </div>
    </div>
  );
}
