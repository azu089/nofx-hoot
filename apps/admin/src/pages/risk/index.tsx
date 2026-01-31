/**
 * 风控管理页面
 * 风控规则配置、异常检测、黑名单管理
 */
import {
  Card,
  Row,
  Col,
  Table,
  Tag,
  Space,
  Typography,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Switch,
  Tabs,
  Statistic,
  Alert,
  message,
  Popconfirm,
} from 'antd';
import {
  SafetyOutlined,
  WarningOutlined,
  StopOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import { useState } from 'react';

const { Title, Text } = Typography;

// 风控规则接口
interface IRiskRule {
  id: string;
  name: string;
  type: 'position' | 'trade' | 'amount' | 'frequency';
  condition: string;
  action: 'warn' | 'block' | 'notify';
  enabled: boolean;
  triggerCount: number;
  lastTriggered?: string;
}

// 异常记录接口
interface IAnomalyRecord {
  id: string;
  userId: string;
  username: string;
  type: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  status: 'pending' | 'resolved' | 'ignored';
  time: string;
}

// 黑名单接口
interface IBlacklistItem {
  id: string;
  type: 'ip' | 'device' | 'user' | 'wallet';
  value: string;
  reason: string;
  addedBy: string;
  addedAt: string;
  expiresAt?: string;
}

// 模拟风控规则
const mockRules: IRiskRule[] = [
  { id: 'R001', name: '最大持仓数限制', type: 'position', condition: '持仓数量 > 10', action: 'block', enabled: true, triggerCount: 156 },
  { id: 'R002', name: '单日交易次数限制', type: 'frequency', condition: '日交易次数 > 50', action: 'warn', enabled: true, triggerCount: 89, lastTriggered: '2025-01-30 14:20:00' },
  { id: 'R003', name: '单笔交易金额限制', type: 'amount', condition: '单笔金额 > 10000 USDT', action: 'block', enabled: true, triggerCount: 23 },
  { id: 'R004', name: '连续亏损限制', type: 'trade', condition: '连续亏损 > 5 次', action: 'notify', enabled: true, triggerCount: 45 },
  { id: 'R005', name: '日亏损限制', type: 'amount', condition: '日亏损 > 500 USDT', action: 'block', enabled: false, triggerCount: 12 },
];

// 模拟异常记录
const mockAnomalies: IAnomalyRecord[] = [
  { id: 'A001', userId: 'U001', username: '张三', type: '频繁交易', description: '1小时内交易30次', severity: 'medium', status: 'pending', time: '2025-01-30 14:25:00' },
  { id: 'A002', userId: 'U002', username: '李四', type: '大额提现', description: '单笔提现 5000 USDT', severity: 'high', status: 'pending', time: '2025-01-30 14:20:00' },
  { id: 'A003', userId: 'U003', username: '王五', type: '异地登录', description: '检测到异地登录', severity: 'low', status: 'resolved', time: '2025-01-30 12:00:00' },
  { id: 'A004', userId: 'U004', username: '赵六', type: '连续亏损', description: '连续亏损8次', severity: 'medium', status: 'ignored', time: '2025-01-30 10:00:00' },
];

// 模拟黑名单
const mockBlacklist: IBlacklistItem[] = [
  { id: 'B001', type: 'ip', value: '192.168.1.100', reason: '恶意刷单', addedBy: 'admin', addedAt: '2025-01-29 10:00:00' },
  { id: 'B002', type: 'device', value: 'DEV-ABC123', reason: '多账号注册', addedBy: 'system', addedAt: '2025-01-28 15:00:00' },
  { id: 'B003', type: 'wallet', value: '0x1234...5678', reason: '可疑资金来源', addedBy: 'admin', addedAt: '2025-01-27 09:00:00', expiresAt: '2025-02-27 09:00:00' },
];

export const RiskManagementPage = () => {
  const [rules, setRules] = useState(mockRules);
  const [anomalies, setAnomalies] = useState(mockAnomalies);
  const [blacklist, setBlacklist] = useState(mockBlacklist);
  const [ruleModalVisible, setRuleModalVisible] = useState(false);
  const [blacklistModalVisible, setBlacklistModalVisible] = useState(false);
  const [editingRule, setEditingRule] = useState<IRiskRule | null>(null);
  const [ruleForm] = Form.useForm();
  const [blacklistForm] = Form.useForm();

  // 规则类型映射
  const ruleTypeMap: Record<string, string> = {
    position: '持仓限制',
    trade: '交易限制',
    amount: '金额限制',
    frequency: '频率限制',
  };

  // 动作映射
  const actionMap: Record<string, { color: string; text: string }> = {
    warn: { color: 'orange', text: '警告' },
    block: { color: 'red', text: '阻止' },
    notify: { color: 'blue', text: '通知' },
  };

  // 严重程度映射
  const severityMap: Record<string, { color: string; text: string }> = {
    low: { color: 'green', text: '低' },
    medium: { color: 'orange', text: '中' },
    high: { color: 'red', text: '高' },
  };

  // 状态映射
  const statusMap: Record<string, { color: string; text: string }> = {
    pending: { color: 'orange', text: '待处理' },
    resolved: { color: 'green', text: '已处理' },
    ignored: { color: 'default', text: '已忽略' },
  };

  // 规则表格列
  const ruleColumns = [
    { title: '规则ID', dataIndex: 'id', key: 'id', width: 80 },
    { title: '规则名称', dataIndex: 'name', key: 'name', render: (name: string) => <Text strong>{name}</Text> },
    { title: '类型', dataIndex: 'type', key: 'type', render: (type: string) => <Tag>{ruleTypeMap[type]}</Tag> },
    { title: '触发条件', dataIndex: 'condition', key: 'condition' },
    {
      title: '触发动作',
      dataIndex: 'action',
      key: 'action',
      render: (action: string) => <Tag color={actionMap[action].color}>{actionMap[action].text}</Tag>,
    },
    { title: '触发次数', dataIndex: 'triggerCount', key: 'triggerCount' },
    {
      title: '状态',
      dataIndex: 'enabled',
      key: 'enabled',
      render: (enabled: boolean, record: IRiskRule) => (
        <Switch
          checked={enabled}
          onChange={(checked) => {
            setRules(rules.map(r => r.id === record.id ? { ...r, enabled: checked } : r));
            message.success(`规则 "${record.name}" 已${checked ? '启用' : '禁用'}`);
          }}
        />
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record: IRiskRule) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => {
              setEditingRule(record);
              ruleForm.setFieldsValue(record);
              setRuleModalVisible(true);
            }}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定删除该规则？"
            onConfirm={() => {
              setRules(rules.filter(r => r.id !== record.id));
              message.success('规则已删除');
            }}
          >
            <Button type="link" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // 异常记录表格列
  const anomalyColumns = [
    { title: '用户', dataIndex: 'username', key: 'username' },
    { title: '异常类型', dataIndex: 'type', key: 'type' },
    { title: '描述', dataIndex: 'description', key: 'description' },
    {
      title: '严重程度',
      dataIndex: 'severity',
      key: 'severity',
      render: (severity: string) => <Tag color={severityMap[severity].color}>{severityMap[severity].text}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => <Tag color={statusMap[status].color}>{statusMap[status].text}</Tag>,
    },
    { title: '时间', dataIndex: 'time', key: 'time' },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record: IAnomalyRecord) => (
        record.status === 'pending' && (
          <Space>
            <Button
              type="link"
              icon={<CheckCircleOutlined />}
              onClick={() => {
                setAnomalies(anomalies.map(a => a.id === record.id ? { ...a, status: 'resolved' } : a));
                message.success('已标记为已处理');
              }}
            >
              处理
            </Button>
            <Button
              type="link"
              icon={<CloseCircleOutlined />}
              onClick={() => {
                setAnomalies(anomalies.map(a => a.id === record.id ? { ...a, status: 'ignored' } : a));
                message.success('已忽略');
              }}
            >
              忽略
            </Button>
          </Space>
        )
      ),
    },
  ];

  // 黑名单表格列
  const blacklistColumns = [
    { title: '类型', dataIndex: 'type', key: 'type', render: (type: string) => <Tag>{type.toUpperCase()}</Tag> },
    { title: '值', dataIndex: 'value', key: 'value', render: (value: string) => <Text code>{value}</Text> },
    { title: '原因', dataIndex: 'reason', key: 'reason' },
    { title: '添加人', dataIndex: 'addedBy', key: 'addedBy' },
    { title: '添加时间', dataIndex: 'addedAt', key: 'addedAt' },
    { title: '过期时间', dataIndex: 'expiresAt', key: 'expiresAt', render: (t: string) => t || '永久' },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record: IBlacklistItem) => (
        <Popconfirm
          title="确定从黑名单移除？"
          onConfirm={() => {
            setBlacklist(blacklist.filter(b => b.id !== record.id));
            message.success('已从黑名单移除');
          }}
        >
          <Button type="link" danger icon={<DeleteOutlined />}>移除</Button>
        </Popconfirm>
      ),
    },
  ];

  // 保存规则
  const handleSaveRule = () => {
    ruleForm.validateFields().then(values => {
      if (editingRule) {
        setRules(rules.map(r => r.id === editingRule.id ? { ...r, ...values } : r));
        message.success('规则已更新');
      } else {
        const newRule: IRiskRule = {
          id: `R${String(rules.length + 1).padStart(3, '0')}`,
          ...values,
          triggerCount: 0,
          enabled: true,
        };
        setRules([...rules, newRule]);
        message.success('规则已创建');
      }
      setRuleModalVisible(false);
      setEditingRule(null);
      ruleForm.resetFields();
    });
  };

  // 添加黑名单
  const handleAddBlacklist = () => {
    blacklistForm.validateFields().then(values => {
      const newItem: IBlacklistItem = {
        id: `B${String(blacklist.length + 1).padStart(3, '0')}`,
        ...values,
        addedBy: 'admin',
        addedAt: new Date().toLocaleString(),
      };
      setBlacklist([...blacklist, newItem]);
      message.success('已添加到黑名单');
      setBlacklistModalVisible(false);
      blacklistForm.resetFields();
    });
  };

  const pendingAnomalies = anomalies.filter(a => a.status === 'pending').length;
  const highSeverityAnomalies = anomalies.filter(a => a.severity === 'high' && a.status === 'pending').length;

  const tabItems = [
    {
      key: 'rules',
      label: (
        <span>
          <SafetyOutlined />
          风控规则
        </span>
      ),
      children: (
        <Card
          extra={
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setEditingRule(null);
                ruleForm.resetFields();
                setRuleModalVisible(true);
              }}
            >
              新增规则
            </Button>
          }
        >
          <Table
            dataSource={rules}
            columns={ruleColumns}
            rowKey="id"
            pagination={false}
          />
        </Card>
      ),
    },
    {
      key: 'anomalies',
      label: (
        <span>
          <WarningOutlined />
          异常检测
          {pendingAnomalies > 0 && <Tag color="red" style={{ marginLeft: 8 }}>{pendingAnomalies}</Tag>}
        </span>
      ),
      children: (
        <Card>
          {highSeverityAnomalies > 0 && (
            <Alert
              message={`有 ${highSeverityAnomalies} 条高风险异常待处理`}
              type="error"
              showIcon
              style={{ marginBottom: 16 }}
            />
          )}
          <Table
            dataSource={anomalies}
            columns={anomalyColumns}
            rowKey="id"
            pagination={{ pageSize: 10 }}
          />
        </Card>
      ),
    },
    {
      key: 'blacklist',
      label: (
        <span>
          <StopOutlined />
          黑名单
        </span>
      ),
      children: (
        <Card
          extra={
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                blacklistForm.resetFields();
                setBlacklistModalVisible(true);
              }}
            >
              添加黑名单
            </Button>
          }
        >
          <Table
            dataSource={blacklist}
            columns={blacklistColumns}
            rowKey="id"
            pagination={{ pageSize: 10 }}
          />
        </Card>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Title level={4} style={{ marginBottom: 24 }}>风控管理</Title>

      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginTop: 24, marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="启用规则数"
              value={rules.filter(r => r.enabled).length}
              suffix={`/ ${rules.length}`}
              prefix={<SafetyOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="今日触发次数"
              value={rules.reduce((sum, r) => sum + r.triggerCount, 0)}
              prefix={<ExclamationCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="待处理异常"
              value={pendingAnomalies}
              valueStyle={{ color: pendingAnomalies > 0 ? '#faad14' : '#52c41a' }}
              prefix={<WarningOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="黑名单数量"
              value={blacklist.length}
              prefix={<StopOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* 标签页 */}
      <Tabs items={tabItems} />

      {/* 规则编辑弹窗 */}
      <Modal
        title={editingRule ? '编辑规则' : '新增规则'}
        open={ruleModalVisible}
        onOk={handleSaveRule}
        onCancel={() => {
          setRuleModalVisible(false);
          setEditingRule(null);
          ruleForm.resetFields();
        }}
        width={600}
      >
        <Form form={ruleForm} layout="vertical">
          <Form.Item name="name" label="规则名称" rules={[{ required: true }]}>
            <Input placeholder="请输入规则名称" />
          </Form.Item>
          <Form.Item name="type" label="规则类型" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'position', label: '持仓限制' },
                { value: 'trade', label: '交易限制' },
                { value: 'amount', label: '金额限制' },
                { value: 'frequency', label: '频率限制' },
              ]}
            />
          </Form.Item>
          <Form.Item name="condition" label="触发条件" rules={[{ required: true }]}>
            <Input placeholder="如: 持仓数量 > 10" />
          </Form.Item>
          <Form.Item name="action" label="触发动作" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'warn', label: '警告 - 仅记录和通知' },
                { value: 'block', label: '阻止 - 阻止交易执行' },
                { value: 'notify', label: '通知 - 发送通知给管理员' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* 黑名单添加弹窗 */}
      <Modal
        title="添加黑名单"
        open={blacklistModalVisible}
        onOk={handleAddBlacklist}
        onCancel={() => {
          setBlacklistModalVisible(false);
          blacklistForm.resetFields();
        }}
      >
        <Form form={blacklistForm} layout="vertical">
          <Form.Item name="type" label="类型" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'ip', label: 'IP 地址' },
                { value: 'device', label: '设备指纹' },
                { value: 'user', label: '用户ID' },
                { value: 'wallet', label: '钱包地址' },
              ]}
            />
          </Form.Item>
          <Form.Item name="value" label="值" rules={[{ required: true }]}>
            <Input placeholder="请输入要加入黑名单的值" />
          </Form.Item>
          <Form.Item name="reason" label="原因" rules={[{ required: true }]}>
            <Input.TextArea rows={3} placeholder="请输入加入黑名单的原因" />
          </Form.Item>
          <Form.Item name="expiresAt" label="过期时间">
            <Input placeholder="留空表示永久，或输入过期时间" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
