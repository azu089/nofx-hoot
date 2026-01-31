/**
 * 代理商与推荐管理页面
 * 区分：普通用户推荐（L1:10%/L2:5%）vs 官方代理商（团队业绩分成）
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
  Input,
  InputNumber,
  Select,
  Row,
  Col,
  Statistic,
  Tabs,
  Descriptions,
  message,
  Alert,
  Progress,
  Timeline,
  Divider,
  Badge,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  EyeOutlined,
  TeamOutlined,
  DollarOutlined,
  UserAddOutlined,
  GiftOutlined,
  CrownOutlined,
  UserOutlined,
  ApartmentOutlined,
  TrophyOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { useState } from 'react';

const { Title, Text, Paragraph } = Typography;

// ========== 官方代理商相关类型和数据 ==========
interface IOfficialAgent {
  id: string;
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  status: 'active' | 'suspended' | 'pending';
  contractStartDate: string;
  contractEndDate: string;
  // 团队业绩分成模式
  commissionType: 'team_performance' | 'tiered';
  teamCommissionRate: number; // 团队业绩分成比例 (%)
  // 团队统计
  teamMemberCount: number;
  teamTotalVolume: string; // 团队累计交易量
  teamMonthVolume: string; // 团队本月交易量
  totalCommission: string;
  monthCommission: string;
  // 结算信息
  settlementCycle: 'weekly' | 'monthly';
  lastSettlementDate: string;
  pendingSettlement: string;
  createdAt: string;
}

interface ITeamMember {
  id: string;
  username: string;
  email: string;
  joinDate: string;
  tradingVolume: string;
  contributedCommission: string;
}

// ========== 普通用户推荐相关类型和数据 ==========
interface IUserReferral {
  id: string;
  username: string;
  email: string;
  inviteCode: string;
  level1Count: number; // 直接邀请人数
  level2Count: number; // 二级邀请人数
  totalCommission: string;
  monthCommission: string;
  lastInviteDate: string;
}

interface IReferralLog {
  id: string;
  referrerId: string;
  userId: string;
  username: string;
  level: 1 | 2;
  source: 'subscription';
  originalAmount: string;
  commissionAmount: string;
  time: string;
}

// 模拟官方代理商数据
const mockOfficialAgents: IOfficialAgent[] = [
  {
    id: 'OA001',
    name: '深圳量化科技有限公司',
    contactPerson: '张经理',
    email: 'zhang@quantech.cn',
    phone: '138****8888',
    status: 'active',
    contractStartDate: '2024-01-01',
    contractEndDate: '2025-12-31',
    commissionType: 'team_performance',
    teamCommissionRate: 15,
    teamMemberCount: 328,
    teamTotalVolume: '12,580,000',
    teamMonthVolume: '1,250,000',
    totalCommission: '188,700.00',
    monthCommission: '18,750.00',
    settlementCycle: 'monthly',
    lastSettlementDate: '2025-01-01',
    pendingSettlement: '18,750.00',
    createdAt: '2024-01-01',
  },
  {
    id: 'OA002',
    name: '杭州盈通投资管理',
    contactPerson: '李总',
    email: 'li@yingtong.com',
    phone: '139****6666',
    status: 'active',
    contractStartDate: '2024-06-01',
    contractEndDate: '2025-05-31',
    commissionType: 'team_performance',
    teamCommissionRate: 12,
    teamMemberCount: 156,
    teamTotalVolume: '5,680,000',
    teamMonthVolume: '680,000',
    totalCommission: '68,160.00',
    monthCommission: '8,160.00',
    settlementCycle: 'weekly',
    lastSettlementDate: '2025-01-27',
    pendingSettlement: '2,040.00',
    createdAt: '2024-06-01',
  },
  {
    id: 'OA003',
    name: '上海金融科技联盟',
    contactPerson: '王主任',
    email: 'wang@shfintech.org',
    phone: '137****5555',
    status: 'pending',
    contractStartDate: '2025-02-01',
    contractEndDate: '2026-01-31',
    commissionType: 'tiered',
    teamCommissionRate: 10,
    teamMemberCount: 0,
    teamTotalVolume: '0',
    teamMonthVolume: '0',
    totalCommission: '0.00',
    monthCommission: '0.00',
    settlementCycle: 'monthly',
    lastSettlementDate: '-',
    pendingSettlement: '0.00',
    createdAt: '2025-01-28',
  },
];

// 模拟团队成员
const mockTeamMembers: ITeamMember[] = [
  { id: 'TM001', username: '交易员A', email: 'a@example.com', joinDate: '2024-02-15', tradingVolume: '580,000', contributedCommission: '8,700.00' },
  { id: 'TM002', username: '交易员B', email: 'b@example.com', joinDate: '2024-03-20', tradingVolume: '320,000', contributedCommission: '4,800.00' },
  { id: 'TM003', username: '交易员C', email: 'c@example.com', joinDate: '2024-05-10', tradingVolume: '250,000', contributedCommission: '3,750.00' },
];

// 模拟普通用户推荐数据
const mockUserReferrals: IUserReferral[] = [
  { id: 'U001', username: 'crypto_whale', email: 'whale@example.com', inviteCode: 'WHALE001', level1Count: 25, level2Count: 68, totalCommission: '1,250.00', monthCommission: '320.00', lastInviteDate: '2025-01-29' },
  { id: 'U002', username: 'trader_pro', email: 'pro@example.com', inviteCode: 'PRO002', level1Count: 18, level2Count: 42, totalCommission: '850.00', monthCommission: '180.00', lastInviteDate: '2025-01-28' },
  { id: 'U003', username: 'newbie_2024', email: 'newbie@example.com', inviteCode: 'NEW003', level1Count: 5, level2Count: 8, totalCommission: '120.00', monthCommission: '45.00', lastInviteDate: '2025-01-25' },
];

// 模拟推荐记录
const mockReferralLogs: IReferralLog[] = [
  { id: '1', referrerId: 'U001', userId: 'U101', username: '张三', level: 1, source: 'subscription', originalAmount: '25.00', commissionAmount: '2.50', time: '2025-01-30 14:30:00' },
  { id: '2', referrerId: 'U001', userId: 'U102', username: '李四', level: 2, source: 'subscription', originalAmount: '25.00', commissionAmount: '1.25', time: '2025-01-30 14:25:00' },
  { id: '3', referrerId: 'U002', userId: 'U103', username: '王五', level: 1, source: 'subscription', originalAmount: '50.00', commissionAmount: '5.00', time: '2025-01-30 14:20:00' },
];

const agentStatusMap: Record<string, { color: string; text: string }> = {
  active: { color: 'success', text: '合作中' },
  suspended: { color: 'error', text: '已暂停' },
  pending: { color: 'processing', text: '待生效' },
};

export const AgentsPage = () => {
  const [activeTab, setActiveTab] = useState<'official' | 'referral'>('official');
  const [officialAgents] = useState(mockOfficialAgents);
  const [userReferrals] = useState(mockUserReferrals);
  const [modalVisible, setModalVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<IOfficialAgent | null>(null);
  const [selectedReferrer, setSelectedReferrer] = useState<IUserReferral | null>(null);
  const [form] = Form.useForm();

  // ========== 官方代理商列表列 ==========
  const officialAgentColumns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 80 },
    {
      title: '代理商',
      key: 'agent',
      render: (_: unknown, record: IOfficialAgent) => (
        <Space direction="vertical" size={0}>
          <Space>
            <CrownOutlined style={{ color: '#ffd700' }} />
            <Text strong>{record.name}</Text>
          </Space>
          <Text type="secondary" style={{ fontSize: 12 }}>联系人: {record.contactPerson}</Text>
        </Space>
      ),
    },
    {
      title: '分成模式',
      key: 'commission',
      render: (_: unknown, record: IOfficialAgent) => (
        <Space direction="vertical" size={0}>
          <Tag color="purple">团队业绩 {record.teamCommissionRate}%</Tag>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.commissionType === 'team_performance' ? '全团队业绩分成' : '阶梯分成'}
          </Text>
        </Space>
      ),
    },
    {
      title: '团队规模',
      dataIndex: 'teamMemberCount',
      key: 'teamMemberCount',
      render: (count: number) => (
        <Space>
          <TeamOutlined />
          <Text>{count} 人</Text>
        </Space>
      ),
    },
    {
      title: '本月交易量',
      dataIndex: 'teamMonthVolume',
      key: 'teamMonthVolume',
      render: (v: string) => <Text type="success">${v}</Text>,
    },
    {
      title: '本月佣金',
      dataIndex: 'monthCommission',
      key: 'monthCommission',
      render: (v: string) => <Text strong style={{ color: '#52c41a' }}>{v} USDT</Text>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={agentStatusMap[status].color}>{agentStatusMap[status].text}</Tag>
      ),
    },
    {
      title: '合同期限',
      key: 'contract',
      render: (_: unknown, record: IOfficialAgent) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {record.contractStartDate} 至 {record.contractEndDate}
        </Text>
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record: IOfficialAgent) => (
        <Space>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => {
              setSelectedAgent(record);
              setDetailVisible(true);
            }}
          >
            详情
          </Button>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => {
              form.setFieldsValue(record);
              setModalVisible(true);
            }}
          >
            编辑
          </Button>
        </Space>
      ),
    },
  ];

  // ========== 用户推荐列表列 ==========
  const userReferralColumns = [
    { title: '用户ID', dataIndex: 'id', key: 'id', width: 80 },
    {
      title: '用户',
      key: 'user',
      render: (_: unknown, record: IUserReferral) => (
        <Space direction="vertical" size={0}>
          <Space>
            <UserOutlined />
            <Text strong>{record.username}</Text>
          </Space>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.email}</Text>
        </Space>
      ),
    },
    {
      title: '邀请码',
      dataIndex: 'inviteCode',
      key: 'inviteCode',
      render: (code: string) => <Text code copyable>{code}</Text>,
    },
    {
      title: '推荐人数',
      key: 'inviteCount',
      render: (_: unknown, record: IUserReferral) => (
        <Space direction="vertical" size={0}>
          <Text>L1: {record.level1Count} 人</Text>
          <Text type="secondary">L2: {record.level2Count} 人</Text>
        </Space>
      ),
    },
    {
      title: '返佣比例',
      key: 'ratio',
      render: () => (
        <Space direction="vertical" size={0}>
          <Tag color="blue">L1: 10%</Tag>
          <Tag color="cyan">L2: 5%</Tag>
        </Space>
      ),
    },
    {
      title: '累计返佣',
      dataIndex: 'totalCommission',
      key: 'totalCommission',
      render: (v: string) => `${v} USDT`,
    },
    {
      title: '本月返佣',
      dataIndex: 'monthCommission',
      key: 'monthCommission',
      render: (v: string) => <Text style={{ color: '#52c41a' }}>{v} USDT</Text>,
    },
    {
      title: '最近邀请',
      dataIndex: 'lastInviteDate',
      key: 'lastInviteDate',
    },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record: IUserReferral) => (
        <Button
          type="link"
          icon={<EyeOutlined />}
          onClick={() => setSelectedReferrer(record)}
        >
          详情
        </Button>
      ),
    },
  ];

  // 推荐记录列
  const referralLogColumns = [
    { title: '被推荐用户', dataIndex: 'username', key: 'username' },
    {
      title: '层级',
      dataIndex: 'level',
      key: 'level',
      render: (level: number) => (
        <Tag color={level === 1 ? 'blue' : 'cyan'}>
          {level === 1 ? '一级 (10%)' : '二级 (5%)'}
        </Tag>
      ),
    },
    { title: '订阅费', dataIndex: 'originalAmount', key: 'originalAmount', render: (a: string) => `${a} USDT` },
    { title: '返佣金额', dataIndex: 'commissionAmount', key: 'commissionAmount', render: (a: string) => <Text type="success">{a} USDT</Text> },
    { title: '时间', dataIndex: 'time', key: 'time' },
  ];

  // 统计数据
  const officialStats = {
    total: officialAgents.length,
    active: officialAgents.filter(a => a.status === 'active').length,
    totalMembers: officialAgents.reduce((sum, a) => sum + a.teamMemberCount, 0),
    monthCommission: officialAgents.reduce((sum, a) => sum + parseFloat(a.monthCommission.replace(/,/g, '')), 0),
  };

  const referralStats = {
    total: userReferrals.length,
    totalInvites: userReferrals.reduce((sum, r) => sum + r.level1Count + r.level2Count, 0),
    monthCommission: userReferrals.reduce((sum, r) => sum + parseFloat(r.monthCommission.replace(/,/g, '')), 0),
  };

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}>代理商与推荐管理</Title>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key as 'official' | 'referral')}
        items={[
          {
            key: 'official',
            label: (
              <span>
                <CrownOutlined /> 官方代理商
              </span>
            ),
            children: (
              <>
                <Alert
                  message="官方代理商说明"
                  description="官方代理商通过签订合作协议获得团队业绩分成资格。与普通用户推荐不同，代理商可获得其整个团队（不限层级）的交易业绩分成。"
                  type="info"
                  showIcon
                  style={{ marginBottom: 24 }}
                />

                <Row gutter={16} style={{ marginBottom: 24 }}>
                  <Col span={6}>
                    <Card>
                      <Statistic
                        title="签约代理商"
                        value={officialStats.total}
                        prefix={<CrownOutlined />}
                        suffix={<Text type="secondary">/ {officialStats.active} 活跃</Text>}
                      />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card>
                      <Statistic
                        title="团队总人数"
                        value={officialStats.totalMembers}
                        prefix={<TeamOutlined />}
                      />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card>
                      <Statistic
                        title="本月佣金总额"
                        value={officialStats.monthCommission.toFixed(2)}
                        prefix={<DollarOutlined />}
                        suffix="USDT"
                        valueStyle={{ color: '#52c41a' }}
                      />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card>
                      <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        size="large"
                        style={{ width: '100%', height: 56 }}
                        onClick={() => {
                          form.resetFields();
                          setModalVisible(true);
                        }}
                      >
                        新增代理商
                      </Button>
                    </Card>
                  </Col>
                </Row>

                <Card>
                  <Table
                    dataSource={officialAgents}
                    columns={officialAgentColumns}
                    rowKey="id"
                    pagination={{ pageSize: 10 }}
                  />
                </Card>
              </>
            ),
          },
          {
            key: 'referral',
            label: (
              <span>
                <UserAddOutlined /> 用户推荐
              </span>
            ),
            children: (
              <>
                <Alert
                  message="用户推荐说明"
                  description={
                    <div>
                      <p>所有用户均自动拥有推荐功能，推荐奖励固定为：</p>
                      <ul style={{ margin: '8px 0', paddingLeft: 20 }}>
                        <li><strong>一级推荐 (L1)</strong>：被推荐人订阅费的 <Tag color="blue">10%</Tag></li>
                        <li><strong>二级推荐 (L2)</strong>：被推荐人订阅费的 <Tag color="cyan">5%</Tag></li>
                      </ul>
                      <p style={{ margin: 0 }}>推荐奖励仅来源于订阅费，Gas Fee 不参与推荐分成。</p>
                    </div>
                  }
                  type="info"
                  showIcon
                  style={{ marginBottom: 24 }}
                />

                <Row gutter={16} style={{ marginBottom: 24 }}>
                  <Col span={8}>
                    <Card>
                      <Statistic
                        title="有推荐记录的用户"
                        value={referralStats.total}
                        prefix={<UserOutlined />}
                      />
                    </Card>
                  </Col>
                  <Col span={8}>
                    <Card>
                      <Statistic
                        title="累计推荐人数"
                        value={referralStats.totalInvites}
                        prefix={<UserAddOutlined />}
                      />
                    </Card>
                  </Col>
                  <Col span={8}>
                    <Card>
                      <Statistic
                        title="本月推荐返佣"
                        value={referralStats.monthCommission.toFixed(2)}
                        prefix={<GiftOutlined />}
                        suffix="USDT"
                        valueStyle={{ color: '#52c41a' }}
                      />
                    </Card>
                  </Col>
                </Row>

                <Card>
                  <Table
                    dataSource={userReferrals}
                    columns={userReferralColumns}
                    rowKey="id"
                    pagination={{ pageSize: 10 }}
                  />
                </Card>
              </>
            ),
          },
        ]}
      />

      {/* 新增/编辑代理商弹窗 */}
      <Modal
        title={<><CrownOutlined /> 新增官方代理商</>}
        open={modalVisible}
        onOk={() => {
          form.validateFields().then(values => {
            console.log('新增代理商:', values);
            message.success('代理商创建成功');
            setModalVisible(false);
            form.resetFields();
          });
        }}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
        }}
        width={700}
      >
        <Alert
          message="官方代理商需签订正式合作协议"
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />

        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="name"
                label="代理商名称"
                rules={[{ required: true, message: '请输入代理商名称' }]}
              >
                <Input placeholder="公司/机构名称" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="contactPerson"
                label="联系人"
                rules={[{ required: true, message: '请输入联系人' }]}
              >
                <Input placeholder="联系人姓名" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="email"
                label="邮箱"
                rules={[{ required: true, type: 'email', message: '请输入有效邮箱' }]}
              >
                <Input placeholder="联系邮箱" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="phone"
                label="联系电话"
                rules={[{ required: true, message: '请输入联系电话' }]}
              >
                <Input placeholder="联系电话" />
              </Form.Item>
            </Col>
          </Row>

          <Divider>合作条款</Divider>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="commissionType"
                label="分成模式"
                rules={[{ required: true }]}
                initialValue="team_performance"
              >
                <Select
                  options={[
                    { value: 'team_performance', label: '团队业绩分成' },
                    { value: 'tiered', label: '阶梯分成' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="teamCommissionRate"
                label="分成比例 (%)"
                rules={[{ required: true, message: '请输入分成比例' }]}
                extra="团队全部交易量的分成比例"
              >
                <InputNumber min={1} max={30} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="settlementCycle"
                label="结算周期"
                rules={[{ required: true }]}
                initialValue="monthly"
              >
                <Select
                  options={[
                    { value: 'weekly', label: '每周结算' },
                    { value: 'monthly', label: '每月结算' },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="contractStartDate"
                label="合同开始日期"
                rules={[{ required: true, message: '请选择开始日期' }]}
              >
                <Input type="date" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="contractEndDate"
                label="合同结束日期"
                rules={[{ required: true, message: '请选择结束日期' }]}
              >
                <Input type="date" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* 代理商详情弹窗 */}
      <Modal
        title={<><CrownOutlined /> 代理商详情</>}
        open={detailVisible}
        onCancel={() => {
          setDetailVisible(false);
          setSelectedAgent(null);
        }}
        footer={null}
        width={900}
      >
        {selectedAgent && (
          <Tabs
            items={[
              {
                key: 'info',
                label: '基本信息',
                children: (
                  <>
                    <Descriptions bordered column={2}>
                      <Descriptions.Item label="代理商ID">{selectedAgent.id}</Descriptions.Item>
                      <Descriptions.Item label="状态">
                        <Tag color={agentStatusMap[selectedAgent.status].color}>
                          {agentStatusMap[selectedAgent.status].text}
                        </Tag>
                      </Descriptions.Item>
                      <Descriptions.Item label="代理商名称">{selectedAgent.name}</Descriptions.Item>
                      <Descriptions.Item label="联系人">{selectedAgent.contactPerson}</Descriptions.Item>
                      <Descriptions.Item label="邮箱">{selectedAgent.email}</Descriptions.Item>
                      <Descriptions.Item label="电话">{selectedAgent.phone}</Descriptions.Item>
                      <Descriptions.Item label="合同期限">
                        {selectedAgent.contractStartDate} 至 {selectedAgent.contractEndDate}
                      </Descriptions.Item>
                      <Descriptions.Item label="结算周期">
                        {selectedAgent.settlementCycle === 'weekly' ? '每周' : '每月'}
                      </Descriptions.Item>
                    </Descriptions>

                    <Divider>分成配置</Divider>

                    <Row gutter={24}>
                      <Col span={8}>
                        <Card size="small">
                          <Statistic
                            title="分成模式"
                            value={selectedAgent.commissionType === 'team_performance' ? '团队业绩分成' : '阶梯分成'}
                            prefix={<SettingOutlined />}
                          />
                        </Card>
                      </Col>
                      <Col span={8}>
                        <Card size="small">
                          <Statistic
                            title="分成比例"
                            value={selectedAgent.teamCommissionRate}
                            suffix="%"
                            valueStyle={{ color: '#1890ff' }}
                          />
                        </Card>
                      </Col>
                      <Col span={8}>
                        <Card size="small">
                          <Statistic
                            title="待结算金额"
                            value={selectedAgent.pendingSettlement}
                            suffix="USDT"
                            valueStyle={{ color: '#faad14' }}
                          />
                        </Card>
                      </Col>
                    </Row>
                  </>
                ),
              },
              {
                key: 'team',
                label: `团队成员 (${selectedAgent.teamMemberCount})`,
                children: (
                  <>
                    <Row gutter={16} style={{ marginBottom: 16 }}>
                      <Col span={8}>
                        <Card size="small">
                          <Statistic title="团队总人数" value={selectedAgent.teamMemberCount} prefix={<TeamOutlined />} />
                        </Card>
                      </Col>
                      <Col span={8}>
                        <Card size="small">
                          <Statistic title="团队累计交易量" value={selectedAgent.teamTotalVolume} prefix="$" />
                        </Card>
                      </Col>
                      <Col span={8}>
                        <Card size="small">
                          <Statistic title="本月交易量" value={selectedAgent.teamMonthVolume} prefix="$" valueStyle={{ color: '#52c41a' }} />
                        </Card>
                      </Col>
                    </Row>

                    <Table
                      dataSource={mockTeamMembers}
                      columns={[
                        { title: '成员ID', dataIndex: 'id', key: 'id' },
                        { title: '用户名', dataIndex: 'username', key: 'username' },
                        { title: '邮箱', dataIndex: 'email', key: 'email' },
                        { title: '加入日期', dataIndex: 'joinDate', key: 'joinDate' },
                        { title: '交易量', dataIndex: 'tradingVolume', key: 'tradingVolume', render: (v: string) => `$${v}` },
                        { title: '贡献佣金', dataIndex: 'contributedCommission', key: 'contributedCommission', render: (v: string) => <Text type="success">{v} USDT</Text> },
                      ]}
                      rowKey="id"
                      pagination={{ pageSize: 10 }}
                    />
                  </>
                ),
              },
              {
                key: 'settlement',
                label: '结算记录',
                children: (
                  <>
                    <Row gutter={16} style={{ marginBottom: 16 }}>
                      <Col span={8}>
                        <Card size="small">
                          <Statistic title="累计结算" value={selectedAgent.totalCommission} suffix="USDT" />
                        </Card>
                      </Col>
                      <Col span={8}>
                        <Card size="small">
                          <Statistic title="本月佣金" value={selectedAgent.monthCommission} suffix="USDT" valueStyle={{ color: '#52c41a' }} />
                        </Card>
                      </Col>
                      <Col span={8}>
                        <Card size="small">
                          <Statistic title="最近结算" value={selectedAgent.lastSettlementDate} />
                        </Card>
                      </Col>
                    </Row>

                    <Timeline
                      items={[
                        { color: 'green', children: <><Text strong>2025-01-01</Text> 结算 15,000.00 USDT</> },
                        { color: 'green', children: <><Text strong>2024-12-01</Text> 结算 12,500.00 USDT</> },
                        { color: 'green', children: <><Text strong>2024-11-01</Text> 结算 11,200.00 USDT</> },
                      ]}
                    />
                  </>
                ),
              },
            ]}
          />
        )}
      </Modal>

      {/* 用户推荐详情弹窗 */}
      <Modal
        title={<><UserOutlined /> 推荐详情</>}
        open={!!selectedReferrer}
        onCancel={() => setSelectedReferrer(null)}
        footer={null}
        width={800}
      >
        {selectedReferrer && (
          <>
            <Descriptions bordered column={2} style={{ marginBottom: 24 }}>
              <Descriptions.Item label="用户ID">{selectedReferrer.id}</Descriptions.Item>
              <Descriptions.Item label="用户名">{selectedReferrer.username}</Descriptions.Item>
              <Descriptions.Item label="邮箱">{selectedReferrer.email}</Descriptions.Item>
              <Descriptions.Item label="邀请码">
                <Text code copyable>{selectedReferrer.inviteCode}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="一级推荐">
                {selectedReferrer.level1Count} 人 <Tag color="blue">10% 分成</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="二级推荐">
                {selectedReferrer.level2Count} 人 <Tag color="cyan">5% 分成</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="累计返佣">{selectedReferrer.totalCommission} USDT</Descriptions.Item>
              <Descriptions.Item label="本月返佣">
                <Text type="success">{selectedReferrer.monthCommission} USDT</Text>
              </Descriptions.Item>
            </Descriptions>

            <Title level={5}>推荐返佣记录</Title>
            <Table
              dataSource={mockReferralLogs.filter(l => l.referrerId === selectedReferrer.id)}
              columns={referralLogColumns}
              rowKey="id"
              pagination={{ pageSize: 5 }}
            />
          </>
        )}
      </Modal>
    </div>
  );
};
