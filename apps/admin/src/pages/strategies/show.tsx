/**
 * 策略详情页面
 * 查看策略完整信息、订阅用户、信号记录
 * 已对接真实 API:
 * - GET /admin/strategies/:id
 */
import { Show } from '@refinedev/antd';
import {
  Card,
  Descriptions,
  Tag,
  Space,
  Table,
  Tabs,
  Statistic,
  Row,
  Col,
  Typography,
  Avatar,
  Spin,
  Alert,
  Button,
  Empty,
} from 'antd';
import {
  RiseOutlined,
  FallOutlined,
  UserOutlined,
  HistoryOutlined,
  LineChartOutlined,
  EditOutlined,
} from '@ant-design/icons';
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';

const { Text } = Typography;

interface SubscriberInfo {
  id: string;
  userId: string;
  username: string;
  email: string;
  subscribedAt: string;
  capital: string;
  isActive: boolean;
}

interface SignalInfo {
  id: string;
  type: string;
  symbol: string;
  side: string;
  price: string | null;
  createdAt: string;
}

interface StrategyDetail {
  id: string;
  name: string;
  description: string;
  freqtradeId: string;
  riskLevel: string;
  isActive: boolean;
  isFeatured: boolean;
  sortOrder: number;
  imageUrl: string | null;
  tags: string[];
  return7d: string | null;
  return30d: string | null;
  return90d: string | null;
  maxDrawdown: string | null;
  winRate: string | null;
  totalTrades: number;
  subscribersCount: number;
  signalsCount: number;
  createdAt: string;
  updatedAt: string;
  subscribers: SubscriberInfo[];
  recentSignals: SignalInfo[];
}

