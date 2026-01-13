import { Metadata } from 'next';

export const metadata: Metadata = {
  title: '反洗钱政策 - QuantFi',
  description: 'QuantFi 平台反洗钱与合规政策',
};

export default function AMLPage() {
  return (
    <article className="prose prose-invert prose-lg max-w-none">
      <h1 className="text-3xl font-bold text-white mb-2">反洗钱政策</h1>
      <p className="text-text-secondary mb-8">最后更新日期：2026年1月11日</p>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-white mb-4">1. 政策目的</h2>
        <p className="text-text-secondary leading-relaxed">
          QuantFi 致力于防止洗钱、恐怖融资和其他金融犯罪。本反洗钱（AML）政策概述了我们为遵守适用法律法规
          而采取的措施和程序，确保我们的平台不被用于非法目的。
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-white mb-4">2. 适用范围</h2>
        <p className="text-text-secondary leading-relaxed">
          本政策适用于所有使用 QuantFi 平台服务的用户，以及所有与本平台进行业务往来的个人和实体。
          我们的合规团队负责监督本政策的实施。
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-white mb-4">3. 客户身份识别（KYC）</h2>

        <h3 className="text-lg font-medium text-white mb-3">3.1 基础验证</h3>
        <p className="text-text-secondary leading-relaxed mb-4">
          所有用户在注册时需提供：
        </p>
        <ul className="list-disc pl-6 text-text-secondary space-y-2 mb-4">
          <li>有效的电子邮箱地址</li>
          <li>安全的账户密码</li>
          <li>同意服务条款和隐私政策</li>
        </ul>

        <h3 className="text-lg font-medium text-white mb-3">3.2 增强验证</h3>
        <p className="text-text-secondary leading-relaxed mb-4">
          当用户交易金额达到一定阈值或触发风险标志时，可能需要提供：
        </p>
        <ul className="list-disc pl-6 text-text-secondary space-y-2 mb-4">
          <li>政府签发的有效身份证件</li>
          <li>地址证明文件</li>
          <li>资金来源说明</li>
          <li>自拍照片（用于人脸比对）</li>
        </ul>

        <h3 className="text-lg font-medium text-white mb-3">3.3 持续监控</h3>
        <p className="text-text-secondary leading-relaxed">
          我们会持续监控用户活动，定期更新客户信息，并对高风险账户进行增强尽职调查。
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-white mb-4">4. 交易监控</h2>
        <p className="text-text-secondary leading-relaxed mb-4">
          我们实施自动化交易监控系统，检测以下可疑行为：
        </p>
        <ul className="list-disc pl-6 text-text-secondary space-y-2">
          <li>异常大额充值或提现</li>
          <li>频繁的小额交易（结构化交易）</li>
          <li>与已知高风险地址的交互</li>
          <li>快速充提（快进快出）</li>
          <li>与交易模式不符的突然行为变化</li>
          <li>多个账户的关联行为</li>
          <li>来自高风险司法管辖区的活动</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-white mb-4">5. 制裁筛查</h2>
        <p className="text-text-secondary leading-relaxed mb-4">
          我们会对用户进行制裁名单筛查，包括但不限于：
        </p>
        <ul className="list-disc pl-6 text-text-secondary space-y-2">
          <li>OFAC（美国财政部海外资产控制办公室）制裁名单</li>
          <li>联合国安理会制裁名单</li>
          <li>欧盟制裁名单</li>
          <li>其他适用的国家和国际制裁名单</li>
        </ul>
        <p className="text-text-secondary leading-relaxed mt-4">
          与制裁名单匹配的用户将被拒绝服务或冻结账户。
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-white mb-4">6. 可疑活动报告</h2>
        <p className="text-text-secondary leading-relaxed mb-4">
          当我们发现可疑活动时，将：
        </p>
        <ul className="list-disc pl-6 text-text-secondary space-y-2">
          <li>内部记录并调查相关交易</li>
          <li>根据法律要求向相关当局报告</li>
          <li>可能暂停相关账户的部分或全部功能</li>
          <li>配合执法机构的调查</li>
        </ul>
        <p className="text-text-secondary leading-relaxed mt-4">
          根据法律规定，我们可能无法向用户披露可疑活动报告的存在。
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-white mb-4">7. 记录保存</h2>
        <p className="text-text-secondary leading-relaxed mb-4">
          我们将保留以下记录：
        </p>
        <ul className="list-disc pl-6 text-text-secondary space-y-2">
          <li>客户身份验证文件和数据：至少 5 年</li>
          <li>交易记录：至少 5 年</li>
          <li>可疑活动报告：至少 5 年</li>
          <li>合规培训记录：至少 3 年</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-white mb-4">8. 禁止的活动</h2>
        <div className="bg-danger/10 border border-danger/30 rounded-lg p-6">
          <p className="text-text-secondary leading-relaxed mb-4">
            以下行为在本平台严格禁止：
          </p>
          <ul className="list-disc pl-6 text-text-secondary space-y-2">
            <li>使用非法所得资金</li>
            <li>为他人代持或交易</li>
            <li>故意规避 KYC/AML 程序</li>
            <li>与受制裁实体或个人交易</li>
            <li>从事任何形式的洗钱活动</li>
            <li>资助恐怖主义或其他犯罪活动</li>
            <li>使用匿名或假名账户</li>
          </ul>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-white mb-4">9. 用户责任</h2>
        <p className="text-text-secondary leading-relaxed mb-4">
          作为我们的用户，您有责任：
        </p>
        <ul className="list-disc pl-6 text-text-secondary space-y-2">
          <li>提供真实、准确、完整的身份信息</li>
          <li>及时更新您的个人信息</li>
          <li>遵守您所在司法管辖区的所有适用法律</li>
          <li>仅使用合法来源的资金</li>
          <li>报告任何您发现的可疑活动</li>
          <li>配合我们的 KYC/AML 程序</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-white mb-4">10. 合规团队</h2>
        <p className="text-text-secondary leading-relaxed">
          我们设有专门的合规团队负责：
        </p>
        <ul className="list-disc pl-6 text-text-secondary space-y-2 mt-4">
          <li>监督 AML 政策的实施</li>
          <li>审查可疑活动报告</li>
          <li>与监管机构保持沟通</li>
          <li>定期更新政策和程序</li>
          <li>培训员工了解 AML 要求</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-white mb-4">11. 违规后果</h2>
        <p className="text-text-secondary leading-relaxed mb-4">
          违反本政策可能导致：
        </p>
        <ul className="list-disc pl-6 text-text-secondary space-y-2">
          <li>账户功能限制或暂停</li>
          <li>账户永久终止</li>
          <li>资金冻结（根据法律要求）</li>
          <li>向相关当局举报</li>
          <li>法律诉讼</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-white mb-4">12. 举报渠道</h2>
        <p className="text-text-secondary leading-relaxed">
          如果您发现任何可疑活动或违规行为，请通过以下渠道举报：
        </p>
        <ul className="list-none mt-4 text-text-secondary space-y-2">
          <li>合规邮箱：compliance@quantfi.com</li>
          <li>匿名举报：通过平台内的举报功能</li>
        </ul>
        <p className="text-text-secondary leading-relaxed mt-4">
          我们对举报人的身份严格保密，并禁止任何形式的报复行为。
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-white mb-4">13. 政策更新</h2>
        <p className="text-text-secondary leading-relaxed">
          本政策将根据法律法规变化和业务需要定期更新。重大变更将通过平台公告或邮件通知用户。
          继续使用我们的服务即表示您接受更新后的政策。
        </p>
      </section>
    </article>
  );
}
