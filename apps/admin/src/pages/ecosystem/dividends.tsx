/**
 * 分红池管理页面
 * 基于燃油费的周度分红
 * 接入真实后端 API
 */
import { List } from '@refinedev/antd';
import {
  Table,
  Tag,
  Space,
  Card,
  Row,
  Col,
  Statistic,
  Select,
  DatePicker,
  Button,
  Typography,
  Modal,
  Descriptions,
  Spin,
  Empty,
  Popconfirm,
} from 'antd';
import {
  DollarOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  SyncOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { useMessage } from '../../hooks';

const { RangePicker } = DatePicker;
const { Text, Title } = Typography;

// 分红池类型
interface DividendPool {
  id: string;
  weekNumber: number;
  periodStart: string;
  periodEnd: string;
  gasFeeTotal: string;
  gasFeeCount: number;
  totalAmount: string;
  dividendRate: string;
  totalWeight: string;
  stakerCount: number;
  perWeightAmount: string;
  distributedAmount: string;
  remainingAmount: string;
  status: 'collecting' | 'pending' | 'distributing' | 'completed';
  distributedAt: string | null;
  createdAt: string;
}

// 分红记录类型
interface DividendRecord {
  id: string;
  user: {
    id: string;
    email: string;
    nickname: string;
  };
  stakedAmount: string;
  weightedAmount: string;
  dividendAmount: string;
  status: string;
  paidAt: string | null;
}

// 分红概览类型
interface DividendOverview {
  totalDistributed: string;
  currentPoolAmount: string;
  currentPoolStakers: number;
  nextDistributionDate: string | null;
  recentPools: DividendPool[];
}

export const DividendsPage = () => {
  const message = useMessage();
  const [overview, setOverview] = useState<DividendOverview | null>(null);
  const [pools, setPools] = useState<DividendPool[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedPool, setSelectedPool] = useState<DividendPool | null>(null);
  const [poolRecords, setPoolRecords] = useState<DividendRecord[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);

  // 获取分红数据
  const fetchData = async () => {
    setLoading(true);
    try {
      const [overviewData, poolsData] = await Promise.all([
        api.get<DividendOverview>('/admin/ecosystem/dividend/overview'),
        api.get<{ pools: DividendPool[] }>('/admin/ecosystem/dividend-pools'),
      ]);
      setOverview(overviewData);
      setPools(poolsData.pools || []);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '获取数据失败';
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // 创建分红池
  const handleCreatePool = async () => {
    try {
      await api.post('/admin/ecosystem/dividend-pools');
      message.success('分红池创建成功');
      fetchData();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '创建失败';
      message.error(errorMessage);
    }
  };

  // 执行分红
  const handleDistribute = async (poolId: string) => {
    try {
      await api.post(`/admin/ecosystem/dividend-pools/${poolId}/distribute`);
      message.success('分红发放成功');
      fetchData();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '分红发放失败';
      message.error(errorMessage);
    }
  };

  // 查看分红明细
  const showDetail = async (pool: DividendPool) => {
    setSelectedPool(pool);
    setDetailVisible(true);
    setRecordsLoading(true);
    try {
      const data = await api.get<{ records: DividendRecord[] }>(
        `/admin/ecosystem/dividend-pools/${pool.id}/records`
      );
      setPoolRecords(data.records || []);
    } catch (err: unknown) {
      message.error('获取分红明细失败');
    } finally {
      setRecordsLoading(false);
    }
  };

  const statusColors: Record<string, string> = {
    collecting: 'processing',
    pending: 'warning',
    distributing: 'processing',
    completed: 'success',
  };

  const statusLabels: Record<string, string> = {
    collecting: '收集中',
    pending: '待发放',
    distributing: '发放中',
    completed: '已完成',
  };

  const statusIcons: Record<string, React.ReactNode> = {
    collecting: <SyncOutlined spin />,
    pending: <ClockCircleOutlined />,
    distributing: <SyncOutlined spin />,
    completed: <CheckCircleOutlined />,
  };

  const columns = [
    {
      title: '周期',
      key: 'period',
      width: 180,
      render: (_: unknown, record: DividendPool) => (
        <Space direction="vertical" size={0}>
          <Text strong>第 {record.weekNumber} 周</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {new Date(record.periodStart).toLocaleDateString()} - {new Date(record.periodEnd).toLocaleDateString()}
          </Text>
        </Space>
      ),
    },
    {
      title: '燃油费收入',
      key: 'gasFee',
      width: 140,
      render: (_: unknown, record: DividendPool) => (
        <Space direction="vertical" size={0}>
          <Text style={{ color: '#f5222d' }}>${parseFloat(record.gasFeeTotal).toFixed(2)}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.gasFeeCount} 笔</Text>
        </Space>
      ),
    },
    {
      title: '分红池',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      width: 140,
      render: (amount: string) => (
        <span style={{ fontWeight: 600, color: '#52c41a' }}>
          ${parseFloat(amount).toFixed(2)}
        </span>
      ),
    },
    {
      title: '分红比例',
      dataIndex: 'dividendRate',
      key: 'dividendRate',
      width: 100,
      render: (rate: string) => (
        <Tag color="blue">{(parseFloat(rate) * 100).toFixed(0)}%</Tag>
      ),
    },
    {
      title: '总权重',
      dataIndex: 'totalWeight',
      key: 'totalWeight',
      width: 120,
      render: (weight: string) => (
        <span style={{ color: '#722ed1' }}>
          {parseFloat(weight).toLocaleString()}
        </span>
      ),
    },
    {
      title: '参与人数',
      dataIndex: 'stakerCount',
      key: 'stakerCount',
      width: 100,
      render: (count: number) => `${count} 人`,
    },
    {
      title: '每权重收益',
      dataIndex: 'perWeightAmount',
      key: 'perWeightAmount',
      width: 120,
      render: (amount: string) => (
        <Text type="secondary">${parseFloat(amount).toFixed(8)}</Text>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: string) => (
        <Tag icon={statusIcons[status]} color={statusColors[status]}>
          {statusLabels[status]}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 160,
      render: (_: unknown, record: DividendPool) => (
        <Space>
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => showDetail(record)}
          >
            明细
          </Button>
          {record.status === 'pending' && (
            <Popconfirm
              title="确认发放分红？"
              description="发放后将向所有质押用户分配分红"
              onConfirm={() => handleDistribute(record.id)}
              okText="确认"
              cancelText="取消"
            >
              <Button size="small" type="primary" icon={<PlayCircleOutlined />}>
                发放
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  const recordColumns = [
    {
      title: '用户',
      key: 'user',
      render: (_: unknown, record: DividendRecord) => (
        <Space direction="vertical" size={0}>
          <Text>{record.user?.nickname || record.user?.email || '-'}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.user?.id?.slice(0, 8)}...</Text>
        </Space>
      ),
    },
    {
      title: '质押数量',
      dataIndex: 'stakedAmount',
      key: 'stakedAmount',
      render: (val: string) => `${parseFloat(val).toLocaleString()} HOOT`,
    },
    {
      title: '加权数量',
      dataIndex: 'weightedAmount',
      key: 'weightedAmount',
      render: (val: string) => parseFloat(val).toLocaleString(),
    },
    {
      title: '分红金额',
      dataIndex: 'dividendAmount',
      key: 'dividendAmount',
      render: (amount: string) => (
        <span style={{ fontWeight: 600, color: '#52c41a' }}>
          ${parseFloat(amount).toFixed(2)}
        </span>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'paid' ? 'success' : 'default'}>
          {status === 'paid' ? '已到账' : '待发放'}
        </Tag>
      ),
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
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreatePool}>
            创建分红池
          </Button>
        </Space>
      }
    >
      <Spin spinning={loading}>
        {/* 统计卡片 */}
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={6}>
            <Card size="small">
              <Statistic
                title="累计分红"
                value={parseFloat(overview?.totalDistributed || '0')}
                precision={2}
                prefix={<DollarOutlined />}
                valueStyle={{ color: '#52c41a' }}
                suffix="USDT"
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Statistic
                title="当前分红池"
                value={parseFloat(overview?.currentPoolAmount || '0')}
                precision={2}
                prefix="$"
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Statistic
                title="参与质押用户"
                value={overview?.currentPoolStakers || 0}
                suffix="人"
                valueStyle={{ color: '#722ed1' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Statistic
                title="下次发放时间"
                value={overview?.nextDistributionDate ? new Date(overview.nextDistributionDate).toLocaleDateString() : '待定'}
                valueStyle={{ color: '#faad14', fontSize: 20 }}
              />
            </Card>
          </Col>
        </Row>

        {/* 筛选区域 */}
        <Card style={{ marginBottom: 16 }} size="small">
          <Space wrap>
            <Select
              placeholder="状态"
              style={{ width: 120 }}
              allowClear
              options={[
                { label: '收集中', value: 'collecting' },
                { label: '待发放', value: 'pending' },
                { label: '已完成', value: 'completed' },
              ]}
            />
            <RangePicker placeholder={['开始日期', '结束日期']} />
          </Space>
        </Card>

        {/* 数据表格 */}
        <Table
          dataSource={pools}
          columns={columns}
          rowKey="id"
          scroll={{ x: 900 }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`,
          }}
          locale={{ emptyText: <Empty description="暂无分红记录" /> }}
        />
      </Spin>

      {/* 分红明细 Modal */}
      <Modal
        title={`分红明细 - 第 ${selectedPool?.weekNumber || ''} 周`}
        open={detailVisible}
        onCancel={() => {
          setDetailVisible(false);
          setSelectedPool(null);
          setPoolRecords([]);
        }}
        footer={null}
        width={900}
      >
        {selectedPool && (
          <>
            <Descriptions bordered column={2} style={{ marginBottom: 24 }}>
              <Descriptions.Item label="周期">
                {new Date(selectedPool.periodStart).toLocaleDateString()} - {new Date(selectedPool.periodEnd).toLocaleDateString()}
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag icon={statusIcons[selectedPool.status]} color={statusColors[selectedPool.status]}>
                  {statusLabels[selectedPool.status]}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="燃油费收入">
                ${parseFloat(selectedPool.gasFeeTotal).toFixed(2)} ({selectedPool.gasFeeCount} 笔)
              </Descriptions.Item>
              <Descriptions.Item label="分红池总额">
                ${parseFloat(selectedPool.totalAmount).toFixed(2)}
              </Descriptions.Item>
              <Descriptions.Item label="总权重">
                {parseFloat(selectedPool.totalWeight).toLocaleString()}
              </Descriptions.Item>
              <Descriptions.Item label="参与人数">
                {selectedPool.stakerCount} 人
              </Descriptions.Item>
              <Descriptions.Item label="每权重收益">
                ${parseFloat(selectedPool.perWeightAmount).toFixed(8)}
              </Descriptions.Item>
              <Descriptions.Item label="已发放金额">
                ${parseFloat(selectedPool.distributedAmount).toFixed(2)}
              </Descriptions.Item>
            </Descriptions>

            <Title level={5}>用户分红明细</Title>
            <Table
              dataSource={poolRecords}
              columns={recordColumns}
              rowKey="id"
              loading={recordsLoading}
              scroll={{ x: 600 }}
              pagination={{ pageSize: 10 }}
              size="small"
              locale={{ emptyText: <Empty description="暂无分红明细" /> }}
            />
          </>
        )}
      </Modal>
    </List>
  );
};
