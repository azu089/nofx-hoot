/**
 * 风控管理页面
 * 连接真实后端 API
 */
import { useState, useEffect, useCallback } from 'react';
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
  Popconfirm,
  Spin,
  Empty,
} from 'antd';
import { useMessage } from '../../hooks';
import {
  SafetyOutlined,
  WarningOutlined,
  StopOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { adminApi } from '../../lib/admin-api';

const { Title, Text } = Typography;

// 风控概览接口
interface IRiskOverview {
  openPositions: number;
  todayClosedPositions: number;
  totalExposure: string;
  lossPositions: number;
  stopLossCount: number;
  blackSwanCount: number;
}

// 风险事件接口
interface IRiskEvent {
  id: string;
  userId: string;
  username: string;
  exchange: string;
  symbol: string;
  side: string;
  entryPrice: string;
  exitPrice: string;
  amount: string;
  pnl: string;
  closeReason: string;
  closedAt: string;
}

// 风控规则接口（本地管理，后续可扩展到数据库）
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

// 黑名单接口（本地管理，后续可扩展到数据库）
interface IBlacklistItem {
  id: string;
  type: 'ip' | 'device' | 'user' | 'wallet';
  value: string;
  reason: string;
  addedBy: string;
  addedAt: string;
  expiresAt?: string;
}

export const RiskManagementPage = () => {
  const message = useMessage();
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<IRiskOverview | null>(null);
  const [riskEvents, setRiskEvents] = useState<IRiskEvent[]>([]);
  const [eventsTotal, setEventsTotal] = useState(0);
  const [eventsPage, setEventsPage] = useState(1);
  const [eventsPageSize] = useState(10);

  // 本地管理的规则和黑名单（后续可扩展到数据库）
  const [rules, setRules] = useState<IRiskRule[]>([]);
  const [blacklist, setBlacklist] = useState<IBlacklistItem[]>([]);
  const [ruleModalVisible, setRuleModalVisible] = useState(false);
  const [blacklistModalVisible, setBlacklistModalVisible] = useState(false);
  const [editingRule, setEditingRule] = useState<IRiskRule | null>(null);
  const [ruleForm] = Form.useForm();
  const [blacklistForm] = Form.useForm();

  // 加载风控概览
  const loadOverview = useCallback(async () => {
    try {
      const response = await adminApi.get('/admin/risk/overview');
      if (response.data.code === 0) {
        setOverview(response.data.data as IRiskOverview);
      }
    } catch (error) {
      console.error('加载风控概览失败:', error);
    }
  }, []);

  // 加载风险事件
  const loadRiskEvents = useCallback(async () => {
    try {
      const response = await adminApi.get(`/admin/risk/events?page=${eventsPage}&limit=${eventsPageSize}`);
      if (response.data.code === 0) {
        const data = response.data.data as { items: IRiskEvent[]; total: number };
        setRiskEvents(data.items || []);
        setEventsTotal(data.total || 0);
      }
    } catch (error) {
      console.error('加载风险事件失败:', error);
    }
  }, [eventsPage, eventsPageSize]);

  // 刷新所有数据
  const refreshAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadOverview(), loadRiskEvents()]);
    setLoading(false);
  }, [loadOverview, loadRiskEvents]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

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

  // 风险事件类型映射
  const closeReasonMap: Record<string, { color: string; text: string }> = {
    stop_loss: { color: 'orange', text: '止损触发' },
    black_swan: { color: 'red', text: '黑天鹅' },
    daily_loss_limit: { color: 'volcano', text: '日亏损限制' },
    take_profit: { color: 'green', text: '止盈' },
    manual: { color: 'blue', text: '手动平仓' },
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

  // 风险事件表格列
  const riskEventColumns = [
    {
      title: '时间',
      dataIndex: 'closedAt',
      key: 'closedAt',
      width: 160,
      render: (date: string) => date ? new Date(date).toLocaleString() : '-',
    },
    {
      title: '用户',
      dataIndex: 'username',
      key: 'username',
      width: 100,
    },
    {
      title: '交易所',
      dataIndex: 'exchange',
      key: 'exchange',
      width: 100,
      render: (exchange: string) => <Tag>{exchange?.toUpperCase()}</Tag>,
    },
    {
      title: '交易对',
      dataIndex: 'symbol',
      key: 'symbol',
      width: 100,
    },
    {
      title: '方向',
      dataIndex: 'side',
      key: 'side',
      width: 80,
      render: (side: string) => (
        <Tag color={side === 'long' ? 'green' : 'red'}>
          {side === 'long' ? '多' : '空'}
        </Tag>
      ),
    },
    {
      title: '开仓价',
      dataIndex: 'entryPrice',
      key: 'entryPrice',
      width: 100,
      render: (price: string) => `$${parseFloat(price || '0').toLocaleString()}`,
    },
    {
      title: '平仓价',
      dataIndex: 'exitPrice',
      key: 'exitPrice',
      width: 100,
      render: (price: string) => `$${parseFloat(price || '0').toLocaleString()}`,
    },
    {
      title: '盈亏',
      dataIndex: 'pnl',
      key: 'pnl',
      width: 100,
      render: (pnl: string) => {
        const value = parseFloat(pnl || '0');
        return (
          <span style={{ color: value >= 0 ? '#52c41a' : '#f5222d', fontWeight: 600 }}>
            {value >= 0 ? '+' : ''}{value.toFixed(2)}
          </span>
        );
      },
    },
    {
      title: '触发原因',
      dataIndex: 'closeReason',
      key: 'closeReason',
      width: 120,
      render: (reason: string) => {
        const config = closeReasonMap[reason] || { color: 'default', text: reason };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
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

  const tabItems = [
    {
      key: 'events',
      label: (
        <span>
          <WarningOutlined />
          风险事件
          {eventsTotal > 0 && <Tag color="red" style={{ marginLeft: 8 }}>{eventsTotal}</Tag>}
        </span>
      ),
      children: (
        <Card>
          <Table
            dataSource={riskEvents}
            columns={riskEventColumns}
            rowKey="id"
            pagination={{
              current: eventsPage,
              pageSize: eventsPageSize,
              total: eventsTotal,
              showTotal: (t) => `共 ${t} 条`,
              onChange: (p) => setEventsPage(p),
            }}
            locale={{ emptyText: <Empty description="暂无风险事件" /> }}
          />
        </Card>
      ),
    },
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
          <Alert
            message="风控规则功能"
            description="规则配置将在后续版本中支持持久化存储，当前为本地管理。"
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
          <Table
            dataSource={rules}
            columns={ruleColumns}
            rowKey="id"
            pagination={false}
            locale={{ emptyText: <Empty description="暂无风控规则，点击「新增规则」添加" /> }}
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
          <Alert
            message="黑名单功能"
            description="黑名单管理将在后续版本中支持持久化存储，当前为本地管理。"
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
          <Table
            dataSource={blacklist}
            columns={blacklistColumns}
            rowKey="id"
            pagination={{ pageSize: 10 }}
            locale={{ emptyText: <Empty description="暂无黑名单记录" /> }}
          />
        </Card>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}>风控管理</Title>
        <Button icon={<ReloadOutlined />} onClick={refreshAll} loading={loading}>
          刷新
        </Button>
      </div>

      <Spin spinning={loading}>
        {/* 统计卡片 */}
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={4}>
            <Card>
              <Statistic
                title="当前开仓"
                value={overview?.openPositions || 0}
                prefix={<SafetyOutlined />}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card>
              <Statistic
                title="今日平仓"
                value={overview?.todayClosedPositions || 0}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card>
              <Statistic
                title="风险敞口"
                value={parseFloat(overview?.totalExposure || '0')}
                precision={2}
                prefix="$"
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card>
              <Statistic
                title="亏损仓位"
                value={overview?.lossPositions || 0}
                valueStyle={{ color: (overview?.lossPositions || 0) > 0 ? '#f5222d' : '#52c41a' }}
                prefix={<WarningOutlined />}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card>
              <Statistic
                title="止损触发"
                value={overview?.stopLossCount || 0}
                valueStyle={{ color: (overview?.stopLossCount || 0) > 0 ? '#faad14' : '#52c41a' }}
                prefix={<ExclamationCircleOutlined />}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card>
              <Statistic
                title="黑天鹅"
                value={overview?.blackSwanCount || 0}
                valueStyle={{ color: (overview?.blackSwanCount || 0) > 0 ? '#f5222d' : '#52c41a' }}
                prefix={<StopOutlined />}
              />
            </Card>
          </Col>
        </Row>

        {/* 标签页 */}
        <Tabs items={tabItems} />
      </Spin>

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
