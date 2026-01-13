import { Metadata } from 'next';
import { AlertTriangle, TrendingDown, Cpu, Building2, Scale, Wallet, Coins, Lock } from 'lucide-react';

export const metadata: Metadata = {
  title: '风险披露 - QuantFi',
  description: 'QuantFi 平台风险披露声明',
};

export default function RiskDisclosurePage() {
  return (
    <article className="prose prose-invert prose-lg max-w-none">
      <h1 className="text-3xl font-bold text-white mb-2">风险披露声明</h1>
      <p className="text-text-secondary mb-8">最后更新日期：2026年1月11日</p>

      {/* 警告框 */}
      <div className="bg-danger/10 border border-danger/30 rounded-lg p-6 mb-8">
        <div className="flex items-start gap-4">
          <AlertTriangle className="w-8 h-8 text-danger flex-shrink-0 mt-1" />
          <div>
            <h2 className="text-xl font-bold text-danger mb-2 mt-0">重要风险警告</h2>
            <p className="text-text-secondary leading-relaxed mb-0">
              加密货币和量化交易具有极高风险，可能导致您的全部投资损失。在使用本平台服务之前，
              请确保您完全理解以下风险，并仅使用您能够承受完全损失的资金进行投资。
              <strong className="text-danger">本平台不承诺任何收益，不对策略运行结果负责。</strong>
            </p>
          </div>
        </div>
      </div>

      <section className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <TrendingDown className="w-6 h-6 text-danger" />
          <h2 className="text-xl font-semibold text-white mb-0">1. 市场风险</h2>
        </div>
        <ul className="list-disc pl-6 text-text-secondary space-y-2">
          <li>加密货币市场 24/7 全天候运行，价格波动剧烈，单日涨跌幅可达数十个百分点</li>
          <li>市场可能受到监管政策、技术故障、黑客攻击等因素的影响</li>
          <li>流动性不足可能导致无法在预期价格成交（滑点风险）</li>
          <li>杠杆交易会放大盈亏，可能导致爆仓和全部损失</li>
          <li>市场操纵行为可能存在，对交易造成不利影响</li>
          <li>极端行情（闪崩、插针）可能导致策略无法正常执行</li>
        </ul>
      </section>

      <section className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Cpu className="w-6 h-6 text-warning" />
          <h2 className="text-xl font-semibold text-white mb-0">2. 策略风险</h2>
        </div>
        <ul className="list-disc pl-6 text-text-secondary space-y-2">
          <li><strong>历史表现不代表未来收益：</strong>过去的盈利记录不保证未来能持续盈利</li>
          <li><strong>回测与实盘差异：</strong>回测基于历史数据，实盘环境存在滑点、延迟等因素</li>
          <li><strong>策略失效风险：</strong>市场环境变化可能导致原本有效的策略失效</li>
          <li><strong>回撤风险：</strong>任何策略都可能经历大幅回撤期</li>
          <li><strong>过度拟合：</strong>基于历史数据优化的策略可能在实盘中表现不佳</li>
          <li><strong>黑天鹅事件：</strong>极端市场事件可能导致策略产生重大损失</li>
          <li><strong>社区策略风险：</strong>社区用户上传的策略未经平台实盘验证，风险自担</li>
        </ul>
      </section>

      <section className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Cpu className="w-6 h-6 text-brand-primary" />
          <h2 className="text-xl font-semibold text-white mb-0">3. 技术风险</h2>
        </div>
        <ul className="list-disc pl-6 text-text-secondary space-y-2">
          <li><strong>系统故障：</strong>服务器、网络或软件故障可能导致交易延迟或失败</li>
          <li><strong>API 限制：</strong>交易所 API 限流或故障可能影响策略执行</li>
          <li><strong>网络延迟：</strong>网络延迟可能导致成交价格与预期不符</li>
          <li><strong>数据错误：</strong>市场数据错误可能导致错误的交易决策</li>
          <li><strong>网络安全：</strong>黑客攻击可能威胁资金和数据安全</li>
          <li><strong>VPS 故障：</strong>VPS 心跳超时（15 分钟）将导致自动销毁，可能中断正在运行的策略</li>
        </ul>
      </section>

      <section className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Building2 className="w-6 h-6 text-text-secondary" />
          <h2 className="text-xl font-semibold text-white mb-0">4. 交易所风险</h2>
        </div>
        <ul className="list-disc pl-6 text-text-secondary space-y-2">
          <li>交易所可能遭受黑客攻击，导致资金被盗</li>
          <li>交易所可能因经营问题破产或跑路</li>
          <li>交易所可能暂停提款或冻结资产</li>
          <li>交易所可能单方面修改规则或费率</li>
          <li>不同交易所的 API 稳定性和可靠性各异</li>
          <li>交易所可能因合规原因停止向某些地区提供服务</li>
        </ul>
      </section>

      <section className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Scale className="w-6 h-6 text-warning" />
          <h2 className="text-xl font-semibold text-white mb-0">5. 监管与法律风险</h2>
        </div>
        <ul className="list-disc pl-6 text-text-secondary space-y-2">
          <li>加密货币在不同国家/地区的法律地位不同</li>
          <li>监管政策可能突然变化，影响交易和服务</li>
          <li>用户有责任遵守当地法律法规和税务要求</li>
          <li>本平台可能因监管原因停止在某些地区的服务</li>
          <li>加密货币交易可能产生税务义务，用户需自行申报</li>
        </ul>
      </section>

      <section className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Wallet className="w-6 h-6 text-success" />
          <h2 className="text-xl font-semibold text-white mb-0">6. 资金安全风险</h2>
        </div>
        <ul className="list-disc pl-6 text-text-secondary space-y-2">
          <li>您的交易资金存放在您自己的交易所账户中，我们仅通过 API 进行交易</li>
          <li><strong className="text-danger">请勿将交易所 API 的提款权限授予任何第三方（包括本平台）</strong></li>
          <li>建议只在平台充值日常运营所需的资金</li>
          <li>大额资金应存放在离线冷钱包中</li>
          <li>定期审计您的 API 权限和账户安全设置</li>
          <li>平台内 USDT 余额仅用于支付订阅费和服务费，请勿充值过多</li>
        </ul>
      </section>

      <section className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Coins className="w-6 h-6 text-warning" />
          <h2 className="text-xl font-semibold text-white mb-0">7. 代币风险</h2>
        </div>
        <div className="bg-warning/10 border border-warning/30 rounded-lg p-4 mb-4">
          <p className="text-warning font-medium mb-2">$QFI 代币投资风险</p>
          <p className="text-text-secondary text-sm mb-0">
            $QFI 代币是平台发行的加密资产，不代表任何股权、债权或收益权。代币价值完全取决于市场供需，
            可能出现剧烈波动甚至归零。请仅使用您能承受完全损失的资金参与代币相关活动。
          </p>
        </div>
        <ul className="list-disc pl-6 text-text-secondary space-y-2">
          <li><strong>价格波动：</strong>代币价格可能剧烈波动，短期内可能大幅下跌</li>
          <li><strong>流动性风险：</strong>代币可能缺乏足够的市场流动性，难以按预期价格卖出</li>
          <li><strong>归零风险：</strong>代币价值可能归零，您可能损失全部投资</li>
          <li><strong>释放期风险：</strong>90 天线性释放期间，代币价格可能大幅波动</li>
          <li><strong>急速模式风险：</strong>选择急速模式将永久销毁 50% 代币权益</li>
          <li><strong>非证券声明：</strong>$QFI 不构成证券，不代表对平台的任何所有权</li>
        </ul>
      </section>

      <section className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Lock className="w-6 h-6 text-danger" />
          <h2 className="text-xl font-semibold text-white mb-0">8. 质押风险</h2>
        </div>
        <div className="bg-danger/10 border border-danger/30 rounded-lg p-4 mb-4">
          <p className="text-danger font-medium mb-2">A 类质押特别警告</p>
          <p className="text-text-secondary text-sm mb-0">
            A 类质押（活动赠送/挖矿来源）如提前解押，将<strong className="text-danger">扣除 50% 本金并永久销毁</strong>，
            此操作不可逆，请务必在质押前充分了解规则。
          </p>
        </div>
        <ul className="list-disc pl-6 text-text-secondary space-y-2">
          <li><strong>锁定期风险：</strong>质押期间资金被锁定，无法自由支配</li>
          <li><strong>A 类惩罚：</strong>A 类质押提前解押将损失 50% 本金（销毁）</li>
          <li><strong>B 类惩罚：</strong>B 类质押提前解押将扣除累计收益 + 3% 手续费</li>
          <li><strong>收益不确定：</strong>质押收益来源于平台回购，受平台运营状况影响</li>
          <li><strong>智能合约风险：</strong>链上质押可能面临合约漏洞风险</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-white mb-4">9. 投资建议</h2>
        <div className="bg-brand-primary/10 border border-brand-primary/30 rounded-lg p-6">
          <ul className="list-disc pl-6 text-text-secondary space-y-2">
            <li><strong>仅使用闲余资金：</strong>只投资您能承受完全损失的资金</li>
            <li><strong>分散投资：</strong>不要把所有资金放在单一策略或平台</li>
            <li><strong>设置止损：</strong>使用平台的止损功能，控制单笔交易风险</li>
            <li><strong>定期监控：</strong>定期检查账户状态和策略表现</li>
            <li><strong>保持理性：</strong>不要因短期波动做出冲动决策</li>
            <li><strong>持续学习：</strong>了解加密货币和量化交易的基本知识</li>
            <li><strong>专业咨询：</strong>如有需要，请咨询专业的投资顾问</li>
          </ul>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-white mb-4">10. 确认声明</h2>
        <p className="text-text-secondary leading-relaxed mb-4">
          使用本平台服务即表示您确认：
        </p>
        <ul className="list-disc pl-6 text-text-secondary space-y-2">
          <li>您已阅读并完全理解上述所有风险</li>
          <li>您具有足够的知识和经验来评估这些风险</li>
          <li>您使用的资金是您能承受完全损失的闲余资金</li>
          <li>您将为自己的投资决策承担全部责任</li>
          <li>您不会因任何投资损失向本平台追责</li>
          <li>您理解本平台仅提供技术工具，不构成投资建议</li>
          <li>您理解历史表现不代表未来收益</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-white mb-4">11. 紧急联系</h2>
        <p className="text-text-secondary leading-relaxed">
          如发现账户异常或紧急情况，请立即：
        </p>
        <div className="bg-bg-tertiary rounded-lg p-4 mt-4">
          <ol className="list-decimal pl-6 text-text-secondary space-y-2">
            <li>使用平台的<strong>紧急停止（Panic Button）</strong>功能暂停所有策略</li>
            <li>联系紧急客服：<strong>emergency@quantfi.com</strong></li>
            <li>在交易所端<strong>立即撤销/重置 API Key</strong></li>
            <li>检查交易所账户是否有异常交易</li>
          </ol>
        </div>
      </section>
    </article>
  );
}
