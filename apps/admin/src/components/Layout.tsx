/**
 * 自定义管理后台布局
 * 支持移动端响应式：<768px 使用抽屉导航
 */
import { useState, useEffect } from 'react';
import { Layout, Menu, Drawer } from 'antd';
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
  FileTextOutlined,
  GoldOutlined,
  CloseOutlined,
  LinkOutlined,
  RobotOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { AdminHeader } from './Header';

// 移动端断点
const MOBILE_BREAKPOINT = 768;

// 检测是否移动端
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth < MOBILE_BREAKPOINT);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return isMobile;
};

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
    key: 'ai',
    icon: <RobotOutlined />,
    label: 'AI 智能交易',
    children: [
      { key: '/ai/overview', label: 'AI 总览' },
      { key: '/ai/strategies', label: '策略监控' },
      { key: '/ai/research', label: '研究会话' },
      { key: '/ai/cost', label: 'Token 成本' },
      { key: '/ai/configs', label: '用户配置' },
      { key: '/ai/logs', label: '决策日志' },
      { key: '/ai/platform-config', label: '平台 LLM 配置' },
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
      { key: '/ecosystem/airdrops', label: '空投管理' },
      { key: '/ecosystem/config', label: '生态配置' },
      { key: '/ecosystem/airdrop-config', label: '签到配置' },
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
      { key: '/operation/agents/token', icon: <GoldOutlined />, label: '代币管理' },
      { key: '/operation/exchanges', label: '交易所推荐' },
      { key: '/operation/app-install', label: '安装应用' },
    ],
  },
  {
    key: 'content',
    icon: <FileTextOutlined />,
    label: '内容管理',
    children: [
      { key: '/content/help-articles', label: '帮助文章' },
      { key: '/content/legal-docs', label: '法律文档' },
      { key: '/content/faq', label: 'FAQ 问答' },
    ],
  },
  {
    key: 'blockchain',
    icon: <LinkOutlined />,
    label: '区块链',
    children: [
      { key: '/blockchain/status', label: '链上监控' },
      { key: '/blockchain/sweep', label: '资金归集' },
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
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();

  const handleMenuClick = ({ key }: { key: string }) => {
    navigate(key);
    // 移动端点击菜单后关闭抽屉
    if (isMobile) {
      setDrawerOpen(false);
    }
  };

  const siderWidth = isMobile ? 0 : (collapsed ? 80 : 220);

  // 菜单内容
  const menuContent = (
    <>
      <div
        style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: isMobile ? 'space-between' : (collapsed ? 'center' : 'flex-start'),
          padding: isMobile ? '0 16px' : (collapsed ? 0 : '0 16px'),
          borderBottom: '1px solid #303030',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {logoError ? (
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #06B6D4, #0891B2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 14,
                fontWeight: 'bold',
                color: '#fff',
                flexShrink: 0,
              }}
            >
              H
            </div>
          ) : (
            <img
              src="/token.png"
              alt="HOOT"
              style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
              onError={() => setLogoError(true)}
            />
          )}
          {(!collapsed || isMobile) && (
            <span style={{ marginLeft: 12, fontWeight: 'bold', fontSize: 18, color: '#fff' }}>
              HOOT
            </span>
          )}
        </div>
        {isMobile && (
          <CloseOutlined
            onClick={() => setDrawerOpen(false)}
            style={{ fontSize: 18, color: '#999', cursor: 'pointer' }}
          />
        )}
      </div>
      <Menu
        mode="inline"
        selectedKeys={[location.pathname]}
        defaultOpenKeys={collapsed && !isMobile ? [] : ['trading', 'finance', 'ecosystem', 'operation', 'content', 'system']}
        items={menuItems}
        onClick={handleMenuClick}
        style={{
          background: '#141414',
          borderRight: 'none',
        }}
      />
    </>
  );

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* 桌面端：固定侧边栏 */}
      {!isMobile && (
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
          {menuContent}
        </Sider>
      )}

      {/* 移动端：抽屉导航 */}
      {isMobile && (
        <Drawer
          placement="left"
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          width={280}
          closable={false}
          styles={{
            body: { padding: 0, background: '#141414' },
            header: { display: 'none' },
          }}
        >
          {menuContent}
        </Drawer>
      )}

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
            onClick={() => isMobile ? setDrawerOpen(!drawerOpen) : setCollapsed(!collapsed)}
            style={{ cursor: 'pointer', fontSize: 18, color: '#999' }}
          >
            {isMobile ? <MenuUnfoldOutlined /> : (collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />)}
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
