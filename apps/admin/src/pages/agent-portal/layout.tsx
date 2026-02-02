/**
 * 代理商后台布局
 */
import { useState, useEffect } from 'react';
import { Layout, Menu, Button, Avatar, Dropdown, Typography, ConfigProvider, theme } from 'antd';
import './agent-dark-theme.css';
import {
  DashboardOutlined,
  TeamOutlined,
  DollarOutlined,
  WalletOutlined,
  LogoutOutlined,
  UserOutlined,
  SettingOutlined,
  CrownOutlined,
  GoldOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import type { MenuProps } from 'antd';

import { useMessage } from '../../hooks';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

const menuItems: MenuProps['items'] = [
  {
    key: '/agent/dashboard',
    icon: <DashboardOutlined />,
    label: '业绩概览',
  },
  {
    key: '/agent/users',
    icon: <TeamOutlined />,
    label: '推广用户',
  },
  {
    key: '/agent/commissions',
    icon: <DollarOutlined />,
    label: '佣金记录',
  },
  {
    key: '/agent/token-assets',
    icon: <GoldOutlined />,
    label: '代币资产',
  },
  {
    key: '/agent/withdrawals',
    icon: <WalletOutlined />,
    label: '提现管理',
  },
];

export default function AgentLayout() {
  const message = useMessage();
  const [collapsed, setCollapsed] = useState(false);
  const [agentInfo, setAgentInfo] = useState<any>(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // 检查登录状态
    const token = localStorage.getItem('agent_token');
    const info = localStorage.getItem('agent_info');

    if (!token) {
      navigate('/agent/login');
      return;
    }

    if (info) {
      setAgentInfo(JSON.parse(info));
    }
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('agent_token');
    localStorage.removeItem('agent_info');
    message.success('已退出登录');
    navigate('/agent/login');
  };

  const userMenuItems: MenuProps['items'] = [
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: '账户设置',
      onClick: () => navigate('/agent/settings'),
    },
    { type: 'divider' },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: handleLogout,
    },
  ];

  return (
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: '#06b6d4',
          colorBgContainer: '#0a0a0f',
          colorBgElevated: '#12121a',
          colorBorder: '#1e1e2e',
          colorText: '#fff',
          colorTextSecondary: '#94a3b8',
        },
        components: {
          Menu: {
            darkItemBg: '#0a0a0f',
            darkSubMenuItemBg: '#0a0a0f',
            darkItemSelectedBg: '#06b6d4',
            darkItemHoverBg: '#12121a',
            darkItemColor: '#94a3b8',
            darkItemSelectedColor: '#fff',
          },
          Layout: {
            siderBg: '#0a0a0f',
            triggerBg: '#12121a',
          },
        },
      }}
    >
      <Layout className="agent-layout" style={{ minHeight: '100vh' }}>
        <Sider
          collapsible
          collapsed={collapsed}
          onCollapse={setCollapsed}
          theme="dark"
          style={{ background: '#0a0a0f' }}
        >
          <div
            style={{
              height: 64,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderBottom: '1px solid #1e1e2e',
            }}
          >
            <CrownOutlined style={{ fontSize: 24, color: '#faad14' }} />
            {!collapsed && (
              <Text
                strong
                style={{ color: '#fff', marginLeft: 12, fontSize: 18 }}
              >
                代理商后台
              </Text>
            )}
          </div>
          <Menu
            theme="dark"
            mode="inline"
            selectedKeys={[location.pathname]}
            items={menuItems}
            onClick={({ key }) => navigate(key)}
            style={{ background: '#12121a', borderRight: 'none' }}
            rootClassName="agent-menu"
          />
        </Sider>

      <Layout style={{ background: '#0a0a0f' }}>
        <Header
          style={{
            padding: '0 24px',
            background: '#12121a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #1e1e2e',
          }}
        >
          <div>
            <Text style={{ color: '#94a3b8' }}>
              欢迎回来，
            </Text>
            <Text strong style={{ marginLeft: 4, color: '#fff' }}>
              {agentInfo?.name || '代理商'}
            </Text>
          </div>

          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
            <Button type="text" style={{ display: 'flex', alignItems: 'center' }}>
              <Avatar icon={<UserOutlined />} style={{ backgroundColor: '#faad14' }} />
              {!collapsed && (
                <Text style={{ marginLeft: 8, color: '#fff' }}>{agentInfo?.name}</Text>
              )}
            </Button>
          </Dropdown>
        </Header>

        <Content
          className="agent-portal"
          style={{
            margin: 24,
            padding: 24,
            background: '#0a0a0f',
            minHeight: 'calc(100vh - 112px)',
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
    </ConfigProvider>
  );
}
