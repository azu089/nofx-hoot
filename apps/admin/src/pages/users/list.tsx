/**
 * 用户列表页面
 * 用户管理 - 列表展示、搜索、筛选
 *
 * 已对接真实 API:
 * - GET /admin/users
 * - PUT /admin/users/:id/status
 */
import { useState, useEffect, useCallback } from 'react';
import {
  Table,
  Space,
  Tag,
  Button,
  Avatar,
  Tooltip,
  Modal,
  message,
  Card,
  Typography,
  Input,
  Row,
  Col,
  Statistic,
  Spin,
  Alert,
} from 'antd';
import {
  UserOutlined,
  LockOutlined,
  UnlockOutlined,
  ExclamationCircleOutlined,
  EyeOutlined,
  SearchOutlined,
  ReloadOutlined,
  DownloadOutlined,
  TeamOutlined,
  DollarOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';

const { Title, Text } = Typography;

interface IUser {
  id: string;
  email: string;
  nickname: string | null;
  telegramId: string | null;
  telegramUsername: string | null;
  usdtBalance: string;
  hootBalance: string;
  createdAt: string;
  updatedAt: string;
  apiKeysCount: number;
  subscriptionsCount: number;
  positionsCount: number;
}

interface UserListResponse {
  items: IUser[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const UserList = () => {
  const navigate = useNavigate();
  const [dataSource, setDataSource] = useState<IUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });

  // 搜索状态
  const [searchText, setSearchText] = useState('');

  // 获取用户列表
  const fetchUsers = useCallback(async (page = 1, search = '') => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(pagination.pageSize),
      });
      if (search) {
        params.set('search', search);
      }
      const data = await api.get<UserListResponse>(`/admin/users?${params.toString()}`);
      setDataSource(data.items);
      setPagination(prev => ({
        ...prev,
        current: data.page,
        total: data.total,
      }));
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '获取用户列表失败';
      setError(errorMessage);
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [pagination.pageSize]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // 搜索处理
  const handleSearch = () => {
    fetchUsers(1, searchText);
  };

  // 重置筛选
  const handleReset = () => {
    setSearchText('');
    fetchUsers(1, '');
  };

  // 分页变化
  const handleTableChange = (paginationConfig: { current?: number; pageSize?: number }) => {
    fetchUsers(paginationConfig.current || 1, searchText);
  };

  // 冻结/解冻用户
  const handleFreeze = async (user: IUser, action: 'frozen' | 'active') => {
    const actionText = action === 'frozen' ? '冻结' : '解冻';

    Modal.confirm({
      title: `${actionText}账户`,
      icon: <ExclamationCircleOutlined />,
      content: action === 'frozen'
        ? `确定要冻结用户 ${user.nickname || user.email} 的账户吗？冻结后用户将无法登录和交易。`
        : `确定要解冻用户 ${user.nickname || user.email} 的账户吗？`,
      okText: '确定',
      cancelText: '取消',
      async onOk() {
        try {
          await api.put(`/admin/users/${user.id}/status`, {
            status: action,
            reason: actionText + '操作',
          });
          message.success(`账户已${actionText}`);
          fetchUsers(pagination.current, searchText);
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : `${actionText}失败`;
          message.error(errorMessage);
        }
      },
    });
  };

  // 统计数据
  const stats = {
    totalUsers: pagination.total,
    totalUSDT: dataSource.reduce((sum, u) => sum + parseFloat(u.usdtBalance || '0'), 0),
    totalHOOT: dataSource.reduce((sum, u) => sum + parseFloat(u.hootBalance || '0'), 0),
    apiKeyBound: dataSource.filter(u => u.apiKeysCount > 0).length,
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
      render: (id: string) => <Text copyable={{ text: id }}>{id.slice(0, 8)}...</Text>,
    },
    {
      title: '用户',
      key: 'user',
      render: (_: unknown, record: IUser) => (
        <Space>
          <Avatar icon={<UserOutlined />} />
          <div>
            <div style={{ fontWeight: 500 }}>{record.nickname || '未设置昵称'}</div>
            <div style={{ fontSize: 12, color: '#999' }}>{record.email}</div>
          </div>
        </Space>
      ),
    },
    {
      title: 'Telegram',
      key: 'telegram',
      width: 140,
      render: (_: unknown, record: IUser) => (
        record.telegramUsername ? (
          <Tag color="blue">@{record.telegramUsername}</Tag>
        ) : (
          <Text type="secondary">未绑定</Text>
        )
      ),
    },
    {
      title: 'USDT余额',
      dataIndex: 'usdtBalance',
      key: 'usdtBalance',
      width: 140,
      render: (value: string) => (
        <span style={{ color: '#52c41a', fontWeight: 500 }}>
          ${parseFloat(value || '0').toLocaleString()}
        </span>
      ),
      sorter: true,
    },
    {
      title: 'HOOT余额',
      dataIndex: 'hootBalance',
      key: 'hootBalance',
      width: 120,
      render: (value: string) => (
        <span style={{ color: '#1890ff', fontWeight: 500 }}>
          {parseFloat(value || '0').toLocaleString()}
        </span>
      ),
      sorter: true,
    },
    {
      title: 'API Keys',
      dataIndex: 'apiKeysCount',
      key: 'apiKeysCount',
      width: 100,
      render: (count: number) => (
        count > 0 ? (
          <Tag color="green">{count} 个</Tag>
        ) : (
          <Tag color="default">未绑定</Tag>
        )
      ),
    },
    {
      title: '订阅数',
      dataIndex: 'subscriptionsCount',
      key: 'subscriptionsCount',
      width: 80,
      render: (count: number) => (
        <Tag color={count > 0 ? 'blue' : 'default'}>{count}</Tag>
      ),
    },
    {
      title: '注册时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (value: string) => new Date(value).toLocaleString('zh-CN'),
      sorter: true,
    },
    {
      title: '操作',
      key: 'actions',
      width: 150,
      render: (_: unknown, record: IUser) => (
        <Space>
          <Tooltip title="查看详情">
            <Button
              size="small"
              icon={<EyeOutlined />}
              onClick={() => navigate(`/users/${record.id}`)}
            />
          </Tooltip>
          <Tooltip title="冻结账户">
            <Button
              size="small"
              icon={<LockOutlined />}
              onClick={() => handleFreeze(record, 'frozen')}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}>用户管理</Title>
        <Space>
          <Button
            icon={<ReloadOutlined spin={loading} />}
            onClick={() => fetchUsers(pagination.current, searchText)}
          >
            刷新
          </Button>
          <Button icon={<DownloadOutlined />} onClick={() => message.info('导出功能开发中')}>
            导出数据
          </Button>
        </Space>
      </div>

      {/* 错误提示 */}
      {error && (
        <Alert
          message="数据加载失败"
          description={error}
          type="error"
          showIcon
          style={{ marginBottom: 24 }}
          action={
            <Button size="small" onClick={() => fetchUsers()}>重试</Button>
          }
        />
      )}

      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="总用户数"
              value={stats.totalUsers}
              prefix={<TeamOutlined />}
              loading={loading}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已绑定 API Key"
              value={stats.apiKeyBound}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#52c41a' }}
              loading={loading}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="页面 USDT 总额"
              value={stats.totalUSDT.toFixed(2)}
              prefix={<DollarOutlined />}
              suffix="USDT"
              loading={loading}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="页面 HOOT 总额"
              value={stats.totalHOOT.toLocaleString()}
              valueStyle={{ color: '#1890ff' }}
              suffix="HOOT"
              loading={loading}
            />
          </Card>
        </Col>
      </Row>

      {/* 搜索 */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16} align="middle">
          <Col flex="300px">
            <Input
              placeholder="搜索邮箱或昵称"
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onPressEnter={handleSearch}
              allowClear
            />
          </Col>
          <Col>
            <Space>
              <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
                搜索
              </Button>
              <Button icon={<ReloadOutlined />} onClick={handleReset}>
                重置
              </Button>
            </Space>
          </Col>
          <Col flex="auto" style={{ textAlign: 'right' }}>
            <Text type="secondary">
              共 {pagination.total} 条记录
            </Text>
          </Col>
        </Row>
      </Card>

      {/* 用户列表 */}
      <Card>
        <Spin spinning={loading}>
          <Table
            dataSource={dataSource}
            columns={columns}
            rowKey="id"
            pagination={{
              current: pagination.current,
              pageSize: pagination.pageSize,
              total: pagination.total,
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 条`,
            }}
            onChange={handleTableChange}
          />
        </Spin>
      </Card>
    </div>
  );
};
