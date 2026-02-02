/**
 * 管理后台 Header
 * 包含退出按钮
 */
import { Button, Space, Typography, Dropdown, Avatar } from 'antd';
import { UserOutlined, LogoutOutlined, SettingOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useMessage } from '../hooks';
import type { MenuProps } from 'antd';

const { Text } = Typography;

export const AdminHeader = () => {
  const message = useMessage();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    message.success('已退出登录');
    navigate('/login');
  };

  const menuItems: MenuProps['items'] = [
    {
      key: 'user',
      label: (
        <Space direction="vertical" size={0}>
          <Text strong>{user?.username || '管理员'}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {user?.role === 'admin' ? '超级管理员' : '管理员'}
          </Text>
        </Space>
      ),
      disabled: true,
    },
    { type: 'divider' },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: '系统设置',
      onClick: () => navigate('/settings'),
    },
    { type: 'divider' },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      danger: true,
      onClick: handleLogout,
    },
  ];

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'center',
        padding: '0 16px',
        height: '100%',
      }}
    >
      <Space size="middle">
        <Text type="secondary" style={{ fontSize: 12 }}>
          {user?.loginTime
            ? `登录时间: ${new Date(user.loginTime).toLocaleString('zh-CN')}`
            : ''}
        </Text>

        <Dropdown menu={{ items: menuItems }} placement="bottomRight" trigger={['click']}>
          <Button type="text" style={{ padding: '4px 8px' }}>
            <Space>
              <Avatar
                size="small"
                icon={<UserOutlined />}
                style={{ backgroundColor: '#06B6D4' }}
              />
              <Text>{user?.username || '管理员'}</Text>
            </Space>
          </Button>
        </Dropdown>
      </Space>
    </div>
  );
};
