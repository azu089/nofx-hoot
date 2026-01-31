/**
 * 持仓管理页面
 * 全平台持仓汇总
 */
import {
  Card,
  Row,
  Col,
  Table,
  Tag,
  Space,
  Typography,
  Button,
  Input,
  Select,
  Statistic,
  Progress,
  Modal,
  Descriptions,
  message,
} from 'antd';
import {
  SearchOutlined,
  DownloadOutlined,
  EyeOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  DollarOutlined,
  StockOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useState } from 'react';

const { Title, Text } = Typography;

interface IPosition {
  id: string;
  userId: string;
  username: string;
  strategyId: string;
  strategyName: string;
  exchange: string;
  symbol: string;
  side: 'long' | 'short';
  size: string;
  entryPrice: string;
  currentPrice: string;
  unrealizedPnl: string;
  unrealizedPnlPercent: string;
  stopLoss?: string;
  takeProfit?: string;
  leverage: number;
  margin: string;
  liquidationPrice?: string;
  openedAt: string;
  status: 'open' | 'closing';
}

// 模拟持仓数据
const mockPositions: IPosition[] = [
  {
    id: 'POS001',
    userId: 'U001',
    username: '张三',
    strategyId: 'S001',
    strategyName: 'BTC 趋势追踪',
    exchange: 'Binance',
    symbol: 'BTC/USDT',
    side: 'long',
    size: '0.1',
    entryPrice: '42000.00',
    currentPrice: '42500.00',
    unrealizedPnl: '+50.00',
    unrealizedPnlPercent: '+1.19%',
    stopLoss: '41000.00',
    takeProfit: '45000.00',
    leverage: 5,
    margin: '840.00',
    liquidationPrice: '38000.00',
    openedAt: '2025-01-30 10:00:00',
    status: 'open',
  },
  {
    id: 'POS002',
    userId: 'U002',
    username: '李四',
    strategyId: 'S001',
    strategyName: 'BTC 趋势追踪',
    exchange: 'OKX',
    symbol: 'BTC/USDT',
    side: 'long',
    size: '0.05',
    entryPrice: '42100.00',
    currentPrice: '42500.00',
    unrealizedPnl: '+20.00',
    unrealizedPnlPercent: '+0.95%',
    stopLoss: '41100.00',
    takeProfit: '45000.00',
    leverage: 3,
    margin: '701.67',
    openedAt: '2025-01-30 10:05:00',
    status: 'open',
  },
  {
    id: 'POS003',
    userId: 'U003',
    username: '王五',
    strategyId: 'S002',
    strategyName: 'ETH 网格策略',
    exchange: 'Binance',
    symbol: 'ETH/USDT',
    side: 'long',
    size: '2',
    entryPrice: '2300.00',
    currentPrice: '2280.00',
    unrealizedPnl: '-40.00',
    unrealizedPnlPercent: '-0.87%',
    stopLoss: '2200.00',
    takeProfit: '2500.00',
    leverage: 2,
    margin: '2300.00',
    openedAt: '2025-01-30 08:00:00',
    status: 'open',
  },
  {
    id: 'POS004',
    userId: 'U004',
    username: '赵六',
    strategyId: 'S003',
    strategyName: 'SOL 波段策略',
    exchange: 'Bybit',
    symbol: 'SOL/USDT',
    side: 'short',
    size: '50',
    entryPrice: '98.50',
    currentPrice: '97.00',
    unrealizedPnl: '+75.00',
    unrealizedPnlPercent: '+1.52%',
    stopLoss: '102.00',
    takeProfit: '90.00',
    leverage: 10,
    margin: '492.50',
    liquidationPrice: '108.00',
    openedAt: '2025-01-30 12:00:00',
    status: 'open',
  },
  {
    id: 'POS005',
    userId: 'U001',
    username: '张三',
    strategyId: 'S002',
    strategyName: 'ETH 网格策略',
    exchange: 'Binance',
    symbol: 'ETH/USDT',
    side: 'long',
    size: '1',
    entryPrice: '2250.00',
    currentPrice: '2280.00',
    unrealizedPnl: '+30.00',
    unrealizedPnlPercent: '+1.33%',
    leverage: 1,
    margin: '2250.00',
    openedAt: '2025-01-30 09:00:00',
    status: 'open',
  },
];