export const StrategyShow = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [strategy, setStrategy] = useState<StrategyDetail | null>(null);

  useEffect(() => {
    const fetchStrategy = async () => {
      if (!id) return;
      setLoading(true);
      setError(null);
      try {
        const data = await api.get<StrategyDetail>(`/admin/strategies/${id}`);
        setStrategy(data);
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : '获取策略信息失败';
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };
    fetchStrategy();
  }, [id]);

  const statusConfig: Record<string, { color: string; label: string }> = {
    true: { color: 'success', label: '运行中' },
    false: { color: 'default', label: '已停用' },
  };

  const riskConfig: Record<string, { color: string; label: string }> = {
    low: { color: 'green', label: '低风险' },
    medium: { color: 'orange', label: '中风险' },
    high: { color: 'red', label: '高风险' },
  };

  const subscriberColumns = [
    { title: '订阅ID', dataIndex: 'id', key: 'id', width: 100, ellipsis: true },
    {
      title: '用户',
      key: 'user',
      render: (_: unknown, record: SubscriberInfo) => (
        <Space>
          <Avatar size="small" icon={<UserOutlined />} />
          <div>
            <div>{record.username}</div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {record.email}
            </Text>
          </div>
        </Space>
      ),
    },
    {
      title: '订阅时间',
      dataIndex: 'subscribedAt',
      key: 'subscribedAt',
      render: (v: string) => new Date(v).toLocaleDateString('zh-CN'),
    },
    {
      title: '跟单资金',
      dataIndex: 'capital',
      key: 'capital',
      render: (v: string) => `${parseFloat(v).toLocaleString()} USDT`,
    },
    {
      title: '状态',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (isActive: boolean) => (
        <Tag color={isActive ? 'green' : 'default'}>
          {isActive ? '跟单中' : '已停止'}
        </Tag>
      ),
    },
  ];

  const signalColumns = [
    {
      title: '时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (v: string) => new Date(v).toLocaleString('zh-CN'),
    },
    { title: '交易对', dataIndex: 'symbol', key: 'symbol', width: 120 },
    { title: '类型', dataIndex: 'type', key: 'type', width: 80 },
    {
      title: '方向',
      dataIndex: 'side',
      key: 'side',
      width: 80,
      render: (side: string) => (
        <Tag color={side === 'buy' || side === 'long' ? 'green' : 'red'}>
          {side === 'buy' || side === 'long' ? '买入' : '卖出'}
        </Tag>
      ),
    },
    {
      title: '价格',
      dataIndex: 'price',
      key: 'price',
      render: (v: string | null) => v ? parseFloat(v).toLocaleString() : '-',
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

  if (error || !strategy) {
    return (
      <Show>
        <Alert
          message="加载失败"
          description={error || '策略不存在'}
          type="error"
          action={<Button onClick={() => window.location.reload()}>重试</Button>}
        />
      </Show>
    );
  }

  const tabItems = [
    {
      key: 'overview',
      label: (
        <span>
          <LineChartOutlined />
          策略概览
        </span>
      ),
      children: (
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          {/* 核心指标 */}
          <Row gutter={16}>
            <Col span={6}>
              <Card>
                <Statistic
                  title="7天收益率"
                  value={strategy.return7d ? parseFloat(strategy.return7d) : 0}
                  precision={2}
                  valueStyle={{ color: parseFloat(strategy.return7d || '0') >= 0 ? '#52c41a' : '#f5222d' }}
                  prefix={parseFloat(strategy.return7d || '0') >= 0 ? <RiseOutlined /> : <FallOutlined />}
                  suffix="%"
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="30天收益率"
                  value={strategy.return30d ? parseFloat(strategy.return30d) : 0}
                  precision={2}
                  valueStyle={{ color: parseFloat(strategy.return30d || '0') >= 0 ? '#52c41a' : '#f5222d' }}
                  prefix={parseFloat(strategy.return30d || '0') >= 0 ? <RiseOutlined /> : <FallOutlined />}
                  suffix="%"
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="最大回撤"
                  value={strategy.maxDrawdown ? parseFloat(strategy.maxDrawdown) : 0}
                  precision={2}
                  valueStyle={{ color: '#f5222d' }}
                  prefix={<FallOutlined />}
                  suffix="%"
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic title="订阅用户" value={strategy.subscribersCount} suffix="人" />
              </Card>
            </Col>
          </Row>

          {/* 详细信息 */}
          <Card title="策略信息">
            <Descriptions column={2}>
              <Descriptions.Item label="策略ID">{strategy.id}</Descriptions.Item>
              <Descriptions.Item label="策略名称">{strategy.name}</Descriptions.Item>
              <Descriptions.Item label="Freqtrade ID">{strategy.freqtradeId}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={statusConfig[String(strategy.isActive)]?.color || 'default'}>
                  {statusConfig[String(strategy.isActive)]?.label || '未知'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="风险等级">
                <Tag color={riskConfig[strategy.riskLevel]?.color || 'default'}>
                  {riskConfig[strategy.riskLevel]?.label || strategy.riskLevel}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="首页推荐">
                <Tag color={strategy.isFeatured ? 'blue' : 'default'}>
                  {strategy.isFeatured ? '是' : '否'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="标签">
                {strategy.tags && strategy.tags.length > 0 ? (
                  <Space>
                    {strategy.tags.map((tag, idx) => (
                      <Tag key={idx}>{tag}</Tag>
                    ))}
                  </Space>
                ) : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="排序权重">{strategy.sortOrder}</Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {new Date(strategy.createdAt).toLocaleString('zh-CN')}
              </Descriptions.Item>
              <Descriptions.Item label="更新时间">
                {new Date(strategy.updatedAt).toLocaleString('zh-CN')}
              </Descriptions.Item>
              <Descriptions.Item label="策略描述" span={2}>
                {strategy.description || '-'}
              </Descriptions.Item>
            </Descriptions>
          </Card>

          {/* 交易统计 */}
          <Card title="交易统计">
            <Row gutter={16}>
              <Col span={6}>
                <Statistic title="总交易次数" value={strategy.totalTrades} />
              </Col>
              <Col span={6}>
                <Statistic
                  title="胜率"
                  value={strategy.winRate ? parseFloat(strategy.winRate) : 0}
                  suffix="%"
                  precision={1}
                />
              </Col>
              <Col span={6}>
                <Statistic title="信号数量" value={strategy.signalsCount} />
              </Col>
              <Col span={6}>
                <Statistic
                  title="90天收益率"
                  value={strategy.return90d ? parseFloat(strategy.return90d) : 0}
                  suffix="%"
                  precision={2}
                  valueStyle={{ color: parseFloat(strategy.return90d || '0') >= 0 ? '#52c41a' : '#f5222d' }}
                />
              </Col>
            </Row>
          </Card>
        </Space>
      ),
    },
    {
      key: 'subscribers',
      label: (
        <span>
          <UserOutlined />
          订阅用户 ({strategy.subscribersCount})
        </span>
      ),
      children: strategy.subscribers && strategy.subscribers.length > 0 ? (
        <Table
          dataSource={strategy.subscribers}
          columns={subscriberColumns}
          rowKey="id"
          pagination={{ pageSize: 10 }}
        />
      ) : (
        <Empty description="暂无订阅用户" />
      ),
    },
    {
      key: 'signals',
      label: (
        <span>
          <HistoryOutlined />
          信号记录
        </span>
      ),
      children: strategy.recentSignals && strategy.recentSignals.length > 0 ? (
        <Table
          dataSource={strategy.recentSignals}
          columns={signalColumns}
          rowKey="id"
          pagination={{ pageSize: 20 }}
        />
      ) : (
        <Empty description="暂无信号记录" />
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
          onClick={() => navigate(`/strategies/${id}/edit`)}
        >
          编辑
        </Button>,
      ]}
    >
      <Card>
        <Tabs items={tabItems} />
      </Card>
    </Show>
  );
};
