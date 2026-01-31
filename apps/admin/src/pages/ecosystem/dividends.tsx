/**
 * 分红记录页面
 * HOOT 生态分红发放记录
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
} from 'antd';
import {
  SearchOutlined,
  DollarOutlined,
  EyeOutlined,
  DownloadOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import { useState } from 'react';

const { RangePicker } = DatePicker;
const { Text, Title } = Typography;

interface IDividendRecord {
  id: string;
  period: string;
  periodType: 'daily' | 'weekly' | 'monthly';
  totalPool: string;
  totalWeight: number;
  participantCount: number;
  perWeightAmount: string;
  status: 'pending' | 'processing' | 'completed';
  createdAt: string;
  completedAt: string | null;
}

interface IUserDividend {
  id: string;
  dividendId: string;
  userId: string;
  username: string;
  weight: number;
  weightShare: string;
  amount: string;
  status: 'pending' | 'credited';
  creditedAt: string | null;
}

// 模拟分红期数据
const mockDividends: IDividendRecord[] = [
  {
    id: 'd1',
    period: '2025-01-30',
    periodType: 'daily',
    totalPool: '15000.00',
    totalWeight: 30000000,
    participantCount: 892,
    perWeightAmount: '0.0005',
    status: 'completed',
    createdAt: '2025-01-30 00:00:00',
    completedAt: '2025-01-30 00:15:00',
  },
  {
    id: 'd2',
    period: '2025-01-29',
    periodType: 'daily',
    totalPool: '12500.00',
    totalWeight: 29500000,
    participantCount: 885,
    perWeightAmount: '0.00042',
    status: 'completed',
    createdAt: '2025-01-29 00:00:00',
    completedAt: '2025-01-29 00:12:00',
  },
  {
    id: 'd3',
    period: '2025-W04',
    periodType: 'weekly',
    totalPool: '85000.00',
    totalWeight: 30000000,
    participantCount: 892,
    perWeightAmount: '0.00283',
    status: 'completed',
    createdAt: '2025-01-27 00:00:00',
    completedAt: '2025-01-27 00:30:00',
  },
  {
    id: 'd4',
    period: '2025-01-31',
    periodType: 'daily',
    totalPool: '18000.00',
    totalWeight: 30500000,
    participantCount: 900,
    perWeightAmount: '0.00059',
    status: 'processing',
    createdAt: '2025-01-31 00:00:00',
    completedAt: null,
  },
];

// 模拟用户分红明细
const mockUserDividends: IUserDividend[] = [
  {
    id: 'ud1',
    dividendId: 'd1',
    userId: 'u1',
    username: 'crypto_whale',
    weight: 2500000,
    weightShare: '8.33',
    amount: '1250.00',
    status: 'credited',
    creditedAt: '2025-01-30 00:15:00',
  },
  {
    id: 'ud2',
    dividendId: 'd1',
    userId: 'u2',
    username: 'diamond_hands',
    weight: 6000000,
    weightShare: '20.00',
    amount: '3000.00',
    status: 'credited',
    creditedAt: '2025-01-30 00:15:00',
  },
  {
    id: 'ud3',
    dividendId: 'd1',
    userId: 'u3',
    username: 'trader_001',
    weight: 500000,
    weightShare: '1.67',
    amount: '250.00',
    status: 'credited',
    creditedAt: '2025-01-30 00:15:00',
  },
];

// 统计数据
const mockStats = {
  totalDistributed: 2580000,
  monthDistributed: 450000,
  todayDistributed: 15000,
  avgDaily: 14500,
};

export const DividendsPage = () => {
  const [dataSource] = useState<IDividendRecord[]>(mockDividends);
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedDividend, setSelectedDividend] = useState<IDividendRecord | null>(null);

  const statusColors = {
    pending: 'default',
    processing: 'processing',
    completed: 'success',
  };

  const statusLabels = {
    pending: '待发放',
    processing: '发放中',
    completed: '已完成',
  };

  const statusIcons = {
    pending: <ClockCircleOutlined />,
    processing: <SyncOutlined spin />,
    completed: <CheckCircleOutlined />,
  };

  const periodTypeLabels = {
    daily: '日分红',
    weekly: '周分红',
    monthly: '月分红',
  };

  const showDetail = (record: IDividendRecord) => {
    setSelectedDividend(record);
    setDetailVisible(true);
  };

  const columns = [
    {
      title: '分红期',
      dataIndex: 'period',
      key: 'period',
      width: 140,
      render: (period: string, record: IDividendRecord) => (
        <Space direction="vertical" size={0}>
          <Text strong>{period}</Text>
          <Tag color="blue">{periodTypeLabels[record.periodType]}</Tag>
        </Space>
      ),
    },
    {
      title: '分红池',
      dataIndex: 'totalPool',
      key: 'totalPool',
      width: 140,
      render: (amount: string) => (
        <span style={{ fontWeight: 600, color: '#52c41a' }}>
          ${parseFloat(amount).toLocaleString()} USDT
        </span>
      ),
      sorter: (a: IDividendRecord, b: IDividendRecord) => parseFloat(a.totalPool) - parseFloat(b.totalPool),
    },
    {
      title: '总权重',
      dataIndex: 'totalWeight',
      key: 'totalWeight',
      width: 140,
      render: (weight: number) => (
        <span style={{ color: '#722ed1' }}>
          {(weight / 10000).toLocaleString()} 万
        </span>
      ),
    },
    {
      title: '参与人数',
      dataIndex: 'participantCount',
      key: 'participantCount',
      width: 100,
      render: (count: number) => `${count} 人`,
    },
    {
      title: '每权重收益',
      dataIndex: 'perWeightAmount',
      key: 'perWeightAmount',
      width: 140,
      render: (amount: string) => (
        <Text type="secondary">${amount} USDT</Text>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: keyof typeof statusColors) => (
        <Tag icon={statusIcons[status]} color={statusColors[status]}>
          {statusLabels[status]}
        </Tag>
      ),
      filters: [
        { text: '待发放', value: 'pending' },
        { text: '发放中', value: 'processing' },
        { text: '已完成', value: 'completed' },
      ],
      onFilter: (value: unknown, record: IDividendRecord) => record.status === value,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
    },
    {
      title: '完成时间',
      dataIndex: 'completedAt',
      key: 'completedAt',
      width: 160,
      render: (time: string | null) => time || '-',
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      render: (_: unknown, record: IDividendRecord) => (
        <Space>
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => showDetail(record)}
          >
            明细
          </Button>
        </Space>
      ),
    },
  ];

  const userDividendColumns = [
    {
      title: '用户',
      key: 'user',
      render: (_: unknown, record: IUserDividend) => (
        <div>
          <div style={{ fontWeight: 500 }}>{record.username}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.userId}</Text>
        </div>
      ),
    },
    {
      title: '权重',
      dataIndex: 'weight',
      key: 'weight',
      render: (weight: number) => weight.toLocaleString(),
    },
    {
      title: '占比',
      dataIndex: 'weightShare',
      key: 'weightShare',
      render: (share: string) => `${share}%`,
    },
    {
      title: '分红金额',
      dataIndex: 'amount',
      key: 'amount',
      render: (amount: string) => (
        <span style={{ fontWeight: 600, color: '#52c41a' }}>
          ${amount} USDT
        </span>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'credited' ? 'success' : 'default'}>
          {status === 'credited' ? '已到账' : '待发放'}
        </Tag>
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
              title="累计分红"
              value={mockStats.totalDistributed}
              precision={2}
              prefix={<DollarOutlined />}
              valueStyle={{ color: '#52c41a' }}
              suffix="USDT"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="本月分红"
              value={mockStats.monthDistributed}
              precision={2}
              prefix="$"
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="今日分红"
              value={mockStats.todayDistributed}
              precision={2}
              prefix="$"
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="日均分红"
              value={mockStats.avgDaily}
              precision={2}
              prefix="$"
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 筛选区域 */}
      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <Select
            placeholder="分红类型"
            style={{ width: 120 }}
            allowClear
            options={[
              { label: '日分红', value: 'daily' },
              { label: '周分红', value: 'weekly' },
              { label: '月分红', value: 'monthly' },
            ]}
          />
          <Select
            placeholder="状态"
            style={{ width: 120 }}
            allowClear
            options={[
              { label: '待发放', value: 'pending' },
              { label: '发放中', value: 'processing' },
              { label: '已完成', value: 'completed' },
            ]}
          />
          <RangePicker placeholder={['开始日期', '结束日期']} />
          <Button type="primary" icon={<SearchOutlined />}>
            搜索
          </Button>
          <Button icon={<DownloadOutlined />}>
            导出报表
          </Button>
        </Space>
      </Card>

      {/* 数据表格 */}
      <Table
        dataSource={dataSource}
        columns={columns}
        rowKey="id"
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条`,
        }}
      />

      {/* 分红明细 Modal */}
      <Modal
        title={`分红明细 - ${selectedDividend?.period || ''}`}
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        width={800}
      >
        {selectedDividend && (
          <>
            <Descriptions bordered column={2} style={{ marginBottom: 24 }}>
              <Descriptions.Item label="分红期">{selectedDividend.period}</Descriptions.Item>
              <Descriptions.Item label="类型">
                <Tag color="blue">{periodTypeLabels[selectedDividend.periodType]}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="分红池">
                ${selectedDividend.totalPool} USDT
              </Descriptions.Item>
              <Descriptions.Item label="总权重">
                {selectedDividend.totalWeight.toLocaleString()}
              </Descriptions.Item>
              <Descriptions.Item label="参与人数">
                {selectedDividend.participantCount} 人
              </Descriptions.Item>
              <Descriptions.Item label="每权重收益">
                ${selectedDividend.perWeightAmount} USDT
              </Descriptions.Item>
            </Descriptions>

            <Title level={5}>用户分红明细</Title>
            <Table
              dataSource={mockUserDividends.filter(u => u.dividendId === selectedDividend.id)}
              columns={userDividendColumns}
              rowKey="id"
              pagination={false}
              size="small"
            />
          </>
        )}
      </Modal>
    </List>
  );
};
