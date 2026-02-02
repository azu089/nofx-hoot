/**
 * 订单管理页面
 * 连接真实后端 API（信号执行记录）
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
  Modal,
  Descriptions,
  Spin,
} from 'antd';
import { useMessage } from '../../hooks';
import {
  SearchOutlined,
  DownloadOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  SwapOutlined,
  ReloadOutlined,
  LoadingOutlined,
} from '@ant-design/icons';
import { useState, useEffect, useCallback } from 'react';
import { adminApi } from '../../lib/admin-api';

const { Title, Text } = Typography;

interface IOrder {
  id: string;
  signalId: string;
  userId: string;
  username: string;
  strategyId?: string;
  strategyName: string;
  symbol: string;
  side: string;
  signalPrice: string;
  exchange: string;
  orderId?: string;
  executedPrice?: string;
  executedAmount?: string;
  status: string;
  errorCode?: string;
  errorMessage?: string;
  skipReason?: string;
  queuedAt?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
}

interface IStats {
  totalOrders: number;
  todayOrders: number;
  successOrders: number;
  failedOrders: number;
  pendingOrders: number;
  successRate: string;
}

export const OrdersPage = () => {
  const message = useMessage();
  const [dataSource, setDataSource] = useState<IOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<IStats | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<IOrder | null>(null);

  const [filters, setFilters] = useState({
    search: '',
    status: '',
    exchange: '',
  });

  // 加载订单列表
  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(pageSize),
      });
      if (filters.status) params.append('status', filters.status);
      if (filters.exchange) params.append('exchange', filters.exchange);
      if (filters.search) params.append('search', filters.search);

      const response = await adminApi.get<{ items: IOrder[]; total: number }>(`/admin/orders?${params}`);
      if (response.data.code === 0) {
        const data = response.data.data as { items: IOrder[]; total: number };
        setDataSource(data?.items || []);
        setTotal(data?.total || 0);
      } else {
        message.error(response.data.message || '加载失败');
      }
    } catch (error: any) {
      console.error('加载订单列表失败:', error);
      message.error(error.response?.data?.message || '加载订单列表失败');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, filters]);

  // 加载统计数据
  const loadStats = useCallback(async () => {
    try {
      const response = await adminApi.get<IStats>('/admin/orders/stats');
      if (response.data.code === 0) {
        setStats(response.data.data as IStats);
      }
    } catch (error) {
      console.error('加载统计数据失败:', error);
    }
  }, []);

  useEffect(() => {
    loadOrders();
    loadStats();
  }, [loadOrders, loadStats]);

  const handleSearch = () => {
    setPage(1);
    loadOrders();
  };

  const statusMap: Record<string, { color: string; text: string; icon: React.ReactNode }> = {
    pending: { color: 'processing', text: '待执行', icon: <ClockCircleOutlined /> },
    queued: { color: 'processing', text: '排队中', icon: <ClockCircleOutlined /> },
    executing: { color: 'warning', text: '执行中', icon: <LoadingOutlined /> },
    success: { color: 'success', text: '成功', icon: <CheckCircleOutlined /> },
    failed: { color: 'error', text: '失败', icon: <CloseCircleOutlined /> },
    skipped: { color: 'default', text: '跳过', icon: <CloseCircleOutlined /> },
  };

  const skipReasonLabels: Record<string, string> = {
    no_api_key: '未绑定API Key',
    insufficient_balance: '余额不足',
    max_positions: '已达最大持仓数',
  };

  const columns = [
    {
      title: '订单ID',
      dataIndex: 'id',
      key: 'id',
      width: 100,
      ellipsis: true,
      render: (id: string) => (
        <Text style={{ fontFamily: 'monospace' }}>{id.slice(0, 8)}...</Text>
      ),
    },
    {
      title: '用户',
      key: 'user',
      width: 120,
      render: (_: unknown, record: IOrder) => (
        <Space direction="vertical" size={0}>
          <Text strong>{record.username}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.userId.slice(0, 8)}...
          </Text>
        </Space>
      ),
    },
    {
      title: '策略',
      dataIndex: 'strategyName',
      key: 'strategyName',
      width: 140,
    },
    {
      title: '交易所',
      dataIndex: 'exchange',
      key: 'exchange',
      width: 90,
      render: (e: string) => (e !== '-' ? <Tag>{e}</Tag> : '-'),
    },
    {
      title: '交易对',
      dataIndex: 'symbol',
      key: 'symbol',
      width: 100,
    },
    {
      title: '方向',
      dataIndex: 'side',
      key: 'side',
      width: 80,
      render: (side: string) =>
        side !== '-' ? (
          <Tag color={side === 'buy' ? 'green' : 'red'}>
            {side === 'buy' ? '买入' : '卖出'}
          </Tag>
        ) : (
          '-'
        ),
    },
    {
      title: '信号价',
      dataIndex: 'signalPrice',
      key: 'signalPrice',
      width: 100,
      render: (price: string) =>
        price && price !== '0' ? `$${parseFloat(price).toLocaleString()}` : '-',
    },
    {
      title: '成交价',
      dataIndex: 'executedPrice',
      key: 'executedPrice',
      width: 100,
      render: (price: string | null) =>
        price ? `$${parseFloat(price).toLocaleString()}` : '-',
    },
    {
      title: '成交量',
      dataIndex: 'executedAmount',
      key: 'executedAmount',
      width: 100,
      render: (amount: string | null) =>
        amount ? parseFloat(amount).toLocaleString() : '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const config = statusMap[status] || {
          color: 'default',
          text: status,
          icon: null,
        };
        return (
          <Tag icon={config.icon} color={config.color}>
            {config.text}
          </Tag>
        );
      },
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (date: string) => new Date(date).toLocaleString(),
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
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

  // 统计数据
  const totalOrders = stats?.totalOrders || 0;
  const todayOrders = stats?.todayOrders || 0;
  const successRate = parseFloat(stats?.successRate || '0');
  const pendingOrders = stats?.pendingOrders || 0;

  return (
    <div style={{ padding: 24 }}>
      <Title level={4} style={{ marginBottom: 24 }}>
        订单管理
      </Title>

      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginTop: 24, marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="总订单数"
              value={totalOrders}
              prefix={<SwapOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="今日订单"
              value={todayOrders}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="成功率"
              value={successRate}
              suffix="%"
              valueStyle={{ color: successRate >= 80 ? '#52c41a' : '#faad14' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="待处理"
              value={pendingOrders}
              valueStyle={{ color: pendingOrders > 0 ? '#faad14' : '#52c41a' }}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* 筛选栏 */}
      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input
            placeholder="搜索订单ID"
            prefix={<SearchOutlined />}
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            onPressEnter={handleSearch}
            style={{ width: 200 }}
          />
          <Select
            placeholder="订单状态"
            value={filters.status || undefined}
            onChange={(value) => setFilters({ ...filters, status: value || '' })}
            style={{ width: 120 }}
            allowClear
            options={[
              { value: 'pending', label: '待执行' },
              { value: 'queued', label: '排队中' },
              { value: 'executing', label: '执行中' },
              { value: 'success', label: '成功' },
              { value: 'failed', label: '失败' },
              { value: 'skipped', label: '跳过' },
            ]}
          />
          <Select
            placeholder="交易所"
            value={filters.exchange || undefined}
            onChange={(value) => setFilters({ ...filters, exchange: value || '' })}
            style={{ width: 120 }}
            allowClear
            options={[
              { value: 'binance', label: 'Binance' },
              { value: 'okx', label: 'OKX' },
              { value: 'bybit', label: 'Bybit' },
            ]}
          />
          <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
            搜索
          </Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              loadOrders();
              loadStats();
            }}
          >
            刷新
          </Button>
          <Button
            icon={<DownloadOutlined />}
            onClick={() => message.success('导出成功')}
          >
            导出
          </Button>
        </Space>
      </Card>

      {/* 订单列表 */}
      <Card>
        <Spin spinning={loading}>
          <Table
            dataSource={dataSource}
            columns={columns}
            rowKey="id"
            pagination={{
              current: page,
              pageSize: pageSize,
              total: total,
              showSizeChanger: true,
              showTotal: (t) => `共 ${t} 条`,
              onChange: (p, ps) => {
                setPage(p);
                setPageSize(ps);
              },
            }}
            scroll={{ x: 1400 }}
          />
        </Spin>
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
              {(() => {
                const config = statusMap[selectedOrder.status] || {
                  color: 'default',
                  text: selectedOrder.status,
                  icon: null,
                };
                return (
                  <Tag icon={config.icon} color={config.color}>
                    {config.text}
                  </Tag>
                );
              })()}
            </Descriptions.Item>
            <Descriptions.Item label="用户">
              {selectedOrder.username} ({selectedOrder.userId.slice(0, 8)}...)
            </Descriptions.Item>
            <Descriptions.Item label="策略">{selectedOrder.strategyName}</Descriptions.Item>
            <Descriptions.Item label="交易所">{selectedOrder.exchange}</Descriptions.Item>
            <Descriptions.Item label="交易对">{selectedOrder.symbol}</Descriptions.Item>
            <Descriptions.Item label="方向">
              {selectedOrder.side !== '-' ? (
                <Tag color={selectedOrder.side === 'buy' ? 'green' : 'red'}>
                  {selectedOrder.side === 'buy' ? '买入' : '卖出'}
                </Tag>
              ) : (
                '-'
              )}
            </Descriptions.Item>
            <Descriptions.Item label="信号价格">
              {selectedOrder.signalPrice && selectedOrder.signalPrice !== '0'
                ? `$${parseFloat(selectedOrder.signalPrice).toLocaleString()}`
                : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="成交价格">
              {selectedOrder.executedPrice
                ? `$${parseFloat(selectedOrder.executedPrice).toLocaleString()}`
                : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="成交数量">
              {selectedOrder.executedAmount
                ? parseFloat(selectedOrder.executedAmount).toLocaleString()
                : '-'}
            </Descriptions.Item>
            {selectedOrder.orderId && (
              <Descriptions.Item label="交易所订单ID" span={2}>
                <Text copyable style={{ fontFamily: 'monospace' }}>
                  {selectedOrder.orderId}
                </Text>
              </Descriptions.Item>
            )}
            <Descriptions.Item label="信号ID">
              {selectedOrder.signalId.slice(0, 8)}...
            </Descriptions.Item>
            <Descriptions.Item label="创建时间">
              {new Date(selectedOrder.createdAt).toLocaleString()}
            </Descriptions.Item>
            {selectedOrder.queuedAt && (
              <Descriptions.Item label="排队时间">
                {new Date(selectedOrder.queuedAt).toLocaleString()}
              </Descriptions.Item>
            )}
            {selectedOrder.startedAt && (
              <Descriptions.Item label="开始执行">
                {new Date(selectedOrder.startedAt).toLocaleString()}
              </Descriptions.Item>
            )}
            {selectedOrder.completedAt && (
              <Descriptions.Item label="完成时间">
                {new Date(selectedOrder.completedAt).toLocaleString()}
              </Descriptions.Item>
            )}
            {selectedOrder.skipReason && (
              <Descriptions.Item label="跳过原因" span={2}>
                <Tag color="warning">
                  {skipReasonLabels[selectedOrder.skipReason] || selectedOrder.skipReason}
                </Tag>
              </Descriptions.Item>
            )}
            {selectedOrder.errorMessage && (
              <Descriptions.Item label="错误信息" span={2}>
                <Text type="danger">
                  {selectedOrder.errorCode && `[${selectedOrder.errorCode}] `}
                  {selectedOrder.errorMessage}
                </Text>
              </Descriptions.Item>
            )}
          </Descriptions>
        )}
      </Modal>
    </div>
  );
};
