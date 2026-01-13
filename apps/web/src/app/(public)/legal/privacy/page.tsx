import { Metadata } from 'next';

export const metadata: Metadata = {
  title: '隐私政策 - QuantFi',
  description: 'QuantFi 平台隐私政策',
};

export default function PrivacyPage() {
  return (
    <article className="prose prose-invert prose-lg max-w-none">
      <h1 className="text-3xl font-bold text-white mb-2">隐私政策</h1>
      <p className="text-text-secondary mb-8">最后更新日期：2026年1月11日</p>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-white mb-4">1. 引言</h2>
        <p className="text-text-secondary leading-relaxed">
          QuantFi（以下简称"我们"）高度重视用户隐私保护。本隐私政策说明我们如何收集、使用、存储和保护您的个人信息。
          使用我们的服务即表示您同意本隐私政策的条款。
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-white mb-4">2. 信息收集</h2>

        <h3 className="text-lg font-medium text-white mb-3">2.1 您主动提供的信息</h3>
        <ul className="list-disc pl-6 text-text-secondary space-y-2 mb-4">
          <li><strong>账户信息：</strong>电子邮箱、密码（加密存储）</li>
          <li><strong>身份验证：</strong>两步验证绑定信息</li>
          <li><strong>交易所 API：</strong>API Key 和 Secret（AES-256 加密存储）</li>
          <li><strong>充值地址：</strong>用于充值的钱包地址</li>
          <li><strong>通讯记录：</strong>您与客服的沟通内容</li>
        </ul>

        <h3 className="text-lg font-medium text-white mb-3">2.2 自动收集的信息</h3>
        <ul className="list-disc pl-6 text-text-secondary space-y-2 mb-4">
          <li><strong>设备信息：</strong>设备类型、操作系统、浏览器类型、屏幕分辨率</li>
          <li><strong>登录信息：</strong>IP 地址、登录时间、地理位置（国家/城市级别）</li>
          <li><strong>使用数据：</strong>页面访问、功能使用、交易操作日志</li>
          <li><strong>技术数据：</strong>Cookies、浏览器指纹（用于安全检测）</li>
          <li><strong>设备指纹：</strong>用于检测多账户注册、防止薅羊毛行为</li>
        </ul>

        <h3 className="text-lg font-medium text-white mb-3">2.3 第三方来源</h3>
        <ul className="list-disc pl-6 text-text-secondary space-y-2 mb-4">
          <li>交易所 API 返回的账户信息（余额、持仓、交易记录）</li>
          <li>区块链网络的交易确认信息</li>
        </ul>

        <h3 className="text-lg font-medium text-white mb-3">2.4 AI 功能数据使用</h3>
        <div className="bg-bg-tertiary rounded-lg p-4">
          <p className="text-text-secondary text-sm mb-2">
            当您使用 AI 策略生成、持仓解读等功能时，我们会收集：
          </p>
          <ul className="list-disc pl-6 text-text-secondary space-y-1 text-sm">
            <li>您输入的策略描述或查询内容</li>
            <li>持仓信息（用于生成解读）</li>
            <li>交易历史（用于账户分析）</li>
          </ul>
          <p className="text-text-secondary text-sm mt-2 mb-0">
            这些数据将发送至第三方 AI 服务提供商（如 OpenAI、DeepSeek）进行处理。
            我们会对敏感信息进行脱敏处理，但无法完全保证第三方的数据安全。
          </p>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-white mb-4">3. 信息使用</h2>
        <p className="text-text-secondary leading-relaxed mb-4">
          我们使用收集的信息用于：
        </p>
        <ul className="list-disc pl-6 text-text-secondary space-y-2">
          <li><strong>提供服务：</strong>执行交易策略、管理订阅、处理充提</li>
          <li><strong>账户安全：</strong>身份验证、异常登录检测、防欺诈</li>
          <li><strong>服务改进：</strong>分析使用模式、优化用户体验</li>
          <li><strong>客户支持：</strong>响应咨询、处理投诉</li>
          <li><strong>合规要求：</strong>遵守法律法规、配合监管调查</li>
          <li><strong>通知推送：</strong>重要公告、账户变动、安全提醒</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-white mb-4">4. 信息存储与保护</h2>

        <h3 className="text-lg font-medium text-white mb-3">4.1 存储位置</h3>
        <p className="text-text-secondary leading-relaxed mb-4">
          您的数据存储在安全的云服务器上，服务器位于具有严格数据保护法规的司法管辖区。
        </p>

        <h3 className="text-lg font-medium text-white mb-3">4.2 安全措施</h3>
        <ul className="list-disc pl-6 text-text-secondary space-y-2 mb-4">
          <li>密码使用 bcrypt 算法加密存储</li>
          <li>API Key 使用 AES-256-GCM 加密</li>
          <li>所有数据传输使用 TLS/SSL 加密</li>
          <li>定期安全审计和渗透测试</li>
          <li>严格的员工数据访问权限控制</li>
          <li>多层防火墙和入侵检测系统</li>
        </ul>

        <h3 className="text-lg font-medium text-white mb-3">4.3 存储期限</h3>
        <ul className="list-disc pl-6 text-text-secondary space-y-2">
          <li>账户信息：账户存续期间及注销后 5 年</li>
          <li>交易记录：永久保留（用于审计）</li>
          <li>登录日志：2 年</li>
          <li>客服记录：3 年</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-white mb-4">5. 信息共享</h2>
        <p className="text-text-secondary leading-relaxed mb-4">
          我们不会出售您的个人信息。仅在以下情况下可能共享：
        </p>
        <ul className="list-disc pl-6 text-text-secondary space-y-2">
          <li><strong>服务提供商：</strong>云服务、邮件服务等必要的技术支持方</li>
          <li><strong>交易所：</strong>执行交易时传输必要的 API 指令</li>
          <li><strong>法律要求：</strong>响应法院传票、政府调查或法律程序</li>
          <li><strong>业务转让：</strong>公司合并、收购或资产出售时</li>
          <li><strong>用户同意：</strong>获得您明确同意的其他情况</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-white mb-4">6. Cookies 与追踪技术</h2>
        <p className="text-text-secondary leading-relaxed mb-4">
          我们使用以下技术：
        </p>
        <ul className="list-disc pl-6 text-text-secondary space-y-2">
          <li><strong>必要性 Cookies：</strong>维持登录状态、记住偏好设置</li>
          <li><strong>分析 Cookies：</strong>了解用户如何使用平台（可选）</li>
          <li><strong>安全 Cookies：</strong>检测异常行为、防止欺诈</li>
        </ul>
        <p className="text-text-secondary leading-relaxed mt-4">
          您可以通过浏览器设置管理 Cookies，但禁用必要性 Cookies 可能影响平台功能。
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-white mb-4">7. 您的权利</h2>
        <p className="text-text-secondary leading-relaxed mb-4">
          根据适用法律，您可能享有以下权利：
        </p>
        <ul className="list-disc pl-6 text-text-secondary space-y-2">
          <li><strong>访问权：</strong>请求获取我们持有的您的个人信息副本</li>
          <li><strong>更正权：</strong>更正不准确或不完整的个人信息</li>
          <li><strong>删除权：</strong>在特定情况下请求删除您的个人信息</li>
          <li><strong>限制处理权：</strong>限制我们处理您个人信息的方式</li>
          <li><strong>数据可携权：</strong>以结构化格式接收您的数据</li>
          <li><strong>反对权：</strong>反对某些类型的数据处理</li>
          <li><strong>撤回同意：</strong>随时撤回之前给予的同意</li>
        </ul>
        <p className="text-text-secondary leading-relaxed mt-4">
          如需行使上述权利，请联系 privacy@quantfi.com
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-white mb-4">8. 未成年人保护</h2>
        <p className="text-text-secondary leading-relaxed">
          我们的服务不面向 18 岁以下的未成年人。我们不会故意收集未成年人的个人信息。
          如果我们发现收集了未成年人的信息，将立即删除。
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-white mb-4">9. 国际数据传输</h2>
        <p className="text-text-secondary leading-relaxed">
          您的信息可能被传输至您所在国家/地区以外的服务器进行处理。我们会确保此类传输符合适用的数据保护法规，
          并采取适当的保护措施。
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-white mb-4">10. 政策更新</h2>
        <p className="text-text-secondary leading-relaxed">
          我们可能会不时更新本隐私政策。重大变更将通过邮件或平台公告通知您。
          继续使用我们的服务即表示您接受更新后的政策。
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-white mb-4">11. 联系我们</h2>
        <p className="text-text-secondary leading-relaxed">
          如您对本隐私政策有任何疑问或投诉，请联系我们的数据保护团队：
        </p>
        <ul className="list-none mt-4 text-text-secondary space-y-2">
          <li>隐私事务：privacy@quantfi.com</li>
          <li>数据请求：dpo@quantfi.com</li>
          <li>一般咨询：support@quantfi.com</li>
        </ul>
      </section>
    </article>
  );
}
