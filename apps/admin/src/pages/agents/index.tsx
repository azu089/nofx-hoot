/**
 * 代理商与推荐管理页面
 * 区分：普通用户推荐（返佣系统）vs 官方代理商（团队业绩分成）
 * 接入真实后端 API
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
  Alert,
  Spin,
  Empty,
  Popconfirm,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  TeamOutlined,
  DollarOutlined,
  UserAddOutlined,
  GiftOutlined,
  CrownOutlined,
  SettingOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { useMessage } from '../../hooks';

const { Title, Text } = Typography;

// 代理商类型
interface Agent {
  id: string;
  name: string;
  email: string;
  phone: string;
  commissionRate: string;
  level: string;
  status: string;
  teamMemberCount: number;
  totalCommission: string;
  pendingCommission: string;
  createdAt: string;
}

// 推荐关系类型
interface ReferralRelation {
  id: string;
  inviter: {
    id: string;
    email: string;
    nickname: string;
    inviteCode: string;
  };
  invitee: {
    id: string;
    email: string;
    nickname: string;
  };
  level: number;
  rewardAmount: string;
  rewardStatus: string;
  createdAt: string;
}

// 推荐配置类型
interface ReferralConfig {
  level1Rate: string;
  level2Rate: string;
  level3Rate: string;
  maxLevels: number;
  enabled: boolean;
}

// 推荐概览类型
interface ReferralOverview {
  totalReferrals: number;
  totalRewards: string;
  pendingRewards: string;
  topReferrers: Array<{
    id: string;
    email: string;
    nickname: string;
    inviteCode: string;
    inviteeCount: number;
    totalReward: string;
  }>;
}

const agentStatusMap: Record<string, { color: string; text: string }> = {
  active: { color: 'success', text: '合作中' },
  suspended: { color: 'error', text: '已暂停' },
  pending: { color: 'processing', text: '待审核' },
};

export const AgentsPage = () => {
  const message = useMessage();
  const [activeTab, setActiveTab] = useState<'official' | 'referral'>('official');

  // 代理商状态
  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(true);
  const [agentModalVisible, setAgentModalVisible] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [agentForm] = Form.useForm();

  // 推荐系统状态
  const [referralOverview, setReferralOverview] = useState<ReferralOverview | null>(null);
  const [referralConfig, setReferralConfig] = useState<ReferralConfig | null>(null);
  const [referralRelations, setReferralRelations] = useState<ReferralRelation[]>([]);
  const [referralLoading, setReferralLoading] = useState(true);
  const [configModalVisible, setConfigModalVisible] = useState(false);
  const [configForm] = Form.useForm();

  // 获取代理商数据
  const fetchAgents = async () => {
    setAgentsLoading(true);
    try {
      const data = await api.get<{ items: Agent[]; total: number }>('/admin/agents');
      setAgents(data.items || []);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '获取数据失败';
      message.error(errorMessage);
    } finally {
      setAgentsLoading(false);
    }
  };

  // 获取推荐系统数据
  const fetchReferralData = async () => {
    setReferralLoading(true);
    try {
      const [overview, config, relations] = await Promise.all([
        api.get<ReferralOverview>('/admin/referral/overview'),
        api.get<ReferralConfig>('/admin/referral/config'),
        api.get<{ relations: ReferralRelation[] }>('/admin/referral/relations'),
      ]);
      setReferralOverview(overview);
      setReferralConfig(config);
      setReferralRelations(relations.relations || []);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '获取数据失败';
      message.error(errorMessage);
    } finally {
      setReferralLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'official') {
      fetchAgents();
    } else {
      fetchReferralData();
    }
  }, [activeTab]);

  // 创建/更新代理商
  const handleSaveAgent = async () => {
    try {
      const values = await agentForm.validateFields();
      // 将百分比转换为小数
      const submitData = {
        ...values,
        commissionRate: values.commissionRate ? values.commissionRate / 100 : undefined,
      };
      if (editingAgent) {
        await api.put(`/admin/agents/${editingAgent.id}`, submitData);
        message.success('代理商更新成功');
      } else {
        await api.post('/admin/agents', submitData);
        message.success('代理商创建成功');
      }
      setAgentModalVisible(false);
      agentForm.resetFields();
      setEditingAgent(null);
      fetchAgents();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '操作失败';
      message.error(errorMessage);
    }
  };

  // 结算代理商佣金
  const handleSettleAgent = async (agentId: string) => {
    try {
      await api.post(`/admin/agents/${agentId}/settle`);
      message.success('佣金结算成功');
      fetchAgents();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '结算失败';
      message.error(errorMessage);
    }
  };

  // 更新推荐配置
  const handleSaveConfig = async () => {
    try {
      const values = await configForm.validateFields();
      await api.put('/admin/referral/config', values);
      message.success('配置更新成功');
      setConfigModalVisible(false);
      fetchReferralData();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '更新失败';
      message.error(errorMessage);
    }
  };

  // 代理商表格列
  const agentColumns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 80, render: (id: string) => id.slice(0, 8) + '...' },
    {
      title: '代理商',
      key: 'agent',
      render: (_: unknown, record: Agent) => (
        <Space direction="vertical" size={0}>
          <Space>
            <CrownOutlined style={{ color: '#ffd700' }} />
            <Text strong>{record.name}</Text>
          </Space>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.email}</Text>
        </Space>
      ),
    },
    {
      title: '分成比例',
      dataIndex: 'commissionRate',
      key: 'commissionRate',
      render: (rate: string) => (
        <Tag color="purple">{(parseFloat(rate) * 100).toFixed(0)}%</Tag>
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
      title: '累计佣金',
      dataIndex: 'totalCommission',
      key: 'totalCommission',
      render: (v: string) => <Text style={{ color: '#52c41a' }}>${parseFloat(v).toFixed(2)}</Text>,
    },
    {
      title: '待结算',
      dataIndex: 'pendingCommission',
      key: 'pendingCommission',
      render: (v: string) => <Text style={{ color: '#faad14' }}>${parseFloat(v).toFixed(2)}</Text>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={agentStatusMap[status]?.color || 'default'}>
          {agentStatusMap[status]?.text || status}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record: Agent) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => {
              setEditingAgent(record);
              agentForm.setFieldsValue({
                name: record.name,
                email: record.email,
                phone: record.phone,
                commissionRate: parseFloat(record.commissionRate) * 100,
                status: record.status,
              });
              setAgentModalVisible(true);
            }}
          >
            编辑
          </Button>
          {parseFloat(record.pendingCommission) > 0 && (
            <Popconfirm
              title="确认结算佣金？"
              onConfirm={() => handleSettleAgent(record.id)}
            >
              <Button type="link" size="small" icon={<DollarOutlined />}>
                结算
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  // 推荐关系表格列
  const referralColumns = [
    {
      title: '邀请人',
      key: 'inviter',
      render: (_: unknown, record: ReferralRelation) => (
        <Space direction="vertical" size={0}>
          <Text>{record.inviter?.nickname || record.inviter?.email || '-'}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.inviter?.inviteCode}</Text>
        </Space>
      ),
    },
    {
      title: '被邀请人',
      key: 'invitee',
      render: (_: unknown, record: ReferralRelation) => (
        <Text>{record.invitee?.nickname || record.invitee?.email || '-'}</Text>
      ),
    },
    {
      title: '层级',
      dataIndex: 'level',
      key: 'level',
      render: (level: number) => (
        <Tag color={level === 1 ? 'blue' : level === 2 ? 'cyan' : 'purple'}>
          L{level}
        </Tag>
      ),
    },
    {
      title: '返佣金额',
      dataIndex: 'rewardAmount',
      key: 'rewardAmount',
      render: (v: string) => <Text style={{ color: '#52c41a' }}>${parseFloat(v).toFixed(2)}</Text>,
    },
    {
      title: '状态',
      dataIndex: 'rewardStatus',
      key: 'rewardStatus',
      render: (status: string) => (
        <Tag color={status === 'paid' ? 'success' : status === 'pending' ? 'warning' : 'default'}>
          {status === 'paid' ? '已发放' : status === 'pending' ? '待发放' : status}
        </Tag>
      ),
    },
    {
      title: '时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (v: string) => new Date(v).toLocaleString('zh-CN'),
    },
  ];

  // 邀请排行榜列
  const topReferrerColumns = [
    {
      title: '排名',
      key: 'rank',
      width: 60,
      render: (_: unknown, __: unknown, index: number) => (
        <Tag color={index < 3 ? 'gold' : 'default'}>{index + 1}</Tag>
      ),
    },
    {
      title: '用户',
      key: 'user',
      render: (record: any) => (
        <Space direction="vertical" size={0}>
          <Text>{record.nickname || record.email}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.inviteCode}</Text>
        </Space>
      ),
    },
    {
      title: '邀请人数',
      dataIndex: 'inviteeCount',
      key: 'inviteeCount',
      render: (val: number) => <Tag color="blue">{val} 人</Tag>,
    },
    {
      title: '累计返佣',
      dataIndex: 'totalReward',
      key: 'totalReward',
      render: (val: string) => (
        <Text style={{ color: '#52c41a' }}>${parseFloat(val).toFixed(2)}</Text>
      ),
    },
  ];

  // 代理商统计
  const agentStats = {
    total: agents.length,
    active: agents.filter(a => a.status === 'active').length,
    totalMembers: agents.reduce((sum, a) => sum + a.teamMemberCount, 0),
    pendingCommission: agents.reduce((sum, a) => sum + parseFloat(a.pendingCommission || '0'), 0),
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
              <Spin spinning={agentsLoading}>
                <Alert
                  message="官方代理商说明"
                  description="官方代理商通过签订合作协议获得团队业绩分成资格。"
                  type="info"
                  showIcon
                  style={{ marginBottom: 24 }}
                />

                <Row gutter={16} style={{ marginBottom: 24 }}>
                  <Col span={6}>
                    <Card size="small">
                      <Statistic
                        title="签约代理商"
                        value={agentStats.total}
                        prefix={<CrownOutlined />}
                        suffix={<Text type="secondary">/ {agentStats.active} 活跃</Text>}
                      />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card size="small">
                      <Statistic
                        title="团队总人数"
                        value={agentStats.totalMembers}
                        prefix={<TeamOutlined />}
                      />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card size="small">
                      <Statistic
                        title="待结算佣金"
                        value={agentStats.pendingCommission.toFixed(2)}
                        prefix={<DollarOutlined />}
                        suffix="USDT"
                        valueStyle={{ color: '#faad14' }}
                      />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card size="small">
                      <Space>
                        <Button
                          type="primary"
                          icon={<PlusOutlined />}
                          onClick={() => {
                            setEditingAgent(null);
                            agentForm.resetFields();
                            setAgentModalVisible(true);
                          }}
                        >
                          新增代理商
                        </Button>
                        <Tag
                          icon={<ReloadOutlined spin={agentsLoading} />}
                          color="blue"
                          style={{ cursor: 'pointer' }}
                          onClick={fetchAgents}
                        >
                          刷新
                        </Tag>
                      </Space>
                    </Card>
                  </Col>
                </Row>

                <Card>
                  <Table
                    dataSource={agents}
                    columns={agentColumns}
                    rowKey="id"
                    pagination={{ pageSize: 10 }}
                    locale={{ emptyText: <Empty description="暂无代理商" /> }}
                  />
                </Card>
              </Spin>
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
              <Spin spinning={referralLoading}>
                <Alert
                  message="用户推荐说明"
                  description={
                    <div>
                      <p>所有用户均自动拥有推荐功能，当前返佣比例：</p>
                      <ul style={{ margin: '8px 0', paddingLeft: 20 }}>
                        <li><strong>一级推荐 (L1)</strong>：<Tag color="blue">{referralConfig ? referralConfig.level1Rate : '10'}%</Tag></li>
                        <li><strong>二级推荐 (L2)</strong>：<Tag color="cyan">{referralConfig ? referralConfig.level2Rate : '5'}%</Tag></li>
                        <li><strong>三级推荐 (L3)</strong>：<Tag color="purple">{referralConfig ? referralConfig.level3Rate : '2'}%</Tag></li>
                      </ul>
                    </div>
                  }
                  type="info"
                  showIcon
                  style={{ marginBottom: 24 }}
                  action={
                    <Button
                      size="small"
                      icon={<SettingOutlined />}
                      onClick={() => {
                        if (referralConfig) {
                          configForm.setFieldsValue({
                            level1Rate: parseFloat(referralConfig.level1Rate),
                            level2Rate: parseFloat(referralConfig.level2Rate),
                            level3Rate: parseFloat(referralConfig.level3Rate),
                            maxLevels: referralConfig.maxLevels,
                          });
                        }
                        setConfigModalVisible(true);
                      }}
                    >
                      配置
                    </Button>
                  }
                />

                <Row gutter={16} style={{ marginBottom: 24 }}>
                  <Col span={6}>
                    <Card size="small">
                      <Statistic
                        title="总邀请人数"
                        value={referralOverview?.totalReferrals || 0}
                        prefix={<UserAddOutlined />}
                      />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card size="small">
                      <Statistic
                        title="累计返佣"
                        value={parseFloat(referralOverview?.totalRewards || '0')}
                        prefix={<GiftOutlined />}
                        suffix="USDT"
                        valueStyle={{ color: '#52c41a' }}
                        precision={2}
                      />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card size="small">
                      <Statistic
                        title="待发放返佣"
                        value={parseFloat(referralOverview?.pendingRewards || '0')}
                        prefix={<DollarOutlined />}
                        suffix="USDT"
                        valueStyle={{ color: '#faad14' }}
                        precision={2}
                      />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card size="small">
                      <Tag
                        icon={<ReloadOutlined spin={referralLoading} />}
                        color="blue"
                        style={{ cursor: 'pointer' }}
                        onClick={fetchReferralData}
                      >
                        刷新
                      </Tag>
                    </Card>
                  </Col>
                </Row>

                <Row gutter={16}>
                  <Col span={12}>
                    <Card title="邀请排行榜" size="small">
                      <Table
                        dataSource={referralOverview?.topReferrers || []}
                        columns={topReferrerColumns}
                        rowKey="id"
                        pagination={false}
                        size="small"
                        locale={{ emptyText: <Empty description="暂无数据" /> }}
                      />
                    </Card>
                  </Col>
                  <Col span={12}>
                    <Card title="最近邀请记录" size="small">
                      <Table
                        dataSource={referralRelations.slice(0, 10)}
                        columns={referralColumns}
                        rowKey="id"
                        pagination={false}
                        size="small"
                        locale={{ emptyText: <Empty description="暂无数据" /> }}
                      />
                    </Card>
                  </Col>
                </Row>
              </Spin>
            ),
          },
        ]}
      />

      {/* 代理商编辑弹窗 */}
      <Modal
        title={<><CrownOutlined /> {editingAgent ? '编辑代理商' : '新增代理商'}</>}
        open={agentModalVisible}
        onOk={handleSaveAgent}
        onCancel={() => {
          setAgentModalVisible(false);
          agentForm.resetFields();
          setEditingAgent(null);
        }}
        width={600}
      >
        <Form form={agentForm} layout="vertical">
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
                name="email"
                label="邮箱"
                rules={[{ required: true, type: 'email', message: '请输入有效邮箱' }]}
              >
                <Input placeholder="联系邮箱" />
              </Form.Item>
            </Col>
          </Row>
          {!editingAgent && (
            <Row gutter={16}>
              <Col span={24}>
                <Form.Item
                  name="password"
                  label="登录密码"
                  rules={[
                    { required: true, message: '请输入密码' },
                    { min: 6, message: '密码至少6位' },
                  ]}
                >
                  <Input.Password placeholder="代理商登录密码" />
                </Form.Item>
              </Col>
            </Row>
          )}
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="phone"
                label="联系电话"
              >
                <Input placeholder="联系电话" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="commissionRate"
                label="分成比例 (%)"
                rules={[{ required: true, message: '请输入分成比例' }]}
              >
                <InputNumber min={1} max={50} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          {editingAgent && (
            <Form.Item
              name="status"
              label="状态"
            >
              <Select
                options={[
                  { value: 'active', label: '合作中' },
                  { value: 'suspended', label: '已暂停' },
                  { value: 'pending', label: '待审核' },
                ]}
              />
            </Form.Item>
          )}
        </Form>
      </Modal>

      {/* 推荐配置弹窗 */}
      <Modal
        title={<><SettingOutlined /> 推荐返佣配置</>}
        open={configModalVisible}
        onOk={handleSaveConfig}
        onCancel={() => setConfigModalVisible(false)}
        width={500}
      >
        <Form form={configForm} layout="vertical">
          <Form.Item
            name="level1Rate"
            label="一级返佣比例 (%)"
            rules={[{ required: true, message: '请输入比例' }]}
          >
            <InputNumber min={0} max={50} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="level2Rate"
            label="二级返佣比例 (%)"
            rules={[{ required: true, message: '请输入比例' }]}
          >
            <InputNumber min={0} max={30} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="level3Rate"
            label="三级返佣比例 (%)"
            rules={[{ required: true, message: '请输入比例' }]}
          >
            <InputNumber min={0} max={20} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="maxLevels"
            label="最大返佣层级"
          >
            <Select
              options={[
                { value: 1, label: '1 级' },
                { value: 2, label: '2 级' },
                { value: 3, label: '3 级' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
