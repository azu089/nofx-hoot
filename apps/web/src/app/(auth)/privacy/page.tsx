'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function PrivacyPage() {
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
          隐私政策
        </h1>
        <p className="text-[var(--text-secondary)] mb-8">
          最后更新日期：2024 年 12 月
        </p>

        {/* 内容 */}
        <div className="prose prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">
              1. 信息收集
            </h2>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              我们收集以下类型的信息：
            </p>
            <ul className="list-disc list-inside text-[var(--text-secondary)] space-y-2 mt-2">
              <li>
                <strong className="text-[var(--text-primary)]">账户信息：</strong>
                邮箱地址、密码（加密存储）、VIP 等级
              </li>
              <li>
                <strong className="text-[var(--text-primary)]">交易信息：</strong>
                交易所 API Key（加密存储）、交易记录、策略配置
              </li>
              <li>
                <strong className="text-[var(--text-primary)]">设备信息：</strong>
                IP 地址、浏览器类型、登录时间
              </li>
              <li>
                <strong className="text-[var(--text-primary)]">使用数据：</strong>
                平台使用情况、功能使用频率
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">
              2. 信息使用
            </h2>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              我们使用收集的信息用于：
            </p>
            <ul className="list-disc list-inside text-[var(--text-secondary)] space-y-2 mt-2">
              <li>提供、维护和改进我们的服务</li>
              <li>处理交易和发送相关通知</li>
              <li>防止欺诈和保护账户安全</li>
              <li>分析使用模式以优化用户体验</li>
              <li>遵守法律法规要求</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">
              3. 信息安全
            </h2>
            <div className="bg-[var(--brand-primary)]/10 border border-[var(--brand-primary)]/30 rounded-lg p-4">
              <p className="text-[var(--brand-primary)] font-medium mb-2">安全措施</p>
              <p className="text-[var(--text-secondary)] leading-relaxed">
                我们采用行业标准的安全措施保护您的信息：
              </p>
              <ul className="list-disc list-inside text-[var(--text-secondary)] space-y-2 mt-2">
                <li>API Key 使用 AES-256-GCM 加密存储</li>
                <li>密码使用 bcrypt 哈希存储</li>
                <li>所有通信使用 HTTPS/TLS 加密</li>
                <li>定期安全审计和渗透测试</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">
              4. 信息共享
            </h2>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              我们不会出售您的个人信息。我们可能在以下情况下共享信息：
            </p>
            <ul className="list-disc list-inside text-[var(--text-secondary)] space-y-2 mt-2">
              <li>获得您的明确同意</li>
              <li>法律要求或政府机构要求</li>
              <li>保护我们的权利、财产或安全</li>
              <li>与服务提供商共享（在严格的数据保护协议下）</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">
              5. 数据保留
            </h2>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              我们将在以下期限内保留您的信息：
            </p>
            <ul className="list-disc list-inside text-[var(--text-secondary)] space-y-2 mt-2">
              <li>账户信息：账户活跃期间及注销后 30 天</li>
              <li>交易记录：根据法规要求保留（通常 5 年）</li>
              <li>日志数据：90 天</li>
              <li>备份数据：根据备份策略保留</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">
              6. 您的权利
            </h2>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              您对自己的数据拥有以下权利：
            </p>
            <ul className="list-disc list-inside text-[var(--text-secondary)] space-y-2 mt-2">
              <li>
                <strong className="text-[var(--text-primary)]">访问权：</strong>
                查看我们收集的关于您的信息
              </li>
              <li>
                <strong className="text-[var(--text-primary)]">更正权：</strong>
                更正不准确的个人信息
              </li>
              <li>
                <strong className="text-[var(--text-primary)]">删除权：</strong>
                请求删除您的账户和数据
              </li>
              <li>
                <strong className="text-[var(--text-primary)]">导出权：</strong>
                导出您的交易数据
              </li>
              <li>
                <strong className="text-[var(--text-primary)]">反对权：</strong>
                反对某些数据处理活动
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">
              7. Cookie 使用
            </h2>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              我们使用 Cookie 和类似技术来：
            </p>
            <ul className="list-disc list-inside text-[var(--text-secondary)] space-y-2 mt-2">
              <li>保持您的登录状态</li>
              <li>记住您的偏好设置</li>
              <li>分析平台使用情况</li>
              <li>改进服务质量</li>
            </ul>
            <p className="text-[var(--text-secondary)] leading-relaxed mt-2">
              您可以通过浏览器设置管理 Cookie 偏好。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">
              8. 国际数据传输
            </h2>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              您的信息可能会被传输到并存储在您所在国家/地区以外的服务器上。
              我们确保这些传输符合适用的数据保护法律，并采取适当的安全措施。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">
              9. 未成年人保护
            </h2>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              我们的服务不面向 18 岁以下的用户。如果我们发现收集了未成年人的信息，
              我们将立即删除这些信息。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">
              10. 政策更新
            </h2>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              我们可能会不时更新本隐私政策。重大变更将通过邮件或平台公告通知您。
              继续使用服务即表示您接受更新后的隐私政策。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">
              11. 联系我们
            </h2>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              如果您对隐私政策有任何疑问，请联系我们的数据保护团队：
            </p>
            <p className="text-[var(--brand-primary)] mt-2">
              privacy@quantfi.io
            </p>
          </section>
        </div>

        {/* 底部链接 */}
        <div className="mt-12 pt-8 border-t border-[var(--border-primary)] flex justify-between items-center">
          <Link
            href="/terms"
            className="text-[var(--brand-primary)] hover:underline"
          >
            查看服务条款
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
