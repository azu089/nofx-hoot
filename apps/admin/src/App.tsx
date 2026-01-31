/**
 * HOOT 管理后台
 * 基于 Refine + Ant Design
 */
import { Refine } from '@refinedev/core';
import { notificationProvider } from '@refinedev/antd';
import routerBindings, { UnsavedChangesNotifier } from '@refinedev/react-router-v6';
import dataProvider from '@refinedev/simple-rest';
import { BrowserRouter, Route, Routes, Navigate } from 'react-router-dom';
import { ConfigProvider, App as AntdApp, theme, Spin } from 'antd';
import zhCN from 'antd/locale/zh_CN';

import '@refinedev/antd/dist/reset.css';
import './styles/global.css';

import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AdminLayout } from './components/Layout';

import {
  LoginPage,
  DashboardPage,
  UserList,
  UserShow,
  UserEdit,
  StrategyList,
  StrategyShow,
  StrategyEdit,
  StrategyCreate,
  BillList,
  WithdrawalList,
  DepositsPage,
  FinanceReportsPage,
  AnnouncementList,
  MarqueeList,
  TextConfigList,
  SystemConfigPage,
  BannersPage,
  StakingList,
  WeightsPage,
  DividendsPage,
  EcosystemConfigPage,
  OrdersPage,
  PositionsPage,
  RiskManagementPage,
  LogsPage,
  SettingsPage,
  MonitorPage,
  AdminsPage,
  RolesPage,
  SecuritySettingsPage,
  AgentsPage,
  SignalsPage,
  KillSwitchPage,
} from './pages';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4001/api';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#0a0a0a' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

const AppContent = () => {
  return (
    <Refine
      dataProvider={dataProvider(API_URL)}
      routerProvider={routerBindings}
      notificationProvider={notificationProvider}
      resources={[
        { name: 'dashboard', list: '/' },
        { name: 'users', list: '/users', show: '/users/:id', edit: '/users/:id/edit' },
        { name: 'strategies', list: '/strategies', show: '/strategies/:id', edit: '/strategies/:id/edit', create: '/strategies/create' },
      ]}
      options={{
        syncWithLocation: true,
        warnWhenUnsavedChanges: true,
      }}
    >
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route
          element={
            <ProtectedRoute>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          {/* 核心功能 */}
          <Route index element={<DashboardPage />} />
          <Route path="/users">
            <Route index element={<UserList />} />
            <Route path=":id" element={<UserShow />} />
            <Route path=":id/edit" element={<UserEdit />} />
          </Route>
          <Route path="/strategies">
            <Route index element={<StrategyList />} />
            <Route path=":id" element={<StrategyShow />} />
            <Route path=":id/edit" element={<StrategyEdit />} />
            <Route path="create" element={<StrategyCreate />} />
          </Route>

          {/* 交易中心 */}
          <Route path="/trading">
            <Route path="orders" element={<OrdersPage />} />
            <Route path="positions" element={<PositionsPage />} />
            <Route path="signals" element={<SignalsPage />} />
            <Route path="risk" element={<RiskManagementPage />} />
            <Route path="kill-switch" element={<KillSwitchPage />} />
          </Route>

          {/* 财务中心 */}
          <Route path="/finance">
            <Route path="bills" element={<BillList />} />
            <Route path="deposits" element={<DepositsPage />} />
            <Route path="withdrawals" element={<WithdrawalList />} />
            <Route path="reports" element={<FinanceReportsPage />} />
          </Route>

          {/* 生态中心 */}
          <Route path="/ecosystem">
            <Route path="staking" element={<StakingList />} />
            <Route path="weights" element={<WeightsPage />} />
            <Route path="dividends" element={<DividendsPage />} />
            <Route path="config" element={<EcosystemConfigPage />} />
          </Route>

          {/* 运营管理 */}
          <Route path="/operation">
            <Route path="announcements" element={<AnnouncementList />} />
            <Route path="marquee" element={<MarqueeList />} />
            <Route path="banners" element={<BannersPage />} />
            <Route path="texts" element={<TextConfigList />} />
            <Route path="agents" element={<AgentsPage />} />
          </Route>

          {/* 系统管理 */}
          <Route path="/system">
            <Route path="settings" element={<SettingsPage />} />
            <Route path="config" element={<SystemConfigPage />} />
            <Route path="admins" element={<AdminsPage />} />
            <Route path="roles" element={<RolesPage />} />
            <Route path="security" element={<SecuritySettingsPage />} />
            <Route path="logs" element={<LogsPage />} />
            <Route path="monitor" element={<MonitorPage />} />
          </Route>
        </Route>
      </Routes>
      <UnsavedChangesNotifier />
    </Refine>
  );
};

function App() {
  return (
    <BrowserRouter>
      <ConfigProvider
        locale={zhCN}
        theme={{
          algorithm: theme.darkAlgorithm,
          token: {
            colorPrimary: '#06B6D4',
            colorBgContainer: '#141414',
            colorBgElevated: '#1f1f1f',
            colorBgLayout: '#0a0a0a',
            colorBorder: '#303030',
          },
        }}
      >
        <AntdApp>
          <AuthProvider>
            <AppContent />
          </AuthProvider>
        </AntdApp>
      </ConfigProvider>
    </BrowserRouter>
  );
}

export default App;
