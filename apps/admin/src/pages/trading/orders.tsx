/**
 * 订单管理页面
 * 信号执行订单记录
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
  DatePicker,
  Statistic,
  Modal,
  Descriptions,
  message,
} from 'antd';
import {
  SearchOutlined,
  DownloadOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  SwapOutlined,
} from '@ant-design/icons';
import { useState } from 'react';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

interface IOrder {
  id: string;
  userId: string;
  username: string;
  strategyId: string;
  strategyName: string;
  exchange: string;
  symbol: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit';
  amount: string;
  price: string;
  filledAmount: string;
  filledPrice: string;
  status: 'pending' | 'filled' | 'partial' | 'cancelled' | 'failed';
  signalPrice: string;
  slippage: string;
  fee: string;
  pnl?: string;
  createdAt: string;
  filledAt?: string;
  errorMsg?: string;
}

// 模拟订单数据
const mockOrders: IOrder[] = [
  {
    id: 'ORD001',
    userId: 'U001',
    username: '张三',
    strategyId: 'S001',
    strategyName: 'BTC 趋势追踪',
    exchange: 'Binance',
    symbol: 'BTC/USDT',
    side: 'buy',
    type: 'market',
    amount: '0.01',
    price: '42150.00',
    filledAmount: '0.01',
    filledPrice: '42155.50',
    status: 'filled',
    signalPrice: '42150.00',
    slippage: '0.013%',
    fee: '0.42',
    createdAt: '2025-01-30 14:25:00',
    filledAt: '2025-01-30 14:25:02',
  },
  {
    id: 'ORD002',
    userId: 'U002',
    username: '李四',
    strategyId: 'S001',
    strategyName: 'BTC 趋势追踪',
    exchange: 'OKX',
    symbol: 'BTC/USDT',
    side: 'buy',
    type: 'market',
    amount: '0.02',
    price: '42150.00',
    filledAmount: '0.02',
    filledPrice: '42160.00',
    status: 'filled',
    signalPrice: '42150.00',
    slippage: '0.024%',
    fee: '0.84',
    createdAt: '2025-01-30 14:25:00',
    filledAt: '2025-01-30 14:25:03',
  },
  {
    id: 'ORD003',
    userId: 'U003',
    username: '王五',
    strategyId: 'S002',
    strategyName: 'ETH 网格策略',
    exchange: 'Binance',
    symbol: 'ETH/USDT',
    side: 'sell',
    type: 'limit',
    amount: '0.5',
    price: '2250.00',
    filledAmount: '0.3',
    filledPrice: '2250.00',
    status: 'partial',
    signalPrice: '2250.00',
    slippage: '0%',
    fee: '0.34',
    createdAt: '2025-01-30 14:20:00',
  },
  {
    id: 'ORD004',
    userId: 'U004',
    username: '赵六',
    strategyId: 'S001',
    strategyName: 'BTC 趋势追踪',
    exchange: 'Bybit',
    symbol: 'BTC/USDT',
    side: 'buy',
    type: 'market',
    amount: '0.01',
    price: '42150.00',
    filledAmount: '0',
    filledPrice: '0',
    status: 'failed',
    signalPrice: '42150.00',
    slippage: '-',
    fee: '0',
    createdAt: '2025-01-30 14:25:00',
    errorMsg: 'Insufficient balance',
  },
  {
    id: 'ORD005',
    userId: 'U001',
    username: '张三',
    strategyId: 'S001',
    strategyName: 'BTC 趋势追踪',
    exchange: 'Binance',
    symbol: 'BTC/USDT',
    side: 'sell',
    type: 'market',
    amount: '0.01',
    price: '42500.00',
    filledAmount: '0.01',
    filledPrice: '42495.00',
    status: 'filled',
    signalPrice: '42500.00',
    slippage: '-0.012%',
    fee: '0.42',
    pnl: '+34.50',
    createdAt: '2025-01-30 16:30:00',
    filledAt: '2025-01-30 16:30:01',
  },
];

export const OrdersPage = () => {
  const [orders] = useState(mockOrders);
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<IOrder | null>(null);
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    exchange: '',
    side: '',
  });

  const statusMap: Record<string, { color: string; text: string; icon: React.ReactNode }> = {
    pending: { color: 'processing', text: '待执行', icon: <ClockCircleOutlined /> },
    filled: { color: 'success', text: '已成交', icon: <CheckCircleOutlined /> },
    partial: { color: 'warning', text: '部分成交', icon: <SwapOutlined /> },
    cancelled: { color: 'default', text: '已取消', icon: <CloseCircleOutlined /> },
    failed: { color: 'error', text: '失败', icon: <CloseCircleOutlined /> },
  };

  const columns = [
    { title: '订单ID', dataIndex: 'id', key: 'id', width: 100 },
    {
      title: '用户',
      key: 'user',
      render: (_: unknown, record: IOrder) => (
        <Space direction="vertical" size={0}>
          <Text strong>{record.username}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.userId}</Text>
        </Space>
      ),
    },
    { title: '策略', dataIndex: 'strategyName', key: 'strategyName' },
    { title: '交易所', dataIndex: 'exchange', key: 'exchange', render: (e: string) => <Tag>{e}</Tag> },
    { title: '交易对', dataIndex: 'symbol', key: 'symbol' },
    {
      title: '方向',
      dataIndex: 'side',
      key: 'side',
      render: (side: string) => (
        <Tag color={side === 'buy' ? 'green' : 'red'}>
          {side === 'buy' ? '买入' : '卖出'}
        </Tag>
      ),
    },
    {
      title: '数量',
      key: 'amount',
      render: (_: unknown, record: IOrder) => (
        <Space direction="vertical" size={0}>
          <Text>{record.filledAmount} / {record.amount}</Text>
          {record.status === 'partial' && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {((parseFloat(record.filledAmount) / parseFloat(record.amount)) * 100).toFixed(1)}%
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: '成交价',
      dataIndex: 'filledPrice',
      key: 'filledPrice',
      render: (price: string) => price !== '0' ? `$${price}` : '-',
    },
    {
      title: '滑点',
      dataIndex: 'slippage',
      key: 'slippage',
      render: (slippage: string) => {
        if (slippage === '-') return '-';
        const value = parseFloat(slippage);
        return (
          <Text type={value > 0.1 ? 'danger' : value > 0.05 ? 'warning' : 'success'}>
            {slippage}
          </Text>
        );
      },
    },
    {
      title: '盈亏',
      dataIndex: 'pnl',
      key: 'pnl',
      render: (pnl: string) => {
        if (!pnl) return '-';
        const isProfit = pnl.startsWith('+');
        return <Text type={isProfit ? 'success' : 'danger'}>{pnl} USDT</Text>;
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag icon={statusMap[status].icon} color={statusMap[status].color}>
          {statusMap[status].text}
        </Tag>
      ),
    },
    { title: '时间', dataIndex: 'createdAt', key: 'createdAt', width: 160 },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record: IOrder) => (
        <Button
          type="link"
          icon={<EyeOutlined />}
          onClick={() => {
            setSelectedOrder(record);
            setDetailVisible(true);
          }}
        >
          详情
        </Button>
      ),
    },
  ];

  // 过滤后的订单
  const filteredOrders = orders.filter(order => {
    if (filters.search && !order.username.includes(filters.search) && !order.id.includes(filters.search)) {
      return false;
    }
    if (filters.status && order.status !== filters.status) return false;
    if (filters.exchange && order.exchange !== filters.exchange) return false;
    if (filters.side && order.side !== filters.side) return false;
    return true;
  });

  // 统计数据
  const filledOrders = orders.filter(o => o.status === 'filled').length;
  const totalVolume = orders
    .filter(o => o.status === 'filled')
    .reduce((sum, o) => sum + parseFloat(o.filledPrice) * parseFloat(o.filledAmount), 0);
  const avgSlippage = orders
    .filter(o => o.status === 'filled' && o.slippage !== '-')
    .reduce((sum, o, _, arr) => sum + parseFloat(o.slippage) / arr.length, 0);

  return (
    <div style={{ padding: 24 }}>
      <Title level={4} style={{ marginBottom: 24 }}>订单管理</Title>

      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginTop: 24, marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="今日订单数"
              value={orders.length}
              prefix={<SwapOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="成交率"
              value={((filledOrders / orders.length) * 100).toFixed(1)}
              suffix="%"
              valueStyle={{ color: '#52c41a' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="成交金额"
              value={totalVolume.toFixed(2)}
              prefix="$"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="平均滑点"
              value={avgSlippage.toFixed(3)}
              suffix="%"
              valueStyle={{ color: avgSlippage > 0.1 ? '#f5222d' : '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 筛选栏 */}
      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input
            placeholder="搜索用户/订单ID"
            prefix={<SearchOutlined />}
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            style={{ width: 200 }}
          />
          <Select
            placeholder="订单状态"
            value={filters.status || undefined}
            onChange={(value) => setFilters({ ...filters, status: value })}
            style={{ width: 120 }}
            allowClear
            options={[
              { value: 'pending', label: '待执行' },
              { value: 'filled', label: '已成交' },
              { value: 'partial', label: '部分成交' },
              { value: 'failed', label: '失败' },
            ]}
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
            placeholder="方向"
            value={filters.side || undefined}
            onChange={(value) => setFilters({ ...filters, side: value })}
            style={{ width: 100 }}
            allowClear
            options={[
              { value: 'buy', label: '买入' },
              { value: 'sell', label: '卖出' },
            ]}
          />
          <RangePicker />
          <Button icon={<DownloadOutlined />} onClick={() => message.success('导出成功')}>
            导出
          </Button>
        </Space>
      </Card>

      {/* 订单列表 */}
      <Card>
        <Table
          dataSource={filteredOrders}
          columns={columns}
          rowKey="id"
          pagination={{ pageSize: 20, showTotal: (total) => `共 ${total} 条` }}
          scroll={{ x: 1400 }}
        />
      </Card>

      {/* 订单详情弹窗 */}
      <Modal
        title="订单详情"
        open={detailVisible}
        onCancel={() => {
          setDetailVisible(false);
          setSelectedOrder(null);
        }}
        footer={null}
        width={700}
      >
        {selectedOrder && (
          <Descriptions bordered column={2}>
            <Descriptions.Item label="订单ID">{selectedOrder.id}</Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag icon={statusMap[selectedOrder.status].icon} color={statusMap[selectedOrder.status].color}>
                {statusMap[selectedOrder.status].text}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="用户">{selectedOrder.username} ({selectedOrder.userId})</Descriptions.Item>
            <Descriptions.Item label="策略">{selectedOrder.strategyName}</Descriptions.Item>
            <Descriptions.Item label="交易所">{selectedOrder.exchange}</Descriptions.Item>
            <Descriptions.Item label="交易对">{selectedOrder.symbol}</Descriptions.Item>
            <Descriptions.Item label="方向">
              <Tag color={selectedOrder.side === 'buy' ? 'green' : 'red'}>
                {selectedOrder.side === 'buy' ? '买入' : '卖出'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="订单类型">{selectedOrder.type === 'market' ? '市价单' : '限价单'}</Descriptions.Item>
            <Descriptions.Item label="委托数量">{selectedOrder.amount}</Descriptions.Item>
            <Descriptions.Item label="成交数量">{selectedOrder.filledAmount}</Descriptions.Item>
            <Descriptions.Item label="信号价格">${selectedOrder.signalPrice}</Descriptions.Item>
            <Descriptions.Item label="成交价格">{selectedOrder.filledPrice !== '0' ? `$${selectedOrder.filledPrice}` : '-'}</Descriptions.Item>
            <Descriptions.Item label="滑点">{selectedOrder.slippage}</Descriptions.Item>
            <Descriptions.Item label="手续费">{selectedOrder.fee} USDT</Descriptions.Item>
            {selectedOrder.pnl && (
              <Descriptions.Item label="盈亏">
                <Text type={selectedOrder.pnl.startsWith('+') ? 'success' : 'danger'}>
                  {selectedOrder.pnl} USDT
                </Text>
              </Descriptions.Item>
            )}
            <Descriptions.Item label="创建时间">{selectedOrder.createdAt}</Descriptions.Item>
            {selectedOrder.filledAt && (
              <Descriptions.Item label="成交时间">{selectedOrder.filledAt}</Descriptions.Item>
            )}
            {selectedOrder.errorMsg && (
              <Descriptions.Item label="错误信息" span={2}>
                <Text type="danger">{selectedOrder.errorMsg}</Text>
              </Descriptions.Item>
            )}
          </Descriptions>
        )}
      </Modal>
    </div>
  );
};
