/**
 * 账单记录页面
 * 连接真实后端 API
 */
import { useState, useEffect, useCallback } from 'react';
import { List } from '@refinedev/antd';
import {
  Table,
  Tag,
  DatePicker,
  Select,
  Space,
  Card,
  Row,
  Col,
  Statistic,
  Input,
  Button,
  Spin,
} from 'antd';
import {
  ArrowUpOutlined,
  ArrowDownOutlined,
  SwapOutlined,
  SearchOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { adminApi } from '../../lib/admin-api';
import { useMessage } from '../../hooks';

const { RangePicker } = DatePicker;

interface IBill {
  id: string;
  uniqueOrderId: string;
  userId: string;
  username: string;
  type: string;
  amount: string;
  currency: string;
  status: string;
  createdAt: string;
  remark: string;
}

interface IStats {
  todayRevenue: string;
  todaySubscription: string;
  todayProfitShare: string;
  todayGasFee: string;
  totalRevenue: string;
}

export const BillList = () => {
  const message = useMessage();
  const [dataSource, setDataSource] = useState<IBill[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<IStats | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [typeFilter, setTypeFilter] = useState<string | undefined>();
  const [searchKeyword, setSearchKeyword] = useState('');

  // 加载账单列表
  const loadBills = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(pageSize),
      });
      if (typeFilter) params.append('type', typeFilter);
      if (searchKeyword) params.append('userId', searchKeyword);

      const response = await adminApi.get(`/admin/billing?${params}`);
      if (response.data.code === 0) {
        const data = response.data.data as { items: IBill[]; total: number };
        setDataSource(data.items || []);
        setTotal(data.total || 0);
      } else {
        message.error(response.data.message || '加载失败');
      }
    } catch (error: any) {
      console.error('加载账单失败:', error);
      message.error(error.response?.data?.message || '加载账单失败');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, typeFilter, searchKeyword]);

  // 加载统计数据
  const loadStats = useCallback(async () => {
    try {
      const response = await adminApi.get('/admin/billing/stats');
      if (response.data.code === 0) {
        setStats(response.data.data as IStats);
      }
    } catch (error) {
      console.error('加载统计数据失败:', error);
    }
  }, []);

  useEffect(() => {
    loadBills();
    loadStats();
  }, [loadBills, loadStats]);

  const typeConfig: Record<string, { color: string; label: string; icon: React.ReactNode }> = {
    deposit: { color: 'green', label: '充值', icon: <ArrowDownOutlined /> },
    withdraw: { color: 'red', label: '提现', icon: <ArrowUpOutlined /> },
    subscription: { color: 'blue', label: '订阅', icon: <SwapOutlined /> },
    profit_share: { color: 'purple', label: '分成', icon: <SwapOutlined /> },
    gas_fee: { color: 'orange', label: '燃油费', icon: <SwapOutlined /> },
    adjustment: { color: 'cyan', label: '调整', icon: <SwapOutlined /> },
    referral: { color: 'gold', label: '推荐奖励', icon: <SwapOutlined /> },
    staking_reward: { color: 'lime', label: '质押奖励', icon: <SwapOutlined /> },
    dividend: { color: 'magenta', label: '分红', icon: <SwapOutlined /> },
  };

  const statusConfig: Record<string, { color: string; label: string }> = {
    success: { color: 'success', label: '成功' },
    completed: { color: 'success', label: '成功' },
    failed: { color: 'error', label: '失败' },
    pending: { color: 'processing', label: '处理中' },
    processing: { color: 'processing', label: '处理中' },
  };

  const handleSearch = () => {
    setPage(1);
    loadBills();
  };

  const columns = [
    {
      title: '账单ID',
      dataIndex: 'uniqueOrderId',
      key: 'uniqueOrderId',
      width: 180,
      ellipsis: true,
      render: (id: string) => (
        <span style={{ fontFamily: 'monospace', fontSize: 12 }}>
          {id?.slice(0, 16)}...
        </span>
      ),
    },
    {
      title: '用户',
      key: 'user',
      width: 140,
      render: (_: unknown, record: IBill) => (
        <div>
          <div style={{ fontWeight: 500 }}>{record.username || '-'}</div>
          <div style={{ fontSize: 12, color: '#999' }}>{record.userId?.slice(0, 8)}...</div>
        </div>
      ),
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: (type: string) => {
        const config = typeConfig[type] || { color: 'default', label: type };
        return <Tag color={config.color}>{config.label}</Tag>;
      },
    },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      width: 140,
      render: (amount: string, record: IBill) => {
        const value = parseFloat(amount || '0');
        const isPositive = value >= 0;
        return (
          <span style={{ color: isPositive ? '#52c41a' : '#f5222d', fontWeight: 500 }}>
            {isPositive ? '+' : ''}{value.toFixed(2)} {record.currency || 'USDT'}
          </span>
        );
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const config = statusConfig[status] || { color: 'default', label: status };
        return <Tag color={config.color}>{config.label}</Tag>;
      },
    },
    {
      title: '时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (date: string) => date ? new Date(date).toLocaleString() : '-',
    },
    {
      title: '备注',
      dataIndex: 'remark',
      key: 'remark',
      ellipsis: true,
      render: (remark: string) => remark || '-',
    },
  ];

  return (
    <List>
      <Spin spinning={loading}>
        {/* 统计卡片 */}
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={6}>
            <Card>
              <Statistic
                title="今日收入"
                value={parseFloat(stats?.todayRevenue || '0')}
                precision={2}
                prefix="$"
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="订阅收入"
                value={parseFloat(stats?.todaySubscription || '0')}
                precision={2}
                prefix="$"
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="分成收入"
                value={parseFloat(stats?.todayProfitShare || '0')}
                precision={2}
                prefix="$"
                valueStyle={{ color: '#722ed1' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="燃油费收入"
                value={parseFloat(stats?.todayGasFee || '0')}
                precision={2}
                prefix="$"
                valueStyle={{ color: '#fa8c16' }}
              />
            </Card>
          </Col>
        </Row>

        {/* 筛选条件 */}
        <Card style={{ marginBottom: 16 }}>
          <Space wrap>
            <Input
              placeholder="搜索用户ID"
              style={{ width: 200 }}
              allowClear
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              onPressEnter={handleSearch}
            />
            <Select
              placeholder="账单类型"
              style={{ width: 120 }}
              allowClear
              value={typeFilter}
              onChange={setTypeFilter}
              options={[
                { label: '充值', value: 'deposit' },
                { label: '提现', value: 'withdraw' },
                { label: '订阅', value: 'subscription' },
                { label: '分成', value: 'profit_share' },
                { label: '燃油费', value: 'gas_fee' },
                { label: '推荐奖励', value: 'referral' },
                { label: '质押奖励', value: 'staking_reward' },
                { label: '分红', value: 'dividend' },
                { label: '调整', value: 'adjustment' },
              ]}
            />
            <RangePicker placeholder={['开始日期', '结束日期']} />
            <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
              搜索
            </Button>
            <Button icon={<ReloadOutlined />} onClick={() => { loadBills(); loadStats(); }}>
              刷新
            </Button>
          </Space>
        </Card>

        <Table
          dataSource={dataSource}
          columns={columns}
          rowKey="id"
          scroll={{ x: 900 }}
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
