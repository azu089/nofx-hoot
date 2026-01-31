/**
 * 策略详情页面
 * 查看策略完整信息、订阅用户、交易记录
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
  Timeline,
  Avatar,
} from 'antd';
import {
  RiseOutlined,
  FallOutlined,
  UserOutlined,
  HistoryOutlined,
  LineChartOutlined,
  DollarOutlined,
} from '@ant-design/icons';
const { Text } = Typography;

// 模拟策略详情数据
const mockStrategy = {
  id: '1',
  name: 'AI量化策略Alpha',
  creator: 'official',
  type: 'ai',
  tradingPair: 'BTC/USDT',
  status: 'active',
  subscribers: 156,
  totalReturn: '+245.6%',
  monthReturn: '+12.5%',
  weekReturn: '+3.2%',
  maxDrawdown: '-8.2%',
  winRate: '68.5%',
  monthlyFee: '25',
  description:
    'AI 驱动的量化交易策略，基于深度学习模型分析市场趋势，自动执行买卖操作。适合追求稳健收益的投资者。',
  riskLevel: 'medium',
  minCapital: 500,
  maxCapital: 50000,
  createdAt: '2024-06-01',
  updatedAt: '2025-01-30',
  totalTrades: 1256,
  avgHoldingTime: '4.2小时',
  sharpeRatio: '2.35',
  profitFactor: '1.85',
};

// 模拟订阅用户数据
const mockSubscribers = [
  {
    id: '1',
    username: 'trader_001',
    email: 'user1@example.com',
    subscribedAt: '2024-12-01',
    capital: '5000 USDT',
    pnl: '+650.00',
    status: 'active',
  },
  {
    id: '2',
    username: 'crypto_whale',
    email: 'user2@example.com',
    subscribedAt: '2024-12-15',
    capital: '20000 USDT',
    pnl: '+2100.00',
    status: 'active',
  },
  {
    id: '3',
    username: 'newbie_2024',
    email: 'user3@example.com',
    subscribedAt: '2025-01-10',
    capital: '1000 USDT',
    pnl: '+85.00',
    status: 'active',
  },
];

// 模拟交易记录
const mockTrades = [
  {
    id: '1',
    time: '2025-01-30 14:32:15',
    pair: 'BTC/USDT',
    side: 'buy',
    price: '42150.00',
    amount: '0.05',
    total: '2107.50',
    status: 'filled',
  },
  {
    id: '2',
    time: '2025-01-30 10:15:42',
    pair: 'BTC/USDT',
    side: 'sell',
    price: '42380.00',
    amount: '0.05',
    total: '2119.00',
    pnl: '+11.50',
    status: 'filled',
  },
  {
    id: '3',
    time: '2025-01-29 22:45:18',
    pair: 'BTC/USDT',
    side: 'buy',
    price: '41950.00',
    amount: '0.08',
    total: '3356.00',
    status: 'filled',
  },
];

// 模拟操作日志
const mockLogs = [
  { time: '2025-01-30 14:32:15', action: '执行买入信号', detail: 'BTC/USDT 0.05 @ 42150' },
  { time: '2025-01-30 10:15:42', action: '执行卖出信号', detail: 'BTC/USDT 0.05 @ 42380' },
  { time: '2025-01-29 22:45:18', action: '执行买入信号', detail: 'BTC/USDT 0.08 @ 41950' },
  { time: '2025-01-28 09:00:00', action: '策略参数更新', detail: '止损比例调整为 3%' },
  { time: '2025-01-25 15:30:00', action: '新用户订阅', detail: 'newbie_2024 订阅策略' },
];

export const StrategyShow = () => {
  const statusConfig = {
    draft: { color: 'default', label: '草稿' },
    pending: { color: 'processing', label: '审核中' },
    active: { color: 'success', label: '运行中' },
    paused: { color: 'warning', label: '已暂停' },
    offline: { color: 'error', label: '已下架' },
  };

  const typeConfig = {
    ai: { color: 'purple', label: 'AI策略' },
    manual: { color: 'blue', label: '手动策略' },
    quant: { color: 'cyan', label: '量化策略' },
  };

  const riskConfig = {
    low: { color: 'green', label: '低风险' },
    medium: { color: 'orange', label: '中风险' },
    high: { color: 'red', label: '高风险' },
  };

  const subscriberColumns = [
    { title: '用户ID', dataIndex: 'id', key: 'id', width: 80 },
    {
      title: '用户',
      key: 'user',
      render: (_: unknown, record: (typeof mockSubscribers)[0]) => (
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
    { title: '订阅时间', dataIndex: 'subscribedAt', key: 'subscribedAt' },
    { title: '跟单资金', dataIndex: 'capital', key: 'capital' },
    {
      title: '盈亏',
      dataIndex: 'pnl',
      key: 'pnl',
      render: (value: string) => (
        <span style={{ color: value.startsWith('+') ? '#52c41a' : '#f5222d' }}>
          {value} USDT
        </span>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'active' ? 'green' : 'default'}>
          {status === 'active' ? '跟单中' : '已停止'}
        </Tag>
      ),
    },
  ];

  const tradeColumns = [
    { title: '时间', dataIndex: 'time', key: 'time', width: 180 },
    { title: '交易对', dataIndex: 'pair', key: 'pair', width: 100 },
    {
      title: '方向',
      dataIndex: 'side',
      key: 'side',
      width: 80,
      render: (side: string) => (
        <Tag color={side === 'buy' ? 'green' : 'red'}>
          {side === 'buy' ? '买入' : '卖出'}
        </Tag>
      ),
    },
    { title: '价格', dataIndex: 'price', key: 'price' },
    { title: '数量', dataIndex: 'amount', key: 'amount' },
    { title: '金额', dataIndex: 'total', key: 'total' },
    {
      title: '盈亏',
      dataIndex: 'pnl',
      key: 'pnl',
      render: (value: string) =>
        value ? (
          <span style={{ color: value.startsWith('+') ? '#52c41a' : '#f5222d' }}>
            {value}
          </span>
        ) : (
          '-'
        ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: () => <Tag color="green">已成交</Tag>,
    },
  ];

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
                  title="累计收益率"
                  value={mockStrategy.totalReturn}
                  valueStyle={{ color: '#52c41a' }}
                  prefix={<RiseOutlined />}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="本月收益率"
                  value={mockStrategy.monthReturn}
                  valueStyle={{ color: '#52c41a' }}
                  prefix={<RiseOutlined />}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="最大回撤"
                  value={mockStrategy.maxDrawdown}
                  valueStyle={{ color: '#f5222d' }}
                  prefix={<FallOutlined />}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic title="订阅用户" value={mockStrategy.subscribers} suffix="人" />
              </Card>
            </Col>
          </Row>

          {/* 详细信息 */}
          <Card title="策略信息">
            <Descriptions column={2}>
              <Descriptions.Item label="策略ID">{mockStrategy.id}</Descriptions.Item>
              <Descriptions.Item label="策略名称">{mockStrategy.name}</Descriptions.Item>
              <Descriptions.Item label="创建者">{mockStrategy.creator}</Descriptions.Item>
              <Descriptions.Item label="类型">
                <Tag color={typeConfig[mockStrategy.type as keyof typeof typeConfig].color}>
                  {typeConfig[mockStrategy.type as keyof typeof typeConfig].label}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="交易对">{mockStrategy.tradingPair}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={statusConfig[mockStrategy.status as keyof typeof statusConfig].color}>
                  {statusConfig[mockStrategy.status as keyof typeof statusConfig].label}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="风险等级">
                <Tag color={riskConfig[mockStrategy.riskLevel as keyof typeof riskConfig].color}>
                  {riskConfig[mockStrategy.riskLevel as keyof typeof riskConfig].label}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="月费">{mockStrategy.monthlyFee} USDT</Descriptions.Item>
              <Descriptions.Item label="最小资金">{mockStrategy.minCapital} USDT</Descriptions.Item>
              <Descriptions.Item label="最大资金">{mockStrategy.maxCapital} USDT</Descriptions.Item>
              <Descriptions.Item label="创建时间">{mockStrategy.createdAt}</Descriptions.Item>
              <Descriptions.Item label="更新时间">{mockStrategy.updatedAt}</Descriptions.Item>
              <Descriptions.Item label="策略描述" span={2}>
                {mockStrategy.description}
              </Descriptions.Item>
            </Descriptions>
          </Card>

          {/* 交易统计 */}
          <Card title="交易统计">
            <Row gutter={16}>
              <Col span={6}>
                <Statistic title="总交易次数" value={mockStrategy.totalTrades} />
              </Col>
              <Col span={6}>
                <Statistic title="胜率" value={mockStrategy.winRate} />
              </Col>
              <Col span={6}>
                <Statistic title="平均持仓时间" value={mockStrategy.avgHoldingTime} />
              </Col>
              <Col span={6}>
                <Statistic title="夏普比率" value={mockStrategy.sharpeRatio} />
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
          订阅用户 ({mockStrategy.subscribers})
        </span>
      ),
      children: (
        <Table
          dataSource={mockSubscribers}
          columns={subscriberColumns}
          rowKey="id"
          pagination={{ pageSize: 10 }}
        />
      ),
    },
    {
      key: 'trades',
      label: (
        <span>
          <DollarOutlined />
          交易记录
        </span>
      ),
      children: (
        <Table
          dataSource={mockTrades}
          columns={tradeColumns}
          rowKey="id"
          pagination={{ pageSize: 20 }}
        />
      ),
    },
    {
      key: 'logs',
      label: (
        <span>
          <HistoryOutlined />
          操作日志
        </span>
      ),
      children: (
        <Card>
          <Timeline
            items={mockLogs.map((log) => ({
              children: (
                <div>
                  <Text strong>{log.action}</Text>
                  <br />
                  <Text type="secondary">{log.detail}</Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {log.time}
                  </Text>
                </div>
              ),
            }))}
          />
        </Card>
      ),
    },
  ];

  return (
    <Show>
      <Card>
        <Tabs items={tabItems} />
      </Card>
    </Show>
  );
};
