/**
 * 充值记录页面
 * 查看用户充值记录、审核充值
 */
import { List } from '@refinedev/antd';
import {
  Table,
  Tag,
  Space,
  Button,
  Input,
  Select,
  DatePicker,
  Card,
  Row,
  Col,
  Statistic,
  Typography,
  Tooltip,
  Modal,
  message,
} from 'antd';
import {
  SearchOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  CopyOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import { useState } from 'react';

const { RangePicker } = DatePicker;
const { Text } = Typography;

interface IDeposit {
  id: string;
  userId: string;
  username: string;
  amount: string;
  currency: 'USDT' | 'HOOT';
  txHash: string;
  fromAddress: string;
  toAddress: string;
  status: 'pending' | 'confirmed' | 'failed';
  confirmations: number;
  createdAt: string;
  confirmedAt: string | null;
}

// 模拟数据
const mockDeposits: IDeposit[] = [
  {
    id: '1',
    userId: 'u1',
    username: 'trader_001',
    amount: '5000.00',
    currency: 'USDT',
    txHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    fromAddress: '0xabc...def1',
    toAddress: '0x123...4567',
    status: 'confirmed',
    confirmations: 12,
    createdAt: '2025-01-30 10:30:00',
    confirmedAt: '2025-01-30 10:35:00',
  },
  {
    id: '2',
    userId: 'u2',
    username: 'crypto_whale',
    amount: '25000.00',
    currency: 'USDT',
    txHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    fromAddress: '0xdef...abc2',
    toAddress: '0x123...4567',
    status: 'pending',
    confirmations: 3,
    createdAt: '2025-01-30 11:00:00',
    confirmedAt: null,
  },
  {
    id: '3',
    userId: 'u3',
    username: 'newbie_2024',
    amount: '100000',
    currency: 'HOOT',
    txHash: '0x567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234',
    fromAddress: '0x111...2223',
    toAddress: '0x456...7890',
    status: 'confirmed',
    confirmations: 15,
    createdAt: '2025-01-29 15:20:00',
    confirmedAt: '2025-01-29 15:25:00',
  },
  {
    id: '4',
    userId: 'u4',
    username: 'failed_tx',
    amount: '1000.00',
    currency: 'USDT',
    txHash: '0x999999999999999999999999999999999999999999999999999999999999999',
    fromAddress: '0x999...8888',
    toAddress: '0x123...4567',
    status: 'failed',
    confirmations: 0,
    createdAt: '2025-01-28 09:00:00',
    confirmedAt: null,
  },
];

// 统计数据
const mockStats = {
  todayDeposits: 35000,
  todayCount: 12,
  pendingCount: 3,
  weekDeposits: 256000,
};

export const DepositsPage = () => {
  const [dataSource] = useState<IDeposit[]>(mockDeposits);

  const statusColors = {
    pending: 'processing',
    confirmed: 'success',
    failed: 'error',
  };

  const statusLabels = {
    pending: '确认中',
    confirmed: '已到账',
    failed: '失败',
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    message.success('已复制到剪贴板');
  };

  const showTxDetail = (record: IDeposit) => {
    Modal.info({
      title: '交易详情',
      width: 600,
      content: (
        <div style={{ marginTop: 16 }}>
          <p><strong>交易哈希:</strong></p>
          <p style={{ wordBreak: 'break-all', color: '#1890ff' }}>{record.txHash}</p>
          <p><strong>发送地址:</strong> {record.fromAddress}</p>
          <p><strong>接收地址:</strong> {record.toAddress}</p>
          <p><strong>金额:</strong> {record.amount} {record.currency}</p>
          <p><strong>确认数:</strong> {record.confirmations}</p>
          <p><strong>创建时间:</strong> {record.createdAt}</p>
          <p><strong>确认时间:</strong> {record.confirmedAt || '-'}</p>
        </div>
      ),
    });
  };

  const handleManualConfirm = (record: IDeposit) => {
    Modal.confirm({
      title: '手动确认充值',
      icon: <ExclamationCircleOutlined />,
      content: (
        <div>
          <p>确定要手动确认这笔充值吗？</p>
          <p>用户: <strong>{record.username}</strong></p>
          <p>金额: <strong>{record.amount} {record.currency}</strong></p>
          <p style={{ color: '#faad14' }}>请确保已在区块链上验证此交易！</p>
        </div>
      ),
      okText: '确认到账',
      cancelText: '取消',
      onOk() {
        message.success('充值已手动确认');
      },
    });
  };

  const columns = [
    {
      title: '订单ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: '用户',
      key: 'user',
      width: 140,
      render: (_: unknown, record: IDeposit) => (
        <div>
          <div style={{ fontWeight: 500 }}>{record.username}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.userId}</Text>
        </div>
      ),
    },
    {
      title: '金额',
      key: 'amount',
      width: 160,
      render: (_: unknown, record: IDeposit) => (
        <span style={{
          fontWeight: 600,
          color: record.currency === 'USDT' ? '#52c41a' : '#1890ff'
        }}>
          {record.currency === 'USDT' ? '$' : ''}{parseFloat(record.amount).toLocaleString()} {record.currency}
        </span>
      ),
    },
    {
      title: '交易哈希',
      dataIndex: 'txHash',
      key: 'txHash',
      width: 180,
      render: (hash: string) => (
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
      ),
    },
    {
      title: '确认数',
      dataIndex: 'confirmations',
      key: 'confirmations',
      width: 100,
      render: (confirmations: number) => (
        <Tag color={confirmations >= 12 ? 'green' : confirmations > 0 ? 'orange' : 'red'}>
          {confirmations}/12
        </Tag>
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
        { text: '确认中', value: 'pending' },
        { text: '已到账', value: 'confirmed' },
        { text: '失败', value: 'failed' },
      ],
      onFilter: (value: unknown, record: IDeposit) => record.status === value,
    },
    {
      title: '时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
    },
    {
      title: '操作',
      key: 'actions',
      width: 140,
      render: (_: unknown, record: IDeposit) => (
        <Space>
          <Tooltip title="查看详情">
            <Button
              size="small"
              icon={<EyeOutlined />}
              onClick={() => showTxDetail(record)}
            />
          </Tooltip>
          {record.status === 'pending' && (
            <>
              <Tooltip title="手动确认">
                <Button
                  size="small"
                  type="primary"
                  icon={<CheckCircleOutlined />}
                  onClick={() => handleManualConfirm(record)}
                />
              </Tooltip>
              <Tooltip title="标记失败">
                <Button
                  size="small"
                  danger
                  icon={<CloseCircleOutlined />}
                  onClick={() => {
                    Modal.confirm({
                      title: '标记为失败',
                      content: '确定要将此充值标记为失败吗？',
                      okText: '确定',
                      cancelText: '取消',
                      okButtonProps: { danger: true },
                      onOk() {
                        message.success('已标记为失败');
                      },
                    });
                  }}
                />
              </Tooltip>
            </>
          )}
        </Space>
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
              value={mockStats.todayDeposits}
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
              value={mockStats.todayCount}
              suffix="笔"
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="待确认"
              value={mockStats.pendingCount}
              suffix="笔"
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="本周充值总额"
              value={mockStats.weekDeposits}
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
          />
          <Select
            placeholder="币种"
            style={{ width: 120 }}
            allowClear
            options={[
              { label: 'USDT', value: 'USDT' },
              { label: 'HOOT', value: 'HOOT' },
            ]}
          />
          <Select
            placeholder="状态"
            style={{ width: 120 }}
            allowClear
            options={[
              { label: '确认中', value: 'pending' },
              { label: '已到账', value: 'confirmed' },
              { label: '失败', value: 'failed' },
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
      />
    </List>
  );
};
