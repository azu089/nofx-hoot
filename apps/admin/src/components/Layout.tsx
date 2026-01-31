/**
 * 自定义管理后台布局
 */
import { useState } from 'react';
import { Layout, Menu } from 'antd';
import {
  DashboardOutlined,
  UserOutlined,
  LineChartOutlined,
  DollarOutlined,
  SwapOutlined,
  AppstoreOutlined,
  SettingOutlined,
  TeamOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { AdminHeader } from './Header';

const { Sider, Content, Header } = Layout;

const menuItems = [
  { key: '/', icon: <DashboardOutlined />, label: '数据看板' },
  { key: '/users', icon: <UserOutlined />, label: '用户管理' },
  { key: '/strategies', icon: <LineChartOutlined />, label: '策略管理' },
  {
    key: 'trading',
    icon: <SwapOutlined />,
    label: '交易中心',
    children: [
      { key: '/trading/orders', label: '订单管理' },
      { key: '/trading/positions', label: '持仓管理' },
      { key: '/trading/signals', label: '信号监控' },
      { key: '/trading/risk', label: '风控管理' },
      { key: '/trading/kill-switch', label: '紧急开关' },
    ],
  },
  {
    key: 'finance',
    icon: <DollarOutlined />,
    label: '财务中心',
    children: [
      { key: '/finance/bills', label: '账单记录' },
      { key: '/finance/deposits', label: '充值记录' },
      { key: '/finance/withdrawals', label: '提现审核' },
      { key: '/finance/reports', label: '财务报表' },
    ],
  },
  {
    key: 'ecosystem',
    icon: <AppstoreOutlined />,
    label: '生态中心',
    children: [
      { key: '/ecosystem/staking', label: '质押管理' },
      { key: '/ecosystem/weights', label: '权重明细' },
      { key: '/ecosystem/dividends', label: '分红管理' },
      { key: '/ecosystem/config', label: '生态配置' },
    ],
  },
  {
    key: 'operation',
    icon: <TeamOutlined />,
    label: '运营管理',
    children: [
      { key: '/operation/announcements', label: '公告管理' },
      { key: '/operation/marquee', label: '跑马灯' },
      { key: '/operation/banners', label: 'Banner' },
      { key: '/operation/texts', label: '文案配置' },
      { key: '/operation/agents', label: '代理商' },
    ],
  },
  {
    key: 'system',
    icon: <SettingOutlined />,
    label: '系统管理',
    children: [
      { key: '/system/settings', label: '基本设置' },
      { key: '/system/config', label: '系统配置' },
      { key: '/system/admins', label: '管理员' },
      { key: '/system/roles', label: '角色权限' },
      { key: '/system/security', label: '安全设置' },
      { key: '/system/logs', label: '日志中心' },
      { key: '/system/monitor', label: '系统监控' },
    ],
  },
];

export const AdminLayout = () => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const handleMenuClick = ({ key }: { key: string }) => {
    navigate(key);
  };

  const siderWidth = collapsed ? 80 : 220;

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        width={220}
        collapsedWidth={80}
        collapsed={collapsed}
        style={{
          background: '#141414',
          borderRight: '1px solid #303030',
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
        }}
      >
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            padding: collapsed ? 0 : '0 16px',
            borderBottom: '1px solid #303030',
          }}
        >
          <img
            src="/logo.png"
            alt="HOOT"
            style={{ width: 32, height: 32, borderRadius: 8 }}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
          {!collapsed && (
            <span style={{ marginLeft: 12, fontWeight: 'bold', fontSize: 18, color: '#fff' }}>
              HOOT
            </span>
          )}
        </div>
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          defaultOpenKeys={collapsed ? [] : ['trading', 'finance', 'ecosystem', 'operation', 'system']}
          items={menuItems}
          onClick={handleMenuClick}
          style={{
            background: '#141414',
            borderRight: 'none',
          }}
        />
      </Sider>
      <Layout style={{ marginLeft: siderWidth, transition: 'margin-left 0.2s' }}>
        <Header
          style={{
            background: '#141414',
            borderBottom: '1px solid #303030',
            padding: '0 16px',
            height: 64,
            lineHeight: '64px',
            position: 'sticky',
            top: 0,
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div
            onClick={() => setCollapsed(!collapsed)}
            style={{ cursor: 'pointer', fontSize: 18, color: '#999' }}
          >
            {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          </div>
          <AdminHeader />
        </Header>
        <Content
          style={{
            background: '#0a0a0a',
            minHeight: 'calc(100vh - 64px)',
            overflow: 'auto',
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};
