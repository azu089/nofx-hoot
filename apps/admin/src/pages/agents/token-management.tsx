/**
 * 代理商代币管理页面
 * 包含：私募配额管理 + 交易分红池管理
 */
import {
  Card,
  Table,
  Tag,
  Space,
  Typography,
  Button,
  Modal,
  Form,
  InputNumber,
  Select,
  Row,
  Col,
  Statistic,
  Tabs,
  Alert,
  Spin,
  Empty,
  Popconfirm,
  Descriptions,
  Progress,
  Tooltip,
  DatePicker,
} from 'antd';
import {
  PlusOutlined,
  CheckOutlined,
  CloseOutlined,
  GoldOutlined,
  DollarOutlined,
  TeamOutlined,
  HistoryOutlined,
  SendOutlined,
  ReloadOutlined,
  InfoCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { useMessage } from '../../hooks';

const { Title, Text } = Typography;

// 配额类型
interface TokenQuota {
  id: string;
  agentId: string;
  agent: {
    id: string;
    name: string;
    email: string;
    level: string;
  };
  level: 'bronze' | 'silver' | 'gold' | 'platinum';
  quotaAmount: string;
  purchasePrice: string;
  purchaseAmount: string;
  vestingMonths: number;
  vestingStart: string | null;
  releasedAmount: string;
  lastReleaseAt: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'releasing' | 'completed';
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string;
}

// 分红池类型
interface DividendPool {
  id: string;
  periodStart: string;
  periodEnd: string;
  monthNumber: string;
  gasFeeTotal: string;
  poolRate: string;
  poolAmount: string;
  hootPrice: string;
  hootAmount: string;
  totalTradeVolume: string;
  distributedAmount: string;
  participantCount: number;
  status: 'pending' | 'calculating' | 'distributed';
  distributedAt: string | null;
  createdAt: string;
}

// 分红记录类型
interface DividendRecord {
  id: string;
  poolId: string;
  agentId: string;
  agent: {
    id: string;
    name: string;
    email: string;
  };
  userTradeVolume: string;
  contributionRate: string;
  dividendUsdt: string;
  dividendHoot: string;
  status: 'pending' | 'paid';
  paidAt: string | null;
  createdAt: string;
}

// 统计数据类型
interface TokenStats {
  totalQuotas: number;
  pendingQuotas: number;
  approvedQuotas: number;
  totalQuotaAmount: string;
  totalPurchaseAmount: string;
  totalReleasedAmount: string;
  totalDividendPools: number;
  totalDividendAmount: string;
  totalParticipants: number;
}

// 配额等级配置
const quotaLevelConfig = {
  bronze: { name: '青铜', discount: 0.7, color: '#cd7f32', vestingMonths: 12 },
  silver: { name: '白银', discount: 0.5, color: '#c0c0c0', vestingMonths: 10 },
  gold: { name: '黄金', discount: 0.3, color: '#ffd700', vestingMonths: 8 },
  platinum: { name: '铂金', discount: 0.2, color: '#e5e4e2', vestingMonths: 6 },
};

const statusConfig = {
  pending: { color: 'processing', text: '待审核' },
  approved: { color: 'success', text: '已批准' },
  rejected: { color: 'error', text: '已拒绝' },
  releasing: { color: 'warning', text: '释放中' },
  completed: { color: 'default', text: '已完成' },
  calculating: { color: 'processing', text: '计算中' },
  distributed: { color: 'success', text: '已分发' },
  paid: { color: 'success', text: '已支付' },
};

export const TokenManagementPage = () => {
  const message = useMessage();
  const [activeTab, setActiveTab] = useState<'quota' | 'dividend'>('quota');

  // 配额管理状态
  const [quotas, setQuotas] = useState<TokenQuota[]>([]);
  const [quotasLoading, setQuotasLoading] = useState(true);
  const [quotaModalVisible, setQuotaModalVisible] = useState(false);
  const [quotaForm] = Form.useForm();
  const [agents, setAgents] = useState<Array<{ id: string; name: string; email: string }>>([]);

  // 分红池管理状态
  const [dividendPools, setDividendPools] = useState<DividendPool[]>([]);
  const [dividendRecords, setDividendRecords] = useState<DividendRecord[]>([]);
  const [dividendLoading, setDividendLoading] = useState(true);
  const [poolModalVisible, setPoolModalVisible] = useState(false);
  const [recordsModalVisible, setRecordsModalVisible] = useState(false);
  const [selectedPool, setSelectedPool] = useState<DividendPool | null>(null);
  const [poolForm] = Form.useForm();

  // 统计数据
  const [stats, setStats] = useState<TokenStats | null>(null);

  // 获取配额数据
  const fetchQuotas = async () => {
    setQuotasLoading(true);
    try {
      const data = await api.get<{ items: TokenQuota[]; total: number }>('/admin/agents/token/quotas');
      setQuotas(data.items || []);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '获取配额数据失败';
      message.error(errorMessage);
    } finally {
      setQuotasLoading(false);
    }
  };

  // 获取代理商列表
  const fetchAgents = async () => {
    try {
      const data = await api.get<{ items: Array<{ id: string; name: string; email: string }> }>('/admin/agents');
      setAgents(data.items || []);
    } catch (err) {
      console.error('获取代理商列表失败', err);
    }
  };

  // 获取分红池数据
  const fetchDividendPools = async () => {
    setDividendLoading(true);
    try {
      const data = await api.get<{ items: DividendPool[]; total: number }>('/admin/agents/token/dividend-pools');
      setDividendPools(data.items || []);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '获取分红池数据失败';
      message.error(errorMessage);
    } finally {
      setDividendLoading(false);
    }
  };

  // 获取统计数据
  const fetchStats = async () => {
    try {
      const data = await api.get<TokenStats>('/admin/agents/token/stats');
      setStats(data);
    } catch (err) {
      console.error('获取统计数据失败', err);
    }
  };

  useEffect(() => {
    fetchStats();
    if (activeTab === 'quota') {
      fetchQuotas();
      fetchAgents();
    } else {
      fetchDividendPools();
    }
  }, [activeTab]);

  // 创建配额
  const handleCreateQuota = async () => {
    try {
      const values = await quotaForm.validateFields();
      await api.post('/admin/agents/token/quotas', values);
      message.success('配额创建成功');
      setQuotaModalVisible(false);
      quotaForm.resetFields();
      fetchQuotas();
      fetchStats();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '创建失败';
      message.error(errorMessage);
    }
  };

  // 审核配额
  const handleReviewQuota = async (quotaId: string, approved: boolean) => {
    try {
      await api.post(`/admin/agents/token/quotas/${quotaId}/review`, { approved });
      message.success(approved ? '配额已批准' : '配额已拒绝');
      fetchQuotas();
      fetchStats();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '审核失败';
      message.error(errorMessage);
    }
  };

  // 创建分红池
  const handleCreatePool = async () => {
    try {
      const values = await poolForm.validateFields();
      await api.post('/admin/agents/token/dividend-pools', {
        periodStart: values.period[0].format('YYYY-MM-DD'),
        periodEnd: values.period[1].format('YYYY-MM-DD'),
      });
      message.success('分红池创建成功');
      setPoolModalVisible(false);
      poolForm.resetFields();
      fetchDividendPools();
      fetchStats();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '创建失败';
      message.error(errorMessage);
    }
  };

  // 分发分红池
  const handleDistributePool = async (poolId: string) => {
    try {
      await api.post(`/admin/agents/token/dividend-pools/${poolId}/distribute`);
      message.success('分红池分发成功');
      fetchDividendPools();
      fetchStats();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '分发失败';
      message.error(errorMessage);
    }
  };

  // 查看分红记录
  const handleViewRecords = async (pool: DividendPool) => {
    setSelectedPool(pool);
    try {
      const data = await api.get<{ items: DividendRecord[] }>(`/admin/agents/token/dividend-pools/${pool.id}/records`);
      setDividendRecords(data.items || []);
      setRecordsModalVisible(true);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '获取分红记录失败';
      message.error(errorMessage);
    }
  };

  // 配额表格列
  const quotaColumns = [
    {
      title: '代理商',
      key: 'agent',
      render: (_: unknown, record: TokenQuota) => (
        <Space direction="vertical" size={0}>
          <Text strong>{record.agent?.name || '-'}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.agent?.email}</Text>
        </Space>
      ),
    },
    {
      title: '配额等级',
      dataIndex: 'level',
      key: 'level',
      render: (level: keyof typeof quotaLevelConfig) => {
        const config = quotaLevelConfig[level];
        return (
          <Tag color={config?.color} style={{ color: level === 'gold' ? '#000' : '#fff' }}>
            {config?.name || level} ({(config?.discount * 10).toFixed(0)}折)
          </Tag>
        );
      },
    },
    {
      title: '配额数量',
      dataIndex: 'quotaAmount',
      key: 'quotaAmount',
      render: (v: string) => <Text strong>{parseFloat(v).toLocaleString()} HOOT</Text>,
    },
    {
      title: '购买价格',
      dataIndex: 'purchasePrice',
      key: 'purchasePrice',
      render: (v: string) => <Text>${parseFloat(v).toFixed(4)}</Text>,
    },
    {
      title: '购买金额',
      dataIndex: 'purchaseAmount',
      key: 'purchaseAmount',
      render: (v: string) => <Text style={{ color: '#52c41a' }}>${parseFloat(v).toLocaleString()}</Text>,
    },
    {
      title: '释放进度',
      key: 'progress',
      render: (_: unknown, record: TokenQuota) => {
        const released = parseFloat(record.releasedAmount);
        const total = parseFloat(record.quotaAmount);
        const percent = total > 0 ? (released / total) * 100 : 0;
        return (
          <Tooltip title={`已释放 ${released.toLocaleString()} / ${total.toLocaleString()} HOOT`}>
            <Progress
              percent={percent}
              size="small"
              status={percent >= 100 ? 'success' : 'active'}
              format={() => `${percent.toFixed(1)}%`}
            />
          </Tooltip>
        );
      },
    },
    {
      title: '锁仓期',
      dataIndex: 'vestingMonths',
      key: 'vestingMonths',
      render: (v: number) => <Tag color="blue">{v} 个月</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const config = statusConfig[status as keyof typeof statusConfig];
        return <Tag color={config?.color}>{config?.text || status}</Tag>;
      },
    },
    {
      title: '申请时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (v: string) => new Date(v).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record: TokenQuota) => (
        <Space>
          {record.status === 'pending' && (
            <>
              <Popconfirm
                title="确认批准此配额申请？"
                onConfirm={() => handleReviewQuota(record.id, true)}
              >
                <Button type="link" size="small" icon={<CheckOutlined />} style={{ color: '#52c41a' }}>
                  批准
                </Button>
              </Popconfirm>
              <Popconfirm
                title="确认拒绝此配额申请？"
                onConfirm={() => handleReviewQuota(record.id, false)}
              >
                <Button type="link" size="small" icon={<CloseOutlined />} danger>
                  拒绝
                </Button>
              </Popconfirm>
            </>
          )}
        </Space>
      ),
    },
  ];

  // 分红池表格列
  const poolColumns = [
    {
      title: '期号',
      dataIndex: 'monthNumber',
      key: 'monthNumber',
      render: (v: string) => <Tag color="blue">{v}</Tag>,
    },
    {
      title: '结算周期',
      key: 'period',
      render: (_: unknown, record: DividendPool) => (
        <Text>
          {new Date(record.periodStart).toLocaleDateString('zh-CN')} ~{' '}
          {new Date(record.periodEnd).toLocaleDateString('zh-CN')}
        </Text>
      ),
    },
    {
      title: 'Gas费总额',
      dataIndex: 'gasFeeTotal',
      key: 'gasFeeTotal',
      render: (v: string) => <Text>${parseFloat(v).toLocaleString()}</Text>,
    },
    {
      title: '分红池金额',
      key: 'poolAmount',
      render: (_: unknown, record: DividendPool) => (
        <Space direction="vertical" size={0}>
          <Text style={{ color: '#52c41a' }}>${parseFloat(record.poolAmount).toLocaleString()}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            ({(parseFloat(record.poolRate) * 100).toFixed(0)}% of Gas费)
          </Text>
        </Space>
      ),
    },
    {
      title: 'HOOT 数量',
      key: 'hootAmount',
      render: (_: unknown, record: DividendPool) => (
        <Space direction="vertical" size={0}>
          <Text strong>{parseFloat(record.hootAmount).toLocaleString()} HOOT</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            @${parseFloat(record.hootPrice).toFixed(4)}
          </Text>
        </Space>
      ),
    },
    {
      title: '参与代理商',
      dataIndex: 'participantCount',
      key: 'participantCount',
      render: (v: number) => <Tag icon={<TeamOutlined />}>{v} 人</Tag>,
    },
    {
      title: '已分发',
      dataIndex: 'distributedAmount',
      key: 'distributedAmount',
      render: (v: string) => <Text style={{ color: '#faad14' }}>${parseFloat(v).toLocaleString()}</Text>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const config = statusConfig[status as keyof typeof statusConfig];
        return <Tag color={config?.color}>{config?.text || status}</Tag>;
      },
    },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record: DividendPool) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<HistoryOutlined />}
            onClick={() => handleViewRecords(record)}
          >
            查看记录
          </Button>
          {record.status === 'pending' && (
            <Popconfirm
              title="确认分发此分红池？分发后将自动计算并发放给所有符合条件的代理商。"
              icon={<ExclamationCircleOutlined style={{ color: '#faad14' }} />}
              onConfirm={() => handleDistributePool(record.id)}
            >
              <Button type="link" size="small" icon={<SendOutlined />} style={{ color: '#52c41a' }}>
                分发
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  // 分红记录表格列
  const recordColumns = [
    {
      title: '代理商',
      key: 'agent',
      render: (_: unknown, record: DividendRecord) => (
        <Space direction="vertical" size={0}>
          <Text strong>{record.agent?.name || '-'}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.agent?.email}</Text>
        </Space>
      ),
    },
    {
      title: '用户交易量',
      dataIndex: 'userTradeVolume',
      key: 'userTradeVolume',
      render: (v: string) => <Text>${parseFloat(v).toLocaleString()}</Text>,
    },
    {
      title: '贡献比例',
      dataIndex: 'contributionRate',
      key: 'contributionRate',
      render: (v: string) => <Tag color="blue">{(parseFloat(v) * 100).toFixed(2)}%</Tag>,
    },
    {
      title: '分红 (USDT)',
      dataIndex: 'dividendUsdt',
      key: 'dividendUsdt',
      render: (v: string) => <Text style={{ color: '#52c41a' }}>${parseFloat(v).toFixed(2)}</Text>,
    },
    {
      title: '分红 (HOOT)',
      dataIndex: 'dividendHoot',
      key: 'dividendHoot',
      render: (v: string) => <Text strong>{parseFloat(v).toLocaleString()} HOOT</Text>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const config = statusConfig[status as keyof typeof statusConfig];
        return <Tag color={config?.color}>{config?.text || status}</Tag>;
      },
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}>
          <GoldOutlined style={{ marginRight: 8 }} />
          代理商代币管理
        </Title>
      </div>

      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="配额总数"
              value={stats?.totalQuotas || 0}
              prefix={<GoldOutlined />}
              suffix={
                <Text type="secondary" style={{ fontSize: 12 }}>
                  / {stats?.pendingQuotas || 0} 待审
                </Text>
              }
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="配额总量"
              value={parseFloat(stats?.totalQuotaAmount || '0').toLocaleString()}
              suffix="HOOT"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="已释放"
              value={parseFloat(stats?.totalReleasedAmount || '0').toLocaleString()}
              suffix="HOOT"
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="分红池总额"
              value={parseFloat(stats?.totalDividendAmount || '0')}
              prefix={<DollarOutlined />}
              suffix="USDT"
              precision={2}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
      </Row>

      <Tabs
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key as 'quota' | 'dividend')}
        items={[
          {
            key: 'quota',
            label: (
              <span>
                <GoldOutlined /> 私募配额管理
              </span>
            ),
            children: (
              <Spin spinning={quotasLoading}>
                <Alert
                  message="私募配额说明"
                  description={
                    <div>
                      <p>代理商可根据等级以折扣价购买 HOOT 代币：</p>
                      <ul style={{ margin: '8px 0', paddingLeft: 20 }}>
                        <li><Tag color="#cd7f32">青铜</Tag> 7折，锁仓12个月</li>
                        <li><Tag color="#c0c0c0">白银</Tag> 5折，锁仓10个月</li>
                        <li><Tag color="#ffd700" style={{ color: '#000' }}>黄金</Tag> 3折，锁仓8个月</li>
                        <li><Tag color="#e5e4e2" style={{ color: '#000' }}>铂金</Tag> 2折，锁仓6个月</li>
                      </ul>
                    </div>
                  }
                  type="info"
                  showIcon
                  icon={<InfoCircleOutlined />}
                  style={{ marginBottom: 24 }}
                  action={
                    <Space>
                      <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={() => {
                          quotaForm.resetFields();
                          setQuotaModalVisible(true);
                        }}
                      >
                        创建配额
                      </Button>
                      <Button
                        icon={<ReloadOutlined spin={quotasLoading} />}
                        onClick={fetchQuotas}
                      >
                        刷新
                      </Button>
                    </Space>
                  }
                />

                <Card>
                  <Table
                    dataSource={quotas}
                    columns={quotaColumns}
                    rowKey="id"
                    pagination={{ pageSize: 10 }}
                    locale={{ emptyText: <Empty description="暂无配额记录" /> }}
                  />
                </Card>
              </Spin>
            ),
          },
          {
            key: 'dividend',
            label: (
              <span>
                <DollarOutlined /> 交易分红池
              </span>
            ),
            children: (
              <Spin spinning={dividendLoading}>
                <Alert
                  message="交易分红池说明"
                  description={
                    <div>
                      <p>平台每月将 Gas 费的 10% 注入分红池，按代理商下属用户交易量占比分配。</p>
                      <p style={{ marginTop: 8 }}>
                        <Text type="secondary">公式：代理商分红 = 分红池总额 × (该代理商用户交易量 / 总交易量)</Text>
                      </p>
                    </div>
                  }
                  type="info"
                  showIcon
                  icon={<InfoCircleOutlined />}
                  style={{ marginBottom: 24 }}
                  action={
                    <Space>
                      <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={() => {
                          poolForm.resetFields();
                          setPoolModalVisible(true);
                        }}
                      >
                        创建分红池
                      </Button>
                      <Button
                        icon={<ReloadOutlined spin={dividendLoading} />}
                        onClick={fetchDividendPools}
                      >
                        刷新
                      </Button>
                    </Space>
                  }
                />

                <Card>
                  <Table
                    dataSource={dividendPools}
                    columns={poolColumns}
                    rowKey="id"
                    pagination={{ pageSize: 10 }}
                    locale={{ emptyText: <Empty description="暂无分红池记录" /> }}
                  />
                </Card>
              </Spin>
            ),
          },
        ]}
      />

      {/* 创建配额弹窗 */}
      <Modal
        title={
          <>
            <GoldOutlined /> 创建私募配额
          </>
        }
        open={quotaModalVisible}
        onOk={handleCreateQuota}
        onCancel={() => {
          setQuotaModalVisible(false);
          quotaForm.resetFields();
        }}
        width={600}
      >
        <Form form={quotaForm} layout="vertical">
          <Form.Item
            name="agentId"
            label="代理商"
            rules={[{ required: true, message: '请选择代理商' }]}
          >
            <Select
              showSearch
              placeholder="选择代理商"
              optionFilterProp="label"
              options={agents.map((a) => ({
                value: a.id,
                label: `${a.name} (${a.email})`,
              }))}
            />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="level"
                label="配额等级"
                rules={[{ required: true, message: '请选择配额等级' }]}
              >
                <Select
                  placeholder="选择等级"
                  options={[
                    { value: 'bronze', label: '青铜 (7折，12个月)' },
                    { value: 'silver', label: '白银 (5折，10个月)' },
                    { value: 'gold', label: '黄金 (3折，8个月)' },
                    { value: 'platinum', label: '铂金 (2折，6个月)' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="quotaAmount"
                label="配额数量 (HOOT)"
                rules={[{ required: true, message: '请输入配额数量' }]}
              >
                <InputNumber
                  min={1000}
                  max={10000000}
                  style={{ width: '100%' }}
                  formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={(value) => Number(value!.replace(/,/g, '')) as 1000 | 10000000}
                />
              </Form.Item>
            </Col>
          </Row>
          <Alert
            message="价格计算说明"
            description="购买价格 = 基准价 × 折扣率。基准价通过市场行情自动获取。"
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
          />
        </Form>
      </Modal>

      {/* 创建分红池弹窗 */}
      <Modal
        title={
          <>
            <DollarOutlined /> 创建分红池
          </>
        }
        open={poolModalVisible}
        onOk={handleCreatePool}
        onCancel={() => {
          setPoolModalVisible(false);
          poolForm.resetFields();
        }}
        width={500}
      >
        <Form form={poolForm} layout="vertical">
          <Form.Item
            name="period"
            label="结算周期"
            rules={[{ required: true, message: '请选择结算周期' }]}
          >
            <DatePicker.RangePicker style={{ width: '100%' }} />
          </Form.Item>
          <Alert
            message="分红池金额计算"
            description="系统将自动计算选定周期内的 Gas 费总额，并提取 10% 作为分红池金额。"
            type="info"
            showIcon
          />
        </Form>
      </Modal>

      {/* 分红记录弹窗 */}
      <Modal
        title={
          <>
            <HistoryOutlined /> 分红记录 - {selectedPool?.monthNumber}
          </>
        }
        open={recordsModalVisible}
        onCancel={() => setRecordsModalVisible(false)}
        footer={null}
        width={900}
      >
        {selectedPool && (
          <Descriptions bordered size="small" column={3} style={{ marginBottom: 16 }}>
            <Descriptions.Item label="结算周期">
              {new Date(selectedPool.periodStart).toLocaleDateString('zh-CN')} ~{' '}
              {new Date(selectedPool.periodEnd).toLocaleDateString('zh-CN')}
            </Descriptions.Item>
            <Descriptions.Item label="Gas费总额">
              ${parseFloat(selectedPool.gasFeeTotal).toLocaleString()}
            </Descriptions.Item>
            <Descriptions.Item label="分红池金额">
              ${parseFloat(selectedPool.poolAmount).toLocaleString()}
            </Descriptions.Item>
            <Descriptions.Item label="HOOT 价格">
              ${parseFloat(selectedPool.hootPrice).toFixed(4)}
            </Descriptions.Item>
            <Descriptions.Item label="HOOT 数量">
              {parseFloat(selectedPool.hootAmount).toLocaleString()}
            </Descriptions.Item>
            <Descriptions.Item label="参与代理商">
              {selectedPool.participantCount} 人
            </Descriptions.Item>
          </Descriptions>
        )}
        <Table
          dataSource={dividendRecords}
          columns={recordColumns}
          rowKey="id"
          pagination={{ pageSize: 10 }}
          locale={{ emptyText: <Empty description="暂无分红记录" /> }}
        />
      </Modal>
    </div>
  );
};
