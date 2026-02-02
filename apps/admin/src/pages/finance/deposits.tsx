/**
 * 充值记录页面
 * 连接真实后端 API
 */
import { List } from '@refinedev/antd';
import {
  Table,
  Tag,
  Space,
  Button,
  Input,
  Select,
  Card,
  Row,
  Col,
  Statistic,
  Typography,
  Tooltip,
  Modal,
  Spin,
} from 'antd';
import {
  SearchOutlined,
  CopyOutlined,
  EyeOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useState, useEffect, useCallback } from 'react';
import { adminApi } from '../../lib/admin-api';
import { useMessage } from '../../hooks';

const { Text } = Typography;

interface ITransaction {
  id: string;
  userId: string;
  username: string;
  type: string;
  asset: string;
  amount: string;
  status: string;
  txHash: string | null;
  uniqueOrderId: string;
  remark: string | null;
  createdAt: string;
  updatedAt: string;
}

interface IStats {
  totalDeposits: { amount: string; count: number };
  todayDeposits: { amount: string; count: number };
  pendingDeposits: number;
  totalWithdrawals: { amount: string; count: number };
  pendingWithdrawals: number;
}

export const DepositsPage = () => {
  const message = useMessage();
  const [dataSource, setDataSource] = useState<ITransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<IStats | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [assetFilter, setAssetFilter] = useState<string | undefined>();

  // 加载充值记录
  const loadDeposits = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(pageSize),
        type: 'deposit',
      });
      if (statusFilter) params.append('status', statusFilter);
      if (searchKeyword) params.append('search', searchKeyword);

      const response = await adminApi.get<{ items: ITransaction[]; total: number }>(`/admin/transactions?${params}`);
      if (response.data.code === 0) {
        const data = response.data.data as { items: ITransaction[]; total: number };
        let items = data?.items || [];
        // 前端过滤币种
        if (assetFilter) {
          items = items.filter((item: ITransaction) => item.asset === assetFilter);
        }
        setDataSource(items);
        setTotal(data?.total || 0);
      } else {
        message.error(response.data.message || '加载失败');
      }
    } catch (error: any) {
      console.error('加载充值记录失败:', error);
      message.error(error.response?.data?.message || '加载充值记录失败');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, statusFilter, searchKeyword, assetFilter]);

  // 加载统计数据
  const loadStats = useCallback(async () => {
    try {
      const response = await adminApi.get<IStats>('/admin/transactions/stats');
      if (response.data.code === 0) {
        setStats(response.data.data as IStats);
      }
    } catch (error) {
      console.error('加载统计数据失败:', error);
    }
  }, []);

  useEffect(() => {
    loadDeposits();
    loadStats();
  }, [loadDeposits, loadStats]);

  const statusColors: Record<string, string> = {
    pending: 'processing',
    completed: 'success',
    failed: 'error',
  };

  const statusLabels: Record<string, string> = {
    pending: '处理中',
    completed: '已完成',
    failed: '失败',
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    message.success('已复制到剪贴板');
  };

  const showTxDetail = (record: ITransaction) => {
    Modal.info({
      title: '交易详情',
      width: 600,
      content: (
        <div style={{ marginTop: 16 }}>
          <p><strong>订单ID:</strong> {record.uniqueOrderId}</p>
          {record.txHash && (
            <>
              <p><strong>交易哈希:</strong></p>
              <p style={{ wordBreak: 'break-all', color: '#1890ff' }}>{record.txHash}</p>
            </>
          )}
          <p><strong>用户:</strong> {record.username} ({record.userId})</p>
          <p><strong>金额:</strong> {record.amount} {record.asset}</p>
          <p><strong>状态:</strong> {statusLabels[record.status] || record.status}</p>
          <p><strong>创建时间:</strong> {new Date(record.createdAt).toLocaleString()}</p>
          {record.remark && <p><strong>备注:</strong> {record.remark}</p>}
        </div>
      ),
    });
  };

  const handleSearch = () => {
    setPage(1);
    loadDeposits();
  };

  const columns = [
    {
      title: '订单ID',
      dataIndex: 'uniqueOrderId',
      key: 'uniqueOrderId',
      width: 180,
      ellipsis: true,
      render: (id: string) => (
        <Tooltip title={id}>
          <Text style={{ fontFamily: 'monospace' }}>{id.slice(0, 16)}...</Text>
        </Tooltip>
      ),
    },
    {
      title: '用户',
      key: 'user',
      width: 140,
      render: (_: unknown, record: ITransaction) => (
        <div>
          <div style={{ fontWeight: 500 }}>{record.username}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.userId.slice(0, 8)}...</Text>
        </div>
      ),
    },
    {
      title: '金额',
      key: 'amount',
      width: 160,
      render: (_: unknown, record: ITransaction) => (
        <span style={{
          fontWeight: 600,
          color: record.asset === 'USDT' ? '#52c41a' : '#1890ff'
        }}>
          {record.asset === 'USDT' ? '$' : ''}{parseFloat(record.amount).toLocaleString()} {record.asset}
        </span>
      ),
    },
    {
      title: '交易哈希',
      dataIndex: 'txHash',
      key: 'txHash',
      width: 180,
      render: (hash: string | null) => hash ? (
        <Space>
          <Text style={{ fontFamily: 'monospace' }}>
            {hash.slice(0, 8)}...{hash.slice(-6)}
          </Text>
          <Tooltip title="复制">
            <Button
              type="text"
              size="small"
              icon={<CopyOutlined />}
              onClick={() => copyToClipboard(hash)}
            />
          </Tooltip>
        </Space>
      ) : '-',
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
      title: '时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (date: string) => new Date(date).toLocaleString(),
    },
    {
      title: '操作',
      key: 'actions',
      width: 80,
      render: (_: unknown, record: ITransaction) => (
        <Tooltip title="查看详情">
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => showTxDetail(record)}
          />
        </Tooltip>
      ),
    },
  ];

  return (
    <List>
      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="今日充值额"
              value={parseFloat(stats?.todayDeposits?.amount || '0')}
              precision={2}
              prefix="$"
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="今日充值笔数"
              value={stats?.todayDeposits?.count || 0}
              suffix="笔"
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="待处理"
              value={stats?.pendingDeposits || 0}
              suffix="笔"
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="累计充值总额"
              value={parseFloat(stats?.totalDeposits?.amount || '0')}
              precision={2}
              prefix="$"
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 筛选区域 */}
      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input
            placeholder="搜索用户/交易哈希"
            prefix={<SearchOutlined />}
            style={{ width: 200 }}
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            onPressEnter={handleSearch}
          />
          <Select
            placeholder="币种"
            style={{ width: 120 }}
            allowClear
            value={assetFilter}
            onChange={setAssetFilter}
            options={[
              { label: 'USDT', value: 'USDT' },
              { label: 'HOOT', value: 'HOOT' },
            ]}
          />
          <Select
            placeholder="状态"
            style={{ width: 120 }}
            allowClear
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { label: '处理中', value: 'pending' },
              { label: '已完成', value: 'completed' },
              { label: '失败', value: 'failed' },
            ]}
          />
          <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
            搜索
          </Button>
          <Button icon={<ReloadOutlined />} onClick={() => { loadDeposits(); loadStats(); }}>
            刷新
          </Button>
        </Space>
      </Card>

      {/* 数据表格 */}
      <Spin spinning={loading}>
        <Table
          dataSource={dataSource}
          columns={columns}
          rowKey="id"
          scroll={{ x: 1000 }}
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
        />
      </Spin>
    </List>
  );
};