export const PositionsPage = () => {
  const [positions] = useState(mockPositions);
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<IPosition | null>(null);
  const [filters, setFilters] = useState({
    search: '',
    exchange: '',
    symbol: '',
    side: '',
  });

  const columns = [
    { title: '持仓ID', dataIndex: 'id', key: 'id', width: 90 },
    {
      title: '用户',
      key: 'user',
      width: 120,
      render: (_: unknown, record: IPosition) => (
        <Space direction="vertical" size={0}>
          <Text strong>{record.username}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.userId}</Text>
        </Space>
      ),
    },
    { title: '策略', dataIndex: 'strategyName', key: 'strategyName', width: 140 },
    { title: '交易所', dataIndex: 'exchange', key: 'exchange', render: (e: string) => <Tag>{e}</Tag>, width: 90 },
    { title: '交易对', dataIndex: 'symbol', key: 'symbol', width: 100 },
    {
      title: '方向',
      dataIndex: 'side',
      key: 'side',
      width: 80,
      render: (side: string) => (
        <Tag color={side === 'long' ? 'green' : 'red'} icon={side === 'long' ? <ArrowUpOutlined /> : <ArrowDownOutlined />}>
          {side === 'long' ? '做多' : '做空'}
        </Tag>
      ),
    },
    { title: '持仓量', dataIndex: 'size', key: 'size', width: 80 },
    {
      title: '开仓价',
      dataIndex: 'entryPrice',
      key: 'entryPrice',
      width: 100,
      render: (price: string) => `$${price}`,
    },
    {
      title: '当前价',
      dataIndex: 'currentPrice',
      key: 'currentPrice',
      width: 100,
      render: (price: string) => `$${price}`,
    },
    {
      title: '未实现盈亏',
      key: 'pnl',
      width: 140,
      render: (_: unknown, record: IPosition) => {
        const isProfit = record.unrealizedPnl.startsWith('+');
        return (
          <Space direction="vertical" size={0}>
            <Text type={isProfit ? 'success' : 'danger'} strong>
              {record.unrealizedPnl} USDT
            </Text>
            <Text type={isProfit ? 'success' : 'danger'} style={{ fontSize: 12 }}>
              {record.unrealizedPnlPercent}
            </Text>
          </Space>
        );
      },
    },
    {
      title: '杠杆',
      dataIndex: 'leverage',
      key: 'leverage',
      width: 70,
      render: (lev: number) => <Tag color={lev >= 10 ? 'red' : lev >= 5 ? 'orange' : 'default'}>{lev}x</Tag>,
    },
    { title: '保证金', dataIndex: 'margin', key: 'margin', width: 100, render: (m: string) => `$${m}` },
    { title: '开仓时间', dataIndex: 'openedAt', key: 'openedAt', width: 150 },
    {
      title: '操作',
      key: 'action',
      width: 80,
      render: (_: unknown, record: IPosition) => (
        <Button
          type="link"
          icon={<EyeOutlined />}
          onClick={() => {
            setSelectedPosition(record);
            setDetailVisible(true);
          }}
        >
          详情
        </Button>
      ),
    },
  ];

  // 过滤持仓
  const filteredPositions = positions.filter(pos => {
    if (filters.search && !pos.username.includes(filters.search) && !pos.id.includes(filters.search)) {
      return false;
    }
    if (filters.exchange && pos.exchange !== filters.exchange) return false;
    if (filters.symbol && pos.symbol !== filters.symbol) return false;
    if (filters.side && pos.side !== filters.side) return false;
    return true;
  });

  // 统计数据
  const totalPositions = positions.length;
  const totalMargin = positions.reduce((sum, p) => sum + parseFloat(p.margin), 0);
  const totalUnrealizedPnl = positions.reduce((sum, p) => sum + parseFloat(p.unrealizedPnl), 0);
  const profitPositions = positions.filter(p => p.unrealizedPnl.startsWith('+')).length;
  const winRate = (profitPositions / totalPositions * 100).toFixed(1);

  // 按交易对汇总
  const symbolSummary = positions.reduce((acc, p) => {
    if (!acc[p.symbol]) {
      acc[p.symbol] = { count: 0, margin: 0, pnl: 0 };
    }
    acc[p.symbol].count++;
    acc[p.symbol].margin += parseFloat(p.margin);
    acc[p.symbol].pnl += parseFloat(p.unrealizedPnl);
    return acc;
  }, {} as Record<string, { count: number; margin: number; pnl: number }>);

  return (
    <div style={{ padding: 24 }}>
      <Title level={4} style={{ marginBottom: 24 }}>持仓管理</Title>

      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginTop: 24, marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="持仓数量"
              value={totalPositions}
              prefix={<StockOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="总保证金"
              value={totalMargin.toFixed(2)}
              prefix={<DollarOutlined />}
              suffix="USDT"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="未实现盈亏"
              value={totalUnrealizedPnl.toFixed(2)}
              valueStyle={{ color: totalUnrealizedPnl >= 0 ? '#52c41a' : '#f5222d' }}
              prefix={totalUnrealizedPnl >= 0 ? '+' : ''}
              suffix="USDT"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="盈利比例"
              value={winRate}
              suffix="%"
              valueStyle={{ color: parseFloat(winRate) >= 50 ? '#52c41a' : '#f5222d' }}
            />
            <Progress
              percent={parseFloat(winRate)}
              showInfo={false}
              strokeColor={parseFloat(winRate) >= 50 ? '#52c41a' : '#f5222d'}
              size="small"
            />
          </Card>
        </Col>
      </Row>

      {/* 按交易对汇总 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        {Object.entries(symbolSummary).map(([symbol, data]) => (
          <Col span={6} key={symbol}>
            <Card size="small">
              <Space direction="vertical" style={{ width: '100%' }}>
                <Text strong>{symbol}</Text>
                <Space>
                  <Tag icon={<UserOutlined />}>{data.count} 个持仓</Tag>
                  <Text type={data.pnl >= 0 ? 'success' : 'danger'}>
                    {data.pnl >= 0 ? '+' : ''}{data.pnl.toFixed(2)} USDT
                  </Text>
                </Space>
              </Space>
            </Card>
          </Col>
        ))}
      </Row>

      {/* 筛选栏 */}
      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input
            placeholder="搜索用户/持仓ID"
            prefix={<SearchOutlined />}
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            style={{ width: 200 }}
          />
          <Select
            placeholder="交易所"
            value={filters.exchange || undefined}
            onChange={(value) => setFilters({ ...filters, exchange: value })}
            style={{ width: 120 }}
            allowClear
            options={[
              { value: 'Binance', label: 'Binance' },
              { value: 'OKX', label: 'OKX' },
              { value: 'Bybit', label: 'Bybit' },
            ]}
          />
          <Select
            placeholder="交易对"
            value={filters.symbol || undefined}
            onChange={(value) => setFilters({ ...filters, symbol: value })}
            style={{ width: 120 }}
            allowClear
            options={[
              { value: 'BTC/USDT', label: 'BTC/USDT' },
              { value: 'ETH/USDT', label: 'ETH/USDT' },
              { value: 'SOL/USDT', label: 'SOL/USDT' },
            ]}
          />
          <Select
            placeholder="方向"
            value={filters.side || undefined}
            onChange={(value) => setFilters({ ...filters, side: value })}
            style={{ width: 100 }}
            allowClear
            options={[
              { value: 'long', label: '做多' },
              { value: 'short', label: '做空' },
            ]}
          />
          <Button icon={<DownloadOutlined />} onClick={() => message.success('导出成功')}>
            导出
          </Button>
        </Space>
      </Card>

      {/* 持仓列表 */}
      <Card>
        <Table
          dataSource={filteredPositions}
          columns={columns}
          rowKey="id"
          pagination={{ pageSize: 20, showTotal: (total) => `共 ${total} 条` }}
          scroll={{ x: 1600 }}
        />
      </Card>

      {/* 持仓详情弹窗 */}
      <Modal
        title="持仓详情"
        open={detailVisible}
        onCancel={() => {
          setDetailVisible(false);
          setSelectedPosition(null);
        }}
        footer={null}
        width={700}
      >
        {selectedPosition && (
          <Descriptions bordered column={2}>
            <Descriptions.Item label="持仓ID">{selectedPosition.id}</Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color="success">持仓中</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="用户">{selectedPosition.username} ({selectedPosition.userId})</Descriptions.Item>
            <Descriptions.Item label="策略">{selectedPosition.strategyName}</Descriptions.Item>
            <Descriptions.Item label="交易所">{selectedPosition.exchange}</Descriptions.Item>
            <Descriptions.Item label="交易对">{selectedPosition.symbol}</Descriptions.Item>
            <Descriptions.Item label="方向">
              <Tag color={selectedPosition.side === 'long' ? 'green' : 'red'}>
                {selectedPosition.side === 'long' ? '做多' : '做空'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="杠杆">{selectedPosition.leverage}x</Descriptions.Item>
            <Descriptions.Item label="持仓量">{selectedPosition.size}</Descriptions.Item>
            <Descriptions.Item label="保证金">${selectedPosition.margin}</Descriptions.Item>
            <Descriptions.Item label="开仓价">${selectedPosition.entryPrice}</Descriptions.Item>
            <Descriptions.Item label="当前价">${selectedPosition.currentPrice}</Descriptions.Item>
            <Descriptions.Item label="未实现盈亏">
              <Text type={selectedPosition.unrealizedPnl.startsWith('+') ? 'success' : 'danger'} strong>
                {selectedPosition.unrealizedPnl} USDT ({selectedPosition.unrealizedPnlPercent})
              </Text>
            </Descriptions.Item>
            {selectedPosition.liquidationPrice && (
              <Descriptions.Item label="强平价">
                <Text type="danger">${selectedPosition.liquidationPrice}</Text>
              </Descriptions.Item>
            )}
            {selectedPosition.stopLoss && (
              <Descriptions.Item label="止损价">${selectedPosition.stopLoss}</Descriptions.Item>
            )}
            {selectedPosition.takeProfit && (
              <Descriptions.Item label="止盈价">${selectedPosition.takeProfit}</Descriptions.Item>
            )}
            <Descriptions.Item label="开仓时间" span={2}>{selectedPosition.openedAt}</Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
};
