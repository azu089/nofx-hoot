/**
 * 权重明细页面
 * HOOT 生态权重查看
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
  Progress,
  Input,
  Select,
  DatePicker,
  Button,
  Typography,
  Tooltip,
} from 'antd';
import {
  SearchOutlined,
  InfoCircleOutlined,
  RiseOutlined,
  FallOutlined,
} from '@ant-design/icons';
import { useState } from 'react';

const { RangePicker } = DatePicker;
const { Text } = Typography;

interface IWeightRecord {
  id: string;
  userId: string;
  username: string;
  stakeType: 'A' | 'B';
  stakeAmount: string;
  baseWeight: number;
  timeMultiplier: number;
  totalWeight: number;
  weightShare: string;
  lockDays: number;
  startDate: string;
  endDate: string;
  status: 'active' | 'released' | 'pending';
}

// 模拟数据
const mockWeights: IWeightRecord[] = [
  {
    id: '1',
    userId: 'u1',
    username: 'crypto_whale',
    stakeType: 'B',
    stakeAmount: '1000000',
    baseWeight: 1000000,
    timeMultiplier: 2.5,
    totalWeight: 2500000,
    weightShare: '8.33',
    lockDays: 180,
    startDate: '2024-07-15',
    endDate: '2025-01-12',
    status: 'active',
  },
  {
    id: '2',
    userId: 'u2',
    username: 'trader_001',
    stakeType: 'A',
    stakeAmount: '500000',
    baseWeight: 500000,
    timeMultiplier: 1.0,
    totalWeight: 500000,
    weightShare: '1.67',
    lockDays: 0,
    startDate: '2025-01-01',
    endDate: '-',
    status: 'active',
  },
  {
    id: '3',
    userId: 'u3',
    username: 'diamond_hands',
    stakeType: 'B',
    stakeAmount: '2000000',
    baseWeight: 2000000,
    timeMultiplier: 3.0,
    totalWeight: 6000000,
    weightShare: '20.00',
    lockDays: 365,
    startDate: '2024-01-30',
    endDate: '2025-01-30',
    status: 'pending',
  },
  {
    id: '4',
    userId: 'u4',
    username: 'early_investor',
    stakeType: 'B',
    stakeAmount: '800000',
    baseWeight: 800000,
    timeMultiplier: 2.0,
    totalWeight: 1600000,
    weightShare: '5.33',
    lockDays: 90,
    startDate: '2024-10-01',
    endDate: '2024-12-31',
    status: 'released',
  },
];

// 统计数据
const mockStats = {
  totalWeight: 30000000,
  totalStakers: 892,
  avgMultiplier: 1.85,
  typeAShare: 35,
  typeBShare: 65,
};

export const WeightsPage = () => {
  const [dataSource] = useState<IWeightRecord[]>(mockWeights);

  const statusColors = {
    active: 'green',
    released: 'default',
    pending: 'orange',
  };

  const statusLabels = {
    active: '生效中',
    released: '已释放',
    pending: '待释放',
  };

  const columns = [
    {
      title: '用户',
      key: 'user',
      width: 160,
      render: (_: unknown, record: IWeightRecord) => (
        <div>
          <div style={{ fontWeight: 500 }}>{record.username}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.userId}</Text>
        </div>
      ),
    },
    {
      title: '质押类型',
      dataIndex: 'stakeType',
      key: 'stakeType',
      width: 100,
      render: (type: string) => (
        <Tag color={type === 'A' ? 'blue' : 'purple'}>
          {type === 'A' ? '活期 (A)' : '定期 (B)'}
        </Tag>
      ),
      filters: [
        { text: '活期 (A)', value: 'A' },
        { text: '定期 (B)', value: 'B' },
      ],
      onFilter: (value: unknown, record: IWeightRecord) => record.stakeType === value,
    },
    {
      title: '质押数量',
      dataIndex: 'stakeAmount',
      key: 'stakeAmount',
      width: 140,
      render: (amount: string) => (
        <span style={{ fontWeight: 500, color: '#1890ff' }}>
          {parseFloat(amount).toLocaleString()} HOOT
        </span>
      ),
      sorter: (a: IWeightRecord, b: IWeightRecord) => parseFloat(a.stakeAmount) - parseFloat(b.stakeAmount),
    },
    {
      title: (
        <Space>
          基础权重
          <Tooltip title="基础权重 = 质押数量">
            <InfoCircleOutlined style={{ color: '#999' }} />
          </Tooltip>
        </Space>
      ),
      dataIndex: 'baseWeight',
      key: 'baseWeight',
      width: 120,
      render: (weight: number) => weight.toLocaleString(),
    },
    {
      title: (
        <Space>
          时间乘数
          <Tooltip title="A类固定1.0x，B类随锁定时间增加（最高3.0x）">
            <InfoCircleOutlined style={{ color: '#999' }} />
          </Tooltip>
        </Space>
      ),
      dataIndex: 'timeMultiplier',
      key: 'timeMultiplier',
      width: 100,
      render: (multiplier: number) => (
        <Tag color={multiplier >= 2 ? 'gold' : multiplier > 1 ? 'green' : 'default'}>
          {multiplier.toFixed(1)}x
        </Tag>
      ),
    },
    {
      title: '总权重',
      dataIndex: 'totalWeight',
      key: 'totalWeight',
      width: 140,
      render: (weight: number) => (
        <span style={{ fontWeight: 600, color: '#52c41a' }}>
          {weight.toLocaleString()}
        </span>
      ),
      sorter: (a: IWeightRecord, b: IWeightRecord) => a.totalWeight - b.totalWeight,
    },
    {
      title: '权重占比',
      dataIndex: 'weightShare',
      key: 'weightShare',
      width: 140,
      render: (share: string) => (
        <Space>
          <Progress
            percent={parseFloat(share)}
            size="small"
            style={{ width: 60 }}
            showInfo={false}
            strokeColor="#722ed1"
          />
          <span>{share}%</span>
        </Space>
      ),
      sorter: (a: IWeightRecord, b: IWeightRecord) => parseFloat(a.weightShare) - parseFloat(b.weightShare),
    },
    {
      title: '锁定天数',
      dataIndex: 'lockDays',
      key: 'lockDays',
      width: 100,
      render: (days: number) => (
        days === 0 ? <Text type="secondary">无锁定</Text> : `${days} 天`
      ),
    },
    {
      title: '质押期限',
      key: 'period',
      width: 160,
      render: (_: unknown, record: IWeightRecord) => (
        <div style={{ fontSize: 12 }}>
          <div>{record.startDate}</div>
          <div>至 {record.endDate}</div>
        </div>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: keyof typeof statusColors) => (
        <Tag color={statusColors[status]}>{statusLabels[status]}</Tag>
      ),
      filters: [
        { text: '生效中', value: 'active' },
        { text: '已释放', value: 'released' },
        { text: '待释放', value: 'pending' },
      ],
      onFilter: (value: unknown, record: IWeightRecord) => record.status === value,
    },
  ];

  return (
    <List>
      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={5}>
          <Card>
            <Statistic
              title="总权重池"
              value={mockStats.totalWeight}
              valueStyle={{ color: '#722ed1' }}
              suffix="W"
              formatter={(value) => `${(Number(value) / 10000).toFixed(0)}`}
            />
          </Card>
        </Col>
        <Col span={5}>
          <Card>
            <Statistic
              title="质押用户数"
              value={mockStats.totalStakers}
              valueStyle={{ color: '#1890ff' }}
              suffix="人"
            />
          </Card>
        </Col>
        <Col span={5}>
          <Card>
            <Statistic
              title="平均乘数"
              value={mockStats.avgMultiplier}
              precision={2}
              valueStyle={{ color: '#52c41a' }}
              suffix="x"
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="A类占比"
              value={mockStats.typeAShare}
              valueStyle={{ color: '#1890ff' }}
              suffix="%"
              prefix={<FallOutlined />}
            />
          </Card>
        </Col>
        <Col span={5}>
          <Card>
            <Statistic
              title="B类占比"
              value={mockStats.typeBShare}
              valueStyle={{ color: '#722ed1' }}
              suffix="%"
              prefix={<RiseOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* 权重说明 */}
      <Card style={{ marginBottom: 16 }}>
        <Space direction="vertical" size={4}>
          <Text strong>权重计算规则：</Text>
          <Text type="secondary">
            • A类（活期）：权重 = 质押数量 × 1.0，无锁定期，随时可赎回
          </Text>
          <Text type="secondary">
            • B类（定期）：权重 = 质押数量 × 时间乘数（1.0x ~ 3.0x），乘数随锁定时间递增
          </Text>
          <Text type="secondary">
            • 时间乘数公式：min(1 + 锁定天数 / 180, 3.0)
          </Text>
        </Space>
      </Card>

      {/* 筛选区域 */}
      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input
            placeholder="搜索用户名/ID"
            prefix={<SearchOutlined />}
            style={{ width: 200 }}
          />
          <Select
            placeholder="质押类型"
            style={{ width: 120 }}
            allowClear
            options={[
              { label: '活期 (A)', value: 'A' },
              { label: '定期 (B)', value: 'B' },
            ]}
          />
          <Select
            placeholder="状态"
            style={{ width: 120 }}
            allowClear
            options={[
              { label: '生效中', value: 'active' },
              { label: '已释放', value: 'released' },
              { label: '待释放', value: 'pending' },
            ]}
          />
          <RangePicker placeholder={['开始日期', '结束日期']} />
          <Button type="primary" icon={<SearchOutlined />}>
            搜索
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
        scroll={{ x: 1400 }}
      />
    </List>
  );
};
