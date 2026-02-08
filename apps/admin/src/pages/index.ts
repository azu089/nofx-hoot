/**
 * 管理后台页面统一导出
 *
 * 目录结构详见: /apps/admin/STRUCTURE.md
 */

// ==================== 认证 ====================
export { LoginPage } from './login';

// ==================== 数据看板 ====================
export { DashboardPage } from './dashboard';

// ==================== 用户管理 ====================
export { UserList } from './users/list';
export { UserShow } from './users/show';
export { UserEdit } from './users/edit';

// ==================== 策略管理 ====================
export { StrategyList } from './strategies/list';
export { StrategyShow } from './strategies/show';
export { StrategyEdit } from './strategies/edit';
export { StrategyCreate } from './strategies/create';

// ==================== 交易中心 ====================
export { OrdersPage } from './trading/orders';
export { PositionsPage } from './trading/positions';

// ==================== 信号监控 ====================
export { SignalsPage } from './signals';
export { KillSwitchPage } from './signals/kill-switch';

// ==================== 风控管理 ====================
export { RiskManagementPage } from './risk';

// ==================== 财务中心 ====================
export { FinancePage } from './finance/index';
export { BillList } from './finance/bills';
export { DepositsPage } from './finance/deposits';
export { WithdrawalList } from './finance/withdrawals';
export { FinanceReportsPage } from './finance/reports';

// ==================== 生态中心 ====================
export { StakingList } from './ecosystem/staking';
export { WeightsPage } from './ecosystem/weights';
export { DividendsPage } from './ecosystem/dividends';
export { AirdropList } from './ecosystem/airdrops';
export { EcosystemConfigPage } from './ecosystem/config';
export { AirdropConfigPage } from './ecosystem/airdrop-config';

// ==================== 运营管理 ====================
// 公告
export { AnnouncementList } from './announcements/list';
export { MarqueeList } from './announcements/marquee';

// 代理商
export { AgentsPage } from './agents';
export { TokenManagementPage } from './agents/token-management';

// 交易所 & 安装应用
export { ExchangeListPage } from './operation/exchanges';
export { AppInstallPage } from './operation/app-install';

// ==================== 内容管理 ====================
export { BannersPage } from './content/banners';
export { TextConfigList } from './content/texts';
export { SystemConfigPage } from './content/config';
export { HelpArticleList } from './content/help-articles';
export { LegalDocumentList } from './content/legal-docs';
export { FaqList } from './content/faq';

// ==================== 用户统计 ====================
export { UserStatsPage } from './stats/users';

// ==================== 区块链管理 ====================
export { BlockchainStatusPage } from './blockchain/status';
export { SweepPage } from './blockchain/sweep';

// ==================== 系统管理 ====================
// 设置
export { SettingsPage } from './settings';
export { MonitorPage } from './settings/monitor';
export { AdminsPage } from './settings/admins';
export { RolesPage } from './settings/roles';
export { SecuritySettingsPage } from './settings/security';

// 日志
export { LogsPage } from './logs';
export { OperationLogsPage } from './logs/operations';
export { TradeLogsPage } from './logs/trades';
export { LoginLogsPage } from './logs/logins';
export { SystemLogsPage } from './logs/system';
