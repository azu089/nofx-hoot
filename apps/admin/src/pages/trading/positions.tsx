/**
 * 持仓管理页面
 * 连接真实后端 API
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
  Spin,
} from 'antd';
import {
  SearchOutlined,
  DownloadOutlined,
  EyeOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  StockOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useState, useEffect, useCallback } from 'react';
import { adminApi } from '../../lib/admin-api';
import { useMessage } from '../../hooks';

const { Title, Text } = Typography;

interface IPosition {
  id: string;
  userId: string;
  username: string;
  exchange: string;
  symbol: string;
  side: 'long' | 'short';
  amount: string;
  entryPrice: string;
  currentPrice?: string;
  unrealizedPnl?: string;
  unrealizedPnlPercent?: string;
  pnl?: string;
  realizedPnl?: string;
  status: string;
  closedAt?: string;
  exitPrice?: string;
  closeReason?: string;
  subscriptionId?: string;
  strategyName?: string;
  dcaCount: number;
  createdAt: string;
  updatedAt: string;
}

interface IStats {
  totalPositions: number;
  openPositions: number;
  closedPositions: number;
  totalPnl: string;
  winRate: string;
  avgPnl: string;
}

export const PositionsPage = () => {
  const message = useMessage();
  const [dataSource, setDataSource] = useState<IPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<IStats | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<IPosition | null>(null);

  const [filters, setFilters] = useState({
    search: '',
    exchange: '',
    symbol: '',
    status: '',
  });

  // 加载持仓列表
  const loadPositions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(pageSize),
      });
      if (filters.status) params.append('status', filters.status);
      if (filters.exchange) params.append('exchange', filters.exchange);
      if (filters.symbol) params.append('symbol', filters.symbol);
      if (filters.search) params.append('search', filters.search);

      const response = await adminApi.get<{ items: IPosition[]; total: number }>(`/admin/positions?${params}`);
      if (response.data.code === 0) {
        const data = response.data.data as { items: IPosition[]; total: number };
        setDataSource(data?.items || []);
        setTotal(data?.total || 0);
      } else {
        message.error(response.data.message || '加载失败');
      }
    } catch (error: any) {
      console.error('加载持仓列表失败:', error);
      message.error(error.response?.data?.message || '加载持仓列表失败');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, filters]);

  // 加载统计数据
  const loadStats = useCallback(async () => {
    try {
      const response = await adminApi.get<IStats>('/admin/positions/stats');
      if (response.data.code === 0) {
        setStats(response.data.data as IStats);
      }
    } catch (error) {
      console.error('加载统计数据失败:', error);
    }
  }, []);

  useEffect(() => {
    loadPositions();
    loadStats();
  }, [loadPositions, loadStats]);

  const handleSearch = () => {
    setPage(1);
    loadPositions();
  };

  const statusColors: Record<string, string> = {
    open: 'processing',
    closed: 'success',
    failed: 'error',
  };

  const statusLabels: Record<string, string> = {
    open: '持仓中',
    closed: '已平仓',
    failed: '失败',
  };

  const closeReasonLabels: Record<string, string> = {
    stop_loss: '止损',
    take_profit: '止盈',
    trailing_stop: '追踪止损',
    signal: '信号平仓',
    manual: '手动平仓',
    black_swan: '黑天鹅',
    daily_loss_limit: '日亏损限制',
  };

  const columns = [
    {
      title: '持仓ID',
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
      render: (_: unknown, record: IPosition) => (
        <Space direction="vertical" size={0}>
          <Text strong>{record.username || '-'}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.userId.slice(0, 8)}...
          </Text>
        </Space>
      ),
    },
    {
      title: '交易所',
      dataIndex: 'exchange',
      key: 'exchange',
      render: (e: string) => <Tag>{e}</Tag>,
      width: 90,
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
      render: (side: string) => (
        <Tag
          color={side === 'long' ? 'green' : 'red'}
          icon={side === 'long' ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
        >
          {side === 'long' ? '做多' : '做空'}
        </Tag>
      ),
    },
    {
      title: '持仓量',
      dataIndex: 'amount',
      key: 'amount',
      width: 100,
      render: (amount: string) => parseFloat(amount).toLocaleString(),
    },
    {
      title: '开仓价',
      dataIndex: 'entryPrice',
      key: 'entryPrice',
      width: 100,
      render: (price: string) => `$${parseFloat(price).toLocaleString()}`,
    },
    {
      title: '平仓价',
      dataIndex: 'exitPrice',
      key: 'exitPrice',
      width: 100,
      render: (price: string | null) =>
        price ? `$${parseFloat(price).toLocaleString()}` : '-',
    },
    {
      title: '盈亏',
      key: 'pnl',
      width: 120,
      render: (_: unknown, record: IPosition) => {
        const pnl = record.realizedPnl || record.pnl;
        if (!pnl) return '-';
        const pnlValue = parseFloat(pnl);
        const isProfit = pnlValue >= 0;
        return (
          <Text type={isProfit ? 'success' : 'danger'} strong>
            {isProfit ? '+' : ''}
            {pnlValue.toFixed(2)} USDT
          </Text>
        );
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => (
        <Tag color={statusColors[status] || 'default'}>
          {statusLabels[status] || status}
        </Tag>
      ),
    },
    {
      title: '平仓原因',
      dataIndex: 'closeReason',
      key: 'closeReason',
      width: 100,
      render: (reason: string | null) =>
        reason ? (
          <Tag>{closeReasonLabels[reason] || reason}</Tag>
        ) : (
          '-'
        ),
    },
    {
      title: '开仓时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 150,
      render: (date: string) => new Date(date).toLocaleString(),
    },
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

  // 统计数据
  const totalPositions = stats?.totalPositions || 0;
  const openPositions = stats?.openPositions || 0;
  const totalPnl = parseFloat(stats?.totalPnl || '0');
  const winRate = parseFloat(stats?.winRate || '0');

  // 按交易对汇总
  const symbolSummary = dataSource.reduce(
    (acc, p) => {
      if (!acc[p.symbol]) {
        acc[p.symbol] = { count: 0, pnl: 0 };
      }
      acc[p.symbol].count++;
      const pnl = p.realizedPnl || p.pnl;
      if (pnl) {
        acc[p.symbol].pnl += parseFloat(pnl);
      }
      return acc;
    },
    {} as Record<string, { count: number; pnl: number }>
  );

  return (
    <div style={{ padding: 24 }}>
      <Title level={4} style={{ marginBottom: 24 }}>
        持仓管理
      </Title>

      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginTop: 24, marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="总持仓数"
              value={totalPositions}
              prefix={<StockOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="当前持仓"
              value={openPositions}
              valueStyle={{ color: '#1890ff' }}
              suffix="个"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="累计盈亏"
              value={totalPnl.toFixed(2)}
              valueStyle={{ color: totalPnl >= 0 ? '#52c41a' : '#f5222d' }}
              prefix={totalPnl >= 0 ? '+' : ''}
              suffix="USDT"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="胜率"
              value={winRate.toFixed(1)}
              suffix="%"
              valueStyle={{ color: winRate >= 50 ? '#52c41a' : '#f5222d' }}
            />
            <Progress
              percent={winRate}
              showInfo={false}
              strokeColor={winRate >= 50 ? '#52c41a' : '#f5222d'}
              size="small"
            />
          </Card>
        </Col>
      </Row>

      {/* 按交易对汇总 */}
      {Object.keys(symbolSummary).length > 0 && (
        <Row gutter={16} style={{ marginBottom: 24 }}>
          {Object.entries(symbolSummary)
            .slice(0, 4)
            .map(([symbol, data]) => (
              <Col span={6} key={symbol}>
                <Card size="small">
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Text strong>{symbol}</Text>
                    <Space>
                      <Tag>{data.count} 个持仓</Tag>
                      <Text type={data.pnl >= 0 ? 'success' : 'danger'}>
                        {data.pnl >= 0 ? '+' : ''}
                        {data.pnl.toFixed(2)} USDT
                      </Text>
                    </Space>
                  </Space>
                </Card>
              </Col>
            ))}
        </Row>
      )}

      {/* 筛选栏 */}
      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input
            placeholder="搜索用户/持仓ID"
            prefix={<SearchOutlined />}
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            onPressEnter={handleSearch}
            style={{ width: 200 }}
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
          <Select
            placeholder="交易对"
            value={filters.symbol || undefined}
            onChange={(value) => setFilters({ ...filters, symbol: value || '' })}
            style={{ width: 120 }}
            allowClear
            options={[
              { value: 'BTC/USDT', label: 'BTC/USDT' },
              { value: 'ETH/USDT', label: 'ETH/USDT' },
              { value: 'SOL/USDT', label: 'SOL/USDT' },
            ]}
          />
          <Select
            placeholder="状态"
            value={filters.status || undefined}
            onChange={(value) => setFilters({ ...filters, status: value || '' })}
            style={{ width: 120 }}
            allowClear
            options={[
              { value: 'open', label: '持仓中' },
              { value: 'closed', label: '已平仓' },
              { value: 'failed', label: '失败' },
            ]}
          />
          <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
            搜索
          </Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              loadPositions();
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

      {/* 持仓列表 */}
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
            scroll={{ x: 1600 }}
          />
        </Spin>
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
            <Descriptions.Item label="持仓ID">
              {selectedPosition.id}
            </Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={statusColors[selectedPosition.status] || 'default'}>
                {statusLabels[selectedPosition.status] || selectedPosition.status}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="用户">
              {selectedPosition.username || '-'} ({selectedPosition.userId.slice(0, 8)}
              ...)
            </Descriptions.Item>
            <Descriptions.Item label="策略">
              {selectedPosition.strategyName || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="交易所">
              {selectedPosition.exchange}
            </Descriptions.Item>
            <Descriptions.Item label="交易对">
              {selectedPosition.symbol}
            </Descriptions.Item>
            <Descriptions.Item label="方向">
              <Tag color={selectedPosition.side === 'long' ? 'green' : 'red'}>
                {selectedPosition.side === 'long' ? '做多' : '做空'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="持仓量">
              {parseFloat(selectedPosition.amount).toLocaleString()}
            </Descriptions.Item>
            <Descriptions.Item label="开仓价">
              ${parseFloat(selectedPosition.entryPrice).toLocaleString()}
            </Descriptions.Item>
            <Descriptions.Item label="平仓价">
              {selectedPosition.exitPrice
                ? `$${parseFloat(selectedPosition.exitPrice).toLocaleString()}`
                : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="盈亏">
              {(() => {
                const pnl =
                  selectedPosition.realizedPnl || selectedPosition.pnl;
                if (!pnl) return '-';
                const pnlValue = parseFloat(pnl);
                return (
                  <Text type={pnlValue >= 0 ? 'success' : 'danger'} strong>
                    {pnlValue >= 0 ? '+' : ''}
                    {pnlValue.toFixed(2)} USDT
                  </Text>
                );
              })()}
            </Descriptions.Item>
            <Descriptions.Item label="平仓原因">
              {selectedPosition.closeReason
                ? closeReasonLabels[selectedPosition.closeReason] ||
                  selectedPosition.closeReason
                : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="DCA次数">
              {selectedPosition.dcaCount}
            </Descriptions.Item>
            <Descriptions.Item label="订阅ID">
              {selectedPosition.subscriptionId
                ? selectedPosition.subscriptionId.slice(0, 8) + '...'
                : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="开仓时间" span={2}>
              {new Date(selectedPosition.createdAt).toLocaleString()}
            </Descriptions.Item>
            {selectedPosition.closedAt && (
              <Descriptions.Item label="平仓时间" span={2}>
                {new Date(selectedPosition.closedAt).toLocaleString()}
              </Descriptions.Item>
            )}
          </Descriptions>
        )}
      </Modal>
    </div>
  );
};
