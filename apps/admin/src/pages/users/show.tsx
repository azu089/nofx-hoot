/**
 * 用户详情页面
 * 查看用户信息、资产、订阅记录、操作日志
 */
import { Show } from '@refinedev/antd';
import {
  Card,
  Descriptions,
  Tag,
  Table,
  Tabs,
  Typography,
  Space,
  Avatar,
  Button,
  Statistic,
  Row,
  Col,
  Timeline,
} from 'antd';
import {
  UserOutlined,
  WalletOutlined,
  HistoryOutlined,
  DollarOutlined,
  EditOutlined,
  CreditCardOutlined,
  GiftOutlined,
  TeamOutlined,
  RiseOutlined,
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;

// 模拟用户数据
const mockUser = {
  id: '1',
  email: 'user1@example.com',
  username: 'trader_001',
  phone: '+86 138****8888',
  status: 'active',
  usdtBalance: '12500.00',
  usdtFrozen: '500.00',
  hootBalance: '50000',
  hootFrozen: '10000',
  pointCards: 15,
  walletAddress: '0x1234...5678',
  registerSource: 'email',
  inviter: 'agent_001',
  kycStatus: 'verified',
  createdAt: '2024-01-15 10:30:00',
  lastLoginAt: '2025-01-30 14:32:00',
};

// 模拟订阅记录
const mockSubscriptions = [
  {
    id: '1',
    strategyName: 'AI量化策略Alpha',
    startDate: '2025-01-01',
    status: 'active',
    monthlyFee: '25 USDT',
  },
  {
    id: '2',
    strategyName: '稳健网格策略',
    startDate: '2024-12-15',
    status: 'expired',
    monthlyFee: '15 USDT',
  },
];

// 模拟操作日志
const mockLogs = [
  { time: '2025-01-30 14:32', action: '登录', detail: 'IP: 192.168.1.1' },
  { time: '2025-01-29 10:00', action: '充值', detail: '+1000 USDT' },
  { time: '2025-01-28 15:30', action: '订阅策略', detail: 'AI量化策略Alpha' },
  { time: '2025-01-25 09:15', action: '提现申请', detail: '-500 USDT' },
];

// 模拟资产调整记录
const mockAssetLogs = [
  {
    id: '1',
    time: '2025-01-20 10:00',
    type: '增加',
    amount: '+100 USDT',
    reason: '活动奖励',
    operator: 'admin',
  },
  {
    id: '2',
    time: '2025-01-15 14:30',
    type: '减少',
    amount: '-50 USDT',
    reason: '扣除违规收益',
    operator: 'super_admin',
  },
];

// 模拟点卡购买记录
const mockPointCardPurchases = [
  {
    id: '1',
    time: '2025-01-28 09:30',
    amount: 10,
    price: '100 USDT',
    payMethod: 'USDT余额',
    status: 'success',
  },
  {
    id: '2',
    time: '2025-01-15 14:20',
    amount: 5,
    price: '50 USDT',
    payMethod: 'USDT余额',
    status: 'success',
  },
  {
    id: '3',
    time: '2025-01-01 10:00',
    amount: 20,
    price: '180 USDT',
    payMethod: '链上支付',
    status: 'success',
  },
];

// 模拟点卡消费记录
const mockPointCardConsumptions = [
  {
    id: '1',
    time: '2025-01-30 10:00',
    amount: 5,
    type: '策略订阅',
    detail: 'AI量化策略Alpha - 1个月',
  },
  {
    id: '2',
    time: '2025-01-25 15:30',
    amount: 3,
    type: '策略订阅',
    detail: '稳健网格策略 - 1个月',
  },
  {
    id: '3',
    time: '2025-01-20 09:00',
    amount: 10,
    type: 'VIP购买',
    detail: 'VIP1 - 1个月',
  },
  {
    id: '4',
    time: '2025-01-10 11:20',
    amount: 2,
    type: '功能解锁',
    detail: '高级回测功能',
  },
];

// 模拟邀请返佣记录
const mockCommissions = [
  {
    id: '1',
    time: '2025-01-30 14:00',
    fromUser: 'user_abc',
    level: 1,
    type: '燃油费返佣',
    sourceAmount: '20.00 USDT',
    rate: '10%',
    commission: '2.00 USDT',
  },
  {
    id: '2',
    time: '2025-01-29 16:30',
    fromUser: 'user_xyz',
    level: 2,
    type: '燃油费返佣',
    sourceAmount: '40.00 USDT',
    rate: '5%',
    commission: '2.00 USDT',
  },
  {
    id: '3',
    time: '2025-01-28 10:00',
    fromUser: 'user_abc',
    level: 1,
    type: '订阅返佣',
    sourceAmount: '25.00 USDT',
    rate: '10%',
    commission: '2.50 USDT',
  },
  {
    id: '4',
    time: '2025-01-25 12:00',
    fromUser: 'user_def',
    level: 1,
    type: '燃油费返佣',
    sourceAmount: '15.00 USDT',
    rate: '10%',
    commission: '1.50 USDT',
  },
  {
    id: '5',
    time: '2025-01-20 09:30',
    fromUser: 'user_ghi',
    level: 2,
    type: '订阅返佣',
    sourceAmount: '15.00 USDT',
    rate: '5%',
    commission: '0.75 USDT',
  },
];

// 模拟下级成员
const mockReferrals = [
  {
    id: '1',
    username: 'user_abc',
    email: 'abc@example.com',
    level: 1,
    registerTime: '2025-01-15 10:00',
    status: 'active',
    totalVolume: '5,200.00 USDT',
    totalCommission: '52.00 USDT',
  },
  {
    id: '2',
    username: 'user_def',
    email: 'def@example.com',
    level: 1,
    registerTime: '2025-01-20 14:30',
    status: 'active',
    totalVolume: '3,800.00 USDT',
    totalCommission: '38.00 USDT',
  },
  {
    id: '3',
    username: 'user_xyz',
    email: 'xyz@example.com',
    level: 2,
    registerTime: '2025-01-22 09:00',
    status: 'active',
    totalVolume: '2,100.00 USDT',
    totalCommission: '10.50 USDT',
  },
  {
    id: '4',
    username: 'user_ghi',
    email: 'ghi@example.com',
    level: 2,
    registerTime: '2025-01-25 11:00',
    status: 'frozen',
    totalVolume: '800.00 USDT',
    totalCommission: '4.00 USDT',
  },
];

// 返佣统计
const commissionStats = {
  totalCommission: '108.75',
  monthCommission: '8.75',
  level1Count: 2,
  level2Count: 2,
  level1Commission: '94.00',
  level2Commission: '14.75',
};

// 点卡统计
const pointCardStats = {
  totalPurchased: 35,
  totalConsumed: 20,
  remaining: 15,
  totalSpent: '330.00',
};

export const UserShow = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const statusColors = {
    active: 'green',
    frozen: 'orange',
    banned: 'red',
  };

  const statusLabels = {
    active: '正常',
    frozen: '冻结',
    banned: '封禁',
  };

  const subscriptionColumns = [
    { title: '策略名称', dataIndex: 'strategyName', key: 'strategyName' },
    { title: '订阅时间', dataIndex: 'startDate', key: 'startDate' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'active' ? 'green' : 'default'}>
          {status === 'active' ? '生效中' : '已过期'}
        </Tag>
      ),
    },
    { title: '月费', dataIndex: 'monthlyFee', key: 'monthlyFee' },
  ];

  const assetLogColumns = [
    { title: '时间', dataIndex: 'time', key: 'time' },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => (
        <Tag color={type === '增加' ? 'green' : 'red'}>{type}</Tag>
      ),
    },
    { title: '金额', dataIndex: 'amount', key: 'amount' },
    { title: '原因', dataIndex: 'reason', key: 'reason' },
    { title: '操作人', dataIndex: 'operator', key: 'operator' },
  ];

  // 点卡购买记录列
  const pointCardPurchaseColumns = [
    { title: '时间', dataIndex: 'time', key: 'time' },
    { title: '数量', dataIndex: 'amount', key: 'amount', render: (v: number) => `${v} 张` },
    { title: '支付金额', dataIndex: 'price', key: 'price' },
    { title: '支付方式', dataIndex: 'payMethod', key: 'payMethod' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'success' ? 'green' : 'red'}>
          {status === 'success' ? '成功' : '失败'}
        </Tag>
      ),
    },
  ];

  // 点卡消费记录列
  const pointCardConsumptionColumns = [
    { title: '时间', dataIndex: 'time', key: 'time' },
    { title: '消费数量', dataIndex: 'amount', key: 'amount', render: (v: number) => `-${v} 张` },
    {
      title: '消费类型',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => {
        const colors: Record<string, string> = {
          '策略订阅': 'blue',
          'VIP购买': 'purple',
          '功能解锁': 'cyan',
        };
        return <Tag color={colors[type] || 'default'}>{type}</Tag>;
      },
    },
    { title: '消费详情', dataIndex: 'detail', key: 'detail' },
  ];

  // 返佣记录列
  const commissionColumns = [
    { title: '时间', dataIndex: 'time', key: 'time' },
    { title: '来源用户', dataIndex: 'fromUser', key: 'fromUser' },
    {
      title: '层级',
      dataIndex: 'level',
      key: 'level',
      render: (level: number) => (
        <Tag color={level === 1 ? 'blue' : 'cyan'}>
          {level === 1 ? '一级' : '二级'}
        </Tag>
      ),
    },
    {
      title: '返佣类型',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => (
        <Tag color={type === '燃油费返佣' ? 'orange' : 'green'}>{type}</Tag>
      ),
    },
    { title: '来源金额', dataIndex: 'sourceAmount', key: 'sourceAmount' },
    { title: '返佣比例', dataIndex: 'rate', key: 'rate' },
    {
      title: '返佣金额',
      dataIndex: 'commission',
      key: 'commission',
      render: (v: string) => <Text strong style={{ color: '#52c41a' }}>+{v}</Text>,
    },
  ];

  // 下级成员列
  const referralColumns = [
    { title: '用户名', dataIndex: 'username', key: 'username' },
    { title: '邮箱', dataIndex: 'email', key: 'email' },
    {
      title: '层级',
      dataIndex: 'level',
      key: 'level',
      render: (level: number) => (
        <Tag color={level === 1 ? 'blue' : 'cyan'}>
          {level === 1 ? '一级下级' : '二级下级'}
        </Tag>
      ),
    },
    { title: '注册时间', dataIndex: 'registerTime', key: 'registerTime' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'active' ? 'green' : 'orange'}>
          {status === 'active' ? '正常' : '冻结'}
        </Tag>
      ),
    },
    { title: '累计交易额', dataIndex: 'totalVolume', key: 'totalVolume' },
    {
      title: '贡献返佣',
      dataIndex: 'totalCommission',
      key: 'totalCommission',
      render: (v: string) => <Text style={{ color: '#52c41a' }}>{v}</Text>,
    },
  ];

  const tabItems = [
    {
      key: 'info',
      label: (
        <span>
          <UserOutlined /> 基本信息
        </span>
      ),
      children: (
        <Card>
          <Descriptions column={2} bordered>
            <Descriptions.Item label="用户ID">{mockUser.id}</Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={statusColors[mockUser.status as keyof typeof statusColors]}>
                {statusLabels[mockUser.status as keyof typeof statusLabels]}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="邮箱">{mockUser.email}</Descriptions.Item>
            <Descriptions.Item label="用户名">{mockUser.username}</Descriptions.Item>
            <Descriptions.Item label="手机号">{mockUser.phone}</Descriptions.Item>
            <Descriptions.Item label="钱包地址">{mockUser.walletAddress}</Descriptions.Item>
            <Descriptions.Item label="注册来源">
              {mockUser.registerSource === 'email' ? '邮箱注册' : '钱包注册'}
            </Descriptions.Item>
            <Descriptions.Item label="邀请人">{mockUser.inviter || '-'}</Descriptions.Item>
            <Descriptions.Item label="KYC状态">
              <Tag color={mockUser.kycStatus === 'verified' ? 'green' : 'orange'}>
                {mockUser.kycStatus === 'verified' ? '已认证' : '未认证'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="注册时间">{mockUser.createdAt}</Descriptions.Item>
            <Descriptions.Item label="最后登录" span={2}>
              {mockUser.lastLoginAt}
            </Descriptions.Item>
          </Descriptions>
        </Card>
      ),
    },
    {
      key: 'assets',
      label: (
        <span>
          <WalletOutlined /> 资产信息
        </span>
      ),
      children: (
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <Row gutter={16}>
            <Col span={5}>
              <Card>
                <Statistic
                  title="USDT 可用"
                  value={parseFloat(mockUser.usdtBalance)}
                  precision={2}
                  prefix="$"
                  valueStyle={{ color: '#52c41a' }}
                />
              </Card>
            </Col>
            <Col span={5}>
              <Card>
                <Statistic
                  title="USDT 冻结"
                  value={parseFloat(mockUser.usdtFrozen)}
                  precision={2}
                  prefix="$"
                  valueStyle={{ color: '#faad14' }}
                />
              </Card>
            </Col>
            <Col span={5}>
              <Card>
                <Statistic
                  title="HOOT 可用"
                  value={parseFloat(mockUser.hootBalance)}
                  valueStyle={{ color: '#1890ff' }}
                />
              </Card>
            </Col>
            <Col span={5}>
              <Card>
                <Statistic
                  title="HOOT 冻结"
                  value={parseFloat(mockUser.hootFrozen)}
                  valueStyle={{ color: '#faad14' }}
                />
              </Card>
            </Col>
            <Col span={4}>
              <Card>
                <Statistic
                  title="点卡"
                  value={mockUser.pointCards}
                  suffix="张"
                  valueStyle={{ color: '#d4b106' }}
                />
              </Card>
            </Col>
          </Row>

          <Card
            title="资产调整记录"
            extra={
              <Button
                type="primary"
                icon={<EditOutlined />}
                onClick={() => navigate(`/users/${id}/edit`)}
              >
                调整资产
              </Button>
            }
          >
            <Table
              dataSource={mockAssetLogs}
              columns={assetLogColumns}
              rowKey="id"
              pagination={false}
            />
          </Card>
        </Space>
      ),
    },
    {
      key: 'subscriptions',
      label: (
        <span>
          <DollarOutlined /> 订阅记录
        </span>
      ),
      children: (
        <Card>
          <Table
            dataSource={mockSubscriptions}
            columns={subscriptionColumns}
            rowKey="id"
            pagination={false}
          />
        </Card>
      ),
    },
    {
      key: 'logs',
      label: (
        <span>
          <HistoryOutlined /> 操作日志
        </span>
      ),
      children: (
        <Card>
          <Timeline
            items={mockLogs.map((log) => ({
              children: (
                <div>
                  <Text strong>{log.action}</Text>
                  <Text type="secondary" style={{ marginLeft: 8 }}>
                    {log.detail}
                  </Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {log.time}
                  </Text>
                </div>
              ),
            }))}
          />
        </Card>
      ),
    },
    {
      key: 'pointCards',
      label: (
        <span>
          <CreditCardOutlined /> 点卡记录
        </span>
      ),
      children: (
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          {/* 点卡统计 */}
          <Row gutter={16}>
            <Col span={6}>
              <Card>
                <Statistic
                  title="累计购买"
                  value={pointCardStats.totalPurchased}
                  suffix="张"
                  valueStyle={{ color: '#1890ff' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="累计消费"
                  value={pointCardStats.totalConsumed}
                  suffix="张"
                  valueStyle={{ color: '#f5222d' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="当前剩余"
                  value={pointCardStats.remaining}
                  suffix="张"
                  valueStyle={{ color: '#52c41a' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="累计花费"
                  value={pointCardStats.totalSpent}
                  prefix="$"
                  valueStyle={{ color: '#722ed1' }}
                />
              </Card>
            </Col>
          </Row>

          {/* 购买记录 */}
          <Card title="购买记录" size="small">
            <Table
              dataSource={mockPointCardPurchases}
              columns={pointCardPurchaseColumns}
              rowKey="id"
              pagination={{ pageSize: 5 }}
              size="small"
            />
          </Card>

          {/* 消费记录 */}
          <Card title="消费记录" size="small">
            <Table
              dataSource={mockPointCardConsumptions}
              columns={pointCardConsumptionColumns}
              rowKey="id"
              pagination={{ pageSize: 5 }}
              size="small"
            />
          </Card>
        </Space>
      ),
    },
    {
      key: 'commissions',
      label: (
        <span>
          <GiftOutlined /> 邀请返佣
        </span>
      ),
      children: (
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          {/* 返佣统计 */}
          <Row gutter={16}>
            <Col span={4}>
              <Card>
                <Statistic
                  title="累计返佣"
                  value={commissionStats.totalCommission}
                  prefix="$"
                  valueStyle={{ color: '#52c41a' }}
                />
              </Card>
            </Col>
            <Col span={4}>
              <Card>
                <Statistic
                  title="本月返佣"
                  value={commissionStats.monthCommission}
                  prefix="$"
                  valueStyle={{ color: '#1890ff' }}
                />
              </Card>
            </Col>
            <Col span={4}>
              <Card>
                <Statistic
                  title="一级下级"
                  value={commissionStats.level1Count}
                  suffix="人"
                  valueStyle={{ color: '#722ed1' }}
                />
              </Card>
            </Col>
            <Col span={4}>
              <Card>
                <Statistic
                  title="二级下级"
                  value={commissionStats.level2Count}
                  suffix="人"
                  valueStyle={{ color: '#13c2c2' }}
                />
              </Card>
            </Col>
            <Col span={4}>
              <Card>
                <Statistic
                  title="一级返佣"
                  value={commissionStats.level1Commission}
                  prefix="$"
                  valueStyle={{ color: '#722ed1' }}
                />
              </Card>
            </Col>
            <Col span={4}>
              <Card>
                <Statistic
                  title="二级返佣"
                  value={commissionStats.level2Commission}
                  prefix="$"
                  valueStyle={{ color: '#13c2c2' }}
                />
              </Card>
            </Col>
          </Row>

          {/* 返佣规则说明 */}
          <Card size="small">
            <Space>
              <Tag color="blue">一级返佣 10%</Tag>
              <Tag color="cyan">二级返佣 5%</Tag>
              <Text type="secondary">返佣来源：下级燃油费 + 下级订阅费</Text>
            </Space>
          </Card>

          {/* 返佣明细 */}
          <Card title="返佣明细" size="small">
            <Table
              dataSource={mockCommissions}
              columns={commissionColumns}
              rowKey="id"
              pagination={{ pageSize: 10 }}
              size="small"
            />
          </Card>
        </Space>
      ),
    },
    {
      key: 'referrals',
      label: (
        <span>
          <TeamOutlined /> 下级成员
        </span>
      ),
      children: (
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          {/* 下级统计 */}
          <Row gutter={16}>
            <Col span={6}>
              <Card>
                <Statistic
                  title="一级下级"
                  value={commissionStats.level1Count}
                  suffix="人"
                  prefix={<TeamOutlined />}
                  valueStyle={{ color: '#1890ff' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="二级下级"
                  value={commissionStats.level2Count}
                  suffix="人"
                  prefix={<TeamOutlined />}
                  valueStyle={{ color: '#13c2c2' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="团队总人数"
                  value={commissionStats.level1Count + commissionStats.level2Count}
                  suffix="人"
                  valueStyle={{ color: '#722ed1' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="团队总贡献"
                  value={commissionStats.totalCommission}
                  prefix="$"
                  valueStyle={{ color: '#52c41a' }}
                />
              </Card>
            </Col>
          </Row>

          {/* 层级说明 */}
          <Card size="small">
            <Space>
              <Tag icon={<RiseOutlined />} color="blue">一级下级：直接邀请的用户</Tag>
              <Tag icon={<RiseOutlined />} color="cyan">二级下级：一级用户邀请的用户</Tag>
            </Space>
          </Card>

          {/* 下级成员列表 */}
          <Card title="成员列表" size="small">
            <Table
              dataSource={mockReferrals}
              columns={referralColumns}
              rowKey="id"
              pagination={{ pageSize: 10 }}
              size="small"
            />
          </Card>
        </Space>
      ),
    },
  ];

  return (
    <Show>
      <Card style={{ marginBottom: 16 }}>
        <Space size="large">
          <Avatar size={64} icon={<UserOutlined />} />
          <div>
            <Title level={4} style={{ margin: 0 }}>
              {mockUser.username}
            </Title>
            <Text type="secondary">{mockUser.email}</Text>
          </div>
        </Space>
      </Card>

      <Tabs items={tabItems} />
    </Show>
  );
};
