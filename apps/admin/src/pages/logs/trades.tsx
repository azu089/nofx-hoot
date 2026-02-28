/**
 * 交易日志页面
 * 资金流水记录（充值、提现、手续费、订阅等）
 * 对接真实后端 /admin/transactions 接口
 */
import {
  Card,
  Table,
  Tag,
  Space,
  Typography,
  Button,
  Input,
  Select,
  DatePicker,
  Row,
  Col,
  Statistic,
  message,
} from 'antd';
import {
  SearchOutlined,
  DownloadOutlined,
  SwapOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  ReloadOutlined,
  CalendarOutlined,
} from '@ant-design/icons';
import { useState, useEffect, useCallback } from 'react';
import { adminApi } from '../../lib/admin-api';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

// 后端 Transaction 模型
interface ITransaction {
  id: string;
  userId: string;
  user?: { email: string; nickname: string };
  type: string;       // deposit, withdrawal, admin_credit, admin_debit, refund, gas_fee, subscription
  status: string;     // pending, completed, failed, cancelled
  amount: string;     // Decimal 字符串
  currency: string;   // USDT, HOOT
  txHash: string | null;
  description: string | null;
  createdAt: string;
}

// 统计数据
interface ITransactionStats {
  totalTransactions: number;
  totalDeposits: string;
  totalWithdrawals: string;
  todayTransactions: number;
}

// 类型标签颜色映射
const TYPE_COLOR: Record<string, string> = {
  deposit: 'green',
  withdrawal: 'red',
  admin_credit: 'blue',
  admin_debit: 'orange',
  refund: 'cyan',
  gas_fee: 'default',
  subscription: 'purple',
};

// 类型中文标签
const TYPE_LABEL: Record<string, string> = {
  deposit: '充值',
  withdrawal: '提现',
  admin_credit: '管理员入账',
  admin_debit: '管理员扣款',
  refund: '退款',
  gas_fee: '手续费',
  subscription: '订阅费',
};

// 状态标签颜色映射
const STATUS_COLOR: Record<string, string> = {
  completed: 'success',
  pending: 'warning',
  failed: 'error',
  cancelled: 'default',
};

// 状态中文标签
const STATUS_LABEL: Record<string, string> = {
  completed: '已完成',
  pending: '待处理',
  failed: '失败',
  cancelled: '已取消',
};

