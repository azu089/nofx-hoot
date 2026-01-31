/**
 * 质押记录页面
 * 生态中心 - 用户质押列表
 */
import { useState } from 'react';
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
} from 'antd';
import {
  LockOutlined,
  UnlockOutlined,
} from '@ant-design/icons';

const { RangePicker } = DatePicker;

interface IStaking {
  id: string;
  userId: string;
  username: string;
  type: 'A' | 'B';
  amount: string;
  lockDays: number;
  startTime: string;
  unlockTime: string;
  weight: string;
  status: 'staking' | 'unlocked' | 'cancelled';
}

// 模拟数据
const mockStakings: IStaking[] = [
  {
    id: '1',
    userId: '1',
    username: 'trader_001',
    type: 'B',
    amount: '50000',
    lockDays: 180,
    startTime: '2024-08-01',
    unlockTime: '2025-01-28',
    weight: '2.0x',
    status: 'staking',
  },
  {
    id: '2',
    userId: '2',
    username: 'crypto_whale',
    type: 'A',
    amount: '100000',
    lockDays: 0,
    startTime: '2025-01-15',
    unlockTime: '-',
    weight: '1.0x',
    status: 'staking',
  },
  {
    id: '3',
    userId: '3',
    username: 'newbie_2024',
    type: 'B',
    amount: '10000',
    lockDays: 90,
    startTime: '2024-11-01',
    unlockTime: '2025-01-30',
    weight: '1.5x',
    status: 'unlocked',
  },
  {
    id: '4',
    userId: '1',
    username: 'trader_001',
    type: 'B',
    amount: '20000',
    lockDays: 365,
    startTime: '2024-06-01',
    unlockTime: '2025-06-01',
    weight: '3.0x',
    status: 'staking',
  },
];

export const StakingList = () => {
  const [dataSource] = useState<IStaking[]>(mockStakings);

  // 统计数据
  const totalStaked = mockStakings
    .filter((s) => s.status === 'staking')
    .reduce((sum, s) => sum + parseFloat(s.amount), 0);
  const typeATotal = mockStakings
    .filter((s) => s.type === 'A' && s.status === 'staking')
    .reduce((sum, s) => sum + parseFloat(s.amount), 0);
  const typeBTotal = mockStakings
    .filter((s) => s.type === 'B' && s.status === 'staking')
    .reduce((sum, s) => sum + parseFloat(s.amount), 0);
  const stakingUsers = new Set(
    mockStakings.filter((s) => s.status === 'staking').map((s) => s.userId)
  ).size;

  const statusConfig = {
    staking: { color: 'success', label: '质押中', icon: <LockOutlined /> },
    unlocked: { color: 'default', label: '已解锁', icon: <UnlockOutlined /> },
    cancelled: { color: 'error', label: '已取消', icon: <UnlockOutlined /> },
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 60,
    },
    {
      title: '用户',
      key: 'user',
      render: (_: unknown, record: IStaking) => (
        <div>
          <div style={{ fontWeight: 500 }}>{record.username}</div>
          <div style={{ fontSize: 12, color: '#888' }}>ID: {record.userId}</div>
        </div>
      ),
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 80,
      render: (type: string) => (
        <Tag color={type === 'A' ? 'blue' : 'purple'}>
          {type}类
        </Tag>
      ),
      filters: [
        { text: 'A类', value: 'A' },
        { text: 'B类', value: 'B' },
      ],
      onFilter: (value: unknown, record: IStaking) => record.type === value,
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
      sorter: (a: IStaking, b: IStaking) => parseFloat(a.amount) - parseFloat(b.amount),
    },
    {
      title: '锁定天数',
      dataIndex: 'lockDays',
      key: 'lockDays',
      width: 100,
      render: (days: number) => (days === 0 ? '随时可取' : `${days} 天`),
    },
    {
      title: '权重',
      dataIndex: 'weight',
      key: 'weight',
      width: 100,
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
              {weight}
            </span>
          </Space>
        );
      },
    },
    {
      title: '开始时间',
      dataIndex: 'startTime',
      key: 'startTime',
      width: 120,
    },
    {
      title: '解锁时间',
      dataIndex: 'unlockTime',
      key: 'unlockTime',
      width: 120,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: keyof typeof statusConfig) => (
        <Tag
          color={statusConfig[status].color}
          icon={statusConfig[status].icon}
        >
          {statusConfig[status].label}
        </Tag>
      ),
      filters: [
        { text: '质押中', value: 'staking' },
        { text: '已解锁', value: 'unlocked' },
        { text: '已取消', value: 'cancelled' },
      ],
      onFilter: (value: unknown, record: IStaking) => record.status === value,
    },
  ];

  return (
    <List headerButtons={<ExportButton>导出</ExportButton>}>
      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="总质押量"
              value={totalStaked}
              suffix="HOOT"
              valueStyle={{ color: '#06B6D4' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="A类质押"
              value={typeATotal}
              suffix="HOOT"
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="B类质押"
              value={typeBTotal}
              suffix="HOOT"
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="质押用户数"
              value={stakingUsers}
              suffix="人"
            />
          </Card>
        </Col>
      </Row>

      {/* 筛选条件 */}
      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input.Search
            placeholder="搜索用户ID/用户名"
            style={{ width: 200 }}
            allowClear
          />
          <Select
            placeholder="质押类型"
            style={{ width: 120 }}
            allowClear
            options={[
              { label: 'A类', value: 'A' },
              { label: 'B类', value: 'B' },
            ]}
          />
          <Select
            placeholder="状态"
            style={{ width: 120 }}
            allowClear
            options={[
              { label: '质押中', value: 'staking' },
              { label: '已解锁', value: 'unlocked' },
            ]}
          />
          <RangePicker placeholder={['开始日期', '结束日期']} />
        </Space>
      </Card>

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
    </List>
  );
};
