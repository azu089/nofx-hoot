import { Metadata } from 'next';
import { AlertTriangle } from 'lucide-react';

export const metadata: Metadata = {
  title: '服务条款 - QuantFi',
  description: 'QuantFi 平台服务条款',
};

export default function TermsPage() {
  return (
    <article className="prose prose-invert prose-lg max-w-none">
      <h1 className="text-3xl font-bold text-white mb-2">服务条款</h1>
      <p className="text-text-secondary mb-8">最后更新日期：2026年1月11日</p>

      {/* 核心声明 */}
      <div className="bg-brand-primary/10 border border-brand-primary/30 rounded-lg p-6 mb-8">
        <h2 className="text-xl font-bold text-brand-primary mb-2 mt-0">重要声明</h2>
        <p className="text-text-secondary leading-relaxed mb-0">
          本平台仅提供量化交易技术工具服务，不构成投资建议，不承诺任何收益，不对策略运行结果承担责任。
          您应当充分理解加密货币交易的高风险性，仅使用您能够承受完全损失的资金。
        </p>
      </div>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-white mb-4">1. 服务说明</h2>
        <p className="text-text-secondary leading-relaxed mb-4">
          QuantFi（以下简称"本平台"）是一个加密货币量化交易技术服务平台，为用户提供策略订阅、自动化交易执行、
          VPS 托管等技术服务。在使用本平台之前，请仔细阅读并理解本服务条款。
        </p>
        <p className="text-text-secondary leading-relaxed mb-4">
          通过注册、访问或使用本平台，您即表示已阅读、理解并同意受本条款的约束。如果您不同意本条款的任何部分，
          请勿使用本平台。
        </p>
        <div className="bg-bg-tertiary rounded-lg p-4">
          <p className="text-text-secondary text-sm mb-0">
            <strong>服务性质声明：</strong>本平台提供的是技术工具服务，而非投资咨询、资产管理或代客理财服务。
            所有交易决策由用户自主做出，交易执行基于用户选择的策略参数自动运行。
          </p>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-white mb-4">2. 用户资格与地域限制</h2>
        <h3 className="text-lg font-medium text-white mb-3">2.1 用户资格</h3>
        <ul className="list-disc pl-6 text-text-secondary space-y-2 mb-4">
          <li>您必须年满18周岁（或您所在司法管辖区的法定成年年龄）</li>
          <li>您必须具有完全民事行为能力</li>
          <li>您所在的国家/地区允许使用加密货币相关服务</li>
          <li>您不在任何制裁名单上</li>
          <li>您提供的注册信息真实、准确、完整</li>
        </ul>

        <h3 className="text-lg font-medium text-white mb-3">2.2 禁止服务地区</h3>
        <div className="bg-danger/10 border border-danger/30 rounded-lg p-4">
          <p className="text-text-secondary mb-2">
            本平台不向以下国家/地区的居民提供服务：
          </p>
          <ul className="list-disc pl-6 text-text-secondary space-y-1 text-sm">
            <li>美国及其领土</li>
            <li>中国大陆</li>
            <li>朝鲜、伊朗、叙利亚、古巴、克里米亚地区</li>
            <li>其他禁止加密货币交易的司法管辖区</li>
          </ul>
          <p className="text-text-secondary text-sm mt-2 mb-0">
            使用 VPN 或其他技术手段规避地域限制的用户，将承担全部法律责任。
          </p>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-white mb-4">3. 账户安全</h2>
        <p className="text-text-secondary leading-relaxed mb-4">
          您有责任：
        </p>
        <ul className="list-disc pl-6 text-text-secondary space-y-2">
          <li>保护您的账户登录凭证，不与任何第三方分享</li>
          <li>启用两步验证（2FA）以增强账户安全</li>
          <li>定期更换密码，使用强密码</li>
          <li>发现账户异常立即通知我们</li>
          <li>对您账户下发生的所有活动负责</li>
          <li>不得将账户转让、出租、出借给他人使用</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-white mb-4">4. 服务内容</h2>

        <h3 className="text-lg font-medium text-white mb-3">4.1 策略订阅服务</h3>
        <p className="text-text-secondary leading-relaxed mb-4">
          本平台提供各类量化交易策略供用户订阅，包括官方策略和社区用户上传的策略。
          策略的历史回测表现不代表未来收益，用户需自行评估策略风险。
        </p>

        <h3 className="text-lg font-medium text-white mb-3">4.2 API 连接服务</h3>
        <p className="text-text-secondary leading-relaxed mb-4">
          用户需提供交易所 API Key 以使用自动化交易功能。我们仅使用具有交易权限的 API，不会提取您的资产。
          <strong>请勿授予提款权限</strong>。建议用户设置 IP 白名单限制 API 访问。
        </p>

        <h3 className="text-lg font-medium text-white mb-3">4.3 VPS 托管服务</h3>
        <p className="text-text-secondary leading-relaxed mb-4">
          我们为每位 VIP 用户提供独立的云服务器（VPS）以确保策略 24/7 稳定运行。
        </p>
        <div className="bg-warning/10 border border-warning/30 rounded-lg p-4 mb-4">
          <p className="text-warning font-medium mb-2">VPS 生命周期说明</p>
          <ul className="list-disc pl-6 text-text-secondary space-y-1 text-sm">
            <li>VPS 将在用户付费后自动创建</li>
            <li>VPS 需要保持心跳连接，<strong>如 15 分钟内未收到心跳信号，系统将判定为僵尸节点并自动销毁</strong></li>
            <li>VPS 销毁前，系统会自动备份交易数据至云存储</li>
            <li>用户欠费或主动停止服务时，VPS 将被销毁以节省资源</li>
          </ul>
        </div>

        <h3 className="text-lg font-medium text-white mb-3">4.4 AI 辅助功能</h3>
        <p className="text-text-secondary leading-relaxed">
          本平台提供 AI 策略生成、持仓解读等辅助功能。AI 生成的内容仅供参考，不构成投资建议，
          用户应自行判断并承担决策责任。
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-white mb-4">5. 费用与支付</h2>

        <h3 className="text-lg font-medium text-white mb-3">5.1 订阅费用</h3>
        <ul className="list-disc pl-6 text-text-secondary space-y-2 mb-4">
          <li>本平台采用订阅制收费，费用以页面显示为准</li>
          <li>支付采用加密货币（USDT）形式</li>
          <li>订阅费用一经支付，除特殊情况外不予退还</li>
          <li>我们保留调整价格的权利，价格变动将提前 7 天通知</li>
        </ul>

        <h3 className="text-lg font-medium text-white mb-3">5.2 技术服务费（燃油费）</h3>
        <div className="bg-bg-tertiary rounded-lg p-4 mb-4">
          <p className="text-text-secondary mb-2">
            当您使用本平台策略产生盈利时，平台将收取技术服务费（又称"燃油费"）：
          </p>
          <ul className="list-disc pl-6 text-text-secondary space-y-1 text-sm">
            <li><strong>费率：盈利部分的 20%</strong></li>
            <li>仅在产生正收益时收取，亏损不收费</li>
            <li>从用户预充值的点卡余额中扣除</li>
            <li>扣费明细可在账单页面查看</li>
          </ul>
        </div>

        <h3 className="text-lg font-medium text-white mb-3">5.3 社区策略分成</h3>
        <p className="text-text-secondary leading-relaxed">
          使用社区用户上传的策略时，策略创作者将从平台技术服务费中获得分成（10%-30%）。
          此分成由平台支付，不额外增加用户费用。
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-white mb-4">6. 积分与代币系统</h2>

        <h3 className="text-lg font-medium text-white mb-3">6.1 Q-Points（积分）</h3>
        <ul className="list-disc pl-6 text-text-secondary space-y-2 mb-4">
          <li>Q-Points 是平台内部积分，可用于抵扣订阅费、兑换代币</li>
          <li>积分通过交易挖矿、邀请返佣等方式获取</li>
          <li>积分无法直接提现，仅限平台内使用</li>
          <li>平台保留调整积分规则的权利</li>
        </ul>

        <h3 className="text-lg font-medium text-white mb-3">6.2 $QFI 代币</h3>
        <ul className="list-disc pl-6 text-text-secondary space-y-2 mb-4">
          <li>$QFI 是平台发行的 ERC-20 代币，总量固定</li>
          <li>代币可通过积分兑换或市场购买获得</li>
          <li><strong>代币价值可能归零，投资需谨慎</strong></li>
        </ul>

        <h3 className="text-lg font-medium text-white mb-3">6.3 释放与兑换规则</h3>
        <div className="bg-bg-tertiary rounded-lg p-4">
          <p className="text-text-secondary mb-2">积分兑换代币时：</p>
          <ul className="list-disc pl-6 text-text-secondary space-y-1 text-sm">
            <li><strong>标准模式：</strong>20% 立即释放，80% 在 90 天内线性释放</li>
            <li><strong>急速模式：</strong>立即获得 50%，剩余 50% 直接销毁</li>
          </ul>
          <p className="text-text-secondary text-sm mt-2 mb-0">
            选择急速模式即表示您同意放弃 50% 的代币权益。
          </p>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-white mb-4">7. 质押系统</h2>

        <h3 className="text-lg font-medium text-white mb-3">7.1 质押类型</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-text-secondary">
            <thead>
              <tr className="border-b border-border-primary">
                <th className="text-left py-2 text-white">类型</th>
                <th className="text-left py-2 text-white">资金来源</th>
                <th className="text-left py-2 text-white">提前解押惩罚</th>
                <th className="text-left py-2 text-white">权重</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border-primary">
                <td className="py-2">A 类</td>
                <td className="py-2">活动赠送/挖矿</td>
                <td className="py-2 text-danger">扣除 50% 本金（销毁）</td>
                <td className="py-2">1.0x</td>
              </tr>
              <tr>
                <td className="py-2">B 类</td>
                <td className="py-2">USDT 购买</td>
                <td className="py-2 text-warning">扣除累计收益 + 3% 手续费</td>
                <td className="py-2">1.0x - 3.0x</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="bg-danger/10 border border-danger/30 rounded-lg p-4 mt-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-danger flex-shrink-0 mt-0.5" />
            <p className="text-text-secondary text-sm mb-0">
              <strong className="text-danger">提前解押风险：</strong>
              A 类质押提前解押将损失 50% 本金，此部分将被永久销毁，无法恢复。
              请在质押前充分了解规则，谨慎决策。
            </p>
          </div>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-white mb-4">8. 禁止行为</h2>
        <p className="text-text-secondary leading-relaxed mb-4">
          用户不得：
        </p>
        <ul className="list-disc pl-6 text-text-secondary space-y-2">
          <li>从事任何违反法律法规的活动</li>
          <li>使用本平台进行洗钱或其他金融犯罪</li>
          <li>试图攻击、入侵或破坏平台系统</li>
          <li>滥用平台资源或进行恶意操作</li>
          <li>使用自动化脚本批量注册账户</li>
          <li>同一设备/IP 注册多个账户（薅羊毛行为）</li>
          <li>转让、出租、出借账户给他人</li>
          <li>绕过平台的安全措施或限制</li>
          <li>传播虚假信息或进行欺诈行为</li>
          <li>上传包含恶意代码的策略文件</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-white mb-4">9. 知识产权</h2>
        <p className="text-text-secondary leading-relaxed">
          本平台的所有内容，包括但不限于软件、代码、算法、设计、文字、图像等，均受知识产权法保护。
          未经授权，用户不得复制、修改、分发、销售或以其他方式使用这些内容。策略代码属于策略开发者，
          用户仅获得使用许可，不得反编译或尝试获取源代码。
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-white mb-4">10. 免责声明</h2>
        <div className="bg-danger/10 border border-danger/30 rounded-lg p-4 mb-4">
          <p className="text-danger font-medium mb-2">重要风险提示</p>
          <p className="text-text-secondary">
            加密货币交易具有极高风险性，可能导致部分或全部投资损失。本平台仅提供技术工具服务，
            不对任何交易损失承担责任。使用本平台即表示您完全理解并接受这些风险。
          </p>
        </div>
        <ul className="list-disc pl-6 text-text-secondary space-y-2">
          <li>本平台按"现状"提供服务，不保证策略盈利或收益</li>
          <li>我们不对因市场波动、交易所故障、网络问题等导致的损失负责</li>
          <li>历史业绩、回测结果不代表未来表现</li>
          <li>AI 生成的内容仅供参考，不构成投资建议</li>
          <li>用户应根据自身风险承受能力做出投资决策</li>
          <li>因 VPS 销毁（包括心跳超时）导致的交易中断，平台不承担责任</li>
          <li>因交易所 API 限制或故障导致的损失，平台不承担责任</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-white mb-4">11. 赔偿限制</h2>
        <p className="text-text-secondary leading-relaxed mb-4">
          在法律允许的最大范围内，本平台对用户因使用服务而遭受的任何损失的赔偿责任上限为：
        </p>
        <ul className="list-disc pl-6 text-text-secondary space-y-2">
          <li>用户在过去 12 个月内向平台支付的订阅费用总额，或</li>
          <li>100 USDT</li>
        </ul>
        <p className="text-text-secondary leading-relaxed mt-4">
          以较高者为准。本平台不对间接损失、预期利润损失、数据丢失等承担责任。
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-white mb-4">12. 服务变更与终止</h2>
        <p className="text-text-secondary leading-relaxed mb-4">
          我们保留以下权利：
        </p>
        <ul className="list-disc pl-6 text-text-secondary space-y-2">
          <li>随时修改、暂停或终止服务（部分或全部）</li>
          <li>更新本服务条款，更新后继续使用视为接受</li>
          <li>因违规行为暂停或终止用户账户</li>
          <li>在必要时进行系统维护或升级</li>
          <li>启动全网紧急停止（Kill Switch）以应对极端行情</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-white mb-4">13. 争议解决</h2>
        <h3 className="text-lg font-medium text-white mb-3">13.1 协商优先</h3>
        <p className="text-text-secondary leading-relaxed mb-4">
          因本条款产生的任何争议，双方应首先通过友好协商解决。请通过 legal@quantfi.com 联系我们。
        </p>

        <h3 className="text-lg font-medium text-white mb-3">13.2 仲裁条款</h3>
        <p className="text-text-secondary leading-relaxed mb-4">
          协商不成的，任何一方均可将争议提交至新加坡国际仲裁中心（SIAC）进行仲裁。
          仲裁裁决为终局裁决，对双方均有约束力。
        </p>

        <h3 className="text-lg font-medium text-white mb-3">13.3 适用法律</h3>
        <p className="text-text-secondary leading-relaxed">
          本条款的解释、效力及争议解决均适用新加坡法律。
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-white mb-4">14. 可分割性</h2>
        <p className="text-text-secondary leading-relaxed">
          如本条款的任何条款被认定为无效或不可执行，该条款应在允许的最大范围内执行，
          其余条款仍具有完全的法律效力。
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-white mb-4">15. 联系我们</h2>
        <p className="text-text-secondary leading-relaxed">
          如您对本服务条款有任何疑问，请通过以下方式联系我们：
        </p>
        <ul className="list-none mt-4 text-text-secondary space-y-2">
          <li>法律事务：legal@quantfi.com</li>
          <li>客服支持：support@quantfi.com</li>
          <li>紧急事务：emergency@quantfi.com</li>
        </ul>
      </section>
    </article>
  );
}