export const TradeLogsPage = () => {
  const [logs, setLogs] = useState<ITransaction[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<ITransactionStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);

  // 筛选条件
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [dateRange, setDateRange] = useState<[string, string] | null>(null);

  // 加载统计数据
  const loadStats = useCallback(async () => {
    try {
      const res = await adminApi.get<ITransactionStats>('/admin/transactions/stats');
      setStats(res.data.data as ITransactionStats);
    } catch (err) {
      console.error('加载统计失败', err);
    }
  }, []);

  // 加载列表数据
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
        ...(search ? { search } : {}),
        ...(type ? { type } : {}),
        ...(status ? { status } : {}),
        ...(dateRange ? { startDate: dateRange[0], endDate: dateRange[1] } : {}),
      });
      const res = await adminApi.get<{ items: ITransaction[]; total: number }>(
        `/admin/transactions?${params}`
      );
      const responseData = res.data.data as { items: ITransaction[]; total: number };
      setLogs(responseData?.items || []);
      setTotal(responseData?.total || 0);
    } catch (err) {
      console.error('加载交易日志失败', err);
      message.error('加载失败，请重试');
    } finally {
      setLoading(false);
    }
  }, [page, search, type, status, dateRange]);

  // 初次加载 & 条件变化时重新请求
  useEffect(() => {
    loadData();
  }, [loadData]);

  // 初次加载统计数据
  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // 搜索/筛选变化时重置到第1页
  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleTypeChange = (value: string) => {
    setType(value || '');
    setPage(1);
  };

  const handleStatusChange = (value: string) => {
    setStatus(value || '');
    setPage(1);
  };

  const handleDateChange = (_: unknown, dateStrings: [string, string]) => {
    if (dateStrings[0] && dateStrings[1]) {
      setDateRange(dateStrings);
    } else {
      setDateRange(null);
    }
    setPage(1);
  };

  // 截断 txHash 显示
  const truncateHash = (hash: string | null) => {
    if (!hash) return '-';
    return `${hash.slice(0, 8)}...${hash.slice(-6)}`;
  };

  const columns = [
    {
      title: '交易ID',
      dataIndex: 'id',
      key: 'id',
      width: 120,
      render: (id: string) => (
        <Text code style={{ fontSize: 12 }}>
          {id.slice(0, 8)}...
        </Text>
      ),
    },
    {
      title: '用户',
      key: 'user',
      render: (_: unknown, record: ITransaction) => (
        <Space direction="vertical" size={0}>
          <Text strong>{record.user?.nickname || '-'}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.user?.email || record.userId.slice(0, 8) + '...'}
          </Text>
        </Space>
      ),
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (t: string) => (
        <Tag
          color={TYPE_COLOR[t] || 'default'}
          icon={t === 'deposit' ? <ArrowDownOutlined /> : t === 'withdrawal' ? <ArrowUpOutlined /> : undefined}
        >
          {TYPE_LABEL[t] || t}
        </Tag>
      ),
    },
    {
      title: '金额',
      key: 'amount',
      render: (_: unknown, record: ITransaction) => {
        const isPositive = ['deposit', 'admin_credit', 'refund'].includes(record.type);
        return (
          <Text type={isPositive ? 'success' : 'danger'}>
            {isPositive ? '+' : '-'}{record.amount} {record.currency}
          </Text>
        );
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => (
        <Tag color={STATUS_COLOR[s] || 'default'}>
          {STATUS_LABEL[s] || s}
        </Tag>
      ),
    },
    {
      title: '链上哈希',
      dataIndex: 'txHash',
      key: 'txHash',
      render: (hash: string | null) => (
        <Text code style={{ fontSize: 12 }}>
          {truncateHash(hash)}
        </Text>
      ),
    },
    {
      title: '备注',
      dataIndex: 'description',
      key: 'description',
      render: (desc: string | null) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {desc || '-'}
        </Text>
      ),
    },
    {
      title: '时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (t: string) => new Date(t).toLocaleString('zh-CN', { hour12: false }),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Title level={4} style={{ marginBottom: 24 }}>
        交易日志
      </Title>

      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="总流水笔数"
              value={stats?.totalTransactions ?? '-'}
              prefix={<SwapOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="总充值金额"
              value={stats ? Number(stats.totalDeposits).toFixed(2) : '-'}
              prefix="$"
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="总提现金额"
              value={stats ? Number(stats.totalWithdrawals).toFixed(2) : '-'}
              prefix="$"
              valueStyle={{ color: '#f5222d' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="今日交易笔数"
              value={stats?.todayTransactions ?? '-'}
              prefix={<CalendarOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* 筛选栏 */}
      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input.Search
            placeholder="搜索用户/邮箱"
            prefix={<SearchOutlined />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onSearch={handleSearch}
            style={{ width: 220 }}
            allowClear
          />
          <Select
            placeholder="交易类型"
            value={type || undefined}
            onChange={handleTypeChange}
            style={{ width: 140 }}
            allowClear
            options={[
              { value: 'deposit', label: '充值' },
              { value: 'withdrawal', label: '提现' },
              { value: 'admin_credit', label: '管理员入账' },
              { value: 'admin_debit', label: '管理员扣款' },
              { value: 'refund', label: '退款' },
              { value: 'gas_fee', label: '手续费' },
              { value: 'subscription', label: '订阅费' },
            ]}
          />
          <Select
            placeholder="状态"
            value={status || undefined}
            onChange={handleStatusChange}
            style={{ width: 120 }}
            allowClear
            options={[
              { value: 'completed', label: '已完成' },
              { value: 'pending', label: '待处理' },
              { value: 'failed', label: '失败' },
              { value: 'cancelled', label: '已取消' },
            ]}
          />
          <RangePicker onChange={handleDateChange as any} />
          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              loadData();
              loadStats();
            }}
          >
            刷新
          </Button>
          <Button
            icon={<DownloadOutlined />}
            onClick={() => message.info('导出功能开发中')}
          >
            导出
          </Button>
        </Space>
      </Card>

      {/* 数据表格 */}
      <Card>
        <Table
          dataSource={logs}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{
            current: page,
            pageSize: 20,
            total,
            onChange: (p) => setPage(p),
            showTotal: (t) => `共 ${t} 条`,
            showSizeChanger: false,
          }}
        />
      </Card>
    </div>
  );
};
