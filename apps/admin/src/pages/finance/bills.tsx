/**
 * 账单记录页面
 * 财务中心 - 所有交易记录
 */
import { useState } from 'react';
import { List, ExportButton } from '@refinedev/antd';
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
} from 'antd';
import {
  ArrowUpOutlined,
  ArrowDownOutlined,
  SwapOutlined,
} from '@ant-design/icons';

const { RangePicker } = DatePicker;

interface IBill {
  id: string;
  userId: string;
  username: string;
  type: 'deposit' | 'withdraw' | 'subscription' | 'profit_share' | 'gas_fee' | 'adjustment';
  amount: string;
  currency: 'USDT' | 'HOOT';
  status: 'success' | 'failed' | 'processing';
  createdAt: string;
  remark: string;
}

// 模拟数据
const mockBills: IBill[] = [
  {
    id: 'B001',
    userId: '1',
    username: 'trader_001',
    type: 'deposit',
    amount: '+1000.00',
    currency: 'USDT',
    status: 'success',
    createdAt: '2025-01-30 14:30:00',
    remark: '链上充值',
  },
  {
    id: 'B002',
    userId: '2',
    username: 'crypto_whale',
    type: 'withdraw',
    amount: '-500.00',
    currency: 'USDT',
    status: 'success',
    createdAt: '2025-01-30 12:15:00',
    remark: '提现到 0x1234...5678',
  },
  {
    id: 'B003',
    userId: '1',
    username: 'trader_001',
    type: 'subscription',
    amount: '-25.00',
    currency: 'USDT',
    status: 'success',
    createdAt: '2025-01-30 10:00:00',
    remark: '订阅 AI量化策略Alpha',
  },
  {
    id: 'B004',
    userId: '3',
    username: 'newbie_2024',
    type: 'profit_share',
    amount: '-12.50',
    currency: 'USDT',
    status: 'success',
    createdAt: '2025-01-29 18:00:00',
    remark: '策略盈利分成 (20%)',
  },
  {
    id: 'B005',
    userId: '2',
    username: 'crypto_whale',
    type: 'gas_fee',
    amount: '-5.00',
    currency: 'USDT',
    status: 'success',
    createdAt: '2025-01-29 15:30:00',
    remark: '交易燃油费',
  },
  {
    id: 'B006',
    userId: '1',
    username: 'trader_001',
    type: 'adjustment',
    amount: '+100.00',
    currency: 'USDT',
    status: 'success',
    createdAt: '2025-01-28 10:00:00',
    remark: '活动奖励 - 管理员调整',
  },
  {
    id: 'B007',
    userId: '4',
    username: 'test_user',
    type: 'withdraw',
    amount: '-200.00',
    currency: 'USDT',
    status: 'processing',
    createdAt: '2025-01-30 16:00:00',
    remark: '提现处理中',
  },
];

export const BillList = () => {
  const [dataSource] = useState<IBill[]>(mockBills);

  const typeConfig = {
    deposit: { color: 'green', label: '充值', icon: <ArrowDownOutlined /> },
    withdraw: { color: 'red', label: '提现', icon: <ArrowUpOutlined /> },
    subscription: { color: 'blue', label: '订阅', icon: <SwapOutlined /> },
    profit_share: { color: 'purple', label: '分成', icon: <SwapOutlined /> },
    gas_fee: { color: 'orange', label: '燃油费', icon: <SwapOutlined /> },
    adjustment: { color: 'cyan', label: '调整', icon: <SwapOutlined /> },
  };

  const statusConfig = {
    success: { color: 'success', label: '成功' },
    failed: { color: 'error', label: '失败' },
    processing: { color: 'processing', label: '处理中' },
  };

  // 统计数据
  const todayDeposit = mockBills
    .filter((b) => b.type === 'deposit' && b.status === 'success')
    .reduce((sum, b) => sum + parseFloat(b.amount), 0);
  const todayWithdraw = mockBills
    .filter((b) => b.type === 'withdraw' && b.status === 'success')
    .reduce((sum, b) => sum + Math.abs(parseFloat(b.amount)), 0);
  const todayFee = mockBills
    .filter(
      (b) =>
        ['subscription', 'profit_share', 'gas_fee'].includes(b.type) &&
        b.status === 'success'
    )
    .reduce((sum, b) => sum + Math.abs(parseFloat(b.amount)), 0);

  const columns = [
    {
      title: '账单ID',
      dataIndex: 'id',
      key: 'id',
      width: 100,
    },
    {
      title: '用户',
      key: 'user',
      render: (_: unknown, record: IBill) => (
        <div>
          <div style={{ fontWeight: 500 }}>{record.username}</div>
          <div style={{ fontSize: 12, color: '#999' }}>ID: {record.userId}</div>
        </div>
      ),
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: (type: keyof typeof typeConfig) => (
        <Tag color={typeConfig[type].color}>{typeConfig[type].label}</Tag>
      ),
    },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      width: 140,
      render: (amount: string, record: IBill) => {
        const isPositive = amount.startsWith('+');
        return (
          <span
            style={{
              color: isPositive ? '#52c41a' : '#f5222d',
              fontWeight: 500,
            }}
          >
            {amount} {record.currency}
          </span>
        );
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: keyof typeof statusConfig) => (
        <Tag color={statusConfig[status].color}>
          {statusConfig[status].label}
        </Tag>
      ),
    },
    {
      title: '时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
    },
    {
      title: '备注',
      dataIndex: 'remark',
      key: 'remark',
      ellipsis: true,
    },
  ];

  return (
    <List
      headerButtons={
        <ExportButton>导出</ExportButton>
      }
    >
      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card>
            <Statistic
              title="今日充值"
              value={todayDeposit}
              precision={2}
              prefix="$"
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="今日提现"
              value={todayWithdraw}
              precision={2}
              prefix="$"
              valueStyle={{ color: '#f5222d' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="今日收入 (订阅+分成+燃油费)"
              value={todayFee}
              precision={2}
              prefix="$"
              valueStyle={{ color: '#1890ff' }}
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
            placeholder="账单类型"
            style={{ width: 120 }}
            allowClear
            options={[
              { label: '充值', value: 'deposit' },
              { label: '提现', value: 'withdraw' },
              { label: '订阅', value: 'subscription' },
              { label: '分成', value: 'profit_share' },
              { label: '燃油费', value: 'gas_fee' },
              { label: '调整', value: 'adjustment' },
            ]}
          />
          <Select
            placeholder="状态"
            style={{ width: 100 }}
            allowClear
            options={[
              { label: '成功', value: 'success' },
              { label: '失败', value: 'failed' },
              { label: '处理中', value: 'processing' },
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
