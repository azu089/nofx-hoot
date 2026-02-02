/**
 * 用户详情页面
 * 查看用户信息、资产、订阅记录、交易记录
 * 已对接真实 API:
 * - GET /admin/users/:id
 */
import { Show } from '@refinedev/antd';
import {
  Card,
  Descriptions,
  Tag,
  Table,
  Tabs,
  Typography,
  Space,
  Avatar,
  Button,
  Statistic,
  Row,
  Col,
  Spin,
  Alert,
  Empty,
  Modal,
  Tooltip,
} from 'antd';
import { useMessage } from '../../hooks';
import {
  UserOutlined,
  WalletOutlined,
  HistoryOutlined,
  DollarOutlined,
  EditOutlined,
  SendOutlined,
  MailOutlined,
  LinkOutlined,
  DisconnectOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { api } from '../../lib/api';

const { Title, Text } = Typography;

interface UserDetail {
  id: string;
  email: string;
  emailVerified: boolean;
  nickname: string | null;
  phone: string | null;
  telegramId: string | null;
  telegramUsername: string | null;
  walletAddress: string | null;
  status: string;
  usdtBalance: string;
  hootBalance: string;
  createdAt: string;
  updatedAt: string;
  apiKeys: Array<{
    id: string;
    exchange: string;
    label: string;
    isActive: boolean;
    createdAt: string;
  }>;
  subscriptions: Array<{
    id: string;
    status: string;
    createdAt: string;
    expiredAt: string | null;
    strategy: {
      id: string;
      name: string;
    };
  }>;
  positions: Array<{
    id: string;
    symbol: string;
    side: string;
    entryPrice: string;
    amount: string;
    status: string;
    pnl: string | null;
    createdAt: string;
  }>;
  transactions: Array<{
    id: string;
    type: string;
    asset: string;
    amount: string;
    status: string;
    createdAt: string;
  }>;
}

export const UserShow = () => {
  const message = useMessage();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<UserDetail | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      if (!id) return;
      setLoading(true);
      setError(null);
      try {
        const data = await api.get<UserDetail>(`/admin/users/${id}`);
        setUser(data);
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : '获取用户信息失败';
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, [id]);

  const statusColors: Record<string, string> = {
    active: 'green',
    frozen: 'orange',
    banned: 'red',
  };

  const statusLabels: Record<string, string> = {
    active: '正常',
    frozen: '冻结',
    banned: '封禁',
  };

  const subscriptionColumns = [
    {
      title: '策略名称',
      dataIndex: ['strategy', 'name'],
      key: 'strategyName',
    },
    {
      title: '订阅时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (v: string) => new Date(v).toLocaleDateString('zh-CN'),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'active' ? 'green' : 'default'}>
          {status === 'active' ? '生效中' : '已过期'}
        </Tag>
      ),
    },
    {
      title: '到期时间',
      dataIndex: 'expiredAt',
      key: 'expiredAt',
      render: (v: string | null) => v ? new Date(v).toLocaleDateString('zh-CN') : '-',
    },
  ];

  const positionColumns = [
    { title: '交易对', dataIndex: 'symbol', key: 'symbol' },
    {
      title: '方向',
      dataIndex: 'side',
      key: 'side',
      render: (side: string) => (
        <Tag color={side === 'long' ? 'green' : 'red'}>
          {side === 'long' ? '做多' : '做空'}
        </Tag>
      ),
    },
    { title: '开仓价格', dataIndex: 'entryPrice', key: 'entryPrice' },
    { title: '数量', dataIndex: 'amount', key: 'amount' },
    {
      title: '盈亏',
      dataIndex: 'pnl',
      key: 'pnl',
      render: (pnl: string | null) => {
        if (!pnl) return '-';
        const value = parseFloat(pnl);
        return (
          <Text style={{ color: value >= 0 ? '#52c41a' : '#f5222d' }}>
            {value >= 0 ? '+' : ''}{value.toFixed(2)}
          </Text>
        );
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'open' ? 'blue' : 'default'}>
          {status === 'open' ? '持仓中' : '已平仓'}
        </Tag>
      ),
    },
    {
      title: '时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (v: string) => new Date(v).toLocaleString('zh-CN'),
    },
  ];

  const transactionColumns = [
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => {
        const typeLabels: Record<string, string> = {
          deposit: '充值',
          withdraw: '提现',
          subscription: '订阅',
          gas_fee: '燃油费',
          refund: '退款',
          admin_credit: '管理员增加',
          admin_debit: '管理员扣减',
        };
        return typeLabels[type] || type;
      },
    },
    { title: '资产', dataIndex: 'asset', key: 'asset' },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      render: (amount: string) => {
        const value = parseFloat(amount);
        return (
          <Text style={{ color: value >= 0 ? '#52c41a' : '#f5222d' }}>
            {value >= 0 ? '+' : ''}{value.toFixed(2)}
          </Text>
        );
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'completed' ? 'green' : status === 'pending' ? 'orange' : 'red'}>
          {status === 'completed' ? '完成' : status === 'pending' ? '处理中' : '失败'}
        </Tag>
      ),
    },
    {
      title: '时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (v: string) => new Date(v).toLocaleString('zh-CN'),
    },
  ];

  const apiKeyColumns = [
    { title: '交易所', dataIndex: 'exchange', key: 'exchange' },
    { title: '标签', dataIndex: 'label', key: 'label' },
    {
      title: '状态',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (isActive: boolean) => (
        <Tag color={isActive ? 'green' : 'default'}>
          {isActive ? '启用' : '禁用'}
        </Tag>
      ),
    },
    {
      title: '绑定时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (v: string) => new Date(v).toLocaleDateString('zh-CN'),
    },
  ];

  if (loading) {
    return (
      <Show>
        <div style={{ textAlign: 'center', padding: 50 }}>
          <Spin size="large" />
        </div>
      </Show>
    );
  }

  if (error) {
    return (
      <Show>
        <Alert
          message="加载失败"
          description={error}
          type="error"
          action={<Button onClick={() => window.location.reload()}>重试</Button>}
        />
      </Show>
    );
  }

  if (!user) {
    return (
      <Show>
        <Alert message="用户不存在" type="error" />
      </Show>
    );
  }

  // 格式化钱包地址
  const formatAddress = (address: string) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // 解绑 Telegram
  const handleUnbindTelegram = () => {
    Modal.confirm({
      title: '解绑 Telegram',
      icon: <ExclamationCircleOutlined />,
      content: `确定要解绑用户 ${user.nickname || user.email} 的 Telegram 账号吗？`,
      okText: '确定',
      cancelText: '取消',
      async onOk() {
        try {
          await api.delete(`/admin/users/${id}/unbind-telegram`);
          message.success('已解绑 Telegram');
          window.location.reload();
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : '解绑失败';
          message.error(errorMessage);
        }
      },
    });
  };

  // 解绑钱包
  const handleUnbindWallet = () => {
    Modal.confirm({
      title: '解绑钱包',
      icon: <ExclamationCircleOutlined />,
      content: `确定要解绑用户 ${user.nickname || user.email} 的钱包地址吗？`,
      okText: '确定',
      cancelText: '取消',
      async onOk() {
        try {
          await api.delete(`/admin/users/${id}/unbind-wallet`);
          message.success('已解绑钱包');
          window.location.reload();
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : '解绑失败';
          message.error(errorMessage);
        }
      },
    });
  };

  const tabItems = [
    {
      key: 'info',
      label: (
        <span>
          <UserOutlined /> 基本信息
        </span>
      ),
      children: (
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <Card title="账户信息">
            <Descriptions column={2} bordered>
              <Descriptions.Item label="用户ID">
                <Text copyable>{user.id}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={statusColors[user.status] || 'default'}>
                  {statusLabels[user.status] || user.status}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="昵称">{user.nickname || '未设置'}</Descriptions.Item>
              <Descriptions.Item label="手机号">{user.phone || '未绑定'}</Descriptions.Item>
              <Descriptions.Item label="注册时间">
                {new Date(user.createdAt).toLocaleString('zh-CN')}
              </Descriptions.Item>
              <Descriptions.Item label="更新时间">
                {new Date(user.updatedAt).toLocaleString('zh-CN')}
              </Descriptions.Item>
            </Descriptions>
          </Card>

          <Card title={<><LinkOutlined /> 绑定管理</>}>
            <Descriptions column={1} bordered>
              <Descriptions.Item label={<><MailOutlined /> 邮箱</>}>
                <Space>
                  {user.email ? (
                    <>
                      <Text>{user.email}</Text>
                      {user.emailVerified ? (
                        <Tag color="green">已验证</Tag>
                      ) : (
                        <Tag color="orange">未验证</Tag>
                      )}
                    </>
                  ) : (
                    <Text type="secondary">未绑定</Text>
                  )}
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label={<><SendOutlined /> Telegram</>}>
                <Space>
                  {user.telegramUsername ? (
                    <>
                      <Tooltip title={`ID: ${user.telegramId}`}>
                        <Tag color="blue">@{user.telegramUsername}</Tag>
                      </Tooltip>
                      <Button
                        type="link"
                        danger
                        icon={<DisconnectOutlined />}
                        onClick={handleUnbindTelegram}
                      >
                        解绑
                      </Button>
                    </>
                  ) : (
                    <Text type="secondary">未绑定</Text>
                  )}
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label={<><WalletOutlined /> 钱包地址</>}>
                <Space>
                  {user.walletAddress ? (
                    <>
                      <Tooltip title={user.walletAddress}>
                        <Text copyable={{ text: user.walletAddress }}>
                          {formatAddress(user.walletAddress)}
                        </Text>
                      </Tooltip>
                      <Button
                        type="link"
                        danger
                        icon={<DisconnectOutlined />}
                        onClick={handleUnbindWallet}
                      >
                        解绑
                      </Button>
                    </>
                  ) : (
                    <Text type="secondary">未绑定</Text>
                  )}
                </Space>
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Space>
      ),
    },
    {
      key: 'assets',
      label: (
        <span>
          <WalletOutlined /> 资产信息
        </span>
      ),
      children: (
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <Row gutter={16}>
            <Col span={8}>
              <Card>
                <Statistic
                  title="USDT 余额"
                  value={parseFloat(user.usdtBalance || '0')}
                  precision={2}
                  prefix="$"
                  valueStyle={{ color: '#52c41a' }}
                />
              </Card>
            </Col>
            <Col span={8}>
              <Card>
                <Statistic
                  title="HOOT 余额"
                  value={parseFloat(user.hootBalance || '0')}
                  valueStyle={{ color: '#1890ff' }}
                />
              </Card>
            </Col>
            <Col span={8}>
              <Card>
                <Statistic
                  title="绑定 API Key"
                  value={user.apiKeys?.length || 0}
                  suffix="个"
                />
              </Card>
            </Col>
          </Row>

          <Card
            title="API Key 列表"
            extra={
              <Button
                type="primary"
                icon={<EditOutlined />}
                onClick={() => navigate(`/users/${id}/edit`)}
              >
                调整资产
              </Button>
            }
          >
            {user.apiKeys && user.apiKeys.length > 0 ? (
              <Table
                dataSource={user.apiKeys}
                columns={apiKeyColumns}
                rowKey="id"
                pagination={false}
              />
            ) : (
              <Empty description="暂无绑定的 API Key" />
            )}
          </Card>
        </Space>
      ),
    },
    {
      key: 'subscriptions',
      label: (
        <span>
          <DollarOutlined /> 订阅记录
        </span>
      ),
      children: (
        <Card>
          {user.subscriptions && user.subscriptions.length > 0 ? (
            <Table
              dataSource={user.subscriptions}
              columns={subscriptionColumns}
              rowKey="id"
              pagination={{ pageSize: 10 }}
            />
          ) : (
            <Empty description="暂无订阅记录" />
          )}
        </Card>
      ),
    },
    {
      key: 'positions',
      label: (
        <span>
          <HistoryOutlined /> 持仓记录
        </span>
      ),
      children: (
        <Card>
          {user.positions && user.positions.length > 0 ? (
            <Table
              dataSource={user.positions}
              columns={positionColumns}
              rowKey="id"
              pagination={{ pageSize: 10 }}
            />
          ) : (
            <Empty description="暂无持仓记录" />
          )}
        </Card>
      ),
    },
    {
      key: 'transactions',
      label: (
        <span>
          <WalletOutlined /> 交易记录
        </span>
      ),
      children: (
        <Card>
          {user.transactions && user.transactions.length > 0 ? (
            <Table
              dataSource={user.transactions}
              columns={transactionColumns}
              rowKey="id"
              pagination={{ pageSize: 10 }}
            />
          ) : (
            <Empty description="暂无交易记录" />
          )}
        </Card>
      ),
    },
  ];

  return (
    <Show
      headerButtons={[
        <Button
          key="edit"
          type="primary"
          icon={<EditOutlined />}
          onClick={() => navigate(`/users/${id}/edit`)}
        >
          编辑
        </Button>,
      ]}
    >
      <Card style={{ marginBottom: 16 }}>
        <Space size="large">
          <Avatar size={64} icon={<UserOutlined />} />
          <div>
            <Title level={4} style={{ margin: 0 }}>
              {user.nickname || '未设置昵称'}
            </Title>
            <Text type="secondary">{user.email}</Text>
          </div>
          <Tag color={statusColors[user.status] || 'default'} style={{ marginLeft: 16 }}>
            {statusLabels[user.status] || user.status}
          </Tag>
        </Space>
      </Card>

      <Tabs items={tabItems} />
    </Show>
  );
};
