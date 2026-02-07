/**
 * 质押管理页面
 * 生态中心 - 用户质押记录
 * 接入真实后端 API
 */
import { useState, useEffect } from 'react';
import { List, ExportButton } from '@refinedev/antd';
import {
  Table,
  Tag,
  Space,
  Card,
  Row,
  Col,
  Statistic,
  DatePicker,
  Select,
  Input,
  Progress,
  Spin,
  Empty,
} from 'antd';
import {
  LockOutlined,
  UnlockOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { api } from '../../lib/api';
import { useMessage } from '../../hooks';

const { RangePicker } = DatePicker;

// 质押概览类型
interface StakingOverview {
  totalStaked: string;
  totalWeighted: string;
  totalStakers: number;
  activeStakers: number;
  lockedStakers: number;
  averageWeight: string;
  byLockPeriod: {
    flexible: { count: number; amount: string };
    locked: { count: number; amount: string };
  };
}

// 质押记录类型
interface StakingRecord {
  id: string;
  user: {
    id: string;
    email: string;
    nickname: string;
  };
  amount: string;
  weight: string;
  weightedAmount: string;
  lockDays: number;
  stakedAt: string;
  lockUntil: string | null;
  status: 'active' | 'locked' | 'unstaked';
  totalDividends: string;
}

export const StakingList = () => {
  const message = useMessage();
  const [overview, setOverview] = useState<StakingOverview | null>(null);
  const [records, setRecords] = useState<StakingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string | undefined>();

  // 获取质押数据
  const fetchData = async () => {
    setLoading(true);
    try {
      const [overviewData, recordsData] = await Promise.all([
        api.get<StakingOverview>('/admin/ecosystem/staking/overview'),
        api.get<{ records: StakingRecord[]; total: number }>(
          `/admin/ecosystem/staking/records?page=${page}&pageSize=${pageSize}${statusFilter ? `&status=${statusFilter}` : ''}`
        ),
      ]);
      setOverview(overviewData);
      setRecords(recordsData.records || []);
      setTotal(recordsData.total || 0);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '获取数据失败';
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [page, pageSize, statusFilter]);

  const statusConfig: Record<string, { color: string; label: string; icon: React.ReactNode }> = {
    active: { color: 'success', label: '生效中', icon: <UnlockOutlined /> },
    locked: { color: 'warning', label: '锁定中', icon: <LockOutlined /> },
    unstaked: { color: 'default', label: '已解除', icon: <UnlockOutlined /> },
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
      render: (id: string) => id.slice(0, 8) + '...',
    },
    {
      title: '用户',
      key: 'user',
      render: (_: unknown, record: StakingRecord) => (
        <Space direction="vertical" size={0}>
          <span style={{ fontWeight: 500 }}>{record.user?.nickname || record.user?.email || '-'}</span>
          <span style={{ fontSize: 12, color: '#888' }}>ID: {record.user?.id?.slice(0, 8)}...</span>
        </Space>
      ),
    },
    {
      title: '质押数量',
      dataIndex: 'amount',
      key: 'amount',
      width: 140,
      render: (amount: string) => (
        <span style={{ color: '#06B6D4', fontWeight: 500 }}>
          {parseFloat(amount).toLocaleString()} HOOT
        </span>
      ),
      sorter: (a: StakingRecord, b: StakingRecord) => parseFloat(a.amount) - parseFloat(b.amount),
    },
    {
      title: '锁定期',
      dataIndex: 'lockDays',
      key: 'lockDays',
      width: 100,
      render: (days: number) => (days === 0 ? <Tag color="green">活期</Tag> : <Tag color="blue">{days} 天</Tag>),
    },
    {
      title: '权重',
      dataIndex: 'weight',
      key: 'weight',
      width: 120,
      render: (weight: string) => {
        const value = parseFloat(weight);
        return (
          <Space>
            <Progress
              percent={(value / 3) * 100}
              size="small"
              showInfo={false}
              style={{ width: 60 }}
            />
            <span style={{ color: value >= 2 ? '#52c41a' : '#888' }}>
              {value.toFixed(2)}x
            </span>
          </Space>
        );
      },
    },
    {
      title: '加权数量',
      dataIndex: 'weightedAmount',
      key: 'weightedAmount',
      width: 140,
      render: (val: string) => (
        <span style={{ color: '#722ed1' }}>
          {parseFloat(val).toLocaleString()}
        </span>
      ),
    },
    {
      title: '质押时间',
      dataIndex: 'stakedAt',
      key: 'stakedAt',
      width: 160,
      render: (val: string) => new Date(val).toLocaleString('zh-CN'),
    },
    {
      title: '解锁时间',
      dataIndex: 'lockUntil',
      key: 'lockUntil',
      width: 160,
      render: (val: string | null) => val ? new Date(val).toLocaleString('zh-CN') : '随时可取',
    },
    {
      title: '累计分红',
      dataIndex: 'totalDividends',
      key: 'totalDividends',
      width: 120,
      render: (val: string) => (
        <span style={{ color: '#52c41a' }}>
          ${parseFloat(val).toFixed(2)}
        </span>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const config = statusConfig[status] || statusConfig['active'];
        return (
          <Tag color={config.color} icon={config.icon}>
            {config.label}
          </Tag>
        );
      },
    },
  ];

  return (
    <List
      headerButtons={
        <Space>
          <Tag
            icon={<ReloadOutlined spin={loading} />}
            color="blue"
            style={{ cursor: 'pointer' }}
            onClick={fetchData}
          >
            刷新
          </Tag>
          <ExportButton>导出</ExportButton>
        </Space>
      }
    >
      <Spin spinning={loading}>
        {/* 统计卡片 */}
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={5}>
            <Card size="small">
              <Statistic
                title="总质押量"
                value={parseFloat(overview?.totalStaked || '0')}
                suffix="HOOT"
                valueStyle={{ color: '#06B6D4' }}
                precision={0}
              />
            </Card>
          </Col>
          <Col span={5}>
            <Card size="small">
              <Statistic
                title="加权总量"
                value={parseFloat(overview?.totalWeighted || '0')}
                valueStyle={{ color: '#722ed1' }}
                precision={0}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card size="small">
              <Statistic
                title="质押用户"
                value={overview?.totalStakers || 0}
                suffix="人"
              />
            </Card>
          </Col>
          <Col span={5}>
            <Card size="small">
              <Statistic
                title="已解锁质押"
                value={parseFloat(overview?.byLockPeriod?.flexible?.amount || '0')}
                suffix="HOOT"
                valueStyle={{ color: '#52c41a' }}
                precision={0}
              />
              <span style={{ fontSize: 12, color: '#888' }}>
                {overview?.byLockPeriod?.flexible?.count || 0} 笔
              </span>
            </Card>
          </Col>
          <Col span={5}>
            <Card size="small">
              <Statistic
                title="锁定中质押"
                value={parseFloat(overview?.byLockPeriod?.locked?.amount || '0')}
                suffix="HOOT"
                valueStyle={{ color: '#1890ff' }}
                precision={0}
              />
              <span style={{ fontSize: 12, color: '#888' }}>
                {overview?.byLockPeriod?.locked?.count || 0} 笔
              </span>
            </Card>
          </Col>
        </Row>

        {/* 筛选条件 */}
        <Card style={{ marginBottom: 16 }} size="small">
          <Space wrap>
            <Input.Search
              placeholder="搜索用户ID/邮箱"
              style={{ width: 200 }}
              allowClear
            />
            <Select
              placeholder="状态"
              style={{ width: 120 }}
              allowClear
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { label: '生效中', value: 'active' },
                { label: '锁定中', value: 'locked' },
                { label: '已解除', value: 'unstaked' },
              ]}
            />
            <RangePicker placeholder={['开始日期', '结束日期']} />
          </Space>
        </Card>

        <Table
          dataSource={records}
          columns={columns}
          rowKey="id"
          scroll={{ x: 1000 }}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showTotal: (t) => `共 ${t} 条`,
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
            },
          }}
          locale={{ emptyText: <Empty description="暂无质押记录" /> }}
        />
      </Spin>
    </List>
  );
};
