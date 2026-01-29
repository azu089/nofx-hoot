/**
 * QuantFi 管理后台
 * 基于 Refine + Ant Design
 */
import { Refine } from '@refinedev/core';
import { ThemedLayoutV2, notificationProvider, RefineThemes } from '@refinedev/antd';
import routerBindings, {
  UnsavedChangesNotifier,
} from '@refinedev/react-router-v6';
import dataProvider from '@refinedev/simple-rest';
import { BrowserRouter, Route, Routes, Outlet } from 'react-router-dom';
import { ConfigProvider, App as AntdApp } from 'antd';
import zhCN from 'antd/locale/zh_CN';

import '@refinedev/antd/dist/reset.css';

// 页面组件（后续添加）
const DashboardPage = () => <div>仪表盘</div>;
const UserList = () => <div>用户列表</div>;
const StrategyList = () => <div>策略列表</div>;
const FinanceList = () => <div>财务审计</div>;
const WithdrawalList = () => <div>提现审核</div>;

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4001/api';

function App() {
  return (
    <BrowserRouter>
      <ConfigProvider
        locale={zhCN}
        theme={{
          ...RefineThemes.Blue,
          token: {
            colorPrimary: '#3772FF',
          },
        }}
      >
        <AntdApp>
          <Refine
            dataProvider={dataProvider(API_URL)}
            routerProvider={routerBindings}
            notificationProvider={notificationProvider}
            resources={[
              {
                name: 'dashboard',
                list: '/',
                meta: {
                  label: '仪表盘',
                  icon: '📊',
                },
              },
              {
                name: 'users',
                list: '/users',
                meta: {
                  label: '用户管理',
                  icon: '👥',
                },
              },
              {
                name: 'strategies',
                list: '/strategies',
                meta: {
                  label: '策略管理',
                  icon: '📈',
                },
              },
              {
                name: 'finance',
                list: '/finance',
                meta: {
                  label: '财务审计',
                  icon: '💰',
                },
              },
              {
                name: 'withdrawals',
                list: '/withdrawals',
                meta: {
                  label: '提现审核',
                  icon: '💸',
                },
              },
            ]}
            options={{
              syncWithLocation: true,
              warnWhenUnsavedChanges: true,
            }}
          >
            <Routes>
              <Route
                element={
                  <ThemedLayoutV2
                    Title={() => <span style={{ fontWeight: 'bold' }}>QuantFi Admin</span>}
                  >
                    <Outlet />
                  </ThemedLayoutV2>
                }
              >
                <Route index element={<DashboardPage />} />
                <Route path="/users" element={<UserList />} />
                <Route path="/strategies" element={<StrategyList />} />
                <Route path="/finance" element={<FinanceList />} />
                <Route path="/withdrawals" element={<WithdrawalList />} />
              </Route>
            </Routes>
            <UnsavedChangesNotifier />
          </Refine>
        </AntdApp>
      </ConfigProvider>
    </BrowserRouter>
  );
}

export default App;
